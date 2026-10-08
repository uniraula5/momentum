import test from 'node:test';
import assert from 'node:assert/strict';
import { createVault, unlockVault, encryptPrivateState, changePin, exportPrivateBackup, restorePrivateBackup, emptyPrivateState, moveToPrivate, backupSchema } from '../src/lib/vault';
import { createInitial, streaks, type State } from '../src/lib/tracker';

const publicFixture = () => createInitial('2026-09-21');
const secretState = () => { const state = publicFixture(); return { ...state, habits: [state.habits[0]], goals: [], reviews: {}, entries: { study: { '2026-09-21': { value: 60, note: 'Private session note', rest: false } } } }; };
test('vault authenticates PIN, encrypts names and notes, and uses a nonexportable session key', async () => {
  const state = secretState(), { session, recoveryCode } = await createVault('135790', state);
  const stored = JSON.stringify(session.envelope);
  assert.ok(!stored.includes(state.habits[0].name)); assert.ok(!stored.includes('Private session note')); assert.ok(!stored.includes('135790')); assert.ok(!stored.includes(recoveryCode));
  assert.deepEqual((await unlockVault(session.envelope, '135790')).state, state);
  await assert.rejects(unlockVault(session.envelope, '000000'), /Incorrect code/);
  await assert.rejects(crypto.subtle.exportKey('raw', session.key));
});
test('private backups omit PIN material and require the recovery code', async () => {
  const { session, recoveryCode } = await createVault('135790', secretState());
  const backup = exportPrivateBackup(session.envelope);
  assert.equal('pin' in backup, false);
  assert.ok(backupSchema.safeParse(backup).success);
  const restored = await restorePrivateBackup(backup, recoveryCode, '246802');
  assert.deepEqual(restored.state, session.state);
  assert.deepEqual((await unlockVault(restored.envelope, '246802')).state, session.state);
  await assert.rejects(unlockVault(restored.envelope, '135790'));
  await assert.rejects(restorePrivateBackup(backup, 'A'.repeat(64), '246802'));
});
test('recovery resets the PIN without changing history or invalidating the recovery code', async () => {
  const { session, recoveryCode } = await createVault('135790', secretState());
  const changed = await changePin(session.envelope, recoveryCode, '246802', true);
  await assert.rejects(unlockVault(changed.envelope, '135790'));
  assert.deepEqual((await unlockVault(changed.envelope, '246802')).state, session.state);
  assert.deepEqual((await unlockVault(changed.envelope, recoveryCode, true)).state, session.state);
});
test('tampering and envelopes copied from another vault fail authentication', async () => {
  const { session } = await createVault('135790', secretState());
  const tampered = structuredClone(session.envelope);
  tampered.payload.data = (tampered.payload.data[0] === 'A' ? 'B' : 'A') + tampered.payload.data.slice(1);
  await assert.rejects(unlockVault(tampered, '135790'));
  const rebound = { ...session.envelope, id: crypto.randomUUID() };
  await assert.rejects(unlockVault(rebound, '135790'));
});
test('saves use fresh IVs and reject invalid private state', async () => {
  const { session } = await createVault('135790', secretState());
  const next = { ...session.state, name: 'Updated' };
  const a = await encryptPrivateState(session, next), b = await encryptPrivateState(session, next);
  assert.notEqual(a.payload.iv, b.payload.iv);
  assert.deepEqual((await unlockVault(a, '135790')).state, next);
  await assert.rejects(encryptPrivateState(session, { ...next, goals: publicFixture().goals }));
});
test('moving a habit removes all public entries and preserves private schedule and streak history', () => {
  const source = secretState(), before = structuredClone(source), destination = emptyPrivateState(source);
  const result = moveToPrivate(source, destination, 'study');
  assert.equal(result.publicState.habits.length, 0); assert.deepEqual(result.publicState.entries, {});
  assert.ok(!JSON.stringify(result.publicState).includes('Private session note'));
  assert.deepEqual(result.privateState.habits, before.habits);
  assert.deepEqual(result.privateState.entries, before.entries);
  assert.deepEqual(streaks(result.privateState, result.privateState.habits[0], '2026-09-21'), streaks(source, source.habits[0], '2026-09-21'));
  assert.deepEqual(source, before);
  assert.throws(() => moveToPrivate(source, result.privateState, 'study'));
});
test('invalid PIN and plain public backups cannot create or replace a vault', async () => {
  await assert.rejects(createVault('123', secretState()), /six-digit/);
  await assert.rejects(restorePrivateBackup(publicFixture(), 'A'.repeat(64), '246802'));
});

test('UTF-8 payload limits reject oversized multibyte histories before saving and preserve the old vault', async () => {
  const state: State = secretState();
  state.habits[0].created = '2024-01-01'; state.habits[0].plans[0].from = '2024-01-01';
  state.entries.study = {};
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10);
    state.entries.study[day] = { value: 60, note: '界'.repeat(2000), rest: false };
  }
  assert.ok(JSON.stringify(state).length < 2_000_000);
  assert.ok(new TextEncoder().encode(JSON.stringify(state)).byteLength > 2_000_000);
  const { session } = await createVault('135790', secretState());
  await assert.rejects(createVault('135790', state), /2 MB/);
  await assert.rejects(encryptPrivateState(session, state), /2 MB/);
  assert.deepEqual((await unlockVault(session.envelope, '135790')).state, session.state);
  for (const day of Object.keys(state.entries.study).slice(300)) delete state.entries.study[day];
  const saved = await encryptPrivateState(session, state);
  assert.deepEqual((await unlockVault(saved, '135790')).state, state);
});
