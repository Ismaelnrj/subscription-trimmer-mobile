"""Runs `lib/language-store.ts` for real and checks what it passes the scheduler.

WHY THIS EXISTS RATHER THAN A JEST TEST. `rescheduleReminders` reaches its three
dependencies through dynamic `import()`. Babel leaves those untransformed and
jest's VM rejects them with ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG, which
the store's own try/catch then swallows. A behavioural test there goes green
having executed nothing, which is the precise failure mode this project keeps
recording. `__tests__/language-reminders.test.js` is therefore a source-reading
test and says so in its own header.

Making jest execute that path needs a babel plugin devDependency and a transform
override coupled to jest-expo's preset internals. Considered on 2026-09-18 and
declined: a build-config change that cannot be verified from a sandbox, to cover
three lines, is a worse trade than this script.

WHAT IT ACTUALLY DOES. Copies the real module into a temporary directory with
its imports rewritten to local stubs, then executes it on Node's native
TypeScript stripping. Nothing is reimplemented: the store's own logic decides
what the scheduler receives, and the assertions read the calls it made.

THE BUG IT PINS. Until 2026-09-18 the store called the scheduler with no
preferences, so the scheduler's `{}` default meant push on, renewal alerts on
and a three day lead. Switching language therefore re-enabled reminders somebody
had turned off and replaced a seven day choice with three. Nothing errored.
`prefs ?? {}` then fixed only the CACHED case, leaving the same bug in a
narrower window whenever the preferences query had not resolved.

Exit 0 means every case ran and passed. Exit 2 means it could not run at all,
which is a refusal rather than a pass: this project has already shipped a crash
behind a check that silently declined to look.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
STORE = ROOT / "lib" / "language-store.ts"

# Node gained `--experimental-strip-types` in 22.6 and enables it by default
# from 22.18. Below that this script cannot run, and must say so rather than
# exit 0 having checked nothing. Same lesson as tools/typecheck.py, which was
# written to stop a silent pass and then spent its whole life unable to run on
# the one machine where it mattered.
MIN_NODE = (22, 6)

STUBS = {
    "zustand.ts": """
export function create(fn) {
  let state;
  const set = (p) => { state = { ...state, ...(typeof p === "function" ? p(state) : p) }; };
  state = fn(set, () => state);
  const store = () => state;
  store.getState = () => state;
  return store;
}
""",
    "expo-secure-store.ts": """
export async function setItemAsync(_k, _v) {}
export async function getItemAsync(_k) { return null; }
""",
    "i18n.ts": """
export default { language: "en", changeLanguage: async (_l) => {} };
""",
    "currency-store.ts": """
export const useCurrencyStore = { getState: () => ({ currency: { symbol: "$" } }) };
""",
    "query-client.ts": """
export let prefs;
export const seen = [];
export function setPrefs(p) { prefs = p; }
export const queryClient = {
  getQueryData(key) {
    seen.push(JSON.stringify(key));
    if (key[0] === "subscriptions") return [{ id: 1, name: "Netflix", price: 15.99, nextBillingDate: "2026-12-01" }];
    if (key[0] === "notifications") return prefs;
    return undefined;
  },
};
""",
    "notification-scheduler.ts": """
export const calls = [];
export async function scheduleRenewalReminders(subs, symbol, prefs) { calls.push([subs, symbol, prefs]); }
export async function cancelAllReminders() {}
""",
}

# Each case: the cached preferences, then what the scheduler must receive.
RUNNER = """
import { useLanguageStore } from "./language-store.ts";
import { calls } from "./notification-scheduler.ts";
import { setPrefs, seen } from "./query-client.ts";

