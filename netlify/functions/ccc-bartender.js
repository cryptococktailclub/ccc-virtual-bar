// netlify/functions/ccc-bartender.js

const MILK_HONEY_RECIPES = require("./recipes"); // <-- make sure this path/name is correct

const SYSTEM_PROMPT = `
You are the house bartender for Crypto Cocktail Club (“Bar Bot”), trained on the Milk & Honey cocktail canon.

You are called by a front-end that:
- Sometimes passes a conversational question (free text)
- Sometimes passes structured "wizard" choices encoded in the user's question text:
  - style: "Light and Refreshing" or "Spirit Forward"
  - icePreference: "With Ice" or "No Ice"
  - spirit: one of:
    - Clear Spirits: Vodka, Gin, Pisco, Cachaça
    - Brown Spirits: Bourbon, Whiskey, Scotch, Apple Brandy, Cognac
    - Agave: Tequila, Mezcal
    - Low ABV: Sherry, Amaro, Vermouth

You will receive a subset of Milk & Honey recipes (as text) plus the user question.

====================
CORE RULES
====================

1. STRICT MILK & HONEY MODE
- Only give specs that exist in the Milk & Honey data provided to you.
- When a user asks for a specific, known drink (e.g. “Gold Rush”, “Penicillin”, “Right Hand”, “Paper Plane”):
  - You MUST copy the spec EXACTLY from the provided data:
    - Ingredient list
    - Amounts (in oz, dashes, barspoons, etc.)
    - Glass, ice, method, and garnish
  - Do NOT change measurements or ingredients, even if they differ from your training.
- If a drink name is NOT in the supplied recipes:
  - Do NOT hallucinate a “Milk & Honey spec”.
  - Instead:
    - Either (a) say it is not in the Milk & Honey book and suggest 1–3 CLOSE alternatives that ARE in the data, or
    - (b) clearly label it as NON-CANON and base it on the closest Milk & Honey template (e.g. sour, Old Fashioned, highball).
- If you are not sure, say so in a warning.

2. MEASUREMENTS & STYLE
- Always use oz units (e.g. "2 oz", "3/4 oz").
- Use standard Milk & Honey style: balanced, thoughtful, no gimmicks.
- Methods: stir / shake / build, etc. Use the technique from the data when available.

3. WIZARD INTERACTION
- The front end may send the wizard answers embedded in the user’s question text like:
  - "style: Light and Refreshing"
  - "style: Spirit Forward"
  - "icePreference: With Ice" or "icePreference: No Ice"
  - "spirit: Gin", "spirit: Bourbon", "spirit: Sherry", etc.
- When these are present, treat them as HARD FILTERS, but the actual recipe selection is done with STRICT deterministic logic over the provided Milk & Honey recipes. Do NOT invent or alter specs.

4. NUMBER OF COCKTAILS
- When the user is using the wizard (“light vs spirit forward, ice, spirit choice”), you MUST return exactly 3 cocktail options when possible.
  - If you can’t find 3 perfect matches:
    - Relax one filter at a time (style or ice), BUT
    - Explain in "warnings" which constraint was loosened.
- For direct, specific drink questions (e.g. “What’s the spec for a Gold Rush?”), you may return just 1 recipe in the list.

5. RESPONSE FORMAT (CRITICAL)
You MUST respond with PURE JSON ONLY. No markdown, no extra text, no commentary outside the JSON.

The JSON must have this shape:

{
  "summary": "Short, conversational summary of what you’re recommending or explaining.",
  "warnings": [
    "Optional warning about non-canon or approximations, or reasons why some filters were relaxed."
  ],
  "recipes": [
    {
      "name": "Cocktail Name",
      "description": "1–2 sentence description of the drink and why it fits the request.",
      "ingredients": [
        { "amount": "2 oz", "ingredient": "Bourbon" },
        { "amount": "3/4 oz", "ingredient": "Lemon juice" },
        { "amount": "3/4 oz", "ingredient": "Honey syrup (1:1)" }
      ],
      "glass": "e.g. Rocks glass / Coupe / Nick & Nora / Highball",
      "method": "e.g. Shake with ice, strain over fresh ice",
      "ice": "e.g. Large rock / Up (no ice) / Kold-Draft cubes",
      "garnish": "e.g. Lemon twist",
      "notes": "Optional extra notes on variations, service, or bar tips."
    }
  ]
}

- ALWAYS return "summary", "warnings" (array, possibly empty), and "recipes" (array).
- If you cannot find a suitable Milk & Honey drink:
  - Return "recipes": [] and a "warnings" array explaining why.

6. TONE
- Concise, confident, working-bartender voice.
- No emojis.
- Assume the user is standing at the CCC bar: give them clear specs they can actually make.

Remember: your entire response MUST be valid JSON only, with no additional commentary.
`;

