import http from 'node:http';
import { Pool } from 'pg';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual
} from 'node:crypto';

const PUBLIC_PORT = Number(process.env.PORT || 10000);
const INTERNAL_PORT = PUBLIC_PORT + 1;
const DATABASE_URL = process.env.DATABASE_URL || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CHECKOUT_URL = process.env.BATCH_OS_CHECKOUT_URL || '';
const FREE_BATCH_LIMIT = Number(process.env.BATCH_OS_FREE_BATCH_LIMIT || 5);
const FOUNDING_PRICE_USD = Number(process.env.BATCH_OS_FOUNDING_PRICE_USD || 19);
const REGULAR_PRICE_USD = Number(process.env.BATCH_OS_REGULAR_PRICE_USD || 29);
const WEBHOOK_TOLERANCE_SECONDS = 300;

if (!DATABASE_URL) throw new Error('DATABASE_URL is required for Batch OS access entitlements.');

const pool = new Pool({ connectionString: DATABASE_URL, max: 3, idleTimeoutMillis: 30000 });

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

async function ensureSchema() {
  await pool.query(`
    create table if not exists batch_entitlements (
      id uuid primary key,
      email text not null,
      user_id uuid null references batch_users(id) on delete set null,
      status text not null default 'active',
      access_tier text not null default 'founding',
      source text not null default 'stripe',
      source_ref text not null unique,
      amount_cents integer null,
      currency text null,
      purchased_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );
    create index if not exists batch_entitlements_email_idx on batch_entitlements(lower(email));
    create index if not exists batch_entitlements_user_idx on batch_entitlements(user_id, status);
  `);
}

async function currentUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const result = await pool.query(`
    select u.id, u.email
    from batch_sessions s
    join batch_users u on u.id = s.user_id
    where s.token_hash = $1 and s.expires_at > now()
    limit 1
  `, [hashToken(token)]);
  return result.rows[0] || null;
}

async function accessForUser(user) {
  if (!user) return { paid: false, tier: 'trial' };
  const result = await pool.query(`
    select access_tier, purchased_at
    from batch_entitlements
    where status = 'active'
      and (user_id = $1 or lower(email) = lower($2))
    order by purchased_at desc
    limit 1
  `, [user.id, user.email]);
  if (!result.rowCount) return { paid: false, tier: 'trial' };
  const row = result.rows[0];
  return { paid: true, tier: row.access_tier || 'founding', purchasedAt: row.purchased_at };
}

function readBuffer(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error('Request too large'));
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
  const expectedBuffer = Buffer.from(expected, 'hex');
  return signatures.some(signature => {
    try {
      const actual = Buffer.from(signature, 'hex');
      return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
    } catch {
      return false;
    }
  });
}

async function grantStripeEntitlement(session) {
  const metadata = session?.metadata || {};
  if (metadata.product && metadata.product !== 'batch_os') return;
  const email = String(session?.customer_details?.email || session?.customer_email || '').trim().toLowerCase();
  if (!email) throw new Error('Stripe Checkout session has no customer email.');
  const sessionId = String(session.id || '').trim();
  if (!sessionId) throw new Error('Stripe Checkout session has no id.');
  const amount = Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) : null;
  const currency = String(session.currency || 'usd').toLowerCase();
  const tier = String(metadata.access_tier || 'founding');

  await pool.query(`
    insert into batch_entitlements(
      id,email,user_id,status,access_tier,source,source_ref,amount_cents,currency,purchased_at
    )
    values(
      $1,$2,(select id from batch_users where lower(email)=lower($2) limit 1),
      'active',$3,'stripe',$4,$5,$6,now()
    )
    on conflict(source_ref) do update set
      email=excluded.email,
      user_id=coalesce(batch_entitlements.user_id, excluded.user_id),
      status='active',
      access_tier=excluded.access_tier,
      amount_cents=excluded.amount_cents,
      currency=excluded.currency
  `, [randomUUID(), email, tier, sessionId, amount, currency]);
}

async function handleWebhook(req, res) {
  const raw = await readBuffer(req);
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) {
    return send(res, 400, { error: 'Invalid Stripe signature' });
  }
  let event;
  try { event = JSON.parse(raw.toString('utf8')); }
  catch { return send(res, 400, { error: 'Invalid JSON' }); }

  const session = event?.data?.object;
  if (event.type === 'checkout.session.completed') {
    if (session?.payment_status === 'paid') await grantStripeEntitlement(session);
  } else if (event.type === 'checkout.session.async_payment_succeeded') {
    await grantStripeEntitlement(session);
  }
  return send(res, 200, { received: true });
}

async function handleAccess(req, res) {
  const user = await currentUser(req);
  const access = await accessForUser(user);
  return send(res, 200, {
    user: user ? { id: user.id, email: user.email } : null,
    ...access,
    freeBatchLimit: FREE_BATCH_LIMIT,
    foundingPriceUsd: FOUNDING_PRICE_USD,
    regularPriceUsd: REGULAR_PRICE_USD,
    checkoutUrl: CHECKOUT_URL || null
  });
}

function proxy(req, res) {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INTERNAL_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` }
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    console.error('Batch OS legacy proxy error:', error.message);
    if (!res.headersSent) send(res, 502, { error: 'Batch OS API unavailable' });
    else res.end();
  });
  req.pipe(upstream);
}

await ensureSchema();

process.env.PORT = String(INTERNAL_PORT);
await import('./server-v05.js');
process.env.PORT = String(PUBLIC_PORT);

const gateway = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const path = String(req.url || '').split('?')[0];
    if (req.method === 'POST' && path === '/api/stripe/webhook') return await handleWebhook(req, res);
    if (req.method === 'GET' && path === '/api/access') return await handleAccess(req, res);
    return proxy(req, res);
  } catch (error) {
    console.error('Batch OS access gateway error:', error);
    return send(res, 500, { error: 'Batch OS access error', message: 'Unexpected access service error.' });
  }
});

gateway.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`Batch OS access gateway 0.6.0-beta listening on ${PUBLIC_PORT}; legacy API on ${INTERNAL_PORT}`);
});
