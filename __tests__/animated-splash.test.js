/**
 * THE LAUNCH MOTION STAYS IN STEP WITH THE PICTURE IT IS CUT FROM.
 *
 * components/AnimatedSplash.tsx moves the pieces of the launch picture that
 * tools/make-splash.py cuts into assets/splash-layers/. Three things tie them
 * together and none of them would fail loudly on a phone:
 *  - a layer missing from the component simply never appears;
 *  - a layer painted in a different order from the generator's draws, say,
 *    a wave over the mark, which the flat picture never did;
 *  - motion longer than the hold would make every launch slower, which the
 *    motion was promised not to do.
 * This reads the source rather than rendering it, so it runs anywhere.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const layout = JSON.parse(read("assets/splash-layers/layout.json"));
const component = read("components/AnimatedSplash.tsx");
const generator = read("tools/make-splash.py");

const block = (src, start, end = "\n}") => {
  const from = src.indexOf(start);
  const to = src.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`cannot find ${start} ... ${end}`);
  return src.slice(from, to);
};
const keysOf = (body) => [...body.matchAll(/^\s+(\w+):\s/gm)].map((m) => m[1]);
const generatorOrder = [...block(generator, "PARTS = [", "\n]").matchAll(/\("(\w+)",/g)].map((m) => m[1]);
const timelineOrder = keysOf(block(component, "const TIMELINE"));
const sources = [...component.matchAll(/(\w+): require\("\.\.\/assets\/splash-layers\/(\w+)\.png"\)/g)];
const num = (name) => Number(component.match(new RegExp(`const ${name} = (\\d+)`))[1]);

describe("AnimatedSplash and the generated layers", () => {
  test("every generated layer has a file, a source and a step, and nothing else does", () => {
    const names = Object.keys(layout.layers);
    expect(names.length).toBeGreaterThan(5);
    expect(generatorOrder).toEqual(names);
    for (const n of names) {
      expect(fs.existsSync(path.join(root, `assets/splash-layers/${n}.png`))).toBe(true);
    }
    expect(sources.map((m) => m[1]).sort()).toEqual([...names].sort());
    for (const m of sources) expect(m[1]).toBe(m[2]);
    expect([...timelineOrder].sort()).toEqual([...names].sort());
  });

  test("the component paints in the generator's order", () => {
    expect(timelineOrder).toEqual(generatorOrder);
  });

  test("the motion ends inside the hold, so a launch takes no longer", () => {
    const motion = num("MOTION_MS");
    expect(motion).toBeLessThan(num("MIN_DISPLAY_MS"));
    const steps = [...block(component, "const TIMELINE").matchAll(/start: (\d+), dur: (\d+)/g)];
    expect(steps.length).toBe(timelineOrder.length);
    for (const [, start, dur] of steps) expect(Number(start) + Number(dur)).toBeLessThanOrEqual(motion);
  });

  test("the ground matches the OS splash of the build this commit produces, and builds 40 and 41 keep cream", () => {
    // Builds before 42 take the same updates (runtimeVersion 1.0.1) and their
    // OS splash is cream; the hand over flashes if this screen disagrees.
    const m = component.match(/const SPLASH_BACKGROUND_COLOR = \(nativeBuild\(\)\.versionCode \?\? 0\) >= (\d+) \? "(#[0-9A-F]{6})" : "(#[0-9A-F]{6})";/);
    expect(m).not.toBeNull();
    const [, from, newer, older] = m;
    const app = JSON.parse(read("app.json")).expo;
    const drawn = app.android.versionCode >= Number(from) ? newer : older;
    expect(drawn).toBe(app.splash.backgroundColor);
    expect(older).toBe("#F7F6F1");
    expect(Number(from)).toBeGreaterThan(41);
  });

  test("a layer is stretched to its box and cut with a margin, so a phone's pixel rounding cannot crop ink", () => {
    // 2026-11-26, the owner's phone: "<NOW BEFORE YOU PAY", no K stem and no
    // full stop. The tagline strip was cut tight to its ink and drawn with
    // the default resizeMode, cover, so one rounded pixel of height enlarged
    // it and cut both ends off. Either half of this fix alone would hold.
    const image = component.slice(component.indexOf("<Animated.Image"), component.indexOf("/>", component.indexOf("<Animated.Image")));
    expect(image).toMatch(/resizeMode="stretch"/);
    expect(layout.pad).toBeGreaterThanOrEqual(4);
  });

  test("the centred layers are square on the ring centre, so they turn about the mark", () => {
    const [cx, cy] = layout.centre;
    for (const n of ["ring_outer", "ring_mid", "ring_inner", "arcs", "mark"]) {
      const [x0, y0, x1, y1] = layout.layers[n];
      expect(Math.abs((x0 + x1) / 2 - cx)).toBeLessThanOrEqual(1);
      expect(Math.abs((y0 + y1) / 2 - cy)).toBeLessThanOrEqual(1);
    }
  });
});
