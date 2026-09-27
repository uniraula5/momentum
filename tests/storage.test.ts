import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneStorage } from '../src/platform/storage';
import { createInitial, dateKey } from '../src/lib/tracker';

function bridge(read: () => string, write: (document: string, revision: number) => string) {
  Object.assign(globalThis, { window: { Momentum: { read, write } } });
}
test('first offline launch persists initial state before returning it', async () => {
  let saved = '';
  bridge(() => JSON.stringify({state:null,revision:0}), (document, rev) => {
    assert.equal(rev,0); saved=document; return '{"revision":1}';
  });
  const loaded=await phoneStorage.load();
  assert.equal(loaded.revision,1);
  assert.equal(JSON.parse(saved).habits.length,10);
});
test('invalid stored data fails without overwriting it', async () => {
  let writes=0;
  bridge(() => '{"state":{"version":999},"revision":4}', () => { writes++; return '{}'; });
  await assert.rejects(()=>phoneStorage.load());
  assert.equal(writes,0);
});
test('disk failure is surfaced instead of showing a successful save', async () => {
  bridge(()=>'{}',()=>'{"error":"disk full"}');
  await assert.rejects(()=>phoneStorage.save(createInitial(dateKey()),0), /disk full/);
});
test('invalid imported state is rejected before native persistence', async () => {
  let writes=0;
  bridge(()=>'{}',()=>{writes++;return '{}';});
  await assert.rejects(()=>phoneStorage.save({...createInitial(dateKey()),name:''},0));
  assert.equal(writes,0);
});
test('legacy labels are saved against the existing revision before load completes', async () => {
  const state = createInitial(dateKey());
  state.habits[0].id = 'ai';
  state.habits[0].name = 'AI & deep learning';
  let writes = 0;
  bridge(() => JSON.stringify({ state, revision: 8 }), (document, revision) => {
    writes++;
    assert.equal(revision, 8);
    assert.equal(JSON.parse(document).habits[0].name, 'Computer science study');
    return '{"revision":9}';
  });
  const loaded = await phoneStorage.load();
  assert.equal(loaded.revision, 9);
  assert.equal(writes, 1);
});
test('failed migration save surfaces its error without resetting records', async () => {
  const state = createInitial(dateKey());
  state.habits[0].id = 'ai';
  state.habits[0].name = 'AI & deep learning';
  let writes = 0;
  bridge(() => JSON.stringify({ state, revision: 8 }), (_, revision) => {
    writes++;
    assert.equal(revision, 8);
    return '{"error":"disk full"}';
  });
  await assert.rejects(() => phoneStorage.load(), /disk full/);
  assert.equal(writes, 1);
});
