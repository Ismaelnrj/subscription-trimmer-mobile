/**
 * THE SIGN IN FLOW'S ART IS DRAWN AT THE SHAPE THE CODE ASSUMES, AND THE
 * STAGE'S EDGE MEETS THE STATUS BAR.
 *
 * tools/make-app-marks.py draws the stage and the waves; AuthHeader.tsx sizes
 * them from two aspect constants with resizeMode "stretch". Redraw a file at a
 * new shape without the constant and every phone stretches it: the rings turn
 * to ovals. The art changed shape three times on 2026-11-26 alone.
 *
 * The root layout paints the status bar STAGE.top on sign in and sign up, and
 * the stage art starts at that same colour, so there is no seam between them.
 * Both are written down twice (the generator, lib/theme.ts); this keeps them
 * one colour.
 *
 * Also pinned: nothing in the flow promises privacy. "Your data stays private"
 * was in the owner's mock and is not something a server that holds the list
 * can say.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pngSize = (p) => {
  const b = fs.readFileSync(path.join(root, p));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const header = read("components/AuthHeader.tsx");
const ratio = (name) => {
  const m = header.match(new RegExp(`const ${name} = (\\d+) / (\\d+);`));
  if (!m) throw new Error(`no ${name}`);
  return Number(m[1]) / Number(m[2]);
};
const hex = (rgb) => "#" + rgb.map((n) => n.toString(16).padStart(2, "0").toUpperCase()).join("");

describe("sign in art", () => {
  test("the stage art matches STAGE_ASPECT (height / width)", () => {
    const [w, h] = pngSize("assets/brand/stage.png");
    expect(h / w).toBeCloseTo(ratio("STAGE_ASPECT"), 3);
  });

  test.each(["light", "dark"])("the %s waves match WAVES_ASPECT (width / height)", (theme) => {
    const [w, h] = pngSize(`assets/brand/waves-on-${theme}.png`);
    expect(w / h).toBeCloseTo(ratio("WAVES_ASPECT"), 3);
  });

  test("the generator draws the stage between the two colours the theme names", () => {
    const gen = read("tools/make-app-marks.py");
    const theme = read("lib/theme.ts");
    const stage = theme.slice(theme.indexOf("export const STAGE"));
    for (const end of ["TOP", "BOTTOM"]) {
      const m = gen.match(new RegExp(`STAGE_${end} = \\((\\d+), (\\d+), (\\d+)\\)`));
      expect(m).not.toBeNull();
      expect(stage).toContain(`${end.toLowerCase()}: "${hex(m.slice(1).map(Number))}"`);
    }
  });

  test("the status bar takes the stage's top on exactly the screens that show it", () => {
    const layout = read("app/_layout.tsx");
    // Since 2026-11-28 every screen but onboarding and forgot password opens on
    // the stage: the tabs and inner screens through ScreenStage, every inner
    // screen's title bar through StageHeader.
    expect(layout).toMatch(/const onStage = !\["onboarding", "forgot-password"\]\.includes/);
    expect(layout).toMatch(/onStage \? STAGE\.top/);
    expect(layout).toMatch(/header: \(props\) => <StageHeader \{\.\.\.props\} \/>/);
    // A screen that hides the bar must bring its own stage.
    const own = [...layout.matchAll(/<Stack\.Screen name="([^"]+)"( options=\{\{([^}]*)\}\})? \/>/g)]
      .filter(([, , , opts]) => !/headerShown: true/.test(opts || ""))
      .map(([, name]) => name)
      .filter((n) => !["onboarding", "forgot-password", "login", "register", "(tabs)", "+not-found"].includes(n));
    expect(own).toEqual(["subscription-details"]);
    for (const f of own) expect(read(`app/${f}.tsx`)).toMatch(/<ScreenStage\b/);
    for (const f of ["app/login.tsx", "app/register.tsx"]) expect(read(f)).toMatch(/<AuthStage/);
    // Every tab opens on the stage, since the bar is navy on all of them: a tab
    // without it would show a navy strip over the light ground.
    const tabs = fs.readdirSync(path.join(root, "app", "(tabs)")).filter((f) => f.endsWith(".tsx") && f !== "_layout.tsx");
    expect(tabs.length).toBe(5);
    for (const f of tabs) expect([f, /<ScreenStage\b/.test(read(`app/(tabs)/${f}`))]).toEqual([f, true]);
  });

  test("nothing in the sign in strings promises privacy, in either language", () => {
    for (const lang of ["en", "de"]) {
      const json = JSON.parse(read(`locales/${lang}.json`));
      const text = JSON.stringify([json.auth, json.login, json.register]);
      expect(text).not.toMatch(/privat|never leaves|verlässt nie|your data stays/i);
    }
  });
});
