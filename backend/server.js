const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'subtrimmer-dev-secret-change-in-production';
if (JWT_SECRET === 'subtrimmer-dev-secret-change-in-production') {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not set. Refusing to run in production with the default dev secret — anyone could forge auth tokens.');
    process.exit(1);
  }
  console.warn('WARNING: JWT_SECRET is using the default dev value. Set a strong secret in your environment variables before going to production.');
}

console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set. Set it to your PostgreSQL connection string.');
  process.exit(1);
}
if (!process.env.CRON_SECRET) {
  console.warn('WARNING: CRON_SECRET is not set. Email reminder cron endpoint will reject all requests.');
}
if (!process.env.REVENUECAT_WEBHOOK_SECRET) {
  console.warn('WARNING: REVENUECAT_WEBHOOK_SECRET is not set. The RevenueCat webhook endpoint will reject all requests.');
}
if (!process.env.REVENUECAT_SECRET_API_KEY) {
  console.warn('WARNING: REVENUECAT_SECRET_API_KEY is not set. /api/auth/verify-premium will trust the client-reported premium status instead of verifying it against RevenueCat — set this before going to production.');
}
if (!process.env.GOOGLE_CLIENT_IDS) {
  console.warn('WARNING: GOOGLE_CLIENT_IDS is not set. /api/auth/google will reject all requests until it is set to a comma-separated list of your Android/iOS/Web Google OAuth client IDs.');
}

app.use(cors());

// Plain server-rendered HTML so Play Console's "must link directly to the
// policy text, no extra navigation" check passes — the in-app screen at
// app/privacy-policy.tsx is the source of truth; keep this in sync with it.
const PRIVACY_POLICY_SECTIONS = [
  { title: '1. Who We Are', body: 'Trimio is operated by Ismael Naranjo, based in Vienna, Austria, who acts as the data controller under the General Data Protection Regulation (GDPR). You can reach us at Trimio@subtrimio.com.' },
  { title: '2. Information We Collect', body: "We collect only what's necessary to operate Trimio: account information (email address, encrypted password, account creation date, and account identifier — passwords are hashed using bcrypt and never stored in plain text); the subscription data you manually enter (service name, billing amount and currency, billing cycle, renewal date, and category); premium subscription information from RevenueCat (subscription status, purchase and expiration dates, premium entitlement status, and anonymous customer identifiers — we never receive or store your payment card details, as all payments are processed by Google Play Billing); and device and diagnostic information (device model, OS version, app version, crash reports, and anonymous performance metrics) to help us maintain and improve the Service." },
  { title: '3. How We Use Your Information', body: 'We use your information to create and manage your account, authenticate your identity, deliver the core subscription tracking features, verify active Premium subscriptions, send renewal reminder emails and notifications where enabled, improve application performance and stability, detect and prevent fraud or abuse, respond to support requests, and comply with legal obligations. We do not sell your personal information and do not use it for advertising purposes.' },
  { title: '4. Legal Basis for Processing (GDPR)', body: 'Account creation and authentication, storing the subscription data you enter, and verifying Premium subscription status are necessary for the performance of a contract (Art. 6(1)(b) GDPR). Sending renewal reminder emails relies on your consent (Art. 6(1)(a) GDPR), which you may withdraw at any time without affecting the lawfulness of prior processing. Crash reporting, diagnostics, and fraud prevention rely on our legitimate interest in maintaining a stable and secure service (Art. 6(1)(f) GDPR). Any processing required to comply with legal obligations relies on Art. 6(1)(c) GDPR.' },
  { title: '5. Third-Party Service Providers', body: 'Trimio uses a small number of trusted providers to operate the Service, each bound by appropriate data processing agreements: Railway (cloud hosting infrastructure, United States), RevenueCat (subscription management, United States), Google Play Billing (payment processing, United States), Sentry (crash reporting and diagnostics, United States), and Brevo/Sendinblue (transactional and reminder emails, European Union).' },
  { title: '6. International Data Transfers', body: 'Some of our service providers are located in the United States. When your personal data is transferred outside the European Economic Area (EEA), we ensure appropriate safeguards are in place in accordance with GDPR Chapter V — for transfers to US-based providers (Railway, RevenueCat, Google, Sentry) we rely on Standard Contractual Clauses (SCCs) approved by the European Commission, or an equivalent transfer mechanism where applicable.' },
  { title: '7. Payments', body: 'All purchases are handled by Google Play Billing, and subscription validation is performed using RevenueCat. Trimio never has access to your credit or debit card details, bank account information, or any other payment credentials.' },
  { title: '8. Data Security', body: 'We implement appropriate technical and organizational safeguards, including HTTPS encrypted communication, secure password hashing (bcrypt), restricted server access, secure cloud infrastructure (Railway), regular software updates, and access controls to protect personal information. No online service can guarantee absolute security — if you become aware of any security concern, contact us immediately at Trimio@subtrimio.com.' },
  { title: '9. Data Retention', body: 'We retain personal information only for as long as necessary to provide the Service, maintain your account, fulfill contractual obligations, comply with applicable laws, resolve disputes, and prevent fraud. When you delete your account, your personal information is permanently deleted within 30 days, unless a longer retention period is required by applicable law.' },
  { title: '10. Account Deletion', body: 'You may permanently delete your account at any time through the Account Settings screen inside the app. If you cannot access your account, contact us at Trimio@subtrimio.com. Once processed, your personal information will be permanently deleted within 30 days unless legal obligations require otherwise.' },
  { title: '11. Your Privacy Rights', body: 'Under the GDPR, you have the right to access a copy of the personal information we hold about you, rectify inaccurate or incomplete information, request erasure of your personal information, restrict how we process your information, object to processing based on legitimate interests, receive your data in a structured, commonly used, machine-readable format (available to all users regardless of subscription tier), and withdraw consent at any time where processing is based on consent. To exercise any of these rights, contact us at Trimio@subtrimio.com — we aim to respond within the timeframe required by applicable law, generally within 30 days.' },
  { title: '12. Right to Lodge a Complaint', body: 'If you believe we have not handled your personal information in accordance with applicable law, you have the right to lodge a complaint with the competent supervisory authority. For users in Austria, this is the Österreichische Datenschutzbehörde (DSB), Barichgasse 40-42, 1030 Vienna, Austria (www.dsb.gv.at, dsb@dsb.gv.at). We encourage you to contact us first so we can address your concern directly.' },
  { title: '13. Data Sharing', body: 'We do not sell, rent, lease, or trade your personal information. We share information only when necessary to operate the Service through our listed providers, process Premium subscriptions, provide customer support, detect fraud or abuse, comply with legal obligations, or protect the rights, safety, and security of our users or our business.' },
  { title: "14. Children's Privacy", body: 'Trimio is not intended for children under the age of 14. In accordance with Article 8 of the GDPR as implemented under Austrian law, we do not knowingly collect personal information from children under 14 without verifiable parental consent. If we become aware that personal information has been collected from a child under 14 without appropriate consent, we will promptly delete that information.' },
  { title: '15. Cookies and Analytics', body: 'Trimio does not use advertising cookies or advertising identifiers. We may collect anonymous diagnostic and performance data to improve application stability and user experience; this data cannot be used to identify you individually.' },
  { title: '16. Business Transfers', body: 'If Trimio is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. Any successor will remain bound by the commitments in this Privacy Policy.' },
  { title: '17. Changes to This Privacy Policy', body: 'We may update this Privacy Policy periodically to reflect legal, technical, or operational changes. When significant updates are made, we will revise the "Last Updated" date and notify users within the application where appropriate. Continued use of the Service after an update constitutes acceptance of the revised Privacy Policy.' },
  { title: '18. Contact Us', body: 'For any questions, requests, or concerns regarding this Privacy Policy or our privacy practices, contact us at Trimio@subtrimio.com. We aim to respond to all privacy-related inquiries within 30 days.' },
];

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

