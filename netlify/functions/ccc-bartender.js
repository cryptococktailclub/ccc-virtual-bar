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

  // ----------------
  // Style
  // ----------------
  if (prefs.style === "light_refreshing") {
    const ok =
      method.includes("shake") ||
      method.includes("build") ||
      method.includes("swizzle") ||
      method.includes("highball") ||
      method.includes("collins");
    if (!ok) return false;
  }

  if (prefs.style === "spirit_forward") {
    // Important: many mezcal/tequila stirred drinks will simply say "stir"
    const ok =
      method.includes("stir") ||
      method.includes("old fashioned") ||
      method.includes("manhattan") ||
      method.includes("negroni");
    if (!ok) return false;
  }

  // ----------------
  // Ice preference
  // ----------------
  if (prefs.ice === "on_ice") {
    const ok = !(ice.includes("none") || ice.includes("up") || ice.includes("no ice"));
    if (!ok) return false;
  }

  if (prefs.ice === "no_ice") {
    const ok = ice.includes("none") || ice.includes("up") || ice.includes("no ice");
    if (!ok) return false;
  }

  // ----------------
  // Spirit preference(s)
  // Match against: name/category/baseSpirit/spirit/method/ice + ALL ingredient names
  // ----------------
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

    // Build “wanted” set with synonyms
    const wanted = new Set();
    for (const raw of prefs.spirits) {
      const s = norm(raw);
      if (!s) continue;

      wanted.add(s);

      // Wizard uses "rye_whiskey"
      if (s === "rye_whiskey") {
        wanted.add("rye");
        wanted.add("whiskey");
      }

      // Aggressive agave mapping for mezcal/tequila
      if (s === "mezcal") {
        wanted.add("agave");
        wanted.add("tequila"); // many recipes may group agave spirits loosely
      }
      if (s === "tequila") {
        wanted.add("agave");
        wanted.add("mezcal");
      }

      // Cachaça tolerance (diacritics often get lost)
      if (s === "cachaca") {
        wanted.add("cacha");
        wanted.add("cachaca");
        wanted.add("cachaça");
      }
    }

    const ok = Array.from(wanted).some((w) => w && haystack.includes(w));
    if (!ok) return false;
  }

  return true;
}


function stableSeedFromPrefs(prefs, sessionId = "") {
  const key = JSON.stringify({
    style: prefs.style || "",
    ice: prefs.ice || "",
    spirits: Array.isArray(prefs.spirits) ? prefs.spirits.slice().sort() : [],
    session: sessionId || "",
  });
  // simple hash
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededSort(recipes, seed) {
  // Schwartzian transform: compute a seeded score per recipe, then sort by it
  return recipes
    .map((r) => {
      const n = norm(r.name || "");
      let x = seed;
      for (let i = 0; i < n.length; i++) {
        x ^= n.charCodeAt(i);
        x = Math.imul(x, 2654435761);
      }
      // ensure unsigned
      const score = x >>> 0;
      return { r, score };
    })
    .sort((a, b) => a.score - b.score)
    .map((o) => o.r);
}

function recommendFromWizard(prefs, { excludeNames = [], index = 0, sessionId = "" } = {}) {
  const warnings = [];

  // 1) Collect full match set (no early break)
  let results = MILK_HONEY_RECIPES.filter((r) => recipeMatchesWizard(r, prefs));

  // Controlled relax (same as you had, but without shrinking variety)
  if (results.length < 3) {
    warnings.push("Could not find enough perfect matches; relaxing ice preference for closest fits.");
    results = MILK_HONEY_RECIPES.filter((r) => recipeMatchesWizard(r, { ...prefs, ice: null }));
  }
  if (results.length < 3) {
    warnings.push("Still short on matches; relaxing style for closest fits.");
    results = MILK_HONEY_RECIPES.filter((r) =>
      recipeMatchesWizard(r, { ...prefs, style: null, ice: prefs.ice || null })
    );
  }

  // 2) Exclude previously served picks (by normalized name)
  const excludeSet = new Set((excludeNames || []).map((n) => norm(n)));
  results = results.filter((r) => r && r.name && !excludeSet.has(norm(r.name)));

  // 3) Seeded rotation order (stable but not “same first 3”)
  const seed = stableSeedFromPrefs(prefs, sessionId);
  const ordered = seededSort(results, seed);

  // 4) Pick one based on index
  const pick = ordered.length ? ordered[Math.abs(index) % ordered.length] : null;

  return { pick, warnings, total: ordered.length };
}


// ------------ Optional OpenAI fallback for generic Q&A ------------
async function callOpenAI(question) {
  // Keep this ultra-small.
  // If you want to disable OpenAI completely, remove OPENAI_API_KEY from env.
  if (!OPENAI_API_KEY) return null;

  const payload = {
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are CCC Bar Bot. Respond ONLY in pure JSON with keys summary,warnings,recipes. " +
          "If the user asks for a spec, only answer if the recipe is in the provided list. " +
          "If not, return recipes:[] and a warning.",
      },
      {
        role: "user",
        content:
          "User: " + question + "\n\n" +
          "Note: You do NOT have the recipe list. If you cannot answer deterministically, return recipes:[] with a warning.",
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("CCC Bar Bot: OpenAI error:", txt);
    return null;
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("CCC Bar Bot: Could not parse OpenAI JSON:", e, raw);
    return null;
  }
}

// ------------ Netlify handler ------------
exports.handler = async (event) => {
  if (mode === "wizard") {
  const prefs = {
    style: wizardPrefs.style || null,
    ice: wizardPrefs.ice || null,
    spirits: Array.isArray(wizardPrefs.spirits) ? wizardPrefs.spirits : [],
  };

  const wizardIndex = Number.isFinite(Number(body.wizard_index)) ? Number(body.wizard_index) : 0;
  const exclude = Array.isArray(body.exclude) ? body.exclude : [];
  const sessionId = String(body.session_id || "");

  const { pick, warnings, total } = recommendFromWizard(prefs, {
    excludeNames: exclude,
    index: wizardIndex,
    sessionId,
  });

  const structured = {
    summary: pick
      ? `Milk & Honey pick based on your selections (${wizardIndex + 1}/${Math.max(1, total)}). Want another option?`
      : "I couldn’t find a strong Milk & Honey match for those filters.",
    warnings: warnings || [],
    recipes: pick ? [toStructuredRecipe(pick, "Recommended based on your wizard picks.")] : [],
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
