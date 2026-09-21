#!/usr/bin/env python3
"""Prove a new test would have caught the bug it was written for.

    negative_test.py theme-contrast                 against HEAD
    negative_test.py theme-contrast --ref HEAD~3    against any ref
    negative_test.py --all                          every suite, against HEAD

A guard nobody has watched fail is a guard nobody has tested. This repo has that
lesson twice over: tools/typecheck.py was broken on the owner's machine for its
entire life and nobody found out, and a touch target assertion written last week
passed against the defective code by accident because it was reading a different
control.

WHAT IT DOES. Checks `--ref` out into a throwaway git worktree, copies the CURRENT
test file into it, runs it there and in the working tree, and prints both results
side by side. The test travels, the source does not, so a failure in the worktree
is the test catching the old behaviour.

HOW TO READ IT. Assertions that fail against the ref and pass now are the ones
doing work. Assertions that pass BOTH ways are not worthless: several here exist
to stop a future reader "improving" something that is already correct, and the
right thing is to say which are which rather than to aim for 100%.

Nothing is left behind: the worktree is removed even when the run fails.
"""

import argparse
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[4]
SHIM = pathlib.Path(__file__).resolve().parent / "jest_shim.js"


def resolve(name: str) -> pathlib.Path | None:
    tests = ROOT / "__tests__"
    for cand in (tests / name, tests / f"{name}.test.js", pathlib.Path(name)):
        if cand.is_file():
            return cand
    return None


def run(test_path: pathlib.Path, cwd: pathlib.Path) -> tuple[int, str]:
    proc = subprocess.run(["node", str(SHIM), str(test_path)],
                          cwd=cwd, capture_output=True, text=True)
    lines = [l for l in proc.stdout.strip().split("\n") if l.strip()]
    return proc.returncode, (lines[-1] if lines else "(no output)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("suite", nargs="?", help="suite name or path")
    ap.add_argument("--ref", default="HEAD", help="git ref to compare against (default HEAD)")
    ap.add_argument("--all", action="store_true", help="every suite in __tests__")
    ap.add_argument("--verbose", action="store_true", help="print the old run in full")
    args = ap.parse_args()

    if args.all:
        targets = sorted((ROOT / "__tests__").glob("*.test.js"))
    elif args.suite:
        found = resolve(args.suite)
        if not found:
            print(f"no suite matching {args.suite!r}", file=sys.stderr)
            return 2
        targets = [found]
    else:
        ap.error("give a suite name or --all")

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="trimio-negative-"))
    tree = tmp / "old"
    try:
        add = subprocess.run(["git", "worktree", "add", "-q", "--detach", str(tree), args.ref],
                             cwd=ROOT, capture_output=True, text=True)
        if add.returncode != 0:
            # Most often a shallow clone, which cannot reach the ref. Say so
            # rather than reporting the comparison as clean: this repo has a
            # recorded incident where a shallow clone made git's ancestry answers
            # lie in both directions.
            print("could not create the worktree:\n" + add.stderr.strip(), file=sys.stderr)
            print("\nIf this is a sandbox, run `git fetch --unshallow origin` first: "
                  "a shallow clone cannot reach older refs and every ancestry answer "
                  "it gives is untrustworthy.", file=sys.stderr)
            return 2

        print(f"comparing against {args.ref}\n")
        worse = 0
        for t in targets:
            shutil.copy(t, tree / "__tests__" / t.name)
            old_code, old_summary = run(tree / "__tests__" / t.name, tree)
            new_code, new_summary = run(t, ROOT)
            verdict = ("catches the old behaviour" if old_code == 1 and new_code == 0
                       else "PASSES BOTH WAYS, so it guards nothing that changed"
                       if old_code == 0 and new_code == 0
                       else "fails NOW, which is a real problem" if new_code == 1
                       else "could not run in one of the two trees")
            if old_code == 0 and new_code == 0:
                worse += 1
            print(f"{t.name}")
            print(f"  against {args.ref:<10} {old_summary}")
            print(f"  working tree      {new_summary}")
            print(f"  -> {verdict}\n")
            if args.verbose and old_code == 1:
                print(run(tree / "__tests__" / t.name, tree)[1])

        if worse:
            print(f"{worse} suite(s) pass against {args.ref} as well as now. That is fine when\n"
                  "they exist to stop a future regression, and a problem when they were\n"
                  "written to catch a bug you just fixed. Know which you have.")
        return 0
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", str(tree)],
                       cwd=ROOT, capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