app.get('/privacy-policy', (req, res) => {
  const sections = PRIVACY_POLICY_SECTIONS.map(
    (s) => `<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body)}</p>`
  ).join('\n');
  res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trimio Privacy Policy</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1F2937; line-height: 1.6; }
  h1 { font-size: 26px; } h2 { font-size: 18px; margin-top: 32px; }
  p { color: #374151; }
  .updated { color: #6B7280; font-size: 13px; }
</style>
</head>
<body>
<h1>Trimio Privacy Policy</h1>
<p class="updated">Effective date: April 27, 2025 · Last updated: June 29, 2026</p>
<p>Thank you for choosing Trimio. This Privacy Policy explains how Trimio collects, uses, stores, protects, and shares your information when you use the Trimio mobile application and related services (the "Service"). By creating an account or using the Service, you acknowledge that you have read and understood this Privacy Policy.</p>
${sections}
</body>
</html>`);
});

app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { result: { data: null }, error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', emailLimiter);
app.use('/api/auth/resend-verification', emailLimiter);
app.use('/api/auth/verify-email', codeLimiter);
app.use('/api/auth/reset-password', codeLimiter);
app.use('/api/auth/account', authLimiter);
app.use('/api/trpc', apiLimiter);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@trimio.app';
console.log('BREVO_API_KEY set:', !!BREVO_API_KEY);
console.log('FROM_EMAIL:', FROM_EMAIL);

async function sendEmail(to, subject, html, retries = 3) {
  if (!BREVO_API_KEY) {
    console.log(`[DEV] Email to ${to} | ${subject}`);
    return;
  }
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Trimio', email: FROM_EMAIL },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Email send failed');
      console.log('Email sent:', json.messageId);
      return;
    } catch (e) {
      const isLastAttempt = attempt === retries - 1;
      console.error(`Email send attempt ${attempt + 1}/${retries} failed:`, e.message);
      if (isLastAttempt) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

async function sendVerificationEmail(email, code) {
  await sendEmail(
    email,
    'Verify your Trimio account',
    `<div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
      <h2 style="color:#4F46E5;margin-bottom:8px">Verify your Trimio email</h2>
      <p style="color:#374151">Enter this code in the app to activate your account:</p>
      <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#1F2937;text-align:center;padding:24px 0">${code}</div>
      <p style="color:#9CA3AF;font-size:12px">This code expires in 24 hours. If you didn't create a Trimio account, ignore this email.</p>
    </div>`
  );
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Brevo contact attribute sync (PLAN, SUB_COUNT) — best-effort marketing
// enrichment, never awaited by callers and never allowed to fail a request.
async function updateBrevoContact(email, attributes) {
  if (!email || !BREVO_API_KEY) return;
  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes }),
    });
    if (!res.ok) {
      console.error('[Brevo] Contact update failed for', email, res.status, await res.text());
    }
  } catch (err) {
    console.error('[Brevo] Contact update error for', email, err.message);
  }
}

function syncBrevoPlan(email, plan) {
  updateBrevoContact(email, { PLAN: plan });
}

// Maps a RevenueCat product_id to a specific plan tier so Brevo campaigns
// can target by plan (e.g. an annual-only upsell), not just premium/free.
function getPlanTierFromProductId(productId = '') {
  const id = productId.toLowerCase();
  if (id.includes('lifetime')) return 'lifetime';
  if (id.includes('annual') || id.includes('yearly')) return 'annual';
  if (id.includes('monthly')) return 'monthly';
  return 'premium';
}

function syncBrevoSubCount(email, count) {
  updateBrevoContact(email, { SUB_COUNT: count });
}

// Must match the window used in the Brevo automation's "in the next N days" filter.
const RENEWAL_DIGEST_WINDOW_DAYS = 3;

// Fire-and-forget: recompute the user's subscription count and push it to
// Brevo. Never awaited by callers so it can't slow down or fail their request.
function syncSubCountToBrevo(userId, email) {
  if (!email) return;
  pool.query('SELECT COUNT(*) as c FROM subscriptions WHERE user_id = $1', [userId])
    .then((result) => syncBrevoSubCount(email, parseInt(result.rows[0].c)))
    .catch((err) => console.error('[Brevo] Sub count lookup failed for user', userId, err.message));
}

// Fire-and-forget: find the soonest upcoming renewal/trial-end date across
// the user's subscriptions, plus an itemized digest of everything renewing
// within RENEWAL_DIGEST_WINDOW_DAYS, and push both to Brevo for the
// renewal-reminder automation (date drives the trigger, digest drives the
// email content so a contact with several renewals gets all of them listed).
function syncNextRenewalToBrevo(userId, email) {
  if (!email) return;
  Promise.all([
    pool.query(
      `SELECT MIN(d) AS next_date FROM (
         SELECT next_billing_date AS d FROM subscriptions WHERE user_id = $1 AND is_active = TRUE AND next_billing_date >= NOW()
         UNION ALL
         SELECT trial_end_date AS d FROM subscriptions WHERE user_id = $1 AND is_active = TRUE AND trial_end_date >= NOW()
       ) t`,
      [userId]
    ),
    pool.query(
      `SELECT name, price, billing_cycle,
         CASE WHEN trial_end_date >= NOW() AND (next_billing_date IS NULL OR trial_end_date <= next_billing_date)
              THEN trial_end_date ELSE next_billing_date END AS relevant_date
       FROM subscriptions
       WHERE user_id = $1
         AND is_active = TRUE
         AND (
           (next_billing_date >= NOW() AND next_billing_date <= NOW() + INTERVAL '${RENEWAL_DIGEST_WINDOW_DAYS} days')
           OR (trial_end_date >= NOW() AND trial_end_date <= NOW() + INTERVAL '${RENEWAL_DIGEST_WINDOW_DAYS} days')
         )
       ORDER BY relevant_date ASC`,
      [userId]
    ),
    pool.query('SELECT currency_symbol FROM user_settings WHERE user_id = $1', [userId]),
  ])
    .then(([dateResult, digestResult, settingsResult]) => {
      const nextDate = dateResult.rows[0]?.next_date || null;
      const symbol = settingsResult.rows[0]?.currency_symbol || '$';
      const digest = digestResult.rows
        .map((r) => `${r.name} (${symbol}${parseFloat(r.price).toFixed(2)}/${r.billing_cycle}) – ${new Date(r.relevant_date).toISOString().slice(0, 10)}`)
        .join('; ');
      const totalAmount = digestResult.rows.reduce((sum, r) => sum + parseFloat(r.price), 0);
      updateBrevoContact(email, {
        NEXT_RENEWAL_DATE: nextDate ? new Date(nextDate).toISOString().slice(0, 10) : null,
        UPCOMING_RENEWALS: digest || null,
        TOTAL_AMOUNT: digestResult.rows.length ? totalAmount.toFixed(2) : null,
        CURRENCY_SYMBOL: symbol,
      });
    })
    .catch((err) => console.error('[Brevo] Next renewal lookup failed for user', userId, err.message));
}

// Verification/reset codes are emailed in plaintext but only the hash is stored,
// so a database leak alone can't be used to take over accounts.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

// Accepts ID tokens minted for any of our Android/iOS/Web Google OAuth clients —
// Google issues a different audience per client ID, so all three must be allowed.
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const googleOAuthClient = new OAuth2Client();

async function verifyGoogleIdToken(idToken) {
  const ticket = await googleOAuthClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_IDS });
  return ticket.getPayload();
}

// Short-lived JWT access token + opaque, rotating refresh token (stored hashed,
// like verification/reset codes) — lets the client stay signed in past 1h without
// re-entering credentials, while a stolen access token only has a 1h window.
async function issueTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expires = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  await pool.query(
    'UPDATE users SET refresh_token_hash = $1, refresh_token_expires = $2 WHERE id = $3',
    [hashToken(refreshToken), expires, userId]
  );
  return { accessToken, refreshToken };
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      open_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      is_paid BOOLEAN DEFAULT FALSE,
      paid_at TIMESTAMPTZ,
      is_verified BOOLEAN DEFAULT FALSE,
      verification_token TEXT,
      verification_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_plan TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS win_back_sent_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_premium_until TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_expires TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`);
  // Google sign-in accounts have no password, so password_hash can no longer be NOT NULL.
  await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      category TEXT DEFAULT 'other',
      next_billing_date TIMESTAMPTZ,
      trial_end_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      old_price NUMERIC NOT NULL,
      new_price NUMERIC NOT NULL,
      changed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      renewal_alerts BOOLEAN DEFAULT TRUE,
      spending_alerts BOOLEAN DEFAULT TRUE,
      weekly_summary BOOLEAN DEFAULT TRUE,
      push_enabled BOOLEAN DEFAULT TRUE,
      email_reminders BOOLEAN DEFAULT TRUE,
      renewal_alert_days INTEGER DEFAULT 3
    )
  `);
  await pool.query(`ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS renewal_alert_days INTEGER DEFAULT 3`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      budget_goal NUMERIC,
      currency TEXT DEFAULT 'USD',
      currency_symbol TEXT DEFAULT '$'
    )
  `);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT '$'`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_categories TEXT DEFAULT '[]'`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS alert_threshold NUMERIC DEFAULT 50`);

  // open_id is the stable identifier passed to RevenueCat as the appUserID, so
  // purchase webhooks can map RevenueCat's app_user_id back to a Trimio user.
  await pool.query(`COMMENT ON COLUMN users.open_id IS 'RevenueCat appUserID — used by the /api/webhooks/revenuecat handler to map purchases back to this user.'`);

  // Every CRUD/list query filters by user_id (and notifications also by is_read),
  // so without these indexes those become full table scans as the tables grow.
  // (users.email already has an index from its UNIQUE constraint.)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read)`);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function trpc(data) { return { result: { data } }; }

