#!/usr/bin/env python3
"""Reports the state of the service catalogue's prices, and fails on rot.

    python3 tools/check-prices.py           # summary, fails on expired rows
    python3 tools/check-prices.py --list    # also name every unverified row

WHY THIS EXISTS. `isPriceFresh` gates the market price insight on `verified`
being within six months. That is the right rule, and it has a silent failure
mode: the day a row crosses the line the insight simply stops mentioning it,
with no error, no log and nothing in the UI. A feature quietly shrinking is
much harder to notice than a feature breaking, and the whole product promise is
knowing what things cost, so the catalogue going stale is the one kind of rot
that matters most here.

It also catches the structural mistakes that are easy to make by hand: two rows
sharing an id, a price of zero, a currency that does not match the region it
claims, and a `popular` row that will be shown to a DACH user with a US price
because no DACH row exists to dedupe to.
"""
import datetime as dt
import pathlib
import re
import sys

CATALOGUE = pathlib.Path(__file__).resolve().parent.parent / "lib" / "service-templates.ts"

# Must match PRICE_FRESHNESS_MONTHS in lib/service-templates.ts. A mismatch
# here would report rows as fine that the app has already gone quiet about.
FRESHNESS_MONTHS = 6
WARN_WITHIN_DAYS = 30

ROW = re.compile(
    r'\{\s*id:\s*"(?P<id>[^"]+)",\s*name:\s*"(?P<name>[^"]+)",\s*'
    r'defaultPrice:\s*(?P<price>[\d.]+),\s*currency:\s*"(?P<cur>\w+)",\s*'
    r'billingCycle:\s*"(?P<cycle>\w+)",\s*category:\s*"(?P<cat>\w+)",\s*'
    r'region:\s*"(?P<region>\w+)"(?P<rest>[^}]*)\}'
)

DACH_REGIONS = {"DACH", "DE", "AT", "CH"}
REGION_CURRENCY = {"DACH": {"EUR"}, "DE": {"EUR"}, "AT": {"EUR"}, "CH": {"CHF"},
                   "US": {"USD"}}


def load():
    src = CATALOGUE.read_text("utf-8")
    rows = []
    for m in ROW.finditer(src):
        d = m.groupdict()
        ver = re.search(r'verified:\s*"([\d-]+)"', d["rest"])
        rows.append({
            "id": d["id"], "name": d["name"], "price": float(d["price"]),
            "cur": d["cur"], "cycle": d["cycle"], "region": d["region"],
            "popular": "popular: true" in d["rest"],
            "verified": ver.group(1) if ver else None,
        })
    if not rows:
        raise SystemExit(f"  parsed 0 rows from {CATALOGUE}. The row shape "
                         f"probably changed and this regex did not.")
    return rows


