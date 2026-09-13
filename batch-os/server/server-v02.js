import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 10000);
const RECIPE_SOURCES = [
  process.env.CCC_RECIPES_URL,
  'https://cryptococktail.club/.netlify/functions/ccc-recipes',
  'https://raw.githubusercontent.com/cryptococktailclub/ccc-virtual-bar/main/netlify/functions/recipes.json'
].filter(Boolean);
const CACHE_TTL_MS = Number(process.env.RECIPE_CACHE_TTL_MS || 300000);
const API_VERSION = '0.2.0-beta';

const VULGAR = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
};

const INGREDIENT_ALIASES = new Map([
  ['fresh lime juice', 'lime juice'],
  ['fresh lemon juice', 'lemon juice'],
  ['sugar syrup', 'simple syrup'],
  ['simple sugar syrup', 'simple syrup'],
  ['angustora bitters', 'angostura bitters'],
  ['angustura bitters', 'angostura bitters'],
  ['orange bitters', 'orange bitters']
]);

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

function canonicalIngredientName(name = '') {
  const cleaned = String(name)
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^fresh\s+/, 'fresh ')
    .trim();
  return INGREDIENT_ALIASES.get(cleaned) || cleaned;
}

function titleCase(text = '') {
  return String(text).replace(/\b\w/g, m => m.toUpperCase());
}

function normalizeIngredient(item = {}) {
  const amountRaw = String(item.amount ?? '').trim();
  const ingredientRaw = String(item.ingredient ?? '').trim();
  const quantity = parseLeadingQuantity(amountRaw);
  const lower = `${amountRaw} ${ingredientRaw}`.toLowerCase();

  if (!ingredientRaw || ingredientRaw === '-') {
    return { ...item, canonicalName: '', quantity: null, unit: 'instruction', batchable: false, status: 'review', note: 'Missing ingredient name.' };
  }
  const canonicalName = canonicalIngredientName(ingredientRaw);
  if (/\b(dash|dashes)\b/.test(lower)) {
    return { ...item, canonicalName, quantity: quantity ?? 1, unit: 'dash', batchable: false, status: /oz\b/i.test(amountRaw) ? 'review' : 'ok', note: /oz\b/i.test(amountRaw) ? 'Source appears to encode dash count as ounces; excluded from liquid totals.' : 'Add during batching or service per house standard.' };
  }
  if (/\b(piece|pieces|wedge|wedges|slice|slices|sprig|sprigs|cucumber|mint|fruit)\b/.test(lower)) {
    return { ...item, canonicalName, quantity, unit: 'count', batchable: false, status: /oz\b/i.test(amountRaw) ? 'review' : 'ok', note: /oz\b/i.test(amountRaw) ? 'Count/prep item appears encoded as ounces; excluded from liquid totals.' : 'Prep separately.' };
  }
  if (/\b(rinse|float|top|topper|splash)\b/.test(lower) && quantity == null) {
    return { ...item, canonicalName, quantity: null, unit: 'service', batchable: false, status: 'review', note: 'Service-step quantity requires manual confirmation.' };
  }
  if (/oz\b/i.test(amountRaw) && quantity != null) {
    return { ...item, canonicalName, quantity, unit: 'oz', batchable: true, status: 'ok', note: '' };
  }
  if (/ml\b/i.test(amountRaw) && quantity != null) {
    return { ...item, canonicalName, quantity: quantity / 29.5735, unit: 'oz', batchable: true, status: 'ok', note: 'Converted from mL.' };
  }
  if (!amountRaw) {
    return { ...item, canonicalName, quantity: null, unit: 'instruction', batchable: false, status: 'review', note: 'No numeric amount in source recipe.' };
  }
  return { ...item, canonicalName, quantity, unit: 'unknown', batchable: false, status: 'review', note: 'Measurement could not be safely normalized.' };
}

