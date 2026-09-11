import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { Hono } from "hono";
import recipes from "./recipes.json" with { type: "json" };

import {
  API_VERSION,
  BARTENDER_PATH,
  BartenderError,
  InputError,
  RECIPE_COUNT,
  SERVICE_NAME,
  STATUS_PATH,
  groundStructuredResponse,
  invokeInternalBartender,
  publicResult,
  readJsonBody,
  readX402Config,
  validateBartenderRequest,
} from "./_shared/ccc-x402-contract.mjs";

async function getBartenderHandler() {
  const { default: bartenderModule } = await import("./ccc-bartender.js");
  const { handler } = bartenderModule;
  if (typeof handler !== "function") throw new BartenderError("The internal bartender is unavailable.");
  return handler;
}

const inputSchema = {
  type: "object",
  oneOf: [
    {
      properties: {
        mode: { type: "string", const: "chat" },
        question: {
          type: "string",
          minLength: 1,
          maxLength: 500,
          description: "Cocktail question or exact drink name.",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
    {
      properties: {
        mode: { type: "string", const: "wizard" },
        wizard_preferences: {
          type: "object",
          properties: {
            style: {
              type: ["string", "null"],
              enum: ["light_refreshing", "spirit_forward", null],
            },
            ice: { type: ["string", "null"], enum: ["on_ice", "no_ice", null] },
            spirits: {
              type: "array",
              maxItems: 8,
              items: { type: "string", minLength: 1, maxLength: 40 },
            },
          },
          additionalProperties: false,
        },
        wizard_index: { type: "integer", minimum: 0, maximum: 100 },
        exclude: {
          type: "array",
          maxItems: 20,
          items: { type: "string", minLength: 1, maxLength: 100 },
        },
        session_id: { type: "string", maxLength: 100 },
      },
      required: ["mode"],
      additionalProperties: false,
    },
  ],
};

const recipeSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          amount: { type: "string" },
          ingredient: { type: "string" },
        },
        required: ["amount", "ingredient"],
      },
    },
    glass: { type: "string" },
    method: { type: "string" },
    ice: { type: "string" },
    garnish: { type: "string" },
    notes: { type: "string" },
  },
  required: ["name", "description", "ingredients", "glass", "method", "ice", "garnish"],
};

const outputSchema = {
  type: "object",
  properties: {
    service: { type: "string", const: SERVICE_NAME },
    version: { type: "string", const: API_VERSION },
    request_id: { type: "string" },
    grounding: {
      type: "object",
      properties: {
        policy: { type: "string", const: "dataset_only" },
        recipe_count: { type: "integer", const: RECIPE_COUNT },
        no_original_riffs: { type: "boolean", const: true },
      },
      required: ["policy", "recipe_count", "no_original_riffs"],
    },
    structured: {
      type: "object",
      properties: {
        summary: { type: "string" },
        warnings: { type: "array", items: { type: "string" } },
        recipes: { type: "array", items: recipeSchema },
      },
      required: ["summary", "warnings", "recipes"],
    },
  },
  required: ["service", "version", "request_id", "grounding", "structured"],
};

function env(name) {
  return globalThis.Netlify?.env?.get(name) ?? "";
}

function apiHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...apiHeaders(),
      ...extraHeaders,
    },
  });
}

function addResponseHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(apiHeaders())) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function configProblem(config, requestId) {
  console.error("CCC x402 is enabled but not ready", { requestId, errors: config.errors });
  return json(
    {
      error: "service_not_configured",
      message: "The paid cocktail API is not ready to accept payments.",
      request_id: requestId,
    },
    503,
  );
}

