/**
 * THE FIRST SESSION: WHAT A NEW USER SEES, AND WHEN THEY ARE ASKED FOR
 * NOTIFICATIONS.
 *
 * Measured on production 2026-10-06: 20 of 30 accounts never added a
 * subscription. Walking the first session found two things worth changing.
 *
 * 1. Launch called registerForPushNotificationsAsync, which ASKS, so on Android
 *    13+ the system "Allow notifications?" dialog was the first thing a new
 *    install showed, before onboarding said what Trimio is. A refusal there is
 *    close to permanent and silently kills reminders, the product.
 *    The question now comes after the first subscription is added, behind a
 *    sentence naming it, and only while Android would still show its dialog.
 * 2. An empty account landed on a dashboard of zeros, a Premium upsell and a
 *    warning, with "add" two taps away. It now gets one focused card with
 *    one-tap service tiles into a prefilled form.
 *
 * Source reading, since these are TypeScript screens with native imports. The
 * decision of WHEN to ask (lib/reminder-primer.ts) was measured separately on
 * Node type stripping with only its two import specifiers stubbed: offered
 * only when undetermined, never when granted or denied, held back for 7 days
 * after "Not now", and a garbage stored value does not block it (10 of 10).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
// New files read as empty when absent, so the suite FAILS against the old tree
// rather than crashing before any assertion runs.
const readNew = (p) => (fs.existsSync(path.join(root, p)) ? read(p) : '');
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fnBody = (src, sig) => {
  const i = src.indexOf(sig);
  if (i < 0) return '';
  return src.slice(i, src.indexOf('\n}\n', i) + 2);
};

const LAYOUT = codeOf(read('app/_layout.tsx'));
const NOTIF = read('lib/notifications.ts');
const PRIMER = readNew('lib/reminder-primer.ts');
const SUBS = read('app/(tabs)/subscriptions.tsx');
const DASH = read('app/(tabs)/index.tsx');
const CARD = readNew('components/FirstRunCard.tsx');
const en = JSON.parse(read('locales/en.json'));
const de = JSON.parse(read('locales/de.json'));

describe('notifications are not requested at launch', () => {
  it('launch prepares and never asks', () => {
    expect(LAYOUT).toContain('prepareNotifications()');
    expect(LAYOUT).not.toMatch(/requestNotificationPermission\(\)/);
    expect(LAYOUT).not.toMatch(/registerForPushNotificationsAsync\(\)/);
  });

  it('prepareNotifications reads the permission and never requests it', () => {
    const body = fnBody(NOTIF, 'export async function prepareNotifications');
    expect(body).toContain('getPermissionsAsync');
    expect(body).not.toContain('requestPermissionsAsync');
    // It may register the token, but only behind an already granted status.
    expect(body).toMatch(/if \(status === "granted"\) await registerForPushNotificationsAsync\(\)/);
  });

  it('the channel is still created at launch, so reminders keep their importance', () => {
    expect(fnBody(NOTIF, 'export async function prepareNotifications')).toContain('ensureReminderChannel()');
    expect(fnBody(NOTIF, 'export async function registerForPushNotificationsAsync')).toContain('ensureReminderChannel()');
  });

  it('a permanently refused dialog counts as denied, so nobody is offered a dead button', () => {
    const body = fnBody(NOTIF, 'export async function getReminderPermission');
    expect(body).toMatch(/canAskAgain === false/);
  });
});

describe('the question comes after the first subscription', () => {
  it('only an undetermined permission is offered, with a cooldown after Not now', () => {
    expect(PRIMER).toMatch(/!== "undetermined"\) return false/);
    expect(PRIMER).toMatch(/COOLDOWN_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  });

  it('a successful add is what triggers it, naming what was added', () => {
    const create = SUBS.slice(SUBS.indexOf('const createMutation = useMutation'), SUBS.indexOf('onError:', SUBS.indexOf('const createMutation = useMutation')));
    expect(create).toContain('shouldOfferReminderPrimer()');
    expect(create).toContain('setPrimerName(addedName)');
  });

  it('accepting asks Android and reschedules; Not now is remembered', () => {
    expect(SUBS).toMatch(/const granted = await acceptReminderPrimer\(\);/);
    expect(SUBS).toMatch(/if \(granted\) queryClient\.invalidateQueries\(\{ queryKey: \["subscriptions"\] \}\)/);
    expect(SUBS).toMatch(/onDecline=\{\(\) => \{[\s\S]*?rememberPrimerDeclined\(\)/);
  });
});

describe('an empty dashboard shows the first-run card instead of zeros', () => {
  it('first run is exactly "no subscriptions", and the ordinary dashboard is wrapped out of it', () => {
    expect(DASH).toContain('const isFirstRun = subscriptions.length === 0;');
    expect(DASH).toContain('{isFirstRun && <FirstRunCard verifyBanner={verifyBanner} />}');
    const wrapped = DASH.slice(DASH.indexOf('{!isFirstRun && (<>'), DASH.indexOf('</>)}'));
    for (const piece of ['<PremiumGate', 'styles.heroCard', 'dashboard.quickActions', 'dashboard.recentExpenses']) {
      expect(wrapped).toContain(piece);
    }
  });

  it('a tile opens the add form prefilled, it does not save', () => {
    expect(CARD).toMatch(/params: \{ from: "template", templateId: tpl\.id \}/);
    expect(codeOf(CARD)).not.toContain('subscriptions.create');
    expect(SUBS).toMatch(/SERVICE_TEMPLATES\.find\(\(x\) => x\.id === templateId\)/);
    expect(SUBS).toMatch(/from === "paste"\) \{\s*setShowEmailPaste\(true\)/);
  });

  it('analytics records the action, never which service', () => {
    const tracks = [...CARD.matchAll(/track\("first_run_action", (\{[^}]*\})\)/g)].map((m) => m[1]);
    expect(tracks).toEqual(['{ action: "tile" }', '{ action: "other" }', '{ action: "paste" }']);
  });

  it('every tile and button is at least 48dp and every tile is labelled', () => {
    expect(CARD).toMatch(/tile: \{[\s\S]*?minHeight: 104/);
    expect(CARD).toMatch(/actionButton: \{[\s\S]*?minHeight: 48/);
    expect(CARD).toContain('accessibilityLabel={t("firstRun.a11yTile", { name: tpl.name })}');
  });
});

describe('a template price is only used in the currency it will be saved in', () => {
  it('applyTemplate leaves the price empty when the row is in another currency', () => {
    expect(SUBS).toContain('price: tpl.currency === baseCurrencyCode ? String(tpl.defaultPrice) : "",');
    expect(SUBS).not.toMatch(/price: String\(tpl\.defaultPrice\),/);
  });

  it('the tiles prefer rows in the saved currency', () => {
    expect(CARD).toMatch(/popular\.filter\(\(tpl\) => tpl\.currency === baseCurrencyCode\)/);
  });
});

describe('copy', () => {
  it('both locales carry the first-run and primer blocks with matching tokens', () => {
    for (const block of ['firstRun', 'reminderPrimer']) {
      expect(Object.keys(de[block]).sort()).toEqual(Object.keys(en[block]).sort());
      for (const k of Object.keys(en[block])) {
        const tok = (s) => (s.match(/\{\{\w+\}\}/g) || []).sort();
        expect(tok(de[block][k])).toEqual(tok(en[block][k]));
      }
    }
  });

  it('the duplicate warning and the recent list are no longer English-only', () => {
    expect(SUBS).not.toContain('"Duplicate subscription"');
    expect(SUBS).not.toContain('text: "Add anyway"');
    expect(DASH).not.toMatch(/\/ \$\{sub\.billingCycle\}/);
    expect(DASH).not.toMatch(/\}\/yr`|\}\/mo`/);
  });
});
