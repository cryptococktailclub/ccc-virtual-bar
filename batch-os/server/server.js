import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 10000);
const RECIPE_SOURCES = [
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

let cache = { recipes: null, source: null, loadedAt: 0 };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}

function send(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...corsHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function parseLeadingQuantity(text = '') {
  const raw = String(text).trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  const mixed = raw.match(/^(\d+(?:\.\d+)?)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/);
  if (mixed) return Number(mixed[1]) + VULGAR[mixed[2]];
  const fracOnly = raw.match(/^([¼½¾⅓⅔⅛⅜⅝⅞])/);
  if (fracOnly) return VULGAR[fracOnly[1]];
  const simpleFraction = raw.match(/^(\d+)\s*\/\s*(\d+)/);
  if (simpleFraction) return Number(simpleFraction[1]) / Number(simpleFraction[2]);
  const decimal = raw.match(/^(\d+(?:\.\d+)?)/);
  return decimal ? Number(decimal[1]) : null;
}

function normalizeIngredient(item = {}) {
  const amountRaw = String(item.amount ?? '').trim();
  const ingredientRaw = String(item.ingredient ?? '').trim();
  const quantity = parseLeadingQuantity(amountRaw);
  const lower = `${amountRaw} ${ingredientRaw}`.toLowerCase();

  if (!ingredientRaw || ingredientRaw === '-') {
    return { ...item, quantity: null, unit: 'instruction', batchable: false, status: 'review', note: 'Missing ingredient name.' };
  }
  if (/\b(dash|dashes)\b/.test(lower)) {
    return { ...item, quantity: quantity ?? 1, unit: 'dash', batchable: false, status: /oz\b/i.test(amountRaw) ? 'review' : 'ok', note: /oz\b/i.test(amountRaw) ? 'Source appears to encode dash count as ounces; excluded from liquid batch.' : 'Add during batch or service per house standard.' };
  }
  if (/\b(piece|pieces|wedge|wedges|slice|slices|sprig|sprigs|cucumber|mint|fruit)\b/.test(lower)) {
    return { ...item, quantity, unit: 'count', batchable: false, status: /oz\b/i.test(amountRaw) ? 'review' : 'ok', note: /oz\b/i.test(amountRaw) ? 'Count/prep item appears encoded as ounces; excluded from liquid batch.' : 'Prep separately.' };
  }
  if (/\b(rinse|float|top|topper|splash)\b/.test(lower) && quantity == null) {
    return { ...item, quantity: null, unit: 'service', batchable: false, status: 'review', note: 'Service-step quantity requires manual confirmation.' };
  }
  if (/oz\b/i.test(amountRaw) && quantity != null) {
    return { ...item, quantity, unit: 'oz', batchable: true, status: 'ok', note: '' };
  }
  if (/ml\b/i.test(amountRaw) && quantity != null) {
    return { ...item, quantity: quantity / 29.5735, unit: 'oz', batchable: true, status: 'ok', note: 'Converted from mL.' };
  }
  if (!amountRaw) {
    return { ...item, quantity: null, unit: 'instruction', batchable: false, status: 'review', note: 'No numeric amount in source recipe.' };
  }
  return { ...item, quantity, unit: 'unknown', batchable: false, status: 'review', note: 'Measurement could not be safely normalized.' };
}

async function loadRecipes(force = false) {
  if (!force && cache.recipes && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  let lastError = null;
  for (const source of RECIPE_SOURCES) {
    try {
      const response = await fetch(source, { headers: { Accept: 'application/json', 'User-Agent': 'BatchOS/0.1-beta' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const recipes = Array.isArray(payload) ? payload : payload.recipes;
      if (!Array.isArray(recipes) || recipes.length === 0) throw new Error('Recipe source returned no recipes');
      cache = { recipes, source, loadedAt: Date.now() };
      return cache;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No recipe source available');
}

function safeNumber(value, fallback, min = 0, max = Number.POSITIVE_INFINITY) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function ozToLiters(oz) { return oz * 0.0295735; }

function batchPlan(recipe, params = {}) {
  const guests = safeNumber(params.guests, 100, 1, 100000);
  const drinksPerGuest = safeNumber(params.drinksPerGuest, 2, 0, 20);
  const menuSharePct = safeNumber(params.menuSharePct, 50, 0, 100);
  const overagePct = safeNumber(params.overagePct, 10, 0, 100);
  const dilutionPct = safeNumber(params.dilutionPct, 20, 0, 100);
  const bottleSizeMl = safeNumber(params.bottleSizeMl, 750, 50, 10000);
  const vesselSize = safeNumber(params.vesselSize, 12, 0.1, 10000);
  const vesselUnit = ['L', 'gal'].includes(params.vesselUnit) ? params.vesselUnit : 'L';

  const plannedPours = Math.ceil(guests * drinksPerGuest * (menuSharePct / 100) * (1 + overagePct / 100));
  const normalized = (recipe.ingredients || []).map(normalizeIngredient);
  const liquids = normalized.filter(i => i.batchable && i.unit === 'oz' && Number.isFinite(i.quantity));
  const nonLiquids = normalized.filter(i => !i.batchable);
  const perDrinkLiquidOz = liquids.reduce((sum, i) => sum + i.quantity, 0);
  const baseOz = perDrinkLiquidOz * plannedPours;
  const dilutionOz = baseOz * (dilutionPct / 100);
  const finalOz = baseOz + dilutionOz;
  const finalLiters = ozToLiters(finalOz);
  const vesselLiters = vesselUnit === 'gal' ? vesselSize * 3.78541 : vesselSize;
  const vesselCount = finalLiters > 0 ? Math.ceil(finalLiters / vesselLiters) : 0;

  const ingredients = liquids.map(item => {
    const totalOz = item.quantity * plannedPours;
    const totalMl = totalOz * 29.5735;
    return {
      ingredient: item.ingredient,
      perDrinkOz: item.quantity,
      totalOz,
      totalMl,
      totalLiters: totalMl / 1000,
      bottleSizeMl,
      bottleEquivalents: totalMl / bottleSizeMl,
      bottlesToBuy: Math.ceil(totalMl / bottleSizeMl)
    };
  });

  const warnings = normalized.filter(i => i.status === 'review').map(i => ({
    ingredient: i.ingredient,
    amount: i.amount,
    note: i.note
  }));

  return {
    recipe: {
      name: recipe.name,
      category: recipe.category,
      method: recipe.method,
      glass: recipe.glass,
      ice: recipe.ice,
      garnish: recipe.garnish,
      sourceIngredients: recipe.ingredients || []
    },
    inputs: { guests, drinksPerGuest, menuSharePct, overagePct, dilutionPct, bottleSizeMl, vesselSize, vesselUnit },
    summary: {
      plannedPours,
      perDrinkLiquidOz,
      baseOz,
      baseLiters: ozToLiters(baseOz),
      dilutionOz,
      dilutionLiters: ozToLiters(dilutionOz),
      finalOz,
      finalLiters,
      vesselLiters,
      vesselCount
    },
    ingredients,
    prepItems: nonLiquids.map(i => ({ ingredient: i.ingredient, amount: i.amount, unit: i.unit, note: i.note })),
    warnings
  };
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const { recipes, source, loadedAt } = await loadRecipes();
      return send(res, 200, { status: 'ok', service: 'batch-os-api', version: '0.1.0-beta', recipeCount: recipes.length, source, loadedAt: new Date(loadedAt).toISOString() });
    }

    if (req.method === 'GET' && url.pathname === '/api/recipes') {
      const { recipes, source, loadedAt } = await loadRecipes(url.searchParams.get('refresh') === '1');
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const category = (url.searchParams.get('category') || '').trim().toLowerCase();
      const filtered = recipes.filter(recipe => {
        const haystack = [recipe.name, recipe.category, recipe.method, ...(recipe.ingredients || []).map(i => i.ingredient)].join(' ').toLowerCase();
        return (!q || haystack.includes(q)) && (!category || String(recipe.category || '').toLowerCase() === category);
      });
      return send(res, 200, { source, loadedAt: new Date(loadedAt).toISOString(), count: filtered.length, totalCount: recipes.length, recipes: filtered });
    }

    if (req.method === 'POST' && url.pathname === '/api/batch') {
      const body = await readJson(req);
      const { recipes } = await loadRecipes();
      const recipeName = String(body.recipeName || '').trim();
      const recipe = recipes.find(r => String(r.name || '').toLowerCase() === recipeName.toLowerCase());
      if (!recipe) return send(res, 404, { error: 'Recipe not found', recipeName });
      return send(res, 200, batchPlan(recipe, body));
    }

    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, { service: 'Batch OS API', version: '0.1.0-beta', endpoints: ['/health', '/api/recipes', '/api/batch'] });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Batch OS API error', message: error.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Batch OS API listening on ${PORT}`);
});
