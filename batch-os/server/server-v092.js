import http from 'node:http';
import { Pool } from 'pg';

const PUBLIC_PORT = Number(process.env.PORT || 10000);
const INNER_PORT = PUBLIC_PORT + 1;
const DATABASE_URL = process.env.DATABASE_URL || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.BATCH_OS_EMAIL_FROM || '';
const EMAIL_REPLY_TO = process.env.BATCH_OS_EMAIL_REPLY_TO || '';
const APP_URL = process.env.BATCH_OS_APP_URL || 'https://batch-os.com';
const FREE_BATCH_LIMIT = Number(process.env.BATCH_OS_FREE_BATCH_LIMIT || 5);
const FOUNDING_PRICE_USD = Number(process.env.BATCH_OS_FOUNDING_PRICE_USD || 19);
const REGULAR_PRICE_USD = Number(process.env.BATCH_OS_REGULAR_PRICE_USD || 29);

if (!DATABASE_URL) throw new Error('DATABASE_URL is required for Batch OS welcome-email retry service.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 2, idleTimeoutMillis: 30000 });

function welcomeMessage(email) {
  const offerUrl = `${APP_URL.replace(/\/$/, '')}/?upgrade=founding`;
  return {
    subject: `Your Batch OS account is ready — ${FREE_BATCH_LIMIT} free batches`,
    text: `Welcome to Batch OS.\n\nYour account includes ${FREE_BATCH_LIMIT} free completed batch calculations.\n\nFor a limited time, Founding Access is $${FOUNDING_PRICE_USD} one time (regular price $${REGULAR_PRICE_USD}). It unlocks unlimited calculations, cloud-saved recipes, batch history, and cross-device access.\n\nUnlock Founding Access: ${offerUrl}\n\nYou're receiving this service message because ${email} was used to create a Batch OS account.`,
    html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#18181B;line-height:1.55;background:#fff;margin:0;padding:0"><div style="max-width:560px;margin:0 auto;padding:36px 24px"><div style="font-weight:800;font-size:20px;margin-bottom:30px">Batch OS</div><h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">Your Batch OS account is ready.</h1><p style="margin:0 0 18px">You now have <strong>${FREE_BATCH_LIMIT} free completed batch calculations</strong>.</p><p style="margin:0 0 22px">For a limited time, Founding Access is <strong>$${FOUNDING_PRICE_USD} one time</strong> (regularly $${REGULAR_PRICE_USD}). It unlocks unlimited calculations, cloud-saved recipes, batch history, and cross-device access.</p><p style="margin:28px 0"><a href="${offerUrl}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:8px">Unlock Founding Access — $${FOUNDING_PRICE_USD}</a></p><p style="font-size:12px;color:#71717A;margin-top:34px">You're receiving this service message because ${email} was used to create a Batch OS account.</p></div></body></html>`
  };
}

async function sendWelcome(user) {
  if (!RESEND_API_KEY || !EMAIL_FROM) return false;
  const message = welcomeMessage(user.email);
  const payload = {
    from: EMAIL_FROM,
    to: [user.email],
    subject: message.subject,
    html: message.html,
    text: message.text
  };
  if (EMAIL_REPLY_TO) payload.reply_to = EMAIL_REPLY_TO;

  await pool.query(`update batch_users set welcome_email_status='retrying' where id=$1 and welcome_email_sent_at is null`, [user.id]);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    await pool.query(`update batch_users set welcome_email_status='failed' where id=$1 and welcome_email_sent_at is null`, [user.id]);
    throw new Error(`Resend welcome retry failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  await pool.query(`update batch_users set welcome_email_sent_at=now(), welcome_email_status='sent' where id=$1`, [user.id]);
  return true;
}

let retryRunning = false;
async function retryPendingWelcomeEmails() {
  if (retryRunning) return;
  retryRunning = true;
  try {
    if (!RESEND_API_KEY || !EMAIL_FROM) {
      await pool.query(`
        update batch_users
        set welcome_email_status='pending_configuration'
        where welcome_email_sent_at is null
          and created_at >= now() - interval '30 days'
          and (welcome_email_status is null or welcome_email_status in ('not_configured','failed','pending_configuration'))
      `);
      return;
    }

    const result = await pool.query(`
      select id,email
      from batch_users
      where welcome_email_sent_at is null
        and created_at >= now() - interval '30 days'
        and created_at < now() - interval '30 seconds'
        and (welcome_email_status is null or welcome_email_status in ('not_configured','failed','pending_configuration'))
      order by created_at asc
      limit 25
    `);

    let sent = 0;
    for (const user of result.rows) {
      try {
        if (await sendWelcome(user)) sent += 1;
      } catch (error) {
        console.error('Batch OS welcome retry error:', error.message);
      }
    }
    if (result.rowCount) console.log(`Batch OS welcome retry processed=${result.rowCount}; sent=${sent}`);
  } finally {
    retryRunning = false;
  }
}

process.env.PORT = String(INNER_PORT);
await import('./server-v09.js');
process.env.PORT = String(PUBLIC_PORT);

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `127.0.0.1:${INNER_PORT}` };
  delete headers.connection;
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INNER_PORT,
    path: req.url,
    method: req.method,
    headers
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    console.error('Batch OS v0.9.2 proxy error:', error.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Batch OS gateway unavailable' }));
  });
  req.pipe(upstream);
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`Batch OS retry gateway 0.9.2-beta listening on ${PUBLIC_PORT}; messaging gateway on ${INNER_PORT}; resend=${RESEND_API_KEY && EMAIL_FROM ? 'configured' : 'pending'}`);
  void retryPendingWelcomeEmails().catch(error => console.error('Batch OS welcome retry startup error:', error.message));
});

setInterval(() => {
  void retryPendingWelcomeEmails().catch(error => console.error('Batch OS welcome retry interval error:', error.message));
}, 5 * 60 * 1000).unref();