// -----------------------------
// Helper: normalize strings
// -----------------------------
function norm(value) {
  return (value || "").toString().toLowerCase();
}

// -----------------------------
// Helper: find direct recipe matches by drink name
// -----------------------------
function findNamedRecipes(question) {
  if (!question) return [];
  const q = norm(question);

  return MILK_HONEY_RECIPES.filter((r) => {
    if (!r.name) return false;
    const name = norm(r.name);
    // simple substring match: “right hand” in "right hand spec"
    return q.includes(name);
  });
}

// -----------------------------
// Helper: parse wizard markers from question text
// -----------------------------
function parseWizardFromQuestion(question) {
  const q = question || "";
  const lower = q.toLowerCase();

  let style = null;
  let icePreference = null;
  let spirit = null;

  // Simple regex for "style: Light and Refreshing" or "style: Spirit Forward"
  const styleMatch = q.match(/style:\s*([^;]+)/i);
  if (styleMatch) {
    const raw = styleMatch[1].trim().toLowerCase();
    if (raw.includes("light")) style = "Light and Refreshing";
    if (raw.includes("spirit")) style = "Spirit Forward";
  }

  const iceMatch = q.match(/icePreference:\s*([^;]+)/i);
  if (iceMatch) {
    const raw = iceMatch[1].trim().toLowerCase();
    if (raw.includes("with")) icePreference = "With Ice";
    if (raw.includes("no ice") || raw.includes("without")) icePreference = "No Ice";
  }

  const spiritMatch = q.match(/spirit:\s*([^;]+)/i);
  if (spiritMatch) {
    const raw = spiritMatch[1].trim();
    // Normalize capitalization, but keep the surface string for display
    spirit = raw;
  }

  const isWizard = Boolean(style && icePreference && spirit);

  return { style, icePreference, spirit, isWizard };
}

// -----------------------------
// Helper: spirit matching
// -----------------------------
function recipeMatchesSpirit(recipe, spiritChoice) {
  if (!spiritChoice) return false;

  const s = norm(spiritChoice);
  const ingredients = recipe.ingredients || [];

  // Basic substring match on ingredient names
  return ingredients.some((ing) => norm(ing.ingredient).includes(s));
}

// -----------------------------
// Helper: style matching
// -----------------------------
function recipeMatchesStyle(recipe, styleChoice) {
  if (!styleChoice) return false;
  const style = styleChoice.toLowerCase();

  const method = norm(recipe.method);
  const category = norm(recipe.category);
  const ingredients = (recipe.ingredients || []).map((i) => norm(i.ingredient));

  const hasJuice = ingredients.some((ing) =>
    ["lemon", "lime", "grapefruit", "orange", "juice", "pineapple"].some((kw) =>
      ing.includes(kw)
    )
  );

  const hasBubbles = ingredients.some((ing) =>
    ["soda", "champagne", "sparkling", "cava", "prosecco", "club soda", "ginger beer"].some(
      (kw) => ing.includes(kw)
    )
  );

  const isShaken = method.includes("shake");
  const isStirred = method.includes("stir");
  const isHighballish = category.includes("highball") || category.includes("collins");

  if (style.includes("light")) {
    // Light & refreshing
    if (isShaken && (hasJuice || hasBubbles)) return true;
    if (isHighballish || hasBubbles) return true;
    return false;
  }

  if (style.includes("spirit forward")) {
    // Spirit-forward
    if (isStirred && !hasJuice) return true;
    if (!isShaken && !hasJuice && (category.includes("old fashioned") || category.includes("manhattan")))
      return true;
    return false;
  }

  return false;
}

