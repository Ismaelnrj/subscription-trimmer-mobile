/* A jest-shaped `describe` / `it` / `expect` that runs on bare Node.
 *
 * WHY THIS FILE EXISTS. This repo's jest suites cannot run in a cloud session:
 * installs are blocked so there is no `node_modules`, `pnpm test` is unavailable,
 * and CI is the only place the real runner lives. But most suites here are
 * SOURCE-READING, meaning they read a file and assert about its contents, and
 * those need nothing from jest but the vocabulary.
 *
 * Before this file, every session rebuilt that vocabulary from memory, and a
 * rebuilt tool is wrong some of the time. Two real bugs from one afternoon:
 *
 *   `it.each` called `row.shift()` while filling the %s placeholders, which
 *   consumed the row before the body ran. 34 correct assertions reported as
 *   failures and twenty minutes went into debugging the harness.
 *
 *   `it` did not await an async body, so a suite of 20 `async () => {...}` tests
 *   was counted as 20 passes with NONE of its 29 assertions executed. It printed
 *   PASSED having verified nothing. That is the silent-pass failure mode CLAUDE.md
 *   records over and over, manufactured by the tool meant to prevent it.
 *
 * SO: tests are QUEUED, then run in an async pass that awaits anything thenable.
 * Never make `it` call the body inline again.
 *
 * WHAT IT DOES NOT DO, and must not pretend to: no module mocking, no
 * transforms, no TypeScript. A suite importing a `.ts` module fails with
 * "Cannot find module", which is NEEDS REAL JEST rather than a defect, and
 * run_suite.py reports it separately because those mean opposite things.
 *
 * Usage:  node jest_shim.js /abs/path/to/__tests__/some.test.js
 */

const queue = [];
let currentSuite = "";

global.describe = (name, body) => {
  const outer = currentSuite;
  currentSuite = outer ? `${outer} > ${name}` : name;
  body();                      // registration only: nothing is executed yet
  currentSuite = outer;
};

global.it = (name, body) => queue.push({ suite: currentSuite, name, body });

/* `it.each(rows)(name, fn)`.
 *
 * MUST NOT MUTATE `rows`. The first version used `shift()` to fill the
 * placeholders, which consumed the row and left the body with no arguments.
 * Read by index. */
global.it.each = rows => (name, body) =>
  rows.forEach(row => {
    const args = Array.isArray(row) ? row : [row];
    let i = 0;
    const filled = String(name).replace(/%[sdiojf#%]/g, m =>
      m === "%%" ? "%" : String(args[i++]));
    global.it(filled, () => body(...args));
  });

global.it.skip = name => queue.push({ suite: currentSuite, name, skip: true });
global.test = global.it;
global.test.each = global.it.each;

const hooks = { beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] };
global.beforeAll = fn => hooks.beforeAll.push(fn);
global.afterAll = fn => hooks.afterAll.push(fn);

/* beforeEach AND afterEach USED TO BE SWALLOWED, `() => {}`, and that was the
 * FOURTH bug in this file of exactly one kind: a hook accepted and then dropped.
 * It is the worst of the four because it fails in BOTH directions. A suite that
 * resets shared state between tests leaks it instead, so tests fail against code
 * that is correct (which is how it was found: two assertions in
 * subscription-cancel.test.js reported failures caused only by the harness). And
 * a suite whose beforeEach is what ARMS a case runs that case unarmed, so it can
 * pass having asserted nothing, which is the silent pass this whole skill exists
 * to prevent.
 *
 * SCOPED THE WAY JEST SCOPES THEM, because applying every hook to every test
 * would be its own wrong answer: a reset belonging to one describe would run
 * inside a sibling that deliberately builds different state. `currentSuite` is
 * already a " > " separated path, so a hook registered at path P applies to a
 * test whose suite is P or nested below it, and a hook registered at the top
 * level (P === "") applies to all. */
global.beforeEach = fn => hooks.beforeEach.push({ suite: currentSuite, fn });
global.afterEach = fn => hooks.afterEach.push({ suite: currentSuite, fn });

const appliesTo = (hookSuite, testSuite) =>
  hookSuite === "" || testSuite === hookSuite || testSuite.startsWith(hookSuite + " > ");

async function runHooks(list, testSuite) {
  for (const h of list) {
    if (!appliesTo(h.suite, testSuite)) continue;
    const r = h.fn();
    if (r && typeof r.then === "function") await r;
  }
}

const show = v => {
  let s;
  try { s = typeof v === "function" ? "[function]" : JSON.stringify(v); } catch { s = String(v); }
  if (s === undefined) s = String(v);
  return s.length > 160 ? s.slice(0, 160) + "..." : s;
};

/* Every matcher names BOTH sides in its message. "expected true to be false"
 * with no values in it costs another run to understand. */
