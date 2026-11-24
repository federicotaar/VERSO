# How VERSO gets lyrics

The lyrics pipeline, from a playing song to timed lines on the overlay.
Source: `src/lyrics/` and `src/nowplaying.js`.

1. **What is playing**: `now-playing-media` reads the OS media session
   (title, artist, duration, play/pause, position). This is why Spotify Free
   works: the paid Web API is never touched.
2. **Fetch**: `lyrics/lrclib.js` asks the free, key-less LRCLIB service.
   When several cuts match title/artist/duration, the one from the reported
   album wins. Successful results are cached per track (`lyrics/index.js`),
   so a brief outage serves the last good copy flagged `stale` instead of
   blanking the overlay.
   Line-level timings only; a 404 simply means no synced lyrics exist.
   Matching is strict on purpose: title and artist must be equal after
   normalisation (case, accents, punctuation, `feat.` credits and edition
   suffixes like "- Remastered" are ignored), the result must carry synced
   lyrics, and when the player reports a duration it must be within 3
   seconds. Anything weaker returns nothing: no lyrics beat the wrong
   song's lyrics.
3. **Unsynced fallback**: when LRCLIB has the song but only as plain text,
   the lines are shown without timings and flagged `unsynced` - the overlay
   labels them "unsynced" and does not fake highlighting (overlay.js).
4. **Parse**: `lyrics/lrcparse.js` turns standard and enhanced (word-timed)
   LRC into one model: `{ lines: [{ startMs, endMs, text, words }] }`.
   ID tags like `[ti:]` are captured into `model.meta` (title, artist,
   album, writer, length) for display/debug; `[offset:]` is honored
   (positive shifts lyrics earlier), per the LRC spec.
5. **Fallback**: when a line has no word timings, `lyrics/estimate.js`
   splits the line's duration across words weighted by length. Callers keep
   `estimated: true` so the UI can be honest that these are not real
   timings.
6. **Future**: `lyrics/ttml.js` parses TTML word timings for a future
   authorized Apple Music sign-in; it is not wired to any provider yet.

Everything after step 2 is pure functions with no network and no
credentials, covered by `test/parse.test.js`.

Helpers in `lyrics/lrcparse.js` that work on a parsed model without
changing it: `shiftLines(model, deltaMs)` moves every time (never below 0),
`modelDurationMs(model)` returns the end of the last timed line, and
`metaLengthMs(meta)` reads the `[length:]` tag. `lyrics/active.js` also has
`findNextLine` and `lineProgress` for look-ahead and per-line progress.
