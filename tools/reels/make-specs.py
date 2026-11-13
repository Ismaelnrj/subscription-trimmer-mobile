#!/usr/bin/env python3
"""Turns the shots from shoot.js into source clips and make-cut specs.

    python3 tools/reels/make-specs.py build/reels
    for f in build/reels/cuts/*.json; do python3 tools/make-cut.py $f; done

Expects <work>/<lang>/{dash,cancel,prefs,paste0,paste1,paste2}.png at 1170x2532
(390x844 at 3x). Writes <work>/<lang>/*.mp4 and <work>/cuts/reel-*.json; the
reels land in <work>/out/.

THE CROPS ARE MEASURED, NOT GUESSED, and only hold for the layout of
2026-11-13. They are [x, y, w, h] in source pixels: element positions read
off the DOM (getBoundingClientRect, CSS px) times 3. When a screen changes,
measure again and LOOK at a frame sheet of the output before sending it: the
first render of these clipped "select" off an English step and cut the paste
form's labels, and no check in make-cut.py can see that.
"""
import json
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG = "ffmpeg"

work = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "build/reels").resolve()
(work / "cuts").mkdir(parents=True, exist_ok=True)


def clip(lang, name, frames):
    """frames: [(png, seconds)]. A still becomes a clip so make-cut can push in."""
    lst = work / lang / f"{name}.txt"
    last = frames[-1][0]
    lst.write_text("".join(f"file '{work / lang / p}'\nduration {d}\n" for p, d in frames)
                   + f"file '{work / lang / last}'\n")
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", str(lst), "-vf", "fps=30,format=yuv420p",
                    "-t", str(sum(d for _, d in frames)), "-c:v", "libx264", "-crf", "14",
                    str(work / lang / f"{name}.mp4")], check=True)


def rf(lang, src, crop, dur, caption, push=1.04):
    s = {"type": "reframe", "src": str(work / lang / f"{src}.mp4"), "in": 0, "dur": dur,
         "crop": crop, "push": push, "caption": caption}
    if lang == "de":
        s["tagline"] = "Wissen, bevor abgebucht wird."
    return s


def card(dur, text):
    return {"type": "card", "dur": dur, "lines": [text], "emphasis": True}


def end(lang):
    return {"type": "endcard", "dur": 2.6,
            "cta": "Kostenlos bei Google Play" if lang == "de" else "Free on Google Play"}


# Every caption is a claim checked against the code on 2026-11-13: the cancel
# guides are not gated (36 of them, "over 30"), the Netflix button labels were
# verified against Netflix on 2026-10-11, the trial reminder fires at 09:00 the
# day before, and the parser fills name, price and cycle (never the date or the
# category) and runs on the phone.
REELS = {
    "cancel": {
        "de": [rf("de", "cancel", [60, 879, 1032, 597], 2.6, "Netflix kündigen, Schritt für Schritt."),
               rf("de", "cancel", [60, 1476, 1032, 909], 3.0, "Mit den Buttons, die du wirklich siehst."),
               card(2.6, "Über 30 Anleitungen. Kostenlos in Trimio."), end("de")],
        "en": [rf("en", "cancel", [60, 816, 1032, 534], 2.8, "How to cancel Netflix, step by step."),
               rf("en", "cancel", [60, 1350, 1032, 780], 3.0, "With the buttons you will actually see."),
               card(2.6, "Over 30 guides. Free in Trimio."), end("en")]},
    "trial": {
        "de": [rf("de", "dash", [36, 729, 1098, 924], 2.6, "Deine Testphase endet in 4 Tagen."),
               rf("de", "prefs", [36, 264, 1098, 870], 2.4, "Trimio erinnert dich vorher."), end("de")],
        "en": [rf("en", "dash", [36, 729, 1098, 879], 2.8, "Your free trial ends in 4 days."),
               rf("en", "prefs", [36, 264, 1098, 816], 2.4, "Trimio reminds you first."), end("en")]},
    "paste": {
        "de": [rf("de", "pastea", [60, 1200, 1050, 870], 2.8, "Kopier die Bestätigungsmail hier rein.", push=1.0),
               rf("de", "paste2", [36, 510, 1098, 966], 2.6, "Name, Preis und Zeitraum sind ausgefüllt."),
               card(2.6, "Ohne Bankzugang. Ausgelesen auf deinem Handy."), end("de")],
        "en": [rf("en", "pastea", [60, 1200, 1050, 870], 2.8, "Paste the confirmation email.", push=1.0),
               rf("en", "paste2", [36, 510, 1098, 1005], 2.6, "Name, price and cycle, filled in."),
               card(2.8, "No bank login. Read on your phone."), end("en")]},
}

for lang in ("de", "en"):
    for still in ("cancel", "dash", "prefs", "paste2"):
        clip(lang, still, [(f"{still}.png", 5)])
    # Empty box for under half a second, then the paste: the change is the hook,
    # so it has to land inside the first second.
    clip(lang, "pastea", [("paste0.png", 0.4), ("paste1.png", 4)])

for reel, langs in REELS.items():
    for lang, scenes in langs.items():
        name = f"reel-{reel}-{lang}"
        spec = {"name": name, "format": "9:16", "lang": lang,
                "out": str(work / "out" / f"{name}.mp4"), "workdir": str(work / "build"),
                "scenes": scenes}
        (work / "cuts" / f"{name}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1))
print(f"specs in {work / 'cuts'}")
