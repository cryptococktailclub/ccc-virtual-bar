// netlify/functions/ccc-bartender.js

// -----------------------------------------
// Load Milk & Honey recipe data (local JSON)
// -----------------------------------------
let RAW_RECIPES;
try {
  RAW_RECIPES = require("./recipes.json");
} catch (err) {
  console.error("CCC Bar Bot: Failed to load recipes.json:", err);
  RAW_RECIPES = [];
}

// recipes.json might be either an array or { recipes: [...] }
const SOURCE_ARRAY = Array.isArray(RAW_RECIPES)
  ? RAW_RECIPES
  : RAW_RECIPES.recipes || RAW_RECIPES.MILK_HONEY_RECIPES || [];

// -----------------------------------------
// Normalization helpers
// -----------------------------------------
function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "recipe";
}

function normalizeRecipe(raw, index) {
  const name = raw.name || raw.title || `Recipe ${index + 1}`;
  const id = raw.id || slugify(name);

  // Spirits / base
  const baseSpirit =
    raw.baseSpirit ||
    raw.spirit ||
    raw.base ||
    (Array.isArray(raw.spirits) && raw.spirits[0]) ||
    null;

  const spirits =
    raw.spirits ||
    raw.spiritList ||
    (baseSpirit ? [baseSpirit] : []);

  const tags = raw.tags || raw.tagList || [];
  const style = raw.style || raw.profile || null;
  const served = raw.served || raw.service || raw.ice || null;

  const ingredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const glass = raw.glass || "";
  const method = raw.method || "";
  const ice = raw.ice || "";
  const garnish = raw.garnish || "";
  const notes = raw.notes || "";

  const description =
    raw.description ||
    raw.summary ||
    raw.blurb ||
    "";

  return {
    id,
    name,
    baseSpirit,
    spirits,
    tags,
    style,
    served,
    ingredients,
    glass,
    method,
    ice,
    garnish,
    notes,
    description,
  };
}

const MILK_HONEY_RECIPES = SOURCE_ARRAY.map(normalizeRecipe);

// Lookup maps
const RECIPES_BY_ID = new Map();
const RECIPES_BY_NAME = new Map();

MILK_HONEY_RECIPES.forEach((r) => {
  RECIPES_BY_ID.set(r.id, r);
  RECIPES_BY_NAME.set(r.name.toLowerCase(), r);
});

// -----------------------------------------
// Classification helpers for wizard filters
// -----------------------------------------
function classifyStyle(recipe) {
  const method = (recipe.method || "").toLowerCase();
  const tags = (recipe.tags || []).join(" ").toLowerCase();
  const glass = (recipe.glass || "").toLowerCase();
  const notes = (recipe.notes || "").toLowerCase();
  const text = [method, tags, glass, notes].join(" ");

  // Strong spirit-forward cues
  if (
    text.includes("old fashioned") ||
    text.includes("manhattan") ||
    text.includes("negroni") ||
    text.includes("martini") ||
    text.includes("spirit-forward") ||
    text.includes("spirit forward") ||
    text.includes("boozy")
  ) {
    return "spirit_forward";
  }

  // Light & refreshing cues
  if (
    text.includes("highball") ||
    text.includes("collins") ||
    text.includes("fizz") ||
    text.includes("sour") ||
    text.includes("swizzle") ||
    text.includes("cooler") ||
    text.includes("spritz")
  ) {
    return "light_refreshing";
  }

  // Fallback on method
  if (method.includes("shake")) return "light_refreshing";
  if (method.includes("stir")) return "spirit_forward";

  return null;
}

function classifyIce(recipe) {
  const ice = (recipe.ice || "").toLowerCase();
  const glass = (recipe.glass || "").toLowerCase();
  const notes = (recipe.notes || "").toLowerCase();
  const text = [ice, glass, notes].join(" ");

  if (
    text.includes("up") ||
    text.includes("no ice") ||
    text.includes("served up") ||
    text.includes("straight up") ||
    text.includes("coupe") ||
    text.includes("nick & nora") ||
    text.includes("nick and nora")
  ) {
    return "no_ice";
  }

  if (
    text.includes("rocks") ||
    text.includes("large rock") ||
    text.includes("over ice") ||
    text.includes("kold-draft") ||
    text.includes("kold draft") ||
    text.includes("highball") ||
    text.includes("collins")
  ) {
    return "on_ice";
  }

  return null;
}

