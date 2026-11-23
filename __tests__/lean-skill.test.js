/**
 * trimio-lean merges Ponytail and the Karpathy guidelines (both MIT) into one
 * skill (2026-11-23). Three things would undo that silently: copying an
 * upstream SKILL.md back in, which registers a second skill competing for
 * every coding task; copying Ponytail's hooks, which run on every prompt and
 * inject the rules each time, the token cost the skill exists to avoid; and
 * trimming the section that puts CLAUDE.md's standing instructions first.
 */
const fs = require("fs");
const path = require("path");

const SKILL = path.join(__dirname, "..", ".claude", "skills", "trimio-lean");
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), "utf8");

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

describe("trimio-lean", () => {
  it("registers as one skill and carries no hooks", () => {
    const files = filesUnder(SKILL).map((f) => path.relative(SKILL, f));
    expect(files.filter((f) => path.basename(f) === "SKILL.md")).toEqual(["SKILL.md"]);
    expect(files.filter((f) => /hook/i.test(f))).toEqual([]);
  });

  it("keeps both upstream rule sets and Ponytail's licence", () => {
    expect(read("upstream/ponytail.md")).toMatch(/lazy senior developer/);
    expect(read("upstream/karpathy-guidelines.md")).toMatch(/## 3\. Surgical Changes/);
    expect(read("upstream/ponytail-LICENSE")).toMatch(/^MIT License/);
  });

  it("puts the owner's standing instructions above the upstream rules", () => {
    const s = read("SKILL.md");
    expect(s).toMatch(/CLAUDE\.md and the owner's standing instructions win/);
    expect(s).toMatch(/in its own commit with its own CI run/);
    for (const askFirst of ["eas update", "runtimeVersion", "anything scheduled", "anything posted"]) {
      expect(s).toContain(askFirst);
    }
  });
});
