# The thirteen Instagram playbooks

These are the thirteen `SKILL.md` files of Jakeschincariol/instagram-agent-skill
at commit `d03c56bb598be770c60b201f94237e5d1a4268a6`, MIT (`../../scripts/LICENSE`),
copied byte for byte and renamed after their folder, plus `ig-profile`'s
`rubric.json` as `ig-profile-rubric.json`. Kept unchanged so a later upstream
version can be compared with `diff`.

They live here as reading, not as installed skills, on purpose. Installed side
by side with `trimio-social` they all claim the same tasks ("write the
caption", "plan my week"), and thirteen more skill descriptions sit in the
context of every session. Here, `trimio-social` triggers alone and its table
says which playbook to open for the job at hand. Installed only in a cloud
container they also vanished with it; here they survive every session.

## Paths inside them

- A script named as "in this folder" is in `../../scripts/`: `caption.py`,
  `hookscore.py`, `beats.py`, `hooks.json`, `humanize.py`, `detect.py`,
  `slop.json`. The two Trimio changes (`caption.py`, `slop.json`) are listed in
  `../../scripts/UPSTREAM.md`.
- `ig-reel/hooks.json` is `../../scripts/hooks.json`.
- `rubric.json` (in `ig-profile.md`) is `ig-profile-rubric.json` beside this file.
- `swipe.py` (in `ig-viral.md`) is not vendored. Find outliers with vidIQ's
  `vidiq_instagram_tiktok_outlier_search` instead; a cloud session cannot read
  Instagram in a browser.

## Where Trimio's rules win

Read a playbook for the craft. Where it says something different, this list and
`../../SKILL.md` decide:

- **Nothing is posted** without the owner's yes on the exact draft, naming the
  platform (the gate in `../../SKILL.md`). Comments and DMs are sent by the
  owner, by hand.
- **German copy** never goes through `humanize.py`, `detect.py`,
  `hookscore.py` or `beats.py`: they read English only. `ig-human.md` says
  ellipses become three dots and curly quotes go straight; Trimio's `slop.json`
  keeps "…", „…“ and the no-break space in "15,99 €". Run `check_copy.py`
  from `trimio-design` on every caption, in both languages.
- **Hook scores drop, they never pick** (`hookscore.py` ranked the account's
  best reel last of six).
- **DMs only to people who moved first.** No collab pitch to a brand without
  the owner asking for one.
- **The cadence in `ig-plan.md`** (four to five posts a week, stories daily,
  20 minutes of commenting a day) is a ceiling for a solo owner, not a target.
- **Generated pictures never show a screen, UI or a wordmark**, whatever a
  carousel or reel playbook suggests for visuals.
