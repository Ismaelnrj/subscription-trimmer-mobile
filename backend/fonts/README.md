Montserrat for subtrimio.com, served at /fonts/ by backend/server.js.

Latin subsets (Basic Latin, Latin-1 with the umlauts and ß, the euro sign,
general punctuation, arrows) of the TTFs in assets/fonts, which the app ships.
Montserrat is SIL Open Font License 1.1, which allows subsetting and
redistribution.

Rebuild from the repo root:

    pip install fonttools brotli
    for w in Regular SemiBold Bold ExtraBold; do
      pyftsubset assets/fonts/Montserrat-$w.ttf \
        --output-file=backend/fonts/Montserrat-$w.woff2 --flavor=woff2 \
        --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2193,U+2197,U+2212,U+2215,U+FEFF,U+FFFD" \
        --layout-features='*'
    done