const REVENUECAT_SECRET_API_KEY = process.env.REVENUECAT_SECRET_API_KEY;
const REVENUECAT_PREMIUM_ENTITLEMENT = 'Trimio Premium';

// Looks up the subscriber directly on RevenueCat's servers so premium status
// can't be granted by just calling our API with { isPremium: true } — the
// client-reported value is only trusted as a fallback when this key isn't set.
async function fetchPremiumEntitlementFromRevenueCat(openId) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(openId)}`, {
    headers: { Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}` },
  });
  if (!res.ok) throw new Error(`RevenueCat lookup failed with status ${res.status}`);
  const data = await res.json();
  const entitlement = data.subscriber?.entitlements?.[REVENUECAT_PREMIUM_ENTITLEMENT];
  if (!entitlement) return false;
  return !entitlement.expires_date || new Date(entitlement.expires_date) > new Date();
}

// Logs the full error server-side but never leaks internals (DB schema, stack
// traces, etc.) to the client — callers should still send specific 400s for
// validation failures before reaching this.
function handleError(err, res) {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

function nextBillingDate(billingCycle) {
  const d = new Date();
  if (billingCycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function toMonthly(price, billingCycle) {
  if (billingCycle === 'weekly') return price * 52 / 12;
  if (billingCycle === 'yearly') return price / 12;
  return price;
}

function hasBonusPremium(u) {
  return !!u.bonus_premium_until && new Date(u.bonus_premium_until) > new Date();
}

function formatUser(u) {
  return {
    id: u.id, openId: u.open_id, email: u.email, name: u.name, role: u.role,
    isPaid: u.is_paid || hasBonusPremium(u),
    paidAt: u.paid_at, isVerified: u.is_verified,
    hasPassword: !!u.password_hash,
    referralCode: u.referral_code,
    hasRedeemedReferral: u.referred_by != null,
    bonusPremiumUntil: u.bonus_premium_until,
  };
}

// Referral codes avoid visually ambiguous characters (0/O, 1/I/L).
function generateReferralCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function assignReferralCode(userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, userId]);
      return code;
    } catch (err) {
      if (err.code !== '23505') throw err; // unique_violation on referral_code — retry with a new code
    }
  }
  throw new Error('Failed to assign a unique referral code');
}

// Grants the referrer 1 free month of Premium, stacking onto any remaining bonus time.
async function rewardReferrer(referrerId) {
  await pool.query(
    `UPDATE users SET bonus_premium_until = GREATEST(COALESCE(bonus_premium_until, NOW()), NOW()) + INTERVAL '30 days'
     WHERE id = $1`,
    [referrerId]
  );
}

