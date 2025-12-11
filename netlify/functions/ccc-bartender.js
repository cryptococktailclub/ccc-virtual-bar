// netlify/functions/ccc-bartender.js

const MILK_HONEY_RECIPES = require("./recipes");

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
- When these are present, treat them as HARD FILTERS:
  - style:
    - "Light and Refreshing" → favor shaken, citrusy, highball, spritzy, or tall.
    - "Spirit Forward" → favor stirred, short, strong (Old Fashioned / Manhattan family, stirred boozy sours, etc.).
  - icePreference:
    - "With Ice" → favor recipes served over ice (rocks / Collins / highball).
    - "No Ice" → favor up / served without ice (Nick & Nora, coupe).
  - spirit:
    - "Vodka", "Gin", "Pisco", "Cachaça" → CLEAR SPIRITS lane.
    - "Bourbon", "Whiskey", "Scotch", "Apple Brandy", "Cognac" → BROWN SPIRITS lane.
    - "Tequila", "Mezcal" → AGAVE lane.
    - "Sherry", "Amaro", "Vermouth" → LOW ABV lane (prioritize lower ABV, fortified-wine or liqueur-forward cocktails).
- Your goal: pick 1–3 Milk & Honey recipes that best fit those filters and explain why in a short summary.

4. NUMBER OF COCKTAILS
- When the user is using the wizard (“light vs spirit forward, ice, spirit choice”), you MUST return exactly 3 cocktail options when possible.
  - If you can’t find 3 perfect matches, you may:
    - Relax one filter slightly, BUT
    - Explain in warnings which constraint was loosened (e.g. “closest match in Brown Spirits, but served up instead of on ice”).
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
// Helper: find direct recipe matches by name
// -----------------------------
function findNamedRecipes(question) {
  if (!question) return [];

  const q = question.toLowerCase();

  // Simple: match any recipe whose name appears as a substring in the question
  const matches = MILK_HONEY_RECIPES.filter((r) => {
    if (!r.name) return false;
    const name = r.name.toLowerCase();
    return q.includes(name);
  });

  return matches;
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
  const clientSubset = Array.isArray(body.recipes) ? body.recipes : [];

  // 1) HARD LOOKUP: if question clearly references an existing drink name,
  // return that spec exactly from MILK_HONEY_RECIPES and skip OpenAI.
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

  // 2) If multiple name matches, we still go to the model but make sure it
  // sees all of them explicitly.
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
        response_format: { type: "json_object" }, // force JSON
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
