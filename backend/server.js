const express = require('express');
const path = require('path');
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
/* JWT_SECRET is REQUIRED, with no fallback and no reference to NODE_ENV.
 *
 * It used to default to a hardcoded dev string and only refuse to boot when
 * NODE_ENV === 'production'. That guard could not do its job here, because
 * nothing in this deployment sets NODE_ENV: the Dockerfile did not, and Railway
 * does not set it for a Dockerfile build. So the one configuration the check
 * existed for was the one configuration it never ran in, and an unset
 * JWT_SECRET in Railway would have booted the real service on a signing key
 * that is committed to this repository. Anyone able to read the repo could then
 * mint a token for any user id.
 *
 * A secret in git history cannot be un-published, so the old default is
 * refused BY VALUE as well. Removing the fallback alone would leave a
 * deployment that had copied that string into its environment running on a key
 * everybody can read, and it would look configured.
 *
 * No NODE_ENV condition at all, deliberately. An environment variable is a
 * statement about which log level you want, not about whether auth tokens need
 * to be forgeable. The Dockerfile now also sets NODE_ENV=production, but that
 * is defence in depth for the libraries that read it, never what makes this
 * check fire. */
const LEAKED_DEV_SECRET = 'subtrimmer-dev-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim().length === 0) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start: without it there is no safe key to sign auth tokens with, and a default would be one anybody could read in the source.');
  process.exit(1);
}
if (JWT_SECRET === LEAKED_DEV_SECRET) {
  console.error('FATAL: JWT_SECRET is set to the old hardcoded development value, which is published in this repository. Refusing to start. Generate a new one, for example `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"`.');
  process.exit(1);
}
/* A warning rather than a refusal, and the asymmetry is on purpose. Absent and
   publicly-known are binary facts about a key being unsafe. "Shorter than I
   would like" is a judgement, and a boot-time refusal on a threshold picked
   here would take a working service down over one. */
if (JWT_SECRET.length < 32) {
  console.warn(`WARNING: JWT_SECRET is only ${JWT_SECRET.length} characters. 32 or more is recommended; 48 random bytes base64url encoded is a good default.`);
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
  console.warn('WARNING: REVENUECAT_SECRET_API_KEY is not set. /api/auth/verify-premium will REFUSE every request with 503 rather than trust the client, so no purchase can be confirmed through it until this is set. The RevenueCat webhook remains the other path in.');
}
if (!process.env.GOOGLE_CLIENT_IDS) {
  console.warn('WARNING: GOOGLE_CLIENT_IDS is not set. /api/auth/google will reject all requests until it is set to a comma-separated list of your Android/iOS/Web Google OAuth client IDs.');
}

// CORS is a browser-only mechanism, so the important case here is the one
// with NO Origin header: the React Native app, the cron-job.org pings, the
// RevenueCat webhook, and curl all send none, and every one of them must
// keep working. Those pass through untouched. Browsers get an allowlist:
// the marketing site (which is same-origin anyway) and localhost, kept
// because the Expo web build is served from a random localhost port during
// development. Note that CORS is not the security boundary here, the Bearer
// token is; a disallowed origin simply receives no CORS headers rather than
// an error, which is what a browser expects.
const ALLOWED_ORIGINS = [
  'https://subtrimio.com',
  'https://www.subtrimio.com',
  'https://subscription-trimmer-mobile-production.up.railway.app',
];
/* Response headers the browser half of this service was missing entirely. The
 * API is consumed by a native app, which ignores all of these, but the same
 * Express app also serves the landing pages, the legal documents and
 * /delete-account, and those are ordinary web pages.
 *
 * HSTS only on a request that already arrived over TLS, which is what
 * `req.secure` reports now that trust proxy is set. Sending it over plain HTTP
 * is meaningless, and sending it from a context that might not have TLS is how
 * a domain locks itself out. No `preload`, and no includeSubDomains beyond this
 * host: the apex is forwarded by Squarespace rather than served here, so this
 * service is not in a position to make promises about it.
 *
 * NO CSP HERE, deliberately, and not from caution alone: the landing page
 * carries four inline <script> blocks and two inline <style> blocks and loads
 * the PostHog snippet from eu-assets.i.posthog.com, sending to eu.i.posthog.com.
 * A useful policy means nonces, which means tools/build-landing.py emitting them
 * and the pages being served through a template rather than as static files. A
 * policy loose enough to avoid that work ('unsafe-inline') would buy almost
 * nothing. Worth doing as its own change, with the page tested; not worth
 * breaking analytics or the signup form to look thorough. */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: false,
}));

// Marketing landing page, served at the domain root so ads and links have a
// real destination. Static file, same-origin with the API, so its account
// form can call /api/auth/register and /api/auth/login directly.
// Two pages, one per language, paired by hreflang in their heads. A separate
// URL rather than a client-side toggle: a toggle would leave Google with a
// single page and the German copy effectively unindexed, which is most of the
// reason for translating it. Both are generated by tools/build-landing.py.
app.get('/de', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing-de.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
});

// The logo as vector. The design handoff inlined a 1.5MB PNG of this five
// times; one cached file is a kilobyte and stays sharp at any size.
app.get('/mark.svg', (req, res) => {
  res.set('Cache-Control', 'public, max-age=604800');
  res.type('image/svg+xml').sendFile(path.join(__dirname, 'mark.svg'));
});

// Landing page assets and search-engine plumbing for subtrimio.com.
app.get('/og.png', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'og.png'));
});
// The German page points at its own card. Same layout, German headline, so a
// link shared from /de does not preview in English.
app.get('/og-de.png', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'og-de.png'));
});
app.get('/icon.png', (req, res) => {
  res.set('Cache-Control', 'public, max-age=604800');
  res.sendFile(path.join(__dirname, 'icon.png'));
});

/* ── Unsubscribe ────────────────────────────────────────────────────────────
   Two routes for one action. GET is the link a person clicks in the footer.
   POST is RFC 8058 one-click, which is what Gmail and Yahoo call when the
   reader presses their own unsubscribe button, and it must act without any
   confirmation step or it does not count.

   No auth: the signature in the URL IS the authorisation, which is the point.
   Somebody who wants to stop receiving email should never be asked to log in
   first, and an unsubscribe that needs a password is an unsubscribe that does
   not work. */
function unsubscribePage(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Trimio</title></head>
    <body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#F7F6F1;color:#142B3A">
      <div style="max-width:440px;margin:12vh auto;padding:40px 32px;background:#FCFBF8;border:1px solid #DCDEDB;border-radius:12px;text-align:center">
        <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
        <p style="color:#52616B;font-size:15px;line-height:1.6;margin:0">${body}</p>
        <p style="margin-top:28px"><a href="${PUBLIC_URL}" style="color:#1F7A62;font-size:14px">www.subtrimio.com</a></p>
      </div></body></html>`;
}

async function applyUnsubscribe(req) {
  const id = parseInt(req.query.u ?? req.body?.u, 10);
  const token = req.query.t ?? req.body?.t;
  if (!id || !token) return false;
  const expected = unsubscribeToken(id);
  // Constant time, so the endpoint cannot be used as an oracle to guess a
  // token one character at a time.
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  await pool.query('UPDATE users SET email_opt_out = TRUE WHERE id = $1', [id]);
  await pool.query(
    'UPDATE notification_preferences SET email_reminders = FALSE WHERE user_id = $1',
    [id]
  );
  return true;
}

app.get('/unsubscribe', async (req, res) => {
  try {
    const ok = await applyUnsubscribe(req);
    res.status(ok ? 200 : 400).type('html').send(
      ok
        ? unsubscribePage('You are unsubscribed', 'You will not receive any more emails from Trimio. Push notifications and the app itself are unaffected, and you can turn email reminders back on any time in Account Settings.')
        : unsubscribePage('That link did not work', 'It may have been altered or truncated by your email client. You can turn email reminders off directly in the app under Account Settings.')
    );
  } catch (err) {
    handleError(err, res);
  }
});

app.post('/unsubscribe', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const ok = await applyUnsubscribe(req);
    // One-click senders want a 2xx and nothing else; a body or a redirect here
    // gets read as a failure by some providers.
    res.sendStatus(ok ? 200 : 400);
  } catch (err) {
    handleError(err, res);
  }
});

/* ── Account deletion, from a browser ───────────────────────────────────────
   Google Play requires a deletion route reachable WITHOUT installing the app,
   declared in the Data Safety form, on top of the in-app one that already
   exists in Account Settings. This page is that route. It deliberately does
   not delete anything by itself: deletion needs the account password or a
   fresh Google sign in, neither of which belongs in a URL, so it explains the
   in-app path and gives an email address for anyone who cannot reach it. */
/* NOT FROM_EMAIL. That is the SENDING address, `noreply@` by convention and
   `noreply@trimio.app` by default, on a domain this project does not even own.
   Telling somebody to email a no-reply address, on the one page whose entire
   job is to give them a way to reach us, would have published a dead end to
   Google. The support address is the one the legal documents already use in
   23 places. */
const SUPPORT_EMAIL = 'Trimio@subtrimio.com';

const DELETE_PAGE = {
  en: {
    title: 'Delete your Trimio account',
    body: `In the app, open <strong>Profile &rarr; Account Settings</strong>, scroll to the bottom and tap
     <strong>Delete My Account</strong>. You will be asked for your password, or to confirm with Google
     if you signed in that way.<br /><br />
     This permanently removes your account, every subscription you tracked, your settings and your
     notification history. It cannot be undone.<br /><br />
     If you no longer have the app installed, email
     <a href="mailto:${SUPPORT_EMAIL}" style="color:#1F7A62">${SUPPORT_EMAIL}</a> from the address on
     the account and it will be deleted for you.`,
  },
  de: {
    title: 'Trimio Konto löschen',
    body: `Öffne in der App <strong>Profil &rarr; Kontoeinstellungen</strong>, scrolle nach unten und
     tippe auf <strong>Mein Konto löschen</strong>. Du wirst nach deinem Passwort gefragt, oder nach
     einer Bestätigung mit Google, falls du dich so angemeldet hast.<br /><br />
     Damit werden dein Konto, alle erfassten Abos, deine Einstellungen und dein
     Benachrichtigungsverlauf dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.<br /><br />
     Wenn du die App nicht mehr installiert hast, schreib von der Adresse des Kontos an
     <a href="mailto:${SUPPORT_EMAIL}" style="color:#1F7A62">${SUPPORT_EMAIL}</a>, dann löschen wir
     es für dich.`,
  },
};

app.get('/delete-account', (req, res) => {
  /* Play only needs one URL, but somebody asking to delete their account should
     not have to read a second language to do it. Accept-Language is the only
     signal a server-rendered page has, and only the FIRST tag counts: browsers
     send the preferred language first, so matching `de` anywhere would serve
     German to "en-GB,de;q=0.7", who plainly asked for English. */
  const wantsGerman = /^\s*de\b/i.test(req.headers['accept-language'] || '');
  const copy = wantsGerman ? DELETE_PAGE.de : DELETE_PAGE.en;
  res.type('html').send(unsubscribePage(copy.title, copy.body));
});
// Every URL advertised here uses the www host. The bare domain 301s to www at
// the DNS level, so listing bare URLs meant publishing redirects as the
// preferred address and splitting ranking signals across two hosts.
const SITE = 'https://www.subtrimio.com';
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  // The two language versions are declared as alternates of each other, which
  // is what tells Google they are one page in two languages rather than
  // duplicate content competing with itself.
  const alts = `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/"/>`
             + `<xhtml:link rel="alternate" hreflang="de" href="${SITE}/de"/>`
             + `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`;
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
    + 'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    + `<url><loc>${SITE}/</loc>${alts}</url>\n`
    + `<url><loc>${SITE}/de</loc>${alts}</url>\n`
    + `<url><loc>${SITE}/privacy-policy</loc>`
    + `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/privacy-policy"/>`
    + `<xhtml:link rel="alternate" hreflang="de" href="${SITE}/de/datenschutz"/>`
    + '</url>\n'
    + `<url><loc>${SITE}/de/datenschutz</loc>`
    + `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/privacy-policy"/>`
    + `<xhtml:link rel="alternate" hreflang="de" href="${SITE}/de/datenschutz"/>`
    + '</url>\n'
    + `<url><loc>${SITE}/terms</loc>`
    + `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/terms"/>`
    + `<xhtml:link rel="alternate" hreflang="de" href="${SITE}/de/nutzungsbedingungen"/>`
    + '</url>\n'
    + `<url><loc>${SITE}/de/nutzungsbedingungen</loc>`
    + `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/terms"/>`
    + `<xhtml:link rel="alternate" hreflang="de" href="${SITE}/de/nutzungsbedingungen"/>`
    + '</url>\n'
    + '</urlset>\n');
});

