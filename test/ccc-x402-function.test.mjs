import test from "node:test";
import assert from "node:assert/strict";

import handler from "../netlify/functions/ccc-x402-bartender.mjs";

test("status route is public and reports a disabled service", async () => {
  const response = await handler(new Request("https://cryptococktail.club/api/x402"), {
    requestId: "status-test",
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.service, "ccc-cocktail-intelligence");
  assert.equal(body.enabled, false);
  assert.equal(body.ready, false);
  assert.equal(body.recipe_count, 452);
});

test("paid route fails closed until explicitly activated", async () => {
  const response = await handler(
    new Request("https://cryptococktail.club/api/x402/bartender", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "chat", question: "Left Hand Cocktail spec" }),
    }),
    { requestId: "disabled-test" },
  );
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "service_disabled");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("OPTIONS requests are free", async () => {
  const response = await handler(
    new Request("https://cryptococktail.club/api/x402/bartender", { method: "OPTIONS" }),
    { requestId: "options-test" },
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("allow"), "GET, POST, OPTIONS");
});
