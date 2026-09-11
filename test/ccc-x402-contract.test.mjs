import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_MAINNET,
  BASE_SEPOLIA,
  BartenderError,
  InputError,
  MAX_BODY_BYTES,
  groundStructuredResponse,
  invokeInternalBartender,
  publicResult,
  readJsonBody,
  readX402Config,
  validateBartenderRequest,
} from "../netlify/functions/_shared/ccc-x402-contract.mjs";

const ADDRESS = `0x${"1".repeat(40)}`;

function config(values = {}) {
  return readX402Config((name) => values[name]);
}

test("configuration is disabled and not ready by default", () => {
  const result = config();
  assert.equal(result.enabled, false);
  assert.equal(result.ready, false);
  assert.equal(result.network, BASE_SEPOLIA);
  assert.equal(result.price, "$0.02");
  assert.match(result.errors.join(" "), /CCC_X402_PAY_TO/);
});

test("Base Sepolia configuration is ready only when explicitly enabled", () => {
  const result = config({ CCC_X402_ENABLED: "true", CCC_X402_PAY_TO: ADDRESS });
  assert.equal(result.ready, true);
  assert.equal(result.facilitatorUrl, "https://x402.org/facilitator");
  assert.deepEqual(result.errors, []);
});

test("configuration rejects the zero address", () => {
  const result = config({
    CCC_X402_ENABLED: "true",
    CCC_X402_PAY_TO: `0x${"0".repeat(40)}`,
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /non-zero/);
});

test("Base mainnet requires a non-testnet facilitator", () => {
  const missing = config({
    CCC_X402_ENABLED: "true",
    CCC_X402_PAY_TO: ADDRESS,
    CCC_X402_NETWORK: BASE_MAINNET,
  });
  assert.equal(missing.ready, false);
  assert.match(missing.errors.join(" "), /FACILITATOR_URL/);

  const testnetOnly = config({
    CCC_X402_ENABLED: "true",
    CCC_X402_PAY_TO: ADDRESS,
    CCC_X402_NETWORK: BASE_MAINNET,
    CCC_X402_FACILITATOR_URL: "https://x402.org/facilitator",
  });
  assert.equal(testnetOnly.ready, false);
  assert.match(testnetOnly.errors.join(" "), /testnet-only/);

  const production = config({
    CCC_X402_ENABLED: "true",
    CCC_X402_PAY_TO: ADDRESS,
    CCC_X402_NETWORK: BASE_MAINNET,
    CCC_X402_FACILITATOR_URL: "https://facilitator.example.com",
  });
  assert.equal(production.ready, true);
});

test("configuration rejects unsafe prices and a mismatched resource URL", () => {
  const result = config({
    CCC_X402_ENABLED: "true",
    CCC_X402_PAY_TO: ADDRESS,
    CCC_X402_PRICE_USD: "100.01",
    CCC_X402_PUBLIC_URL: "https://cryptococktail.club/wrong",
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /between 0 and 100 USD/);
  assert.match(result.errors.join(" "), /\/api\/x402\/bartender/);
});

test("chat requests are normalized and reject extra fields", () => {
  assert.deepEqual(validateBartenderRequest({ question: "  Left Hand Cocktail spec  " }), {
    mode: "chat",
    question: "Left Hand Cocktail spec",
  });
  assert.throws(
    () => validateBartenderRequest({ mode: "chat", question: "Old Fashioned", extra: true }),
    InputError,
  );
  assert.throws(() => validateBartenderRequest({ mode: "chat", question: "" }), InputError);
});

test("wizard requests preserve only bounded, supported preferences", () => {
  const result = validateBartenderRequest({
    mode: "wizard",
    wizard_preferences: {
      style: "spirit_forward",
      ice: "on_ice",
      spirits: ["rye_whiskey"],
    },
    wizard_index: 2,
    exclude: ["Left Hand Cocktail"],
    session_id: "agent-42",
  });
  assert.deepEqual(result, {
    mode: "wizard",
    wizard_preferences: {
      style: "spirit_forward",
      ice: "on_ice",
      spirits: ["rye_whiskey"],
    },
    wizard_index: 2,
    exclude: ["Left Hand Cocktail"],
    session_id: "agent-42",
  });
  assert.throws(
    () => validateBartenderRequest({ mode: "wizard", wizard_preferences: { style: "tiki" } }),
    InputError,
  );
});

test("JSON body reader enforces syntax and the byte limit", async () => {
  assert.deepEqual(await readJsonBody(new Request("https://example.com", { method: "POST", body: "{}" })), {});
  await assert.rejects(
    readJsonBody(new Request("https://example.com", { method: "POST", body: "{" })),
    InputError,
  );
  await assert.rejects(
    readJsonBody(
      new Request("https://example.com", { method: "POST", body: "x".repeat(MAX_BODY_BYTES + 1) }),
    ),
    InputError,
  );
});

test("internal bartender adapter forwards the validated legacy event", async () => {
  let received;
  const structured = { summary: "Found it.", warnings: [], recipes: [] };
  const result = await invokeInternalBartender(async (event) => {
    received = event;
    return { statusCode: 200, body: JSON.stringify({ structured }) };
  }, { mode: "chat", question: "Left Hand Cocktail" });

  assert.deepEqual(result, structured);
  assert.equal(received.httpMethod, "POST");
  assert.deepEqual(JSON.parse(received.body), { mode: "chat", question: "Left Hand Cocktail" });
});

test("internal bartender adapter rejects malformed or failed responses", async () => {
  await assert.rejects(
    invokeInternalBartender(async () => ({ statusCode: 500, body: "{}" }), {}),
    BartenderError,
  );
  await assert.rejects(
    invokeInternalBartender(async () => ({ statusCode: 200, body: "not json" }), {}),
    BartenderError,
  );
});

test("grounding rehydrates known recipes from JSON and drops inventions", () => {
  const recipeSource = [
    {
      name: "Left Hand Cocktail",
      ingredients: [{ amount: "1.5 oz", ingredient: "Bourbon" }],
      glass: "Coupe",
      method: "Stir",
      ice: "None",
      garnish: "Cherry",
    },
  ];
  const result = groundStructuredResponse(
    {
      summary: "Two drinks.",
      warnings: [],
      recipes: [
        {
          name: "Left Hand",
          description: "Exact database spec.",
          ingredients: [{ amount: "99 oz", ingredient: "Invented spirit" }],
        },
        { name: "Imaginary House Riff", ingredients: [] },
      ],
    },
    recipeSource,
  );
  assert.equal(result.recipes.length, 1);
  assert.deepEqual(result.recipes[0].ingredients, [{ amount: "1.5 oz", ingredient: "Bourbon" }]);
  assert.match(result.warnings[0], /non-dataset recipe/);
});

test("grounding replaces a wholly invented result with a safe empty response", () => {
  const result = groundStructuredResponse(
    {
      summary: "Try my invented drink.",
      warnings: [],
      recipes: [{ name: "Imaginary House Riff", ingredients: [] }],
    },
    [],
  );
  assert.equal(result.summary, "No grounded CCC recipe matched that request.");
  assert.deepEqual(result.recipes, []);
});

test("public results declare dataset-only grounding", () => {
  const result = publicResult({ summary: "Found it.", warnings: [], recipes: [] }, "request-1");
  assert.equal(result.request_id, "request-1");
  assert.equal(result.grounding.policy, "dataset_only");
  assert.equal(result.grounding.recipe_count, 452);
  assert.equal(result.grounding.no_original_riffs, true);
});
