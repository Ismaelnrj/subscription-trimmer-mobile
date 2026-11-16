# Instagram reels from the real app

Three reels, each in English and German, 1080x1920, 8 to 11 seconds, silent:

| Reel | Beat 1 (the hook, first frame) | Beat 2 | Beat 3 |
|---|---|---|---|
| cancel | Netflix guide, steps 1 and 2 | steps 3 and 4 plus the button | "Over 30 guides. Free in Trimio." |
| trial | the dashboard's trial card, "4 days left" | the reminder settings | (none) |
| paste | a receipt pasted, the parser's "Detected" line | name, price and cycle filled | "No bank login. Read on your phone." |

Each ends on the brand end card. Made 2026-11-13. The Instagram baseline in
CLAUDE.md is why they lead with the app on screen: earlier reels opened on a
text card and lost 57 to 87% of viewers before the point arrived.

## The rule these exist under

Every pixel of app UI is the REAL app, rendered by react-native-web against the
real backend on a local PostgreSQL (the recipe is in CLAUDE.md, "A SANDBOX CAN
NOW INSTALL, TYPECHECK, RUN JEST AND SEE THE APP"). Generated video never
touches the UI: every model smears the text, and the screen is the product.
Android only: no iPhone frame, no App Store badge, and the crops stay clear of
the Netflix note that names Apple.

## Making them

1. Demo accounts: `tools/store-screenshots/demo-accounts.js <lang> <token file>`,
   then mark them verified in the local database
   (`update users set is_verified = true where id in (...)`), or the dashboard
   leads with the verify banner.
2. `node tools/reels/shoot.js <lang> <token file> build/reels/<lang>` for `de`
   and `en`. Six raw screens each at 390x844, 3x.
3. `python3 tools/reels/make-specs.py build/reels`, then
   `for f in build/reels/cuts/*.json; do python3 tools/make-cut.py $f; done`.
   The reels land in `build/reels/out/`. make-cut needs
   `pip install imageio-ffmpeg pillow`.
4. LOOK at frames before sending anything: extract one per beat with ffmpeg
   and put them on a sheet. make-cut checks the caption rules (dashes, Apple,
   German decimals, hold time, contrast, the 25 to 75% band) and cannot see a
   crop that cuts a word. The first render here clipped "select" off an
   English step and the field labels off the paste form.

## When a screen changes

The crops in `make-specs.py` are element positions read off the DOM
(`getBoundingClientRect`, CSS px, times 3) for the layout of 2026-11-13. A
redesign moves them. Measure again rather than nudging numbers by eye, and
re-check every caption against the code: each one is a claim.

## Posting

Captions for the post itself are drafted per reel in the session that made
them; run them through `check_copy.py` like any other copy. EVERY POST NEEDS
THE OWNER'S YES, per post (CLAUDE.md, the vidIQ entry). Instagram's own music
library is only reachable from the app, so a reel published through vidIQ goes
out silent; adding a track in the Instagram app when posting is the owner's
call.

## The second method (2026-11-14): Higgsfield for the person, the real app full screen

The six reels above were rejected ("not good enough"): stills in a small box
on navy, a 4% push as the only motion. The pilot that replaced them:

1. **The person** is generated with Higgsfield (Seedance 2.5, 9:16, no audio),
   a 4 s draft first (12 credits), finalised at 1080p only once it passes (64).
   The phone's SCREEN is never in shot, and the prompt asks for "a plain matte
   black protective case, completely blank back, no logo". Without that the
   model drew an iPhone (Trimio is Android only), and then a real phone
   brand's logo; both drafts were thrown away. Keep a second shot consistent
   by passing the first as `video_references` in `omni_reference` mode.
   Finalising needs the same prompt sent again with `draft_job_id`.
2. **The app** is recorded with `record-guide.js`: real taps with a touch dot,
   Chrome's screencast at 1170x2079, encoded with
   `ffmpeg -f concat -safe 0 -i <frames>/list.txt -vf scale=1080:1920,fps=30`.
3. **The cut** is `tools/make-cut.py` with `footage` scenes (full frame,
   caption plate, `anchor` inside 0.25 to 0.75, clear of the face) and `clip`
   scenes for uncaptioned app footage. Two `clip` scenes from one recording
   make an invisible jump cut over a still stretch.

THE NETFLIX GUIDE IS NOT USED: it opens on a note naming Apple, and in English
the page is too short to scroll it out of view. The Amazon Prime guide carries
no such note (checked across the five verified guides: only Amazon).
Downloading Higgsfield output needs `d8j0ntlcm91z4.cloudfront.net` allowed in
the environment (added to the owner's Default, 2026-11-14) and the owner's yes.

## Dialogue scenes (2026-11-15): what the first test settled

The story reel ("We only pay for Netflix") needs two people talking. Two cheap
480p Seedance 2.5 drafts of the opening shot (15 and 18 credits, jobs
`fd090e01-8db6-45e6-a450-3fa5100e4298` and
`860b8934-1247-486d-acfd-885f0cf4ed2c`) settled four things:

1. **The woman carries over.** Passing the pilot's happy shot
   (`2bdcac58-...`) as `video_references` in `omni_reference` mode gives the
   same face, hair and sweater, so the reels read as one series.
2. **An `audio_references` clip does NOT fix the voice.** Fixed voices were
   made first (ElevenLabs v4 dialogue, 0.23 credits, job
   `548718f2-8903-4134-a592-dc7a3ddea1f4`) and passed in. Measured by median
   pitch: the made male voice sits at 182 Hz, the drafts' man at 130 and
   119 Hz, so the model invents its own. Separate shots can therefore give him
   a different voice each time. Answer: generate the whole conversation as ONE
   continuous take (up to 30 s) and cut the app shots in over it.
3. **The image model will not take a video job as a reference**
   (`gpt_image_2_6` with a video job id failed, not charged). A still of the
   woman needs uploading, and the sandbox refused the upload: the Default
   environment now allows `upload.higgsfield.ai` (owner approved 2026-11-15)
   but the session's safety check still blocked the PUT. So Higgsfield Intone,
   which lip syncs to supplied audio but needs character IMAGES, was not tried.
4. **Framing has to be stated.** "Upper half of the frame" gave cropped heads;
   "medium two shot, camera two metres back, both heads fully in frame" fixed
   him and pushed her to the edge. Ask for both centred.

Costs read off `get_cost`: Seedance 2.5 is 3 credits a second as a 480p
draft, 7 a second at 720p and 16 a second at 1080p, audio included. A full
18 s scene: 54 draft, 126 final at 720p, 288 at 1080p. Keep any TV out of
shot, or the model may draw a streaming service's logo on it.

### What "really weird" was, and the fix (2026-11-15, same day)

The owner judged the one 18 s take of the whole sofa scene (`669ce784-...`)
"nice but really weird", with the last line cut off. Read frame by frame:
a hidden jump cut at 9 s (the camera moved in and the phone appeared in her
hand), five seconds of her pouting (from the word "deadpan" in the prompt),
and a waved hand instead of counting fingers. All from cramming six beats
and nine lines into one generation.

5. **A previous take as `video_references` gets COPIED, not just its
   faces.** Passing that 18 s take back in to fix it (job
   `89069cf5-1a4d-4fdd-9fd6-1c336baa371c`, 30 credits, discarded) returned
   the same timing, the same pout, the same hands and the same audio, pitch
   for pitch, whatever the new prompt said. Reference only a clip whose
   ACTION differs (the pilot's happy shot works for her face), and describe
   anyone else in words.
6. **Split the scene, then extend.** Take one (`02365117-7e9c-4856-aceb-1e4d134dc076`,
   10 s, her face from the pilot, him in words) carries one beat; take two
   is `mode: "video_extension"`, `extension_mode: "forward"` on take one
   (`36464a27-c7f6-4582-ab6f-63405d963d98`, 11 s, 33 credits as a draft).
   The extension keeps the same people (while their faces stay in view, see
   20), room and voices (his 77 to 127 Hz,
   hers 186 to 222 Hz across both), and the seam measured 1.6/255. It returns
   only the NEW seconds, so the scene is take one then take two, concatenated.
7. **Direct the acting in plain words**: "understated, natural acting like a
   real couple at home, small believable reactions, no exaggerated
   expressions, no pouting", "locked-off static camera, the framing never
   changes, no zoom, no cuts", and at most about five short lines per 10 s.
   A prop the person will use goes in the opening frame ("her phone lies
   face down on the sofa beside her") so it does not appear from nowhere.

### The whole story reel (2026-11-15)

The approved dialogue (version 3) is take A `f6b34188-1b64-4218-b2da-70d6a6028b6a`
(10 s) and its forward extension, take B `2328bdcc-d934-469e-9c78-75e52f7284a5`
(11 s). `story/` builds the reel from them plus the real app:

```
node tools/reels/story/make-demo-account.js en /tmp/tokens      # local backend
node tools/reels/story/record-app.js /tmp/rec /tmp/tokens        # web preview
python3 tools/reels/story/assemble.py A.mp4 B.mp4 app.mp4 build/
python3 tools/brand-video.py build/story-captioned.mp4 --out build/story-en.mp4 --lang en --no-bug
```

A clean rerun of the committed script matched the reel sent for review
frame for frame and sample for sample (framemd5 of both).

8. **Finishing a draft costs more than the price table says.** `get_cost`
   with `draft_job_id` answered 16 credits a second at 720p AND at 1080p
   (take A 160, take B 176), not the 7 a second a fresh 720p generation
   costs. I quoted 147 to the owner from the table before checking; the
   real figure was 336. Ask `get_cost` with the `draft_job_id` before
   quoting a finish.
9. **`ip_detected` is the likeness filter.** A job that ends in that status
   was refused because a person looked too much like someone real (here a
   clean shaven man in a navy t-shirt). It is not charged. Describing a
   more ordinary, specific person (short brown beard, grey hoodie, round
   face) passed.
10. **Cut the app in where the hand goes to the phone, and come back on the
   reaction.** Take A ends as she lifts the phone; the insert is the app
   (form to list at 1.5x, the dashboard at real speed, held 1.3 s); the cut
   returns to take B at 2.2 s, mid lean, so "A year?" lands 0.9 s later.
   Cutting away hides any trim of take B, so its slow lean can be shortened.
11. **Never let the room go silent under an insert.** The sound under the app
   is take A's real tail, then room tone looped from a quiet stretch of take
   B (her phone taps included, which fits), then take B's real start, joined
   with 0.15 s crossfades. Digital silence there reads as a dropout.
12. **Captions under the speaker.** His on the left, hers ending at the 85%
   line, at 0.66 of the height (over the sweaters, clear of faces and of the
   platform's bottom strip), timed to the measured speech at no more than
   17.5 characters a second. make-cut's 0.4 s a word rule is for cards and
   cannot fit dialogue; a break chosen by sense ("And Disney. / The gym.
   Your Xbox.") beats a balanced wrap.
13. **Match the app to the scene.** The dashboard greets by the local hour,
   so the first recording said "Good afternoon" over an evening room.
   `record-app.js` sets a time zone where it is evening.
14. **Silent reactions get overacted.** "He opens his mouth to answer, then
   closes it" came out as a wide jaw drop and a half wink right before the
   end card, and the owner called it weird. Fixed for free by ending the
   scene on the frame before it (her knowing look, him staring ahead) and
   holding that frame 0.6 s, which also gives the last caption time to be
   read. When writing a take, end on a line or describe stillness ("says
   nothing, keeps looking ahead"), never a gesture of almost speaking.

### Part 2, "he cancels the gym" (2026-11-15)

The third reel continues the story reel's sofa scene for 78 credits of drafts,
against about 290 for the first one, because nothing had to be found again:

```
node tools/reels/story/record-cancel.js /tmp/rec /tmp/tokens en   # fresh tokens, Gym reset first
python3 tools/reels/story/assemble-part2.py ext1.mp4 ext2.mp4 app-cancel.mp4 build/
python3 tools/brand-video.py build/part2-captioned.mp4 --out build/part2-en.mp4 --lang en --no-bug
```

15. **Extend the last approved take instead of starting a new scene.** Both
    shots are `video_extension` forward: ext1 on take B, ext2 on ext1. Same
    room and voices at 3 credits a second as a 480p draft, with no
    reference hunting. A new reel in the same series is a new script, not a
    new cast. BUT THE FACE ONLY CARRIES OVER WHILE IT STAYS IN VIEW: see 20.
16. **"Surprised" comes out as a scowl, and "smile" as a look into the
    camera.** The first ext2 (`bc514b40-...`) had her frowning hard on "359
    euros?" and saying "Lisbon?" straight to camera. The retake asked for
    "eyebrows rise slightly in mild, quiet surprise", "no frowning, no
    scowling, no grimaces" and "Nobody ever looks at the camera"; the ending
    was fixed, the frown only softened.
17. **Hide a bad face with the sound running ahead of the picture.** The
    remaining frown sits on her one line, so the app's card stays on screen
    while "Done." and "359 euros?" play, and the picture returns to the sofa
    on "A year." Free, and the card is the thing worth looking at anyway.
18. **Check the words, not just the timing.** Whisper tiny.en runs offline
    through sherpa-onnx (`pip install sherpa-onnx`; the model is a GitHub
    release asset of k2-fsa/sherpa-onnx, `asr-models/sherpa-onnx-whisper-tiny.en`,
    reachable from a sandbox where Hugging Face is not). It caught a stray
    early "Done." in ext1 and a "Yeah." at the start of ext2, both cut. It
    misheard "A year?" as "Is that you?" once, so it confirms lines, it does
    not replace listening.
19. **The web preview cannot show Android's dialog.** "I cancelled it" is
    pressed from the recorded `window.__alerts`, so the footage goes from the
    Delete tap straight to the card, whose own text says "Gym marked as
    cancelled". Refresh tokens rotate on use: log in again before each
    recording run, or the second run lands on the sign in screen.
20. **A face that leaves the frame comes back as somebody else.** The owner
    caught it: Part 2's man is not Part 1's. Measured on frames, not argued:
    ext1 at 0.0 s is take B's man exactly; at 0.4 s he slumps forward and his
    head drops out of shot; at 0.9 to 1.4 s he comes back up with a longer,
    narrower face, a sparser beard and a different hairline, and ext2
    inherits him. The extension continues pixels, not a person, so once the
    face is gone it is redrawn. Direct it out ("he stays sitting upright,
    his face fully visible and facing the camera the whole time, he never
    leans forward or ducks his head"), and before cutting, put face crops of
    every new take beside the previous reel's on one sheet and look. Take A
    to take B kept him because his face never left the frame.
