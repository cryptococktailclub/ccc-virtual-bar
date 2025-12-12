// netlify/functions/ccc-bartender.js
// CCC Bar Bot backend: deterministic recipe lookup + lightweight wizard filtering.
// Goals:
// 1) Always return correct Milk & Honey specs for named cocktails in recipes.json (no model drift).
// 2) Keep token usage minimal by only calling OpenAI when strictly necessary (optional).

const fs = require("fs");
const path = require("path");

// Optional: if OPENAI_API_KEY is set, we can use OpenAI for non-deterministic Q&A.
// If you want ZERO model usage, leave OPENAI_API_KEY unset and the function will fall back
// to deterministic matches + simple alternatives.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ------------ Load recipes.json (bundled alongside this function) ------------
function loadRecipes() {
  const recipesPath = path.join(__dirname, "recipes.json");
  const raw = fs.readFileSync(recipesPath, "utf8");
  const parsed = JSON.parse(raw);
  // Expect an array of recipe objects
  return Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.recipes) ? parsed.recipes : []);
}

const MILK_HONEY_RECIPES = require("./recipes.json");


// ------------ Normalization helpers ------------
function norm(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripCocktailSuffix(nameNorm) {
  // "left hand cocktail" -> "left hand"
  return nameNorm.replace(/\bcocktail\b/g, "").replace(/\s+/g, " ").trim();
}

function unique(arr) {
  return Array.from(new Set(arr));
}

// Build lookup maps once
const RECIPES_BY_NORM = new Map();      // normalized full name -> recipe
const RECIPES_BY_SHORT = new Map();     // normalized name with "cocktail" removed -> recipe
const ALL_NAME_NORMS = [];              // for longest-match scanning

for (const r of MILK_HONEY_RECIPES) {
  const n = norm(r.name);
  if (!n) continue;
  if (!RECIPES_BY_NORM.has(n)) RECIPES_BY_NORM.set(n, r);

  const short = stripCocktailSuffix(n);
  if (short && !RECIPES_BY_SHORT.has(short)) RECIPES_BY_SHORT.set(short, r);

  ALL_NAME_NORMS.push(n);
  if (short && short !== n) ALL_NAME_NORMS.push(short);
}

// Prefer longest names first when scanning questions
ALL_NAME_NORMS.sort((a, b) => b.length - a.length);

// ------------ Recipe shaping for client ------------
function toStructuredRecipe(r, why = "") {
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.map((i) => ({
        amount: String(i.amount || "").trim(),
        ingredient: String(i.ingredient || "").trim(),
      }))
    : [];

  return {
    name: r.name || "Untitled Cocktail",
    description: why || r.description || "",
    ingredients,
    glass: r.glass || "",
    method: r.method || "",
    ice: r.ice || "",
    garnish: r.garnish || "",
    notes: r.notes || "",
  };
}

function jsonResponse(structured, statusCode = 200) {
  const raw = JSON.stringify(structured);
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structured, answer: raw }),
  };
}

