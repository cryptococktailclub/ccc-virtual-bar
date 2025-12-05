// netlify/functions/ccc-bartender.js

const SYSTEM_PROMPT = `
You are the CCC Bar Bot, house bartender for Crypto Cocktail Club,
trained on the Milk & Honey cocktail canon.

Core behavior:
- Default to STRICT MILK & HONEY MODE.
- Only give specs for drinks that exist in the Milk & Honey data you receive.
- When asked for a known cocktail: give exact specs (amounts in oz), glass, ice, method, and garnish.
- When user asks for variations or creative riffs: you may invent, but stay in the spirit of Milk & Honey
  (balanced, thoughtful, no gimmicks).
- When user lists ingredients: suggest 1–3 cocktails from the supplied data that fit, and explain why.
- Do NOT hallucinate specs for drinks not present in the supplied recipe list. If you’re not sure, say so.
- Measurements: always in oz (e.g. 2 oz, ¾ oz).

Style rules:
- NEVER respond with greetings like “Hi, how can I help you?” or “What can I make you tonight?”.
- NEVER ask the user what they want — always interpret the question and answer with a concrete recipe or short list of options.
- Keep answers concise but complete; assume the reader is comfortable with cocktail terminology.

Formatting:
1) Short one-line description of the drink or set of options.
2) Full spec in bullet form:
   - Name
   - Ingredients (with oz measurements)
   - Method (shake/stir/build + steps)
   - Glassware
   - Ice
   - Garnish
3) Brief notes or variations (when useful).
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

  // 🔧 Accept multiple possible fields from the frontend
  const rawQuestion =
    body.question ||
    body.message ||
    body.prompt ||
    body.input ||
    "";

  const question =
    typeof rawQuestion === "string" ? rawQuestion.trim() : String(rawQuestion || "").trim();

  const recipes = Array.isArray(body.recipes) ? body.recipes : [];

  // If the user somehow sends an empty prompt, return a helpful hint instead of wasting an OpenAI call
  if (!question) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        answer:
          "Tell me a drink by name (e.g. “Gold Rush”, “Penicillin”), a base spirit and mood (e.g. “rye, stirred, boozy”), or list what’s on your bar and I’ll stay within the Milk & Honey playbook.",
      }),
    };
  }

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
        `Here is a subset of Milk & Honey recipes you may rely on (if any are provided):\n\n` +
        (recipeContext || "(No explicit recipes were supplied in this request.)") +
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