function createPaidApp(config) {
  const app = new Hono();
  const discoveryExtension = declareDiscoveryExtension({
    bodyType: "json",
    input: { mode: "chat", question: "Left Hand Cocktail spec" },
    inputSchema,
    output: {
      example: {
        service: SERVICE_NAME,
        version: API_VERSION,
        request_id: "e13fb611-3b25-46a6-b063-745d7f1de3bb",
        grounding: {
          policy: "dataset_only",
          recipe_count: RECIPE_COUNT,
          no_original_riffs: true,
        },
        structured: {
          summary: "Milk & Honey spec for Left Hand Cocktail.",
          warnings: [],
          recipes: [],
        },
      },
      schema: outputSchema,
    },
  });
  const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    config.network,
    new ExactEvmScheme(),
  );

  app.use(
    paymentMiddleware(
      {
        [`POST ${BARTENDER_PATH}`]: {
          accepts: {
            scheme: "exact",
            price: config.price,
            network: config.network,
            payTo: config.payTo,
            maxTimeoutSeconds: 60,
          },
          resource: config.publicUrl,
          description:
            "Grounded cocktail lookup and recommendations from CCC's 452-recipe collection.",
          mimeType: "application/json",
          serviceName: SERVICE_NAME,
          tags: ["cocktails", "recipes", "bartender", "ai", "ccc"],
          unpaidResponseBody: () => ({
            contentType: "application/json",
            body: {
              error: "payment_required",
              message: "Pay the advertised USDC amount and retry with Payment-Signature.",
              service: SERVICE_NAME,
            },
          }),
          settlementFailedResponseBody: () => ({
            contentType: "application/json",
            body: {
              error: "payment_settlement_failed",
              message: "The payment could not be settled; no bartender result was returned.",
              service: SERVICE_NAME,
            },
          }),
          extensions: discoveryExtension,
        },
      },
      resourceServer,
    ),
  );

  app.post(BARTENDER_PATH, async (context) => {
    const requestId = context.env.requestId;
    try {
      const body = await readJsonBody(context.req.raw);
      const payload = validateBartenderRequest(body);
      const structured = await invokeInternalBartender(await getBartenderHandler(), payload);
      const grounded = groundStructuredResponse(structured, recipes);
      return context.json(publicResult(grounded, requestId));
    } catch (error) {
      if (error instanceof InputError) {
        return context.json(
          {
            error: "invalid_request",
            message: error.message,
            request_id: requestId,
          },
          400,
        );
      }
      if (error instanceof BartenderError) {
        console.error("CCC internal bartender error", { requestId, message: error.message });
        return context.json(
          {
            error: "bartender_unavailable",
            message: "The cocktail engine could not complete the request.",
            request_id: requestId,
          },
          error.statusCode,
        );
      }
      console.error("CCC x402 unhandled error", { requestId, error });
      return context.json(
        {
          error: "internal_error",
          message: "The service could not complete the request.",
          request_id: requestId,
        },
        500,
      );
    }
  });

  return app;
}

let cachedApp;
let cachedAppKey = "";

function paidApp(config) {
  const key = JSON.stringify([
    config.network,
    config.payTo,
    config.price,
    config.publicUrl,
    config.facilitatorUrl,
  ]);
  if (!cachedApp || cachedAppKey !== key) {
    cachedApp = createPaidApp(config);
    cachedAppKey = key;
  }
  return cachedApp;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const requestId = context?.requestId || crypto.randomUUID();
  const config = readX402Config(env);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });

  if (url.pathname === STATUS_PATH) {
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed", request_id: requestId }, 405, { Allow: "GET, OPTIONS" });
    }
    return json({
      service: SERVICE_NAME,
      version: API_VERSION,
      endpoint: BARTENDER_PATH,
      enabled: config.enabled,
      ready: config.ready,
      network: config.network,
      price: config.price,
      payment_scheme: "exact",
      asset: "USDC",
      recipe_count: RECIPE_COUNT,
      grounding: "dataset_only",
      request_id: requestId,
    });
  }

  if (url.pathname !== BARTENDER_PATH) {
    return json({ error: "not_found", request_id: requestId }, 404);
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed", request_id: requestId }, 405, { Allow: "POST, OPTIONS" });
  }
  if (!config.enabled) {
    return json(
      {
        error: "service_disabled",
        message: "The CCC x402 endpoint has not been activated.",
        request_id: requestId,
      },
      503,
    );
  }
  if (!config.ready) return configProblem(config, requestId);

  const response = await paidApp(config).fetch(request, { requestId });
  return addResponseHeaders(response);
};

export const config = {
  path: [STATUS_PATH, BARTENDER_PATH],
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["domain", "ip"],
  },
};
