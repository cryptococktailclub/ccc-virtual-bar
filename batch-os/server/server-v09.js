import http from 'node:http';
import { Pool } from 'pg';

const PUBLIC_PORT = Number(process.env.PORT || 10000);
const INNER_PORT = PUBLIC_PORT + 1;
const DATABASE_URL = process.env.DATABASE_URL || '';
const FREE_BATCH_LIMIT = Number(process.env.BATCH_OS_FREE_BATCH_LIMIT || 5);
const FOUNDING_PRICE_USD = Number(process.env.BATCH_OS_FOUNDING_PRICE_USD || 19);
const REGULAR_PRICE_USD = Number(process.env.BATCH_OS_REGULAR_PRICE_USD || 29);
const APP_URL = process.env.BATCH_OS_APP_URL || 'https://batch-os-web-beta-5kfu.onrender.com';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.BATCH_OS_EMAIL_FROM || '';
const EMAIL_REPLY_TO = process.env.BATCH_OS_EMAIL_REPLY_TO || '';

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY || '';
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID || '';
const BEEHIIV_NEWSLETTER_LIST_ID = process.env.BEEHIIV_NEWSLETTER_LIST_ID || '';

if (!DATABASE_URL) throw new Error('DATABASE_URL is required for Batch OS account messaging.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 3, idleTimeoutMillis: 30000 });

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

function proxyRequest(req, body = null) {
  return new Promise((resolve, reject) => {
    const headers = { ...req.headers, host: `127.0.0.1:${INNER_PORT}` };
    delete headers.connection;
    delete headers['transfer-encoding'];
    if (body !== null) headers['content-length'] = String(body.length);
    else delete headers['content-length'];

    const upstream = http.request({
      hostname: '127.0.0.1',
      port: INNER_PORT,
      path: req.url,
      method: req.method,
      headers
    }, upstreamRes => {
      const chunks = [];
      upstreamRes.on('data', chunk => chunks.push(chunk));
      upstreamRes.on('end', () => resolve({
        statusCode: upstreamRes.statusCode || 502,
        headers: upstreamRes.headers,
        body: Buffer.concat(chunks)
      }));
    });
    upstream.on('error', reject);
    if (body?.length) upstream.write(body);
    upstream.end();
  });
}

function sendUpstream(res, upstream) {
  const headers = { ...upstream.headers };
  delete headers['content-length'];
  res.writeHead(upstream.statusCode, headers);
  res.end(upstream.body);
}

async function ensureMessagingSchema() {
  await pool.query(`
    alter table batch_users add column if not exists ccc_newsletter_opt_in boolean not null default false;
    alter table batch_users add column if not exists ccc_newsletter_opt_in_at timestamptz null;
    alter table batch_users add column if not exists ccc_newsletter_source text null;
    alter table batch_users add column if not exists beehiiv_sync_status text null;
    alter table batch_users add column if not exists welcome_email_sent_at timestamptz null;
    alter table batch_users add column if not exists welcome_email_status text null;
  `);
}

function welcomeText(email) {
  const offerUrl = `${APP_URL.replace(/\/$/, '')}/?upgrade=founding`;
  return {
    subject: `Your Batch OS account is ready — ${FREE_BATCH_LIMIT} free batches`,
    text: `Welcome to Batch OS.\n\nYour account is open and includes ${FREE_BATCH_LIMIT} free completed batch calculations.\n\nFounding Access is currently $${FOUNDING_PRICE_USD} one time (regular price $${REGULAR_PRICE_USD}) and unlocks unlimited calculations, cloud-saved recipes, batch history, and cross-device access.\n\nUnlock Founding Access: ${offerUrl}\n\nYou're receiving this service message because ${email} was used to create a Batch OS account.`,
    html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#18181B;line-height:1.55;background:#fff;margin:0;padding:0"><div style="max-width:560px;margin:0 auto;padding:36px 24px"><div style="font-weight:800;font-size:20px;margin-bottom:30px">Batch OS</div><h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">Your Batch OS account is ready.</h1><p style="margin:0 0 18px">You now have <strong>${FREE_BATCH_LIMIT} free completed batch calculations</strong> to put Batch OS through a real service workflow.</p><p style="margin:0 0 22px">For a limited time, Founding Access is <strong>$${FOUNDING_PRICE_USD} one time</strong> (regularly $${REGULAR_PRICE_USD}). It unlocks unlimited calculations, cloud-saved recipes, batch history, and cross-device access.</p><p style="margin:28px 0"><a href="${offerUrl}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:8px">Unlock Founding Access — $${FOUNDING_PRICE_USD}</a></p><p style="font-size:12px;color:#71717A;margin-top:34px">You're receiving this service message because ${email} was used to create a Batch OS account.</p></div></body></html>`
  };
}

async function sendWelcomeEmail(userId, email) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    await pool.query(`update batch_users set welcome_email_status='not_configured' where id=$1`, [userId]);
    return;
  }
  const message = welcomeText(email);
  const payload = {
    from: EMAIL_FROM,
    to: [email],
    subject: message.subject,
    html: message.html,
    text: message.text
  };
  if (EMAIL_REPLY_TO) payload.reply_to = EMAIL_REPLY_TO;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    await pool.query(`update batch_users set welcome_email_status='failed' where id=$1`, [userId]);
    throw new Error(`Resend welcome email failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  await pool.query(`update batch_users set welcome_email_sent_at=now(), welcome_email_status='sent' where id=$1`, [userId]);
}

async function syncBeehiiv(userId, email) {
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
    await pool.query(`update batch_users set beehiiv_sync_status='not_configured' where id=$1`, [userId]);
    return;
  }
  const body = {
    email,
    reactivate_existing: false,
    send_welcome_email: false,
    double_opt_override: 'on',
    utm_source: 'batch_os',
    utm_medium: 'account_signup',
    utm_campaign: 'batch_os_to_ccc',
    referring_site: APP_URL
  };
  if (BEEHIIV_NEWSLETTER_LIST_ID) body.newsletter_list_ids = [BEEHIIV_NEWSLETTER_LIST_ID];
  const response = await fetch(`https://api.beehiiv.com/v2/publications/${encodeURIComponent(BEEHIIV_PUBLICATION_ID)}/subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    await pool.query(`update batch_users set beehiiv_sync_status='failed' where id=$1`, [userId]);
    throw new Error(`Beehiiv sync failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  await pool.query(`update batch_users set beehiiv_sync_status='pending_double_opt_in' where id=$1`, [userId]);
}

async function postRegistration(body, responseData) {
  const userId = responseData?.user?.id;
  const email = String(responseData?.user?.email || body?.email || '').trim().toLowerCase();
  if (!userId || !email) return;
  const optIn = body?.cccNewsletterOptIn === true;
  await pool.query(`
    update batch_users
    set ccc_newsletter_opt_in=$2,
        ccc_newsletter_opt_in_at=case when $2 then now() else null end,
        ccc_newsletter_source=case when $2 then 'batch_os_signup' else null end
    where id=$1
  `, [userId, optIn]);

  const tasks = [sendWelcomeEmail(userId, email)];
  if (optIn) tasks.push(syncBeehiiv(userId, email));
  const results = await Promise.allSettled(tasks);
  results.forEach(result => {
    if (result.status === 'rejected') console.error('Batch OS post-registration messaging error:', result.reason?.message || result.reason);
  });
}

await ensureMessagingSchema();
process.env.PORT = String(INNER_PORT);
await import('./server-v08.js');
process.env.PORT = String(PUBLIC_PORT);

const server = http.createServer(async (req, res) => {
  try {
    const path = String(req.url || '').split('?')[0];
    if (req.method === 'POST' && path === '/api/auth/register') {
      const raw = await readBuffer(req);
      let body = {};
      try { body = JSON.parse(raw.toString('utf8') || '{}'); } catch {}
      const upstream = await proxyRequest(req, raw);
      sendUpstream(res, upstream);
      if (upstream.statusCode >= 200 && upstream.statusCode < 300) {
        let data = {};
        try { data = JSON.parse(upstream.body.toString('utf8')); } catch {}
        void postRegistration(body, data).catch(error => console.error('Batch OS registration follow-up failed:', error.message));
      }
      return;
    }

    const raw = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '') ? await readBuffer(req) : null;
    const upstream = await proxyRequest(req, raw);
    return sendUpstream(res, upstream);
  } catch (error) {
    console.error('Batch OS messaging gateway error:', error);
    if (!res.headersSent) {
      res.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Batch OS messaging error', message: error.statusCode ? error.message : 'Unexpected messaging service error.' }));
    } else res.end();
  }
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`Batch OS messaging gateway 0.9.1-beta listening on ${PUBLIC_PORT}; app gateway on ${INNER_PORT}; welcome=${RESEND_API_KEY && EMAIL_FROM ? 'configured' : 'pending'}; ccc-beehiiv=${BEEHIIV_API_KEY && BEEHIIV_PUBLICATION_ID ? 'configured' : 'pending'}`);
});
