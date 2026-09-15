#!/usr/bin/env python3
"""Checks that make-cut.py actually refuses the things it claims to refuse.

    python3 tools/test-make-cut.py

This exists because of `tools/typecheck.py`, which was written to stop a silent
pass shipping a crash, was verified in a sandbox where it correctly refuses to
run, and was broken on the only machine where it could work for its entire
life. Nobody found out for a week. A guard that is never seen to fire is
indistinguishable from no guard at all, so each rule here is given something
that breaks it and the run fails if the renderer accepts it.

Every case below is a defect that has actually shipped, or that the notes in
this repo record as having shipped once already.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CUT = ROOT / "tools" / "make-cut.py"

MUST_REFUSE = [
    ("dash as clause punctuation",
     {"type": "card", "dur": 3, "lines": ["Sieben Abos - vier im Kopf."]}),
    ("Apple or the App Store named",
     {"type": "card", "dur": 3, "lines": ["Jetzt im App Store."]}),
    ("decimal point in German copy",
     {"type": "card", "dur": 3, "lines": ["Netflix kostet 15.99 Euro."]}),
    ("line held too short to read twice",
     {"type": "card", "dur": 0.8, "lines": ["Die anderen drei laufen weiter."]}),
    ("type outside the caption band",
     {"type": "card", "dur": 20, "size": 150,
      "lines": ["Dieser viel zu lange Satz passt niemals in das Band und soll "
                "deshalb abgelehnt werden, weil die Plattform genau dort ihre "
                "eigene Oberflaeche zeichnet."]}),
    ("missing footage",
     {"type": "footage", "dur": 3, "src": "does/not/exist.mp4",
      "caption": "Bestätigungsmail einfügen."}),
]

MUST_ACCEPT = [
    ("a normal German card",
     {"type": "card", "dur": 3, "emphasis": True,
      "lines": ["Du zahlst für sieben Abos."]}),
    ("German prices with a decimal comma",
     {"type": "card", "dur": 3, "lines": ["Netflix Standard: 15,99 €."]}),
    ("a compound hyphen, which is spelling and not clause punctuation",
     {"type": "card", "dur": 3, "lines": ["Die Abo-Erinnerung kommt vorher."]}),
    ("the end card",
     {"type": "endcard", "dur": 2.5, "cta": "Kostenlos bei Google Play"}),
]


def attempt(scene, tmp):
    spec = {"name": "t", "format": "9:16", "lang": "de",
            "out": f"{tmp}/t.mp4", "workdir": f"{tmp}/w", "scenes": [scene]}
    p = pathlib.Path(tmp) / "t.json"
    p.write_text(json.dumps(spec), encoding="utf-8")
    r = subprocess.run([sys.executable, str(CUT), str(p)],
                       capture_output=True, text=True, cwd=ROOT)
    reason = r.stderr.replace("REFUSED:", "").strip().split("\n")[0]
    return r.returncode != 0, reason


def main():
    bad = 0
    with tempfile.TemporaryDirectory() as tmp:
        print("\n  must refuse")
        for name, scene in MUST_REFUSE:
            refused, why = attempt(scene, tmp)
            print(f"    {'ok  ' if refused else 'FAIL'}  {name}")
            if not refused:
                bad += 1
                print(f"          accepted something it should have refused")
            elif "--verbose" in sys.argv:
                print(f"          {why[:100]}")

        print("\n  must accept")
        for name, scene in MUST_ACCEPT:
            refused, why = attempt(scene, tmp)
            print(f"    {'FAIL' if refused else 'ok  '}  {name}")
            if refused:
                bad += 1
                print(f"          {why[:140]}")

    print()
    if bad:
        print(f"  {bad} case(s) wrong. The renderer's guards are not doing "
              f"what this file says they do.\n")
    else:
        print(f"  {len(MUST_REFUSE)} refusals and {len(MUST_ACCEPT)} "
              f"acceptances, all correct.\n")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
