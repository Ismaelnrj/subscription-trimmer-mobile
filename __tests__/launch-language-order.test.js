/**
 * THE SAVED APP LANGUAGE IS APPLIED BEFORE THE SESSION RESTORE.
 *
 * restoreToken() calls /auth/me, and the server stores that request's
 * Accept-Language as users.language (recordLanguage), which is the ONLY
 * language signal the scheduled renewal and win-back emails have. lib/api.ts
 * builds the header from i18n.language at send time, and lib/i18n.ts starts
 * i18n on the DEVICE locale. Until 2026-10-06 loadLanguage() ran after the
 * restore, so somebody on an English phone who picked German in Settings was
 * written back to 'en' on every cold start.
 *
 * Found from the production funnel: 30 accounts, language de 0, en 1, and the
 * one 'en' is consistent with the owner's own account, whose app is German.
 *
 * Source reading, since the layout is TypeScript with native imports.
 */
const fs = require('fs');
const path = require('path');

const LAYOUT = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');
const init = LAYOUT.slice(LAYOUT.indexOf('const init = async () => {'), LAYOUT.indexOf('init();'));

describe('launch ordering', () => {
  it('found the init block, so nothing below passes vacuously', () => {
    expect(init.length).toBeGreaterThan(200);
    expect(init).toContain('restoreToken()');
  });

  it('loads the saved language before restoreToken sends /auth/me', () => {
    const lang = init.indexOf('await loadLanguage()');
    expect(lang).toBeGreaterThan(-1);
    expect(lang).toBeLessThan(init.indexOf('restoreToken()'));
  });

  it('loads it exactly once', () => {
    expect(init.match(/loadLanguage\(\)/g)).toHaveLength(1);
  });

  it('a failed language load cannot stop the session restore', () => {
    expect(init).toMatch(/await loadLanguage\(\)\.catch\(\(\) => \{\}\);/);
  });

  it('the header is still read from i18n at send time, which is why order matters', () => {
    const api = fs.readFileSync(path.join(__dirname, '..', 'lib', 'api.ts'), 'utf8');
    expect(api).toMatch(/config\.headers\["Accept-Language"\] = i18n\.language/);
  });
});
