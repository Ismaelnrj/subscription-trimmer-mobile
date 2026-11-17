# Keywords measured for Trimio posts

Read before writing any title, caption or description. The owner's rule,
2026-11-16: "before create a title, search for keywords that actually works
and create it having those in mind". So a title starts from this table or from
a fresh `vidiq_keyword_research` call, never from a guess.

## How to read the numbers

- Source: `vidiq_keyword_research`, YouTube search, English, read 2026-11-16.
  Monthly searches are vidIQ's estimates: treat them as an order of size, not
  a count. Every row scoring volume 54 to 56 lands between about 4,000 and
  6,000, so those rows are "a few thousand a month", nothing finer.
- `<750` is vidIQ's floor, not a measurement. Most specific phrases sit there
  ("subscription tracker", "how to cancel gym membership", "gym membership
  cost"). Use them as plain words in the text, not as the phrase a title is
  built around.
- Competition is 0 to 100, lower is easier. Aim for real volume with
  competition under about 50.
- No tool here measures Instagram search. Instagram search reads the caption
  text and the profile name, so YouTube volume is the proxy for which phrase
  to put in a caption's first line.
- Shorts and Reels are found mostly through the feed, not search. A searched
  phrase in the title and first line is the long tail on top of that, not the
  main engine. It costs nothing, so do it every time.

## Searched and winnable (real volume, competition under 50)

| Phrase | Monthly (est.) | Competition | Fits |
|---|---|---|---|
| forgotten subscriptions | ~5,000 | 44 | adding up what you pay, Part 1 of the story reel |
| subscription audit | ~4,500 | 29 | listing every subscription you pay for |
| how to find out what subscriptions i have that i pay for | ~5,500 | 28 | the same, as a question; Trimio adds up what you list, it does not find them |
| how to get all of your subscriptions under control | ~5,300 | 15 | the app pitch |
| how subscriptions quietly eat $3,000 a year | ~5,300 | 25 | a yearly total reveal |
| cancel subscriptions | ~10,000 | 49 | any cancel moment |
| why gym memberships are a waste of money | ~4,100 | 48 | Part 2 of the story reel |
| netflix subscription | ~4,800 | 41 | anything showing Netflix |
| how to cancel amazon prime membership | ~6,500 | not read | the Amazon Prime Short (2026-11-15) |
| personal finance tips | ~85,000 | 46 | tags and hashtags, too broad for a title |
| how to cancel youtube premium free trial | ~8,300 | 55 | Part 3 of the story reel (read 2026-11-17); just over the line, but the exact topic |
| how to cancel youtube premium subscription | ~4,300 | 51 | a YouTube Premium cancel guide post |
| free trial | ~8,900 | 47 | the trial reminder; a word for the text, too broad for a title |
| subscription trap | ~24,900 | 47 | a trial that turns into a charge; growing (+94% on vidIQ's reading, 2026-11-17) |

## Searched but crowded or off topic

`subscriptions` (~35,000, competition 70), `cancel subscription` (~5,500,
52), `streaming services` (~11,000, 59), `netflix` (~1.5 million, 74).
`how do i check all my subscriptions on my card` (~5,300, 25) is searched but
off limits: Trimio never reads a card, so a title built on it would claim
something the app does not do.

## Used so far

| Post | Title or first line | Phrases | State |
|---|---|---|---|
| Amazon Prime Short | How to cancel Amazon Prime membership in 4 steps | how to cancel amazon prime membership | live |
| Story reel Part 1 | Forgotten subscriptions: "We only pay for Netflix" | forgotten subscriptions, subscription audit | YouTube live 2026-11-16; Instagram caption with the owner to paste |
| Story reel Part 2 | Gym membership a waste of money? He finally cancelled it | why gym memberships are a waste of money, cancel subscriptions | YouTube live 2026-11-16; Instagram live 2026-11-17 (`Df17khHDlNf`) |
| Story reel Part 3 | Part 3: how to cancel a YouTube Premium free trial before it charges you. | how to cancel youtube premium free trial, free trial, subscription trap | proposed 2026-11-17 |

Change "proposed" to "live" only once the title is read back off
`vidiq_get_videos_by_ids` or the caption off the post.

## What the titles did (read the source, not the title)

2026-11-17, `vidiq_get_videos_by_ids`: Part 2 had 747 views 17.6 hours after
going public; Part 1, retitled with a keyword phrase the same day, had 16
after 44 hours; the Amazon Prime Short 66 after 50. Part 2's views arrived in
one steep climb between hour 4 and 6.5 and then stopped, which is a Shorts feed
test batch, not search. So a keyword title did NOT make Part 2 and did not
rescue Part 1. Keep writing them (free long tail), but before crediting a
title with a result, read the video's traffic sources in Studio: "YouTube
search" is the only row a title moves. The API returns them about two days
late.
