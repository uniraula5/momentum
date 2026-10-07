# Private habits: storage and security

## Boundaries

The public tracker and the private workspace never share a habit document. The public component unmounts when private access opens; locking unmounts the private workspace and drops its session and form state. No private notes or drafts are written to WebView local storage. Public exports read only the public database row.

A public-to-private move validates both resulting documents and commits them in one SQLite transaction with revision checks on both rows. Database version 2 adds private-record and unlock-attempt tables without changing the version-1 public row. Secure deletion is enabled for SQLite's active database; this is not a guarantee of forensic erasure from flash storage or old backups.

## Encryption

- Random 256-bit data key; AES-256-GCM with a fresh 96-bit IV for every payload save.
- Six-digit PIN wraps the data key using PBKDF2-HMAC-SHA256 with a random 128-bit salt and 600,000 iterations.
- A separate random 256-bit recovery code wraps the same data key with an independent salt.
- Additional authenticated data binds each encrypted value to its vault ID and purpose.
- The persisted envelope receives another AES-GCM encryption layer using a nonexportable Android Keystore key.
- Portable private backups contain the encrypted payload and recovery wrapper, **never the PIN wrapper**. They require the high-entropy recovery code and do not depend on the original phone.

WebCrypto data keys are nonextractable after import, and temporary raw key arrays are zeroed. JavaScript strings, plaintext objects, and garbage-collected memory cannot be guaranteed securely erased. Encryption protects stored records; an unlocked app necessarily holds plaintext in memory.

## Access and locking

The bundled UI verifies the PIN cryptographically. Native code reserves each unlock attempt before returning an envelope, persists attempt counts, and applies delays after five failures (30 seconds, doubling up to 30 minutes). A successful verified unlock resets the counter. The trusted local UI acknowledges a native attempt token only after decryption succeeds.

Leaving the Activity invalidates native authorization immediately, hides the WebView, and dispatches a lock. Resuming dispatches another lock before making the WebView visible. Two-minute inactivity and the Lock button clear the UI session and native authorization. Async work checks a lock generation before it can commit or reveal decrypted records. An encrypted file selection can survive the picker lifecycle without retaining decrypted state.

Private screens use Android FLAG_SECURE to restrict screenshots and recent-app previews. Release builds disable WebView debugging, accept only bundled content, and have no internet permission.

## Limits

This is local privacy protection, not a defense against a rooted device, compromised OS, injected trusted-app code, malicious keyboards, or someone using an already unlocked private area. Native authorization relies on the integrity of the bundled interface. The native wrapper key is not PIN-authenticated by Android itself. App-local attempt delays rely on device time and intact app storage.

A discreet entry point does not conceal that the application supports private habits. Ciphertext size and the existence of a private database row are not hidden. Public text manually describing a private habit, older exports, and external copies are not retroactively redacted.

There is no server, recovery service, analytics, or automatic cloud backup. Keep the recovery code and an encrypted export outside the app. Loss of both access codes or loss of the device key without an export can make private records unrecoverable.
