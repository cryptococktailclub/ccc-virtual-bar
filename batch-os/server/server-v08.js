import http from 'node:http';
import { Pool } from 'pg';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual
} from 'node:crypto';

const PUBLIC_PORT = Number(process.env.PORT || 10000);
const INNER_PORT = PUBLIC_PORT + 1;
const DATABASE_URL = process.env.DATABASE_URL || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CHECKOUT_URL = process.env.BATCH_OS_CHECKOUT_URL || '';
const CHECKOUT_SIGNING_SECRET = process.env.BATCH_OS_CHECKOUT_SIGNING_SECRET || '';
const ALLOW_EMAIL_FALLBACK = String(process.env.BATCH_OS_ALLOW_EMAIL_FALLBACK || 'true').toLowerCase() === 'true';
const FREE_BATCH_LIMIT = Number(process.env.BATCH_OS_FREE_BATCH_LIMIT || 5);
const FOUNDING_PRICE_USD = Number(process.env.BATCH_OS_FOUNDING_PRICE_USD || 19);
const REGULAR_PRICE_USD = Number(process.env.BATCH_OS_REGULAR_PRICE_USD || 29);
const WEBHOOK_TOLERANCE_SECONDS = 300;

if (!DATABASE_URL) throw new Error('DATABASE_URL is required for Batch OS.');

const pool = new Pool({ connectionString: DATABASE_URL, max: 4, idleTimeoutMillis: 30000 });

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  };
}

