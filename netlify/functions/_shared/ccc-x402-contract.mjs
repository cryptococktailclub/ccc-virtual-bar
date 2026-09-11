export const SERVICE_NAME = "ccc-cocktail-intelligence";
export const API_VERSION = "1.0.0";
export const RECIPE_COUNT = 452;
export const STATUS_PATH = "/api/x402";
export const BARTENDER_PATH = "/api/x402/bartender";
export const BASE_SEPOLIA = "eip155:84532";
export const BASE_MAINNET = "eip155:8453";
export const TESTNET_FACILITATOR_URL = "https://x402.org/facilitator";
export const MAX_BODY_BYTES = 8_192;

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const PRICE_PATTERN = /^\$?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const ALLOWED_STYLES = new Set(["light_refreshing", "spirit_forward"]);
const ALLOWED_ICE = new Set(["on_ice", "no_ice"]);

export class InputError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "InputError";
    this.details = details;
  }
}

export class BartenderError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "BartenderError";
    this.statusCode = statusCode;
  }
}

function envValue(getEnv, name) {
  return String(getEnv(name) ?? "").trim();
}

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

export function readX402Config(getEnv) {
  const enabled = envValue(getEnv, "CCC_X402_ENABLED").toLowerCase() === "true";
  const network = envValue(getEnv, "CCC_X402_NETWORK") || BASE_SEPOLIA;
  const payTo = envValue(getEnv, "CCC_X402_PAY_TO");
  const rawPrice = envValue(getEnv, "CCC_X402_PRICE_USD") || "0.02";
  const price = rawPrice.startsWith("$") ? rawPrice : `$${rawPrice}`;
  const publicUrl =
    envValue(getEnv, "CCC_X402_PUBLIC_URL") ||
    "https://cryptococktail.club/api/x402/bartender";
  const configuredFacilitator = envValue(getEnv, "CCC_X402_FACILITATOR_URL");
  const facilitatorUrl =
    configuredFacilitator || (network === BASE_SEPOLIA ? TESTNET_FACILITATOR_URL : "");
  const errors = [];

  if (!ADDRESS_PATTERN.test(payTo) || payTo.toLowerCase() === ZERO_ADDRESS) {
    errors.push("CCC_X402_PAY_TO must be a non-zero Base-compatible 0x address.");
  }
  if (![BASE_SEPOLIA, BASE_MAINNET].includes(network)) {
    errors.push("CCC_X402_NETWORK must be eip155:84532 or eip155:8453.");
  }
  const numericPrice = Number(rawPrice.replace(/^\$/, ""));
  if (!PRICE_PATTERN.test(rawPrice) || numericPrice <= 0 || numericPrice > 100) {
    errors.push("CCC_X402_PRICE_USD must be between 0 and 100 USD with up to 6 decimals.");
  }
  if (!validHttpsUrl(publicUrl)) {
    errors.push("CCC_X402_PUBLIC_URL must be an https URL.");
  } else if (new URL(publicUrl).pathname !== BARTENDER_PATH) {
    errors.push(`CCC_X402_PUBLIC_URL must end at ${BARTENDER_PATH}.`);
  }
  if (!validHttpsUrl(facilitatorUrl)) {
    errors.push("CCC_X402_FACILITATOR_URL must be an https URL.");
  }
  if (network === BASE_MAINNET && facilitatorUrl === TESTNET_FACILITATOR_URL) {
    errors.push("The public x402.org facilitator is testnet-only; configure a mainnet facilitator.");
  }

  return {
    enabled,
    ready: enabled && errors.length === 0,
    network,
    payTo,
    price,
    publicUrl,
    facilitatorUrl,
    errors,
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value, field, { required = false, max = 500 } = {}) {
  if (value == null || value === "") {
    if (required) throw new InputError(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string") throw new InputError(`${field} must be a string.`);
  const result = value.trim();
  if (required && !result) throw new InputError(`${field} is required.`);
  if (result.length > max) throw new InputError(`${field} must be ${max} characters or fewer.`);
  return result;
}

function stringArray(value, field, { maxItems, maxLength }) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new InputError(`${field} must be an array.`);
  if (value.length > maxItems) throw new InputError(`${field} accepts at most ${maxItems} items.`);
  return value.map((item, index) =>
    boundedString(item, `${field}[${index}]`, { required: true, max: maxLength }),
  );
}

export function validateBartenderRequest(body) {
  if (!isPlainObject(body)) throw new InputError("The request body must be a JSON object.");

  const mode = body.mode == null ? "chat" : boundedString(body.mode, "mode", { required: true, max: 16 });
  if (!new Set(["chat", "wizard"]).has(mode)) {
    throw new InputError('mode must be either "chat" or "wizard".');
  }

  if (mode === "chat") {
    if (!hasOnlyKeys(body, new Set(["mode", "question"]))) {
      throw new InputError("The chat request contains unsupported fields.");
    }
    return {
      mode,
      question: boundedString(body.question, "question", { required: true, max: 500 }),
    };
  }

  const rawPreferences = body.wizard_preferences ?? {};
  if (!hasOnlyKeys(body, new Set(["mode", "wizard_preferences", "wizard_index", "exclude", "session_id"]))) {
    throw new InputError("The wizard request contains unsupported fields.");
  }
  if (!isPlainObject(rawPreferences)) {
    throw new InputError("wizard_preferences must be an object.");
  }
  if (!hasOnlyKeys(rawPreferences, new Set(["style", "ice", "spirits"]))) {
    throw new InputError("wizard_preferences contains unsupported fields.");
  }

  const style = boundedString(rawPreferences.style, "wizard_preferences.style", { max: 32 }) || null;
  const ice = boundedString(rawPreferences.ice, "wizard_preferences.ice", { max: 16 }) || null;
  if (style && !ALLOWED_STYLES.has(style)) {
    throw new InputError("wizard_preferences.style is not supported.");
  }
  if (ice && !ALLOWED_ICE.has(ice)) {
    throw new InputError("wizard_preferences.ice is not supported.");
  }

  const rawIndex = body.wizard_index ?? 0;
  if (!Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex > 100) {
    throw new InputError("wizard_index must be an integer from 0 through 100.");
  }

  return {
    mode,
    wizard_preferences: {
      style,
      ice,
      spirits: stringArray(rawPreferences.spirits, "wizard_preferences.spirits", {
        maxItems: 8,
        maxLength: 40,
      }),
    },
    wizard_index: rawIndex,
    exclude: stringArray(body.exclude, "exclude", { maxItems: 20, maxLength: 100 }),
    session_id: boundedString(body.session_id, "session_id", { max: 100 }),
  };
}

export async function readJsonBody(request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new InputError(`Request body must be ${MAX_BODY_BYTES} bytes or fewer.`);
  }
  if (!raw.trim()) throw new InputError("A JSON request body is required.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new InputError("The request body is not valid JSON.");
  }
}

function validStructuredResponse(value) {
  return (
    isPlainObject(value) &&
    typeof value.summary === "string" &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.recipes)
  );
}

function normalizedRecipeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bcocktail\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalRecipe(recipe, description) {
  return {
    name: String(recipe.name || "Untitled Cocktail"),
    description: typeof description === "string" ? description.slice(0, 500) : "",
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((item) => ({
          amount: String(item?.amount || "").trim(),
          ingredient: String(item?.ingredient || "").trim(),
        }))
      : [],
    glass: String(recipe.glass || ""),
    method: String(recipe.method || ""),
    ice: String(recipe.ice || ""),
    garnish: String(recipe.garnish || ""),
    notes: String(recipe.notes || ""),
  };
}

export function groundStructuredResponse(structured, recipeSource) {
  if (!validStructuredResponse(structured)) {
    throw new BartenderError("The internal bartender returned an unexpected response shape.");
  }
  if (!Array.isArray(recipeSource)) {
    throw new BartenderError("The cocktail dataset is unavailable.", 503);
  }

  const byName = new Map();
  for (const recipe of recipeSource) {
    const key = normalizedRecipeName(recipe?.name);
    if (key && !byName.has(key)) byName.set(key, recipe);
  }

  const recipes = [];
  const seen = new Set();
  let removed = 0;
  for (const proposed of structured.recipes.slice(0, 5)) {
    const key = normalizedRecipeName(proposed?.name);
    const source = byName.get(key);
    if (!source) {
      removed += 1;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    recipes.push(canonicalRecipe(source, proposed.description));
  }

  const warnings = structured.warnings
    .filter((warning) => typeof warning === "string")
    .slice(0, 10)
    .map((warning) => warning.slice(0, 500));
  if (removed) warnings.unshift("A non-dataset recipe was removed from the internal AI response.");

  return {
    summary:
      removed && recipes.length === 0
        ? "No grounded CCC recipe matched that request."
        : structured.summary.slice(0, 1_000),
    warnings,
    recipes,
  };
}

export async function invokeInternalBartender(handler, payload) {
  const result = await handler({
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const statusCode = Number(result?.statusCode);
  if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode >= 400) {
    throw new BartenderError("The internal bartender service rejected the request.");
  }

  let responseBody;
  try {
    responseBody = JSON.parse(result.body || "{}");
  } catch {
    throw new BartenderError("The internal bartender returned invalid JSON.");
  }

  let structured = responseBody.structured;
  if (!structured && typeof responseBody.answer === "string") {
    try {
      structured = JSON.parse(responseBody.answer);
    } catch {
      throw new BartenderError("The internal bartender returned an invalid answer.");
    }
  }

  if (!validStructuredResponse(structured)) {
    throw new BartenderError("The internal bartender returned an unexpected response shape.");
  }
  return structured;
}

export function publicResult(structured, requestId) {
  return {
    service: SERVICE_NAME,
    version: API_VERSION,
    request_id: requestId,
    grounding: {
      policy: "dataset_only",
      recipe_count: RECIPE_COUNT,
      no_original_riffs: true,
    },
    structured,
  };
}
