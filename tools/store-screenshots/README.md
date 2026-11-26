# Play Store screenshots

`store-assets/screenshots/{en,de}/` holds the six frames per language uploaded
to Play Console, 1080x1920, 24 bit PNG. Made from the REAL app, rendered by
react-native-web against the real backend on a local PostgreSQL, never drawn or
generated. The recipe for that preview is in docs/history.md ("A SANDBOX CAN
NOW INSTALL, TYPECHECK, RUN JEST AND SEE THE APP"). First set 2026-11-12; the
second set, 2026-11-26, is in the look the app now opens with (the navy stage,
its rings and the mint lens), with larger type, a larger phone and the real
reminder notification on the first frame.

1. `demo-accounts.js <lang> <token file>`: one account per language through
   the real API, catalogue prices that carry a `verified` date only (EUR for
   German, USD for English) plus one custom gym row. Netflix renews in exactly
   three days, the default reminder lead, so the first frame's notification
   ("renews in 3 days", sent today) agrees with the dashboard under it. Then
   mark them verified and paid in the local database so no trial or verify
   banner shows.
2. `shoot.js <out dir> <lang> <light|dark>`: the raw screens at 390x844, 3x.
   The paste shot types a receipt into the real parser. Written for the
   scratch harness: it reads the token from `/tmp/pgs/tokens-store-<lang>`
   and expects the preview on port 8091. Shoot into `<work dir>/raw-<lang>-light`
   and `<work dir>/raw-<lang>-dark`. Leave out `reminders`: in a browser it
   shows the "notifications are off" warning, which a phone with them on does
   not.
3. `compose.js <lang> <work dir>`: captions, the notification and its wording
   from `captions.json`, a plain Android frame (punch hole camera, never an
   iPhone notch), Montserrat from `assets/fonts`, the stage and lens from
   `assets/brand`. The status bar takes the top colour of each raw screen. The
   notification's text is the app's own (`notifications.reminders.renewTitle`
   and `renewBody`), its date the shot day plus three, in the app's format.

Rules the frames follow: every caption is checked by
`.claude/skills/trimio-design/scripts/check_copy.py` (no dash as punctuation),
every claim matches the code (over 30 guides, no bank login, reminders before
renewals and trial ends), every caption colour passes 4.5:1, and the clock
agrees with the app's greeting. Re-shoot whenever a screen in them changes:
store art showing a fixed bug advertises the bug.