function send(res, status, data) {
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function bearerToken(req) {
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function currentUser(req, db = pool) {
  const token = bearerToken(req);
  if (!token) return null;
  const result = await db.query(`
    select u.id, u.email
    from batch_sessions s
    join batch_users u on u.id = s.user_id
    where s.token_hash=$1 and s.expires_at > now()
    limit 1
  `, [hashToken(token)]);
  return result.rows[0] || null;
}

async function accessForUser(user, db = pool) {
  if (!user) return { paid: false, tier: 'trial' };
  const result = await db.query(`
    select access_tier, purchased_at
    from batch_entitlements
    where status='active'
      and (user_id=$1 or lower(email)=lower($2))
    order by purchased_at desc
    limit 1
  `, [user.id, user.email]);
  if (!result.rowCount) return { paid: false, tier: 'trial' };
  return {
    paid: true,
    tier: result.rows[0].access_tier || 'founding',
    purchasedAt: result.rows[0].purchased_at
  };
}

async function usageForUser(user, db = pool) {
  if (!user) return { freeBatchesUsed: 0, freeBatchesRemaining: FREE_BATCH_LIMIT };
  await db.query(`
    insert into batch_usage(user_id, free_batches_used)
    values($1,0)
    on conflict(user_id) do nothing
  `, [user.id]);
  const result = await db.query('select free_batches_used from batch_usage where user_id=$1', [user.id]);
  const used = Math.max(0, Number(result.rows[0]?.free_batches_used || 0));
  return {
    freeBatchesUsed: used,
    freeBatchesRemaining: Math.max(0, FREE_BATCH_LIMIT - used)
  };
}

function createCheckoutReference(user) {
  if (!CHECKOUT_SIGNING_SECRET) throw new Error('Checkout signing is not configured.');
  const email = String(user.email || '').trim().toLowerCase();
  const signature = createHmac('sha256', CHECKOUT_SIGNING_SECRET)
    .update(`${user.id}|${email}`)
    .digest('hex');
  return `u1_${user.id}_${signature}`;
}

function safeHexEqual(actualHex, expectedHex) {
  try {
    const actual = Buffer.from(actualHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && actual.length > 0 && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function verifyCheckoutReference(reference) {
  const match = String(reference || '').match(/^u1_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([0-9a-f]{64})$/i);
  if (!match || !CHECKOUT_SIGNING_SECRET) return null;
  const userId = match[1].toLowerCase();
  const suppliedSignature = match[2].toLowerCase();
  const result = await pool.query('select id,email from batch_users where id=$1 limit 1', [userId]);
  const user = result.rows[0];
  if (!user) return null;
  const email = String(user.email || '').trim().toLowerCase();
  const expectedSignature = createHmac('sha256', CHECKOUT_SIGNING_SECRET)
    .update(`${user.id}|${email}`)
    .digest('hex');
  return safeHexEqual(suppliedSignature, expectedSignature) ? user : null;
}

function readBuffer(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(Object.assign(new Error('Request too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyStripeSignature(payload, header) {
  if (!STRIPE_WEBHOOK_SECRET) return false;
  const values = String(header || '').split(',').map(part => part.trim());
  const timestampPart = values.find(part => part.startsWith('t='));
  const signatures = values.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  if (!timestampPart || !signatures.length) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload.toString('utf8')}`)
    .digest('hex');
  return signatures.some(signature => safeHexEqual(signature, expected));
}

async function resolveStripeUser(session, email) {
  const reference = String(session?.client_reference_id || '').trim();
  if (reference) {
    const user = await verifyCheckoutReference(reference);
    if (!user) throw new Error('Stripe Checkout has an invalid Batch OS account reference.');
    if (String(user.email).trim().toLowerCase() !== email) {
      throw new Error('Stripe Checkout email does not match the referenced Batch OS account.');
    }
    return { user, binding: 'signed_reference' };
  }

  if (!ALLOW_EMAIL_FALLBACK) {
    throw new Error('Stripe Checkout is missing the required Batch OS account reference.');
  }

  const result = await pool.query('select id,email from batch_users where lower(email)=lower($1) limit 1', [email]);
  if (!result.rowCount) throw new Error('No Batch OS account matches the Stripe customer email.');
  return { user: result.rows[0], binding: 'email_fallback' };
}

async function grantStripeEntitlement(session) {
  const metadata = session?.metadata || {};
  if (metadata.product && metadata.product !== 'batch_os') return { ignored: true };
  const email = String(session?.customer_details?.email || session?.customer_email || '').trim().toLowerCase();
  if (!email) throw new Error('Stripe Checkout session has no customer email.');
  const sessionId = String(session?.id || '').trim();
  if (!sessionId) throw new Error('Stripe Checkout session has no id.');

  const { user, binding } = await resolveStripeUser(session, email);
  const amount = Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) : null;
  const currency = String(session.currency || 'usd').toLowerCase();
  const tier = String(metadata.access_tier || 'founding');

  await pool.query(`
    insert into batch_entitlements(
      id,email,user_id,status,access_tier,source,source_ref,amount_cents,currency,purchased_at,identity_binding
    )
    values($1,$2,$3,'active',$4,'stripe',$5,$6,$7,now(),$8)
    on conflict(source_ref) do update set
      email=excluded.email,
      user_id=excluded.user_id,
      status='active',
      access_tier=excluded.access_tier,
      amount_cents=excluded.amount_cents,
      currency=excluded.currency,
      identity_binding=excluded.identity_binding
  `, [randomUUID(), email, user.id, tier, sessionId, amount, currency, binding]);

  return { userId: user.id, binding };
}

async function handleWebhook(req, res) {
  const raw = await readBuffer(req);
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) {
    return send(res, 400, { error: 'Invalid Stripe signature' });
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return send(res, 400, { error: 'Invalid JSON' });
  }

  const session = event?.data?.object;
  if (event.type === 'checkout.session.completed' && session?.payment_status === 'paid') {
    await grantStripeEntitlement(session);
  } else if (event.type === 'checkout.session.async_payment_succeeded') {
    await grantStripeEntitlement(session);
  }

  return send(res, 200, { received: true });
}

async function handleCheckoutLink(req, res) {
  const user = await currentUser(req);
  if (!user) {
    return send(res, 401, {
      error: 'Sign in required',
      code: 'batch_account_required',
      message: 'Sign in to your Batch OS account before starting checkout.'
    });
  }

  const access = await accessForUser(user);
  if (access.paid) {
    return send(res, 409, {
      error: 'Already unlocked',
      code: 'already_unlocked',
      message: 'Batch OS is already unlocked on this account.'
    });
  }

  if (!CHECKOUT_URL || !CHECKOUT_SIGNING_SECRET) {
    return send(res, 503, {
      error: 'Checkout unavailable',
      code: 'checkout_unavailable',
      message: 'Checkout is temporarily unavailable. Please try again shortly.'
    });
  }

  const checkout = new URL(CHECKOUT_URL);
  checkout.searchParams.set('client_reference_id', createCheckoutReference(user));
  checkout.searchParams.set('prefilled_email', String(user.email).trim().toLowerCase());

  return send(res, 200, {
    checkoutUrl: checkout.toString(),
    identityBinding: 'signed_reference'
  });
}

async function handleAccess(req, res) {
  const user = await currentUser(req);
  const access = await accessForUser(user);
  const usage = await usageForUser(user);
  return send(res, 200, {
    user: user ? { id: user.id, email: user.email } : null,
    ...access,
    ...usage,
    requiresAccountForCalculation: true,
    freeBatchLimit: FREE_BATCH_LIMIT,
    foundingPriceUsd: FOUNDING_PRICE_USD,
    regularPriceUsd: REGULAR_PRICE_USD,
    checkoutAvailable: Boolean(CHECKOUT_URL && CHECKOUT_SIGNING_SECRET),
    checkoutIdentity: 'signed_reference'
  });
}

function proxy(req, res) {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INNER_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${INNER_PORT}` }
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    console.error('Batch OS inner API proxy error:', error.message);
    if (!res.headersSent) send(res, 502, { error: 'Batch OS API unavailable' });
    else res.end();
  });
  req.pipe(upstream);
}

// Start the established account/trial gateway one port behind this hardened checkout gateway.
process.env.PORT = String(INNER_PORT);
await import('./server-v071.js');
process.env.PORT = String(PUBLIC_PORT);

await pool.query(`
  alter table batch_entitlements
    add column if not exists identity_binding text not null default 'email';
`);

const gateway = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const path = String(req.url || '').split('?')[0];
    if (req.method === 'POST' && path === '/api/stripe/webhook') return await handleWebhook(req, res);
    if (req.method === 'GET' && path === '/api/checkout-link') return await handleCheckoutLink(req, res);
    if (req.method === 'GET' && path === '/api/access') return await handleAccess(req, res);
    return proxy(req, res);
  } catch (error) {
    console.error('Batch OS secure checkout gateway error:', error);
    return send(res, error.statusCode || 500, {
      error: 'Batch OS checkout error',
      message: error.statusCode ? error.message : 'Unexpected checkout service error.'
    });
  }
});

gateway.listen(PUBLIC_PORT, '0.0.0.0', async () => {
  console.log(`Batch OS secure checkout gateway 0.8.0-beta listening on ${PUBLIC_PORT}; access gateway on ${INNER_PORT}; checkout-binding=signed-reference`);
  if (String(process.env.BATCH_OS_RUN_STARTUP_SELFTEST || '0') === '1') {
    try {
      const { runBatchOsSelftest } = await import('./selftest-v08.js');
      await runBatchOsSelftest({ port: PUBLIC_PORT });
    } catch (error) {
      console.error(`Batch OS production self-test failed: ${error.message}`);
    }
  }
});
