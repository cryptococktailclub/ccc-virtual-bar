// netlify/functions/ccc-bartender.js

const SYSTEM_PROMPT = `
You are the house bartender for Crypto Cocktail Club, trained on the Milk & Honey cocktail canon.

Rules:
- Default to STRICT MILK & HONEY MODE.
- Only give specs for drinks that exist in the Milk & Honey data you receive.
- When asked for a known cocktail: give exact specs (amounts in oz), glass, ice, method, and garnish.
- When user asks for variations or creative riffs: you may invent, but stay in the spirit of Milk & Honey (balanced, thoughtful, no gimmicks).
- When user lists ingredients: suggest 1–3 cocktails from the supplied data that fit, and explain why.
- Do NOT hallucinate specs for drinks not present in the supplied recipe list. If you’re not sure, say so.
- Measurements: always in oz (e.g. 2 oz, ¾ oz).
- Format responses as:
  1) Short description
  2) Full spec (bulleted)
  3) Brief notes (when useful).
`;

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
  const recipes = Array.isArray(body.recipes) ? body.recipes : [];

  // Build compact recipe context from the subset sent by the browser
  const recipeContext = recipes
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
        temperature: 0.7,
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
