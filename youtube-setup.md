# Setting up the Trimio YouTube channel

Nothing exists yet: vidIQ is authorized as `inaranjoovb@gmail.com` and reports
zero channels. So this is from zero, in the order the decisions actually lock
in. The ones near the top are expensive to change later; the ones near the
bottom you can fiddle with forever.

## 1. Create it as a Brand Account, not your personal channel

This is the one genuinely irreversible-ish choice on the page, and YouTube
does not flag it.

Signing in and hitting "Create channel" gives you a **personal** channel welded
to your Google identity. It cannot have a second manager, it cannot be handed
to anyone, and its name is tied to your account name. A **Brand Account**
channel can take additional managers and can be transferred. You are solo
today, which is exactly when this looks like it does not matter.

Route: youtube.com → your avatar → **Settings** → **Add or manage your
channel(s)** → **Create a channel**. That path creates a Brand Account channel.
Do not use the "Create channel" prompt that appears when you first try to
upload.

## 2. Name and handle

- **Channel name:** `Trimio`
- **Handle:** `@trimio` if free, otherwise `@trimioapp`

The handle is your youtube.com/@... URL. You can change it later, but every
link you have already posted breaks when you do, so decide now and leave it.

Do not put keywords in the channel name. "Trimio: Geld sparen" and similar
look clever and read as spam in a subscription feed, and the channel name is
not a meaningful ranking signal. The **video titles** carry the search weight,
which is what all of week-1-captions.md is about.

## 3. The two images

Both are generated from the same mark as the app icon and the site, so nothing
drifts. Regenerate any time with:

```bash
python3 tools/make-youtube.py
```

| File | Size | Goes in |
|---|---|---|
| `assets/youtube-avatar.png` | 800 × 800 | Customization → Branding → Picture |
| `assets/youtube-banner.png` | 2048 × 1152 | Customization → Branding → Banner image |

**The banner's safe area is the whole problem with banners.** You upload one
2048 × 1152 image and YouTube crops it differently on every surface: the full
frame only on a TV, a 423px-tall strip on desktop, a narrower one on tablet,
narrower still on phone. The only box visible everywhere is **1235 × 338,
centred**. This banner keeps every word inside it and lets the navy field bleed
to the edges, so the phone crop loses nothing but background. YouTube's own
preview shows you the three crops before you save. Check it.

**The avatar is cropped to a circle**, which is why it is not just
`assets/play-store-icon.png` resized. That file carries the artwork's own
offset, the mark sitting 2.20% right and 1.29% high inside its tile, which is
correct for a square Play tile and wrong under a circular mask. The avatar is
centred instead, same reasoning as the Android adaptive icon.

## 4. Channel description

Customization → Basic info → Description. This one *is* indexed, so it gets
the measured frame rather than a product pitch.

```
Trimio zeigt dir, was deine Abos kosten und wann sie verlängert werden.

Hier geht es ums Geld sparen im Alltag: welche Abos still weiterlaufen, was
Netflix, Spotify und Disney+ wirklich kosten, und wie du den Überblick
behältst, ohne dein Bankkonto zu verbinden.

Gebaut von einer Person in Wien.

Kostenlos bei Google Play:
play.google.com/store/apps/details?id=com.trimio.app
www.subtrimio.com
```

Also on that page: add `www.subtrimio.com` and the Play link under **Links**,
and set **Contact info** to whatever address you want public, because it is
public.

## 5. Four settings that are easy to get wrong

**Made for kids: No.** Settings → Channel → Advanced settings → "No, set this
channel as not made for kids." If this is ever Yes, YouTube **disables comments
entirely**, turns off personalized ads, and drops the video out of most
recommendation surfaces. The Monday and Sunday captions both end on a question
designed to open a comment thread, so Yes here quietly deletes half the
strategy and nothing tells you.

**Country: Austria.** Settings → Channel → Basic info → Country of residence.

**Keywords**, same page. Use the terms that measured, not the ones that feel
right:

```
geld sparen, geld sparen tipps, geld sparen im alltag, sparen, finanztipps, haushaltsbuch, abo tracker, abos verwalten
```

**Verify by phone.** Settings → Channel → Feature eligibility → verify. It is
a 60 second SMS and it unlocks custom thumbnails. You do not need one for a
Short, but you will want one the first time a post earns a second life.

## 6. Uploading a Short

The videos are already the right shape: vertical, 15 seconds, well under the
3 minute Shorts ceiling. YouTube detects a Short from the aspect ratio and
duration by itself.

**Do not put `#Shorts` in the title.** That advice is several years stale, it
does nothing now, and the title is 100 characters of search real estate that
week-1-captions.md spent measured effort on. Every character it eats is one
the title cannot use.

Per upload:

| Field | What goes in |
|---|---|
| Title | The exact title from week-1-captions.md, copied, not retyped |
| Description | The description block from the same post |
| Hashtags | The three YouTube ones from the table at the bottom of that file, in the description |
| Audience | Not made for kids |
| Video language | German |
| Category | People & Blogs for Monday and Sunday, Education for Wednesday and Friday |

That covers it. Playlists, end screens and cards are all long-form furniture
and do nothing for a Short.

**One post at a time, on the schedule.** Mon, Wed, Fri, Sun. Uploading all four
the day you finish filming feels productive and gives the algorithm four
simultaneous cold starts competing with each other, and it tells you nothing
about which of the four pillars works, which is the entire job of month one.

**On upload time:** general advice says early evening for a German-speaking
audience, and that is a heuristic rather than anything measured for you. With
zero subscribers it matters less than it is usually claimed to: Shorts are
served from a feed over days, not pushed to subscribers at the moment of
posting. Pick a time you can keep and do not optimise it before there is data.

## 7. Then connect it to vidIQ

Once the channel exists, authorize it in vidIQ under the same
`inaranjoovb@gmail.com`. That turns on the things that need a channel to point
at: real performance data per video, comment insights, and title scoring
calibrated against your own channel rather than in the abstract. Every number
in week-1-captions.md so far is channel-independent, which is the weaker
version.

## What this does not cover

Monetization thresholds (1,000 subscribers and 10 million Shorts views in 90
days) are far enough away to be noise, and ad revenue was never the point. The
conversion that matters is Play Console's acquisition report and PostHog's
`landing_play_store_click`, both of which are already running.
