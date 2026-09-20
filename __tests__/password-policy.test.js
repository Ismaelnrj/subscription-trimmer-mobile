/* One password rule, on all three paths that can set a password.
 *
 * WHAT WAS WRONG. validatePassword() existed and was called by registration and
 * by password reset. PATCH /api/auth/profile, the authenticated change, hashed
 * whatever newPassword it was handed. So the path that requires proving you know
 * the current password was the path with no rules at all: satisfy the signup
 * form, then immediately replace the password with "a". Nothing errored and
 * nothing logged, and the account ended up weaker than the form allows.
 *
 * It also had no upper bound. bcrypt hashes at most 72 BYTES and ignores the
 * rest, so a long passphrase was really its first 72 bytes and two passphrases
 * sharing that prefix both authenticate. Bytes rather than characters is the
 * part that is easy to get wrong: this is UTF-8, so `password.length` would
 * admit a 40 character German or emoji password that bcrypt then truncated.
 *
 * WHAT THIS RUNS. validatePassword is lifted out of backend/server.js by text
 * and executed. Nothing is reimplemented, so the rule being measured is the one
 * the server ships. The three call sites are then checked in the source, because
 * a correct function nobody calls is exactly the defect this file exists for.
 *
 * LOGIN IS DELIBERATELY NOT ONE OF THE THREE. Validating there would lock out
 * every existing user whose password predates a rule, with a password that is
 * correct. That is asserted below so nobody "completes" the set later.
 */

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const SRC = read("backend/server.js");

/** One top level function, by matching braces. Returns "" rather than throwing,
 *  for the reason given in auth-token-hygiene.test.js: a throw at module load
 *  reports "0 passed, 0 failed". */
function lift(name) {
  const at = SRC.indexOf(`function ${name}(`);
  if (at === -1) return "";
  let depth = 0, started = false;
  for (let i = at; i < SRC.length; i++) {
    if (SRC[i] === "{") { depth++; started = true; }
    else if (SRC[i] === "}") { depth--; if (started && depth === 0) return SRC.slice(at, i + 1); }
  }
  return "";
}

const validateSrc = lift("validatePassword");
/* Buffer passed in explicitly rather than relied on as an ambient global, the
   same way auth-token-hygiene.test.js hands `crypto` and `Buffer` to the code it
   lifts. The lifted rule uses Buffer.byteLength, and a harness where that
   resolves by accident is a harness that breaks on a different test
   environment. */
const validatePassword = validateSrc
  ? new Function("Buffer", `${validateSrc}; return validatePassword;`)(Buffer)
  : null;

/** The body of one route handler, so a call can be located in the right one. */
function handler(method, route) {
  const at = SRC.indexOf(`app.${method}('${route}'`);
  if (at === -1) return "";
  let depth = 0, started = false;
  for (let i = at; i < SRC.length; i++) {
    if (SRC[i] === "(") { depth++; started = true; }
    else if (SRC[i] === ")") { depth--; if (started && depth === 0) return SRC.slice(at, i + 1); }
  }
  return "";
}

describe("the harness is pointed at the real code", () => {
  it("finds validatePassword", () => {
    expect(validateSrc).not.toBe("");
    expect(typeof validatePassword).toBe("function");
  });

  it("finds all three handlers that set a password", () => {
    expect(handler("post", "/api/auth/register")).not.toBe("");
    expect(handler("post", "/api/auth/reset-password")).not.toBe("");
    expect(handler("patch", "/api/auth/profile")).not.toBe("");
  });
});

describe("the rule itself", () => {
  const ok = (p) => expect(validatePassword(p)).toBe(null);
  const rejected = (p) => expect(typeof validatePassword(p)).toBe("string");

  it("accepts a password that meets every rule", () => {
    ok("Password1");
    ok("Tr1mioIsGood");
  });

  it("rejects absent, empty and short", () => {
    for (const p of [undefined, null, "", "Pass1", "Abc12345".slice(0, 7)]) rejected(p);
  });

  it("requires an uppercase letter and a digit", () => {
    rejected("password1");
    rejected("Passwordd");
  });

  it("rejects anything over bcrypt's 72 byte limit", () => {
    /* Over the limit bcrypt silently ignores the tail, so accepting these would
       mean two different passwords authenticating the same account. */
    ok("A1" + "x".repeat(70));                 // exactly 72 bytes
    rejected("A1" + "x".repeat(71));           // 73
    rejected("A1" + "x".repeat(500));
  });

  it("counts BYTES, not characters, which is the whole point", () => {
    /* 40 umlauts is 80 bytes in UTF-8 and 40 in .length. A character based
       check would admit this and let bcrypt truncate it. */
    const german = "A1" + "ü".repeat(40);
    expect(german.length).toBeLessThan(73);
    expect(Buffer.byteLength(german, "utf8")).toBeGreaterThan(72);
    rejected(german);

    // An emoji is four bytes, so 20 of them is 80.
    const emoji = "A1" + "🙂".repeat(20);
    expect(emoji.length).toBeLessThan(73);
    rejected(emoji);
  });

  it("still accepts a long non-ASCII password that fits in 72 bytes", () => {
    // The limit must not become "no accents allowed".
    const p = "A1" + "ü".repeat(30); // 62 bytes
    expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(72);
    ok(p);
  });

  it("uses Buffer.byteLength rather than .length for that check", () => {
    expect(validateSrc).toMatch(/Buffer\.byteLength\(password, 'utf8'\)/);
  });
});

