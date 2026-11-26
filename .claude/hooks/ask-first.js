#!/usr/bin/env node
/* THE OWNER'S ASK-FIRST LIST, AS A PROMPT RATHER THAN A MEMORY.

   CLAUDE.md lists what is never done without the owner's yes: an eas update,
   a native build, a force push, deleting anything, and anything scheduled
   ("never create scheduled things without asking please", after a Routine
   nobody agreed to woke their phone at 07:00). A rule a session has to
   remember fails the day a session forgets, so this PreToolUse hook answers
   "ask" for those actions: Claude Code then puts the action in front of the
   owner before it runs. It never blocks outright, because the owner's yes is
   the point, and it allows everything else silently.

   Text that merely MENTIONS a command (a commit message, a heredoc, a quoted
   string, a doc being written) is stripped before matching, so writing about
   `eas update` does not trigger it; only a command that would run does.
   Wired in .claude/settings.json; pinned by __tests__/ask-first-hook.test.js,
   which runs this file the way Claude Code does: JSON in on stdin.
   Anything unexpected (bad input, a tool it does not know) is allowed: a
   broken hook must never wedge a session. */

const SCHEDULING_TOOLS = new Set([
  "ScheduleWakeup",
  "CronCreate",
  "mcp__Claude_Code_Remote__create_trigger",
  "mcp__Claude_Code_Remote__send_later",
  "mcp__Claude_Code_Remote__fire_trigger",
]);

// Drop what only talks about a command: heredoc bodies, then quoted strings.
function runnable(cmd) {
  const lines = cmd.split("\n");
  const kept = [];
  let end = null;
  for (const line of lines) {
    if (end !== null) {
      if (line.trim() === end) end = null;
      continue;
    }
    kept.push(line);
    const m = line.match(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1/);
    if (m) end = m[2];
  }
  return kept
    .join("\n")
    .replace(/'[^'\n]*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

const BASH_RULES = [
  [/(^|[;&|(]\s*|\bnpx\s+|\bpnpm\s+(dlx\s+)?)eas\s+(update|build|submit)\b/m, "an eas update or a native build"],
  [/\bgit\s+push\b[^\n;&|]*(\s--force(-with-lease)?\b|\s-f\b|\s\+[\w./:-]+)/, "a force push"],
  [/\bgit\s+push\b[^\n;&|]*(\s--delete\b|\s-d\b|\s:[\w./-]+)/, "deleting a remote branch"],
];

function verdict(input) {
  const tool = input && input.tool_name;
  if (SCHEDULING_TOOLS.has(tool)) return "something scheduled";
  if (tool === "Bash") {
    const cmd = runnable(String((input.tool_input && input.tool_input.command) || ""));
    for (const [re, what] of BASH_RULES) if (re.test(cmd)) return what;
  }
  return null;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { raw += c; });
process.stdin.on("end", () => {
  let what = null;
  try { what = verdict(JSON.parse(raw)); } catch { what = null; }
  if (what) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          `Trimio's owner approves ${what} first (CLAUDE.md, the ask-first list).`,
      },
    }));
  }
  process.exit(0);
});