function formatSub(s) {
  return {
    id: s.id,
    user_id: s.user_id,
    name: s.name,
    price: parseFloat(s.price),
    billingCycle: s.billing_cycle,
    category: s.category,
    nextBillingDate: s.next_billing_date,
    trialEndDate: s.trial_end_date || null,
    created_at: s.created_at,
    isActive: s.is_active ?? true,
  };
}

function formatNotification(n) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type || 'info',
    read: n.is_read,
    createdAt: n.created_at,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { password, name } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const openId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    const result = await pool.query(
      'INSERT INTO users (open_id, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [openId, email, name || null, passwordHash]
    );
    const user = result.rows[0];
    user.referral_code = await assignReferralCode(user.id);

    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [user.id, 'Welcome to Trimio!', 'Start adding your subscriptions to track your spending.', 'info']
    );
    await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

    const code = generateCode();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query('UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3', [hashToken(code), expires, user.id]);
    await sendVerificationEmail(email, code).catch(e => console.error('Email send failed:', e));

    const { accessToken, refreshToken } = await issueTokens(user.id);
    res.json({ token: accessToken, refreshToken, user: formatUser(user) });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = await issueTokens(user.id);
    res.json({ token: accessToken, refreshToken, user: formatUser(user) });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (GOOGLE_CLIENT_IDS.length === 0) return res.status(503).json({ error: 'Google sign-in is not configured' });
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    let payload;
    try {
      payload = await verifyGoogleIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    if (!payload?.email_verified) return res.status(401).json({ error: 'Google account email is not verified' });
    const email = payload.email.trim().toLowerCase();
    const googleId = payload.sub;

    let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = result.rows[0];

    if (!user) {
      // Link to an existing email/password account rather than creating a duplicate.
      result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      user = result.rows[0];
      if (user) {
        await pool.query('UPDATE users SET google_id = $1, is_verified = TRUE WHERE id = $2', [googleId, user.id]);
        user.google_id = googleId;
        user.is_verified = true;
      }
    }

    if (!user) {
      const openId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const insertResult = await pool.query(
        'INSERT INTO users (open_id, email, name, password_hash, google_id, is_verified) VALUES ($1, $2, $3, NULL, $4, TRUE) RETURNING *',
        [openId, email, payload.name || null, googleId]
      );
      user = insertResult.rows[0];
      user.referral_code = await assignReferralCode(user.id);

      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [user.id, 'Welcome to Trimio!', 'Start adding your subscriptions to track your spending.', 'info']
      );
      await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
      await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }

    const { accessToken, refreshToken } = await issueTokens(user.id);
    res.json({ token: accessToken, refreshToken, user: formatUser(user) });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const result = await pool.query('SELECT * FROM users WHERE refresh_token_hash = $1', [hashToken(refreshToken)]);
    const user = result.rows[0];
    if (!user || !user.refresh_token_expires || new Date(user.refresh_token_expires) < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user.id);
    res.json({ token: accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE users SET refresh_token_hash = NULL, refresh_token_expires = NULL WHERE id = $1', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(result.rows[0]));
  } catch (err) {
    handleError(err, res);
  }
});

app.patch('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const valid = user.password_hash && (await bcrypt.compare(currentPassword, user.password_hash));
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.userId]);
    }

    if (name !== undefined) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name || null, req.userId]);
    }

    const updated = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    res.json(formatUser(updated.rows[0]));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/verify-email', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_verified) return res.json({ success: true, user: formatUser(user) });
    if (!user.verification_token || user.verification_token !== hashToken(code)) return res.status(400).json({ error: 'Invalid code' });
    if (new Date(user.verification_expires) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    await pool.query('UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = $1', [req.userId]);

    if (user.referred_by && !user.referral_rewarded) {
      await rewardReferrer(user.referred_by);
      await pool.query('UPDATE users SET referral_rewarded = TRUE WHERE id = $1', [req.userId]);
    }

    const updated = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    res.json({ success: true, user: formatUser(updated.rows[0]) });
  } catch (err) {
    handleError(err, res);
  }
});

