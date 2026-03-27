# FLYMILY Audit + targeted fixes

## What I fixed
1. Added the missing `renderAllTimeline()` implementation in `main.js`.
2. Fixed the default overview behavior so a trip opens on `הצג יומן + הוצאות`.
3. Added missing overview sort wiring.
4. Fixed a broken journal code path in `loadJournalOnly()`.

## High-confidence findings
- `main.js` is too large and mixes too many responsibilities.
- The app has repeated DOM wiring and startup overhead.
- The overview flow expected `renderAllTimeline()` to exist, but it was missing.
- Global state is fragile and side-effect heavy.

## Recommended next refactor
Split `main.js` into feature modules: overview, expenses, journal, maps, imports-exports, auth UI.
