# Where these scripts come from

Jakeschincariol/instagram-agent-skill, commit `d03c56bb598be770c60b201f94237e5d1a4268a6`
(2026-09-13), MIT. `LICENSE` beside this file is the upstream licence and
travels with the code, as MIT requires.

Read in full on 2026-11-16 before anything was copied: standard library
Python only, no network calls, nothing that posts.

## Taken unchanged

`hookscore.py`, `beats.py`, `hooks.json`, `humanize.py`, `detect.py`.

## Taken and changed for Trimio

`slop.json` (the humanizer's data). Measured on Trimio's own copy first, the
upstream data:

- deleted the no-break space inside "15,99 €", which `formatMoney` writes on
  purpose (entries `U+00A0` and `U+202F` removed);
- turned "…" into "...", the opposite of Trimio's ellipsis rule
  (`HORIZONTAL ELLIPSIS` removed);
- turned the German closing quote “ into a straight quote, breaking „…“ pairs
  (`LEFT DOUBLE QUOTE`, `RIGHT DOUBLE QUOTE` and `LEFT SINGLE QUOTE` removed;
  the apostrophe ’ still straightens);
- called five hashtags a wall, with a message about LinkedIn, while Instagram
  allows five (the wall now starts at six).

`caption.py`:

- the hashtag pattern was `[A-Za-z0-9_]`, so `#kündigen` was read as `#k`;
  it is `\w` now;
- the call to action list was English only, so "Link im Profil" counted as no
  ask at all; six German patterns sit beside the English ones.

`__tests__/social-skill.test.js` fails if any of those changes is undone,
for example by copying a newer upstream file over this one.

## Left out

`swipe.py` (ranking captured reels by outlier multiple): collecting the data
means reading Instagram in a browser, which a cloud session cannot reach, and
vidIQ's outlier tools answer the same question. The thirteen upstream
`SKILL.md` files are not copied: what applies to Trimio is folded into
`../SKILL.md` and `../references/formats.md`, rewritten around Trimio's rules,
so there is one skill and nothing to disagree with it.

The thirteen upstream `SKILL.md` files were added back on 2026-11-16, at the
owner's request to use each one when it is needed, as reading rather than as
skills: `../references/ig/`, byte for byte, with `ig-profile`'s `rubric.json`.
`../references/ig/README.md` says why, maps their script paths to this folder
and lists where Trimio's rules win.
