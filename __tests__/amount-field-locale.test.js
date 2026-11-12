/* Every money field shows its text through amountForDisplay, so a German
   reader sees "10,99" rather than the "10.99" the field keeps. Found
   2026-11-12 in the store screenshots: a pasted Disney+ receipt filled the
   German price field as "10.99" under a placeholder reading "z. B. 9,99".
   A scan rather than a list, so a new amount field cannot skip it. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function tsxFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxFiles(p));
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function decimalFields() {
  const found = [];
  for (const f of [...tsxFiles("app"), ...tsxFiles("components")]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    let i = 0;
    while ((i = src.indexOf("<TextInput", i)) !== -1) {
      const end = src.indexOf("/>", i);
      const tag = src.slice(i, end);
      if (/keyboardType="decimal-pad"/.test(tag)) {
        const value = (tag.match(/\bvalue=\{([^\n]*)\}\n/) || [])[1] || "";
        found.push({ file: f, value });
      }
      i = end;
    }
  }
  return found;
}

describe("money fields speak the reader's decimal separator", () => {
  it("finds the three amount fields there are today", () => {
    expect(decimalFields().length).toBeGreaterThanOrEqual(3);
  });

  it("shows every one through amountForDisplay with the app language", () => {
    const bad = decimalFields().filter((x) => !/^amountForDisplay\([^,]+, i18n\.language\)$/.test(x.value));
    expect(bad).toEqual([]);
  });
});