app.get('/api/trpc/referrals.me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT referral_code, referred_by, bonus_premium_until FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      referralCode: user.referral_code,
      hasRedeemedReferral: user.referred_by != null,
      bonusPremiumUntil: user.bonus_premium_until,
    });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/referrals.redeem', authMiddleware, async (req, res) => {
  try {
    const code = req.body.code?.trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Referral code required' });

    const meResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const me = meResult.rows[0];
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (me.referred_by) return res.status(400).json({ error: 'You already redeemed a referral code' });

    const referrerResult = await pool.query('SELECT id FROM users WHERE referral_code = $1', [code]);
    const referrer = referrerResult.rows[0];
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    if (referrer.id === me.id) return res.status(400).json({ error: "You can't redeem your own referral code" });

    await pool.query('UPDATE users SET referred_by = $1 WHERE id = $2', [referrer.id, me.id]);

    if (me.is_verified && !me.referral_rewarded) {
      await rewardReferrer(referrer.id);
      await pool.query('UPDATE users SET referral_rewarded = TRUE WHERE id = $1', [me.id]);
    }

    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.json({ success: true });

    const code = generateCode();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query('UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3', [hashToken(code), expires, user.id]);
    await sendEmail(
      email,
      'Reset your Trimio password',
      `<div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
        <h2 style="color:#4F46E5;margin-bottom:8px">Reset your password</h2>
        <p style="color:#374151">Enter this code in the app to reset your password:</p>
        <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#1F2937;text-align:center;padding:24px 0">${code}</div>
        <p style="color:#9CA3AF;font-size:12px">This code expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>`
    );
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code and new password required' });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !user.reset_token || user.reset_token !== hashToken(code)) return res.status(400).json({ error: 'Invalid or expired code' });
    if (new Date(user.reset_expires) < new Date()) return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL, refresh_token_hash = NULL, refresh_token_expires = NULL WHERE id = $2', [hash, user.id]);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/auth/resend-verification', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_verified) return res.json({ success: true, alreadyVerified: true });
    const code = generateCode();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query('UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3', [hashToken(code), expires, user.id]);
    await sendVerificationEmail(user.email, code).catch(e => console.error('Email send failed:', e));
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.delete('/api/auth/account', authMiddleware, async (req, res) => {
  try {
    const { password, idToken } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.password_hash) {
      if (!password) return res.status(400).json({ error: 'Password required' });
      if (!(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    } else {
      // Google-only accounts have no password — confirm deletion with a
      // fresh Google sign-in instead, matched against the account's stored
      // google_id so one Google user can't delete another's account.
      if (!idToken) return res.status(400).json({ error: 'GOOGLE_ID_TOKEN_REQUIRED' });
      let payload;
      try {
        payload = await verifyGoogleIdToken(idToken);
      } catch {
        return res.status(401).json({ error: 'Invalid Google token' });
      }
      if (payload.sub !== user.google_id) {
        return res.status(401).json({ error: 'Google account does not match' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

// Called by the app after a successful RevenueCat purchase to sync premium status
app.post('/api/auth/verify-premium', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT open_id, email FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    let isPremium;
    if (REVENUECAT_SECRET_API_KEY) {
      isPremium = await fetchPremiumEntitlementFromRevenueCat(user.open_id);
    } else {
      // Degraded mode: no way to verify server-side, so trust the client.
      isPremium = req.body.isPremium === true;
    }

    // Clearing cancelled_at/win_back_sent_at here too (not just in the webhook's
    // GRANT branch) matters because this endpoint can confirm a resubscribe
    // before RevenueCat's webhook arrives — without this, the win-back cron
    // could still email someone who already bought back in.
    await pool.query(
      `UPDATE users SET is_paid = $1, paid_at = CASE WHEN $1 AND paid_at IS NULL THEN NOW() ELSE paid_at END,
       cancelled_at = CASE WHEN $1 THEN NULL ELSE cancelled_at END,
       win_back_sent_at = CASE WHEN $1 THEN NULL ELSE win_back_sent_at END
       WHERE id = $2`,
      [isPremium, req.userId]
    );
    syncBrevoPlan(user.email, isPremium ? 'premium' : 'free');
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    res.json({ success: true, user: formatUser(result.rows[0]) });
  } catch (err) {
    handleError(err, res);
  }
});

// RevenueCat server webhook — acts as the source of truth for premium status if the
// app-side sync (above) never reaches us (app killed mid-purchase, network drop, etc).
// Configure in RevenueCat > Project Settings > Integrations > Webhooks with URL
// https://<your-domain>/api/webhooks/revenuecat and header "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>".
app.post('/api/webhooks/revenuecat', async (req, res) => {
  try {
    if (!process.env.REVENUECAT_WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'Webhook not configured' });
    }
    const provided = Buffer.from(req.headers['authorization'] || '');
    const expected = Buffer.from(`Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`);
    if (provided.length !== expected.length || !require('crypto').timingSafeEqual(provided, expected)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = req.body && req.body.event;
    const appUserId = event && event.app_user_id;
    if (!appUserId) {
      return res.status(400).json({ error: 'Missing event.app_user_id' });
    }

    const GRANT_EVENTS = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'TRANSFER'];
    // CANCELLATION only means auto-renew was turned off — RevenueCat's own semantics
    // keep the entitlement active until the paid period actually ends (EXPIRATION).
    // Revoking access immediately on CANCELLATION would cut off users who already
    // paid for the current period.
    const REVOKE_EVENTS = ['EXPIRATION'];
    const PREMIUM_ENTITLEMENT = 'Trimio Premium';

    // Sandbox/test purchases have a compressed billing cycle (RevenueCat/Play
    // simulate a "month" in minutes), so they expire almost immediately. This
    // backend only serves the live app, so sandbox events must never touch
    // real premium status regardless of how NODE_ENV happens to be set.
    if (event.environment === 'SANDBOX') {
      return res.json({ success: true });
    }

    // Only act on events for the Premium entitlement specifically — RevenueCat
    // sends EXPIRATION/etc. events per-entitlement, and other entitlements
    // (e.g. tip products) expiring must not revoke Premium access.
    const entitlementIds = event.entitlement_ids || [];
    const affectsPremium = entitlementIds.includes(PREMIUM_ENTITLEMENT);

    if (affectsPremium && GRANT_EVENTS.includes(event.type)) {
      // Resubscribing (e.g. UNCANCELLATION) clears any pending win-back state.
      const result = await pool.query(
        "UPDATE users SET is_paid = true, paid_at = CASE WHEN paid_at IS NULL THEN NOW() ELSE paid_at END, cancelled_at = NULL, win_back_sent_at = NULL WHERE open_id = $1 RETURNING email",
        [appUserId]
      );
      if (result.rows[0]?.email) syncBrevoPlan(result.rows[0].email, getPlanTierFromProductId(event.product_id));
    } else if (affectsPremium && event.type === 'CANCELLATION') {
      // Access continues until EXPIRATION — only record the cancellation so our
      // own win-back cron (sendWinBackEmails) can email them after a delay.
      // Don't overwrite cancelled_at if already set, so duplicate webhook
      // deliveries don't keep pushing the win-back email out.
      const lastPlan = getPlanTierFromProductId(event.product_id);
      const result = await pool.query(
        "UPDATE users SET cancelled_at = COALESCE(cancelled_at, NOW()), last_plan = $1 WHERE open_id = $2 RETURNING email",
        [lastPlan, appUserId]
      );
      if (result.rows[0]?.email) syncBrevoPlan(result.rows[0].email, 'cancelling');
    } else if (affectsPremium && REVOKE_EVENTS.includes(event.type)) {
      const result = await pool.query(
        "UPDATE users SET is_paid = false, cancelled_at = NULL, win_back_sent_at = NULL WHERE open_id = $1 RETURNING email",
        [appUserId]
      );
      if (result.rows[0]?.email) syncBrevoPlan(result.rows[0].email, 'free');
    }

    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

app.get('/api/trpc/subscriptions.list', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
         ph.new_price  AS ph_new_price,
         ph.old_price  AS ph_old_price,
         ph.changed_at AS ph_changed_at
       FROM subscriptions s
       LEFT JOIN LATERAL (
         SELECT new_price, old_price, changed_at
         FROM price_history
         WHERE subscription_id = s.id
           AND new_price > old_price
           AND changed_at >= NOW() - INTERVAL '30 days'
         ORDER BY changed_at DESC
         LIMIT 1
       ) ph ON TRUE
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.userId]
    );
    res.json(trpc(result.rows.map(r => ({
      ...formatSub(r),
      priceIncrease: r.ph_changed_at ? {
        from: parseFloat(r.ph_old_price),
        to: parseFloat(r.ph_new_price),
        changedAt: r.ph_changed_at,
      } : null,
    }))));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/subscriptions.create', authMiddleware, async (req, res) => {
  try {
    const { name, billingCycle = 'monthly', category = 'other', trialEndDate, force } = req.body;
    const price = parseFloat(req.body.price);
    if (!name || req.body.price == null) return res.status(400).json({ error: 'Name and price required' });
    if (isNaN(price) || price <= 0 || price > 99999) return res.status(400).json({ error: 'Price must be a positive number under 99,999' });
    if (!['weekly', 'monthly', 'yearly'].includes(billingCycle)) return res.status(400).json({ error: 'Invalid billing cycle' });

    const userResult = await pool.query('SELECT is_paid, email, bonus_premium_until FROM users WHERE id = $1', [req.userId]);
    const isPaid = userResult.rows[0]?.is_paid || hasBonusPremium(userResult.rows[0] || {});
    if (!isPaid) {
      const countResult = await pool.query('SELECT COUNT(*) as c FROM subscriptions WHERE user_id = $1', [req.userId]);
      if (parseInt(countResult.rows[0].c) >= 5) {
        return res.status(403).json({ error: 'FREE_LIMIT_REACHED' });
      }
    }

    if (!force) {
      const dupResult = await pool.query(
        'SELECT id, name FROM subscriptions WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))',
        [req.userId, name]
      );
      if (dupResult.rows.length > 0) {
        return res.status(409).json({ error: 'DUPLICATE_SUBSCRIPTION', existingName: dupResult.rows[0].name });
      }
    }

    const result = await pool.query(
      'INSERT INTO subscriptions (user_id, name, price, billing_cycle, category, next_billing_date, trial_end_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.userId, name, price, billingCycle, category, nextBillingDate(billingCycle), trialEndDate || null]
    );
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [req.userId, 'Subscription Added', `${name} ($${price}/${billingCycle}) was added.`, 'info']
    );
    syncSubCountToBrevo(req.userId, userResult.rows[0]?.email);
    syncNextRenewalToBrevo(req.userId, userResult.rows[0]?.email);
    res.json(trpc(formatSub(result.rows[0])));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/subscriptions.update', authMiddleware, async (req, res) => {
  try {
    const { id, name, billingCycle, category, trialEndDate } = req.body;
    const price = parseFloat(req.body.price);
    if (!id) return res.status(400).json({ error: 'Subscription id required' });
    if (!name || req.body.price == null) return res.status(400).json({ error: 'Name and price required' });
    if (isNaN(price) || price <= 0 || price > 99999) return res.status(400).json({ error: 'Price must be a positive number under 99,999' });
    if (!['weekly', 'monthly', 'yearly'].includes(billingCycle)) return res.status(400).json({ error: 'Invalid billing cycle' });

    const check = await pool.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });

    const existing = check.rows[0];
    const newBillingDate = billingCycle !== existing.billing_cycle
      ? nextBillingDate(billingCycle)
      : existing.next_billing_date;

    const result = await pool.query(
      'UPDATE subscriptions SET name = $1, price = $2, billing_cycle = $3, category = $4, next_billing_date = $5, trial_end_date = $6 WHERE id = $7 AND user_id = $8 RETURNING *',
      [name, price, billingCycle, category, newBillingDate, trialEndDate || null, id, req.userId]
    );

    const oldPrice = parseFloat(existing.price);
    if (price !== oldPrice) {
      await pool.query(
        'INSERT INTO price_history (subscription_id, user_id, old_price, new_price) VALUES ($1, $2, $3, $4)',
        [id, req.userId, oldPrice, price]
      );
      if (price > oldPrice) {
        const diff = (price - oldPrice).toFixed(2);
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES ($1, $2, $3, 'price_increase')`,
          [req.userId, `${name} increased by $${diff}`, `Your ${name} subscription went from $${oldPrice.toFixed(2)} to $${price.toFixed(2)} per ${billingCycle}.`]
        );
      }
    }

    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    syncNextRenewalToBrevo(req.userId, userResult.rows[0]?.email);
    res.json(trpc(formatSub(result.rows[0])));
  } catch (err) {
    handleError(err, res);
  }
});

app.get('/api/trpc/subscriptions.priceHistory', authMiddleware, async (req, res) => {
  try {
    const { subscriptionId } = req.query;
    if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' });
    const result = await pool.query(
      `SELECT old_price, new_price, changed_at FROM price_history
       WHERE subscription_id = $1 AND user_id = $2
       ORDER BY changed_at DESC LIMIT 20`,
      [subscriptionId, req.userId]
    );
    res.json(trpc(result.rows.map(r => ({
      oldPrice: parseFloat(r.old_price),
      newPrice: parseFloat(r.new_price),
      changedAt: r.changed_at,
    }))));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/subscriptions.setActive', authMiddleware, async (req, res) => {
  try {
    const { id, isActive } = req.body;
    if (!id || typeof isActive !== 'boolean') return res.status(400).json({ error: 'id and isActive required' });

    const result = await pool.query(
      'UPDATE subscriptions SET is_active = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [isActive, id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });

    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    syncNextRenewalToBrevo(req.userId, userResult.rows[0]?.email);
    res.json(trpc(formatSub(result.rows[0])));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/subscriptions.delete', authMiddleware, async (req, res) => {
  try {
    const { id } = req.body;
    const check = await pool.query(
      'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    await pool.query('DELETE FROM subscriptions WHERE id = $1 AND user_id = $2', [id, req.userId]);
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    syncSubCountToBrevo(req.userId, userResult.rows[0]?.email);
    syncNextRenewalToBrevo(req.userId, userResult.rows[0]?.email);
    res.json(trpc({ success: true }));
  } catch (err) {
    handleError(err, res);
  }
});

app.get('/api/trpc/subscriptions.exportCsv', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY name ASC',
      [req.userId]
    );
    const subs = result.rows;
    const header = 'Name,Price,Billing Cycle,Category,Next Billing Date,Trial End Date\n';
    const csvCell = (value) => {
      let str = String(value ?? '');
      if (/^[=+\-@]/.test(str)) str = `'${str}`; // prevent formula injection in Excel/Sheets
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = subs.map(s => [
      csvCell(s.name),
      parseFloat(s.price).toFixed(2),
      csvCell(s.billing_cycle),
      csvCell(s.category),
      s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : '',
      s.trial_end_date ? new Date(s.trial_end_date).toLocaleDateString() : '',
    ].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.send(header + rows);
  } catch (err) {
    handleError(err, res);
  }
});

// ── User Settings ─────────────────────────────────────────────────────────────

app.get('/api/trpc/settings.get', authMiddleware, async (req, res) => {
  try {
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    const result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
    const s = result.rows[0];
    res.json(trpc({
      budgetGoal: s.budget_goal ? parseFloat(s.budget_goal) : null,
      currency: s.currency || 'USD',
      currencySymbol: s.currency_symbol || '$',
      customCategories: s.custom_categories ? JSON.parse(s.custom_categories) : [],
      alertThreshold: s.alert_threshold != null ? parseFloat(s.alert_threshold) : 50,
    }));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/settings.update', authMiddleware, async (req, res) => {
  try {
    const { budgetGoal, currency, currencySymbol, customCategories, alertThreshold } = req.body;
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    await pool.query(
      `UPDATE user_settings SET budget_goal = $1, currency = $2, currency_symbol = $3,
       custom_categories = COALESCE($4, custom_categories), alert_threshold = COALESCE($5, alert_threshold)
       WHERE user_id = $6`,
      [
        budgetGoal ?? null, currency || 'USD', currencySymbol || '$',
        customCategories !== undefined ? JSON.stringify(customCategories) : null,
        alertThreshold !== undefined ? alertThreshold : null,
        req.userId,
      ]
    );
    res.json(trpc({ success: true }));
  } catch (err) {
    handleError(err, res);
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

app.get('/api/trpc/analytics.summary', authMiddleware, async (req, res) => {
  try {
    const subsResult = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.userId]);
    const allSubs = subsResult.rows;
    const subs = allSubs.filter(s => s.is_active);
    const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(parseFloat(s.price), s.billing_cycle), 0);

    const alertResult = await pool.query(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.userId]
    );
    const alertCount = parseInt(alertResult.rows[0].c);

    const byCategory = {};
    for (const s of subs) {
      const monthly = toMonthly(parseFloat(s.price), s.billing_cycle);
      byCategory[s.category] = (byCategory[s.category] || 0) + monthly;
    }
    const categoryBreakdown = Object.entries(byCategory).map(([category, amount]) => ({ category, amount }));

    res.json(trpc({
      activeSubscriptions: subs.length,
      totalSubscriptions: allSubs.length,
      monthlyTotal,
      yearlyTotal: monthlyTotal * 12,
      alertCount,
      categoryBreakdown,
    }));
  } catch (err) {
    handleError(err, res);
  }
});

// ── Alerts ────────────────────────────────────────────────────────────────────

app.get('/api/trpc/alerts.list', authMiddleware, async (req, res) => {
  try {
    const [subResult, settingsResult, prefsResult] = await Promise.all([
      pool.query('SELECT * FROM subscriptions WHERE user_id = $1 AND is_active = TRUE', [req.userId]),
      pool.query('SELECT currency_symbol FROM user_settings WHERE user_id = $1', [req.userId]),
      pool.query('SELECT renewal_alert_days FROM notification_preferences WHERE user_id = $1', [req.userId]),
    ]);
    const subs = subResult.rows;
    const sym = settingsResult.rows[0]?.currency_symbol || '$';
    const renewalAlertDays = prefsResult.rows[0]?.renewal_alert_days ?? 3;
    const now = new Date();
    const alerts = [];

    for (const sub of subs) {
      // Auto-advance stale billing dates so renewal alerts stay accurate.
      // Guard against null/invalid dates to prevent infinite loops.
      let billingDate = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
      if (billingDate && !isNaN(billingDate.getTime())) {
        let iterations = 0;
        while (billingDate < now && iterations < 1000) {
          iterations++;
          if (sub.billing_cycle === 'weekly') billingDate.setDate(billingDate.getDate() + 7);
          else if (sub.billing_cycle === 'yearly') billingDate.setFullYear(billingDate.getFullYear() + 1);
          else billingDate.setMonth(billingDate.getMonth() + 1);
        }
        if (iterations > 0 && billingDate >= now) {
          await pool.query('UPDATE subscriptions SET next_billing_date = $1 WHERE id = $2', [billingDate.toISOString(), sub.id]);
        }
      } else {
        // Missing billing date — set it now and skip alert for this cycle
        billingDate = new Date(nextBillingDate(sub.billing_cycle));
        await pool.query('UPDATE subscriptions SET next_billing_date = $1 WHERE id = $2', [billingDate.toISOString(), sub.id]);
      }

      const days = Math.ceil((billingDate - now) / 86400000);
      if (days <= renewalAlertDays && days >= -1) {
        alerts.push({
          id: `renewal-${sub.id}`,
          type: 'renewal_alert',
          title: `${sub.name} billing ${days <= 0 ? 'today' : `in ${days} day${days !== 1 ? 's' : ''}`}`,
          message: `${sym}${parseFloat(sub.price).toFixed(2)} will be charged for ${sub.name}.`,
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          severity: days <= 1 ? 'high' : days <= 3 ? 'medium' : 'low',
        });
      }
      if (sub.trial_end_date) {
        const trialDays = Math.ceil((new Date(sub.trial_end_date) - now) / 86400000);
        if (trialDays >= 0 && trialDays <= 3) {
          alerts.push({
            id: `trial-${sub.id}`,
            type: 'trial_alert',
            title: `${sub.name} trial ends ${trialDays === 0 ? 'today' : `in ${trialDays} day${trialDays !== 1 ? 's' : ''}`}`,
            message: `Your free trial for ${sub.name} is about to end. Cancel now to avoid charges.`,
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            severity: trialDays === 0 ? 'high' : 'medium',
          });
        }
      }
    }

    // Configurable: total monthly spend threshold for the "high spending" alert.
    const TOTAL_SPEND_ALERT_THRESHOLD = 200;
    const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(parseFloat(s.price), s.billing_cycle), 0);
    if (monthlyTotal > TOTAL_SPEND_ALERT_THRESHOLD) {
      alerts.push({
        id: 'expensive',
        type: 'expensive_alert',
        title: 'High monthly spending',
        message: `You spend ${sym}${monthlyTotal.toFixed(2)}/month on subscriptions.`,
        subscriptionId: null,
        subscriptionName: null,
        severity: 'low',
      });
    }

    res.json(trpc(alerts));
  } catch (err) {
    handleError(err, res);
  }
});

// ── Insights ──────────────────────────────────────────────────────────────────

app.get('/api/trpc/insights.getRecommendations', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1 AND is_active = TRUE', [req.userId]);
    const subs = result.rows;

    if (subs.length === 0) {
      return res.json(trpc({
        keyInsights: 'Add your first subscription to get personalized insights about your spending habits.',
        topRecommendations: [
          'Track all your subscriptions in one place.',
          'Set billing cycle correctly to get accurate yearly projections.',
          'Review your subscriptions monthly to cancel unused ones.',
        ],
        estimatedSavings: 0,
      }));
    }

    const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(parseFloat(s.price), s.billing_cycle), 0);
    const byCategory = {};
    for (const s of subs) {
      byCategory[s.category] = (byCategory[s.category] || 0) + toMonthly(parseFloat(s.price), s.billing_cycle);
    }
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const estimatedSavings = +(monthlyTotal * 0.2).toFixed(2);

    const recommendations = [];
    if (topCategory && topCategory[1] > 20) {
      recommendations.push(`Review your ${topCategory[0]} subscriptions ($${topCategory[1].toFixed(2)}/mo) — you may be able to downgrade or cancel some.`);
    }
    if (subs.length > 5) {
      recommendations.push(`You have ${subs.length} active subscriptions. Consider auditing for duplicates or unused services.`);
    }
    recommendations.push(`Switching some monthly plans to annual billing could save up to 20% per year.`);
    if (monthlyTotal > 50) {
      recommendations.push(`Your monthly spend of $${monthlyTotal.toFixed(2)} is above average. Look for bundle deals to reduce costs.`);
    }

    res.json(trpc({
      keyInsights: `You have ${subs.length} active subscription${subs.length !== 1 ? 's' : ''} costing $${monthlyTotal.toFixed(2)}/month ($${(monthlyTotal * 12).toFixed(2)}/year). ${topCategory ? `Your biggest category is ${topCategory[0]} at $${topCategory[1].toFixed(2)}/month.` : ''}`,
      topRecommendations: recommendations,
      estimatedSavings,
    }));
  } catch (err) {
    handleError(err, res);
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get('/api/trpc/notifications.getHistory', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.userId, limit]
    );
    res.json(trpc(result.rows.map(formatNotification)));
  } catch (err) {
    handleError(err, res);
  }
});

