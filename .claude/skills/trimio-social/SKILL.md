---
name: trimio-social
description: Use when writing, reviewing or posting anything for Trimio on Instagram or YouTube, including a reel or Short script, a hook, a caption, a carousel, a story, a comment, a reply or a DM, a vidIQ post draft, or a generated image or video meant for a post. Also use before any vidIQ publish call, and before calling a post a success or a failure.
---

# Trimio on Instagram and YouTube

A publish call reaches the public at once and cannot be taken back from here.
So this skill is the gate before anything goes out under Trimio's name, plus
the tools that make a post better. Every rule below exists because something
already went wrong.

Load `trimio-design` too for any caption or on screen text: its copy rules
apply to posts exactly as they apply to the app.

## The gate: nothing is posted until all of these hold

1. **The owner said yes to this exact draft, naming the platform.** A yes that
   names no platform is a yes for none: ask which one. (2026-11-16: "you can
   post it" was read as Instagram and was meant for YouTube.)
2. **For a series, YouTube first, then Instagram**, unless the owner says
   otherwise for that post.
3. **YouTube goes only to @gettrimio, `UCfVu2GhQf1cSnq9RsRzkFiA`.** vidIQ also
   lists the owner's personal channel; never post there. Upload private; the
   owner sets "Uso de IA" and makes it public.
4. **Instagram is account `29062187126774065`**, posted with
   `vidiq_instagram_publish_reel` and `isAiGenerated: true` whenever a
   generated person appears. The label cannot be changed after posting, and
   the draft tool cannot set it.
5. **Never publish vidIQ draft `c06ef544-6043-4487-b7dd-84941ebe7eae` whole**:
   it posts a reel that is already live a second time.
6. **Nothing scheduled without asking first**, per CLAUDE.md.
7. **After posting, write the link, the ids and the flags into CLAUDE.md.**

## What a post may show and say

- **The app on screen is the real app, recorded.** A generated image or video
  never shows a phone screen, any UI or any wordmark. Generated posts showed an
  invented "DANGO" brand, a fake price reminder and screens Trimio does not
  have; all had to be archived. Generated people are fine, phone screen out of
  shot, plain black case.
- **Only claims the app backs.** Nothing is connected (emails are pasted).
  Nothing watches a provider's price (the price card compares against a
  checked list). There is no forwarding address and no bank login. Android
  only: no iPhone, no App Store badge. "Over 30" cancellation guides. New
  accounts get 14 days of Premium free. Quote the app's real strings, for
  example "Netflix wird in 3 Tagen verlängert".
- **Prices** are catalogue prices with a `verified` date, or the person's own.

## Captions

- Run `check_copy.py` from `trimio-design` on every caption: no dash as clause
  punctuation, "…" not "...", German "15,99 €", „…“ quotes, Testphase, du.
- One phrase people actually search: EN "subscription tracker", "cancel
  subscriptions", "cancel Netflix"; DE "Abo Tracker", "Abos kündigen",
  "Netflix kündigen". Check it with `caption.py --keywords`.
- At most five hashtags. One ask. Captions are not tappable: the link is in
  the bio, and tagged links live in `marketing-links.md`.

## The tools

Run from the repo root, for example
`python3 .claude/skills/trimio-social/scripts/caption.py caption.txt --keywords "Abos kündigen"`.
Origin and local changes: `scripts/UPSTREAM.md`.

| Tool | Use it for | Measured limit |
|---|---|---|
| `caption.py` | feed window, hashtags, one ask, search terms | "hook is concrete" counts capitalised words, so it means nothing in German |
| `beats.py` | timing a spoken script before paying for takes | English pace; German runs longer |
| `hookscore.py` | dropping greetings, preambles and vague hooks | never use it to choose: it ranked the account's best reel last of six. English only |
| `humanize.py`, `detect.py` | stripping stock phrases from English drafts | English lexicon; run `check_copy.py` afterwards |
| `hooks.json` | 26 hook formulas to write from | written for English speech |

## A reel, in order

1. One idea and one true thing: a real price, a real guide, a real screen.
2. Three hooks from `hooks.json`, weak ones dropped with `hookscore.py`, the
   pick made by judgement.
3. Script timed with `beats.py`. On screen text written separately, six words
   or fewer, kept out of the bottom 20% and right 15% the platform covers.
4. Footage: the method in `tools/reels/README.md`.
5. Caption through `caption.py` and `check_copy.py`.
6. Show the owner the video (on the review page, never as a bare MP4), the
   caption, the platform and the AI label. Wait for the yes in step 1 of the gate.

Carousels, stories, comments, replies and DMs: `references/formats.md`.

## Reading results

- **Against the account's own median**, never raw views: the reel median was
  22 views on 2026-11-13. Shares, saves, follows and taps outweigh views. Skip
  rate ran 57 to 87% until the story reel's 45.7%.
- **Views are not customers.** The chain is view, profile, link tap, install
  (Play Console, by tagged source), signup, trial, paid (`/api/admin/funnel`).
  Instagram's `profile_links_taps` counts the call, email and address buttons,
  not the bio link; Linktree's own numbers or a tagged link answer that.
- **Success bars**, set 2026-11-13: by 2026-12-13 one reel at 500+ views or
  one share or save, and 5+ link taps in 30 days; on YouTube one install tagged
  `youtube` / `channel` by 2026-12-15.

## Common mistakes

| Mistake | Instead |
|---|---|
| Posting on "post it" with no platform named | Ask which platform |
| Picking the hook with the highest score | Use the score to drop, judgement to pick |
| Running the humanizer or scorers on German | `check_copy.py` and a German reader |
| A generated phone showing an app | Real recording; generated people only |
| Calling a reel good on views alone | Median, shares, saves, link taps |
| Recommending removing a post that is doing well | Ask what the owner wants it for first |
