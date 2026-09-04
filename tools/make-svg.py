"""Writes backend/mark.svg, the logo as vector for the website.

Traced from the same masks the icons use, at a fine tolerance, so the
site's mark is the artwork's shape rather than a second drawing of it.
The handoff page inlined a 1.5MB PNG of this five times; this is a couple
of kilobytes, served once and sharp at any size.
"""
from PIL import Image
import json, pathlib

D = pathlib.Path("tools")
meta = json.loads((D / "mark.json").read_text())
MW, MH = meta["mark_w"], meta["mark_h"]


def contour(mask):
    m = mask.point(lambda v: 255 if v >= 128 else 0)
    W, H = m.size
    mp = m.load()
    start = next(((x, y) for y in range(H) for x in range(W) if mp[x, y]), None)
    nbr = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    pts, cur, back = [start], start, 4
    for _ in range(500000):
        for k in range(8):
            d = (back + 1 + k) % 8
            nx, ny = cur[0] + nbr[d][0], cur[1] + nbr[d][1]
            if 0 <= nx < W and 0 <= ny < H and mp[nx, ny]:
                back = (d + 5) % 8
                cur = (nx, ny)
                pts.append(cur)
                break
        else:
            break
        if len(pts) > 3 and cur == start:
            break
    return pts


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = (dx * dx + dy * dy) ** .5 or 1
    worst = wi = 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / n
        if d > worst:
            worst, wi = d, i
    return rdp(pts[:wi + 1], eps)[:-1] + rdp(pts[wi:], eps) if worst > eps else [a, b]


def simplify(c, eps=0.7):
    if len(c) > 2 and c[0] == c[-1]:
        c = c[:-1]
    a = c[0]
    far = max(range(len(c)), key=lambda i: (c[i][0] - a[0]) ** 2 + (c[i][1] - a[1]) ** 2)
    return rdp(c[:far + 1], eps)[:-1] + rdp(c[far:] + [c[0]], eps)[:-1]


SCALE = 0.60
ox, oy = 50 - (MW / MH) * 100 * SCALE / 2, 50 - 100 * SCALE / 2


def path(pts):
    k = 100.0 / MH * SCALE
    return "M" + " ".join(f"{ox + x * k:.2f} {oy + y * k:.2f}" for x, y in pts) + "Z"


paths = {}
for name in ("chevron", "triangle"):
    pts = simplify(contour(Image.open(D / f"mark-{name}.png").convert("L")))
    paths[name] = path(pts)
    print(f"{name}: {len(pts)} points")

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" '
       'aria-label="Trimio">'
       '<rect width="100" height="100" rx="24" fill="#0B1E2A"/>'
       f'<path fill="#F7F6F1" d="{paths["chevron"]}"/>'
       f'<path fill="#3DD1A0" d="{paths["triangle"]}"/>'
       '</svg>')
pathlib.Path("backend/mark.svg").write_text(svg)
print("wrote backend/mark.svg", len(svg), "bytes")
