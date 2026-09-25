#!/usr/bin/env python3
"""Where the Montserrat faces come from, resolved in one place.

WHY THIS EXISTS. Four generators (make-cut, make-og, make-splash and
make-youtube) each hardcoded
`/usr/share/fonts/opentype/montserrat/Montserrat-%s.otf`. That is a fact about
one machine rather than a fact about this repository, so in a fresh cloud
session `brand-video.py` could not render an end card at all: PIL raised
`OSError: cannot open resource`, which names neither the file it wanted nor
the directory it looked in. A tool that exists to enforce the brand rules, and
that cannot run where those rules are needed, is the typecheck.py lesson
happening a second time.

THE REPOSITORY ALREADY CARRIES THE FACES, at `assets/fonts/Montserrat-*.ttf`,
because the app ships them. Same family, so they are the fallback, and a
machine with the system install keeps using it byte for byte as before.
FreeType reads a TrueType file whatever the extension claims, so the .otf and
.ttf copies are interchangeable for our purposes.

A MISS REFUSES BY NAME rather than letting PIL raise its unnamed error, since
the whole cost of the original bug was not knowing where to look.
"""
import pathlib

WEIGHTS = ("Regular", "Medium", "SemiBold", "Bold", "ExtraBold")

SYSTEM = pathlib.Path("/usr/share/fonts/opentype/montserrat")
BUNDLED = pathlib.Path(__file__).resolve().parent.parent / "assets" / "fonts"


def montserrat(weight):
    """The path to one weight, system install first, then the repo's own copy."""
    if weight not in WEIGHTS:
        raise ValueError(f"unknown Montserrat weight {weight!r}, "
                         f"expected one of {', '.join(WEIGHTS)}")
    for p in (SYSTEM / f"Montserrat-{weight}.otf",
              BUNDLED / f"Montserrat-{weight}.ttf"):
        if p.exists():
            return str(p)
    raise FileNotFoundError(
        f"Montserrat-{weight} not found. Looked for "
        f"{SYSTEM / f'Montserrat-{weight}.otf'} and "
        f"{BUNDLED / f'Montserrat-{weight}.ttf'}. The second ships with the "
        f"app, so a miss there means the checkout is incomplete rather than "
        f"the machine unconfigured.")
