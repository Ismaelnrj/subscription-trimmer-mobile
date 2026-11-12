/* MINT MEANS GOOD NEWS, AND NOTHING ELSE. Added 2026-11-12 with the move off
   the cream ground. The owner asked whether mint, too, is a colour AI design
   reaches for, and the honest answer was: as decoration, yes. Bright mint and
   emerald are the default "success" greens of the kits generated apps are
   built from, so a mint switch, a mint icon or a mint tint reads as a
   template. Used for one meaning it reads as a decision.

   So the green tokens (`success`, `accent`, `accentLight`) are allowed in
   exactly the places listed below, each with its reason, and the reasons are
   of two kinds only: money a person keeps, or something that is done and
   fine. Everything else that wants emphasis takes ink (`c.text`), the
   colour this app already uses for "chosen".

   A new green use fails here and has to argue for its place. An entry that
   no longer matches anything fails too, so the list cannot quietly go stale.

   Negative tested on 2026-11-12 against the screens before this change: the
   two green switches, the paywall's green table ticks and the first run
   card's green shield all fail, each naming its line. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const ALLOWED = {
  "app/insights.tsx": {
    'tip.id === "all-good" ? c.success': "the all clear tip: nothing to fix",
    "savingsLine: {": "money a recommendation would save",
    "savingsHint: {": "money a recommendation would save",
  },
  "app/alerts.tsx": {
    'name="check-circle-outline" size={40} color={c.success}': "empty state: nothing is due",
  },
  "app/cancelled.tsx": {
    "cardSaved: {": "money kept by cancelling",
  },
  "app/upgrade.tsx": {
    'name="check-circle" size={24} color={c.success}': "Premium is already active: done",
    "borderRadius: radius.pill, borderWidth: 1, borderColor: c.success,": "the yearly plan's saving",
    "badgeText: {": "the yearly plan's saving",
  },
  "app/(tabs)/subscriptions.tsx": {
    'name="check-circle" size={16} color={c.success}': "a pasted email was read: done",
    "backgroundColor: c.success, borderRadius: 12, padding: 14,": "the cancel moment: money kept a year",
    "parsedPreviewText: {": "a pasted email was read: done",
  },
  "app/(tabs)/index.tsx": {
    "budgetRaw >= 70 ? c.warning : c.success": "spending is well inside the budget",
  },
  "app/notifications.tsx": {
    'case "payment_received": return c.success;': "a payment went through",
  },
  "components/PasswordStrength.tsx": {
    "if (score >= 3) return c.success;": "the password is strong enough",
    "color={met ? c.success : c.textMuted}": "a password requirement is met",
    "{ color: met ? c.success : c.textMuted }": "a password requirement is met",
  },
};

const GREEN = /\bc\.(success|accent|accentLight)\b/;
// The mint values themselves, so a hex cannot walk around the token rule.
const MINT_HEX = /#(55C6A3|2F8E71|1F7A62|DDF4EC|16342C)\b/i;

/* Comments blanked out, newlines kept so line numbers stay true. Several
   comments quote the old mint values while explaining why they went. A "//"
   right after a colon is a URL, not a comment. */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (m, pre) => pre + " ".repeat(m.length - pre.length));
}

function files(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return files(rel);
    return /\.tsx$/.test(e.name) ? [rel] : [];
  });
}

const SCREENS = [...files("app"), ...files("components")];

describe("mint is only used for good news", () => {
  it("scans the screens it is meant to scan", () => {
    expect(SCREENS.length).toBeGreaterThan(40);
  });

  it("every green token use is on the list, with its reason", () => {
    const used = new Set();
    const stray = [];
    for (const f of SCREENS) {
      const lines = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!GREEN.test(line)) return;
        const hit = Object.keys(ALLOWED[f] || {}).find((k) => line.includes(k));
        if (hit) used.add(`${f} :: ${hit}`);
        else stray.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(stray).toEqual([]);
    const listed = Object.entries(ALLOWED).flatMap(([f, m]) => Object.keys(m).map((k) => `${f} :: ${k}`));
    expect(listed.filter((k) => !used.has(k))).toEqual([]);
  });

  it("no screen writes a mint value by hand", () => {
    const hits = SCREENS.flatMap((f) =>
      code(fs.readFileSync(path.join(ROOT, f), "utf8")).split("\n")
        .map((l, i) => [l, i + 1])
        .filter(([l]) => MINT_HEX.test(l))
        .map(([l, n]) => `${f}:${n}: ${l.trim()}`));
    expect(hits).toEqual([]);
  });

  it("a switch that is on is ink, not green", () => {
    for (const f of SCREENS) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(`${f}: ${src.match(/true:\s*c\.(success|accent)\b/) ? "green switch" : "ok"}`).toBe(`${f}: ok`);
    }
  });
});
