# VERSO

Word-by-word synced lyrics floating over your desktop. Free, private, original code.
Inspired by the concept of paid lock-screen lyric apps; no code, assets, or data from any of them.

- **Platforms**: Ubuntu (AppImage/deb) and Windows (portable exe/installer).
- **Players**: whatever the OS reports as now playing - Spotify, Apple Music (Windows), browsers, VLC... (GSMTC on Windows 10 1809+, MPRIS on Linux).
- **Styles**: Ship (3D drifting wall), Fisheye (lens magnification), Visual (word icons), Plain karaoke. These are our own approximations of the inspiration app's looks, not copies.
- **Modes**: floating always-on-top overlay (click-through toggle) or fullscreen (`Ctrl+Shift+F`). Tray menu or `Ctrl+Shift+M` to cycle styles, `Ctrl+Shift+L` to lock/unlock the overlay.
- **Palette**: auto from album art, or set lyric/highlight/secondary yourself.
- **Keep awake**: display stays on while music plays (toggle in tray).
- **Demo**: `VERSO_DEMO=1 npm start` runs a fake track with sample lyrics to preview the UI without a player or network.

## Lyrics data (honest version)

| Source | Timing | Needs | Status |
| --- | --- | --- | --- |
| Apple Music | REAL word-by-word | your own Apple Music account | EXPERIMENTAL, see below |
| LRCLIB | line-by-line; words are **estimated** and labeled as such | nothing, free API | default |
| none found | shows "no lyrics found" | - | never fakes coverage |

The overlay label always says which mode a song is in. Word-by-word coverage depends
on the source, not on VERSO. No unofficial/scraped lyric endpoints are used.

**Estimated words**: with the default LRCLIB source, per-word timings are estimated from
line timings (weighted by word length) and the overlay says so. It looks like karaoke but
is not true word-by-word. This is the main accuracy gap vs. the inspiration app.

**Apple Music provider (experimental)**: real word timings exist only behind an Apple Music
account. The current code accepts account tokens in settings; they are stored locally,
unencrypted, in the app's settings file. A proper MusicKit user-authorization flow is the
planned replacement - do not share your tokens with anyone, and expect this part to change.

## Scope note

Owner's call (2026-10-31): fullscreen lyrics, NO lock-screen mode wanted or planned.

## Build

CI (GitHub Actions, ubuntu + windows runners) builds both targets on every push; artifacts on the run page.

```
npm ci
npm start     # run locally
npm run dist  # local package
```

## Privacy

Everything stays on your machine. Lyric lookups send only track title/artist to the lyric
source you use (LRCLIB, or Apple Music with your own tokens). No analytics, no account, no keys shipped.
