import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 10000);
const API_VERSION = '0.3.0-beta';
const RECIPE_SOURCES = [
  process.env.RECIPE_SOURCE_URL,
  process.env.CCC_RECIPES_URL,
  'https://cryptococktail.club/.netlify/functions/ccc-recipes',
  'https://raw.githubusercontent.com/cryptococktailclub/ccc-virtual-bar/main/netlify/functions/recipes.json'
].filter(Boolean);
const CACHE_TTL_MS = Number(process.env.RECIPE_CACHE_TTL_MS || 300000);

const VULGAR = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
};

const ALIASES = new Map([
  ['fresh lime juice', 'lime juice'],
  ['fresh lemon juice', 'lemon juice'],
  ['sugar syrup', 'simple syrup'],
  ['simple sugar syrup', 'simple syrup'],
  ['angustora bitters', 'angostura bitters'],
  ['angustura bitters', 'angostura bitters']
]);

let cache = { recipes: null, loadedAt: 0 };

function headers() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}

function send(res, code, data) {
  res.writeHead(code, { ...headers(), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function safeNumber(value, fallback, min = 0, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function round(value, digits = 3) {
  const f = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * f) / f;
}

function safeCeil(value) {
  return Math.ceil(Number(value) - 1e-9);
}

function parseLeadingQuantity(text = '') {
  const raw = String(text).trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  const mixed = raw.match(/^(\d+(?:\.\d+)?)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/);
  if (mixed) return Number(mixed[1]) + VULGAR[mixed[2]];
  const fracOnly = raw.match(/^([¼½¾⅓⅔⅛⅜⅝⅞])/);
  if (fracOnly) return VULGAR[fracOnly[1]];
  const fraction = raw.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const decimal = raw.match(/^(\d+(?:\.\d+)?)/);
  return decimal ? Number(decimal[1]) : null;
}

function canonicalName(name = '') {
  const cleaned = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  return ALIASES.get(cleaned) || cleaned;
}

function normalizeIngredient(item = {}) {
  const ingredient = String(item.ingredient || '').trim();
  const amount = String(item.amount || '').trim();
  const lower = `${amount} ${ingredient}`.toLowerCase();
  const quantity = parseLeadingQuantity(amount);
  const canonicalIngredient = canonicalName(ingredient);

  if (!ingredient) {
    return { ingredient, amount, quantity: null, unit: 'unknown', batchable: false, status: 'review', note: 'Ingredient name is required.' };
  }
  if (/\b(dash|dashes)\b/.test(lower)) {
    return { ingredient, amount, canonicalName: canonicalIngredient, quantity: quantity ?? 1, unit: 'dash', batchable: false, status: 'ok', note: 'Add as a count-based prep item.' };
  }
  if (/\b(piece|pieces|wedge|wedges|slice|slices|sprig|sprigs)\b/.test(lower)) {
    return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'count', batchable: false, status: 'ok', note: 'Prep separately.' };
  }
  if (/\boz\b/i.test(amount) && quantity != null) {
    return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'oz', batchable: true, status: 'ok', note: '' };
  }
  if (/\bml\b/i.test(amount) && quantity != null) {
    return { ingredient, amount, canonicalName: canonicalIngredient, quantity: quantity / 29.5735, unit: 'oz', batchable: true, status: 'ok', note: 'Converted from mL.' };
  }
  if (/\b(rinse|float|top|topper|splash)\b/.test(lower)) {
    return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'service', batchable: false, status: 'review', note: 'Add separately and confirm service quantity.' };
  }
  return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'unknown', batchable: false, status: 'review', note: 'Use oz or mL for liquid ingredients, or dash/piece/slice/sprig for prep items.' };
}

function validateCustomRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') throw Object.assign(new Error('Recipe is required.'), { statusCode: 400 });
  const name = String(recipe.name || '').trim();
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(i => i && String(i.ingredient || '').trim()) : [];
  if (!name) throw Object.assign(new Error('Recipe name is required.'), { statusCode: 400 });
  if (!ingredients.length) throw Object.assign(new Error('Add at least one ingredient.'), { statusCode: 400 });
  if (ingredients.length > 40) throw Object.assign(new Error('Recipe has too many ingredients.'), { statusCode: 400 });
  return {
    name,
    category: String(recipe.category || 'Original').trim() || 'Original',
    method: String(recipe.method || '').trim(),
    glass: String(recipe.glass || '').trim(),
    ice: String(recipe.ice || '').trim(),
    garnish: String(recipe.garnish || '').trim(),
    ingredients: ingredients.map(i => ({ amount: String(i.amount || '').trim(), ingredient: String(i.ingredient || '').trim() }))
  };
}

