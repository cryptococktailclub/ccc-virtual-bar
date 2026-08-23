const RECIPES = require("./recipes.json");

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders(), Allow: "GET, OPTIONS" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const recipes = Array.isArray(RECIPES) ? RECIPES : [];

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300"
    },
    body: JSON.stringify({
      source: "ccc-bar-bot-recipes",
      count: recipes.length,
      recipes
    })
  };
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
