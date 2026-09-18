import http from 'node:http';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const API_VERSION = '0.5.1-beta';
const DATABASE_URL = process.env.DATABASE_URL || '';
const SESSION_DAYS = 30;
const RECIPE_SOURCES = [
  process.env.RECIPE_SOURCE_URL,
  process.env.CCC_RECIPES_URL,
  'https://cryptococktail.club/.netlify/functions/ccc-recipes',
  'https://raw.githubusercontent.com/cryptococktailclub/ccc-virtual-bar/main/netlify/functions/recipes.json'
].filter(Boolean);
const CACHE_TTL_MS = Number(process.env.RECIPE_CACHE_TTL_MS || 300000);
const LOCAL_RECIPE_URL = new URL('../../netlify/functions/recipes.json', import.meta.url);

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

let recipeCache = { recipes: null, loadedAt: 0 };
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 30000 }) : null;
let dbReady = false;
let dbError = null;

function headers() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  };
}
function send(res, code, data) {
  res.writeHead(code, { ...headers(), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function appError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
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
function safeCeil(value) { return Math.ceil(Number(value) - 1e-9); }
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

  if (!ingredient) return { ingredient, amount, quantity: null, unit: 'unknown', batchable: false, status: 'review', note: 'Ingredient name is required.' };
  if (/\b(dash|dashes)\b/.test(lower)) return { ingredient, amount, canonicalName: canonicalIngredient, quantity: quantity ?? 1, unit: 'dash', batchable: false, status: 'ok', note: 'Add as a count-based prep item.' };
  if (/\b(piece|pieces|wedge|wedges|slice|slices|sprig|sprigs)\b/.test(lower)) return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'count', batchable: false, status: 'ok', note: 'Prep separately.' };
  if (/\boz\b/i.test(amount) && quantity != null) return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'oz', batchable: true, status: 'ok', note: '' };
  if (/\bml\b/i.test(amount) && quantity != null) return { ingredient, amount, canonicalName: canonicalIngredient, quantity: quantity / 29.5735, unit: 'oz', batchable: true, status: 'ok', note: 'Converted from mL.' };
  if (/\b(rinse|float|top|topper|splash)\b/.test(lower)) return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'service', batchable: false, status: 'review', note: 'Add separately and confirm service quantity.' };
  return { ingredient, amount, canonicalName: canonicalIngredient, quantity, unit: 'unknown', batchable: false, status: 'review', note: 'Use oz or mL for liquid ingredients, or dash/piece/slice/sprig for prep items.' };
}
function taxonomyValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}
function validateCustomRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') throw appError('Recipe is required.');
  const name = String(recipe.name || '').trim();
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(i => i && String(i.ingredient || '').trim()) : [];
  if (!name) throw appError('Recipe name is required.');
  if (!ingredients.length) throw appError('Add at least one ingredient.');
  if (ingredients.length > 40) throw appError('Recipe has too many ingredients.');
  return {
    id: typeof recipe.id === 'string' ? recipe.id : undefined,
    name,
    category: String(recipe.category || 'Original').trim() || 'Original',
    style: taxonomyValue(recipe.style),
    baseSpirit: taxonomyValue(recipe.baseSpirit),
    method: String(recipe.method || '').trim(),
    glass: String(recipe.glass || '').trim(),
    ice: String(recipe.ice || '').trim(),
    garnish: String(recipe.garnish || '').trim(),
    ingredients: ingredients.map(i => ({ amount: String(i.amount || '').trim(), ingredient: String(i.ingredient || '').trim() }))
  };
}
async function loadRecipes(force = false) {
  if (!force && recipeCache.recipes && Date.now() - recipeCache.loadedAt < CACHE_TTL_MS) return recipeCache.recipes;

  let lastError;

  // Production should not depend on a second website being reachable in order
  // to display the canonical cocktail library. The repository ships the same
  // canonical JSON used by CCC, so load that local copy first.
  try {
    const raw = await readFile(LOCAL_RECIPE_URL, 'utf8');
    const payload = JSON.parse(raw);
    const recipes = Array.isArray(payload) ? payload : payload.recipes;
    if (!Array.isArray(recipes) || !recipes.length) throw new Error('Local recipe library returned no recipes');
    recipeCache = { recipes, loadedAt: Date.now() };
    return recipes;
  } catch (error) {
    lastError = error;
    console.warn(`Batch OS local recipe library unavailable: ${error.message}`);
  }

  // Remote sources remain recovery fallbacks only.
  for (const source of RECIPE_SOURCES) {
    try {
      const response = await fetch(source, { headers: { Accept: 'application/json', 'User-Agent': `BatchOS/${API_VERSION}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const recipes = Array.isArray(payload) ? payload : payload.recipes;
      if (!Array.isArray(recipes) || !recipes.length) throw new Error('Recipe source returned no recipes');
      recipeCache = { recipes, loadedAt: Date.now() };
      return recipes;
    } catch (error) {
      lastError = error;
      console.warn(`Batch OS remote recipe source failed (${source}): ${error.message}`);
    }
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
  const vesselLabel = String(params.vesselLabel || '').trim().slice(0, 80);
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
    recipe: { name: recipe.name, category: recipe.category, style: recipe.style || '', baseSpirit: recipe.baseSpirit || '', method: recipe.method, glass: recipe.glass, ice: recipe.ice, garnish: recipe.garnish, ingredients: recipe.ingredients || [] },
    inputs: { plannedPours, overagePct, dilutionPct, bottleSizeMl, vesselSize, vesselUnit, vesselLabel, maxFillPct },
    summary: { requestedPours: plannedPours, plannedPours: poursWithOverage, perDrinkLiquidOz: round(perDrinkOz, 4), baseLiters: round(baseOz * 0.0295735), dilutionLiters: round(dilutionOz * 0.0295735), finalLiters: round(finalLiters), vesselCount: vessels.length, vesselLabel },
    ingredients, prepItems, vessels, warnings
  };
}
function eventPlan(recipes, params = {}) {
  const guests = safeNumber(params.guests, 100, 1, 100000);
  const drinksPerGuest = safeNumber(params.drinksPerGuest, 2, 0, 20);
  const overagePct = safeNumber(params.overagePct, 10, 0, 100);
  const menu = Array.isArray(params.menu) ? params.menu.slice(0, 12) : [];
  if (!menu.length) throw appError('Event menu must include at least one cocktail.');
  const allocation = menu.reduce((sum, item) => sum + safeNumber(item.sharePct, 0, 0, 100), 0);
  if (Math.abs(allocation - 100) > 0.05) throw appError(`Menu allocation must total 100%. Current total: ${round(allocation, 2)}%.`);
  const baseDrinks = guests * drinksPerGuest;
  const cocktails = menu.map(item => {
    const recipe = lookupRecipe(recipes, item.recipeName);
    if (!recipe) throw appError(`Recipe not found: ${item.recipeName}`, 404);
    const target = safeCeil(baseDrinks * (safeNumber(item.sharePct, 0, 0, 100) / 100));
    return { sharePct: safeNumber(item.sharePct, 0, 0, 100), ...batchPlan(recipe, { plannedPours: target, overagePct, dilutionPct: safeNumber(item.dilutionPct, params.dilutionPct ?? 20, 0, 100), bottleSizeMl: params.bottleSizeMl, vesselSize: params.vesselSize, vesselUnit: params.vesselUnit, maxFillPct: params.maxFillPct }) };
  });
  return { event: { name: String(params.eventName || '').trim() || 'Untitled Event', guests, drinksPerGuest, overagePct, allocationPct: round(allocation, 2) }, summary: { plannedPours: cocktails.reduce((sum, c) => sum + c.summary.plannedPours, 0), finalLiters: round(cocktails.reduce((sum, c) => sum + c.summary.finalLiters, 0)), totalVessels: cocktails.reduce((sum, c) => sum + c.summary.vesselCount, 0) }, cocktails };
}

async function initializeDatabase() {
  if (!pool) { dbReady = false; return; }
  try {
    await pool.query(`
      create table if not exists batch_users (
        id uuid primary key,
        email text not null unique,
        password_hash text not null,
        password_salt text not null,
        created_at timestamptz not null default now()
      );
      create table if not exists batch_sessions (
        id uuid primary key,
        user_id uuid not null references batch_users(id) on delete cascade,
        token_hash text not null unique,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );
      create table if not exists batch_saved_recipes (
        id uuid primary key,
        user_id uuid not null references batch_users(id) on delete cascade,
        name text not null,
        recipe jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists batch_saved_recipes_user_idx on batch_saved_recipes(user_id, updated_at desc);
      create table if not exists batch_saved_batches (
        id uuid primary key,
        user_id uuid not null references batch_users(id) on delete cascade,
        recipe_id uuid null,
        recipe_name text not null,
        recipe_snapshot jsonb not null,
        batch_inputs jsonb not null,
        plan jsonb not null,
        created_at timestamptz not null default now()
      );
      create index if not exists batch_saved_batches_user_idx on batch_saved_batches(user_id, created_at desc);
      delete from batch_sessions where expires_at <= now();
    `);
    dbReady = true;
    dbError = null;
  } catch (error) {
    dbReady = false;
    dbError = error;
    console.error('Batch OS database init failed:', error.message);
  }
}
function requireDatabase() {
  if (!pool || !dbReady) throw appError('Cloud saving is not available yet.', 503);
}
function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw appError('Enter a valid email address.');
  return email;
}
function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 8 || password.length > 200) throw appError('Password must be at least 8 characters.');
  return password;
}
function passwordHash(password, saltHex) {
  return scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}
function verifyPassword(password, saltHex, expectedHex) {
  try {
    const actual = Buffer.from(passwordHash(password, saltHex), 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}
function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await pool.query('insert into batch_sessions(id,user_id,token_hash,expires_at) values($1,$2,$3,$4)', [randomUUID(), userId, tokenHash(token), expiresAt]);
  return { token, expiresAt: expiresAt.toISOString() };
}
function bearerToken(req) {
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}
async function authenticate(req) {
  requireDatabase();
  const token = bearerToken(req);
  if (!token) throw appError('Sign in required.', 401);
  const result = await pool.query(`
    select u.id, u.email from batch_sessions s
    join batch_users u on u.id=s.user_id
    where s.token_hash=$1 and s.expires_at > now()
    limit 1
  `, [tokenHash(token)]);
  if (!result.rowCount) throw appError('Session expired. Sign in again.', 401);
  return result.rows[0];
}
function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}
async function register(body) {
  requireDatabase();
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const exists = await pool.query('select 1 from batch_users where email=$1', [email]);
  if (exists.rowCount) throw appError('An account already exists for that email.', 409);
  const id = randomUUID();
  const salt = randomBytes(16).toString('hex');
  await pool.query('insert into batch_users(id,email,password_hash,password_salt) values($1,$2,$3,$4)', [id, email, passwordHash(password, salt), salt]);
  const session = await createSession(id);
  return { user: { id, email }, ...session };
}
async function login(body) {
  requireDatabase();
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const result = await pool.query('select id,email,password_hash,password_salt from batch_users where email=$1 limit 1', [email]);
  const row = result.rows[0];
  if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) throw appError('Email or password is incorrect.', 401);
  const session = await createSession(row.id);
  return { user: { id: row.id, email: row.email }, ...session };
}
async function listCloudRecipes(userId) {
  const result = await pool.query('select id,name,recipe,created_at,updated_at from batch_saved_recipes where user_id=$1 order by updated_at desc', [userId]);
  return result.rows.map(r => ({ ...r.recipe, id: r.id, cloud: true, createdAt: r.created_at, updatedAt: r.updated_at }));
}
async function saveCloudRecipe(userId, body) {
  const recipe = validateCustomRecipe(body.recipe);
  const id = validUuid(recipe.id) ? recipe.id : randomUUID();
  recipe.id = id;
  const existing = await pool.query('select user_id from batch_saved_recipes where id=$1', [id]);
  if (existing.rowCount && existing.rows[0].user_id !== userId) throw appError('Recipe ID conflict.', 409);
  await pool.query(`
    insert into batch_saved_recipes(id,user_id,name,recipe) values($1,$2,$3,$4::jsonb)
    on conflict(id) do update set name=excluded.name, recipe=excluded.recipe, updated_at=now()
    where batch_saved_recipes.user_id=excluded.user_id
  `, [id, userId, recipe.name, JSON.stringify(recipe)]);
  return recipe;
}
async function deleteCloudRecipe(userId, id) {
  const result = await pool.query('delete from batch_saved_recipes where id=$1 and user_id=$2 returning id', [id, userId]);
  if (!result.rowCount) throw appError('Recipe not found.', 404);
}
async function saveCloudBatch(userId, body) {
  if (!body.plan || typeof body.plan !== 'object' || !body.plan.summary || !body.plan.recipe) throw appError('A calculated batch plan is required.');
  const id = randomUUID();
  const recipeId = validUuid(body.recipeId) ? body.recipeId : null;
  await pool.query(`
    insert into batch_saved_batches(id,user_id,recipe_id,recipe_name,recipe_snapshot,batch_inputs,plan)
    values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)
  `, [id, userId, recipeId, String(body.plan.recipe.name || 'Untitled'), JSON.stringify(body.plan.recipe), JSON.stringify(body.plan.inputs || {}), JSON.stringify(body.plan)]);
  return { id };
}
async function listCloudBatches(userId, limit = 50) {
  const result = await pool.query(`
    select id,recipe_id,recipe_name,recipe_snapshot,batch_inputs,plan,created_at
    from batch_saved_batches where user_id=$1 order by created_at desc limit $2
  `, [userId, Math.min(100, Math.max(1, limit))]);
  return result.rows;
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 2_000_000) reject(appError('Request too large', 413)); });
    req.on('end', () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch { reject(appError('Invalid JSON')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const recipes = await loadRecipes();
      return send(res, 200, { status: 'ok', service: 'batch-os-api', version: API_VERSION, recipeCount: recipes.length, persistenceAvailable: dbReady, persistenceError: dbError ? 'database_unavailable' : null });
    }
    if (req.method === 'GET' && url.pathname === '/api/recipes') {
      const recipes = await loadRecipes(url.searchParams.get('refresh') === '1');
      const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
      const filtered = recipes.filter(recipe => { const haystack = [recipe.name, recipe.category, recipe.method, ...(recipe.ingredients || []).map(i => i.ingredient)].join(' ').toLowerCase(); return !q || haystack.includes(q); });
      return send(res, 200, { count: filtered.length, totalCount: recipes.length, recipes: filtered });
    }
    if (req.method === 'POST' && url.pathname === '/api/batch') {
      const body = await readJson(req); const recipes = await loadRecipes(); const recipe = lookupRecipe(recipes, body.recipeName);
      if (!recipe) throw appError(`Recipe not found: ${body.recipeName}`, 404);
      return send(res, 200, batchPlan(recipe, body));
    }
    if (req.method === 'POST' && url.pathname === '/api/custom/batch') { const body = await readJson(req); return send(res, 200, batchPlan(validateCustomRecipe(body.recipe), body)); }
    if (req.method === 'POST' && url.pathname === '/api/custom/validate') {
      const body = await readJson(req); const recipe = validateCustomRecipe(body.recipe); const normalizedIngredients = recipe.ingredients.map(normalizeIngredient);
      return send(res, 200, { recipe, validForBatching: normalizedIngredients.some(i => i.batchable), ingredients: normalizedIngredients, warnings: normalizedIngredients.filter(i => i.status === 'review') });
    }
    if (req.method === 'POST' && url.pathname === '/api/events/plan') { const body = await readJson(req); return send(res, 200, eventPlan(await loadRecipes(), body)); }

    if (req.method === 'POST' && url.pathname === '/api/auth/register') return send(res, 201, await register(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/auth/login') return send(res, 200, await login(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      requireDatabase(); const token = bearerToken(req); if (token) await pool.query('delete from batch_sessions where token_hash=$1', [tokenHash(token)]); return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/me') { const user = await authenticate(req); return send(res, 200, { user }); }
    if (req.method === 'GET' && url.pathname === '/api/me/recipes') { const user = await authenticate(req); return send(res, 200, { recipes: await listCloudRecipes(user.id) }); }
    if (req.method === 'POST' && url.pathname === '/api/me/recipes') { const user = await authenticate(req); return send(res, 201, { recipe: await saveCloudRecipe(user.id, await readJson(req)) }); }
    const recipeDelete = url.pathname.match(/^\/api\/me\/recipes\/([0-9a-f-]+)$/i);
    if (req.method === 'DELETE' && recipeDelete) { const user = await authenticate(req); await deleteCloudRecipe(user.id, recipeDelete[1]); return send(res, 200, { ok: true }); }
    if (req.method === 'GET' && url.pathname === '/api/me/batches') { const user = await authenticate(req); return send(res, 200, { batches: await listCloudBatches(user.id, Number(url.searchParams.get('limit') || 50)) }); }
    if (req.method === 'POST' && url.pathname === '/api/me/batches') { const user = await authenticate(req); return send(res, 201, await saveCloudBatch(user.id, await readJson(req))); }

    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, { service: 'Batch OS API', version: API_VERSION, persistenceAvailable: dbReady, endpoints: ['/health','/api/recipes','/api/batch','/api/custom/batch','/api/auth/register','/api/auth/login','/api/me/recipes','/api/me/batches'] });
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, error.statusCode || 500, { error: 'Batch OS API error', message: error.statusCode ? error.message : 'Unexpected server error.' });
  }
});

await initializeDatabase();
try {
  const recipes = await loadRecipes(true);
  console.log(`Batch OS recipe library ready; recipes=${recipes.length}; source=local-first`);
} catch (error) {
  console.error(`Batch OS recipe library startup check failed: ${error.message}`);
}
server.listen(PORT, '0.0.0.0', () => { console.log(`Batch OS API ${API_VERSION} listening on ${PORT}; persistence=${dbReady ? 'ready' : 'off'}`); });