function normalizeSpiritName(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "_");
}

function recipeMatchesSpirit(recipe, spiritChoiceRaw) {
  if (!spiritChoiceRaw) return true;
  const choice = spiritChoiceRaw.toLowerCase();

  const spiritLane = normalizeSpiritName(choice);

  const allText = [
    recipe.baseSpirit,
    ...(recipe.spirits || []),
    ...(recipe.tags || []),
    recipe.description,
    recipe.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (allText.includes(choice)) return true;

  // Loose mapping so "rye_whiskey" catches "rye" or "whiskey"
  if (spiritLane === "rye_whiskey" || spiritLane === "whiskey" || spiritLane === "whisky") {
    return allText.includes("rye") || allText.includes("whiskey") || allText.includes("whisky");
  }

  if (spiritLane === "cachaca") {
    return allText.includes("cachaça") || allText.includes("cachaca");
  }

  if (spiritLane === "amaro") {
    return allText.includes("amaro") || allText.includes("amari");
  }

  return false;
}

function recipeMatchesStyle(recipe, styleChoice) {
  if (!styleChoice) return true;
  const cls = classifyStyle(recipe);
  if (!cls) return false;
  return cls === styleChoice;
}

function recipeMatchesIce(recipe, iceChoice) {
  if (!iceChoice) return true;
  const cls = classifyIce(recipe);
  if (!cls) return false;
  if (iceChoice === "on_ice") return cls === "on_ice";
  if (iceChoice === "no_ice") return cls === "no_ice";
  return false;
}

function scoreRecipeForWizard(recipe, styleChoice, iceChoice, spiritChoice) {
  let score = 0;
  if (styleChoice && recipeMatchesStyle(recipe, styleChoice)) score += 3;
  if (iceChoice && recipeMatchesIce(recipe, iceChoice)) score += 2;
  if (spiritChoice && recipeMatchesSpirit(recipe, spiritChoice)) score += 4;

  // slight bias toward well-tagged recipes
  if ((recipe.tags || []).length > 0) score += 1;

  return score;
}

// -----------------------------------------
// Wizard detection & extraction
// -----------------------------------------
function extractWizardFromBodyAndQuestion(body, question) {
  const wizard = {
    style: null,          // "light_refreshing" | "spirit_forward"
    icePreference: null,  // "on_ice" | "no_ice"
    spirit: null,         // e.g. "rum", "gin", "tequila", "sherry"
  };

  // If the frontend ever sends a structured wizard object, honor it first
  if (body && typeof body.wizard === "object" && body.wizard !== null) {
    const w = body.wizard;
    wizard.style = w.style || wizard.style;
    wizard.icePreference = w.icePreference || wizard.icePreference;
    wizard.spirit = w.spirit || wizard.spirit;
  }

  // Also parse from the question text (current implementation)
  const q = String(question || "");

  const styleMatch = q.match(/style:\s*(Light and Refreshing|Spirit Forward)/i);
  if (styleMatch) {
    wizard.style =
      styleMatch[1].toLowerCase().includes("light") ? "light_refreshing" : "spirit_forward";
  }

  const iceMatch = q.match(/icePreference:\s*(With Ice|No Ice)/i);
  if (iceMatch) {
    wizard.icePreference =
      iceMatch[1].toLowerCase().includes("no") ? "no_ice" : "on_ice";
  }

  const spiritMatch = q.match(/spirit:\s*([A-Za-zÀ-ÿ\s]+)/i);
  if (spiritMatch) {
    wizard.spirit = spiritMatch[1].trim();
  }

  // We consider it "wizard mode" if all three are present
  const isWizard =
    Boolean(wizard.style) &&
    Boolean(wizard.icePreference) &&
    Boolean(wizard.spirit);

  return { isWizard, wizard };
}

// -----------------------------------------
// Build response with full specs from local recipes
// -----------------------------------------
function toClientRecipeShape(recipe) {
  return {
    name: recipe.name,
    description: recipe.description || recipe.notes || "",
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ing) => ({
          amount: ing.amount || ing.qty || "",
          ingredient: ing.ingredient || ing.name || "",
        }))
      : [],
    glass: recipe.glass || "",
    method: recipe.method || "",
    ice: recipe.ice || "",
    garnish: recipe.garnish || "",
    notes: recipe.notes || "",
  };
}

