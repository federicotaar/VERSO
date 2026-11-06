# VERSO

Free fullscreen lyrics for **macOS, Ubuntu and Windows**. Original code, no Spotify subscription, developer account or API keys required.

[Downloads](https://github.com/federicotaar/VERSO/releases) · [Builds](https://github.com/federicotaar/VERSO/actions)

## The lyric map

A quiet black canvas, mixed typography, connected verses and a moving camera. Each lyric line lights up whole when it starts. Connectors between verses are now drawn like a hand-drawn pen stroke: a main line with a rough twin stroke and a soft pulsing glow, sketched onto the map as the next verse approaches. The drifting per-word highlight was removed in 0.1.4; that choice stays. Fullscreen is the default; Esc, F11 or Ctrl/Cmd+Shift+F switches to a normal window.

## Install

Fully quit any older Verso first using its tray/menu-bar icon > Quit. Install over the old version, without deleting its settings.

| System | Download | Install |
| --- | --- | --- |
| Mac, Apple silicon (M1 or newer) | `Verso-0.1.7-mac-arm64.dmg` | Open the disk image, drag Verso to Applications, eject it, then open Verso from Applications. |
| Mac, Intel | `Verso-0.1.7-mac-x64.dmg` | Same steps. Requires macOS 11 or newer. |
| Ubuntu x64 | `.deb` or `.AppImage` | `sudo apt install ./verso_0.1.7_amd64.deb`, or `chmod +x Verso-0.1.7.AppImage` and launch it. |
| Windows x64 | Setup `.exe` or portable `.exe` | Run the installer, or open the portable build. |

Mac ZIP downloads are also available. The Mac app is **ad-hoc signed, not Apple Developer ID signed or notarized**. Apple may block an internet download on first open. If macOS offers it, use System Settings > Privacy & Security > Open Anyway after verifying that the download is this project's release. Do not disable Gatekeeper system-wide. Managed Macs may not permit an override. No paid signing account is used.

## Connect music

1. Open the Spotify **desktop app** on the same computer and start a song. Spotify Free is supported by design: Verso reads the local OS media session, not the paid Spotify Web Playback SDK or Web API. Real Spotify Free playback still needs on-device validation.
2. Open Verso. It reads title, artist, duration, play/pause and position from the OS, then asks the free LRCLIB service for lyrics. Start another player if you want to compare media-session reporting.
3. On Mac, controls live in the menu-bar note icon, app menu and Dock. Windows/Linux use the tray. Quit Verso from that menu when finished.

| Platform | Local music connection |
| --- | --- |
| macOS 11+ | `now-playing-media` native **MediaRemote** backend, bundled for Intel and Apple silicon. No MPRIS. The dependency uses its bundled mediaremote-adapter through system Perl, including its documented macOS 15.4+ path. Polls once a second. |
| Ubuntu | MPRIS over the desktop session's D-Bus. |
| Windows 10 1809+ | Global System Media Transport Controls. |

Only sessions the player reports to the OS are visible. Position reporting can lag; ads or tracks missing from LRCLIB may have no lyrics. Spotify in a browser, DRM players, seeking and unusual desktop configurations may report differently. There is no account login, remote playback control or promise of universal song coverage.

## Browser page, same computer only

Menu > **Open lyrics in browser (this PC only)** starts the local server and opens `http://127.0.0.1:17653/`. Press F for browser fullscreen. Keep Verso running. This is not a phone/remote website. The server is off until requested; loopback binding, fixed file allowlist, Host/Origin/Fetch-Metadata checks and no cross-origin reads keep it local and read-only.

## Status

- **Implemented:** line-synced lyric map, connected verses, moving camera, mixed fonts, fullscreen/window controls, album-art palette when available, optional keep-awake, local browser mirror.
- **New in 0.1.7:** lyric files with repeated timestamps on one line (`[00:10.00][00:50.00]chorus`, used for repeated choruses) now show the chorus every time; before, the second timestamp leaked into the text and the repeat was missing. Lyric lookup now falls back to a strict LRCLIB search when the exact lookup misses (edition suffixes like "- Remastered", punctuation differences): title and artist must match after normalising and the length must be within 3 s, otherwise no lyrics are shown rather than another song's. Unit tests now cover the LRC parser, the local browser page security rules and lookup matching (`npm test`, run in CI). No UI change.
- **In 0.1.6:** hand-drawn pen-stroke connectors on the lyric map - each verse link is a main stroke with a seeded rough twin (fixed per song, no flicker) and a wide soft glow that pulses slowly like a visualizer. Sung lines still shrink and stay on the map; the camera, path layout, mixed typography and whole-line lighting are unchanged.
- **In 0.1.5:** macOS Intel and Apple silicon packaging, unpacked native media binaries, explicit pre-package ad-hoc resource/app sealing with strict signature verification, native app menu/Dock handling, slower Mac media polling, background-rendering and fresh lyric-DOM animation initialization plus a suspended-animation watchdog for fullscreen transitions/local browser mirroring, CI native-addon and app-launch checks.
- **Previously checked:** Linux Electron under Xvfb with a window manager; VLC MPRIS; emulated Spotify-style MPRIS through LRCLIB to the browser; browser rendering and cross-origin access rejection.
- **Not yet verified on a user's machine:** real Spotify Free on any OS; actual Windows install; Mac download/Gatekeeper override, real music position/seek accuracy and live menu-bar/fullscreen behavior. CI smoke tests are not a substitute for these.
- **Not included:** lock-screen mode or true word-timed karaoke. Connector strokes are hand-drawn styling on the existing 2D map, not a full 3D scene.

## Lyrics and privacy

LRCLIB supplies line timing, not guaranteed true word timing. The parser can estimate word timing internally for layout, but the renderer no longer sweeps a highlight word by word. Missing lyrics are shown honestly. Song title, artist and album/duration go to LRCLIB to find a match; album art may be fetched from the source URL when supplied. No analytics, Spotify credentials or account tokens are collected. The optional browser endpoint exposes only the current lyric view on this computer.

## Develop

```sh
npm ci
npm test
npm start
# UI preview, not proof of live Spotify
VERSO_DEMO=1 npm start
# Build this platform
npm run dist
```

GitHub Actions builds Linux, Windows and Mac on pushes. Manual workflow dispatch publishes a new version only if its tag does not already exist; older releases are retained. Mac CI checks native addon loading, starts the packaged host-architecture app in demo mode and captures its real window. Opposite-architecture packaging does not imply runtime testing.

Media backend: [now-playing-media](https://github.com/NikolaKaplin/now-playing-media), including [mediaremote-adapter](https://github.com/ungive/mediaremote-adapter). Their notices ship in the dependency. No code or assets from paid lyric apps are used.
