---
name: trimio-verify
description: How to actually verify a change to Trimio from a cloud session, where installs are blocked so pnpm test and tsc cannot run. Use this before claiming any change works, before reporting a test suite as passing, before saying a guard would have caught a bug, and whenever a behavioural question needs an answer rather than an argument: running the jest suites on bare Node, negative testing a new test against the code it was written to catch, and executing a real TypeScript module against stub imports. Also use it before writing "the tests pass", because most of this repo's suites can run here, three cannot, and the typecheck never can, and reporting those the same way is how a silent pass ships.
---

# Verifying Trimio from a sandbox

The hard constraint: a cloud session has **no `node_modules`**, because installs
are blocked. So `pnpm test` cannot run, `tsc` cannot run, and CI plus the owner's
machine are the only places the real runner lives.

The mistake that constraint invites is reasoning instead of measuring, and then
reporting the reasoning as a result. Every real defect found in this project came
from measuring. So the point of this skill is that **most of it can be measured
here anyway**, in about thirty seconds, and the rest must be named rather than
glossed.

## Run the suites

```bash
python3 .claude/skills/trimio-verify/scripts/run_suite.py            # all
python3 .claude/skills/trimio-verify/scripts/run_suite.py theme-contrast
python3 .claude/skills/trimio-verify/scripts/run_suite.py --quiet
```

24 of 27 suites run here. Three cannot, and the runner reports them as **NEEDS
REAL JEST** rather than as failures, because a suite that could not execute and a
suite that executed and failed mean opposite things:

- `calendar-legend` and `calendar-phantom` import real `.ts` modules and nothing
  here transforms TypeScript.
- `notification-race` needs `jest.fn()` and a fake timer queue.

An individual assertion that dies on a relative `.ts` import is reported as
**LIMIT**, not FAIL, for the same reason. Visible, not red.

**Never write "the tests pass" after a green run here.** Say which suites ran,
and say that `tools/typecheck.py` did not. It exits 2 in a sandbox by design.

## Prove a new test would have caught the bug

```bash
python3 .claude/skills/trimio-verify/scripts/negative_test.py cancel-guide-target
python3 .claude/skills/trimio-verify/scripts/negative_test.py theme-contrast --ref HEAD~2
python3 .claude/skills/trimio-verify/scripts/negative_test.py --all
```

It checks the ref out into a throwaway worktree, copies the **current** test in,
runs it there and here, and prints both. The test travels, the source does not.

A guard nobody has watched fail is a guard nobody has tested. Two incidents on
record: `tools/typecheck.py` was broken on the only machine it could work on for
its entire life, and a touch target assertion written this month passed against
the defective code **by accident**, because it was reading a different control
forty lines away. It would have shipped looking like it worked.

Assertions that pass both ways are not automatically wrong. Several here exist to
stop a future reader improving something already correct. Say which are which
rather than chasing a number.

## Answer a behavioural question about TypeScript

Node 22 strips types natively, so a real module runs here if its imports are
rewritten to local stubs:

```bash
mkdir -p "$SCRATCH/probe" && cp lib/recurrence.ts "$SCRATCH/probe/"
# rewrite ONLY the import specifiers, nothing else, then:
node --experimental-strip-types "$SCRATCH/probe/harness.ts"
```

This is how the notification race, the language store and the billing anchor were
each checked against **both** the old and the new code rather than argued about.
`tools/check-language-store.py` is the productionised version and worth reading as
the template.

Two rules, both learned the hard way:

**Rewrite import specifiers and nothing else.** The moment you reimplement any of
the module's logic in the copy, the result is a test of your reimplementation.

**A stub that is subtly wrong produces a confident wrong number.** The date-fns
stubs used for the phantom occurrence sweep were themselves checked against this
repo's own recurrence expectations first, before any conclusion was drawn from
them.

## What this skill cannot do, and must say so

- **Typecheck.** `tools/typecheck.py` needs the pinned TypeScript in
  `node_modules` and exits 2 here. A bare `npx tsc` falls through to the global
  compiler, which rejects this tsconfig and exits before reading a file, so it
  reads as clean and is not. Never report it as clean.
- **Reach the network.** `api.expo.dev`, the Railway backend and `subtrimio.com`
  are all egress-blocked, so nothing about a deploy, a publish or the site can be
  checked from here. `WebSearch` routes differently and does work.
- **Run the app.** No emulator. Layout, motion and anything visual needs the
  owner's device.

## Why the shim is a file and not a snippet

Because a tool you rewrite from memory each session is wrong some of the time, and
`scripts/jest_shim.js` has three bugs in its history to prove it. All three were
found in one afternoon of hand-rolled copies:

1. `it.each` filled the `%s` placeholders with `row.shift()`, consuming the row
   before the body ran. 34 correct assertions reported as failures.
2. `it` called an async body **without awaiting it**, so a suite of 20
   `async () => {...}` tests counted 20 passes with **none** of its 29 assertions
   executed. It printed PASSED having verified nothing, which is precisely the
   silent-pass failure CLAUDE.md keeps recording, manufactured by the tool meant
   to prevent it.
3. `beforeAll` was collected and never run, so a suite that sets its shared
   secret there answered 401 on every request and 18 correct assertions looked
   like failures.

The header of that file records all three. Do not make `it` call a body inline
again, and do not drop a hook you accept.
