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

/* Also scheduling, found by the 2026-11-28 audit: turning a stored task back on
   or moving its time (update_trigger, which can revive the Monday 07:00 Routine
   CLAUDE.md keeps switched off; switching one OFF needs no yes), and the /loop
   skill, which re-runs a prompt on an interval. */
function schedules(tool, input) {
  if (SCHEDULING_TOOLS.has(tool)) return true;
  const i = input || {};
  if (tool === "mcp__Claude_Code_Remote__update_trigger") {
    return i.enabled === true || i.cron_expression != null || i.run_once_at != null;
  }
  if (tool === "Skill") return /(^|:)loop$/.test(String(i.skill || ""));
  return false;
}

// A shell that runs text it is given: `bash -c "..."`, `sh -lc '...'`,
// `bash <<EOF`, `... | sh`. There the quotes and the heredoc ARE the command.
const RUNS_TEXT = /\b(?:ba|z|da)?sh\b(?:\s+-\w+)*\s+(?:-\w*c\b|<<)|\b(?:ba|z|da)?sh\s+<<|\|\s*(?:ba|z|da)?sh\b/;

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

/* `eas` as its own word wherever it stands: after `VAR=1`, indentation, `npx`,
   `pnpm exec`, `yarn`, `bunx` or a path (node_modules/.bin/eas) alike, since
   anything that only MENTIONS it was stripped above. Short flags are read as a
   cluster, so `-fu` is a force push. */
const BASH_RULES = [
  [/(?<![\w.-])eas\s+(update|build|submit)\b/, "an eas update or a native build"],
  [/\bgit\b[^\n;&|]*?\bpush\b[^\n;&|]*(\s--force(-with-lease)?\b|\s-(?!-)[a-zA-Z]*f[a-zA-Z]*\b|\s\+[\w./:-]+)/, "a force push"],
  [/\bgit\b[^\n;&|]*?\bpush\b[^\n;&|]*(\s--delete\b|\s-(?!-)[a-zA-Z]*d[a-zA-Z]*\b|\s:[\w./-]+)/, "deleting a remote branch"],
];

function verdict(input) {
  const tool = input && input.tool_name;
  if (schedules(tool, input && input.tool_input)) return "something scheduled";
  if (tool === "Bash") {
    const raw = String((input.tool_input && input.tool_input.command) || "");
    // Read the whole text when a shell will run it, else only what runs.
    const cmd = RUNS_TEXT.test(raw) ? raw : runnable(raw);
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

