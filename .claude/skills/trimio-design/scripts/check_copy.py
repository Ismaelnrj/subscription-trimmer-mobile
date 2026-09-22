#!/usr/bin/env python3
"""Enforce Trimio's copy rules on anything a user reads.

    check_copy.py locales/en.json locales/de.json     dash rule
    check_copy.py store-listing-de.md                 dash rule, markdown
    check_copy.py --parity locales/en.json locales/de.json
    check_copy.py --keywords de "Abos und Kosten im Blick. ..."
    check_copy.py --keywords en "..." --against "the line it replaces"

Three separate jobs:

The dash rule. No dash, en dash or em dash as clause-separating punctuation.
Hyphens inside compound words are fine ("E-Mail", "opt-out"), so this looks for
a hyphen with whitespace around it, and for en/em dashes anywhere.

Keywords. A Play short description does TWO jobs at once, discovery and
conversion, and copy written for the second silently pays for the first. On
2026-09-22 a proposed German line carried zero of Abo, Abos, Abonnement,
Tracker, Kosten and Testphase: 78 characters of the second most weighted
indexed field spent on no head term at all. It read well, which is exactly why
nobody caught it by reading. The English draft dropped "subscription", the head
term of the category. This is the same class as the "ueber 160 Vorlagen"
overclaim: a number or a term that reaches marketing copy has to be COUNTED.

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


# TWO TIERS, and the split is the whole point. The first draft of this checker
# had one list containing both, so it cheerfully passed the very line it was
# written to catch: "kuendig", "anleitung" and "verlaengerung" satisfied a floor
# that exists to find a missing CATEGORY word. Its own negative test caught it.
#
# CATEGORY is what somebody types into Play when they do not know this app
# exists. Zero of these is a failure at any length.
# SUPPORTING is what makes this app the answer rather than a competitor. Good
# to have, reported, and NEVER a substitute for a category term.
CATEGORY_TERMS = {
    "en": ["subscription", "tracker", "track", "budget", "trial"],
    "de": ["abo", "abonnement", "tracker", "kosten", "testphase", "budget"],
}
SUPPORTING_TERMS = {
    "en": ["cancel", "renewal", "renew", "guide", "reminder"],
    "de": ["kuendig", "kündig", "anleitung", "verlängerung", "bankzugang",
           "erinnerung"],
}

# Play's own limit for the short description.
SHORT_DESC_LIMIT = 80


def find_terms(text, lang, table):
    """Returns [(term, surface form as it appears)], word-start matches.

    The surface form is reported rather than swallowed on purpose: German
    "kostenlos" contains "kosten" and Play would NOT rank it for that query,
    so a reader has to be able to see WHAT matched and overrule the count.
    Same philosophy as check_screens.py: a report, not a verdict.
    """
    found = []
    low = text.lower()
    for term in table.get(lang, []):
        for m in re.finditer(r"\b" + re.escape(term) + r"\w*", low):
            found.append((term, text[m.start():m.end()]))
            break
    return found


def check_keywords(lang, text, against=None):
    if lang not in CATEGORY_TERMS:
        print(f"unknown language {lang!r}, expected one of "
              f"{sorted(CATEGORY_TERMS)}", file=sys.stderr)
        return 1

    n = len(text)
    cat = find_terms(text, lang, CATEGORY_TERMS)
    sup = find_terms(text, lang, SUPPORTING_TERMS)
    problems = 0

    print(f"\n{lang}: {n}/{SHORT_DESC_LIMIT} characters")
    print(f"  {text}")

    if n > SHORT_DESC_LIMIT:
        print(f"\n  OVER THE LIMIT by {n - SHORT_DESC_LIMIT}. Play truncates or "
              f"refuses; either way the tail is not doing any work.")
        problems += 1

    if CLAUSE_DASH.search(text):
        print("\n  DASH used as clause punctuation. Colon, comma or period.")
        problems += 1

    def show(label, hits):
        print(f"\n  {label}: {len(hits)}")
        for term, surface in hits:
            note = ("" if term == surface.lower()
                    else f"   (matched inside {surface!r})")
            print(f"    {term}{note}")

    show("category terms", cat)
    show("supporting terms", sup)

    if not cat:
        print("\n  ZERO CATEGORY TERMS. This is the field Play weights second")
        print("  after the title. A line with no category word ranks for")
        print("  nothing, however well it reads, and supporting terms do not")
        print("  substitute: somebody searching for this app does not yet know")
        print("  what makes it different. Put the category word back.")
        problems += 1

    if against is not None:
        pc = find_terms(against, lang, CATEGORY_TERMS)
        ps = find_terms(against, lang, SUPPORTING_TERMS)
        print(f"\n  the line it replaces carried "
              f"{len(pc)} category {[t for t, _ in pc]} and "
              f"{len(ps)} supporting {[t for t, _ in ps]}")
        lost_c = sorted({t for t, _ in pc} - {t for t, _ in cat})
        lost_s = sorted({t for t, _ in ps} - {t for t, _ in sup})
        if lost_c:
            print(f"  LOSES CATEGORY: {lost_c}")
            print("  Weigh this one properly. A category term is discovery and")
            print("  a supporting term is persuasion, and the short description")
            print("  is the only field doing both.")
        if lost_s:
            print(f"  loses supporting: {lost_s}")

    return problems


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
    ap.add_argument("--keywords", action="store_true",
                    help="head term coverage of a store short description: "
                         "pass a language (en|de) then the text")
    ap.add_argument("--against", metavar="TEXT",
                    help="--keywords only: the line this one replaces, to "
                         "report which terms the change gives up")
    a = ap.parse_args()

    if a.keywords:
        if len(a.paths) != 2:
            print("--keywords needs a language and the text, e.g.\n"
                  '  check_copy.py --keywords de "Abos und Kosten im Blick..."',
                  file=sys.stderr)
            return 2
        problems = check_keywords(a.paths[0], a.paths[1], a.against)
    elif a.parity:
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
        if a.keywords:
            return 1
        print("For the dash rule use a colon, comma or period. When fixing")
        print("English, look at what the German does first: it was written to")
        print("this rule. One trap, German tolerates a comma splice where")
        print("English needs a period, so a comma is not always the right port.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