// -----------------------------------------
// Wizard handler (NO OpenAI CALL)
// -----------------------------------------
function handleWizard(wizard) {
  if (!MILK_HONEY_RECIPES.length) {
    return {
      summary: "No recipes are available at the moment.",
      warnings: ["Milk & Honey recipe data failed to load on the server."],
      recipes: [],
    };
  }

  const styleChoice = wizard.style; // "light_refreshing" / "spirit_forward"
  const iceChoice = wizard.icePreference; // "on_ice" / "no_ice"
  const spiritChoice = wizard.spirit; // raw text

  // Scored & filtered
  const scored = MILK_HONEY_RECIPES.map((r) => ({
    recipe: r,
    score: scoreRecipeForWizard(r, styleChoice, iceChoice, spiritChoice),
  }));

  // Keep only those with positive score
  let candidates = scored.filter((s) => s.score > 0);

  let relaxed = false;
  let relaxedDetails = [];

  // If we didn't find enough, relax in stages
  if (candidates.length < 3) {
    // First, relax ice preference
    const withoutIceFilter = MILK_HONEY_RECIPES.map((r) => ({
      recipe: r,
      score: scoreRecipeForWizard(r, styleChoice, null, spiritChoice),
    })).filter((s) => s.score > 0);

    if (withoutIceFilter.length > candidates.length) {
      candidates = withoutIceFilter;
      relaxed = true;
      relaxedDetails.push("ice preference was relaxed slightly");
    }
  }

  if (candidates.length < 3) {
    // Then relax style as well
    const withoutStyleAndIce = MILK_HONEY_RECIPES.map((r) => ({
      recipe: r,
      score: scoreRecipeForWizard(r, null, null, spiritChoice),
    })).filter((s) => s.score > 0);

    if (withoutStyleAndIce.length > candidates.length) {
      candidates = withoutStyleAndIce;
      relaxed = true;
      relaxedDetails.push("style and ice filters were loosened");
    }
  }

  if (candidates.length === 0) {
    return {
      summary: "I couldn’t find a Milk & Honey drink that fits those exact filters.",
      warnings: [
        "No recipes matched your style, ice, and spirit combination strictly. Try a different spirit or tweak your preferences.",
      ],
      recipes: [],
    };
  }

  // Sort by score, highest first
  candidates.sort((a, b) => b.score - a.score);

  const top = candidates.slice(0, 3).map((s) => toClientRecipeShape(s.recipe));

  const baseSummaryParts = [];
  if (styleChoice === "light_refreshing") baseSummaryParts.push("light & refreshing");
  if (styleChoice === "spirit_forward") baseSummaryParts.push("spirit-forward");
  if (iceChoice === "on_ice") baseSummaryParts.push("over ice");
  if (iceChoice === "no_ice") baseSummaryParts.push("served up");
  if (spiritChoice) baseSummaryParts.push(spiritChoice);

  const summary =
    "Here are three Milk & Honey cocktails in the " +
    (baseSummaryParts.length ? baseSummaryParts.join(" / ") : "requested") +
    " lane.";

  const warnings = [];
  if (relaxed && relaxedDetails.length) {
    warnings.push(
      `Not enough strict matches were found, so ${relaxedDetails.join(
        " and "
      )}. These are the closest Milk & Honey fits.`
    );
  }

  return {
    summary,
    warnings,
    recipes: top,
  };
}

