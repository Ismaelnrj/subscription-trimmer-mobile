"""Runs the project's own TypeScript and refuses to report a pass it did not earn.

`npx tsc --noEmit` looks like a safe pre build check and is not. In a sandbox
with no node_modules, npx falls through to whatever tsc is on PATH. A newer
compiler rejects this tsconfig outright (TS5107 on moduleResolution=node10,
TS5101 on baseUrl), prints two config errors, and exits before typechecking a
single file. Piping that through `tail` hides the exit code too, so the run
reads as clean.

That is not hypothetical: it shipped a crash. buildTips gained a `t` parameter,
one call site in app/(tabs)/index.tsx kept passing the threshold number into
that slot, and the "clean" typecheck never looked at the file. Users got
"TypeError: 50 is not a function" on the dashboard.

So this script asserts the two things a bare tsc call does not:
  1. the compiler is the project's pinned one in node_modules, not a stray global
  2. it actually typechecked files, rather than dying on the config

Exit code is 0 only when a real typecheck ran and found nothing.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCAL_TSC = ROOT / "node_modules" / "typescript" / "bin" / "tsc"

# Errors in the TS5xxx range are about the config or the command line, not the
# code. tsc emits them and stops, so treating them as "no errors found" is the
# exact failure this script exists to prevent.
CONFIG_ERROR = re.compile(r"error TS5\d{3}:")
CODE_ERROR = re.compile(r"error TS\d+:")


def fail(msg):
    print("TYPECHECK DID NOT RUN: " + msg, file=sys.stderr)
    raise SystemExit(2)


def main():
    if not LOCAL_TSC.exists():
        fail(
            "node_modules/typescript is missing, so `npx tsc` would silently use a\n"
            "global compiler that cannot read this tsconfig. Run `pnpm install` first.\n"
            "In a cloud sandbox where installs are blocked, there is no way to\n"
            "typecheck this project: say so, do not claim a clean run."
        )

    pinned = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    want = pinned.get("devDependencies", {}).get("typescript", "")
    have = json.loads(
        (ROOT / "node_modules" / "typescript" / "package.json").read_text(encoding="utf-8")
    )["version"]

    proc = subprocess.run(
        [str(LOCAL_TSC), "--noEmit"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    out = (proc.stdout + proc.stderr).strip()

    if CONFIG_ERROR.search(out):
        fail(
            "tsc rejected tsconfig.json and stopped before checking any file:\n\n"
            + out
        )

    if out:
        print(out)
        if CODE_ERROR.search(out):
            print(
                "\nTypecheck failed (typescript %s, pinned %s)." % (have, want),
                file=sys.stderr,
            )
            raise SystemExit(1)

    if proc.returncode != 0:
        fail("tsc exited %d with no parseable diagnostics:\n\n%s" % (proc.returncode, out))

    print("Typecheck clean (typescript %s, pinned %s)." % (have, want))


if __name__ == "__main__":
    main()