// Plain server-rendered HTML so Play Console's "must link directly to the
// policy text, no extra navigation" check passes — the in-app screen at
// app/privacy-policy.tsx is the source of truth; keep this in sync with it.
// Server-rendered like the privacy policy so it can be linked directly from
// the site, the signup consent, and Play Console. Written to describe what
// Trimio actually does: no bank connection, manual entry, Google as the
// seller of record. Section 10 is the important one for this product, since
// the whole promise is a reminder arriving in time.
const TERMS_SECTIONS = [
  { title: "1. Who We Are", body: "Trimio is operated by Ismael Naranjo, based in Vienna, Austria. You can reach us at Trimio@subtrimio.com. These Terms of Service govern your use of the Trimio mobile application, the Trimio website, and related services (the \"Service\")." },
  { title: "2. Acceptance", body: "By downloading the app, creating an account, or otherwise using the Service, you agree to these Terms. If you do not agree, please do not use the Service. Your use is also governed by our Privacy Policy, which explains how your information is handled." },
  { title: "3. Eligibility", body: "You must be at least 16 years old to create a Trimio account. If you are younger, you may use the Service only with the consent and supervision of a parent or legal guardian who accepts these Terms on your behalf." },
  { title: "4. What Trimio Does and Does Not Do", body: "Trimio helps you keep track of subscriptions you tell it about, and reminds you before a renewal date you have entered. Trimio does not connect to your bank, does not read your transactions, does not hold or move money, and cannot cancel a subscription on your behalf. Every subscription in Trimio is one you added yourself, and every renewal date is one you provided or confirmed." },
  { title: "5. Your Account", body: "You must provide a valid email address to create an account. You are responsible for keeping your password confidential and for activity that happens under your account. Please tell us promptly at Trimio@subtrimio.com if you believe your account has been used without your permission." },
  { title: "6. Your Content", body: "The subscription details you enter remain yours. You grant us only the permission needed to store that information and show it back to you, and to operate features you have enabled, such as reminders. We do not sell your content and we do not use it for advertising." },
  { title: "7. Free and Premium Plans", body: "Trimio is free to use for up to five subscriptions. Premium removes that limit and unlocks additional features, described in the app at the point of purchase. Premium is offered as a monthly or yearly auto renewing subscription, or as a lifetime one time purchase. The lifetime option does not renew and is charged once." },
  { title: "8. Payments, Renewals and Refunds", body: "Premium is sold through Google Play Billing, and Google, not Trimio, is the seller of record. Prices are shown in the app before you confirm. A monthly or yearly plan renews automatically at the listed price unless you cancel at least 24 hours before the renewal date, and you manage or cancel it in your Google Play account rather than in Trimio. Refund requests are handled by Google under Google Play policies. We never see or store your card details." },
  { title: "9. Right of Withdrawal", body: "If you are a consumer in the European Union you normally have fourteen days to withdraw from a distance contract. Because Premium is delivered immediately on purchase, that right may end once delivery begins and you have acknowledged it, in line with Section 18 of the Austrian Fern und Auswaertsgeschaefte Gesetz. As Google is the seller of record, exercise any withdrawal or refund right through Google Play. Nothing here removes rights you have by law." },
  { title: "10. Reminders Are Best Effort", body: "Trimio sends reminders on a best effort basis. Delivery depends on things outside our control, including your device settings, notification permissions, battery optimisation, network availability, email filtering, and the accuracy of the dates you entered. A reminder may be delayed or may not arrive. You remain responsible for your own subscriptions, for cancelling anything you no longer want, and for any charge made by a third party. Trimio is a reminder, not a guarantee." },
  { title: "11. Accuracy and Not Financial Advice", body: "Trimio shows totals and dates based on what you entered, so its figures are only as accurate as that information. It does not provide financial, tax, legal, or investment advice, and nothing in the Service is a recommendation to buy, keep, or cancel anything." },
  { title: "12. Acceptable Use", body: "Please do not use the Service to break the law, to infringe anyone's rights, to attempt unauthorised access to our systems or another person's account, to disrupt or overload the Service, to reverse engineer it except where that right cannot lawfully be restricted, or to resell or redistribute it without our permission." },
  { title: "13. Availability and Changes", body: "We aim to keep the Service running and accurate, but it is offered as it is. We may add, change, or remove features, and we may suspend the Service for maintenance. If we plan to discontinue the Service entirely, we will give you reasonable notice so you can export or record your data." },
  { title: "14. Intellectual Property", body: "The Trimio name, logo, design, and software belong to us and are protected by law. These Terms give you a personal, non exclusive, non transferable, revocable licence to use the Service. Names and logos of the subscription services you track belong to their respective owners, and Trimio is not affiliated with or endorsed by them." },
  { title: "15. Suspension and Termination", body: "You may stop using the Service and delete your account at any time from Profile, then Account Settings. Deleting your account permanently removes your data as described in the Privacy Policy. We may suspend or close an account that breaches these Terms, that is used unlawfully, or that puts the Service or other people at risk, and where it is reasonable to do so we will tell you why and give you a chance to put things right." },
  { title: "16. Liability", body: "Nothing in these Terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, for fraud, or under mandatory consumer protection or product liability rules. Subject to that, the Service is provided as it is, we are not liable for indirect or consequential loss, and we are not liable for a subscription charge you incurred because a reminder was late, missing, or based on a date entered incorrectly. Our total liability in any twelve month period is limited to the greater of the amount you paid us in that period or fifty euro." },
  { title: "17. Your Statutory Rights", body: "If you are a consumer, you keep all rights given to you by the mandatory law of your country of residence. Where these Terms conflict with such a right, that right prevails." },
  { title: "18. Changes to These Terms", body: "We may update these Terms as the Service develops or the law changes. If a change is material we will give you reasonable notice in the app or by email before it takes effect. Continuing to use the Service after that point means you accept the updated Terms. If you do not accept them, you may delete your account." },
  { title: "19. Governing Law", body: "These Terms are governed by Austrian law, excluding its conflict of law rules and the UN Convention on Contracts for the International Sale of Goods. If you are a consumer, you may also rely on the mandatory law of your country of residence, and you may bring proceedings in the courts of that country. The European Commission provides an online dispute resolution platform at ec.europa.eu/consumers/odr." },
  { title: "20. Contact", body: "Questions about these Terms are welcome at Trimio@subtrimio.com." },
];

