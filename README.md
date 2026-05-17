# Clash.GG Auto Rain Joiner

A Tampermonkey userscript that automatically detects the clash.gg rain pool, clicks the **Join** button the moment it appears, and fires loud alerts so you can quickly solve the GeeTest captcha.

## What it does

Every ~30 minutes clash.gg distributes free gems through a "rain pool". Joining requires clicking a button and solving a GeeTest slider captcha. This script handles the boring part — it watches for the button 24/7 and gets your attention the instant rain drops.

When rain is detected:
- Clicks the **Join** button automatically (opens the captcha for you)
- Plays a repeating beep alert
- Shows a pulsing orange banner on the page
- Flashes the tab title (`🌧️ RAIN! Solve captcha!`)
- Sends a browser/Tampermonkey system notification

You just solve the slider and collect the gems.

## Requirements

- [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Opera)
- A clash.gg account (must be **level 10+** or KYC-verified to join rain)
- The clash.gg tab open in the browser (minimized/background is fine)

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Click **[Install Script](clash-rain.user.js)** — or open Tampermonkey → *Create new script*, paste the contents of `clash-rain.user.js`, and save

## Configuration

Edit the four constants at the top of the script:

```js
const POLL_MS      = 3000;          // how often to scan for the Join button (ms)
const COOLDOWN_MS  = 4 * 60 * 1000; // silence period after each join attempt
const ALERT_MS     = 90 * 1000;     // how long the overlay + title flash last
const SOUND_REPEAT = 3;             // how many times the beep sequence plays
```

## Status indicator

A small label in the bottom-right corner shows the current state:

| Label | Meaning |
|---|---|
| `☂ watching…` | Scanning for rain — no rain active |
| `☂ cooldown — Xs left` | Recently joined, waiting before next check |
| `☂ joined at HH:MM:SS` | Just clicked Join successfully |

## Notes

- The tab must stay **open** (minimized is fine). Tampermonkey cannot run without a live browser tab.
- The script does **not** solve the GeeTest captcha automatically — you solve it manually after the alert fires.
- The 4-minute cooldown prevents the script from re-clicking the same rain if you dismiss the captcha and the button briefly reappears.

## License

MIT
