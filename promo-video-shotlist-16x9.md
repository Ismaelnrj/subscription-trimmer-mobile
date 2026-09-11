# Trimio promo video, 16:9 landscape

The companion to `promo-video-shotlist.md`, which is the 9:16 social cut.
This one is the calm feature tour: YouTube, the Play Store listing video, and
an embed on subtrimio.com.

Format: 1920x1080, 30fps, about 21 seconds. Built from the structure of
`TrimioPromoProfessionalRebuildCleanOutro.mp4`, which got the shape right.

## The two cuts are different genres, on purpose

Do not reuse the social hook here. On TikTok you are interrupting someone who
did not ask for you, so the first two seconds have to earn attention with
something uncomfortable ("You pay for 7 subscriptions. You remember 4.").

On a Play Store listing the viewer already tapped your app. Intent is
established, and a confrontational hook reads as an ad in a place where they
expected a product. Open with the brand and the promise instead, exactly as
the current cut does. That opening was the right call.

---

## Fix these three before re-rendering

The existing render has three problems. Nothing about its structure, pacing
or typography needs changing.

### 1. Every phone mockup is an iPhone

Frames at 0:04 and 0:10 show a Dynamic Island, an iOS status bar and the iOS
home indicator. **There is no iOS build of Trimio.** This is the same error
as the old cut's Apple App Store badge, moved from the outro into the body,
and it sits directly against an outro pointing at Google Play.

Use a Pixel or Galaxy frame. Nothing else in those shots needs to change.

### 2. Two shots show bugs that are already fixed

The footage predates the 2026-09-05 run, so it advertises defects that no
longer exist:

- **Calendar (0:10):** the "Today" pill sits on top of the Microsoft 365
  Personal row, covering its price. Fixed in `1372487`, which moved the
  button out of absolute positioning and into the flow.
- **Recommendations (0:07):** two cards report the same finding. "4
  'streaming' subscriptions" and "4 streaming services, that is a lot" both
  list RTL+ Basic, WOW Sport, Disney+ and Netflix Standard. Fixed in
  `6045dff`, which runs the specific rules first so the generic one stops
  re-firing on categories already claimed.

Re-capture both screens on the current build.

### 3. The mint subtitle fails contrast

"Private by design" in the outro samples at `#6CB99E` on warm white, which
measures **2.14:1**. That is under the 4.5:1 normal-text floor and under the
3:1 large-text floor.

Use **`#1F7A62`** (4.83:1). Visually near identical, and it is the value the
palette reserves for type that has to read as mint.

The mint rule under "Get Trimio on Google Play" measured 2.08:1 and is
**fine**. A decorative rule is not text. Mint as a rule is exactly its job.

---

## The structure, which already works

| Time | Screen | Headline | Sub |
|---|---|---|---|
| 0.0 to 2.5 | Brand card, mark and wordmark | **Know before you pay** | Subscriptions should never surprise you. |
| 2.5 to 6.0 | Dashboard | See what is coming | Upcoming renewals and monthly spending at a glance |
| 6.0 to 9.5 | **Add Expense, pasting a confirmation email** | **Add one in seconds** | Paste the confirmation email, Trimio fills in the rest |
| 9.5 to 13.0 | Recommendations | Find savings opportunities | Review smart recommendations and spot potential savings |
| 13.0 to 16.5 | Calendar | Plan before the charge arrives | See upcoming renewals by day |
| 16.5 to 19.0 | Stats, donut and categories | See where it actually goes | Spending by category, at a glance |
| 19.0 to 21.5 | Outro, mark on warm white | **Trimio** / Know before you pay | Private by design. Get Trimio on Google Play |

About 21.5 seconds. Comfortable for a listing video, and well under the 30
seconds Play recommends.

### How to shoot the paste beat, because it is the hardest one

It is the only beat that shows what Trimio *does for you* rather than what it
displays, and it is the one thing no competitor demo can show. It is also the
easiest to shoot badly, because the interesting part lasts under a second.

1. Subscriptions tab, tap **+ Add Expense**.
2. Open **Auto-fill from purchase email**. The label reads "Paste your
   purchase / confirmation email below. We'll fill in the details for you."
3. Paste a real confirmation email. Use one you actually have: a Netflix or
   Spotify receipt reads as genuine in a way invented text does not.
4. **Hold on the filled form for a full second.** Name, price, billing cycle
   and category populated. That still frame is the proof, and cutting away
   too early is what makes this beat fail.

Do not film yourself typing the fields by hand. Manual entry is the thing
this beat exists to replace, and showing it undercuts the whole point.

If the 3.5 seconds feels tight in the edit, take the time from Stats rather
than from here. Stats is the first beat to cut in any shorter version.

---

## Capture notes

- Android frame, not iPhone. Pixel or Galaxy.
- Shoot on the current build, so the two fixed bugs above stay fixed.
- Clean status bar: full battery, no notification badges, Do Not Disturb on.
- Believable data. The current set (Netflix, Disney+, RTL+, WOW, Microsoft
  365) is good. One correction: Netflix Standard reads €15.49 and the
  verified DACH price is €15.99.
- Hold each screen about 3.5 seconds. A listing viewer reads, they do not
  scroll past, so slower is better here than in the social cut.

## Sound

The current render has no audio track. That is fine muted, but a Play Store
listing video plays with sound and silence reads as broken.

- Light instrumental bed, no voiceover.
- Every headline still has to carry its beat with the sound off.

## Copy rules, same as everywhere

- No dash, em dash or hyphen as clause-separating punctuation. Colon, comma
  or period instead.
- No Apple App Store badge, no iOS references, no "available on iPhone". The
  link is `play.google.com/store/apps/details?id=com.trimio.app`
- White text on Ink Navy. Never white on Soft Mint.

## Where each cut goes

| Cut | Format | Use |
|---|---|---|
| This one | 1920x1080 | YouTube, Play Store listing video, site embed |
| `promo-video-shotlist.md` | 1080x1920 | TikTok, Reels, Shorts |
| 6 second trim of this | 1920x1080 | YouTube pre-roll, if the paid track ever runs there |

The Play Store listing video uses your feature graphic as its thumbnail, and
that is now on the navy palette, so the listing holds together from banner to
video to screenshots.
