import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const API = `http://127.0.0.1:${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL || '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${data.message || data.error || 'request failed'}`);
  return data;
}

async function waitForHealth() {
  let lastError;
  for (let i = 0; i < 20; i += 1) {
    try {
      const health = await request('/health');
      if (health.status === 'ok') return health;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw lastError || new Error('API did not become healthy');
}

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 1 }) : null;
const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const email = `batch-selftest-${suffix}@example.invalid`;
const password = `BatchTest-${randomBytes(12).toString('base64url')}`;

try {
  assert(pool, 'DATABASE_URL is missing');
  const health = await waitForHealth();
  assert(health.persistenceAvailable === true, 'Persistence is not available');

  const registration = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert(registration.token, 'Registration did not return a session token');
  assert(registration.user?.email === email, 'Registration user mismatch');

  const authHeaders = {
    'content-type': 'application/json',
    authorization: `Bearer ${registration.token}`
  };

  const me = await request('/api/auth/me', { headers: { authorization: authHeaders.authorization } });
  assert(me.user?.email === email, 'Authenticated user mismatch');

  const recipeInput = {
    name: 'Batch OS Self Test Daiquiri',
    category: 'Original',
    method: 'Shake',
    glass: 'Coupe',
    ice: 'None',
    garnish: 'Lime wheel',
    ingredients: [
      { amount: '2 oz', ingredient: 'White Rum' },
      { amount: '0.75 oz', ingredient: 'Lime Juice' },
      { amount: '0.75 oz', ingredient: 'Simple Syrup' }
    ]
  };

  const savedRecipeResponse = await request('/api/me/recipes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ recipe: recipeInput })
  });
  const savedRecipe = savedRecipeResponse.recipe;
  assert(savedRecipe?.id, 'Cloud recipe save did not return an ID');

  const recipes = await request('/api/me/recipes', { headers: { authorization: authHeaders.authorization } });
  assert(recipes.recipes?.some(recipe => recipe.id === savedRecipe.id), 'Saved recipe was not retrievable');

  const plan = await request('/api/custom/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipe: savedRecipe,
      plannedPours: 12,
      overagePct: 10,
      dilutionPct: 20,
      bottleSizeMl: 750,
      vesselSize: 12,
      vesselUnit: 'L',
      maxFillPct: 90
    })
  });
  assert(plan.summary?.plannedPours === 14, `Expected 14 pours including overage, got ${plan.summary?.plannedPours}`);
  assert(plan.ingredients?.length === 3, 'Batch calculation did not return all liquid ingredients');

  const savedBatch = await request('/api/me/batches', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ recipeId: savedRecipe.id, plan })
  });
  assert(savedBatch.id, 'Cloud batch save did not return an ID');

  const batches = await request('/api/me/batches?limit=10', { headers: { authorization: authHeaders.authorization } });
  assert(batches.batches?.some(batch => batch.id === savedBatch.id), 'Saved batch was not retrievable');

  await request('/api/auth/logout', {
    method: 'POST',
    headers: { authorization: authHeaders.authorization }
  });

  console.log('Batch OS cloud self-test passed: auth + recipes + calculation + batches + retrieval');
} catch (error) {
  console.error(`Batch OS cloud self-test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (pool) {
    try {
      await pool.query('delete from batch_users where email=$1', [email]);
    } catch (cleanupError) {
      console.error(`Batch OS self-test cleanup failed: ${cleanupError.message}`);
      process.exitCode = 1;
    }
    await pool.end();
  }
}