// ------------ Deterministic name detection ------------
function findRecipeFromQuestion(question) {
  const qn = norm(question);
  if (!qn) return null;

  // Fast: exact whole-string match
  if (RECIPES_BY_NORM.has(qn)) return RECIPES_BY_NORM.get(qn);
  if (RECIPES_BY_SHORT.has(qn)) return RECIPES_BY_SHORT.get(qn);

  // Longest-match scan inside question
  // Use word-boundary-ish matching on the normalized string (space-separated words)
  for (const nameNorm of ALL_NAME_NORMS) {
    // ensure we match as a phrase in the question
    const pattern = new RegExp(`(?:^|\\s)${nameNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i");
    if (pattern.test(" " + qn + " ")) {
      return RECIPES_BY_NORM.get(nameNorm) || RECIPES_BY_SHORT.get(nameNorm) || null;
    }
  }
  return null;
}

function isAskingForSpec(question) {
  const q = norm(question);
  if (!q) return false;
  return (
    q.includes("spec") ||
    q.includes("recipe") ||
    q.includes("how to make") ||
    q.includes("build") ||
    q.includes("make a") ||
    q.includes("how do i make") ||
    // common pattern: user just types the drink name
    q.split(" ").length <= 5
  );
}

// ------------ Wizard filtering (no OpenAI) ------------
function recipeMatchesWizard(r, prefs) {
  const method = norm(r.method);
  const ice = norm(r.ice);

  // Style
  if (prefs.style === "light_refreshing") {
    const ok =
      method.includes("shake") ||
      method.includes("build") ||
      method.includes("swizzle") ||
      method.includes("highball");
    if (!ok) return false;
  }

  if (prefs.style === "spirit_forward") {
    const ok =
      method.includes("stir") ||
      method.includes("old fashioned") ||
      method.includes("manhattan");
    if (!ok) return false;
  }

  // Ice preference
  if (prefs.ice === "on_ice") {
    const ok = !(ice.includes("none") || ice.includes("up") || ice.includes("no ice"));
    if (!ok) return false;
  }

  if (prefs.ice === "no_ice") {
    const ok = ice.includes("none") || ice.includes("up") || ice.includes("no ice");
    if (!ok) return false;
  }

  // Spirit preference(s) — match against ingredients + common fields (NOT just category)
  if (Array.isArray(prefs.spirits) && prefs.spirits.length) {
    const haystackParts = [
      r.name,
      r.category,
      r.baseSpirit,
      r.spirit,
      r.method,
      r.ice,
      ...(Array.isArray(r.ingredients) ? r.ingredients.map((i) => i.ingredient) : []),
    ];
    const haystack = norm(haystackParts.filter(Boolean).join(" "));

    // Normalize wizard spirit values to common synonyms
    const wanted = new Set();
    for (const raw of prefs.spirits) {
      const s = norm(raw);

      // direct
      if (s) wanted.add(s);

      // synonyms / grouping
      if (s === "mezcal" || s === "tequila") wanted.add("agave");
      if (s === "rye_whiskey") {
        wanted.add("rye");
        wanted.add("whiskey");
      }
      if (s === "cachaca") wanted.add("cacha a"); // norm() turns ç into space sometimes; keep tolerant
    }

    const ok = Array.from(wanted).some((w) => w && haystack.includes(w));
    if (!ok) return false;
  }

  return true;
}

// ------------ Netlify handler ------------
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {
    body = {};
  }

  const mode = String(body.mode || "chat");
  const question = String(body.question || "").trim();
  const wizardPrefs = body.wizard_preferences || {};

  // 1) Wizard: deterministic recommendations only
  if (mode === "wizard") {
    const prefs = {
      style: wizardPrefs.style || null,
      ice: wizardPrefs.ice || null,
      spirits: Array.isArray(wizardPrefs.spirits) ? wizardPrefs.spirits : [],
    };

    const { top, warnings } = recommendFromWizard(prefs);

    const structured = {
      summary: top.length
        ? "Here are three Milk & Honey picks that fit your vibe. Choose one and I’ll pour the exact spec."
        : "I couldn’t find a strong Milk & Honey match for those filters.",
      warnings: warnings || [],
      recipes: top.map((r) => toStructuredRecipe(r, "Recommended based on your wizard picks.")),
    };

    return jsonResponse(structured);
  }

  // 2) Chat: if user asks for a specific drink spec, return exact recipe deterministically
  if (question) {
    const match = findRecipeFromQuestion(question);
    if (match && isAskingForSpec(question)) {
      const structured = {
        summary: `Milk & Honey spec for ${match.name}.`,
        warnings: [],
        recipes: [toStructuredRecipe(match, "Exact spec from the Milk & Honey dataset.")],
      };
      return jsonResponse(structured);
    }
  }

  // 3) Otherwise: minimal fallback (optional OpenAI)
  const modelStructured = question ? await callOpenAI(question) : null;
  if (modelStructured && modelStructured.recipes && Array.isArray(modelStructured.recipes)) {
    return jsonResponse(modelStructured);
  }

  // 4) Final fallback: suggest closest name matches if any
  if (question) {
    const qn = norm(question);
    const candidates = [];
    for (const r of MILK_HONEY_RECIPES) {
      const rn = stripCocktailSuffix(norm(r.name));
      if (!rn) continue;
      if (rn.includes(qn) || qn.includes(rn)) candidates.push(r.name);
      if (candidates.length >= 5) break;
    }

    const structured = {
      summary: "I can’t pull a canonical Milk & Honey spec for that request from my dataset.",
      warnings: [
        candidates.length
          ? `Closest matches in the book: ${unique(candidates).slice(0, 5).join(", ")}.`
          : "Try asking by exact drink name (e.g., “Left Hand Cocktail spec”).",
      ],
      recipes: [],
    };

    return jsonResponse(structured);
  }

  return jsonResponse(
    { summary: "No question received.", warnings: ["Send a question in the request body."], recipes: [] },
    200
  );
};
