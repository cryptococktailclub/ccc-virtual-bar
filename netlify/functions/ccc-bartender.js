// netlify/functions/ccc-bartender.js

const fs = require("fs");
const path = require("path");

const SYSTEM_PROMPT = `
You are the house bartender for Crypto Cocktail Club, trained on the Milk & Honey cocktail canon.

Core rules:
- STRICT MILK & HONEY MODE.
- Only give full specs for drinks that appear in the recipe data provided.
- If a requested drink is NOT in the data, say so clearly and suggest nearby (similar) Milk & Honey drinks that ARE in the data.
- All measurements in oz (e.g. 2 oz, 3/4 oz, 1/2 oz). Use fractions, not decimals, when natural.
- Always specify: glass, ice, method, and garnish.
- When user lists ingredients or gives a vibe, suggest 1–3 cocktails from the data and explain why.
- No made-up specs. Never invent a classic that isn't present in the list.
- If you adapt or riff, clearly label it as “House riff” and still keep it in the Milk & Honey style (balanced, no gimmicks).

Response format:
1) Short one-sentence description
2) Full spec as a bulleted list:
   - Spirit & modifiers (with oz)
   - Citrus / sugar (with oz)
   - Glass, ice, method
   - Garnish
3) Brief notes section (when useful: build, tweaks, or subs)
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

// Build a compact text context from recipe objects
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

  // If the client sends a subset, use it; otherwise use full M&H DB
  let recipesForContext = [];
  if (Array.isArray(body.recipes) && body.recipes.length) {
    recipesForContext = body.recipes;
  } else {
    recipesForContext = RECIPES;
  }

  // (Optional) clamp to a reasonable size if your JSON is huge
  const MAX_RECIPES = 180;
  const trimmed = recipesForContext.slice(0, MAX_RECIPES);

  const recipeContext = buildRecipeContext(trimmed);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `You have access to the following Milk & Honey recipes. ` +
        `You MUST treat this as the source of truth for specs.\n\n` +
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
        temperature: 0.4, // lower temp for more deterministic specs
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
    const answer = data.choices?.[0]?.message?.content || "";

    return {
      statusCode: 200,
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    console.error("Server error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
