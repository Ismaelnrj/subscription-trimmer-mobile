# Play Store screenshots

`store-assets/screenshots/{en,de}/` holds the six frames per language uploaded
to Play Console, 1080x1920, 24 bit PNG. Made 2026-11-12 from the REAL app,
rendered by react-native-web against the real backend on a local PostgreSQL,
never drawn or generated. The recipe for that preview is in CLAUDE.md ("A
SANDBOX CAN NOW INSTALL, TYPECHECK, RUN JEST AND SEE THE APP").

1. `demo-accounts.js <lang> <token file>`: one account per language through
   the real API, catalogue prices that carry a `verified` date only (EUR for
   German, USD for English) plus one custom gym row. Then mark them verified
   and paid in the local database so no trial or verify banner shows.
2. `shoot.js <out dir> <lang> <light|dark>`: the raw screens at 390x844, 3x.
   The paste shot types a receipt into the real parser. Written for the
   scratch harness: it reads the token from `/tmp/pgs/tokens-store-<lang>`
   and expects the preview on port 8091.
3. `compose.js <lang> <work dir>`: captions from `captions.json`, a plain
   Android frame (punch hole camera, never an iPhone notch), Montserrat from
   `assets/fonts`. `bars.json` in the work dir holds each shot's top colour
   for the status bar.

Rules the frames follow: every caption is checked by
`.claude/skills/trimio-design/scripts/check_copy.py` (no dash as punctuation),
every claim matches the code (over 30 guides, no bank login, reminders before
renewals and trial ends), every caption colour passes 4.5:1, and the clock
agrees with the app's greeting. Re-shoot whenever a screen in them changes:
store art showing a fixed bug advertises the bug.
