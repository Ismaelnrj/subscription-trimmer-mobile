"""Writes backend/mark.svg, the logo as vector.

The handoff page embedded the same 1.5MB PNG of this mark five times,
which is 7.6MB of page weight for one small logo. One cached SVG is
about a kilobyte and stays sharp at any size.
"""
import json, pathlib

m = json.loads(pathlib.Path("tools/mark.json").read_text())
W, H = m["meta"]["width"], m["meta"]["height"]
SCALE = 0.60                      # mark height as a fraction of the tile
ox, oy = 50 - W * SCALE / 2, 50 - H * SCALE / 2


def path(points):
    return "M" + " ".join(f"{ox + x * SCALE:.2f} {oy + y * SCALE:.2f}" for x, y in points) + "Z"


svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" '
    'aria-label="Trimio">'
    '<rect width="100" height="100" rx="24" fill="#142B3A"/>'
    f'<path fill="#F7F6F1" d="{path(m["chevron"])}"/>'
    f'<path fill="#55C6A3" d="{path(m["triangle"])}"/>'
    '</svg>'
)
pathlib.Path("backend/mark.svg").write_text(svg)
print("wrote backend/mark.svg", len(svg), "bytes")
