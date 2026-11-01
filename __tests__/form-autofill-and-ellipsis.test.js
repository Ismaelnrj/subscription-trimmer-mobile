/* Two rules from Vercel's Web Interface Guidelines, adopted into trimio-design
   on 2026-11-01 because they apply to a React Native app and can be measured.

   1. A field holding a credential or a code says so. Android's autofill
      (Google Password Manager for most people) finds the email and password
      fields through autoComplete. Until 2026-11-01 none of the app's 25 text
      fields carried one, so signing in on a new phone meant typing both from
      memory. The same rule lives in check_screens.py --forms as a report; this
      is the gate.

   2. "…" (one character), never three full stops, in anything the app shows.
      All 18 loading and search strings in the two locale files used "...".

   Source reading on purpose: it runs anywhere jest runs, and the rule is about
   what the source declares. Against 34ae5739 every assertion below fails:
   12 fields and 18 strings. */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function tsxFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...tsxFiles(rel));
    else if (e.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

// The opening tag from `<TextInput` to its own `>`, counting braces so the `>`
// inside an arrow function does not end it.
function openingTag(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    else if (src[i] === ">" && depth === 0) return src.slice(start, i + 1);
  }
  return "";
}

const RULES = {
  password: { autoComplete: ["current-password", "new-password", "password", "password-new"] },
  email: { autoComplete: ["email"], keyboardType: ["email-address"], autoCapitalize: ["none"] },
  code: { autoComplete: ["one-time-code", "sms-otp"] },
};

function kindOf(tag) {
  if (tag.includes("secureTextEntry")) return "password";
  if (tag.includes('keyboardType="email-address"') || /value=\{\w*[eE]mail\}/.test(tag)) return "email";
  if (tag.includes('keyboardType="number-pad"') && /value=\{\w*[cC]ode\}/.test(tag)) return "code";
  return null;
}

function fieldFindings() {
  const findings = [];
  const fields = [];
  for (const file of [...tsxFiles("app"), ...tsxFiles("components")]) {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const m of src.matchAll(/<TextInput\b/g)) {
      const tag = openingTag(src, m.index);
      const line = src.slice(0, m.index).split("\n").length;
      if (tag.includes("contextMenuHidden")) findings.push(`${file}:${line} blocks paste`);
      if (tag.includes("editable={false}")) continue;
      const kind = kindOf(tag);
      if (!kind) continue;
      fields.push(`${file}:${line} ${kind}`);
      for (const [prop, allowed] of Object.entries(RULES[kind])) {
        const got = tag.match(new RegExp(`${prop}="([^"]+)"`));
        if (!got || !allowed.includes(got[1])) findings.push(`${file}:${line} ${kind} field: ${got ? got[0] : "no " + prop}`);
      }
    }
  }
  return { findings, fields };
}

function strings(node, prefix = "") {
  if (typeof node === "string") return [[prefix, node]];
  return Object.entries(node).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k));
}

describe("credential and code fields declare what they hold", () => {
  it("finds the fields it is meant to check, so it cannot pass by checking nothing", () => {
    const { fields } = fieldFindings();
    const kinds = new Set(fields.map((f) => f.split(" ").pop()));
    expect(kinds).toEqual(new Set(["password", "email", "code"]));
    expect(fields.length).toBeGreaterThanOrEqual(12);
  });

  it("every email, password and code field carries the right autoComplete", () => {
    expect(fieldFindings().findings).toEqual([]);
  });

  it("sign in asks for the current password and sign up for a new one", () => {
    // The two values are not interchangeable: new-password is what makes the
    // password manager offer to generate and save one.
    const login = fs.readFileSync(path.join(ROOT, "app/login.tsx"), "utf8");
    const register = fs.readFileSync(path.join(ROOT, "app/register.tsx"), "utf8");
    expect(login).toMatch(/autoComplete="current-password"/);
    expect(register).toMatch(/autoComplete="new-password"/);
  });
});

describe("an ellipsis is one character", () => {
  it.each(["en", "de"])("locales/%s.json has no three full stops", (lang) => {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, `locales/${lang}.json`), "utf8"));
    const bad = strings(json).filter(([, v]) => v.includes("..."));
    expect(bad).toEqual([]);
  });

  it("the German search field searches Abos, the shared term, not Ausgaben", () => {
    const de = JSON.parse(fs.readFileSync(path.join(ROOT, "locales/de.json"), "utf8"));
    expect(de.subscriptions.search).toBe("Abos suchen…");
  });
});
