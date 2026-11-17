# Where `upstream/` comes from

Jakeschincariol/founder-skill, commit `fd9385b` (2026-10-06), MIT. `LICENSE`
in `upstream/` is the upstream licence and travels with the code, as MIT
requires. Installed 2026-11-17 at the owner's request, after an Instagram reel
showed it.

Read in full before anything was copied: eleven playbooks, a lenses file and
four standard library Python tools (argparse, csv, glob, json, math, os,
random, re, sys). No network calls, no subprocess, no hooks. The only delete is
panel.py removing a buyer answer it just wrote and found invalid, inside
`founder/panel/`.

## Changed

Only file names: each `skills/founder-<name>/SKILL.md` is now `PLAYBOOK.md`,
contents byte for byte. Eleven SKILL.md files would register as eleven skills
whose descriptions claim requests trimio-design and trimio-social already own
("write my ads", "tagline", "brand voice", "how do I get customers"), and they
would sit in every session's context. `../trimio-founder/SKILL.md` routes to
them instead.

## Left out

`.claude-plugin/` (the plugin manifest, not needed for a project skill) and
`.gitignore`. `tests/test_repo.py` is kept but fails here by design, since it
checks the SKILL.md names and the plugin manifest; the tool tests
(`test_compile`, `test_panel`, `test_pricing`, `test_unit_economics`, 22 tests)
pass.

`__tests__/founder-skill.test.js` fails if a SKILL.md reappears under
`upstream/` (for example by copying a newer release over this one) or if the
settled decisions are trimmed out of the skill.
