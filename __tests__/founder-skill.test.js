/**
 * trimio-founder vendors Jake Schincariol's founder-skill (MIT) as eleven
 * playbooks behind one skill (2026-11-17). Two things would undo that
 * silently: copying a newer upstream release over it, which brings back
 * eleven SKILL.md files competing with trimio-design and trimio-social for the
 * same requests, and trimming the table of settled decisions, which lets a
 * simulated buyer panel reopen a price the owner already set. Source reading:
 * the tools are Python and were run separately (22 tests pass).
 */
const fs = require("fs");
const path = require("path");

const SKILL = path.join(__dirname, "..", ".claude", "skills", "trimio-founder");
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), "utf8");

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

describe("trimio-founder", () => {
  it("registers as one skill: no SKILL.md under upstream/", () => {
    const skills = filesUnder(path.join(SKILL, "upstream")).filter((f) => path.basename(f) === "SKILL.md");
    expect(skills).toEqual([]);
  });

  it("carries all eleven playbooks and the upstream licence", () => {
    const names = ["board", "competitors", "consumer", "pricing", "offer", "cfo", "marketing", "brand", "ops", "launch", "plan"];
    for (const n of names) {
      expect(fs.existsSync(path.join(SKILL, "upstream", "skills", `founder-${n}`, "PLAYBOOK.md"))).toBe(true);
    }
    expect(read("upstream/LICENSE")).toMatch(/MIT License[\s\S]*Jake Schincariol/);
  });

  it("keeps the settled decisions a playbook must start from", () => {
    const skill = read("SKILL.md");
    expect(skill).toContain("€3.99 a month, €24.99 a year");
    expect(skill).toMatch(/Never a simulated panel/);
    expect(skill).toMatch(/Reverse trial: 14 days/);
    expect(skill).toMatch(/Trimio stays/);
    expect(skill).toMatch(/ask the owner before a\s+panel/);
    expect(skill).toMatch(/at most\s+three at a time/);
  });
});
