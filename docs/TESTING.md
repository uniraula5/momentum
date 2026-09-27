# Testing

## Automated checks

`npm run typecheck` checks the TypeScript interface. `npm test` covers scheduled streaks, recovery, partial targets, historical plan changes, archival, calendar boundaries, timezone handling, backup validation, native storage failures, and starter-label migration without losing history or customized names.

`npm run android:release` also bundles the interface and runs Android release lint before producing the signed APK. CI performs these source checks and builds debug and instrumentation APKs without needing a private signing key.

The five SQLite instrumentation tests cover database initialization, persistence, revision conflicts, rejected documents, and reopening an existing database. They passed on a Pixel 8 running Android 17 during the 2.0.0 release; the database implementation is unchanged in 2.0.1. Run `./gradlew connectedDebugAndroidTest` from `android/` on a disposable QA installation to repeat them.

For 2.0.1, all 20 TypeScript/Node tests, type checking, the production interface build, Android release lint, and signed APK assembly passed locally. The npm dependency audit reported no known vulnerabilities at release time.

Android lint reported zero errors and six nonblocking warnings: five newer dependency/plugin version notices and one unused launcher drawable. Build tooling also emits deprecation notices; the project pins its tested Gradle version.

## Verification history and limits

The bundled 2.0.0 interface was exercised in a browser harness with a simulated native bridge: check-ins, streak updates, custom routines, notes, calendars, saved reviews, and review drafts survived reloads. This validates interface behavior, not the Android document picker or real device touch handling.

The 2.0.0 release was signed and installed on the Pixel 8, and the QA dashboard rendered there. Remote touch automation was unreliable. A complete physical-device navigation and document-picker round trip remains a manual check; it has not been claimed as passed. The QA app was removed after testing so the phone retains one daily tracker.

## Manual release checks

Use a disposable QA installation for destructive tests. For an existing daily installation, export a backup first and install updates in place.

- Launch without a network connection and record a scheduled completion.
- Navigate all bottom tabs, open and close dialogs with system Back, and enter a note with the keyboard visible.
- Close and reopen the app; confirm the completion, note, and streak remain.
- Record partial progress and recovery on different dates; verify calendar and statistics.
- Edit a future target or schedule and verify historical results remain stable.
- Export JSON through the Android picker, restore it in QA, and compare records.
- Reject malformed backup files without changing existing records.
- Update a signed release in place; confirm existing records and customized names survive.

Production has no `INTERNET` permission. Inspect the built APK manifest and verify its certificate with the Android SDK tools before release.
