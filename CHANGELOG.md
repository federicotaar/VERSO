# Changelog

VERSO's milestones, newest first. Downloads are on the Releases page.

## 0.1.7 (2026-11-06)

- Polished 0.1.6 release notes and version bump.

## 0.1.6 (2026-11-03)

- Hand-drawn pen-stroke connectors between verses, with a rough twin stroke
  and a soft pulsing glow.
- Demo mode (`VERSO_DEMO=1`): fake now-playing track and original sample
  lyrics to verify the overlay without a player or network.

## 0.1.5 (2026-11-02)

- macOS packaging for both Apple silicon and Intel, ad-hoc signed.
- Overlay capture and animation performance work; background throttling
  enabled; renderer event logging.
- CI builds on Ubuntu, Windows and macOS.

## 0.1.4 (2026-11-02)

- Repository made public.
- The drifting per-word highlight was removed; that choice stays.

## 0.1.3 and earlier (2026-10)

- Fullscreen lyric map: quiet black canvas, mixed typography, moving camera.
- Free LRCLIB synced lyrics; OS media session reading (Spotify Free works by
  design); line-level timings with an honest estimated-words fallback.
