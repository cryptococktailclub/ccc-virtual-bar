// netlify/functions/ccc-bartender.js

const fs = require("fs");
const path = require("path");

const SYSTEM_PROMPT = `
You are the house bartender for Crypto Cocktail Club, trained on the Milk & Honey cocktail canon.

You MUST follow these rules:

1) STRICT DATA MODE
- You are given a list of Milk & Honey recipes as structured text.
- Only give full specs for drinks that appear in that list.
- If the requested drink is missing, say so and instead suggest 1–3 cocktails that DO exist in the list and are closest in style or base spirit.
- Never invent or hallucinate a spec. Data is the source of truth.

2) MEASUREMENTS & STYLE
- All measurements in oz (e.g. "2 oz", "3/4 oz", "1/2 oz").
- Prefer simple fractions (1/4, 1/2, 3/4) instead of decimals when natural.
- Always specify: glass, ice, method, garnish.
- Riffs must be clearly labeled as "House riff" and still stay in the Milk & Honey style (balanced, no gimmicks).

3) OUTPUT FORMAT — JSON ONLY
You must respond with valid JSON ONLY, no prose, no backticks, no Markdown.

The JSON MUST conform to this TypeScript type:

type CCCBartenderResponse = {
  summary: string;        // One short sentence overview of what you're recommending.
  recipes: {
    name: string;         // Cocktail name
    description: string;  // 1–2 sentence description in plain text
    ingredients: {
      amount: string;     // e.g. "2 oz"
      ingredient: string; // e.g. "bourbon"
    }[];
    glass: string;        // e.g. "double rocks"
    method: string;       // e.g. "shake, double strain"
    ice: string;          // e.g. "big rock"
    garnish: string;      // e.g. "lemon twist"
    notes?: string;       // optional extra guidance
  }[];
  warnings?: string[];    // Optional: e.g. "Requested cocktail not found; suggested alternatives instead."
};

Additional rules:
- If the user asks for exactly one classic that exists in the data, return exactly one recipe in the array.
- If you are suggesting alternates, you may return 2–3 recipes.
- If you truly cannot match anything in the data to the request, return recipes = [] and put an explanatory message in "warnings".
- Do NOT include comments or any fields outside this schema.
`;

// --------------------------
// Load recipes at cold start
// --------------------------

let RECIPES = [];

try {
  const recipesPath = path.join(__dirname, "recipes.json");
  const raw = fs.readFileSync(recipesPath, "utf8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    RECIPES = parsed;
  } else if (Array.isArray(parsed.recipes)) {
    RECIPES = parsed.recipes;
  } else {
    console.error("ccc-bartender: recipes.json not in expected format");
  }

  console.log(`ccc-bartender: loaded ${RECIPES.length} recipes`);
} catch (err) {
  console.error("ccc-bartender: failed to load recipes.json", err);
}

// Build compact context from recipe objects for the model
function buildRecipeContext(recipes) {
  return recipes
    .map((r) => {
      const ing = (r.ingredients || [])
        .map((i) => `${i.amount} ${i.ingredient}`)
        .join(", ");

      return [
        `Name: ${r.name || ""}`,
        `Category: ${r.category || ""}`,
        `Glass: ${r.glass || ""}`,
        `Method: ${r.method || ""}`,
        `Ingredients: ${ing}`,
        `Ice: ${r.ice || "-"}`,
        `Garnish: ${r.garnish || "-"}`,
      ].join("\n");
    })
    .join("\n---\n");
}

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing OPENAI_API_KEY env var" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }

  const question = body.question || "";

  // If the client sends a subset of recipes, you can accept it;
  // otherwise, default to the full Milk & Honey DB.
  let recipesForContext = [];
  if (Array.isArray(body.recipes) && body.recipes.length) {
    recipesForContext = body.recipes;
  } else {
    recipesForContext = RECIPES;
  }

  // (Optional) clamp in case the JSON is huge
  const MAX_RECIPES = 180;
  const trimmed = recipesForContext.slice(0, MAX_RECIPES);
  const recipeContext = buildRecipeContext(trimmed);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `You have access to the following Milk & Honey recipes as your database.\n` +
        `Use them as the only source of truth for specs.\n\n` +
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
        temperature: 0.35, // extra deterministic for specs
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenAI error:", text);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OpenAI request failed" }),
      };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let structured = null;
    try {
      structured = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error("ccc-bartender: failed to parse JSON from model:", parseErr);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        // Raw model content (still JSON text, useful for debugging)
        answer: rawContent,
        // Parsed object for your recipe-card UI
        structured,
      }),
    };
  } catch (err) {
    console.error("Server error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