app.get('/api/trpc/notifications.getUnreadCount', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.userId]
    );
    res.json(trpc({ unreadCount: parseInt(result.rows[0].c) }));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/notifications.markAsRead', authMiddleware, async (req, res) => {
  try {
    const id = req.body.id || req.body.notificationId;
    if (id) {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, req.userId]);
    } else {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.userId]);
    }
    res.json(trpc({ success: true }));
  } catch (err) {
    handleError(err, res);
  }
});

// ── Notification Preferences ──────────────────────────────────────────────────

app.get('/api/trpc/notifications.getPreferences', authMiddleware, async (req, res) => {
  try {
    await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    const result = await pool.query('SELECT * FROM notification_preferences WHERE user_id = $1', [req.userId]);
    const p = result.rows[0];
    res.json(trpc({
      renewalAlerts: p.renewal_alerts,
      spendingAlerts: p.spending_alerts,
      weeklySummary: p.weekly_summary,
      pushEnabled: p.push_enabled,
      emailReminders: p.email_reminders ?? false,
      renewalAlertDays: p.renewal_alert_days ?? 3,
    }));
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/api/trpc/notifications.updatePreferences', authMiddleware, async (req, res) => {
  try {
    const { renewalAlerts, spendingAlerts, weeklySummary, pushEnabled, emailReminders, renewalAlertDays } = req.body;
    const allowedRenewalAlertDays = [1, 3, 7];
    const safeRenewalAlertDays = allowedRenewalAlertDays.includes(renewalAlertDays) ? renewalAlertDays : 3;
    await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    await pool.query(
      'UPDATE notification_preferences SET renewal_alerts = $1, spending_alerts = $2, weekly_summary = $3, push_enabled = $4, email_reminders = $5, renewal_alert_days = $6 WHERE user_id = $7',
      [renewalAlerts, spendingAlerts, weeklySummary, pushEnabled, emailReminders ?? false, safeRenewalAlertDays, req.userId]
    );
    res.json(trpc({ success: true }));
  } catch (err) {
    handleError(err, res);
  }
});

// Sends email renewal reminders for all users who have email_reminders = true.
// Call this daily via a cron job or Railway scheduled task.
app.post('/api/trpc/reminders.sendEmailReminders', async (req, res) => {
  // Simple shared secret to prevent unauthorised triggering
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const usersResult = await pool.query(`
      SELECT u.id, u.email, u.name
      FROM users u
      JOIN notification_preferences np ON np.user_id = u.id
      WHERE np.email_reminders = TRUE AND u.is_verified = TRUE
        AND (u.is_paid = TRUE OR u.bonus_premium_until > NOW())
    `);

    let sent = 0;
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 86400000);

    for (const user of usersResult.rows) {
      const subsResult = await pool.query(
        `SELECT * FROM subscriptions
         WHERE user_id = $1
           AND is_active = TRUE
           AND next_billing_date BETWEEN $2 AND $3`,
        [user.id, now.toISOString(), in3Days.toISOString()]
      );
      if (subsResult.rows.length === 0) continue;

      const rows = subsResult.rows.map(s =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${s.name}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">$${parseFloat(s.price).toFixed(2)}/${s.billing_cycle}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${new Date(s.next_billing_date).toLocaleDateString()}</td>
        </tr>`
      ).join('');

      await sendEmail(
        user.email,
        `Trimio: ${subsResult.rows.length} subscription${subsResult.rows.length > 1 ? 's' : ''} renewing soon`,
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
          <h2 style="color:#4F46E5;margin-bottom:4px">Hi ${user.name || 'there'}!</h2>
          <p style="color:#374151;margin-bottom:20px">Here are your upcoming subscription renewals in the next 3 days:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:10px;text-align:left;font-size:12px;color:#6b7280">Service</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#6b7280">Price</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#6b7280">Renewal Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="text-align:center;margin-top:24px">
            <a href="trimio://subscriptions?from=renewal_reminder" style="display:inline-block;background:#4F46E5;color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px">Review in Trimio</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px">
            You're receiving this because you enabled email reminders in Trimio.
            Tap the button above (or open the app) to manage your notification preferences.
          </p>
        </div>`
      ).catch(e => console.error(`Email failed for user ${user.id}:`, e));
      sent++;
    }

    res.json({ success: true, emailsSent: sent });
  } catch (err) {
    handleError(err, res);
  }
});

