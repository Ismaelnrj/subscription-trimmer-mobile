# Spy Decipher — Operation BLACKCIPHER

A real-world AR spy game for iOS/Android. Three encoded dead drops are
planted at real GPS coordinates around you. Walk to each one, activate
AR mode to spot the floating object in your camera view, intercept it,
and decode the ciphered message to reconstruct stolen intel.

Inspired by Pokémon Go's AR/GPS style, but with a spy/Indiana-Jones
aesthetic.

---

## Quick start (requires a physical iOS or Android device)

```bash
cd spy-decipher
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone. The game starts
immediately in DEV_MODE, which places the three dead drops at walkable
distances from wherever you are — no need to travel anywhere.

---

## How it works

```
BriefingScreen  →  RadarScreen  →  ARScreen  →  DecipherScreen  →  CompletedScreen
```

| Screen | What happens |
|---|---|
| **Briefing** | Typewriter-animated mission briefing |
| **Radar** | Sonar-style radar shows drop bearing & distance |
| **AR** | Full camera view + compass HUD; floating spy object appears when you face the drop |
| **Decipher** | Decode the ciphered message (manually or via auto-decrypt engine) |
| **Completed** | Assembled intel displayed; mission complete |

---

## AR mode explained

The AR overlay works without ARKit/ARCore SDKs:

1. **GPS** (`expo-location`) gives your real-world position.
2. **Magnetometer** (`expo-sensors`) gives your phone's compass heading.
3. A bearing is calculated from your position to the drop's GPS coords.
4. The angular difference between your heading and the drop's bearing
   maps to a horizontal screen position — the spy object floats at
   exactly that x-coordinate over the live camera feed.
5. As you physically turn, the object moves with you (or disappears
   when you face away).

---

## Placing real-world drops (production mode)

Open `src/data/missions.js` and set:

```js
export const DEV_MODE = false;
```

Then edit each mission's `prodCoords`:

```js
{
  id: 'alpha',
  prodCoords: { lat: 40.7484, lng: -73.9967 }, // your real GPS coordinate
  ...
}
```

You can generate coordinates from Google Maps: right-click any spot →
"What's here?" to copy lat/lng.

---

## Cipher types used

| Drop | Cipher | Example |
|---|---|---|
| ALPHA | Base64 | `INTEL SECURED...` → `SU5URUwg...` |
| BRAVO | Morse code | `MEET AT...` → `-- . . - / .- -` |
| CHARLIE | Caesar +5 | `THE MOLE...` → `YMJ RTQJ...` |

---

## Customising missions

Edit `src/data/missions.js` to change plaintext messages, cipher types,
emoji icons, or add more drops. All encoding is done automatically —
just write the plaintext, the ciphertext is computed at import time.

---

## File structure

```
spy-decipher/
  App.js                    root navigation
  src/
    theme.js                spy colour palette
    data/missions.js        drop definitions + story
    lib/ciphers.js          encode/decode + auto-detect engine
    lib/geo.js              haversine, bearing, magnetometer math
    screens/
      BriefingScreen.js     typewriter mission intro
      RadarScreen.js        sonar radar + drop list
      ARScreen.js           camera + AR overlay
      DecipherScreen.js     cipher puzzle solver
      CompletedScreen.js    mission complete
    components/
      RadarDisplay.js       SVG-free sonar radar widget
      ARDropObject.js       floating spy object in AR view
```
