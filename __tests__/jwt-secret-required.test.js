/* JWT_SECRET is required, and a missing one can never fall back to a key that
 * is in this repository.
 *
 * WHAT WAS WRONG. The secret defaulted to the literal string
 * 'subtrimmer-dev-secret-change-in-production' and the refusal to run on it was
 * gated on `process.env.NODE_ENV === 'production'`. Nothing in this deployment
 * sets NODE_ENV: backend/Dockerfile did not, and Railway does not set it for a
 * Dockerfile build. So the branch that existed to protect production was the
 * one branch production never took, and an unset JWT_SECRET would have booted
 * the real service signing tokens with a key anybody who can read the source
 * can read. Forging a token for any user id is then a one liner.
 *
 * WHAT THIS RUNS. The startup guard is lifted out of backend/server.js by text
 * and EXECUTED against a fake process, once per environment worth testing.
 * Nothing is reimplemented, so what these assertions measure is the code the
 * server ships. Requiring the module is not an option: it opens a database pool
 * at import.
 *
 * NEGATIVE TESTED against the previous implementation, which is the only honest
 * way to show the change did anything: the old block is reconstructed at the
 * bottom of this file and the same three environments are run through it. It
 * survives two of them, and the value it survives with is the leaked key.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

const START = "const LEAKED_DEV_SECRET";
const END = "console.log('DATABASE_URL set:";

/** The shipped startup guard, as source. Empty rather than throwing if it has
 *  moved: a harness that dies at module load reports "0 passed, 0 failed",
 *  which looks survivable and is the silent pass this project keeps
 *  rediscovering. The first assertion below reports it instead. */
function liftGuard() {
  const a = SRC.indexOf(START);
  const b = SRC.indexOf(END);
  if (a === -1 || b === -1 || b < a) return "";
  return SRC.slice(a, b);
}

/** Runs a guard against one environment and reports what it did.
 *  `exited` is the exit code if it called process.exit, otherwise null, and
 *  `secret` is the value JWT_SECRET was actually bound to. */
function run(code, env) {
  const logged = [];
  let exited = null;
  const ctx = {
    process: {
      env,
      exit(c) {
        exited = c;
        // The real process stops here. Throwing models that, so nothing after
        // the guard can observe a secret the server would never have used.
        throw new Error("__exit__");
      },
    },
    console: { error: (m) => logged.push(String(m)), warn: (m) => logged.push(String(m)) },
    out: {},
  };
  vm.createContext(ctx);
  try {
    vm.runInContext(code + "\nout.secret = typeof JWT_SECRET === 'undefined' ? null : JWT_SECRET;", ctx);
  } catch (e) {
    if (e.message !== "__exit__") throw e;
  }
  return { exited, secret: ctx.out.secret ?? null, logged: logged.join("\n") };
}

const LEAKED = "subtrimmer-dev-secret-change-in-production";
const GOOD = "S0meLongRandomSecretValue-48-bytes-worth-of-entropy";

describe("the harness is pointed at the real guard", () => {
  it("finds the startup block it claims to test", () => {
    expect(liftGuard()).not.toBe("");
  });
});

