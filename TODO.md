# Private habits — resume checklist

Status: private-habit implementation is in progress for 2.1.0. The latest released APK is 2.0.2; a signed 2.1.0 APK has been built locally but not installed or published. This checklist records outstanding validation and delivery work.

## Completed

- Private area opened by holding Momentum logo for 900 ms; focused-logo Alt+Enter also works.
- Six-digit PIN, recovery-code setup, PIN change/recovery, AES-GCM encrypted records, Android Keystore outer encryption, persistent attempt delays.
- Background and two-minute idle locking; private-screen screenshot protection.
- Private creation/edit/logging/calendar/streak UI; atomic public-to-private moves with history.
- Separate recovery-code-encrypted backups without PIN wrapper; public records/exports stay separate.
- Version bumped to 2.1.0 / Android versionCode 5; README, changelog, architecture, user guide, security design updated.
- TypeScript check and all 32 Node tests pass on latest source.
- All 11 Android instrumentation tests pass on disposable API-35 emulator, including actual v1-to-v2 migration, atomic rollback, persisted rate delay, and Keystore encryption/tamper rejection.
- Native tests caught and fixed an Android SQLite error: secure_delete PRAGMA must use rawQuery, not execSQL.
- Browser fixture verified setup/recovery-code confirmation, private creation, logging/note, automatic individual calendar, streak increment, past/current week navigation, public-to-private move, public-screen exclusion, and wrong-PIN rejection at phone width.

## Remaining, in order

- [ ] Complete browser checks: reload persistence, explicit/background/idle locking, encrypted export/import round trip, recovery/PIN-change flow. The browser download check timed out; export success is unverified. Use disposable test records and credentials.
- [x] Enforce UTF-8 byte limits on private creation, saves, and restore; regression test rejects oversized Unicode history and verifies accepted histories reopen.
- [ ] Check native picker resume/import behavior and private screen protection as far as available UI tools allow; clearly document anything unverified. Import ciphertext was adjusted to survive lifecycle locking without carrying a decrypted session.
- [ ] Update docs/TESTING.md with actual 2.1.0 results and limitations; correct outdated 2.0.2 installation status only with evidence.
- [x] Run typecheck, all 33 Node tests, production build, Android release lint, and signed APK assembly (2026-10-08).
- [ ] Verify same signing certificate, no INTERNET permission, and no test bridge included in APK.
- [ ] Install release in place on the target Pixel 8 using `adb -s DEVICE_SERIAL install -r APK_PATH`. Never uninstall or clear daily records. Use an emulator for the separate QA package. Leave real PIN setup to the device owner.
- [ ] Verify version and only one Momentum package; test available phone UI without claiming checks that could not be completed.
- [ ] After remaining checks pass, publish the signed v2.1.0 APK and checksum to GitHub Releases. Keep signing material and personal data out of Git.
- [ ] Report APK link, logo hold/PIN/recovery instructions, passed tests, actual installation status, and remaining manual checks.

## Reproducible development setup

- Node.js 22.13+, Java 21, Android SDK 36; see [Development](docs/DEVELOPMENT.md).
- Daily package: `com.utshab.momentum`; disposable debug package: `com.utshab.momentum.qa`.
- Release signing configuration: `android/signing.properties`, deliberately ignored by Git.
- Run `npm run typecheck`, `npm test`, and Android instrumentation tests on a disposable emulator.
- Browser UI fixtures belong under ignored `artifacts/` and must never be copied into release assets.
- Public and private backups must both be tested; document what passed and what remains unverified.

## Latest checkpoint — 2026-10-08

- Signed artifact: `artifacts/Momentum-2.1.0.apk`, with adjacent SHA-256 file (ignored locally). Version 2.1.0 / code 5, same production certificate, no INTERNET permission.
- Browser fixture verified previous-day private records survive reopening, encrypted export omits plaintext and PIN wrapper, the simulated picker locks the workspace, and recovery resets the PIN while preserving records. Export was captured at the simulated native bridge; this does not verify Android file writing.
- Final backup import, idle/background behavior, and physical-device picker/screenshot checks remain open. No phone was connected.
- Session stopped after the account usage reading jumped from 9% to 53%, exceeding the requested additional budget between readings. No GitHub release was published.
