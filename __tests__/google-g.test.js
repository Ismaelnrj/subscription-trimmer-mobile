/**
 * THE GOOGLE BUTTON DRAWS GOOGLE'S OWN G, AT EVERY DENSITY.
 *
 * assets/google/ holds googleg_standard_color_18.png from Google's
 * play-services-base, copied byte for byte. React Native picks a file by its
 * @scale suffix and sizes it by that scale, so a file whose pixels do not
 * match its suffix draws the G at the wrong size on that density only, which
 * nobody sees on their own phone. Google's rules forbid redrawing or
 * recolouring the mark, so the component must show the image as it is:
 * no tint, and no icon font standing in for it.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const DP = 18;

// Width and height from the PNG header (IHDR), no image library needed.
const pngSize = (file) => {
  const b = fs.readFileSync(file);
  expect(b.slice(1, 4).toString("ascii")).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe("Google sign in G", () => {
  test.each([["", 1], ["@1.5x", 1.5], ["@2x", 2], ["@3x", 3]])("google-g%s.png is %sx of 18dp", (suffix, scale) => {
    const size = pngSize(path.join(root, `assets/google/google-g${suffix}.png`));
    expect(size).toEqual([DP * scale, DP * scale]);
  });

  test("the button shows that image at 18dp, untinted, with no icon font", () => {
    const src = fs.readFileSync(path.join(root, "components/GoogleSignInButton.tsx"), "utf8");
    expect(src).toContain('require("../assets/google/google-g.png")');
    expect(src).toMatch(/width: 18, height: 18/);
    expect(src).not.toMatch(/tintColor|@expo\/vector-icons/);
  });
});
