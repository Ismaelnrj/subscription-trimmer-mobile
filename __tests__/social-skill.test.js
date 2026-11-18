/**
 * The trimio-social skill vendors five tools from instagram-agent-skill (MIT)
 * and changes two of them for Trimio. Upstream, measured on Trimio's own copy
 * on 2026-11-16, the humanizer deleted the no-break space in "15,99 €",
 * turned "…" into "...", broke German „…“ quotes and called five hashtags a
 * wall, and the caption linter read "#kündigen" as "#k" and missed
 * "Link im Profil" as an ask. Copying a newer upstream file over ours would
 * bring all of that back silently, so this reads the vendored files and fails
 * if any change is undone. It also pins the lines of the skill's posting gate
 * that, once trimmed, would let a post reach the wrong channel.
 *
 * Source reading on purpose: the scripts are Python, which jest does not run.
 * Their behaviour was measured by running them on 2026-11-16.
 */
const fs = require("fs");
const path = require("path");

const SKILL = path.join(__dirname, "..", ".claude", "skills", "trimio-social");
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), "utf8");

describe("trimio-social: the humanizer keeps German typography", () => {
  const slop = JSON.parse(read("scripts/slop.json"));

  it("does not strip the no-break spaces formatMoney writes", () => {
    const cps = slop.invisible.map((e) => e.cp);
    expect(cps).not.toContain("U+00A0");
    expect(cps).not.toContain("U+202F");
  });

  it("keeps the ellipsis and German quotes", () => {
    const names = slop.typographic.map((e) => e.name);
    for (const kept of ["HORIZONTAL ELLIPSIS", "LEFT DOUBLE QUOTE", "RIGHT DOUBLE QUOTE", "LEFT SINGLE QUOTE"]) {
      expect(names).not.toContain(kept);
    }
    const froms = slop.typographic.map((e) => e.from);
    expect(froms).not.toContain("…");
    expect(froms).not.toContain("“");
  });

  it("allows Instagram's five hashtags", () => {
    const wall = slop.structures.find((s) => s.id === "hashtag-wall");
    expect(wall).toBeDefined();
    const re = new RegExp(wall.regex);
    expect(re.test("#a #b #c #d #e")).toBe(false);
    expect(re.test("#a #b #c #d #e #f")).toBe(true);
    expect(wall.fix).not.toMatch(/LinkedIn/);
  });
});

describe("trimio-social: the caption linter reads German", () => {
  const caption = read("scripts/caption.py");

  it("keeps a hashtag with an umlaut whole", () => {
    expect(caption).toMatch(/HASHTAG_RE = re\.compile\(r"\(\?:\^\|\\s\)\(#\\w\+\)"\)/);
    expect(caption).not.toContain("#[A-Za-z0-9_]+");
  });

  it("counts Link im Profil as an ask", () => {
    expect(caption).toMatch(/link \(\?:im\|in meinem\|in der\) \(\?:profil\|bio\)/);
  });

  it("still enforces Instagram's cap of five", () => {
    expect(caption).toMatch(/^HASHTAG_LIMIT = 5\b/m);
  });
});

describe("trimio-social: provenance and the posting gate", () => {
  it("carries the upstream MIT licence", () => {
    const licence = read("scripts/LICENSE");
    expect(licence).toMatch(/MIT License/);
    expect(licence).toMatch(/Jake Schincariol/);
  });

  it("keeps the lines that stop a post reaching the wrong place", () => {
    const skill = read("SKILL.md");
    expect(skill).toContain("UCfVu2GhQf1cSnq9RsRzkFiA"); // @gettrimio, never the personal channel
    expect(skill).toContain("29062187126774065"); // the Instagram account
    expect(skill).toContain("isAiGenerated: true");
    expect(skill).toContain("c06ef544-6043-4487-b7dd-84941ebe7eae"); // never publish whole
    expect(skill).toMatch(/naming the platform/);
  });

  it("routes to playbooks that exist, with the rules that win over them", () => {
    const skill = read("SKILL.md");
    const named = [...skill.matchAll(/`(references\/ig\/[a-z-]+\.md)`/g)].map((m) => m[1]);
    expect(new Set(named).size).toBe(13); // one row per upstream playbook
    for (const rel of named) expect(fs.existsSync(path.join(SKILL, rel))).toBe(true);
    const readme = read("references/ig/README.md");
    expect(readme).toMatch(/## Where Trimio's rules win/);
    expect(readme).toMatch(/check_copy\.py/);
  });

  it("keeps the Vyral playbooks as reading, with the advert overruled", () => {
    // vyralcontent/content-skills, vendored 2026-11-18. A SKILL.md under
    // references/ would register as a second skill fighting this one for
    // "write my caption", so each is renamed PLAYBOOK.md.
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
      );
    const vyral = path.join(SKILL, "references", "vyral");
    const files = walk(vyral);
    expect(files.filter((f) => path.basename(f) === "SKILL.md")).toEqual([]);
    expect(read("references/vyral/LICENSE")).toMatch(/MIT License[\s\S]*Vyral/);
    const skill = read("SKILL.md");
    const named = [...skill.matchAll(/`(references\/vyral\/[a-z-]+\/PLAYBOOK\.md)`/g)].map((m) => m[1]);
    expect(new Set(named).size).toBe(7);
    for (const rel of named) expect(fs.existsSync(path.join(SKILL, rel))).toBe(true);
    const readme = read("references/vyral/README.md");
    expect(readme).toMatch(/## Where Trimio's rules win/);
    expect(readme).toMatch(/Never pitch Vyral/);
    expect(readme).toMatch(/23c/);
  });

  it("starts titles from measured keywords", () => {
    const skill = read("SKILL.md");
    expect(skill).toMatch(/## Titles and captions start from keywords/);
    expect(skill).toContain("references/keywords.md");
    const kw = read("references/keywords.md");
    expect(kw).toMatch(/vidiq_keyword_research/);
    expect(kw).toMatch(/## Searched and winnable/);
  });

  it("is listed in CLAUDE.md's skill table", () => {
    const claude = fs.readFileSync(path.join(__dirname, "..", "CLAUDE.md"), "utf8");
    expect(claude).toMatch(/\| `trimio-social` \|/);
  });
});
