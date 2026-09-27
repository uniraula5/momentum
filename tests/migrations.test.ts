import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitial, streaks } from '../src/lib/tracker';
import { refreshStarterLabels } from '../src/lib/migrations';

test('starter label migration preserves IDs, history, schedules and streaks', () => {
  const old = createInitial('2026-09-21');
  old.habits[0].id = 'ai';
  old.habits[0].name = 'AI & deep learning';
  old.habits.find(h => h.id === 'build')!.description = 'Move an AI or software portfolio project forward. Save what you shipped.';
  old.entries.ai = { '2026-09-21': { value: 60, note: 'Chapter finished', rest: false } };
  const before = structuredClone(old);
  const migrated = refreshStarterLabels(old);
  assert.equal(migrated.habits[0].name, 'Computer science study');
  assert.equal(migrated.habits[0].id, 'ai');
  assert.equal(migrated.habits.find(h => h.id === 'build')!.description, 'Move a software portfolio project forward. Save what you shipped.');
  assert.deepEqual(migrated.entries, before.entries);
  assert.deepEqual(migrated.habits[0].plans, before.habits[0].plans);
  assert.deepEqual(streaks(migrated, migrated.habits[0], '2026-09-21'), streaks(before, before.habits[0], '2026-09-21'));
  assert.deepEqual(old, before);
  assert.equal(refreshStarterLabels(migrated), migrated);
});

test('custom labels and new installations are left unchanged', () => {
  const state = createInitial('2026-09-21');
  assert.equal(refreshStarterLabels(state), state);
  state.habits[0].id = 'ai';
  state.habits[0].name = 'Algorithms practice';
  state.habits.find(h => h.id === 'build')!.description = 'My personal project';
  assert.equal(refreshStarterLabels(state), state);
});
