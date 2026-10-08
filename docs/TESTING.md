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

## 2.0.2 calendar regression checks

All 25 automated tests pass, including all 49 combinations of the previous and current weekday, Sunday-to-Tuesday navigation, year boundaries, and independent activity status calculations. TypeScript checking, the production interface build, signed APK assembly, and Android release lint pass (zero errors; six existing nonblocking warnings).

At a 393 × 851 mobile viewport, the bundled UI was exercised with disposable records and a simulated native storage bridge: previous Sunday → current Tuesday, automatic calendar creation for a new activity, logging directly from that calendar, unchanged state in another activity, and persistence after reload. The Today screen no longer includes a combined contribution calendar.

No Android device was connected during this update, so installation and physical-device touch checks remain unverified for 2.0.2. The test bridge exists only in ignored preview artifacts and is not packaged in the APK.

## 2.1.0 work in progress

TypeScript checking and all 32 Node tests pass. The 11 Android instrumentation tests passed on a disposable API-35 emulator, covering additive database migration, public/private isolation, atomic move rollback, failed-attempt persistence, and Android Keystore encryption and tamper rejection.

A browser fixture at a 393 × 851 viewport verified private-area setup, recovery-code confirmation, habit creation, check-in notes, automatically generated calendars, streak updates, past/current week navigation, moving a public habit, public-screen exclusion, and incorrect-PIN rejection. This fixture simulates the native bridge; it does not prove Android picker or lifecycle behavior.

The encrypted-backup browser download check timed out and remains unverified. Final backup, lifecycle, PIN-recovery, release-build, and physical-device checks remain in [TODO.md](../TODO.md). On 2026-10-08, all 33 Node tests, type checking, Android release lint, and signed APK assembly passed. The local APK has the existing production certificate and no INTERNET permission. It has not been installed or published. Browser-fixture persistence, recovery, encrypted export payload, and simulated picker locking passed; native file writing and final backup import remain unverified.