def cutoff(today):
    y, m = today.year, today.month - FRESHNESS_MONTHS
    while m <= 0:
        m += 12
        y -= 1
    day = min(today.day, [31, 29 if y % 4 == 0 and (y % 100 or y % 400 == 0) else 28,
                          31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return dt.date(y, m, day)


def structural(rows):
    """Mistakes that need no date to be wrong."""
    problems = []
    seen = {}
    for r in rows:
        if r["id"] in seen:
            problems.append(f'duplicate id "{r["id"]}" ({r["name"]} and {seen[r["id"]]})')
        seen[r["id"]] = r["name"]
        if r["price"] <= 0:
            problems.append(f'{r["name"]} ({r["id"]}) has a price of {r["price"]}')
        want = REGION_CURRENCY.get(r["region"])
        if want and r["cur"] not in want:
            problems.append(f'{r["name"]} is region {r["region"]} but priced in '
                            f'{r["cur"]}, expected {" or ".join(sorted(want))}')
    # A popular row with no DACH sibling gets shown to a German user at its US
    # price, because dedupeForRegion can only pick from what exists.
    by_name = {}
    for r in rows:
        by_name.setdefault(r["name"].lower(), []).append(r)
    for name, group in by_name.items():
        if any(r["popular"] for r in group) and not any(
                r["region"] in DACH_REGIONS for r in group):
            problems.append(f'{group[0]["name"]} is popular but has no DACH row, '
                            f'so a euro user sees its {group[0]["cur"]} price')
    return problems


def self_test():
    """Feeds the structural checks things that are wrong, and fails if they pass.

    A checker nobody has watched fire is a checker nobody knows works. This
    codebase already shipped a typecheck guard that was broken on the only
    machine it could run on, for its whole life, unnoticed."""
    cases = [
        ("duplicate id", [
            {"id": "x", "name": "A", "price": 1, "cur": "EUR", "region": "DACH", "popular": False},
            {"id": "x", "name": "B", "price": 1, "cur": "EUR", "region": "DACH", "popular": False}]),
        ("zero price", [
            {"id": "a", "name": "A", "price": 0, "cur": "EUR", "region": "DACH", "popular": False}]),
        ("currency does not match region", [
            {"id": "a", "name": "A", "price": 5, "cur": "USD", "region": "DACH", "popular": False}]),
        ("popular row with no DACH sibling", [
            {"id": "a", "name": "A", "price": 5, "cur": "USD", "region": "GLOBAL", "popular": True}]),
    ]
    good = [
        {"id": "a", "name": "A", "price": 5, "cur": "USD", "region": "GLOBAL", "popular": True},
        {"id": "b", "name": "A", "price": 4, "cur": "EUR", "region": "DACH", "popular": True},
    ]
    bad = 0
    print("\n  structural checks, must catch")
    for label, rows in cases:
        caught = bool(structural(rows))
        print(f"    {'ok  ' if caught else 'FAIL'}  {label}")
        bad += 0 if caught else 1
    print("\n  must not false-positive")
    clean = not structural(good)
    print(f"    {'ok  ' if clean else 'FAIL'}  a popular pair with both a GLOBAL and a DACH row")
    bad += 0 if clean else 1
    print()
    print("  all correct.\n" if not bad else f"  {bad} wrong.\n")
    return 1 if bad else 0


def main():
    if "--self-test" in sys.argv:
        return self_test()
    rows = load()
    today = dt.date.today()
    cut = cutoff(today)
    warn_from = cut + dt.timedelta(days=WARN_WITHIN_DAYS)

    verified = [r for r in rows if r["verified"]]
    unverified = [r for r in rows if not r["verified"]]
    expired, expiring, fresh, unparseable = [], [], [], []
    for r in verified:
        try:
            d = dt.date.fromisoformat(r["verified"])
        except ValueError:
            unparseable.append(r)
            continue
        (expired if d < cut else expiring if d < warn_from else fresh).append((r, d))

    print()
    print(f"  {len(rows)} rows, {len(set(r['name'] for r in rows))} unique names")
    print(f"  {len(verified)} verified, {len(unverified)} never checked")
    print(f"  freshness window is {FRESHNESS_MONTHS} months, so anything checked "
          f"before {cut} has gone quiet")
    print()

    if fresh:
        print(f"  fresh ({len(fresh)})")
        for r, d in sorted(fresh, key=lambda x: x[1]):
            print(f"    {r['name'][:30]:30} {r['price']:>8.2f} {r['cur']} "
                  f"{r['region']:6} {d}")
        print()

    if expiring:
        print(f"  EXPIRING within {WARN_WITHIN_DAYS} days ({len(expiring)}), "
              f"recheck these before the app stops mentioning them")
        for r, d in sorted(expiring, key=lambda x: x[1]):
            print(f"    {r['name'][:30]:30} {r['price']:>8.2f} {r['cur']} "
                  f"{r['region']:6} {d}")
        print()

    if expired:
        print(f"  EXPIRED ({len(expired)}), isPriceFresh is already silent about these")
        for r, d in sorted(expired, key=lambda x: x[1]):
            print(f"    {r['name'][:30]:30} {r['price']:>8.2f} {r['cur']} "
                  f"{r['region']:6} {d}")
        print()

    if unparseable:
        print(f"  UNREADABLE DATE ({len(unparseable)}), treated as never checked "
              f"by isPriceFresh")
        for r in unparseable:
            print(f"    {r['name'][:30]:30} verified: {r['verified']!r}")
        print()

    problems = structural(rows)
    if problems:
        print(f"  STRUCTURAL ({len(problems)})")
        for p in problems:
            print(f"    {p}")
        print()

    if "--list" in sys.argv and unverified:
        print(f"  never checked ({len(unverified)})")
        for r in sorted(unverified, key=lambda r: (r["region"], r["name"])):
            print(f"    {r['name'][:30]:30} {r['price']:>8.2f} {r['cur']} {r['region']}")
        print()

    bad = expired or unparseable or problems
    if bad:
        print("  Not clean. An expired row is not a broken feature, it is a quiet "
              "one:\n  the insight simply stops naming that service.\n")
        return 1
    if expiring:
        print(f"  No expired rows, but {len(expiring)} expire within "
              f"{WARN_WITHIN_DAYS} days.\n")
    else:
        print("  Every verified row is fresh.\n")
    print(f"  {len(unverified)} rows have never been checked, which is not a "
          f"failure:\n  isPriceFresh keeps the app quiet about them by design. "
          f"Run with --list to see them.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
