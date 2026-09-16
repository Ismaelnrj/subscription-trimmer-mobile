# Brief: re-recording the Trimio walkthrough

For whoever does this next, Codex or the owner. The current recording is
`raw/walkthrough-en.mp4` (2:03, 1080x1920, H.264). It is good footage and three
Shorts have already been cut from it. This describes what it cannot do and how
the next recording should be made so it can.

Everything below is checkable. Timestamps refer to the existing recording.

---

## 1. The findings, with evidence

### 1.1 The headline feature is never actually performed

`Auto-fill from purchase email` is the thing Trimio does that competitors do
not, and **the recording never once taps it.** At 0:74 to 0:84 the control sits
on screen, collapsed, while the demo instead opens `Choose a service` and picks
from the service list. The only other appearance is a static banner on My
Subscriptions at 1:45 to 1:49.

This is why the third Short cut from this footage is weak and the other two are
not. The other two show an **event**: a duplicate dialog appears, a cancellation
path resolves into four numbered steps. The paste Short shows a button that
advertises a feature, inside a video that is already an advert. There is no cut
that fixes this, because the footage does not contain the thing.

**The single most valuable change in the next recording is performing this
flow on camera, slowly, start to finish.**

### 1.2 The recording is from a stale build

On screen at 1:45 the banner reads:

```
Paste a receipt email - it fills itself in
```

`locales/en.json` currently says:

```
Paste a receipt email, it fills itself in
```

A dash where the shipped string has a comma. The device was running an older
bundle than the repo, so anything else fixed since then is also missing from
the recording. Before re-recording, force close and reopen the app so the OTA
applies, then confirm in Help & Support that `Embedded launch (no OTA applied)`
reads `false` and note the Update ID.

### 1.3 Every price in the demo data is an unverified catalogue row

The demo account holds DAZN €29.99, WOW Sport €14.99, RTL+ Basic €4.99 and
Microsoft 365 Personal €6.99. Checked against `lib/service-templates.ts`, all
four carry `verified: NEVER`, and CLAUDE.md records specifically that the DACH
sport services were not verifiable because the available sources were
promotional pricing.

So the marketing is putting concrete euro figures on screen from rows nobody
has stood behind. `isPriceFresh` exists to stop the app doing exactly this, and
the marketing does not get a licence the product refuses itself.

**Use the verified rows instead.** As of 2026-09-05 these are the only DACH
rows with a verified date:

| Service | Price |
|---|---|
| Netflix Standard | 15,99 € |
| Spotify Premium | 12,99 € |
| Disney+ | 10,99 € |
| Amazon Prime | 8,99 € |
| Netflix Basis mit Werbung | 6,99 € |

Those five are also exactly the five in the Friday post, so the demo account and
the price post agree by construction.

### 1.4 It is two minutes long, and the composition sits under the platform UI

2:03 is a product walkthrough, not a Short. Keep it as one: the Play Store
promo slot, the landing page, a pinned channel video. But its own footer line,
the app's tab bar and the floating button all sit below y=1536, which is inside
the strip Shorts and Reels paint their own UI over. `tools/make-cut.py` now
reframes around this; the source does not need to solve it, but a recording
framed with less dead chrome gives the reframe more to work with.

### 1.5 The opener is a different product

The first ~8 seconds is generated café footage showing an **iPhone** running a
green mock UI with a dashboard that is not Trimio's. Then it cuts to the real
navy app. Trimio is Android only. Cut this, or replace it with 1.5 seconds of a
real hand holding a real Android phone.

---

## 2. Record it twice, in both languages

`Settings > Language / Sprache > EN | DE`, visible in the current recording at
about 0:58.

German Shorts need a German **recording**, not German subtitles over an English
screen. A German caption over a visibly English UI tells a German viewer the app
is not localised, which is false: there are 588 German keys and parity passes in
both directions. Same script, same order, run twice.

---

## 3. Device and capture setup

- Android's built-in screen recorder. 1080x1920, 30 fps or 60.
- **Show taps on**: Developer options > Show taps. The viewer needs to see the
  interaction, not guess at it. This is the single cheapest quality win.
- Do Not Disturb on. One notification banner ruins a take.
- Status bar clean: full battery, no alarm icon, no VPN key.
- Record audio off. Music and captions are decided later, in the cut.
- One long continuous take per language. Cutting is free; re-recording is not.

---

## 4. The shot list

Hold every screen about twice as long as feels natural. Every beat below has
already been reframed or is wanted by a planned post.

| # | Beat | What must visibly happen |
|---|---|---|
| 1 | Dashboard | Land on it. Totals visible. Do not scroll yet. |
| 2 | **Paste a receipt email** | Tap `+ Add`, tap **`Auto-fill from purchase email`**, paste a real confirmation email, and **let the form populate on screen**. Pause on the filled form for a full two seconds. This is the money shot and 1.1 explains why. |
| 3 | Duplicate catch | Add something already in the list. Let the `Duplicate subscription` dialog appear. Pause. Cancel. |
| 4 | Calendar | Open it on a month that actually has renewals. The current recording lands on `No renewals on this day`, which shows an empty state for the most screenshot friendly screen in the app. |
| 5 | Recommendations | Scroll the list slowly. The price and pause suggestions are the proof of value. |
| 6 | Stats | The donut, with the category legend. |
| 7 | How to cancel | My Subscriptions > a row > How to cancel. Let the four numbered steps sit. |
| 8 | Privacy | Anywhere the no bank connection promise is stated on screen. The strongest differentiator and currently not shown at all. |