// -----------------------------------------
// Free-text chat via compact catalog + OpenAI
// -----------------------------------------
const CATALOG_SYSTEM_PROMPT = `
You are Bar Bot, the house bartender for Crypto Cocktail Club, working strictly from the Milk & Honey cocktail canon.

You will be given:
- A compact catalog of cocktails: each line has an ID, name, base spirit, and style hints.
- A user question.

Your job:
1. Choose up to THREE cocktails from the catalog that best answer the user's request.
2. Return JSON ONLY with the following literal shape:

{
  "summary": "Short summary of what you’re recommending.",
  "warnings": ["Optional warning or note, or an empty array."],
  "recipeIds": ["id_one", "id_two"]
}

Rules:
- You MUST use IDs from the catalog (the token before the first colon).
- If the user asks for a specific classic that exists (e.g. "Gold Rush", "Right Hand"), include that cocktail’s ID first.
- Do NOT invent cocktails that are not in the catalog.
- If nothing fits, return:
  {
    "summary": "Explain briefly why nothing matches.",
    "warnings": ["No suitable Milk & Honey recipe was found."],
    "recipeIds": []
  }

Remember: valid JSON only. No extra commentary, no trailing commas.
`;

function buildCatalogSummary() {
  // Keep the catalog compact: one line per recipe, minimal metadata
  return MILK_HONEY_RECIPES.map((r) => {
    const spirits = (r.spirits || []).join(", ");
    const style = classifyStyle(r) || "n/a";
    const ice = classifyIce(r) || "n/a";
    return `${r.id}: ${r.name} | base: ${r.baseSpirit || "n/a"} | spirits: ${
      spirits || "n/a"
    } | style: ${style} | serve: ${ice}`;
  }).join("\n");
}

async function callOpenAIForRecipeIds(apiKey, question) {
  const catalog = buildCatalogSummary();

  const messages = [
    { role: "system", content: CATALOG_SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Here is the cocktail catalog:\n` +
        catalog +
        `\n\nUser question: ${question}\n\nRemember to respond with JSON only.`,
    },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("CCC Bar Bot: OpenAI error response:", text);
    throw new Error("OpenAI request failed");
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("CCC Bar Bot: Failed to parse JSON from model:", err, "Raw:", raw);
    throw new Error("Model returned invalid JSON");
  }

  return parsed;
}

function resolveRecipesByIds(recipeIds) {
  if (!Array.isArray(recipeIds)) return [];

  const out = [];
  recipeIds.forEach((idRaw) => {
    if (!idRaw) return;
    const id = String(idRaw).trim();
    let recipe = RECIPES_BY_ID.get(id);

    // Fallback: sometimes the model might emit the name instead of ID
    if (!recipe) {
      recipe = RECIPES_BY_NAME.get(id.toLowerCase());
    }

    if (recipe) {
      out.push(toClientRecipeShape(recipe));
    }
  });

  return out;
}

// -----------------------------------------
// Netlify Function handler
// -----------------------------------------
exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("CCC Bar Bot: Missing OPENAI_API_KEY");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing OPENAI_API_KEY env var" }),
    };
  }

  // Parse inbound body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    console.error("CCC Bar Bot: Failed to parse request body", err);
    body = {};
  }

  const question = body.question || "";

  // Decide: wizard path (no OpenAI) vs free-text chat (OpenAI with tiny payload)
  const { isWizard, wizard } = extractWizardFromBodyAndQuestion(body, question);

  try {
    if (isWizard) {
      // ---------------------------------
      // WIZARD MODE (NO TOKEN SPEND)
      // ---------------------------------
      const structured = handleWizard(wizard);

      return {
        statusCode: 200,
        body: JSON.stringify({
          structured,
          answer: JSON.stringify(structured),
        }),
      };
    }

    // ---------------------------------
    // FREE-TEXT CHAT MODE (MINIMAL TOKENS)
    // ---------------------------------
    const aiResult = await callOpenAIForRecipeIds(apiKey, question);

    const summary = aiResult.summary || "Here are some Milk & Honey drinks for you.";
    const warnings = Array.isArray(aiResult.warnings) ? aiResult.warnings : [];
    const recipeIds = Array.isArray(aiResult.recipeIds) ? aiResult.recipeIds : [];

    const resolvedRecipes = resolveRecipesByIds(recipeIds);

    const structured = {
      summary,
      warnings,
      recipes: resolvedRecipes,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        structured,
        answer: JSON.stringify(structured),
      }),
    };
  } catch (err) {
    console.error("CCC Bar Bot: Server error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