// The reschedule is fire and forget inside its own catch, on purpose: changing
// language must succeed with notifications denied or the cache empty. So it
// lands a few microtasks after setLanguage resolves.
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${detail ? "   " + detail : ""}`);
  if (!ok) failures++;
}

async function run(prefs) {
  setPrefs(prefs);
  calls.length = 0;
  await useLanguageStore.getState().setLanguage("de");
  await settle();
  return calls;
}

/* The third argument, or null. Optional chaining throughout, because the
   ORIGINAL defect was that this argument did not exist: a bare `c[0][2].x`
   crashes on exactly the code this script is here to catch, and a stack trace
   is a worse report than a named failing line. */
const got = (c) => (c.length === 1 && c[0][2] != null ? c[0][2] : null);

async function main() {
  let c = await run({ pushEnabled: false, renewalAlerts: true, renewalAlertDays: 3 });
  check("a disabled push preference survives a language change",
        got(c)?.pushEnabled === false, `scheduler got ${JSON.stringify(got(c))}`);

  c = await run({ pushEnabled: true, renewalAlerts: false, renewalAlertDays: 3 });
  check("a disabled renewal alert survives",
        got(c)?.renewalAlerts === false, `scheduler got ${JSON.stringify(got(c))}`);

  c = await run({ pushEnabled: true, renewalAlerts: true, renewalAlertDays: 7 });
  check("a seven day lead is not replaced by three",
        got(c)?.renewalAlertDays === 7, `scheduler got ${JSON.stringify(got(c))}`);

  // Not loaded is not consent. The scheduler reads an absent preference as ON,
  // which is right for the scheduler and wrong for this caller.
  c = await run(undefined);
  check("unloaded preferences schedule nothing at all",
        c.length === 0, `scheduler called ${c.length} time(s)`);

  check("reads the cache key the rest of the app writes",
        seen.includes(JSON.stringify(["notifications", "preferences"])));

  console.log(failures ? `\\n${failures} failing` : "\\nlanguage store OK");
  process.exit(failures ? 1 : 0);
}
main();
"""


def node_version():
    exe = shutil.which("node")
    if not exe:
        return None, None
    out = subprocess.run([exe, "--version"], capture_output=True, text=True).stdout.strip()
    m = re.match(r"v(\d+)\.(\d+)", out)
    return exe, (tuple(int(g) for g in m.groups()) if m else None)


def main():
    exe, ver = node_version()
    if not exe:
        print("REFUSED: no node on PATH, so nothing was checked.", file=sys.stderr)
        return 2
    if not ver or ver < MIN_NODE:
        print(f"REFUSED: node {'.'.join(map(str, ver)) if ver else '?'} cannot strip "
              f"TypeScript. Needs {'.'.join(map(str, MIN_NODE))} or newer. "
              f"Nothing was checked.", file=sys.stderr)
        return 2
    if not STORE.exists():
        print(f"REFUSED: {STORE} not found.", file=sys.stderr)
        return 2

    src = STORE.read_text("utf-8")
    # Only the import specifiers are rewritten. The logic under test is the
    # file's own, unmodified, which is the whole point of doing it this way.
    rewrites = {
        '"zustand"': '"./zustand.ts"',
        '"expo-secure-store"': '"./expo-secure-store.ts"',
        '"./i18n"': '"./i18n.ts"',
        '"./query-client"': '"./query-client.ts"',
        '"./currency-store"': '"./currency-store.ts"',
        '"./notification-scheduler"': '"./notification-scheduler.ts"',
    }
    for a, b in rewrites.items():
        if a not in src:
            print(f"REFUSED: {STORE.name} no longer imports {a}. The stubs are stale, "
                  f"so this would test the wrong thing.", file=sys.stderr)
            return 2
        src = src.replace(a, b)

    with tempfile.TemporaryDirectory() as tmp:
        d = pathlib.Path(tmp)
        (d / "language-store.ts").write_text(src, "utf-8")
        for name, body in STUBS.items():
            (d / name).write_text(body, "utf-8")
        (d / "run.ts").write_text(RUNNER, "utf-8")
        p = subprocess.run([exe, "--experimental-strip-types", str(d / "run.ts")],
                           capture_output=True, text=True)
        sys.stdout.write(p.stdout)
        if p.returncode and p.stderr:
            sys.stderr.write(p.stderr)
        return p.returncode


if __name__ == "__main__":
    sys.exit(main())