async function loadRecipes(force = false) {
  if (!force && cache.recipes && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.recipes;
  let lastError;
  for (const source of RECIPE_SOURCES) {
    try {
      const response = await fetch(source, { headers: { Accept: 'application/json', 'User-Agent': `BatchOS/${API_VERSION}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const recipes = Array.isArray(payload) ? payload : payload.recipes;
      if (!Array.isArray(recipes) || !recipes.length) throw new Error('Recipe source returned no recipes');
      cache = { recipes, loadedAt: Date.now() };
      return recipes;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Recipe library unavailable');
}

function lookupRecipe(recipes, name) {
  const target = String(name || '').trim().toLowerCase();
  return recipes.find(r => String(r.name || '').trim().toLowerCase() === target);
}

function buildVessels(finalLiters, vesselLiters, maxFillPct = 90) {
  if (!(finalLiters > 0) || !(vesselLiters > 0)) return [];
  const usable = vesselLiters * (maxFillPct / 100);
  const count = Math.ceil(finalLiters / usable);
  let remaining = finalLiters;
  return Array.from({ length: count }, (_, i) => {
    const fill = Math.min(usable, remaining);
    remaining -= fill;
    return { vesselNumber: i + 1, targetFillLiters: round(fill), capacityLiters: round(vesselLiters), fillPct: round((fill / vesselLiters) * 100, 1) };
  });
}

function batchPlan(recipe, params = {}) {
  const plannedPours = safeCeil(safeNumber(params.plannedPours, 100, 1, 1_000_000));
  const overagePct = safeNumber(params.overagePct, 10, 0, 100);
  const dilutionPct = safeNumber(params.dilutionPct, 20, 0, 100);
  const bottleSizeMl = safeNumber(params.bottleSizeMl, 750, 50, 20000);
  const vesselSize = safeNumber(params.vesselSize, 12, 0.1, 10000);
  const vesselUnit = ['L', 'gal'].includes(params.vesselUnit) ? params.vesselUnit : 'L';
  const maxFillPct = safeNumber(params.maxFillPct, 90, 50, 100);
  const poursWithOverage = safeCeil(plannedPours * (1 + overagePct / 100));

  const normalized = (recipe.ingredients || []).map(normalizeIngredient);
  const liquids = normalized.filter(i => i.batchable && i.unit === 'oz' && Number.isFinite(i.quantity));
  const prep = normalized.filter(i => !i.batchable);
  const perDrinkOz = liquids.reduce((sum, i) => sum + i.quantity, 0);
  const baseOz = perDrinkOz * poursWithOverage;
  const dilutionOz = baseOz * (dilutionPct / 100);
  const finalOz = baseOz + dilutionOz;
  const finalLiters = finalOz * 0.0295735;
  const vesselLiters = vesselUnit === 'gal' ? vesselSize * 3.78541 : vesselSize;
  const vessels = buildVessels(finalLiters, vesselLiters, maxFillPct);

  const ingredients = liquids.map(i => {
    const totalOz = i.quantity * poursWithOverage;
    const totalMl = totalOz * 29.5735;
    return { ingredient: i.ingredient, perDrinkOz: round(i.quantity, 4), totalOz: round(totalOz), totalMl: round(totalMl), totalLiters: round(totalMl / 1000), bottleSizeMl, bottlesToBuy: Math.ceil(totalMl / bottleSizeMl) };
  });

  const prepItems = prep.map(i => ({ ingredient: i.ingredient, amount: i.amount, unit: i.unit, totalQuantity: Number.isFinite(i.quantity) ? round(i.quantity * poursWithOverage, 1) : null, status: i.status, note: i.note }));
  const warnings = normalized.filter(i => i.status === 'review').map(i => ({ ingredient: i.ingredient, amount: i.amount, note: i.note }));

  return {
    recipe: { name: recipe.name, category: recipe.category, method: recipe.method, glass: recipe.glass, ice: recipe.ice, garnish: recipe.garnish, ingredients: recipe.ingredients || [] },
    inputs: { plannedPours, overagePct, dilutionPct, bottleSizeMl, vesselSize, vesselUnit, maxFillPct },
    summary: { requestedPours: plannedPours, plannedPours: poursWithOverage, perDrinkLiquidOz: round(perDrinkOz, 4), baseLiters: round(baseOz * 0.0295735), dilutionLiters: round(dilutionOz * 0.0295735), finalLiters: round(finalLiters), vesselCount: vessels.length },
    ingredients, prepItems, vessels, warnings
  };
}

function eventPlan(recipes, params = {}) {
  const guests = safeNumber(params.guests, 100, 1, 100000);
  const drinksPerGuest = safeNumber(params.drinksPerGuest, 2, 0, 20);
  const overagePct = safeNumber(params.overagePct, 10, 0, 100);
  const menu = Array.isArray(params.menu) ? params.menu.slice(0, 12) : [];
  if (!menu.length) throw Object.assign(new Error('Event menu must include at least one cocktail.'), { statusCode: 400 });
  const allocation = menu.reduce((sum, item) => sum + safeNumber(item.sharePct, 0, 0, 100), 0);
  if (Math.abs(allocation - 100) > 0.05) throw Object.assign(new Error(`Menu allocation must total 100%. Current total: ${round(allocation, 2)}%.`), { statusCode: 400 });
  const baseDrinks = guests * drinksPerGuest;
  const cocktails = menu.map(item => {
    const recipe = lookupRecipe(recipes, item.recipeName);
    if (!recipe) throw Object.assign(new Error(`Recipe not found: ${item.recipeName}`), { statusCode: 404 });
    const target = safeCeil(baseDrinks * (safeNumber(item.sharePct, 0, 0, 100) / 100));
    return { sharePct: safeNumber(item.sharePct, 0, 0, 100), ...batchPlan(recipe, { plannedPours: target, overagePct, dilutionPct: safeNumber(item.dilutionPct, params.dilutionPct ?? 20, 0, 100), bottleSizeMl: params.bottleSizeMl, vesselSize: params.vesselSize, vesselUnit: params.vesselUnit, maxFillPct: params.maxFillPct }) };
  });
  return { event: { name: String(params.eventName || '').trim() || 'Untitled Event', guests, drinksPerGuest, overagePct, allocationPct: round(allocation, 2) }, summary: { plannedPours: cocktails.reduce((sum, c) => sum + c.summary.plannedPours, 0), finalLiters: round(cocktails.reduce((sum, c) => sum + c.summary.finalLiters, 0)), totalVessels: cocktails.reduce((sum, c) => sum + c.summary.vesselCount, 0) }, cocktails };
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 2_000_000) reject(new Error('Request too large')); });
    req.on('end', () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch { reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 })); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') { const recipes = await loadRecipes(); return send(res, 200, { status: 'ok', service: 'batch-os-api', version: API_VERSION, recipeCount: recipes.length }); }
    if (req.method === 'GET' && url.pathname === '/api/recipes') {
      const recipes = await loadRecipes(url.searchParams.get('refresh') === '1');
      const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
      const filtered = recipes.filter(recipe => { const haystack = [recipe.name, recipe.category, recipe.method, ...(recipe.ingredients || []).map(i => i.ingredient)].join(' ').toLowerCase(); return !q || haystack.includes(q); });
      return send(res, 200, { count: filtered.length, totalCount: recipes.length, recipes: filtered });
    }
    if (req.method === 'POST' && url.pathname === '/api/batch') { const body = await readJson(req); const recipes = await loadRecipes(); const recipe = lookupRecipe(recipes, body.recipeName); if (!recipe) return send(res, 404, { error: 'Recipe not found', recipeName: body.recipeName }); return send(res, 200, batchPlan(recipe, body)); }
    if (req.method === 'POST' && url.pathname === '/api/custom/batch') { const body = await readJson(req); const recipe = validateCustomRecipe(body.recipe); return send(res, 200, batchPlan(recipe, body)); }
    if (req.method === 'POST' && url.pathname === '/api/custom/validate') { const body = await readJson(req); const recipe = validateCustomRecipe(body.recipe); const normalizedIngredients = recipe.ingredients.map(normalizeIngredient); return send(res, 200, { recipe, validForBatching: normalizedIngredients.some(i => i.batchable), ingredients: normalizedIngredients, warnings: normalizedIngredients.filter(i => i.status === 'review') }); }
    if (req.method === 'POST' && url.pathname === '/api/events/plan') { const body = await readJson(req); const recipes = await loadRecipes(); return send(res, 200, eventPlan(recipes, body)); }
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, { service: 'Batch OS API', version: API_VERSION, endpoints: ['/health', '/api/recipes', '/api/batch', '/api/custom/batch', '/api/custom/validate', '/api/events/plan'] });
    return send(res, 404, { error: 'Not found' });
  } catch (error) { console.error(error); return send(res, error.statusCode || 500, { error: 'Batch OS API error', message: error.message }); }
});

server.listen(PORT, '0.0.0.0', () => { console.log(`Batch OS API ${API_VERSION} listening on ${PORT}`); });
