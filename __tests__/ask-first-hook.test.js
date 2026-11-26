/**
 * THE ASK-FIRST LIST IS A HOOK NOW (.claude/hooks/ask-first.js).
 *
 * The owner's rules (no eas update, native build, force push, deletion or
 * anything scheduled without their yes) used to live only in CLAUDE.md, and a
 * session that forgot them created a Routine that woke the owner's phone at
 * 07:00. The hook answers "ask" for those actions so Claude Code puts them in
 * front of the owner. This runs it the way Claude Code does, JSON on stdin,
 * and checks both directions: the actions it must catch, and the everyday
 * commands (including text that only MENTIONS eas update) it must leave alone.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HOOK = path.join(ROOT, ".claude/hooks/ask-first.js");

function run(input) {
  const r = spawnSync(process.execPath, [HOOK], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8" });
  return { status: r.status, out: r.stdout.trim() };
}
const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });
const asks = (input) => {
  const { status, out } = run(input);
  expect(status).toBe(0);
  if (!out) return false;
  const o = JSON.parse(out).hookSpecificOutput;
  expect(o.hookEventName).toBe("PreToolUse");
  expect(o.permissionDecision).toBe("ask");
  return true;
};

describe("the ask-first hook", () => {
  it.each([
    "eas update --channel production --message x",
    "cd app && npx eas build -p android",
    "pnpm dlx eas submit",
    "git push --force origin claude/x",
    "git push -f origin master",
    "git push --force-with-lease origin claude/x",
    "git push origin +HEAD:master",
    "git push origin --delete claude/old",
    "git push origin :claude/old",
  ])("asks before: %s", (cmd) => {
    expect(asks(bash(cmd))).toBe(true);
  });

  it.each(["ScheduleWakeup", "CronCreate", "mcp__Claude_Code_Remote__create_trigger", "mcp__Claude_Code_Remote__send_later", "mcp__Claude_Code_Remote__fire_trigger"])(
    "asks before the scheduling tool %s",
    (tool_name) => {
      expect(asks({ tool_name, tool_input: {} })).toBe(true);
    },
  );

  it.each([
    "git push -q origin master-ff:master",
    "git push origin master:claude/calendar-dot-4riizs",
    'git commit -q -m "Record the eas update as published"',
    "git commit -q -F - <<'EOF'\nThe next eas update --channel production ships it.\ngit push --force is never the answer.\nEOF\ngit log --oneline -1",
    "cat >> docs/history.md <<EOF\n  eas build is owed\nEOF",
    "npx jest __tests__/ask-first-hook.test.js",
    "grep -n 'eas update' CLAUDE.md",
    "python3 .claude/skills/trimio-release/scripts/needs_native_build.py",
  ])("stays silent on: %s", (cmd) => {
    expect(asks(bash(cmd))).toBe(false);
  });

  it("stays silent on other tools and never wedges on bad input", () => {
    expect(asks({ tool_name: "Read", tool_input: { file_path: "x" } })).toBe(false);
    expect(asks("not json")).toBe(false);
    expect(asks({})).toBe(false);
  });

  it("is wired for Bash and every scheduling tool, and the files are not ignored", () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude/settings.json"), "utf8"));
    const entry = settings.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes(".claude/hooks/ask-first.js")));
    expect(entry).toBeTruthy();
    for (const t of ["Bash", "ScheduleWakeup", "CronCreate", "mcp__Claude_Code_Remote__create_trigger", "mcp__Claude_Code_Remote__send_later"]) {
      expect(new RegExp(`^(${entry.matcher})$`).test(t)).toBe(true);
    }
    const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(ignore).toMatch(/^!\.claude\/settings\.json$/m);
    expect(ignore).toMatch(/^!\.claude\/hooks\/$/m);
  });
});
