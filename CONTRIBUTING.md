# Contributing to VERSO

Bug reports and pull requests are welcome.

## Reporting a bug

Open an issue with the bug report template: the player and track, what VERSO
showed, what you expected, and your OS version. If lyrics were wrong, say
whether the track had synced lyrics on LRCLIB or fell back to the estimator
(see [docs/LYRICS.md](docs/LYRICS.md)).

## Before opening a pull request

- Run the test suite and add coverage for what you changed:

  ```sh
  npm test
  ```

- The overlay is an always-on-top desktop window: changes must not steal
  focus, capture input meant for other apps, or phone home. Network access
  stays limited to the OS media session and LRCLIB.
- Keep the code dependency-light; discuss new runtime dependencies in an
  issue first.