// Sends a win-back email ~1 day after a user cancels (turns off auto-renew),
// while they still have access until their period expires. Built directly on
// our own transactional email sending rather than Brevo Automation, since
// workflow configuration there is gated behind a plan we don't have.
// Call this daily via the same cron job/scheduler as sendEmailReminders.
app.post('/api/trpc/reminders.sendWinBackEmails', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const usersResult = await pool.query(`
      SELECT id, email, name, last_plan
      FROM users
      WHERE is_paid = TRUE
        AND is_verified = TRUE
        AND cancelled_at IS NOT NULL
        AND cancelled_at <= NOW() - INTERVAL '4 days'
        AND win_back_sent_at IS NULL
    `);

    let sent = 0;
    for (const user of usersResult.rows) {
      const planLabel = { monthly: 'Monthly', annual: 'Annual', lifetime: 'Lifetime' }[user.last_plan] || 'Premium';
      await sendEmail(
        user.email,
        `We're sorry to see you go, ${user.name || 'there'}`,
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
          <h2 style="color:#4F46E5;margin-bottom:8px">Your Trimio ${planLabel} plan is set to end</h2>
          <p style="color:#374151">You'll keep Premium access until your current period ends, but auto-renew is off. If that was a mistake, you can turn it back on anytime from your subscription settings.</p>
          <div style="text-align:center;margin-top:24px">
            <a href="trimio://upgrade" style="display:inline-block;background:#4F46E5;color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px">Keep Premium</a>
          </div>
          <p style="color:#9CA3AF;font-size:12px;margin-top:20px">This is an automatic reminder — no action needed if you meant to cancel.</p>
        </div>`
      ).catch(e => console.error(`Win-back email failed for user ${user.id}:`, e));
      await pool.query('UPDATE users SET win_back_sent_at = NOW() WHERE id = $1', [user.id]);
      sent++;
    }

    res.json({ success: true, emailsSent: sent });
  } catch (err) {
    handleError(err, res);
  }
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok' }));

initDB()
  .then(() => app.listen(PORT, () => console.log(`Trimio backend running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
