#!/usr/bin/env python3
"""Enforce Trimio's copy rules on anything a user reads.

    check_copy.py locales/en.json locales/de.json     dash rule
    check_copy.py store-listing-de.md                 dash rule, markdown
    check_copy.py --parity locales/en.json locales/de.json

Two separate jobs:

The dash rule. No dash, en dash or em dash as clause-separating punctuation.
Hyphens inside compound words are fine ("E-Mail", "opt-out"), so this looks for
a hyphen with whitespace around it, and for en/em dashes anywhere.

Parity. Matching key counts prove nothing on their own. Both locale files once
sat at 562 keys with nothing missing while a German string had quietly dropped
a {{symbol}} the English spent, and i18next ignores an unused interpolation
value in silence. So this compares placeholder tokens as well as key names.
"""

import argparse
import json
import re
import sys

CLAUSE_DASH = re.compile(r"[–—]|(?<=\s)-(?=\s)|\s-\s")
PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")
# markdown structure that legitimately uses dashes
MD_SKIP = re.compile(r"^\s*(\|.*\||[-*+]\s|#{1,6}\s|```|---\s*$|\s*-{3,})")


def flatten(node, prefix=""):
    """Descends dicts AND lists.

    An earlier version only walked dicts, so a list-shaped file (the legal
    copy is arrays of [title, body] pairs) flattened to a handful of entries
    and the checker cheerfully reported "Clean" having looked at almost
    nothing. A checker that silently checks 3 of 38 strings is worse than no
    checker, because it is believed.
    """
    out = {}
    if isinstance(node, dict):
        items = node.items()
    elif isinstance(node, list):
        items = ((str(i), v) for i, v in enumerate(node))
    else:
        return {prefix: node}
    for k, v in items:
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, (dict, list)):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def check_json(path):
    with open(path, encoding="utf-8") as f:
        data = flatten(json.load(f))
    hits = [(k, v) for k, v in data.items()
            if isinstance(v, str) and CLAUSE_DASH.search(v)]
    print(f"\n{path}: {len(data)} strings, {len(hits)} violation(s)")
    for k, v in hits:
        print(f"  {k}")
        print(f"    {v}")
    return len(hits)


def check_markdown(path):
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    hits = []
    in_fence = False
    for n, line in enumerate(lines, 1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or MD_SKIP.match(line):
            continue
        if CLAUSE_DASH.search(line):
            hits.append((n, line.strip()))
    print(f"\n{path}: {len(hits)} violation(s) in prose")
    for n, line in hits:
        print(f"  line {n}: {line[:100]}")
    if hits:
        print("\n  Note: list bullets, table rows and code blocks are skipped.")
        print("  Only prose is checked, since that is what a reader reads.")
    return len(hits)


def check_parity(a_path, b_path):
    with open(a_path, encoding="utf-8") as f:
        a = flatten(json.load(f))
    with open(b_path, encoding="utf-8") as f:
        b = flatten(json.load(f))

    only_a = sorted(set(a) - set(b))
    only_b = sorted(set(b) - set(a))
    shared = set(a) & set(b)

    mismatched = []
    for k in sorted(shared):
        ta = set(PLACEHOLDER.findall(a[k])) if isinstance(a[k], str) else set()
        tb = set(PLACEHOLDER.findall(b[k])) if isinstance(b[k], str) else set()
        if ta != tb:
            mismatched.append((k, sorted(ta), sorted(tb)))

    empty = [k for k, v in list(a.items()) + list(b.items())
             if isinstance(v, str) and not v.strip()]

    print(f"\n{a_path}: {len(a)} keys")
    print(f"{b_path}: {len(b)} keys")
    print(f"\nmissing from {b_path}: {len(only_a)}")
    for k in only_a[:20]:
        print(f"  {k}")
    print(f"missing from {a_path}: {len(only_b)}")
    for k in only_b[:20]:
        print(f"  {k}")

    print(f"\nplaceholder mismatches: {len(mismatched)}")
    for k, ta, tb in mismatched:
        print(f"  {k}")
        print(f"    {a_path}: {ta}")
        print(f"    {b_path}: {tb}")
    if mismatched:
        print("\n  A dropped placeholder does not crash and does not warn. It")
        print("  just means one language silently says less than the other.")

    print(f"\nempty strings: {len(empty)}")
    for k in empty[:10]:
        print(f"  {k}")

    return len(only_a) + len(only_b) + len(mismatched) + len(empty)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--parity", action="store_true",
                    help="compare two locale files by key AND placeholder")
    a = ap.parse_args()

    if a.parity:
        if len(a.paths) != 2:
            print("--parity needs exactly two files", file=sys.stderr)
            return 2
        problems = check_parity(*a.paths)
    else:
        problems = 0
        for p in a.paths:
            if p.endswith(".json"):
                problems += check_json(p)
            else:
                problems += check_markdown(p)

    print()
    if problems == 0:
        print("Clean.")
    else:
        print(f"{problems} thing(s) to fix.")
        print("For the dash rule use a colon, comma or period. When fixing")
        print("English, look at what the German does first: it was written to")
        print("this rule. One trap, German tolerates a comma splice where")
        print("English needs a period, so a comma is not always the right port.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
