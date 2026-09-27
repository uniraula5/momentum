# Development

## Requirements

- Node.js 22.13+ and npm.
- Java 21 with `JAVA_HOME` configured.
- Android SDK platform 36 and build-tools 36.0.0.
- A USB-debugging-authorized Android device or emulator for device tests.

Install Android tooling through Android Studio or the official command-line tools. Set `ANDROID_HOME` or create ignored `android/local.properties` with `sdk.dir=/absolute/path/to/android-sdk`.

```bash
npm ci
npm run typecheck
npm test
npm run android:debug
```

The Gradle wrapper is included. `npm run build` compiles the interface into the ignored `android/app/src/main/assets/` directory. The interface needs the Android storage bridge; opening its HTML directly in a browser is not the supported application runtime.

## Install a debug build

Debug builds use package `com.utshab.momentum.qa`, visibly named **Momentum QA**, and have independent records.

```bash
adb devices
adb -s DEVICE_SERIAL install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Open Momentum QA on the device. Use `-s` when more than one device is connected. Remove the QA app when testing is complete; do not use it for daily records.

## Release signing

Release builds require an ignored `android/signing.properties`:

```properties
storeFile=/absolute/path/outside/repository/momentum-release.jks
storePassword=YOUR_LOCAL_PASSWORD
keyAlias=momentum
keyPassword=YOUR_LOCAL_PASSWORD
```

Keep the key and passwords outside Git. The optional `android/scripts/prepare-signing.py` creates a private key once under the current user's `.local/share/momentum/android-signing` directory. It refuses to replace an existing key. For an existing installation, reuse its original key; do not generate a new one.

```bash
npm run android:release
```

The script type-checks, tests, bundles, runs Android lint, and builds the signed APK. Deliverables appear in ignored `artifacts/`, with a SHA-256 checksum. A valid local signing configuration is mandatory.

Package versions in `package.json` and `android/app/build.gradle` must match. Increment Android `versionCode` for every released update. Verify the APK with the SDK's `apksigner` before uploading it to a GitHub release. Never include the signing configuration or key in release assets.

## Device tests

The instrumentation suite only accesses the QA package. It deletes and recreates that package's test database, so use disposable QA records.

```bash
npm run build
cd android
./gradlew connectedDebugAndroidTest
```

See [Testing](TESTING.md) for manual checks. CI builds the QA APK but does not install it on a personal phone.

## Release checklist

1. Update the package version, Android version code/name, and changelog.
2. Run the release build and device checks.
3. Verify signing certificate and absence of internet permission.
4. Tag the checked commit and attach the APK and checksum to its GitHub release.
5. Install with `adb install -r` to preserve existing records.