Beat 4 is worth repeating: the calendar is the most screenshot friendly screen
in the app and the current take shows it empty.

---

## 4b. What the 2026-09-16 recordings taught

Two real Android captures arrived (`raw/rec-autofill-en.mp4` and a second take)
and two Shorts were cut from the first. They fixed the biggest problem in this
brief: **the auto-fill is performed on camera**, and it works. What they also
showed is where the next take should differ.

**Record at 1080 wide, not 720.** Both captures are 720x1608. The reframe
punches in, so a 680px crop only scales up 1.2x before it fills the content
box, and the text ends up smaller than it needs to be. At 1080 the same crop
has half again as much detail to spend. If the recorder offers 1080 or "high",
use it.

**Hold the payoff frame, and dismiss the keyboard first.** The single most
useful frame in the whole capture is at 0:10.5, where the pasted email, the
`Detected: Shopify · EUR 10.00 · monthly` line and the filled name and price
fields are all visible at once. The entire mechanism reads in one still. That
window lasts **2.5 seconds** before the next tap. Give it eight. Paste, let it
detect, dismiss the keyboard, then take your hands off the phone and count.

**The best beat was an accident, and it was too short.** Deleting Shopify fired
`You just saved €120.00 this year by cutting Shopify. Know someone who needs to
see this? Invite a friend`, which is the referral ask arriving as a consequence
of something the person just did rather than as a request. That is the most
persuasive thing in either recording and it was on screen for **2.5 seconds**,
for seventeen words of text. Trigger it deliberately, then do not touch the
phone until it disappears on its own.

**Crop the status bar out, or hide it.** The red recording indicator sits in
every frame at roughly y=30 to y=55.

**Show taps is still off.** Nothing in either capture shows where the finger
went, so the auto-fill looks like it happened by itself rather than because
somebody pasted.

**Fixed in the demo account before the next take:** the dashboard shows
`Netflix Standard · €15.49` while the verified catalogue row is `15.99`. The
template is right, the stored subscription is stale. Same for Shopify at
€10.00 and DAZN, both unverified rows.

**Checked and correct, so do not "fix" these:** the `Detected:` line uses
middle dots, not dashes. The Netflix icon red sampled at #C34A3C is the
validated `streaming` category colour `#C24C3C`, not Netflix red. The savings
toast green sampled at #1E7761 is the theme's `success` token `#1F7A62`, which
is the deepened mint the brand rules require for exactly this use.

## 5. Hard constraints

These are not preferences. Each has already cost something once.

- **No generative video may touch the UI.** Every model smears text, and the
  screen is text. The earlier café drafts produced `Trlmio` and a Netflix price
  of €15.49 against a verified 15.99. Generated footage is fine for the human
  half of a frame and never for the screen half.
- **No iPhone, no Apple, no App Store badge.** Android only.
- **One tagline per language.** `Know before you pay.` and
  `Wissen, bevor abgebucht wird.` They are deliberately not translations of each
  other, see CLAUDE.md. Do not add a third line such as the current
  `YOUR SUBSCRIPTIONS. IN VIEW.`
- **No dash as clause separating punctuation** in any caption.
- **German decimal commas.** `15,99 €`, never `15.99`.
- **Nothing below y=1536** in a vertical cut, and nothing past x=918.
- **Soft Mint never behind white text.** Navy behind white, or `#1F7A62` for
  type that must read as mint.

---

## 6. Turning it into posts

Do not hand edit. `tools/make-cut.py` builds a cut from a JSON spec and refuses
anything that breaks the rules in section 5 before it renders a frame.

```bash
python3 tools/make-cut.py cuts/short-duplicate.json
python3 tools/test-make-cut.py          # the guards must still fire
```

Existing specs in `cuts/` are the worked examples. A `reframe` scene takes
`crop: [x, y, w, h]` in source pixels and inlays that region in a navy
composition, scaling it to fill a content box that stops clear of both UI zones.
Because it fills the box rather than the frame, a tight crop comes out **larger**
than it was in the source.

Once the new recording exists, the three existing specs regenerate against it by
changing `src` and the `in` timestamps. Nothing else in them needs to move.

---

## 7. Before calling it done

- [ ] Build Info shows the OTA applied, Update ID recorded
- [ ] Demo data uses only the five verified DACH rows from 1.3
- [ ] The auto-fill paste is performed on camera and the form fills on screen
- [ ] The calendar beat lands on a month with renewals
- [ ] Both languages recorded
- [ ] Show taps was on
- [ ] `python3 tools/test-make-cut.py` passes
- [ ] `python3 .claude/skills/trimio-release/scripts/preflight.py` passes
- [ ] No frame contains an iPhone