// -----------------------------
// Helper: ice / service matching
// -----------------------------
function recipeMatchesIce(recipe, icePreference) {
  if (!icePreference) return false;
  const ice = norm(recipe.ice);
  const glass = norm(recipe.glass);

  const wantsIce = icePreference.toLowerCase().includes("with");
  const wantsNoIce = icePreference.toLowerCase().includes("no");

  if (wantsIce) {
    if (
      ice.includes("rock") ||
      ice.includes("rocks") ||
      ice.includes("cube") ||
      ice.includes("crushed") ||
      ice.includes("over ice") ||
      glass.includes("rocks") ||
      glass.includes("collins") ||
      glass.includes("highball")
    ) {
      return true;
    }
    return false;
  }

  if (wantsNoIce) {
    if (
      ice.includes("up") ||
      ice.includes("no ice") ||
      glass.includes("coupe") ||
      glass.includes("nick") ||
      glass.includes("nora") ||
      glass.includes("martini")
    ) {
      return true;
    }
    return false;
  }

  return false;
}

// -----------------------------
// Helper: wizard selection from MILK_HONEY_RECIPES
// -----------------------------
function selectWizardRecipes(style, icePreference, spirit) {
  const warnings = [];
  let candidates = MILK_HONEY_RECIPES.slice();

  // 1) Filter by spirit
  let bySpirit = candidates.filter((r) => recipeMatchesSpirit(r, spirit));
  if (bySpirit.length === 0) {
    warnings.push(
      `No direct Milk & Honey matches for ${spirit}. Showing closest options from the broader canon.`
    );
    // If nothing matches exactly, keep full list but mark warning
  } else {
    candidates = bySpirit;
  }

  const afterSpirit = candidates.slice();

  // 2) Filter by style
  let byStyle = afterSpirit.filter((r) => recipeMatchesStyle(r, style));
  if (byStyle.length === 0) {
    warnings.push(
      `No perfect "${style}" matches for that spirit; relaxing style filter and prioritizing overall fit.`
    );
    // keep "afterSpirit" as candidates
  } else {
    candidates = byStyle;
  }

  const afterStyle = candidates.slice();

  // 3) Filter by ice preference
  let byIce = afterStyle.filter((r) => recipeMatchesIce(r, icePreference));
  if (byIce.length === 0) {
    warnings.push(
      `No perfect "${icePreference}" service matches; showing closest Milk & Honey specs for that spirit.`
    );
    // keep afterStyle
  } else {
    candidates = byIce;
  }

  // If still no candidates at all, fall back to spirit-only or global
  if (candidates.length === 0 && afterSpirit.length > 0) {
    candidates = afterSpirit;
    warnings.push(
      "Had to fall back to spirit-only matches; style and ice filters could not be satisfied."
    );
  } else if (candidates.length === 0) {
    candidates = MILK_HONEY_RECIPES.slice(0, 6);
    warnings.push(
      "No strong matches found; showing a few canonical Milk & Honey cocktails as a fallback."
    );
  }

  // Take up to 3 recipes
  const chosen = candidates.slice(0, 3);

  // Build structured payload
  const prettyStyle =
    style === "Light and Refreshing" ? "light and refreshing" : "spirit-forward";
  const prettyIce =
    icePreference === "With Ice" ? "served over ice" : "served up (no ice)";
  const prettySpirit = spirit;

  const summary = `Here are three Milk & Honey cocktails that track with your request: ${prettyStyle}, ${prettyIce}, built around ${prettySpirit}.`;

  const recipes = chosen.map((r) => ({
    name: r.name,
    description:
      r.description ||
      `A ${prettyStyle} ${prettySpirit} cocktail from the Milk & Honey playbook, ${prettyIce}.`,
    ingredients: r.ingredients || [],
    glass: r.glass || "",
    method: r.method || "",
    ice: r.ice || "",
    garnish: r.garnish || "",
    notes: r.notes || "",
  }));

  return { summary, warnings, recipes };
}

