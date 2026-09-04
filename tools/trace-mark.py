"""Traces the Trimio mark straight out of the approved artwork.

Earlier passes re-derived the shape from measurements and drifted, so this
reads the reference PNG instead: it lifts the two silhouettes, walks their
outlines, simplifies the result, and writes both an SVG path and the
normalised polygons the icon generator draws from. The shape is then
exactly the one that was signed off, not an approximation of it.
"""
from PIL import Image, ImageFilter
import json, sys

SRC = "/root/.claude/uploads/572e8a57-90e7-50e4-9543-30207f74f2cf/f26cd04b-image.png"
WIN = (280, 180, 1080, 1080)          # inside the tile, clear of its rounded corners

im = Image.open(SRC).convert("RGB").crop(WIN)
W, H = im.size
px = im.load()


def mask(pred):
    m = Image.new("L", (W, H), 0)
    mp = m.load()
    for y in range(H):
        for x in range(W):
            if pred(px[x, y]):
                mp[x, y] = 255
    # close antialiasing speckle, then harden the edge again
    m = m.filter(ImageFilter.MedianFilter(5))
    return m.point(lambda v: 255 if v >= 128 else 0)


white = mask(lambda p: p[0] > 222 and p[1] > 222 and p[2] > 214)
mint = mask(lambda p: 40 < p[0] < 130 and 170 < p[1] < 250 and 130 < p[2] < 215)


def largest_blob(m):
    """Flood fill from every unvisited pixel, keep the biggest region."""
    mp = m.load()
    seen = bytearray(W * H)
    best = []
    for sy in range(H):
        for sx in range(W):
            if mp[sx, sy] == 0 or seen[sy * W + sx]:
                continue
            stack, comp = [(sx, sy)], []
            seen[sy * W + sx] = 1
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and mp[nx, ny]:
                        seen[ny * W + nx] = 1
                        stack.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    out = Image.new("L", (W, H), 0)
    op = out.load()
    for x, y in best:
        op[x, y] = 255
    return out


def trace(m):
    """Moore neighbourhood contour walk, clockwise."""
    mp = m.load()
    start = None
    for y in range(H):
        for x in range(W):
            if mp[x, y]:
                start = (x, y); break
        if start: break
    nbr = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    contour, cur, back = [start], start, 4
    for _ in range(400000):
        found = False
        for k in range(8):
            d = (back + 1 + k) % 8
            nx, ny = cur[0] + nbr[d][0], cur[1] + nbr[d][1]
            if 0 <= nx < W and 0 <= ny < H and mp[nx, ny]:
                back = (d + 5) % 8
                cur = (nx, ny)
                contour.append(cur)
                found = True
                break
        if not found or (len(contour) > 3 and cur == start):
            break
    return contour


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = (dx * dx + dy * dy) ** .5 or 1
    worst, wi = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / n
        if d > worst:
            worst, wi = d, i
    if worst > eps:
        return rdp(pts[:wi + 1], eps)[:-1] + rdp(pts[wi:], eps)
    return [a, b]


def simplify_loop(c, eps):
    """RDP needs open chains: a closed loop measures every point as zero
       distance from a start that equals its end. Split at the far point."""
    if len(c) > 2 and c[0] == c[-1]:
        c = c[:-1]
    a = c[0]
    far = max(range(len(c)), key=lambda i: (c[i][0] - a[0]) ** 2 + (c[i][1] - a[1]) ** 2)
    first = rdp(c[:far + 1], eps)
    second = rdp(c[far:] + [c[0]], eps)
    return first[:-1] + second[:-1]


shapes = {}
for name, m in (("chevron", white), ("triangle", mint)):
    blob = largest_blob(m)
    c = trace(blob)
    simple = simplify_loop(c, 1.6)
    if name == "triangle":
        # It is a triangle. Tracing a small shape out of soft artwork leaves
        # the edges lumpy, so keep only the three corners the trace found
        # and let the corner rounding do the rest.
        xs = [q[0] for q in simple]; ys = [q[1] for q in simple]
        x0, x1 = min(xs), max(xs)
        ay = [q[1] for q in simple if q[0] > x1 - 0.015 * (x1 - x0)]
        simple = [(x0, min(ys)), (x1, sum(ay) / len(ay)), (x0, max(ys))]
    shapes[name] = simple
    print(f"{name}: {len(c)} contour points -> {len(simple)} after simplify")

# normalise both into units where the chevron is 100 tall, chevron top-left
# of the *combined* mark at x=0
cx0 = min(p[0] for p in shapes["chevron"]); cx1 = max(p[0] for p in shapes["chevron"])
cy0 = min(p[1] for p in shapes["chevron"]); cy1 = max(p[1] for p in shapes["chevron"])
tx0 = min(p[0] for p in shapes["triangle"])
scale = 100.0 / (cy1 - cy0)
ox = min(cx0, tx0)

norm = {k: [[round((x - ox) * scale, 2), round((y - cy0) * scale, 2)] for x, y in v]
        for k, v in shapes.items()}
allx = [p[0] for v in norm.values() for p in v]
ally = [p[1] for v in norm.values() for p in v]
meta = {"width": round(max(allx), 2), "height": round(max(ally), 2)}
print("normalised mark box:", meta)

with open("tools/mark.json", "w") as f:
    json.dump({"meta": meta, **norm}, f)
print("wrote tools/mark.json")


def to_path(pts):
    return "M" + " ".join(f"{x} {y}" for x, y in pts) + "Z"


with open("tools/mark-paths.txt", "w") as f:
    f.write("chevron: " + to_path(norm["chevron"]) + "\n\n")
    f.write("triangle: " + to_path(norm["triangle"]) + "\n")
print("wrote tools/mark-paths.txt")
