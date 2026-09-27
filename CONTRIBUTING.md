# Contributing

Keep changes focused on the offline tracker. Preserve the existing visual design, historical records, backup compatibility, and package identity.

- Place domain calculations in `src/lib`, platform calls in `src/platform`, and Android integration code in `android`.
- Validate imported and persisted documents; never reset data after a failed read.
- Add meaningful tests for changed streak, date, migration, or persistence behavior.
- Run `npm run typecheck`, `npm test`, and `npm run build` before opening a change.
- Run Android lint/build after native changes. Verify actual device behavior for navigation, keyboard, and file-picker changes.
- Keep private records, signing keys, passwords, machine paths, and generated build directories out of Git.
- Describe the behavioral change and relevant validation in commit messages and pull requests.

Third-party license and copyright notices must remain intact.
