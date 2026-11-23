# Where trimio-lean comes from

Installed 2026-11-23 at the owner's request: install the skills from five
Instagram posts, and find the "lazy senior developer" repo that saves tokens
without losing quality. Every repo was read before anything was copied.

## Taken

| File | Source | Commit | Licence |
|---|---|---|---|
| `upstream/ponytail.md` | DietrichGebert/ponytail, `skills/ponytail/SKILL.md` (v5.3.3), the "lazy senior developer" repo | `ebd8654` | MIT, `upstream/ponytail-LICENSE` |
| `upstream/karpathy-guidelines.md` | multica-ai/andrej-karpathy-skills, `skills/karpathy-guidelines/SKILL.md`, a copy of forrestchang/andrej-karpathy-skills | `2c60614` | MIT (stated in its README and frontmatter; the repo has no LICENSE file) |

Both are verbatim, renamed from `SKILL.md` so they do not register as two more
skills competing with this one. `SKILL.md` here is the merge, with Trimio's
rules on top.

## Left out, and why

- **Ponytail's hooks, band and ledger.** Three hooks run Node on every session
  start, every prompt and every subagent start, inject the rules into context
  each time, write a per turn ledger to `~/.config/ponytail/`, spawn a
  background importer, and can post each turn to a webhook (off by default).
  The band does not render in cloud sessions anyway. A skill loaded when the
  task needs it costs nothing on the turns it is not used.
- **Ponytail's five sibling skills** (review, audit, debt, gain, help): review
  and audit duplicate `code-review` and `security-review`; the rest report on
  the ledger that was not installed.
- **ECC** (affaan-m/ECC v2.2.3, MIT): 328 skills, 72 agents, 99 commands and 28
  hooks, 10 of them on every tool call. Measured on `4adeee6`: listing its
  skills and agents alone costs about 33,000 tokens in every session, before
  any of them runs, and many claim the same requests as the trimio skills. The
  opposite of saving tokens.
- **CLI-Anything** (HKUDS, Apache-2.0): generated CLIs for desktop software
  (GIMP, Blender, Shotcut, Audacity...). Nothing here runs those apps; the
  reels are cut with ffmpeg.
- **Paperclip** (paperclipai, MIT): a Node server and React UI that runs teams
  of agents on budgets. An app, not a skill, and autonomous agents spend
  tokens and money by design; CLAUDE.md asks first before anything that runs
  unattended.
- **VoiceStudio** (debpalash, AGPL-3.0): a local voice cloning and dubbing app.
  An app, not a skill; its models download from Hugging Face, which this
  sandbox cannot reach. Parked as a possible way to make German versions of
  the story reels on the owner's own machine.

## Updating

Copy a newer upstream file over its `upstream/` twin, re-read it, and fold any
rule worth having into `SKILL.md` by hand. `__tests__/lean-skill.test.js` fails
if a `SKILL.md` or a hooks file appears under this skill.
