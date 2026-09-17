#!/usr/bin/env python3
"""Run every check that has to pass before Trimio ships, and be honest.

    preflight.py

Five checks, each of which has already caught something real:

  typecheck      A bare `npx tsc` once passed silently and shipped a crash to
                 every user. tools/typecheck.py insists on the pinned compiler
                 and treats a config error as a failure rather than an empty
                 pass. In a sandbox it cannot run at all, which this reports as
                 SKIPPED, never as passed.
  legal sync     The two copies of each legal document, in the app and on the
                 server, plus the German ones, and the no dash rule on all four.
  locale parity  Key names AND placeholder tokens. Counting keys alone once
                 reported 562 on both sides while a German string had quietly
                 dropped a {{symbol}} the English spent.
  copy rule      No dash as clause-separating punctuation in anything a user
                 reads. Eight English strings broke this while German had none.
  price freshness  A verified catalogue row that ages past the six month window
                 stops generating the market price insight, silently. Nothing
                 logs it, so the only way to notice is to look on purpose.

The point of collecting them here is that "did I run all of them" is itself a
thing to get wrong at the end of a long day, and a check you forgot is
indistinguishable from a check that passed.
"""

import json
import pathlib
import re
import subprocess
import sys

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def check_typecheck():
    if not pathlib.Path("node_modules/typescript").exists():
        return SKIP, ("no node_modules, so the pinned compiler is absent. "
                      "This is the correct answer in a sandbox: run it on the "
                      "machine that has the dependencies installed.")
    code, out = run([sys.executable, "tools/typecheck.py"])
    if code == 0:
        return PASS, out.splitlines()[-1] if out else ""
    # Showing only the summary line here was useless: it said "Typecheck
    # failed" and hid every diagnostic, so the next step was always to run the
    # same command again by hand. A failing check has to say what failed.
    errors = [l for l in out.splitlines() if ": error TS" in l]
    return FAIL, _detail(errors, out)


def _detail(errors, raw):
    if not errors:
        return raw.strip().splitlines()[-1] if raw.strip() else "no output"
    head = f"{len(errors)} error(s)"
    shown = "\n".join("        " + e for e in errors[:12])
    more = f"\n        ... and {len(errors) - 12} more" if len(errors) > 12 else ""
    return f"{head}\n{shown}{more}"


def check_legal():
    code, out = run([sys.executable, "tools/check-legal-sync.py"])
    bad = [l for l in out.splitlines() if l.startswith("FAIL")]
    return (PASS if code == 0 else FAIL), (bad[0] if bad else
                                           f"{len(out.splitlines())} checks")


def flatten(node, prefix=""):
    out = {}
    if isinstance(node, dict):
        items = node.items()
    elif isinstance(node, list):
        items = ((str(i), v) for i, v in enumerate(node))
    else:
        return {prefix: node}
    for k, v in items:
        key = f"{prefix}.{k}" if prefix else k
        out.update(flatten(v, key) if isinstance(v, (dict, list)) else {key: v})
    return out


def check_locales():
    en = flatten(json.loads(pathlib.Path("locales/en.json").read_text("utf-8")))
    de = flatten(json.loads(pathlib.Path("locales/de.json").read_text("utf-8")))
    missing = set(en) ^ set(de)
    tok = lambda s: set(re.findall(r"\{\{(\w+)\}\}", s)) if isinstance(s, str) else set()
    mism = [k for k in set(en) & set(de) if tok(en[k]) != tok(de[k])]
    if missing or mism:
        parts = []
        if missing:
            parts.append(f"{len(missing)} key(s) missing on one side")
        if mism:
            parts.append(f"{len(mism)} placeholder mismatch(es): {sorted(mism)[:3]}")
        return FAIL, "; ".join(parts)
    return PASS, f"{len(en)} keys, names and placeholders both match"


def check_prices():
    """A verified row that ages past the freshness window stops generating the
    market price insight silently. Nothing logs it and nothing in the UI shows
    it, so the only way to find out is to look on purpose."""
    code, out = run([sys.executable, "tools/check-prices.py"])
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    summary = next((l for l in lines if "verified," in l), "")
    if code == 0:
        expiring = next((l for l in lines if l.startswith("No expired rows, but")), "")
        return PASS, (expiring or summary)
    bad = [l for l in lines if l.startswith(("EXPIRED", "STRUCTURAL", "UNREADABLE"))]
    return FAIL, "; ".join(bad) or summary


def check_copy_rule():
    dash = re.compile(r"[–—]|\s-\s")
    bad = []
    for path in ("locales/en.json", "locales/de.json", "backend/legal-de.json"):
        p = pathlib.Path(path)
        if not p.exists():
            continue
        for k, v in flatten(json.loads(p.read_text("utf-8"))).items():
            if isinstance(v, str) and dash.search(v) and not k.startswith("_"):
                bad.append(f"{path}:{k}")
    return (FAIL, f"{len(bad)} violation(s): {bad[:3]}") if bad else \
           (PASS, "no dash used as clause separator")


def main():
    checks = [
        ("typecheck", check_typecheck),
        ("legal sync", check_legal),
        ("locale parity", check_locales),
        ("copy rule", check_copy_rule),
        ("price freshness", check_prices),
    ]
    print()
    worst = 0
    skipped = []
    for name, fn in checks:
        try:
            status, detail = fn()
        except Exception as exc:                      # a broken check is a failure
            status, detail = FAIL, f"{type(exc).__name__}: {exc}"
        print(f"  {status}  {name:16} {detail}")
        if status == FAIL:
            worst = 1
        elif status == SKIP:
            skipped.append(name)

    print()
    if worst:
        print("  Not ready. Fix the failures above.\n")
    elif skipped:
        print(f"  Everything that could run passed, but {len(skipped)} check(s) "
              f"did not run: {', '.join(skipped)}.")
        print("  That is not the same as passing. Run this again where they "
              "can execute.\n")
    else:
        print("  All five passed.\n")
    return worst


if __name__ == "__main__":
    sys.exit(main())
