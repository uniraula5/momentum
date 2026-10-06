# Momentum

An offline Android habit tracker for building a consistent practice across learning, career preparation, training, and wellbeing.

**No account. No server. No internet permission.** Your records stay on your phone, and the complete interface ships inside the APK.

[Download the latest APK](https://github.com/uniraula5/momentum/releases/latest) · [User guide](docs/USER_GUIDE.md) · [Development](docs/DEVELOPMENT.md) · [Architecture](docs/ARCHITECTURE.md)

## Features

- Daily check-ins with numeric targets, session notes, historical entries, and recovery days.
- Current and longest streaks based on each habit's scheduled days.
- Individual activity calendars with fixed completion, partial-progress, recovery, and missed-day colors; new activities get a calendar automatically.
- Editable weekday schedules and targets with preserved history.
- Milestones for projects, applications, conversations, and personal skills.
- Weekly reflections, energy ratings, and locally retained review drafts.
- Android bottom navigation, system Back handling, and keyboard-aware layouts.
- Private SQLite storage with atomic saves and stale-write protection.
- JSON backup and restore through Android's document picker, plus CSV exports.
- Editable starter routines for computer science study, software projects, gym, swimming, calisthenics, mobility, meditation, and recovery.

## Install and update

1. Download the APK from [Releases](https://github.com/uniraula5/momentum/releases/latest).
2. Open it on Android and complete the installation prompt.
3. Launch **Momentum** and customize your routines.

Android 6.0 or later is required. An up-to-date Android System WebView is recommended. Internet is not required to open the app or save records after installation.

For updates, install the newer APK over the existing app. **Do not uninstall or clear storage to update.** Official release builds use the same package and signing key to preserve records.

Export a JSON backup regularly from **Routines → Export backup**. Uninstalling, clearing storage, or losing your phone can remove records. Backups are ordinary, unencrypted JSON files; store them somewhere you trust. There is no automatic cloud sync or backup.

## How streaks work

A streak counts consecutive **scheduled completions**. Unscheduled days are neutral. A recovery day preserves the streak without adding a completion and is excluded from the consistency percentage. An incomplete scheduled day resets the current streak after midnight in your selected timezone. Partial progress contributes to totals but does not complete the target.

Schedule and target changes retain earlier rules for earlier dates. Archiving a habit preserves its history. Correcting a past entry recalculates the statistics.

## Project layout

```text
android/                 Android host, SQLite database, resources, and device tests
src/
  components/            Tracker screens, forms, calendars, and UI primitives
  lib/                   Date calculations, streak rules, validation, and migrations
  platform/              On-device persistence and file-export adapter
  styles/                Shared visual design and Android layout adjustments
  main.tsx               Bundled interface entry point
tests/                   Domain, validation, storage, and migration tests
scripts/                 Test runner, release build, and checksums
docs/                    User, developer, architecture, and verification guides
vendor/                  Third-party styles and license notices
.github/workflows/       Continuous integration
```

## Development

Requires Node.js 22.13+, Java 21, and Android SDK 36.

```bash
npm ci
npm run typecheck
npm test
npm run android:debug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. It uses a separate **Momentum QA** package so development records cannot overwrite the daily app.

For release signing, installation commands, and device testing, see [Development](docs/DEVELOPMENT.md). The interface uses React and TypeScript inside an embedded Android WebView; Java provides SQLite persistence and Android integrations. No browser app is launched.

## Documentation

- [User guide](docs/USER_GUIDE.md): check-ins, calendars, routines, goals, and backups.
- [Architecture](docs/ARCHITECTURE.md): modules, data model, offline behavior, and security boundaries.
- [Development](docs/DEVELOPMENT.md): setup, build, signing, tests, and device installation.
- [Testing](docs/TESTING.md): verified coverage and remaining manual checks.
- [Changelog](CHANGELOG.md): release history.
- [Contributing](CONTRIBUTING.md): development conventions.

## License notices

This is a private project; no public open-source license is granted for the project as a whole. Third-party components retain their original licenses. See [third-party notices](THIRD_PARTY_NOTICES.md) and `vendor/`.