describe("all three paths enforce it, and identically", () => {
  it("registration validates before hashing", () => {
    const h = handler("post", "/api/auth/register");
    expect(h).toMatch(/validatePassword\(password\)/);
    expect(h.indexOf("validatePassword")).toBeLessThan(h.indexOf("bcrypt.hash"));
  });

  it("password reset validates before hashing", () => {
    const h = handler("post", "/api/auth/reset-password");
    expect(h).toMatch(/validatePassword\(newPassword\)/);
    expect(h.indexOf("validatePassword")).toBeLessThan(h.indexOf("bcrypt.hash"));
  });

  it("the authenticated change validates before hashing", () => {
    /* THE assertion in this file. This is the call that was missing, and its
       absence made the one path requiring the current password the weakest of
       the three. */
    const h = handler("patch", "/api/auth/profile");
    expect(h).toMatch(/validatePassword\(newPassword\)/);
    expect(h.indexOf("validatePassword")).toBeLessThan(h.indexOf("bcrypt.hash"));
  });

  it("the authenticated change still proves the current password FIRST", () => {
    /* Order is a real property, not a style point. Validating the new password
       before checking the current one would let an attacker with a stolen
       access token distinguish "wrong current password" from "weak new
       password", and would answer for an account they cannot open. */
    const h = handler("patch", "/api/auth/profile");
    expect(h.indexOf("bcrypt.compare")).toBeLessThan(h.indexOf("validatePassword"));
    expect(h).toMatch(/Current password is incorrect/);
  });

  it("every bcrypt.hash in the file is preceded by the rule in its own handler", () => {
    /* The general form, so a fourth path added later is caught. Registration,
       reset and profile are the only three, and each must validate. */
    const handlers = [
      handler("post", "/api/auth/register"),
      handler("post", "/api/auth/reset-password"),
      handler("patch", "/api/auth/profile"),
    ];
    const hashesInHandlers = handlers.reduce(
      (n, h) => n + (h.match(/bcrypt\.hash\(/g) || []).length, 0);
    const hashesInFile = (SRC.match(/bcrypt\.hash\(/g) || []).length;
    expect(hashesInHandlers).toBe(hashesInFile);
    for (const h of handlers) expect(h).toMatch(/validatePassword\(/);
  });

  it("there is exactly one copy of the rule", () => {
    // Two copies is how the three paths drifted apart in the first place.
    expect((SRC.match(/function validatePassword\(/g) || []).length).toBe(1);
    expect((SRC.match(/Password must be at least 8 characters/g) || []).length).toBe(1);
  });
});

describe("the client enforces the same byte limit, so the two cannot disagree", () => {
  /* The server change alone would have created a mismatch: the app validated
     length, uppercase and digit on all three screens and had no upper bound, so
     a long passphrase would have been accepted locally and refused by the
     backend with an English string. The client half exists for the message, not
     for the security, which is why the server keeps its own check. */
  const GATE_RAW = read("components/PasswordStrength.tsx");
  /* Comments stripped: the comment above the helper NAMES the two APIs it
     deliberately avoids, so asserting against the raw text fails on the
     explanation rather than on the code. Same trap as PremiumGate in
     display-localization.test.js. */
  const GATE = GATE_RAW.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

  it("uses the same limit as the server", () => {
    const client = /PASSWORD_MAX_BYTES = (\d+)/.exec(GATE);
    expect(client).not.toBe(null);
    expect(Number(client[1])).toBe(72);
    expect(validateSrc).toMatch(/> 72/);
  });

  it("counts bytes with arithmetic, not with an API the phone may not have", () => {
    /* Buffer is Node and does not exist in the app. TextEncoder is not in
       Hermes either and nothing here polyfills it, so either one would throw a
       ReferenceError inside the press handler instead of validating. */
    expect(GATE).not.toMatch(/Buffer\.byteLength/);
    expect(GATE).not.toMatch(/TextEncoder\(\)/);
    expect(GATE).toMatch(/for \(const ch of password\)/);
    expect(GATE).toMatch(/codePointAt/);
  });

  it("the byte count is right, mirrored, including for surrogate pairs", () => {
    /* The real function cannot be imported (its module pulls in react-native),
       so its arithmetic is mirrored and checked against Node's own UTF-8
       encoder, which is the authority on the answer. */
    const mirror = (s) => {
      let bytes = 0;
      for (const ch of s) {
        const cp = ch.codePointAt(0) ?? 0;
        bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      }
      return bytes;
    };
    for (const s of ["", "abc", "\u00fc", "\u00fc\u00fc\u00fc", "\u20ac", "\u{1F642}", "A1\u{1F642}\u00fcz", "Password1"]) {
      expect(mirror(s)).toBe(Buffer.byteLength(s, "utf8"));
    }
    // An emoji is four bytes, not two two-byte halves.
    expect(mirror("\u{1F642}")).toBe(4);
  });

  it("is kept OUT of isPasswordValid on purpose", () => {
    /* isPasswordValid mirrors the three requirements the meter draws, and all
       three screens answer false from it with "at least 8 characters, one
       uppercase, one number". Folding length into it would show that sentence
       to somebody whose password is 120 characters. */
    const fn = GATE.slice(GATE.indexOf("export function isPasswordValid"));
    expect(fn.slice(0, fn.indexOf("}"))).not.toMatch(/TextEncoder|MAX_BYTES/);
  });

  it("all three password screens check it, with the length specific message", () => {
    for (const f of ["app/register.tsx", "app/forgot-password.tsx", "app/account-settings.tsx"]) {
      const src = read(f);
      expect(src).toMatch(/isPasswordTooLong\(/);
      expect(src).toMatch(/common\.errPasswordTooLong/);
    }
  });

  it("the message exists in both languages and does not describe the wrong rule", () => {
    for (const lang of ["en", "de"]) {
      const s = JSON.parse(read(`locales/${lang}.json`)).common.errPasswordTooLong;
      expect(typeof s).toBe("string");
      expect(s.match(/—|–|\S\s+-\s+\S/)).toBeNull();
      // It must talk about length, not about uppercase letters and digits.
      expect(/lang|long/.test(s) || /zu lang/.test(s)).toBe(true);
    }
  });

  it("the two rules agree on the same inputs, mirrored", () => {
    /* The client helper cannot be imported here (it is a .tsx importing
       react-native), so its rule is mirrored and run against the REAL server
       function beside it. A disagreement on any of these is a password the app
       accepts and the server rejects. */
    /* Buffer here is Node's own encoder, used as the oracle. The client's own
       arithmetic is checked against it in the assertion above, so this is
       comparing the server's rule to the same byte count the client computes. */
    const clientTooLong = (p) => Buffer.byteLength(p, "utf8") > 72;
    const cases = [
      "Password1",
      "A1" + "x".repeat(70),
      "A1" + "x".repeat(71),
      "A1" + "\u00fc".repeat(40),
      "A1" + "\u{1F642}".repeat(20),
      "A1" + "\u00fc".repeat(30),
    ];
    for (const p of cases) {
      const serverRejectsForLength = validatePassword(p) === null ? false : /72 bytes/.test(validatePassword(p));
      expect(clientTooLong(p)).toBe(serverRejectsForLength);
    }
  });
});

describe("login semantics are unchanged", () => {
  it("login does not validate the password it was given", () => {
    /* Deliberate. An existing user's password may predate any rule here, and it
       is still their correct password. Validation belongs where a password is
       created. Adding it here would sign out real users with no way back. */
    const h = handler("post", "/api/auth/login");
    expect(h).not.toBe("");
    expect(h).not.toMatch(/validatePassword/);
  });

  it("login still compares against the stored hash", () => {
    expect(handler("post", "/api/auth/login")).toMatch(/bcrypt\.compare/);
  });
});

describe("the previous behaviour, for comparison", () => {
  it("the old rule accepted a one character password on the profile path", () => {
    /* There was no function to call there, so the old behaviour is simply "no
       check". Modelled as such: this is what the missing call was worth. */
    const oldProfileRule = () => null;
    expect(oldProfileRule("a")).toBe(null);
    expect(typeof validatePassword("a")).toBe("string");
  });

  it("the old rule accepted a password bcrypt would truncate", () => {
    const oldRule = (p) => {
      if (!p || p.length < 8) return "short";
      if (!/[A-Z]/.test(p)) return "upper";
      if (!/[0-9]/.test(p)) return "digit";
      return null;
    };
    const long = "A1" + "x".repeat(200);
    expect(oldRule(long)).toBe(null);
    expect(typeof validatePassword(long)).toBe("string");
  });
});