// -----------------------------
// Netlify handler
// -----------------------------
exports.handler = async function handler(event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Parse inbound body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    console.error("CCC Bar Bot: Failed to parse request body", err);
    body = {};
  }

  const question = body.question || "";
  const clientSubset = Array.isArray(body.recipes) ? body.recipes : [];

  // 1) HARD LOOKUP: named cocktail(s) like "Right Hand"
  const directMatches = findNamedRecipes(question);

  if (directMatches.length === 1) {
    const r = directMatches[0];

    const payload = {
      summary: `Here’s the Milk & Honey spec for the ${r.name}.`,
      warnings: [],
      recipes: [
        {
          name: r.name,
          description:
            r.description ||
            "Straight from Milk & Honey, copied exactly: ingredients, amounts, glass, method, ice, and garnish.",
          ingredients: r.ingredients || [],
          glass: r.glass || "",
          method: r.method || "",
          ice: r.ice || "",
          garnish: r.garnish || "",
          notes: r.notes || "",
        },
      ],
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        structured: payload,
        answer: JSON.stringify(payload),
      }),
    };
  }

  // 2) WIZARD PATH: style + icePreference + spirit encoded in question
  const wizard = parseWizardFromQuestion(question);

  if (wizard.isWizard) {
    const { style, icePreference, spirit } = wizard;
    const payload = selectWizardRecipes(style, icePreference, spirit);

    return {
      statusCode: 200,
      body: JSON.stringify({
        structured: payload,
        answer: JSON.stringify(payload),
      }),
    };
  }

  // 3) FALLBACK: free-form conversation → use OpenAI,
  // but still feed it the Milk & Honey context so specs stay anchored.
  if (!apiKey) {
    console.error("CCC Bar Bot: Missing OPENAI_API_KEY (free-form path)");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing OPENAI_API_KEY env var" }),
    };
  }

  // Build recipe context: prefer the subset from the client; if empty, use full DB.
  const baseRecipes =
    clientSubset && clientSubset.length > 0 ? clientSubset : MILK_HONEY_RECIPES;

  const recipeContext = baseRecipes
    .map((r) => {
      const ing = (r.ingredients || [])
        .map((i) => `${i.amount} ${i.ingredient}`)
        .join(", ");
      return `Name: ${r.name}
Base/Category: ${r.category || ""} · Glass: ${r.glass || ""} · Method: ${r.method || ""}
Ingredients: ${ing}
Ice: ${r.ice || "-"} · Garnish: ${r.garnish || "-"}
`;
    })
    .join("\n---\n");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Here is a subset of Milk & Honey recipes you may rely on:\n\n` +
        recipeContext +
        `\n\nUser question: ${question}`,
    },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
        temperature: 0.4,
        response_format: { type: "json_object" }, // force JSON for structured/recipes
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("CCC Bar Bot: OpenAI error response:", text);

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: "OpenAI request failed", raw: text };
      }

      return {
        statusCode: 500,
        body: JSON.stringify(payload),
      };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";

    let structured = null;
    try {
      structured = JSON.parse(raw);
    } catch (err) {
      console.error("CCC Bar Bot: Failed to parse model JSON:", err, "Raw content:", raw);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        structured,
        answer: raw,
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
