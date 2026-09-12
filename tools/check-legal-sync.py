"""Fails if the app's legal screens and the served pages have drifted.

Both documents exist twice, once in the app and once in backend/server.js,
because one is React Native and the other is Express. Nothing enforces
that they agree, and a policy that says two different things is worse
than either version alone. This is the enforcement.

Run it before a build, or wire it into CI.
"""
import json, re, sys, pathlib


def _unquote(lit):
    """These files mix single and double quoted JS strings, so normalise
       to a double quoted JSON literal before parsing. A parser that only
       understood double quotes silently matched nothing and passed."""
    q, body = lit[0], lit[1:-1]
    if q == "'":
        body = body.replace('\\"', '"').replace("\\'", "'").replace('"', '\\"')
    return json.loads('"' + body + '"')


def js_array(text, name):
    i = text.index(f"const {name} = [")
    j = text.index("\n];", i)
    chunk = text[i:j]
    pat = r"""\{\s*title:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,\s*body:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\}"""
    out = [(_unquote(m.group(1)), _unquote(m.group(2))) for m in re.finditer(pat, chunk)]
    if not out:
        raise SystemExit(f"FAIL: parsed 0 sections from {name}, the parser is broken")
    return out


def read(path):
    return pathlib.Path(path).read_text(encoding="utf-8")


server = read("backend/server.js")
checks = [
    ("Terms of Service", js_array(read("app/terms-of-service.tsx"), "SECTIONS"),
     js_array(server, "TERMS_SECTIONS")),
]

# The privacy screen stores its sections differently, so compare its prose
# against the served copy rather than its structure.
privacy_app = read("app/privacy-policy.tsx")
privacy_server = js_array(server, "PRIVACY_POLICY_SECTIONS")

failed = False
for name, a, b in checks:
    if not a or not b:
        print(f"FAIL {name}: could not parse one of the copies ({len(a)} vs {len(b)})")
        failed = True
        continue
    if a != b:
        print(f"FAIL {name}: the two copies differ")
        for (ta, ba), (tb, bb) in zip(a, b):
            if ta != tb or ba != bb:
                print(f"  app:    {ta} / {ba[:70]}")
                print(f"  server: {tb} / {bb[:70]}")
        if len(a) != len(b):
            print(f"  section counts differ: app {len(a)}, server {len(b)}")
        failed = True
    else:
        print(f"OK   {name}: {len(a)} sections identical in both copies")

missing = [t for t, body in privacy_server if body[:60] not in privacy_app]
if missing:
    print(f"FAIL Privacy Policy: {len(missing)} served sections not found in the app screen")
    for t in missing[:5]:
        print("  ", t)
    failed = True
else:
    print(f"OK   Privacy Policy: all {len(privacy_server)} served sections present in the app screen")

# The German copies, served at /de/datenschutz and /de/nutzungsbedingungen.
# They live in backend/legal-de.json rather than as more JS arrays, so this
# reads them directly. Prose cannot be diffed across languages, but structure
# can: if someone adds an English section and forgets the German one, the
# German document quietly says less than the English one about the same
# service, which is exactly the drift this file exists to catch.
de = json.loads(read("backend/legal-de.json"))
for label, de_key, en_pairs in (
        ("Terms of Service", "terms", js_array(server, "TERMS_SECTIONS")),
        ("Privacy Policy", "privacy", privacy_server)):
    de_pairs = [(t, b) for t, b in de[de_key]]
    if len(de_pairs) != len(en_pairs):
        print(f"FAIL {label} (de): {len(de_pairs)} sections, English has {len(en_pairs)}")
        failed = True
        continue
    # numbering has to line up, so section 9 means the same thing in both
    bad = [(a, b) for (a, _), (b, _) in zip(en_pairs, de_pairs)
           if a.split(".")[0] != b.split(".")[0]]
    if bad:
        print(f"FAIL {label} (de): section numbering diverges")
        for a, b in bad[:5]:
            print(f"  en: {a}\n  de: {b}")
        failed = True
    else:
        print(f"OK   {label} (de): {len(de_pairs)} sections, numbering matches English")
    empty = [t for t, b in de_pairs if not b.strip()]
    if empty:
        print(f"FAIL {label} (de): {len(empty)} empty section(s): {empty[:3]}")
        failed = True

# the house rule, on user facing legal copy, in both languages
for label, pairs in (("terms", js_array(server, "TERMS_SECTIONS")),
                     ("privacy", privacy_server),
                     ("terms (de)", [(t, b) for t, b in de["terms"]]),
                     ("privacy (de)", [(t, b) for t, b in de["privacy"]])):
    dashed = [t for t, b in pairs if re.search(r"[—–]", t + b)]
    if dashed:
        print(f"FAIL {label}: dash used in {len(dashed)} sections: {dashed[:3]}")
        failed = True
    else:
        print(f"OK   {label}: no em or en dashes")

sys.exit(1 if failed else 0)