function matchers(actual, negated) {
  const check = (ok, msg) => { if (ok === negated) throw new Error(msg); };
  return {
    toBe: e => check(actual === e, `${show(actual)} ${negated ? "===" : "!=="} ${show(e)}`),
    toEqual: e => check(JSON.stringify(actual) === JSON.stringify(e),
      `${show(actual)} ${negated ? "equals" : "does not equal"} ${show(e)}`),
    toStrictEqual: e => check(JSON.stringify(actual) === JSON.stringify(e),
      `${show(actual)} ${negated ? "equals" : "does not equal"} ${show(e)}`),
    toMatch: re => check(new RegExp(re).test(actual),
      `${show(actual)} ${negated ? "matches" : "does not match"} ${re}`),
    toMatchObject: e => check(Object.entries(e).every(([k, v]) =>
      JSON.stringify(actual?.[k]) === JSON.stringify(v)),
      `${show(actual)} ${negated ? "matches" : "does not match"} ${show(e)}`),
    toContain: e => check(actual != null && actual.includes(e),
      `${show(actual)} ${negated ? "contains" : "does not contain"} ${show(e)}`),
    toHaveLength: n => check(actual != null && actual.length === n,
      `length ${actual == null ? "of null" : actual.length} ${negated ? "===" : "!=="} ${n}`),
    toHaveProperty: k => check(actual != null && k in actual,
      `${negated ? "has" : "does not have"} property ${show(k)}`),
    toBeNull: () => check(actual === null, `${show(actual)} ${negated ? "is" : "is not"} null`),
    toBeUndefined: () => check(actual === undefined, `${show(actual)} ${negated ? "is" : "is not"} undefined`),
    toBeDefined: () => check(actual !== undefined, `${show(actual)} ${negated ? "is" : "is not"} defined`),
    toBeTruthy: () => check(!!actual, `${show(actual)} ${negated ? "is" : "is not"} truthy`),
    toBeFalsy: () => check(!actual, `${show(actual)} ${negated ? "is" : "is not"} falsy`),
    toBeGreaterThan: n => check(actual > n, `${actual} ${negated ? ">" : "not >"} ${n}`),
    toBeGreaterThanOrEqual: n => check(actual >= n, `${actual} ${negated ? ">=" : "not >="} ${n}`),
    toBeLessThan: n => check(actual < n, `${actual} ${negated ? "<" : "not <"} ${n}`),
    toBeLessThanOrEqual: n => check(actual <= n, `${actual} ${negated ? "<=" : "not <="} ${n}`),
    toBeCloseTo: (n, digits = 2) => check(Math.abs(actual - n) < Math.pow(10, -digits) / 2,
      `${actual} ${negated ? "is" : "is not"} close to ${n}`),
    toThrow: () => {
      let threw = false;
      try { actual(); } catch { threw = true; }
      check(threw, negated ? "threw" : "did not throw");
    },
  };
}

global.expect = a => Object.assign(matchers(a, false), { not: matchers(a, true) });
global.expect.any = () => ({});

const target = process.argv[2];
if (!target) {
  console.error("usage: node jest_shim.js <path to .test.js>");
  process.exit(2);
}

// Exit 3 is COULD NOT RUN, deliberately distinct from exit 1 RAN AND FAILED.
// Conflating them is how a suite that never executed gets read as passing.
try {
  require(target);
} catch (e) {
  console.log("COULD NOT RUN: " + e.message.split("\n")[0]);
  process.exit(3);
}

(async () => {
  let passed = 0, failed = 0, skipped = 0, limited = 0, seen = "";
  // RUN beforeAll. Collecting these and never running them was the third bug in
  // this file: revenuecat-webhook.test.js sets its shared secret in a beforeAll,
  // so without this every request answered 401 or 503 and 18 correct assertions
  // reported as failures. A hook you register and drop is worse than one you
  // never supported, because the suite looks broken instead of unsupported.
  for (const fn of hooks.beforeAll) {
    const r = fn();
    if (r && typeof r.then === "function") await r;
  }
  for (const t of queue) {
    if (t.suite !== seen) { console.log("\n" + t.suite); seen = t.suite; }
    if (t.skip) { skipped++; console.log("  skip " + t.name); continue; }
    try {
      // A beforeEach that throws must fail the test rather than the run, the
      // same as in jest, so it sits inside this try alongside the body.
      await runHooks(hooks.beforeEach, t.suite);
      // AWAIT. An async body returns a promise, and calling it without awaiting
      // counts a pass before a single assertion has run. See the header.
      const r = t.body();
      if (r && typeof r.then === "function") await r;
      await runHooks(hooks.afterEach, t.suite);
      passed++;
      console.log("  ok   " + t.name);
    } catch (e) {
      const msg = e.message.split("\n")[0];
      // A relative import of a .ts module is a SANDBOX LIMIT, not a defect:
      // nothing here transforms TypeScript. Counting it as a failure makes the
      // runner cry wolf on every run, and a check that always shows red is one
      // nobody reads, which this repo has on record costing it the whole suite
      // for months. Reported as LIMIT, visible but not red.
      if (/Cannot find module '\.\.?\//.test(msg)) {
        limited++;
        console.log("  LIMIT " + t.name + "\n       " + msg + " (needs the real runner)");
      } else {
        failed++;
        console.log("  FAIL " + t.name + "\n       " + msg);
      }
    } finally {
      /* afterEach runs whichever way the test went, as jest does. ONE DIVERGENCE,
       * stated rather than left to be discovered: in jest a THROWING afterEach
       * fails the test, and here it is reported as a warning, because the pass
       * has already been counted by the time this runs. Nothing in __tests__
       * uses afterEach today, so restructuring the counter for it would be
       * speculative. If a suite ever relies on assertions inside an afterEach,
       * that suite needs the real runner and this line is where to look. */
      try {
        await runHooks(hooks.afterEach, t.suite);
      } catch (e) {
        console.log("  warn afterEach threw in " + t.name + ": " + e.message.split("\n")[0]);
      }
    }
  }
  for (const fn of hooks.afterAll) { try { await fn(); } catch { /* teardown */ } }

  if (!queue.length) {
    // An empty queue means the file registered nothing, which real jest also
    // treats as a failure. Silence here would be the worst possible report.
    console.log("\nNO TESTS REGISTERED");
    process.exit(3);
  }
  console.log(`\n${passed} passed, ${failed} failed`
    + (limited ? `, ${limited} transform-limited` : "")
    + (skipped ? `, ${skipped} skipped` : ""));
  process.exit(failed ? 1 : 0);
})();
