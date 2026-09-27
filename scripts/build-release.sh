#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f android/signing.properties ]; then
  echo 'Missing android/signing.properties. See docs/DEVELOPMENT.md for release signing.' >&2
  exit 1
fi
npm run typecheck
npm test
npm run build
(cd android && ./gradlew lintRelease assembleRelease)
mkdir -p artifacts
version=$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")
cp android/app/build/outputs/apk/release/app-release.apk "artifacts/Momentum-$version.apk"
node scripts/checksum.mjs "artifacts/Momentum-$version.apk"
