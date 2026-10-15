# Tagged links per channel

Copy these as they are. Written 2026-10-15. App id checked against
`backend/landing.html`, guide slugs against `backend/guides/manifest.json`.

## Where each one is counted

- Play Store links: Play Console > Grow > Store performance > Acquisition,
  grouped by `utm_source` and `utm_campaign`.
- Website links: PostHog `$pageview`, whose `$current_url` carries the
  `utm_` values.
- Nothing joins the two. A visitor who goes website then Play shows up in Play
  as an install with no tag. Ads and posts seen on a phone go straight to Play.
- Installs are counted ONLY in Play Console and PostHog. An ad platform's own
  install figure is not an install (see the zeely.ai entry in CLAUDE.md).

## Rules

1. Sources are always lowercase and spelled exactly: `instagram`, `tiktok`,
   `youtube`, `reddit`, `whatsapp`, `meta`.
2. In Play links keep `%3D` and `%26` as written. A plain `=` or `&` makes
   Play drop everything after it.
3. Change `oct26` for each new push (`nov26` and so on).

## 1. Straight to Play Store (posts and ads seen on phones)

| Channel | Link |
|---|---|
| Instagram reel or post | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dinstagram%26utm_medium%3Dpost%26utm_campaign%3Doct26 |
| Instagram story | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dinstagram%26utm_medium%3Dstory%26utm_campaign%3Doct26 |
| TikTok video | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dtiktok%26utm_medium%3Dpost%26utm_campaign%3Doct26 |
| YouTube Shorts description | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dyoutube%26utm_medium%3Dpost%26utm_campaign%3Doct26 |
| Reddit post or comment | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dreddit%26utm_medium%3Dpost%26utm_campaign%3Doct26 |
| WhatsApp or friends | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dwhatsapp%26utm_medium%3Dshare%26utm_campaign%3Doct26 |
| Meta paid ad | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dmeta%26utm_medium%3Dpaid%26utm_campaign%3Doct26 |
| TikTok paid ad | https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3Dtiktok%26utm_medium%3Dpaid%26utm_campaign%3Doct26 |

## 2. Website (bios, one link for everybody)

| Channel | Link |
|---|---|
| Instagram bio, English | https://www.subtrimio.com/?utm_source=instagram&utm_medium=bio |
| Instagram bio, German | https://www.subtrimio.com/de?utm_source=instagram&utm_medium=bio |
| TikTok bio, English | https://www.subtrimio.com/?utm_source=tiktok&utm_medium=bio |
| TikTok bio, German | https://www.subtrimio.com/de?utm_source=tiktok&utm_medium=bio |
| YouTube channel | https://www.subtrimio.com/?utm_source=youtube&utm_medium=bio |

## 3. Cancellation guides ("how to cancel X" content)

Swap `tiktok` for the channel the post is on.

| Service | English | German |
|---|---|---|
| netflix | https://www.subtrimio.com/cancel/netflix?utm_source=tiktok&utm_medium=post | https://www.subtrimio.com/de/kuendigen/netflix?utm_source=tiktok&utm_medium=post |
| spotify | https://www.subtrimio.com/cancel/spotify?utm_source=tiktok&utm_medium=post | https://www.subtrimio.com/de/kuendigen/spotify?utm_source=tiktok&utm_medium=post |
| disney-plus | https://www.subtrimio.com/cancel/disney-plus?utm_source=tiktok&utm_medium=post | https://www.subtrimio.com/de/kuendigen/disney-plus?utm_source=tiktok&utm_medium=post |
| amazon-prime | https://www.subtrimio.com/cancel/amazon-prime?utm_source=tiktok&utm_medium=post | https://www.subtrimio.com/de/kuendigen/amazon-prime?utm_source=tiktok&utm_medium=post |
| youtube-premium | https://www.subtrimio.com/cancel/youtube-premium?utm_source=tiktok&utm_medium=post | https://www.subtrimio.com/de/kuendigen/youtube-premium?utm_source=tiktok&utm_medium=post |

## Is it working

After two weeks, Play Console should show tagged installs under at least one
source above. If everything is still untagged, the links are not being used:
cut to one Play link per platform rather than adding more tags.
