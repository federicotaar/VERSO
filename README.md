# VERSO

Word-by-word synced lyrics floating over your desktop. Free, private, original code.
Inspired by the concept of paid lock-screen lyric apps; no code, assets, or data from any of them.

- **Platforms**: Ubuntu (AppImage/deb) and Windows (portable exe/installer).
- **Players**: whatever the OS reports as now playing - Spotify, Apple Music (Windows), browsers, VLC... (GSMTC on Windows 10 1809+, MPRIS on Linux).
- **Styles**: Ship (3D drifting wall), Fisheye (lens magnification), Visual (word icons), Plain karaoke. Tray menu or `Ctrl+Shift+M` to cycle, `Ctrl+Shift+F` fullscreen, `Ctrl+Shift+L` lock/click-through.
- **Palette**: auto from album art, or set lyric/highlight/secondary yourself.
- **Keep awake**: display stays on while music plays (toggle in tray).

## Lyrics data (honest version)

| Source | Timing | Needs | Status |
| --- | --- | --- | --- |
| Apple Music | REAL word-by-word | your own Apple Music account tokens (paste in settings) | works when you supply tokens |
| LRCLIB | line-by-line; words are **estimated** and labeled as such | nothing, free API | default |
| none found | shows "no lyrics found" | - | never fakes coverage |

The overlay label always says which mode a song is in. Word-by-word coverage depends
on the source, not on VERSO. No unofficial/scraped lyric endpoints are used.

## Lock screen status

Drawing over the **Windows lock screen** is not possible for a normal app (secure desktop).
On **Ubuntu/GNOME** it would need a Shell extension - not built yet. Current release is an
always-on-top overlay + fullscreen mode. This is the one known gap vs. the app that inspired it.

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
