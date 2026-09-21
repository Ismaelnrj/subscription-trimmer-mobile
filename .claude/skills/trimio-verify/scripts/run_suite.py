#!/usr/bin/env python3
"""Run Trimio's source-reading jest suites on bare Node, in a sandbox.

    run_suite.py                      every __tests__/*.test.js
    run_suite.py theme-contrast       one suite, name or path
    run_suite.py --quiet              totals only

THE POINT. A cloud session has no `node_modules`, because installs are blocked,
so `pnpm test` cannot run and CI is the only place the real runner lives. Most
suites here only READ SOURCE and assert about it, and those need nothing from
jest except the vocabulary, which scripts/jest_shim.js provides.

THE DISTINCTION THAT MATTERS, and the reason this is a script rather than a
one-liner: a suite that CANNOT RUN and a suite that RAN AND FAILED mean opposite
things, and a harness that reports them the same way is worse than no harness.
A suite importing a `.ts` module dies on module resolution here, because nothing
transforms TypeScript. That is NEEDS REAL JEST, not a failure, and it is
reported separately and excluded from the failure count.

WHAT THIS CANNOT TELL YOU, ever:
  - whether the project typechecks. tools/typecheck.py exits 2 in a sandbox and
    only the owner's machine or CI can answer it.
  - whether a behavioural suite passes. Those need the real runner.
Never report a green run here as "the tests pass". Say which suites ran.
"""

import argparse
import pathlib
import subprocess
import sys

# scripts -> trimio-verify -> skills -> .claude -> repo root. Counted, because
# an off-by-one here makes every suite "not found" and reports zero failures,
# which looks exactly like success.
ROOT = pathlib.Path(__file__).resolve().parents[4]
SHIM = pathlib.Path(__file__).resolve().parent / "jest_shim.js"

RAN_AND_FAILED = 1
COULD_NOT_RUN = 3


def suites(name: str | None):
    tests = ROOT / "__tests__"
    if name:
        for cand in (tests / name, tests / f"{name}.test.js", pathlib.Path(name)):
            if cand.is_file():
                return [cand]
        print(f"no suite matching {name!r} under {tests}", file=sys.stderr)
        return []
    return sorted(tests.glob("*.test.js"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("suite", nargs="?", help="suite name or path; omit for all")
    ap.add_argument("--quiet", action="store_true", help="totals only")
    args = ap.parse_args()

    files = suites(args.suite)
    if not files:
        print(f"no suites found under {ROOT / '__tests__'}", file=sys.stderr)
        return 2

    ok, bad, unrunnable = [], [], []
    for f in files:
        proc = subprocess.run([ "node", str(SHIM), str(f) ],
                              cwd=ROOT, capture_output=True, text=True)
        tail = [l for l in proc.stdout.strip().split("\n") if l.strip()]
        summary = tail[-1] if tail else "(no output)"
        if proc.returncode == COULD_NOT_RUN:
            unrunnable.append((f.name, summary))
        elif proc.returncode == RAN_AND_FAILED:
            bad.append((f.name, summary))
            if not args.quiet:
                print(proc.stdout)
        else:
            ok.append((f.name, summary))

    for label, rows in (("PASSED", ok), ("FAILED", bad), ("NEEDS REAL JEST", unrunnable)):
        if not rows:
            continue
        print(f"\n{label}")
        for name, summary in rows:
            print(f"  {name:<34} {summary}")

    print(f"\n{len(ok)} suites passed, {len(bad)} failed, "
          f"{len(unrunnable)} need the real runner.")
    if unrunnable:
        print("The last group is NOT a failure: nothing here transforms TypeScript,\n"
              "so a suite importing a .ts module cannot execute in a sandbox. CI runs\n"
              "them. Do not report a green run here as 'the tests pass': say which\n"
              "suites ran, and say that typecheck.py did not.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
