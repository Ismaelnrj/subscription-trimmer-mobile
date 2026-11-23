/**
 * CLAUDE.md is read into every session and again after every compaction. By
 * 2026-11-23 it had grown to 505 KB, about 126,000 tokens, 94% of it dated
 * history, so the history moved word for word into docs/history.md. Two things
 * would undo that silently: dated entries piling back into CLAUDE.md, and a
 * "Do not undo" line whose grep phrase no longer finds its reasoning.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const claude = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
const history = fs.readFileSync(path.join(root, "docs", "history.md"), "utf8");

describe("CLAUDE.md stays small", () => {
  it("is at most 60 KB", () => {
    expect(Buffer.byteLength(claude, "utf8")).toBeLessThanOrEqual(60 * 1024);
  });

  it("points to the history and keeps its current state and rules", () => {
    expect(claude).toMatch(/^## History lives in docs\/history\.md$/m);
    expect(claude).toMatch(/^## Current state$/m);
    expect(claude).toMatch(/^## Do not undo$/m);
    expect(claude).not.toMatch(/^## Where things stand/m);
    expect(history).toMatch(/^## Where things stand \(marketing push\)$/m);
  });

  it("has a grep phrase on every rule, and each one is in the history", () => {
    const rules = claude.split(/^## Do not undo$/m)[1];
    const bullets = rules.split(/\n(?=- )/).filter((b) => b.startsWith("- "));
    expect(bullets.length).toBeGreaterThan(50);
    const missingPhrase = bullets.filter((b) => !/\[grep: [^\]]+\]/.test(b));
    expect(missingPhrase).toEqual([]);
    const phrases = [...claude.matchAll(/\[grep: ([^\]]+)\]/g)].map((m) => m[1]);
    expect(phrases.filter((p) => !history.includes(p))).toEqual([]);
  });
});