describe("the shipped guard", () => {
  const CODE = liftGuard();

  it("refuses to start with no JWT_SECRET at all", () => {
    const r = run(CODE, {});
    expect(r.exited).toBe(1);
    expect(r.logged).toMatch(/FATAL/);
  });

  it("refuses an empty JWT_SECRET", () => {
    expect(run(CODE, { JWT_SECRET: "" }).exited).toBe(1);
  });

  it("refuses a whitespace-only JWT_SECRET", () => {
    // "  " is truthy, so a bare falsiness check would have accepted it and
    // signed tokens with two spaces.
    expect(run(CODE, { JWT_SECRET: "   " }).exited).toBe(1);
  });

  it("refuses the old hardcoded value, which is published in this repo", () => {
    /* Deleting the fallback is not enough on its own. A deployment that had
       copied that string into its environment would keep running on a key
       everybody can read, and it would look configured. */
    const r = run(CODE, { JWT_SECRET: LEAKED });
    expect(r.exited).toBe(1);
    expect(r.logged).toMatch(/repository/);
  });

  it("NEVER binds JWT_SECRET to a default when the variable is absent", () => {
    // THE assertion in this file. Whatever else happens, there must be no
    // usable signing key that did not come from the environment.
    for (const env of [{}, { JWT_SECRET: "" }, { JWT_SECRET: "   " }]) {
      const r = run(CODE, env);
      expect(r.exited).toBe(1);
      expect(r.secret === null || r.secret === "" || r.secret.trim() === "").toBe(true);
    }
  });

  it("does not care what NODE_ENV says, in either direction", () => {
    /* The whole defect was a security decision delegated to a variable that
       says which log level you want. Absent must fail even with NODE_ENV
       unset, and a real secret must work even with NODE_ENV=production. */
    expect(run(CODE, { NODE_ENV: "development" }).exited).toBe(1);
    expect(run(CODE, { NODE_ENV: "production" }).exited).toBe(1);
    expect(run(CODE, { JWT_SECRET: LEAKED, NODE_ENV: "development" }).exited).toBe(1);
    expect(run(CODE, { JWT_SECRET: GOOD, NODE_ENV: "production" }).exited).toBe(null);
  });

  it("starts on a real secret, and uses exactly what it was given", () => {
    const r = run(CODE, { JWT_SECRET: GOOD });
    expect(r.exited).toBe(null);
    expect(r.secret).toBe(GOOD);
  });

  it("warns about a short secret without refusing to boot over it", () => {
    /* Absent and publicly known are facts. "Shorter than I would like" is a
       judgement, and a refusal on a threshold picked in this file would take a
       working service down over one. */
    const r = run(CODE, { JWT_SECRET: "Short1But-Valid" });
    expect(r.exited).toBe(null);
    expect(r.logged).toMatch(/WARNING/);
  });

  it("runs before the server can accept a request", () => {
    // Order matters as much as the check: exiting after listen() would leave a
    // window where requests are served.
    expect(SRC.indexOf(START)).toBeLessThan(SRC.indexOf("app.listen"));
  });
});

describe("the source has no way back to a default", () => {
  it("has no `process.env.JWT_SECRET ||` fallback", () => {
    expect(/JWT_SECRET\s*=\s*process\.env\.JWT_SECRET\s*\|\|/.test(SRC)).toBe(false);
  });

  it("does not mention NODE_ENV anywhere in the JWT decision", () => {
    expect(liftGuard()).not.toMatch(/NODE_ENV/);
  });

  it("signs and verifies with that one constant and nothing else", () => {
    // Every use site still reads the checked constant, so there is no second
    // key material path that skipped the guard.
    /* NOT `jwt.verify\([^)]*JWT_SECRET`. The real call is
       `jwt.verify(header.split(' ')[1], JWT_SECRET)`, and a negated character
       class stops at the `)` inside split(), so that pattern reports correct
       code as missing. This project has now paid for that lesson three times:
       count brackets or avoid them, never match them with [^)]. */
    expect(SRC).toMatch(/jwt\.sign\(\{ userId \}, JWT_SECRET/);
    expect(SRC).toMatch(/jwt\.verify\(.*, JWT_SECRET\)/);
    expect(SRC).not.toMatch(/jwt\.sign\([^)]*['"]subtrimmer/);
  });
});

describe("the previous implementation, for comparison", () => {
  /* Reconstructed rather than read from git, so this file has no dependency on
     history being reachable. This is what these assertions are worth: run the
     old block through the same environments and it boots on the leaked key in
     two of the three, which is precisely the production configuration. */
  const OLD = `
    const JWT_SECRET = process.env.JWT_SECRET || '${LEAKED}';
    if (JWT_SECRET === '${LEAKED}') {
      if (process.env.NODE_ENV === 'production') {
        console.error('FATAL');
        process.exit(1);
      }
      console.warn('WARNING');
    }
  `;

  it("booted on the leaked key whenever NODE_ENV was not exactly production", () => {
    const r = run(OLD, {});
    expect(r.exited).toBe(null);
    expect(r.secret).toBe(LEAKED);
  });

  it("booted on it with NODE_ENV=development too", () => {
    expect(run(OLD, { NODE_ENV: "development" }).secret).toBe(LEAKED);
  });

  it("only refused in the one configuration this deployment never set", () => {
    expect(run(OLD, { NODE_ENV: "production" }).exited).toBe(1);
  });
});