const PRIVACY_POLICY_SECTIONS = [
  { title: '1. Who We Are', body: 'Trimio is operated by Ismael Naranjo, based in Vienna, Austria, who acts as the data controller under the General Data Protection Regulation (GDPR). You can reach us at Trimio@subtrimio.com.' },
  { title: '2. Information We Collect', body: "We collect only what's necessary to operate Trimio: account information (email address, encrypted password, account creation date, and account identifier: passwords are hashed using bcrypt and never stored in plain text); the subscription data you manually enter (service name, billing amount and currency, billing cycle, renewal date, and category); premium subscription information from RevenueCat (subscription status, purchase and expiration dates, premium entitlement status, and anonymous customer identifiers: we never receive or store your payment card details, as all payments are processed by Google Play Billing); device and diagnostic information (device model, OS version, app version, crash reports, and anonymous performance metrics); and product usage analytics (which in-app actions you take, such as completing onboarding or adding a subscription, linked to an internal account identifier rather than your name or email) to help us maintain and improve the Service." },
  { title: '3. How We Use Your Information', body: 'We use your information to create and manage your account, authenticate your identity, deliver the core subscription tracking features, verify active Premium subscriptions, send renewal reminder emails and notifications where enabled, improve application performance and stability, detect and prevent fraud or abuse, respond to support requests, and comply with legal obligations. We do not sell your personal information and do not use it for advertising purposes.' },
  { title: '4. Legal Basis for Processing (GDPR)', body: 'Account creation and authentication, storing the subscription data you enter, and verifying Premium subscription status are necessary for the performance of a contract (Art. 6(1)(b) GDPR). Sending renewal reminder emails relies on your consent (Art. 6(1)(a) GDPR), which you may withdraw at any time without affecting the lawfulness of prior processing. Crash reporting, diagnostics, product usage analytics, and fraud prevention rely on our legitimate interest in maintaining and improving a stable and secure service (Art. 6(1)(f) GDPR). Any processing required to comply with legal obligations relies on Art. 6(1)(c) GDPR.' },
  { title: '5. Third-Party Service Providers', body: 'Trimio uses a small number of trusted providers to operate the Service, each bound by appropriate data processing agreements: Railway (cloud hosting infrastructure, United States), RevenueCat (subscription management, United States), Google Play Billing (payment processing, United States), Sentry (crash reporting and diagnostics, United States), PostHog (product usage analytics, European Union), and Brevo/Sendinblue (transactional and reminder emails, European Union).' },
  { title: '6. International Data Transfers', body: 'Some of our service providers are located in the United States. When your personal data is transferred outside the European Economic Area (EEA), we ensure appropriate safeguards are in place in accordance with GDPR Chapter V. For transfers to US-based providers (Railway, RevenueCat, Google, Sentry) we rely on Standard Contractual Clauses (SCCs) approved by the European Commission, or an equivalent transfer mechanism where applicable. PostHog and Brevo/Sendinblue process data within the EEA, so no such transfer mechanism is needed for them.' },
  { title: '7. Payments', body: 'All purchases are handled by Google Play Billing, and subscription validation is performed using RevenueCat. Trimio never has access to your credit or debit card details, bank account information, or any other payment credentials.' },
  { title: '8. Data Security', body: 'We implement appropriate technical and organizational safeguards, including HTTPS encrypted communication, secure password hashing (bcrypt), restricted server access, secure cloud infrastructure (Railway), regular software updates, and access controls to protect personal information. No online service can guarantee absolute security. If you become aware of any security concern, contact us immediately at Trimio@subtrimio.com.' },
  { title: '9. Data Retention', body: 'We retain personal information only for as long as necessary to provide the Service, maintain your account, fulfill contractual obligations, comply with applicable laws, resolve disputes, and prevent fraud. When you delete your account, your personal information is permanently deleted within 30 days, unless a longer retention period is required by applicable law.' },
  { title: '10. Account Deletion', body: 'You may permanently delete your account at any time through the Account Settings screen inside the app. If you cannot access your account, contact us at Trimio@subtrimio.com. Once processed, your personal information will be permanently deleted within 30 days unless legal obligations require otherwise.' },
  { title: '11. Your Privacy Rights', body: 'Under the GDPR, you have the right to access a copy of the personal information we hold about you, rectify inaccurate or incomplete information, request erasure of your personal information, restrict how we process your information, object to processing based on legitimate interests, receive your data in a structured, commonly used, machine-readable format (available to all users regardless of subscription tier), and withdraw consent at any time where processing is based on consent. To exercise any of these rights, contact us at Trimio@subtrimio.com. We aim to respond within the timeframe required by applicable law, generally within 30 days.' },
  { title: '12. Right to Lodge a Complaint', body: 'If you believe we have not handled your personal information in accordance with applicable law, you have the right to lodge a complaint with the competent supervisory authority. For users in Austria, this is the Österreichische Datenschutzbehörde (DSB), Barichgasse 40-42, 1030 Vienna, Austria (www.dsb.gv.at, dsb@dsb.gv.at). We encourage you to contact us first so we can address your concern directly.' },
  { title: '13. Data Sharing', body: 'We do not sell, rent, lease, or trade your personal information. We share information only when necessary to operate the Service through our listed providers, process Premium subscriptions, provide customer support, detect fraud or abuse, comply with legal obligations, or protect the rights, safety, and security of our users or our business.' },
  { title: "14. Children's Privacy", body: 'Trimio is not intended for children under the age of 16. Article 8 of the GDPR lets each member state set its own digital consent age between 13 and 16: Austria sets it at 14, Germany at 16. Trimio applies 16 across every market it serves, which is the stricter of the two and matches the minimum age in our Terms of Service. We do not knowingly collect personal information from children under 16 without verifiable parental consent. If we become aware that personal information has been collected from a child under 16 without appropriate consent, we will promptly delete that information.' },
  { title: '15. Cookies and Analytics', body: 'Trimio does not use advertising cookies or advertising identifiers, and does not sell or share analytics data with advertisers. Crash and performance diagnostics are anonymous. Product usage analytics (via PostHog, hosted in the EU) are linked to an internal account identifier so we can see, for example, where people drop off during onboarding, but never to your name, email, or the specific subscriptions you track, session recording and automatic screen capture are both turned off. The Trimio website at subtrimio.com uses the same EU hosted PostHog to count page views and whether a visit led to an account being created. It sets no cookies and stores nothing on your device, it honours the Do Not Track setting in your browser, and it never sends anything you type into a form.' },
  { title: '16. Business Transfers', body: 'If Trimio is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. Any successor will remain bound by the commitments in this Privacy Policy.' },
  { title: '17. Changes to This Privacy Policy', body: 'We may update this Privacy Policy periodically to reflect legal, technical, or operational changes. When significant updates are made, we will revise the "Last Updated" date and notify users within the application where appropriate. Continued use of the Service after an update constitutes acceptance of the revised Privacy Policy.' },
  { title: '18. Contact Us', body: 'For any questions, requests, or concerns regarding this Privacy Policy or our privacy practices, contact us at Trimio@subtrimio.com. We aim to respond to all privacy-related inquiries within 30 days.' },
];

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// The German copies live in backend/legal-de.json rather than as more arrays
// here, because generating JS string literals for 15,000 characters of legal
// prose is a quoting accident waiting to happen. tools/check-legal-sync.py
// checks the JSON against these arrays, so the two cannot drift apart.
const LEGAL_DE = require('./legal-de.json');
const toSections = (pairs) => pairs.map(([title, body]) => ({ title, body }));

