---
name: trimio-lean
description: Use before writing, fixing, refactoring or reviewing code in this repo, and before any long, tool heavy task. The smallest complete change (Ponytail's "lazy senior developer" ladder and Karpathy's four rules, merged), bounded by Trimio's own rules, plus the habits that keep a session's tokens down without cutting verification.
---

# Lean work on Trimio

Two MIT rule sets, merged so they do not compete: Ponytail's "lazy senior
developer" mode (`upstream/ponytail.md`) and the Karpathy guidelines
(`upstream/karpathy-guidelines.md`). Both are kept verbatim for reference;
this file is what applies. Provenance, and what was left out on purpose:
`UPSTREAM.md`.

## Where Trimio's rules win

Both were written for a generic repo. Here, in a conflict:

- **CLAUDE.md and the owner's standing instructions win.** A real defect found
  mid-task IS fixed, in its own commit with its own CI run (owner,
  2026-10-01). Karpathy's "mention dead code, don't delete it" covers cosmetic
  tidy-ups only.
- **"If uncertain, ask"** means: ask only when the answer changes what gets
  built, or the action is on CLAUDE.md's ask-first list (`eas update`,
  runtimeVersion, a native build, deletes, force pushes, anything scheduled,
  anything posted). Otherwise take the sensible default and say so.
- **Never cut:** validation at trust boundaries, error handling that prevents
  data loss, security, accessibility (both upstreams agree), and on Trimio also
  the German half of anything user facing, the no dash copy rule, and the test
  that pins a fix (`trimio-verify`).

## The smallest complete change

1. Read the task and the code it touches. List every place the change must
   reach: callers, every suite in `__tests__/` that names it (grep the whole
   directory), fixtures, both locale files, the server half and the app half.
2. Take the first option that fully works: does it need to exist; is it
   already here (a helper in `lib/`, the pattern a sibling screen uses); the
   platform; an installed dependency; one line; otherwise the minimum.
3. No abstraction, option or "for later" code nobody asked for. Deletion beats
   addition. Keep the structure the codebase already has.
4. A bug fix greps every caller of the function it touches and fixes the root
   cause once, in the shared code.
5. Every changed line traces to the request, or to a defect fixed in its own
   commit.
6. Say what "done" means before starting, check it (`trimio-verify` says how),
   then stop.

## Token habits for this repo

- Read only the part you need: `grep -n`, `sed -n 'a,bp'`, `head`. Never `cat`
  a large file. The dated history is `docs/history.md`, about 470 KB: grep it.
- Trim output at the source (`| tail -5`, `-q`, `--format`); prefer exit codes
  and counts to listings.
- Small edits through the shell or an exact Edit. No Read just to confirm an
  edit that succeeded.
- Batch independent tool calls in one turn. A subagent only when the owner
  asks, at most three at a time.
- A third party repo: `git clone --depth 1 --filter=blob:none --no-checkout`,
  then `git show HEAD:<file>` for only what is needed.
- Before a paid generation (Higgsfield, vidIQ), take the cheapest path that
  keeps the quality: `tools/reels/README.md` items 21 to 37.
- A new dated entry goes at the end of `docs/history.md`, a few lines. CLAUDE.md
  gains at most one "Do not undo" line; it is read into every session.

## The reply

Lead with the answer. End with one or two lines: what was skipped or not
checked, and any risk the owner must know.
