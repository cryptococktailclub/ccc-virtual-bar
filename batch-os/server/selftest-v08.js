import { Pool } from 'pg';
import { createHmac, randomBytes } from 'node:crypto';

const DATABASE_URL = process.env.DATABASE_URL || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(base, path, options = {}, expected = [200, 201]) {
  const response = await fetch(`${base}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!expected.includes(response.status)) {
    throw new Error(`${path} -> HTTP ${response.status}: ${data.message || data.error || 'request failed'}`);
  }
  return { response, data };
}

export async function runBatchOsSelftest({ port = Number(process.env.PORT || 10000) } = {}) {
  assert(DATABASE_URL, 'DATABASE_URL is missing');
  assert(STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET is missing');

  const base = `http://127.0.0.1:${port}`;
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  const suffix = `${Date.now()}-${randomBytes(5).toString('hex')}`;
  const email = `batch-v08-selftest-${suffix}@example.invalid`;
  const password = `BatchTest-${randomBytes(16).toString('base64url')}`;
  let stripeSessionId = '';

  try {
    const health = await request(base, '/health');
    assert(health.data.status === 'ok', 'Health check did not return ok');
    assert(health.data.persistenceAvailable === true, 'Persistence is not available');

    const registration = await request(base, '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const token = registration.data.token;
    assert(token, 'Registration did not return a session token');

    const auth = { authorization: `Bearer ${token}` };
    const authJson = { ...auth, 'content-type': 'application/json' };

    const firstAccess = await request(base, '/api/access', { headers: auth });
    assert(firstAccess.data.paid === false, 'Fresh account unexpectedly has paid access');
    assert(firstAccess.data.freeBatchesUsed === 0, 'Fresh account should start at 0 free batches used');
    assert(firstAccess.data.freeBatchesRemaining === 5, 'Fresh account should start with 5 free batches');
    assert(!('checkoutUrl' in firstAccess.data), 'Base Stripe checkout URL should not be exposed by /api/access');
    assert(firstAccess.data.checkoutIdentity === 'signed_reference', 'Secure checkout identity mode is not active');

    const checkout = await request(base, '/api/checkout-link', { headers: auth });
    const checkoutUrl = new URL(checkout.data.checkoutUrl);
    const clientReference = checkoutUrl.searchParams.get('client_reference_id') || '';
    assert(/^[A-Za-z0-9_-]{1,200}$/.test(clientReference), 'Checkout client reference is invalid for Stripe Payment Links');
    assert(checkoutUrl.searchParams.get('prefilled_email') === email, 'Checkout did not prefill the Batch OS account email');
    assert(checkout.data.identityBinding === 'signed_reference', 'Checkout did not report signed identity binding');

    const recipe = {
      name: 'Batch OS Production Self Test Daiquiri',
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

    const batchBody = JSON.stringify({
      recipe,
      plannedPours: 12,
      overagePct: 10,
      dilutionPct: 20,
      bottleSizeMl: 750,
      vesselSize: 12,
      vesselUnit: 'L',
      maxFillPct: 90
    });

    for (let i = 1; i <= 5; i += 1) {
      const calculation = await request(base, '/api/custom/batch', {
        method: 'POST',
        headers: authJson,
        body: batchBody
      });
      assert(calculation.data.summary?.plannedPours === 14, `Trial calculation ${i} returned unexpected planned pours`);
      const access = await request(base, '/api/access', { headers: auth });
      assert(access.data.freeBatchesUsed === i, `Expected ${i} free batches used, got ${access.data.freeBatchesUsed}`);
      assert(access.data.freeBatchesRemaining === 5 - i, `Expected ${5 - i} free batches remaining`);
    }

    await request(base, '/api/custom/batch', {
      method: 'POST',
      headers: authJson,
      body: batchBody
    }, [402]);

    const exhausted = await request(base, '/api/access', { headers: auth });
    assert(exhausted.data.freeBatchesUsed === 5, 'Blocked sixth calculation changed the free-use counter');
    assert(exhausted.data.freeBatchesRemaining === 0, 'Exhausted trial should report zero free batches remaining');

    stripeSessionId = `cs_selftest_${suffix.replace(/[^A-Za-z0-9]/g, '')}`;
    const event = {
      id: `evt_selftest_${suffix.replace(/[^A-Za-z0-9]/g, '')}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: stripeSessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          amount_total: 1900,
          currency: 'usd',
          client_reference_id: clientReference,
          customer_details: { email },
          metadata: {
            product: 'batch_os',
            access_tier: 'founding',
            entitlement: 'permanent'
          }
        }
      }
    };

    const payload = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    await request(base, '/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${timestamp},v1=${signature}`
      },
      body: payload
    });

    const paid = await request(base, '/api/access', { headers: auth });
    assert(paid.data.paid === true, 'Webhook did not grant paid entitlement');
    assert(paid.data.tier === 'founding', 'Webhook granted the wrong access tier');
    assert(paid.data.freeBatchesUsed === 5, 'Granting paid access changed historical trial usage');

    const entitlement = await pool.query(`
      select identity_binding, user_id, status
      from batch_entitlements
      where source_ref=$1
      limit 1
    `, [stripeSessionId]);
    assert(entitlement.rowCount === 1, 'Stripe entitlement row was not persisted');
    assert(entitlement.rows[0].identity_binding === 'signed_reference', 'Stripe entitlement did not use signed user binding');
    assert(entitlement.rows[0].status === 'active', 'Stripe entitlement is not active');

    await request(base, '/api/custom/batch', {
      method: 'POST',
      headers: authJson,
      body: batchBody
    });

    const afterPaidCalculation = await request(base, '/api/access', { headers: auth });
    assert(afterPaidCalculation.data.freeBatchesUsed === 5, 'Paid calculation consumed an additional free use');

    console.log('Batch OS production self-test passed: auth + signed checkout identity + 5-use server meter + sixth-use block + webhook entitlement + paid bypass');
    return true;
  } finally {
    try {
      if (stripeSessionId) await pool.query('delete from batch_entitlements where source_ref=$1', [stripeSessionId]);
      await pool.query('delete from batch_users where email=$1', [email]);
    } catch (cleanupError) {
      console.error(`Batch OS v0.8 self-test cleanup failed: ${cleanupError.message}`);
    }
    await pool.end();
  }
}