function legalPage(title, updated, intro, sections, lang) {
  const body = sections.map(
    (s) => `<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body)}</p>`
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1F2937; line-height: 1.6; }
  h1 { font-size: 26px; } h2 { font-size: 18px; margin-top: 32px; }
  p { color: #374151; }
  .updated { color: #6B7280; font-size: 13px; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="updated">${escapeHtml(updated)}</p>
<p>${escapeHtml(intro)}</p>
${body}
</body>
</html>`;
}

app.get('/privacy-policy', (req, res) => {
  res.set('Content-Type', 'text/html').send(legalPage(
    'Trimio Privacy Policy',
    'Effective date: April 27, 2025 \u00b7 Last updated: September 4, 2026',
    'Thank you for choosing Trimio. This Privacy Policy explains how Trimio collects, uses, stores, protects, and shares your information when you use the Trimio mobile application and related services (the "Service"). By creating an account or using the Service, you acknowledge that you have read and understood this Privacy Policy.',
    PRIVACY_POLICY_SECTIONS));
});

app.get('/terms', (req, res) => {
  res.set('Content-Type', 'text/html').send(legalPage(
    'Trimio Terms of Service',
    'Effective date: September 4, 2026 \u00b7 Last updated: September 4, 2026',
    'These Terms of Service set out the agreement between you and Trimio. Please read them alongside our Privacy Policy, which explains how your information is handled.',
    TERMS_SECTIONS));
});

// German copies of both documents. The app and the Play listing are German, so
// serving the terms and the privacy policy only in English left the two
// documents a German user is most entitled to understand in a language the
// rest of the product had already stopped using. Same effective dates as the
// English, because they are the same documents.
/* The heading, the date line and the intro used to be inline string literals
   here, while the SECTIONS came from legal-de.json. That split meant the app
   could not render a complete German document without either importing this
   file or copying three strings, and a copy is a thing that drifts. They now
   live in legal-de.json alongside the sections, so the served page and the
   in-app screen read the same source and cannot disagree. */
app.get('/de/datenschutz', (req, res) => {
  res.set('Content-Type', 'text/html').send(legalPage(
    LEGAL_DE.meta.privacyTitle,
    LEGAL_DE.meta.privacyUpdated,
    LEGAL_DE.meta.privacyIntro,
    toSections(LEGAL_DE.privacy), 'de'));
});
app.get('/de/nutzungsbedingungen', (req, res) => {
  res.set('Content-Type', 'text/html').send(legalPage(
    LEGAL_DE.meta.termsTitle,
    LEGAL_DE.meta.termsUpdated,
    LEGAL_DE.meta.termsIntro,
    toSections(LEGAL_DE.terms), 'de'));
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

/* For the two unauthenticated token endpoints, /api/auth/google and
   /api/auth/refresh. They were the only routes left with no ceiling at all,
   which is easy to miss because neither is a password endpoint and the mount
   list below reads complete without them.

   DELIBERATELY MUCH LOOSER THAN authLimiter, and that is the whole design of
   it. authLimiter's 10 per 15 minutes is right for logging in, which one
   person does rarely. A refresh is different: the access token lives an hour,
   so EVERY active user refreshes roughly hourly, and mobile carriers put large
   numbers of subscribers behind a single CGNAT address. express-rate-limit
   keys on IP, so a tight ceiling here would be spent by ordinary traffic from
   one carrier and would sign real people out. That is a worse outcome than the
   abuse it would prevent.

   240 per 15 minutes is far above anything a shared address produces at this
   scale and still bounds an attacker to something that cannot exhaust the
   service. The ceiling is the point, not its exact height: raise it if real
   traffic ever approaches it, do not remove it.

   Neither endpoint is an auth bypass, the token checks themselves are sound
   (/api/auth/google verifies through google-auth-library with the audience
   pinned, /api/auth/refresh matches a hashed 40 byte random token). This is
   about not lending the service out: google verification makes an OUTBOUND
   call to Google before anything can reject it, so an unlimited caller gets
   this server doing paid network work on demand. */
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 240,
  message: { error: 'Too many requests. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/google', tokenLimiter);
app.use('/api/auth/refresh', tokenLimiter);
app.use('/api/auth/forgot-password', emailLimiter);
app.use('/api/auth/resend-verification', emailLimiter);
app.use('/api/auth/verify-email', codeLimiter);
app.use('/api/auth/reset-password', codeLimiter);
app.use('/api/auth/account', authLimiter);
app.use('/api/trpc', apiLimiter);

/* POSTGRES TLS, and why verification is off by default here.
 *
 * Railway's Postgres image generates its OWN private CA and signs the server
 * certificate with it. No public root signs it, so `rejectUnauthorized: true`
 * with the system trust store fails the handshake outright, and the public TCP
 * proxy additionally presents a certificate for a name that is not the host you
 * dialled. There is therefore no configuration of "verify against the public
 * CAs" that both works and means anything.
 *
 * So the connection is ENCRYPTED but UNAUTHENTICATED, and the honest threat
 * model is: passive eavesdropping on the path is covered, active
 * man-in-the-middle is not. What limits that is the path, not the TLS. App and
 * database are in one Railway project and the URL Railway injects resolves on
 * its private network, so an attacker needs to already be inside it.
 *
 * DATABASE_CA_CERT is the way to close the rest, and the reason this is not
 * simply left as a comment. Railway's CA is available from the Postgres service
 * itself; paste its PEM into that variable and this verifies properly, with no
 * code change. Unset, behaviour is exactly what it was, so nothing about the
 * running deployment changes today. */
const DATABASE_CA_CERT = process.env.DATABASE_CA_CERT;
if (process.env.DATABASE_URL) {
  console.log('Postgres TLS:', DATABASE_CA_CERT
    ? 'verifying the server certificate against DATABASE_CA_CERT'
    : 'encrypted, certificate NOT verified (set DATABASE_CA_CERT to verify)');
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? (DATABASE_CA_CERT ? { ca: DATABASE_CA_CERT, rejectUnauthorized: true } : { rejectUnauthorized: false })
    : false,
  // Recycle idle clients well before Railway's Postgres (or a proxy in
  // between) silently closes them -- otherwise the pool hands out a
  // connection it thinks is fine but the far end has already dropped,
  // which surfaces as ECONNRESET on the next query after a quiet period
  // (e.g. the first request after overnight low traffic).
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Without this, an error on a client sitting idle in the pool (as opposed
// to one actively running a query) has no listener and crashes the whole
// process instead of just failing the query that eventually hits it.
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err);
});

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@trimio.app';
console.log('BREVO_API_KEY set:', !!BREVO_API_KEY);
console.log('FROM_EMAIL:', FROM_EMAIL);

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://www.subtrimio.com';

/* Signs the user id so an unsubscribe link cannot be used to opt somebody
   else out by editing the number in the URL. HMAC rather than a stored token
   because it needs no table and never expires, which is the correct lifetime
   for "stop emailing me". */
function unsubscribeToken(userId) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`unsub:${userId}`).digest('hex').slice(0, 32);
}

function unsubscribeUrlFor(userId) {
  return `${PUBLIC_URL}/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}

/* Every bulk email carries a visible opt out. Gmail and Yahoo have required
   one-click List-Unsubscribe from bulk senders since February 2024, and
   without it deliverability degrades for every message including the
   transactional ones, so this is a inbox-placement matter as much as a legal
   one. The win-back email is plainly marketing; the renewal digest is the
   service people asked for, but it is still recurring bulk mail and the same
   rules apply to it. */
function emailFooter(unsubscribeUrl) {
  if (!unsubscribeUrl) return '';
  return `<p style="color:#8A949B;font-size:12px;text-align:center;margin-top:28px;line-height:1.6">
      You are receiving this because you turned on email reminders in Trimio.<br />
      <a href="${unsubscribeUrl}" style="color:#1F7A62">Unsubscribe from Trimio emails</a>
    </p>`;
}

async function sendEmail(to, subject, html, opts = {}) {
  const { retries = 3, unsubscribeUrl = null } = opts;
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
          ...(unsubscribeUrl ? {
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          } : {}),
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
    `<div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;background:#F7F6F1;border-radius:12px">
      <h2 style="color:#142B3A;margin-bottom:8px">Verify your Trimio email</h2>
      <p style="color:#52616B">Enter this code in the app to activate your account:</p>
      <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#142B3A;text-align:center;padding:24px 0">${code}</div>
      <p style="color:#52616B;font-size:12px">This code expires in 24 hours. If you didn't create a Trimio account, ignore this email.</p>
    </div>`
  );
}

/* The confirmation that an account is gone.

   Not required by Play or by GDPR, and added because without it the only way to
   find out your account was deleted is to open the app and find yourself logged
   out. Deletion needs the password or a fresh Google sign in, so a stolen token
   alone cannot do it, but the person whose account it was should still be told
   by the one channel that does not depend on them still having the app.

   It carries NO unsubscribe footer, unlike every bulk email here. Two reasons:
   this is transactional rather than bulk, so RFC 8058 does not apply, and
   unsubscribeUrlFor HMACs the user id, which by this point names a row that no
   longer exists. The link would resolve to nothing. */
const DELETED_EMAIL = {
  en: {
    subject: 'Your Trimio account has been deleted',
    heading: 'Your account has been deleted',
    body: `Your Trimio account is gone, along with every subscription you tracked, your settings,
     your reminders and your notification history. Nothing was kept, and this cannot be undone.`,
    warn: `If this was not you, contact us straight away at`,
    thanks: 'Thanks for having used Trimio.',
  },
  de: {
    subject: 'Dein Trimio Konto wurde gelöscht',
    heading: 'Dein Konto wurde gelöscht',
    body: `Dein Trimio Konto ist gelöscht, zusammen mit allen erfassten Abos, deinen Einstellungen,
     deinen Erinnerungen und deinem Benachrichtigungsverlauf. Es wurde nichts aufbewahrt, und das
     lässt sich nicht rückgängig machen.`,
    warn: `Falls du das nicht warst, melde dich sofort bei uns unter`,
    thanks: 'Danke, dass du Trimio genutzt hast.',
  },
};

async function sendAccountDeletedEmail(to, wantsGerman) {
  const c = wantsGerman ? DELETED_EMAIL.de : DELETED_EMAIL.en;
  await sendEmail(
    to,
    c.subject,
    `<div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;background:#F7F6F1;border-radius:12px">
      <h2 style="color:#142B3A;margin-bottom:8px">${c.heading}</h2>
      <p style="color:#52616B;line-height:1.6">${c.body}</p>
      <p style="color:#52616B;line-height:1.6">${c.warn}
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#1F7A62">${SUPPORT_EMAIL}</a>.</p>
      <p style="color:#8A949B;font-size:12px;margin-top:24px">${c.thanks}</p>
    </div>`
  );
}

// crypto.randomInt, not Math.random: these codes gate email verification and
// password resets, and Math.random's PRNG state is recoverable from enough
// observed outputs, which is not a property you want on a reset code.
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/* The public account identifier, and the app_user_id RevenueCat knows a
 * subscriber by.
 *
 * It is not a secret and nothing authorises on it: the webhook that can grant
 * premium is guarded by REVENUECAT_WEBHOOK_SECRET, and verify-premium reads
 * the open_id off the authenticated user's own row rather than from a request.
 * So this is a hardening of a bad default rather than a hole being closed. It
 * used to be Date.now() plus Math.random(), which is guessable in both halves.
 *
 * ONLY NEW ACCOUNTS ARE AFFECTED. Existing open_id values stay exactly as they
 * are, which matters because they are the key RevenueCat already has for every
 * current subscriber: regenerating one would detach a paying customer from
 * their entitlement. Nothing here rewrites a stored value. */
function generateOpenId() {
  return 'u_' + crypto.randomBytes(16).toString('hex');
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
        .map((r) => `${r.name} (${symbol}${parseFloat(r.price).toFixed(2)}/${r.billing_cycle}) · ${new Date(r.relevant_date).toISOString().slice(0, 10)}`)
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

/* Compares a stored token hash against a code somebody supplied, in constant
 * time. The two callers are email verification and password reset.
 *
 * HONEST ABOUT THE SIZE OF THIS: it is consistency rather than a hole being
 * closed. What `!==` compared was two SHA-256 hashes, not the secret itself,
 * so leaking where they diverge tells an attacker which hash prefix they hit
 * and there is no way to walk backwards from that to a code. codeLimiter caps
 * the endpoint at 10 tries per 15 minutes on top. The reason to change it is
 * that applyUnsubscribe already does this properly and a reader comparing the
 * three should not have to work out why one of them is different.
 *
 * Coerces the supplied value because it arrives from req.body and does not
 * have to be a string. `{"code": {}}` used to reach crypto.update(), which
 * throws a TypeError and answers 500 where the honest reply is "invalid". */
/* Constant time compare for a raw shared secret, used by the two cron routes.
 *
 * SEPARATE FROM tokenMatches AND MORE DESERVING OF IT. tokenMatches compares
 * two SHA-256 hashes, so what an early exit leaks is a hash prefix and there is
 * no path back to the code. These routes compare the SECRET ITSELF, so an early
 * exit leaks the secret's own prefix. Network jitter swamps the difference in
 * practice and this was never the weak point, but the cheaper of the two
 * comparisons should not be the careful one.
 *
 * Refuses outright when the expected value is unset rather than treating absent
 * as a match, which is what `!process.env.CRON_SECRET ||` did before and is
 * preserved deliberately: with no secret configured the route must reject
 * everything, never accept everything. */
function secretMatches(supplied, expected) {
  if (typeof expected !== 'string' || expected.length === 0) return false;
  if (typeof supplied !== 'string' || supplied.length === 0) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // Length alone is not secret here, and timingSafeEqual throws without this.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function tokenMatches(storedHash, suppliedCode) {
  if (typeof storedHash !== 'string' || storedHash.length === 0) return false;
  if (suppliedCode == null) return false;
  const a = Buffer.from(storedHash);
  const b = Buffer.from(hashToken(String(suppliedCode)));
  // Both are sha256 hex so the lengths always agree, but timingSafeEqual
  // THROWS on a mismatch rather than returning false, so it is checked.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  /* referred_by was created with no ON DELETE action, so Postgres defaults to
     NO ACTION and REFUSES to delete any account that has successfully referred
     somebody: the referred user's row still points at them. Account deletion
     returned a 500 for exactly the users the referral programme rewards most,
     and it broke two obligations at once, Google Play's account deletion
     requirement and the GDPR right to erasure.

     SET NULL keeps the referred person's account intact and simply forgets who
     sent them, which is the right trade: their bonus month was already granted
     and claimed through referral_rewarded, so nothing is clawed back.

     Done by lookup rather than by guessing the constraint name, because a
     DROP CONSTRAINT IF EXISTS against the wrong name silently succeeds and
     then the ADD below creates a SECOND constraint with the old behaviour
     still attached. */
  await pool.query(`
    DO $$
    DECLARE fk text;
    BEGIN
      SELECT con.conname INTO fk
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.conrelid = 'users'::regclass
        AND con.contype = 'f'
        AND att.attname = 'referred_by'
        AND con.confdeltype <> 'n';          -- 'n' is already ON DELETE SET NULL
      IF fk IS NOT NULL THEN
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', fk);
        ALTER TABLE users ADD CONSTRAINT users_referred_by_fkey
          FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_premium_until TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  /* Which billing date a reminder email has already gone out for.

     There was no send record at all, so the cron had no way to know it had
     already written. Running daily, a renewal three days out got an email on
     day 3, day 2 AND day 1: three messages for one renewal, from a screen that
     previews exactly one date per subscription.

     Keyed to the DATE rather than a timestamp, so it resets itself. When the
     cycle advances, next_billing_date no longer equals this and the next
     renewal sends normally, with nothing to clean up. */
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_sent_for TIMESTAMPTZ`);
  /* The day of the month this subscription is really billed on.

     next_billing_date cannot carry it, because a month is not a fixed length.
     A subscription due on the 31st has to be written as 28 February, and once
     that clamped value is persisted it becomes the anchor for the NEXT
     advance, so the 31st turns into the 28th permanently after its first
     February. Within a single call the anchor survived; across two requests
     with a database write between them it did not, which is the shape every
     real advance takes.

     Backfilled from the day next_billing_date already says. That recovers
     nothing for a row that has already drifted, and it must not pretend
     otherwise: a stored 28 February cannot tell you whether the customer meant
     28, 29, 30 or 31, and guessing would move real billing dates on real
     subscriptions to settle a question the data cannot answer. Writing only
     the new column leaves every existing date exactly where it is, so the
     worst case is the behaviour we already had, and everything created or
     edited from now on carries the true day. */
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_anchor_day SMALLINT`);
  await pool.query(`
    UPDATE subscriptions
       SET billing_anchor_day = EXTRACT(DAY FROM (next_billing_date AT TIME ZONE 'UTC'))::smallint
     WHERE billing_anchor_day IS NULL
       AND next_billing_date IS NOT NULL
  `);
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
      email_reminders BOOLEAN DEFAULT FALSE,
      renewal_alert_days INTEGER DEFAULT 3
    )
  `);
  await pool.query(`ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS renewal_alert_days INTEGER DEFAULT 3`);
  // The column above was originally added with DEFAULT TRUE, which silently
  // opted every user into renewal emails at signup with no explicit
  // consent -- inconsistent with this app's own "we ask, we don't assume"
  // positioning. ADD COLUMN IF NOT EXISTS is a no-op once the column
  // already exists in production, so the default has to be corrected
  // explicitly for it to actually take effect there.
  await pool.query(`ALTER TABLE notification_preferences ALTER COLUMN email_reminders SET DEFAULT FALSE`);
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
  /* A FOREIGN KEY DOES NOT CREATE AN INDEX on the referencing side in Postgres,
     which is the easiest performance hole in this schema to miss: the three
     indexes above were added by hand and price_history was left with none.
     subscription_id is the one that costs: subscriptions.list, the most loaded
     query in the app, runs a LEFT JOIN LATERAL over price_history ONCE PER
     SUBSCRIPTION ROW, so unindexed that is a sequential scan of the whole table
     per subscription per load. user_id matters for the same table's own reads
     and for account deletion, which cascades into price_history from BOTH
     columns and would otherwise scan it twice.
     Invisible today because the table is nearly empty, which is exactly why it
     is cheap to fix now rather than after it starts to hurt.
     notification_preferences.user_id and user_settings.user_id need nothing:
     both are PRIMARY KEY, which Postgres indexes. */
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_price_history_subscription_id ON price_history(subscription_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_price_history_user_id ON price_history(user_id)`);
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

/* Looks up the subscriber directly on RevenueCat's servers, so premium can
   never be granted by calling our own API with { isPremium: true }. There is no
   fallback to the client-reported value: with no key the caller refuses with
   503 rather than believing anyone. This comment used to say the client was
   trusted as a fallback, which described the hole that was removed.

   It THROWS on any non-ok response rather than returning false, and that is
   load bearing. Returning false would read a RevenueCat outage as "not a
   subscriber" and the caller would write is_paid = false, cancelling a paying
   customer because a third party had a bad afternoon. Throwing reaches the
   handler's catch, which answers 500 and writes nothing, so a transient failure
   leaves an existing entitlement exactly as it was. */
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

/* Writes the VERIFIED entitlement for a set of RevenueCat appUserIDs.

   This exists for TRANSFER, whose payload says who was involved in a transfer
   and nothing at all about who ends up entitled. Deciding that from the
   direction of transferred_from/transferred_to would mean writing is_paid from
   a guess about an array whose order RevenueCat explicitly does not guarantee,
   and the wrong guess cancels somebody who is paying. So each id is looked up
   instead, through the same authoritative read verify-premium uses.

   Ids we do not know are skipped without an API call. That is the normal case
   rather than an error: a transfer routinely involves RevenueCat's own
   anonymous ids ($RCAnonymousID:...), created before a user signs in, which
   name no account here.

   It THROWS on a RevenueCat failure, for the same reason the lookup does: the
   handler's catch answers 500, RevenueCat retries the delivery, and nothing is
   written in the meantime. Swallowing it would write nothing AND report
   success, which is the shape of a bug nobody ever finds. */
async function reconcileEntitlementsFromRevenueCat(openIds) {
  const known = await pool.query(
    'SELECT open_id, email FROM users WHERE open_id = ANY($1::text[])',
    [openIds]
  );
  for (const row of known.rows) {
    const isPremium = await fetchPremiumEntitlementFromRevenueCat(row.open_id);
    await pool.query(
      `UPDATE users SET is_paid = $1,
         paid_at = CASE WHEN $1 AND paid_at IS NULL THEN NOW() ELSE paid_at END,
         cancelled_at = CASE WHEN $1 THEN NULL ELSE cancelled_at END,
         win_back_sent_at = CASE WHEN $1 THEN NULL ELSE win_back_sent_at END
       WHERE open_id = $2`,
      [isPremium, row.open_id]
    );
    syncBrevoPlan(row.email, isPremium ? 'premium' : 'free');
    console.log(`[revenuecat] TRANSFER reconciled ${row.open_id}: is_paid=${isPremium}`);
  }
  return { checked: known.rows.length, skipped: openIds.length - known.rows.length };
}

// Logs the full error server-side but never leaks internals (DB schema, stack
// traces, etc.) to the client — callers should still send specific 400s for
// validation failures before reaching this.
function handleError(err, res) {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

/* Billing dates are stored as midnight UTC, so all of this works in UTC
   components. The server runs in UTC, and mixing local getters in would make
   the result depend on where the container happens to be.

   `setMonth(getMonth() + 1)` OVERFLOWS, which is the bug this replaces. There
   is no 31 February, so 31 January plus one month is 3 March: February is
   skipped entirely and the day of month is permanently changed to the 3rd.
   Every later advance then compounds from the wrong day.

   Clamping to the last day of the target month is what people mean by monthly,
   and it is what the client's getMonthlyOccurrence already did, so this also
   ends a disagreement between what the calendar drew and what the server
   stored. */
function addMonthsUTC(date, months, anchorDay) {
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const y = firstOfTarget.getUTCFullYear();
  const m = firstOfTarget.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(anchorDay, lastDay)));
}

/* Rolls a billing date forward until it is no longer before `notBefore`.

   `anchorDay` is carried through every step rather than read from the current
   value, so 31 January clamps to 28 February and then returns to 31 March
   instead of sticking at the 28th for the rest of the subscription's life.

   IT HAS TO BE PASSED IN, not derived here, and that is the whole point of the
   fourth parameter. Deriving it from `start` only preserves the day within ONE
   call. A real advance is one call per request with a database write in
   between, so the next request reads back the clamped 28 February and derives
   28 from it: January 31 -> February 28 -> March 28, permanently. Supplying it
   from the stored anchor is what carries the day across that boundary.

   Falling back to the day of `start` when no anchor is given keeps the old
   behaviour for rows that predate the column, which is the correct default: it
   is exactly what the date already says, so nothing moves. */
function advanceBillingDate(start, billingCycle, notBefore, storedAnchorDay) {
  let d = new Date(start);
  const parsedAnchor = Number(storedAnchorDay);
  const anchorDay = Number.isInteger(parsedAnchor) && parsedAnchor >= 1 && parsedAnchor <= 31
    ? parsedAnchor
    : d.getUTCDate();
  let iterations = 0;
  while (d < notBefore && iterations < 1000) {
    iterations++;
    if (billingCycle === 'weekly') d = new Date(d.getTime() + 7 * 86400000);
    else if (billingCycle === 'yearly') d = addMonthsUTC(d, 12, anchorDay);
    else d = addMonthsUTC(d, 1, anchorDay);
  }
  return { date: d, advanced: iterations > 0 };
}

/** Midnight UTC today. Comparing against this rather than the current instant
 *  is what keeps a payment due TODAY in today's alerts: a date stored at
 *  midnight is already "past" by one minute after midnight, so comparing with
 *  `now` advanced it on the morning of the billing day and the alert vanished
 *  before the day it was warning about had even started. */
function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function nextBillingDate(billingCycle) {
  const today = startOfUtcDay();
  const anchorDay = today.getUTCDate();
  if (billingCycle === 'weekly') return new Date(today.getTime() + 7 * 86400000).toISOString();
  if (billingCycle === 'yearly') return addMonthsUTC(today, 12, anchorDay).toISOString();
  return addMonthsUTC(today, 1, anchorDay).toISOString();
}

function toMonthly(price, billingCycle) {
  if (billingCycle === 'weekly') return price * 52 / 12;
  if (billingCycle === 'yearly') return price / 12;
  return price;
}

// The price column is NUMERIC with no scale, so it will happily keep a figure
// like 6.944 that every screen then renders as 6.94. Rounding on the way in
// keeps the stored amount and the shown amount the same number. Clients
// sanitise the field too, but they are not the only writer and older builds
// are still out there, so this is where it has to hold.
function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
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

/* Referral codes avoid visually ambiguous characters (0/O, 1/I/L).
 *
 * crypto.randomInt for the same reason generateCode above gives, and it was
 * using Math.random while that comment sat two screens away saying why not to.
 * A referral code is worth a free month, and Math.random's PRNG state is
 * recoverable from enough observed outputs, so somebody who can mint codes of
 * their own could narrow what other codes look like. Brute force was never the
 * exposure here (31^6 is about 887 million against a 60 per minute ceiling),
 * predictability was.
 *
 * randomInt is also unbiased, which Math.floor(Math.random() * n) is not once
 * n does not divide the range evenly. That part is cosmetic at this size and
 * comes free. */
function generateReferralCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(0, chars.length)];
  return code;
}

async function assignReferralCode(userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      // IS NULL makes this safe to call from a read path. Two concurrent loads
      // of the Refer a Friend screen would otherwise both write, and the
      // response from the losing one would hand back a code that is no longer
      // in the table. Here the loser writes nothing and returns the code that
      // actually landed. It also means this can never overwrite a code
      // somebody has already shared.
      const claimed = await pool.query(
        'UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL RETURNING referral_code',
        [code, userId]
      );
      if (claimed.rowCount > 0) return claimed.rows[0].referral_code;
      const existing = await pool.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
      return existing.rows[0]?.referral_code ?? null;
    } catch (err) {
      if (err.code !== '23505') throw err; // unique_violation on referral_code — retry with a new code
    }
  }
  throw new Error('Failed to assign a unique referral code');
}

// Grants the referrer 1 free month of Premium, stacking onto any remaining bonus time.
// How much bonus Premium one account can hold at once. This caps the total
// standing balance rather than counting referrals for life, so it is a rolling
// limit: as the bonus is spent, room to earn more opens up again. Someone with
// a large audience cannot turn the referral programme into a decade of free
// Premium, and someone who refers a friend a year is never shut out.
// Set REFERRAL_MAX_BONUS_MONTHS in Railway to change it without a deploy.
const REFERRAL_MAX_BONUS_MONTHS = parseInt(process.env.REFERRAL_MAX_BONUS_MONTHS, 10) || 12;

// Both sides, which is what the app has always promised and never delivered.
// "Give a month, get a month" is the screen's own title, the description says
// "you both get 1 month of Premium free", and the share message a friend
// receives says "we both get 1 month". Only the referrer was ever credited,
// so the person being recruited, the new user, got nothing.
//
// The flag is claimed first and the WHERE clause is the lock: only the call
// that actually flips referral_rewarded goes on to grant anything, so a double
// tap or a retried request cannot hand out two free months. If the process
// dies between the two statements the reward is lost rather than doubled,
// which is the safer direction for this to fail in.
async function rewardReferral(referrerId, referredId) {
  const claimed = await pool.query(
    'UPDATE users SET referral_rewarded = TRUE WHERE id = $1 AND referral_rewarded = FALSE RETURNING id',
    [referredId]
  );
  if (claimed.rowCount === 0) return false;
  // GREATEST keeps this stacking: a second referral extends an unexpired
  // bonus rather than restarting it, and an expired one starts fresh today.
  // LEAST is the cap. Someone already at the ceiling keeps what they have
  // rather than losing any of it, and the friend they referred is credited
  // either way, since the cap is the referrer's balance and not the friend's
  // reward. It applies to both ids because a redeemer sitting at the cap
  // should not be able to exceed it either.
  await pool.query(
    `UPDATE users SET bonus_premium_until = LEAST(
       GREATEST(COALESCE(bonus_premium_until, NOW()), NOW()) + INTERVAL '30 days',
       NOW() + make_interval(months => $2)
     )
     WHERE id = ANY($1::int[])`,
    [[referrerId, referredId], REFERRAL_MAX_BONUS_MONTHS]
  );
  return true;
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
    /* The calendar projects future renewals from nextBillingDate, so it needs
       the same anchor the server advances with or the two disagree about which
       day a month-end subscription falls on. SMALLINT comes back as a number
       from node-postgres, but this endpoint is not the only writer and an
       absent column must read as absent rather than as NaN. */
    billingAnchorDay: Number.isInteger(Number(s.billing_anchor_day)) ? Number(s.billing_anchor_day) : null,
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

/* THE single server side password rule. Registration, password reset and the
 * authenticated password change all call this, and the point of the comment is
 * that they did not: /api/auth/profile hashed whatever newPassword it was
 * handed, so the one path that requires proving you know the current password
 * was also the one path with no rules at all. Somebody could satisfy the
 * strength rules at registration and immediately replace the password with "a".
 * Nothing errored, nothing logged, and the account was left weaker than the
 * signup form allows.
 *
 * ANY NEW CALLER GOES THROUGH HERE. A second copy of these rules is how the
 * three paths drifted in the first place.
 *
 * NOT called on login, deliberately, and this is the one place where adding the
 * check would be a bug: it would lock out every existing user whose password
 * predates a rule, and their password is correct. Validation belongs where a
 * password is CREATED. */
function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  /* bcrypt hashes at most 72 BYTES and silently ignores the rest, so without
     this a 200 character passphrase is really its first 72 bytes and two
     different passphrases sharing that prefix both authenticate. Bytes, not
     characters: this is UTF-8, so an emoji is four bytes and an umlaut two, and
     `password.length` would let a 40 character German or emoji password through
     while bcrypt quietly truncated it. Rejecting is better than truncating
     silently, because the user believes they chose the longer one. */
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must be 72 bytes or fewer. Accented characters and emoji count as more than one byte each.';
  }
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
    if (name != null && (typeof name !== 'string' || name.trim().length > 80)) {
      return res.status(400).json({ error: 'Name must be under 80 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const openId = generateOpenId();

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
      const openId = generateOpenId();
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
      /* The same rule registration and reset use. This call is the fix: the
         strength check was missing here and nowhere else, which made the
         authenticated path the weakest of the three. Checked AFTER the current
         password, so a wrong current password cannot be told apart from a weak
         new one by the error it returns. */
      const pwError = validatePassword(newPassword);
      if (pwError) return res.status(400).json({ error: pwError });
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
    if (!tokenMatches(user.verification_token, code)) return res.status(400).json({ error: 'Invalid code' });
    if (new Date(user.verification_expires) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    await pool.query('UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = $1', [req.userId]);

    // The usual path: someone redeems a code before verifying, so the reward
    // waits here until the address is real.
    if (user.referred_by) await rewardReferral(user.referred_by, req.userId);

    const updated = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    res.json({ success: true, user: formatUser(updated.rows[0]) });
  } catch (err) {
    handleError(err, res);
  }
});

app.get('/api/trpc/referrals.me', authMiddleware, async (req, res) => {
  try {
    // at_bonus_cap is computed in SQL so it uses the same calendar month
    // arithmetic the cap itself does, rather than a 30 day approximation of
    // it in JS that would disagree near the boundary.
    const result = await pool.query(
      `SELECT referral_code, referred_by, bonus_premium_until,
              bonus_premium_until >= NOW() + make_interval(months => $2) - INTERVAL '1 day' AS at_bonus_cap
       FROM users WHERE id = $1`,
      [req.userId, REFERRAL_MAX_BONUS_MONTHS]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Codes are handed out at registration, and nothing ever backfilled the
    // accounts that existed before the referral feature shipped. Those users
    // open this screen, see a dash where their code should be, and the share
    // button stays disabled, so they can never refer anyone. Assigning on
    // first read fixes every one of them the moment they look.
    const referralCode = user.referral_code || await assignReferralCode(req.userId);
    res.json(trpc({
      referralCode,
      hasRedeemedReferral: user.referred_by != null,
      bonusPremiumUntil: user.bonus_premium_until,
      bonusCapMonths: REFERRAL_MAX_BONUS_MONTHS,
      atBonusCap: user.at_bonus_cap === true,
    }));
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

    // Already verified, so there is nothing left to wait for.
    if (me.is_verified) await rewardReferral(referrer.id, me.id);

    res.json(trpc({ success: true }));
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
      `<div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;background:#F7F6F1;border-radius:12px">
        <h2 style="color:#142B3A;margin-bottom:8px">Reset your password</h2>
        <p style="color:#52616B">Enter this code in the app to reset your password:</p>
        <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#142B3A;text-align:center;padding:24px 0">${code}</div>
        <p style="color:#52616B;font-size:12px">This code expires in 1 hour. If you didn't request this, ignore this email.</p>
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
    if (!user || !tokenMatches(user.reset_token, code)) return res.status(400).json({ error: 'Invalid or expired code' });
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

/* ── PostHog erasure ────────────────────────────────────────────────────────
   Deleting the Postgres row leaves the PostHog person profile behind, keyed to
   the numeric user id that identifyUser() sends from lib/auth-store.ts. The
   events themselves are deliberately thin (funnel milestones, never a
   subscription name or price), so once the account row is gone that id maps to
   nobody and the residue is pseudonymous rather than personal. Defensible, but
   an app whose whole positioning is "we never see your data" should not be
   arguing the fine point, so the profile goes too.

   THIS MUST NEVER BLOCK THE DELETE. The right to erasure cannot depend on a
   third party being reachable, so every failure path here logs and returns.
   The account is already gone by the time this runs.

   Needs POSTHOG_PERSONAL_API_KEY (a personal key, not the project key the app
   embeds: that one can only write) and POSTHOG_PROJECT_ID. Unset, this is a
   no-op and the behaviour is exactly what it was before. */
const POSTHOG_API_HOST = process.env.POSTHOG_API_HOST || 'https://eu.posthog.com';

async function deletePostHogPerson(userId) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const project = process.env.POSTHOG_PROJECT_ID;
  if (!key || !project) return;
  const auth = { Authorization: `Bearer ${key}` };
  try {
    const found = await fetch(
      `${POSTHOG_API_HOST}/api/projects/${project}/persons/?distinct_id=${encodeURIComponent(userId)}`,
      { headers: auth }
    );
    if (!found.ok) throw new Error(`lookup ${found.status}`);
    const { results = [] } = await found.json();
    if (!results.length) return;                       // never identified, nothing to erase
    for (const person of results) {
      // delete_events=true, or the profile goes and its events stay behind
      // attached to the distinct id, which is the half that matters.
      const del = await fetch(
        `${POSTHOG_API_HOST}/api/projects/${project}/persons/${person.id}/?delete_events=true`,
        { method: 'DELETE', headers: auth }
      );
      if (!del.ok) throw new Error(`delete ${del.status}`);
    }
    console.log(`PostHog person erased for user ${userId}`);
  } catch (e) {
    // Loud in the log, invisible to the caller: their account IS deleted.
    console.error(`PostHog erasure failed for user ${userId}, profile may remain:`, e.message);
  }
}

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

    /* Belt as well as braces. The migration above fixes the constraint, but a
       deploy where it has not run yet would still fail this delete with a
       foreign key violation, and the failure mode is a person being told they
       cannot delete their account. Clearing the pointers first works on either
       schema and costs one statement. */
    /* Read off the row BEFORE it is deleted. `user` came from the SELECT above
       and stays in memory afterwards, but naming it here is the point: once the
       DELETE has run there is nowhere left to look this address up, so anything
       the confirmation needs has to be taken while the row still exists. */
    const deletedEmail = user.email;
    const wantsGerman = /^\s*de\b/i.test(req.headers['accept-language'] || '');

    await pool.query('UPDATE users SET referred_by = NULL WHERE referred_by = $1', [req.userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    // After the row is gone, and deliberately not awaited into the response:
    // a slow or down PostHog must not make a successful deletion look failed.
    deletePostHogPerson(req.userId);
    /* Same rule, same reason. sendEmail retries three times with a backoff, so
       awaiting this could hold the response for seconds and then fail it over a
       courtesy message, on a request that has already succeeded irreversibly. */
    if (deletedEmail) {
      sendAccountDeletedEmail(deletedEmail, wantsGerman)
        .catch(e => console.error(`Account deleted email failed for user ${req.userId}:`, e.message));
    }
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

    /* NEVER trust req.body.isPremium. This used to fall back to it whenever
       REVENUECAT_SECRET_API_KEY was unset, which meant any authenticated user
       could POST {"isPremium": true} and hand themselves the paid tier with one
       request. A startup warning is not an access control.

       Entitlement is a claim about money, so an unverifiable claim is refused
       rather than believed: 503, and nothing is written. The client already
       treats a failed sync as "not yet confirmed" and retries through
       retryPendingPremiumSync, and the RevenueCat webhook is the other path in,
       so a real purchase still lands once the key is configured. */
    if (!REVENUECAT_SECRET_API_KEY) {
      console.error('verify-premium called with no REVENUECAT_SECRET_API_KEY: refusing to change entitlement');
      return res.status(503).json({ error: 'PREMIUM_VERIFICATION_UNAVAILABLE' });
    }
    const isPremium = await fetchPremiumEntitlementFromRevenueCat(user.open_id);

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
    if (!event) {
      return res.status(400).json({ error: 'Missing event' });
    }

    // Sandbox/test purchases have a compressed billing cycle (RevenueCat/Play
    // simulate a "month" in minutes), so they expire almost immediately. This
    // backend only serves the live app, so sandbox events must never touch
    // real premium status regardless of how NODE_ENV happens to be set.
    // Checked FIRST, before any identity guard, because a sandbox TRANSFER has
    // no app_user_id either and must be ignored rather than answered 400.
    if (event.environment === 'SANDBOX') {
      return res.json({ success: true });
    }

    const GRANT_EVENTS = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE'];
    // CANCELLATION only means auto-renew was turned off — RevenueCat's own semantics
    // keep the entitlement active until the paid period actually ends (EXPIRATION).
    // Revoking access immediately on CANCELLATION would cut off users who already
    // paid for the current period.
    const REVOKE_EVENTS = ['EXPIRATION'];
    const PREMIUM_ENTITLEMENT = 'Trimio Premium';

    /* TRANSFER IS SHAPED UNLIKE EVERY OTHER EVENT and has to be handled before
       the app_user_id guard below. Its payload carries NO app_user_id, no
       entitlement_ids and no product_id: identity lives in transferred_from and
       transferred_to. It used to be listed in GRANT_EVENTS, which could never
       fire, because the guard answered 400 and returned first.

       WHAT THAT COST: a transfer is what happens when the entitlement moves to
       a different account on the same device, so the person who ends up owning
       the purchase was never granted premium here, and the person who no longer
       owns it kept it. RevenueCat also saw a 400 and retried a delivery that
       could never succeed. */
    if (event.type === 'TRANSFER') {
      const affected = [
        ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
        ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
      ].filter((id) => typeof id === 'string' && id.length > 0);

      if (affected.length === 0) {
        console.warn('[revenuecat] TRANSFER carried no transferred_from/transferred_to: nothing to reconcile');
        return res.json({ success: true });
      }
      /* Refusing rather than guessing, and 503 rather than 200 so the failure
         shows up red in RevenueCat's own delivery list. An unset key is not a
         transient condition, and answering success here would drop transfers
         silently while every dashboard said it was fine. */
      if (!REVENUECAT_SECRET_API_KEY) {
        console.error('[revenuecat] TRANSFER received with no REVENUECAT_SECRET_API_KEY: cannot verify, refusing to guess');
        return res.status(503).json({ error: 'PREMIUM_VERIFICATION_UNAVAILABLE' });
      }
      const { checked, skipped } = await reconcileEntitlementsFromRevenueCat(affected);
      console.log(`[revenuecat] TRANSFER: ${checked} known account(s) reconciled, ${skipped} unknown id(s) skipped`);
      return res.json({ success: true });
    }

    const appUserId = event.app_user_id;
    if (!appUserId) {
      return res.status(400).json({ error: 'Missing event.app_user_id' });
    }

    // Only act on events for the Premium entitlement specifically — RevenueCat
    // sends EXPIRATION/etc. events per-entitlement, and other entitlements
    // (e.g. tip products) expiring must not revoke Premium access.
    const entitlementIds = event.entitlement_ids || [];
    const affectsPremium = entitlementIds.includes(PREMIUM_ENTITLEMENT);

    /* EVERY BRANCH BELOW SAYS WHAT IT DID, and that is not decoration. A grant
       whose UPDATE matches no row is the single worst thing this endpoint can
       do: somebody has paid, nothing was written, and a 200 tells RevenueCat it
       went fine. Silent, that is unfindable. It is also the only way to answer
       "is RevenueCat calling us at all", since the handler used to log nothing
       on any successful path. */
    if (affectsPremium && GRANT_EVENTS.includes(event.type)) {
      // Resubscribing (e.g. UNCANCELLATION) clears any pending win-back state.
      const result = await pool.query(
        "UPDATE users SET is_paid = true, paid_at = CASE WHEN paid_at IS NULL THEN NOW() ELSE paid_at END, cancelled_at = NULL, win_back_sent_at = NULL WHERE open_id = $1 RETURNING email",
        [appUserId]
      );
      if (result.rowCount === 0) {
        console.error(`[revenuecat] ${event.type} matched NO user for app_user_id ${appUserId}: premium was NOT granted`);
      } else {
        console.log(`[revenuecat] ${event.type} granted premium to ${appUserId}`);
      }
      if (result.rows[0]?.email) syncBrevoPlan(result.rows[0].email, getPlanTierFromProductId(event.product_id));
    } else if (affectsPremium && event.type === 'CANCELLATION') {
      /* CANCELLATION IS TWO DIFFERENT EVENTS WEARING ONE NAME, and the
         difference is worth money in both directions.
         `cancel_reason: UNSUBSCRIBE` (or PRICE_INCREASE) means auto-renew was
         switched off and the entitlement RUNS TO THE END of the period already
         paid for, so revoking would cut off somebody who has paid.
         `cancel_reason: CUSTOMER_SUPPORT` is a REFUND, and RevenueCat revokes
         the entitlement AT ONCE, so keeping is_paid true hands the product to
         somebody who has their money back. This branch used to assume the first
         reading for both, because its comment described an unsubscribe.
         IT DOES NOT BRANCH ON cancel_reason, deliberately. Enumerating the
         reasons is the same guess the TRANSFER branch refuses to make, and a
         reason RevenueCat adds later would land in whichever half the last
         reader assumed. It ASKS instead: the entitlement is still active for an
         unsubscribe and already revoked for a refund, so ONE authoritative read
         answers every reason, including the ones that do not exist yet.
         AN ORDINARY UNSUBSCRIBE IS THEREFORE UNCHANGED, which is the property
         that makes this safe: the lookup returns true, is_paid stays true, and
         cancelled_at still feeds the win-back cron exactly as before. */
      // Don't overwrite cancelled_at if already set, so duplicate webhook
      // deliveries don't keep pushing the win-back email out.
      const lastPlan = getPlanTierFromProductId(event.product_id);
      const result = await pool.query(
        "UPDATE users SET cancelled_at = COALESCE(cancelled_at, NOW()), last_plan = $1 WHERE open_id = $2 RETURNING email",
        [lastPlan, appUserId]
      );
      const reason = event.cancel_reason || 'no reason given';
      if (result.rowCount === 0) {
        console.error(`[revenuecat] CANCELLATION matched NO user for app_user_id ${appUserId}`);
      } else if (!REVENUECAT_SECRET_API_KEY) {
        /* Nothing here can tell a refund from an unsubscribe, so keep the
           older behaviour, which errs towards the customer. Same as this
           branch always did, so an unset key is no worse than before. */
        console.error(`[revenuecat] CANCELLATION (${reason}) for ${appUserId} with no REVENUECAT_SECRET_API_KEY: cannot tell a refund from an unsubscribe, leaving access in place`);
        if (result.rows[0]?.email) syncBrevoPlan(result.rows[0].email, 'cancelling');
      } else {
        const stillEntitled = await fetchPremiumEntitlementFromRevenueCat(appUserId);
        if (!stillEntitled) {
          /* cancelled_at is deliberately LEFT SET rather than cleared: they did
             cancel, and the win-back cron is gated on `is_paid = TRUE`, so
             clearing is_paid alone already excludes them. That matters here,
             because the win-back email says "You'll keep Premium access until
             your current period ends", which is flatly untrue for somebody who
             has just been refunded. */
          await pool.query("UPDATE users SET is_paid = false WHERE open_id = $1", [appUserId]);
        }
        console.log(`[revenuecat] CANCELLATION (${reason}) for ${appUserId}: entitlement ${stillEntitled ? 'still active, access kept to period end' : 'ALREADY REVOKED, premium removed'}`);
        if (result.rows[0]?.email) syncBrevoPlan(result.rows[0].email, stillEntitled ? 'cancelling' : 'free');
      }
    } else if (affectsPremium && REVOKE_EVENTS.includes(event.type)) {
      const result = await pool.query(
        "UPDATE users SET is_paid = false, cancelled_at = NULL, win_back_sent_at = NULL WHERE open_id = $1 RETURNING email",
        [appUserId]
      );
      if (result.rowCount === 0) {
        console.error(`[revenuecat] ${event.type} matched NO user for app_user_id ${appUserId}`);
      } else {
        console.log(`[revenuecat] ${event.type} revoked premium for ${appUserId}`);
      }
      if (result.rows[0]?.email) syncBrevoPlan(result.rows[0].email, 'free');
    } else {
      /* Deliberately no action, and deliberately logged. BILLING_ISSUE is a
         grace period rather than a loss of access, and an event carrying a
         different entitlement is none of our business. Naming it is what makes
         an event type that SHOULD have acted visible instead of invisible.
         SUBSCRIPTION_PAUSED BELONGS HERE AND IS NOT AN OVERSIGHT: a Play pause
         takes effect at the END of the period already paid for, and RevenueCat
         states plainly that you should not revoke on it, but on the EXPIRATION
         that follows carrying `expiration_reason: SUBSCRIPTION_PAUSED`. That
         EXPIRATION is handled by REVOKE_EVENTS above. Revoking here would cut
         off somebody mid-period who has paid for it. */
      console.log(`[revenuecat] ${event.type} ignored (affectsPremium=${affectsPremium})`);
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
    const { name, billingCycle = 'monthly', category = 'other', trialEndDate, force, nextBillingDate: nextBillingDateInput } = req.body;
    const price = roundToCents(parseFloat(req.body.price));
    if (!name || req.body.price == null) return res.status(400).json({ error: 'Name and price required' });
    if (typeof name !== 'string' || name.trim().length > 120) return res.status(400).json({ error: 'Name must be under 120 characters' });
    if (isNaN(price) || price <= 0 || price > 99999) return res.status(400).json({ error: 'Price must be a positive number under 99,999' });
    if (!['weekly', 'monthly', 'yearly'].includes(billingCycle)) return res.status(400).json({ error: 'Invalid billing cycle' });

    let billingDate = nextBillingDate(billingCycle);
    if (nextBillingDateInput) {
      const parsed = new Date(nextBillingDateInput);
      if (isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid next billing date' });
      billingDate = parsed.toISOString();
    }

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

    /* Recorded at creation, when the intended day is known for certain: it is
       the day the person picked, or today's day for a generated date. Reading
       it back off next_billing_date later cannot tell a chosen 28th from a
       31st that was clamped. */
    const anchorDay = new Date(billingDate).getUTCDate();
    const result = await pool.query(
      'INSERT INTO subscriptions (user_id, name, price, billing_cycle, category, next_billing_date, trial_end_date, billing_anchor_day) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.userId, name, price, billingCycle, category, billingDate, trialEndDate || null, anchorDay]
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
    const { id, name, billingCycle, category, trialEndDate, nextBillingDate: nextBillingDateInput } = req.body;
    const price = roundToCents(parseFloat(req.body.price));
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
    let newBillingDate = billingCycle !== existing.billing_cycle
      ? nextBillingDate(billingCycle)
      : existing.next_billing_date;
    /* The anchor only moves when the DATE actually CHANGES: a different date
       the user picked, or a regenerated one after a cycle change. Editing a
       name or a price must not touch it, and it must never be re-derived from
       the stored date, since that value may already be a clamped 28th.

       "SUPPLIED" IS NOT THE SAME AS "CHANGED", and reading it that way undid
       this whole feature for anybody who edits a subscription. The edit form
       seeds its date field from the stored row and posts every field back, so
       renaming Netflix resubmitted the clamped 28 February, which was read as
       a deliberate choice of the 28th and overwrote the anchor of 31. One
       rename and a month-end subscription was back to drifting.

       Comparing the calendar DAY rather than trusting the presence of the key
       also makes this correct for clients already installed, which cannot be
       changed and will go on resubmitting unchanged dates for as long as
       somebody skips an update. */
    let newAnchorDay = existing.billing_anchor_day ?? null;
    const cycleChanged = billingCycle !== existing.billing_cycle;
    if (cycleChanged) {
      newAnchorDay = new Date(newBillingDate).getUTCDate();
    }
    if (nextBillingDateInput) {
      const parsed = new Date(nextBillingDateInput);
      if (isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid next billing date' });
      const submittedDay = parsed.toISOString().slice(0, 10);
      const storedDay = existing.next_billing_date
        ? new Date(existing.next_billing_date).toISOString().slice(0, 10)
        : null;
      newBillingDate = parsed.toISOString();
      if (cycleChanged || submittedDay !== storedDay) newAnchorDay = parsed.getUTCDate();
    }
    // Legacy rows arrive with no anchor at all. Seeding it from the date says
    // only what the date already says, so nothing moves.
    if (newAnchorDay == null && newBillingDate) {
      const seed = new Date(newBillingDate);
      if (!isNaN(seed.getTime())) newAnchorDay = seed.getUTCDate();
    }

    const result = await pool.query(
      'UPDATE subscriptions SET name = $1, price = $2, billing_cycle = $3, category = $4, next_billing_date = $5, trial_end_date = $6, billing_anchor_day = $7 WHERE id = $8 AND user_id = $9 RETURNING *',
      [name, price, billingCycle, category, newBillingDate, trialEndDate || null, newAnchorDay, id, req.userId]
    );

    // Rows written before prices were rounded can hold sub-cent figures, so an
    // exact compare would treat 6.944 -> 6.94 as a change and send a push
    // reading "increased by $0.00, went from $6.94 to $6.94". Anything under a
    // cent is not a price change to a person, so it is not one here either.
    const oldPrice = roundToCents(parseFloat(existing.price));
    if (Math.abs(price - oldPrice) >= 0.01) {
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
    if (budgetGoal != null && (typeof budgetGoal !== 'number' || !Number.isFinite(budgetGoal) || budgetGoal <= 0)) {
      return res.status(400).json({ error: 'budgetGoal must be a positive number or null' });
    }
    if (alertThreshold !== undefined && alertThreshold !== null && (typeof alertThreshold !== 'number' || !Number.isFinite(alertThreshold) || alertThreshold <= 0)) {
      return res.status(400).json({ error: 'alertThreshold must be a positive number' });
    }
    /* budget_goal used to be an unconditional SET, sitting next to two columns
       that already used COALESCE. That made this endpoint a full replace for one
       field and a partial update for the others, and the asymmetry cost people
       their budget goal.

       Anything that saved a DIFFERENT setting had to resend budgetGoal to avoid
       nulling it, so the client passed `settings?.budgetGoal ?? null`, which is
       null whenever the settings query has not resolved. Changing your currency
       on a slow connection therefore wiped your budget, with no error anywhere:
       the write succeeded, it just wrote null.

       Presence of the KEY is now the signal, which is the only way to tell "do
       not touch this" from "clear it". An omitted budgetGoal preserves the
       stored value; an explicit null still clears it, which the clear button
       depends on. Same treatment for currency, so a partial update can never
       reset somebody to USD either. */
    const setsBudget = Object.prototype.hasOwnProperty.call(req.body, 'budgetGoal');
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    await pool.query(
      `UPDATE user_settings SET
         budget_goal = CASE WHEN $1::boolean THEN $2::numeric ELSE budget_goal END,
         currency = COALESCE($3, currency),
         currency_symbol = COALESCE($4, currency_symbol),
         custom_categories = COALESCE($5, custom_categories),
         alert_threshold = COALESCE($6, alert_threshold)
       WHERE user_id = $7`,
      [
        setsBudget, setsBudget ? (budgetGoal ?? null) : null,
        currency || null, currencySymbol || null,
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
        /* Advance to TODAY, not to this instant. Comparing a midnight-UTC date
           against `now` made a payment due today count as past from one minute
           after midnight, so simply READING alerts rolled it into next month
           and wrote that to the database. The alert for the day it was warning
           about disappeared on that very day, which is the one day it existed
           to cover. A read endpoint should not be able to move somebody's
           billing date at all, and this is the narrower half of that: it can
           still advance genuinely stale dates, but never today's. */
        const today = startOfUtcDay(now);
        /* The stored anchor, not the day of the date being advanced. Without
           it a subscription billed on the 31st loses that day the first time
           it passes a February, because the clamped 28th is what gets written
           and what the next request reads back as its starting point. */
        const { date: advanced, advanced: didAdvance } = advanceBillingDate(
          billingDate, sub.billing_cycle, today, sub.billing_anchor_day
        );
        billingDate = advanced;
        if (didAdvance && billingDate >= today) {
          await pool.query('UPDATE subscriptions SET next_billing_date = $1 WHERE id = $2', [billingDate.toISOString(), sub.id]);
        }
      } else {
        // Missing billing date — set it now and skip alert for this cycle
        billingDate = new Date(nextBillingDate(sub.billing_cycle));
        await pool.query(
          'UPDATE subscriptions SET next_billing_date = $1, billing_anchor_day = $2 WHERE id = $3',
          [billingDate.toISOString(), billingDate.getUTCDate(), sub.id]
        );
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
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    // currency_symbol comes along for the ride rather than being fetched per
    // user inside the loop. LEFT JOIN because a user who never opened settings
    // has no row there.
    const usersResult = await pool.query(`
      SELECT u.id, u.email, u.name, us.currency_symbol
      FROM users u
      JOIN notification_preferences np ON np.user_id = u.id
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE np.email_reminders = TRUE AND u.is_verified = TRUE
        AND u.email_opt_out IS NOT TRUE
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
           AND next_billing_date BETWEEN $2 AND $3
           -- skip anything already reminded for THIS billing date
           AND (reminder_sent_for IS NULL OR reminder_sent_for <> next_billing_date)`,
        [user.id, now.toISOString(), in3Days.toISOString()]
      );
      if (subsResult.rows.length === 0) continue;

      // This used to hardcode a dollar sign, so a user tracking in euros got a
      // reminder listing their subscriptions in dollars. The digest and the
      // in-app alerts already read the setting; this template did not.
      const sym = user.currency_symbol || '$';

      // Subscription names are user-supplied, so they get escaped before
      // going anywhere near email HTML. So is the currency symbol: it is
      // written straight from the client with no validation.
      const rows = subsResult.rows.map(s =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #DCDEDB">${escapeHtml(s.name || '')}</td>
          <td style="padding:8px;border-bottom:1px solid #DCDEDB">${escapeHtml(sym)}${parseFloat(s.price).toFixed(2)}/${escapeHtml(s.billing_cycle || '')}</td>
          <td style="padding:8px;border-bottom:1px solid #DCDEDB">${new Date(s.next_billing_date).toLocaleDateString()}</td>
        </tr>`
      ).join('');

      const delivered = await sendEmail(
        user.email,
        `Trimio: ${subsResult.rows.length} subscription${subsResult.rows.length > 1 ? 's' : ''} renewing soon`,
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#F7F6F1;border-radius:12px">
          <h2 style="color:#142B3A;margin-bottom:4px">Hi ${escapeHtml(user.name || 'there')}!</h2>
          <p style="color:#52616B;margin-bottom:20px">Here are your upcoming subscription renewals in the next 3 days:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#FCFBF8;border-radius:8px;overflow:hidden;border:1px solid #DCDEDB">
            <thead>
              <tr style="background:#E9E6DE">
                <th style="padding:10px;text-align:left;font-size:12px;color:#52616B">Service</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#52616B">Price</th>
                <th style="padding:10px;text-align:left;font-size:12px;color:#52616B">Renewal Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="text-align:center;margin-top:24px">
            <a href="trimio://subscriptions?from=renewal_reminder" style="display:inline-block;background:#142B3A;color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px">Review in Trimio</a>
          </div>
          <p style="color:#52616B;font-size:12px;margin-top:20px">
            You're receiving this because you enabled email reminders in Trimio.
            Tap the button above (or open the app) to manage your notification preferences.
          </p>
          ${emailFooter(unsubscribeUrlFor(user.id))}
        </div>`,
        { unsubscribeUrl: unsubscribeUrlFor(user.id) }
      ).then(() => true).catch(e => { console.error(`Email failed for user ${user.id}:`, e); return false; });

      /* Mark ONLY after the send actually succeeded, so a Brevo outage means a
         retry on the next run rather than a renewal that silently never gets
         its reminder. The old code incremented `sent` inside a catch-and-
         continue, so the number it reported was attempts rather than
         deliveries. */
      if (delivered) {
        await pool.query(
          'UPDATE subscriptions SET reminder_sent_for = next_billing_date WHERE id = ANY($1::int[])',
          [subsResult.rows.map(r => r.id)]
        );
        sent++;
      }
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
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
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
        AND email_opt_out IS NOT TRUE
    `);

    let sent = 0;
    for (const user of usersResult.rows) {
      const planLabel = { monthly: 'Monthly', annual: 'Annual', lifetime: 'Lifetime' }[user.last_plan] || 'Premium';
      await sendEmail(
        user.email,
        `We're sorry to see you go, ${user.name || 'there'}`,
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#F7F6F1;border-radius:12px">
          <h2 style="color:#142B3A;margin-bottom:8px">Your Trimio ${escapeHtml(planLabel)} plan is set to end</h2>
          <p style="color:#52616B">You'll keep Premium access until your current period ends, but auto-renew is off. If that was a mistake, you can turn it back on anytime from your subscription settings.</p>
          <div style="text-align:center;margin-top:24px">
            <a href="trimio://upgrade" style="display:inline-block;background:#142B3A;color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px">Keep Premium</a>
          </div>
          <p style="color:#52616B;font-size:12px;margin-top:20px">This is an automatic reminder. No action needed if you meant to cancel.</p>
          ${emailFooter(unsubscribeUrlFor(user.id))}
        </div>`,
        { unsubscribeUrl: unsubscribeUrlFor(user.id) }
      ).catch(e => console.error(`Win-back email failed for user ${user.id}:`, e));
      await pool.query('UPDATE users SET win_back_sent_at = NOW() WHERE id = $1', [user.id]);
      sent++;
    }

    res.json({ success: true, emailsSent: sent });
  } catch (err) {
    handleError(err, res);
  }
});

// ── App version check ──────────────────────────────────────────────────────
// Lets the app nudge users still on an old native build to update from the
// Play Store — set MIN_ANDROID_VERSION_CODE in Railway to require an update;
// leave it unset (defaults to 0) to never prompt.

app.get('/api/trpc/appVersion.check', (_, res) => {
  res.json({
    minVersionCode: parseInt(process.env.MIN_ANDROID_VERSION_CODE, 10) || 0,
    updateUrl: 'https://play.google.com/store/apps/details?id=com.trimio.app',
  });
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok' }));

initDB()
  .then(() => app.listen(PORT, () => console.log(`Trimio backend running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
