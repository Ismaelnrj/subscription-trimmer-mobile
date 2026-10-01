/**
 * THE VERIFICATION AND PASSWORD RESET EMAILS, IN BOTH LANGUAGES.
 *
 * BEHAVIOURAL, NOT SOURCE READING, and that distinction is the point here.
 * Yesterday's referral email shipped with a subject-verb agreement error in
 * both languages that was invisible in the template and obvious the moment it
 * was rendered once. So this file lifts the REAL const and the REAL renderer
 * out of server.js and executes them against a captured sendEmail, rather
 * than asserting that certain strings appear somewhere in the file.
 *
 * WHAT IT GUARDS, and each of these was a live defect on 2026-10-01:
 *   - the verification email was English only, subject and body, and it is the
 *     FIRST thing a German user ever receives from Trimio, on the step that
 *     gates is_verified, which in turn gates the referral reward and both
 *     bulk email queries;
 *   - the password reset email was English only for the same reason;
 *   - an unknown language must fall back to English rather than throw, because
 *     a thrown renderer means no verification code reaches anybody at all.
 *
 * Extraction is by string index and never by regex. This repo has recorded a
 * regex reading a function boundary wrong six times.
 */
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'backend', 'server.js');
const src = fs.readFileSync(SERVER, 'utf8');

/* Build a live sendCodeEmail from the real source, with sendEmail captured. */
function buildRenderer() {
  const cStart = src.indexOf('const CODE_EMAIL = {');
  expect(cStart).toBeGreaterThan(-1);
  const cEnd = src.indexOf('\n};', cStart) + 3;
  expect(cEnd).toBeGreaterThan(cStart);

  const fStart = src.indexOf('async function sendCodeEmail(');
  expect(fStart).toBeGreaterThan(-1);
  const fEnd = src.indexOf('\n}\n', fStart) + 3;
  expect(fEnd).toBeGreaterThan(fStart);

  const sent = [];
  const sendEmail = async (to, subject, html) => { sent.push({ to, subject, html }); };
  const make = new Function(
    'sendEmail',
    src.slice(cStart, cEnd) + '\n' + src.slice(fStart, fEnd) + '\n; return sendCodeEmail;'
  );
  return { sendCodeEmail: make(sendEmail), sent };
}

const textOf = (m) => (m.subject + ' ' + m.html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

describe('the code emails render in both languages', () => {
  const KINDS = ['verify', 'reset'];

  test.each(KINDS)('%s renders a German email that is not the English one', async (kind) => {
    const { sendCodeEmail, sent } = buildRenderer();
    await sendCodeEmail(kind, 'a@example.com', '428913', 'en');
    await sendCodeEmail(kind, 'a@example.com', '428913', 'de');
    const [en, de] = sent;
    expect(de.subject).not.toBe(en.subject);
    expect(de.html).not.toBe(en.html);
  });

  test.each(KINDS)('%s carries the code in both languages', async (kind) => {
    const { sendCodeEmail, sent } = buildRenderer();
    await sendCodeEmail(kind, 'a@example.com', '428913', 'en');
    await sendCodeEmail(kind, 'a@example.com', '428913', 'de');
    for (const m of sent) expect(textOf(m)).toContain('428913');
  });

  test('all four emails have distinct subjects', async () => {
    const { sendCodeEmail, sent } = buildRenderer();
    for (const kind of KINDS) {
      for (const lang of ['en', 'de']) await sendCodeEmail(kind, 'a@example.com', '1', lang);
    }
    expect(sent).toHaveLength(4);
    expect(new Set(sent.map((m) => m.subject)).size).toBe(4);
  });

  /* The German half must be German, written with real umlauts and informal du.
     Both have been got wrong here before: ASCII transliterations (laeuft,
     aendert) went in once, and the referral copy addressed the wrong person. */
  test.each(KINDS)('%s German copy uses umlauts and informal du', async (kind) => {
    const { sendCodeEmail, sent } = buildRenderer();
    await sendCodeEmail(kind, 'a@example.com', '428913', 'de');
    const text = textOf(sent[0]);
    expect(text).toMatch(/[äöüßÄÖÜ]/);
    expect(text).not.toMatch(/\b(laeuft|aendert|naechste|Bestaetige|zuruecksetzen|loeschen)\b/);
    expect(text).toMatch(/\b(du|dein|deine|dir|diesen)\b/i);
    expect(text).not.toMatch(/\b(Sie|Ihnen|Ihre)\b/);
  });

  /* Trimio's copy rule: no dash as clause-separating punctuation. A hyphen
     inside a compound word is spelling and stays allowed, which is why this
     looks for whitespace on both sides, or an en/em dash anywhere. German
     compound hyphens were over-corrected here once already. */
  test('no email uses a dash as clause punctuation', async () => {
    const { sendCodeEmail, sent } = buildRenderer();
    for (const kind of KINDS) {
      for (const lang of ['en', 'de']) await sendCodeEmail(kind, 'a@example.com', '1', lang);
    }
    for (const m of sent) {
      const text = textOf(m);
      expect(text).not.toMatch(/[–—]/);
      expect(text).not.toMatch(/\s-\s/);
    }
  });

  /* A renderer that throws on an unexpected language sends NO code at all,
     which is strictly worse than sending an English one. */
  test('an unknown language falls back to English rather than throwing', async () => {
    const { sendCodeEmail, sent } = buildRenderer();
    await sendCodeEmail('verify', 'a@example.com', '1', 'fr');
    await sendCodeEmail('verify', 'a@example.com', '1', undefined);
    expect(sent).toHaveLength(2);
    for (const m of sent) expect(m.subject).toBe('Verify your Trimio account');
  });
});

describe('every caller supplies a language', () => {
  /* The renderer being bilingual is worth nothing if a call site forgets the
     third argument, which would silently send English to everybody and pass
     every test above. */
  test('no sendVerificationEmail call omits the language', () => {
    const calls = src.match(/sendVerificationEmail\([^;]*?\)\.catch/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) expect(c).toContain('languageOf(req)');
  });

  /* Scoped to the handler, because 'Reset your Trimio password' legitimately
     still appears in the file as the English subject inside CODE_EMAIL. A
     whole-file search for it fails against CORRECT code, which is exactly what
     it did when this assertion was first written. What must be gone is the
     inline template in the handler, not the string. */
  test('the forgot-password handler calls no raw sendEmail of its own', () => {
    const i = src.indexOf("app.post('/api/auth/forgot-password'");
    expect(i).toBeGreaterThan(-1);
    const end = src.indexOf("app.post('", i + 10);
    expect(end).toBeGreaterThan(i);
    const handler = src.slice(i, end);
    expect(handler).toContain('sendPasswordResetEmail(email, code, languageOf(req))');
    expect(handler).not.toContain('await sendEmail(');
    expect(handler).not.toContain('Reset your password');
  });

  /* Google sign in is the only account path that never reaches /register and
     never needs verify-email, so it was the one path leaving users.language
     NULL, which reads as English on the referral reward email. */
  test('the Google sign in path records the language', () => {
    const i = src.indexOf("app.post('/api/auth/google'");
    expect(i).toBeGreaterThan(-1);
    const end = src.indexOf("app.post('", i + 10);
    expect(end).toBeGreaterThan(i);
    expect(src.slice(i, end)).toContain('recordLanguage(user.id, req)');
  });
});