async function loadRecipes(force = false) {
  if (!force && cache.recipes && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  let lastError = null;
  for (const source of RECIPE_SOURCES) {
    try {
      const response = await fetch(source, { headers: { Accept: 'application/json', 'User-Agent': `BatchOS/${API_VERSION}` } });
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
function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
function safeCeil(value) { return Math.ceil(Number(value) - 1e-9); }

function buildVesselAssignments(finalLiters, vesselLiters, maxFillPct = 90) {
  if (!(finalLiters > 0) || !(vesselLiters > 0)) return [];
  const usableLiters = vesselLiters * (maxFillPct / 100);
  const vesselCount = Math.ceil(finalLiters / usableLiters);
  const assignments = [];
  let remaining = finalLiters;
  for (let i = 1; i <= vesselCount; i += 1) {
    const fillLiters = Math.min(usableLiters, remaining);
    assignments.push({
      vesselNumber: i,
      capacityLiters: round(vesselLiters),
      targetFillLiters: round(fillLiters),
      fillPct: round((fillLiters / vesselLiters) * 100, 1),
      headspacePct: round(100 - ((fillLiters / vesselLiters) * 100), 1)
    });
    remaining -= fillLiters;
  }
  return assignments;
}

function batchPlan(recipe, params = {}) {
  const guests = safeNumber(params.guests, 100, 1, 100000);
  const drinksPerGuest = safeNumber(params.drinksPerGuest, 2, 0, 20);
  const menuSharePct = safeNumber(params.menuSharePct, 50, 0, 100);
  const overagePct = safeNumber(params.overagePct, 10, 0, 100);
  const dilutionPct = safeNumber(params.dilutionPct, 20, 0, 100);
  const bottleSizeMl = safeNumber(params.bottleSizeMl, 750, 50, 10000);
  const vesselSize = safeNumber(params.vesselSize, 12, 0.1, 10000);
  const vesselUnit = ['L', 'gal'].includes(params.vesselUnit) ? params.vesselUnit : 'L';
  const maxFillPct = safeNumber(params.maxFillPct, 90, 50, 100);
  const forcedPours = params.plannedPours == null ? null : safeNumber(params.plannedPours, null, 0, 1_000_000);

  const plannedPours = forcedPours == null
    ? safeCeil(guests * drinksPerGuest * (menuSharePct / 100) * (1 + overagePct / 100))
    : safeCeil(forcedPours);
  const normalized = (recipe.ingredients || []).map(normalizeIngredient);
  const liquids = normalized.filter(i => i.batchable && i.unit === 'oz' && Number.isFinite(i.quantity));
  const nonLiquids = normalized.filter(i => !i.batchable);
  const perDrinkLiquidOz = liquids.reduce((sum, i) => sum + i.quantity, 0);
  const baseOz = perDrinkLiquidOz * plannedPours;
  const dilutionOz = baseOz * (dilutionPct / 100);
  const finalOz = baseOz + dilutionOz;
  const finalLiters = ozToLiters(finalOz);
  const vesselLiters = vesselUnit === 'gal' ? vesselSize * 3.78541 : vesselSize;
  const vesselAssignments = buildVesselAssignments(finalLiters, vesselLiters, maxFillPct);

  const ingredients = liquids.map(item => {
    const totalOz = item.quantity * plannedPours;
    const totalMl = totalOz * 29.5735;
    return {
      ingredient: item.ingredient,
      canonicalName: item.canonicalName,
      perDrinkOz: round(item.quantity, 4),
      totalOz: round(totalOz),
      totalMl: round(totalMl),
      totalLiters: round(totalMl / 1000),
      bottleSizeMl,
      bottleEquivalents: round(totalMl / bottleSizeMl, 2),
      bottlesToBuy: Math.ceil(totalMl / bottleSizeMl)
    };
  });

  const prepItems = nonLiquids.map(item => {
    const scaledQuantity = Number.isFinite(item.quantity) ? item.quantity * plannedPours : null;
    return {
      ingredient: item.ingredient,
      canonicalName: item.canonicalName,
      amount: item.amount,
      unit: item.unit,
      perDrinkQuantity: item.quantity,
      scaledQuantity: scaledQuantity == null ? null : round(scaledQuantity, 1),
      note: item.note,
      status: item.status
    };
  });

  const warnings = normalized.filter(i => i.status === 'review').map(i => ({
    ingredient: i.ingredient,
    amount: i.amount,
    note: i.note
  }));

  const garnish = String(recipe.garnish || '').trim();
  const garnishTask = garnish && garnish !== '-'
    ? { ingredient: garnish, targetCount: plannedPours, status: 'estimate', note: 'Assumes one garnish per planned pour; confirm house spec before prep.' }
    : null;

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
    inputs: { guests, drinksPerGuest, menuSharePct, overagePct, dilutionPct, bottleSizeMl, vesselSize, vesselUnit, maxFillPct },
    summary: {
      plannedPours,
      perDrinkLiquidOz: round(perDrinkLiquidOz, 4),
      baseOz: round(baseOz),
      baseLiters: round(ozToLiters(baseOz)),
      dilutionOz: round(dilutionOz),
      dilutionLiters: round(ozToLiters(dilutionOz)),
      finalOz: round(finalOz),
      finalLiters: round(finalLiters),
      vesselLiters: round(vesselLiters),
      maxFillPct,
      vesselCount: vesselAssignments.length
    },
    vesselAssignments,
    ingredients,
    prepItems,
    garnishTask,
    warnings
  };
}

function lookupRecipe(recipes, name) {
  const target = String(name || '').trim().toLowerCase();
  return recipes.find(r => String(r.name || '').trim().toLowerCase() === target);
}

function normalizePurchaseRules(raw = {}) {
  const rules = new Map();
  if (!raw || typeof raw !== 'object') return rules;
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const canonicalName = canonicalIngredientName(key);
    rules.set(canonicalName, {
      packageSizeMl: safeNumber(value.packageSizeMl, 750, 50, 20000),
      onHandMl: safeNumber(value.onHandMl, 0, 0, 1_000_000),
      unitCost: value.unitCost == null || value.unitCost === '' ? null : safeNumber(value.unitCost, null, 0, 100000)
    });
  }
  return rules;
}

function eventPlan(recipes, params = {}) {
  const guests = safeNumber(params.guests, 100, 1, 100000);
  const drinksPerGuest = safeNumber(params.drinksPerGuest, 2, 0, 20);
  const overagePct = safeNumber(params.overagePct, 10, 0, 100);
  const defaultDilutionPct = safeNumber(params.dilutionPct, 20, 0, 100);
  const defaultBottleSizeMl = safeNumber(params.bottleSizeMl, 750, 50, 10000);
  const vesselSize = safeNumber(params.vesselSize, 12, 0.1, 10000);
  const vesselUnit = ['L', 'gal'].includes(params.vesselUnit) ? params.vesselUnit : 'L';
  const maxFillPct = safeNumber(params.maxFillPct, 90, 50, 100);
  const menu = Array.isArray(params.menu) ? params.menu.slice(0, 12) : [];

  if (menu.length === 0) {
    const error = new Error('Event menu must include at least one cocktail.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedMenu = menu.map((item, index) => ({
    index,
    recipeName: String(item.recipeName || '').trim(),
    sharePct: safeNumber(item.sharePct, 0, 0, 100),
    dilutionPct: safeNumber(item.dilutionPct, defaultDilutionPct, 0, 100)
  }));
  const allocationPct = normalizedMenu.reduce((sum, item) => sum + item.sharePct, 0);
  if (Math.abs(allocationPct - 100) > 0.05) {
    const error = new Error(`Menu allocation must total 100%. Current total: ${round(allocationPct, 2)}%.`);
    error.statusCode = 400;
    throw error;
  }

  const baseDrinks = guests * drinksPerGuest;
  const eventTargetPours = safeCeil(baseDrinks * (1 + overagePct / 100));
  const cocktailPlans = normalizedMenu.map(item => {
    const recipe = lookupRecipe(recipes, item.recipeName);
    if (!recipe) {
      const error = new Error(`Recipe not found: ${item.recipeName}`);
      error.statusCode = 404;
      throw error;
    }
    const plannedPours = safeCeil(baseDrinks * (item.sharePct / 100) * (1 + overagePct / 100));
    const plan = batchPlan(recipe, {
      guests,
      drinksPerGuest,
      menuSharePct: item.sharePct,
      overagePct,
      dilutionPct: item.dilutionPct,
      bottleSizeMl: defaultBottleSizeMl,
      vesselSize,
      vesselUnit,
      maxFillPct,
      plannedPours
    });
    return { sharePct: item.sharePct, dilutionPct: item.dilutionPct, ...plan };
  });

  const consolidatedMap = new Map();
  for (const cocktail of cocktailPlans) {
    for (const item of cocktail.ingredients) {
      const key = item.canonicalName || canonicalIngredientName(item.ingredient);
      if (!consolidatedMap.has(key)) {
        consolidatedMap.set(key, { canonicalName: key, ingredient: titleCase(key), requiredMl: 0, cocktails: new Set() });
      }
      const target = consolidatedMap.get(key);
      target.requiredMl += item.totalMl;
      target.cocktails.add(cocktail.recipe.name);
    }
  }

  const purchaseRules = normalizePurchaseRules(params.purchaseRules);
  const consolidatedPurchasing = [...consolidatedMap.values()]
    .map(item => {
      const rule = purchaseRules.get(item.canonicalName) || { packageSizeMl: defaultBottleSizeMl, onHandMl: 0, unitCost: null };
      const netRequiredMl = Math.max(0, item.requiredMl - rule.onHandMl);
      const packagesToBuy = Math.ceil(netRequiredMl / rule.packageSizeMl);
      const estimatedCost = rule.unitCost == null ? null : packagesToBuy * rule.unitCost;
      return {
        canonicalName: item.canonicalName,
        ingredient: item.ingredient,
        requiredMl: round(item.requiredMl),
        requiredLiters: round(item.requiredMl / 1000),
        onHandMl: round(rule.onHandMl),
        netRequiredMl: round(netRequiredMl),
        packageSizeMl: round(rule.packageSizeMl),
        packagesToBuy,
        unitCost: rule.unitCost,
        estimatedCost: estimatedCost == null ? null : round(estimatedCost, 2),
        cocktails: [...item.cocktails].sort()
      };
    })
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient));

  const prepMap = new Map();
  const manualPrep = [];
  for (const cocktail of cocktailPlans) {
    for (const item of cocktail.prepItems) {
      if (item.scaledQuantity != null && (item.unit === 'count' || item.unit === 'dash')) {
        const key = `${item.canonicalName}|${item.unit}`;
        if (!prepMap.has(key)) prepMap.set(key, { ingredient: item.ingredient, canonicalName: item.canonicalName, unit: item.unit, totalQuantity: 0, cocktails: new Set(), status: item.status });
        const target = prepMap.get(key);
        target.totalQuantity += item.scaledQuantity;
        target.cocktails.add(cocktail.recipe.name);
        if (item.status === 'review') target.status = 'review';
      } else {
        manualPrep.push({ cocktail: cocktail.recipe.name, ingredient: item.ingredient, amount: item.amount, note: item.note, status: item.status });
      }
    }
    if (cocktail.garnishTask) {
      const key = `garnish:${canonicalIngredientName(cocktail.garnishTask.ingredient)}`;
      if (!prepMap.has(key)) prepMap.set(key, { ingredient: cocktail.garnishTask.ingredient, canonicalName: canonicalIngredientName(cocktail.garnishTask.ingredient), unit: 'garnish', totalQuantity: 0, cocktails: new Set(), status: 'estimate' });
      const target = prepMap.get(key);
      target.totalQuantity += cocktail.garnishTask.targetCount;
      target.cocktails.add(cocktail.recipe.name);
    }
  }

  const prepRequirements = [...prepMap.values()].map(item => ({
    ...item,
    totalQuantity: round(item.totalQuantity, 1),
    cocktails: [...item.cocktails].sort(),
    note: item.unit === 'garnish' ? 'One-per-pour estimate; confirm garnish spec and loss factor.' : item.unit === 'dash' ? 'Dash totals are operational estimates, not liquid purchasing volume.' : 'Count-based prep quantity from source recipe.'
  }));

  const batchLabels = cocktailPlans.flatMap(cocktail => cocktail.vesselAssignments.map(assignment => ({
    cocktail: cocktail.recipe.name,
    batchNumber: assignment.vesselNumber,
    batchCount: cocktail.vesselAssignments.length,
    targetFillLiters: assignment.targetFillLiters,
    vesselCapacityLiters: assignment.capacityLiters,
    fillPct: assignment.fillPct,
    plannedPours: cocktail.summary.plannedPours,
    dilutionPct: cocktail.dilutionPct,
    service: [cocktail.recipe.method, cocktail.recipe.glass, cocktail.recipe.ice].filter(Boolean).join(' · '),
    garnish: cocktail.recipe.garnish
  })));

  const warnings = cocktailPlans.flatMap(cocktail => cocktail.warnings.map(w => ({ cocktail: cocktail.recipe.name, ...w })));
  const pricedLines = consolidatedPurchasing.filter(i => i.estimatedCost != null);
  const estimatedCOGS = pricedLines.reduce((sum, i) => sum + i.estimatedCost, 0);
  const finalLiters = cocktailPlans.reduce((sum, c) => sum + c.summary.finalLiters, 0);
  const purchaseUnits = consolidatedPurchasing.reduce((sum, i) => sum + i.packagesToBuy, 0);

  return {
    event: {
      name: String(params.eventName || '').trim() || 'Untitled Event',
      guests,
      drinksPerGuest,
      overagePct,
      allocationPct: round(allocationPct, 2),
      baseDrinks: round(baseDrinks),
      eventTargetPours,
      menuCount: cocktailPlans.length
    },
    summary: {
      plannedPours: cocktailPlans.reduce((sum, c) => sum + c.summary.plannedPours, 0),
      finalLiters: round(finalLiters),
      totalVessels: cocktailPlans.reduce((sum, c) => sum + c.summary.vesselCount, 0),
      purchaseUnits,
      estimatedCOGS: pricedLines.length ? round(estimatedCOGS, 2) : null,
      pricedLineCount: pricedLines.length,
      totalPurchaseLineCount: consolidatedPurchasing.length,
      cogsComplete: consolidatedPurchasing.length > 0 && pricedLines.length === consolidatedPurchasing.length
    },
    cocktails: cocktailPlans.map(cocktail => ({
      recipe: cocktail.recipe,
      sharePct: cocktail.sharePct,
      dilutionPct: cocktail.dilutionPct,
      summary: cocktail.summary,
      vesselAssignments: cocktail.vesselAssignments,
      ingredients: cocktail.ingredients,
      prepItems: cocktail.prepItems,
      garnishTask: cocktail.garnishTask,
      warnings: cocktail.warnings
    })),
    consolidatedPurchasing,
    prepRequirements,
    manualPrep,
    batchLabels,
    warnings
  };
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2_000_000) reject(new Error('Request too large'));
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
      return send(res, 200, { status: 'ok', service: 'batch-os-api', version: API_VERSION, recipeCount: recipes.length, source, loadedAt: new Date(loadedAt).toISOString() });
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
      const recipe = lookupRecipe(recipes, recipeName);
      if (!recipe) return send(res, 404, { error: 'Recipe not found', recipeName });
      return send(res, 200, batchPlan(recipe, body));
    }

    if (req.method === 'POST' && url.pathname === '/api/events/plan') {
      const body = await readJson(req);
      const { recipes } = await loadRecipes();
      return send(res, 200, eventPlan(recipes, body));
    }

    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, {
        service: 'Batch OS API',
        version: API_VERSION,
        endpoints: ['/health', '/api/recipes', '/api/batch', '/api/events/plan']
      });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, error.statusCode || 500, { error: 'Batch OS API error', message: error.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Batch OS API ${API_VERSION} listening on ${PORT}`);
});
