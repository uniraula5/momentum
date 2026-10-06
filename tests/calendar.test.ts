import test from 'node:test';
import assert from 'node:assert/strict';
import { activityDayStatus, canGoToNextWeek, nextWeekDate } from '../src/lib/calendar';
import { createInitial, shiftDay, weekStart } from '../src/lib/tracker';

test('a past Sunday can return to the current Tuesday without selecting a future date', () => {
  assert.equal(canGoToNextWeek('2026-10-04', '2026-10-06'), true);
  assert.equal(nextWeekDate('2026-10-04', '2026-10-06'), '2026-10-06');
  assert.equal(canGoToNextWeek('2026-10-06', '2026-10-06'), false);
});
test('every weekday in the previous week can reach the current week for every current weekday', () => {
  for (let day = 0; day < 7; day++) {
    const today = shiftDay('2026-10-05', day);
    for (let previous = 0; previous < 7; previous++) {
      const selected = shiftDay('2026-09-28', previous);
      assert.ok(canGoToNextWeek(selected, today));
      const next = nextWeekDate(selected, today);
      assert.equal(weekStart(next), weekStart(today));
      assert.ok(next <= today);
      assert.equal(canGoToNextWeek(next, today), false);
    }
  }
});
test('week navigation preserves earlier weekdays and crosses year boundaries', () => {
  assert.equal(nextWeekDate('2026-09-21', '2026-10-06'), '2026-09-28');
  assert.equal(nextWeekDate('2025-12-28', '2026-01-01'), '2026-01-01');
});
test('each calendar is isolated from other activities, including newly created activities', () => {
  const state = createInitial('2026-09-21');
  const habit = state.habits[0], other = state.habits[1];
  const date = '2026-09-22', today = '2026-10-06';
  const initial = activityDayStatus(state, habit, date, today);
  state.entries[other.id] = { [date]: { value: 999, note: '', rest: false } };
  assert.equal(activityDayStatus(state, habit, date, today), initial);
  state.entries[habit.id] = { [date]: { value: 60, note: '', rest: false } };
  assert.equal(activityDayStatus(state, habit, date, today), 'complete');
  const custom = { ...habit, id: 'custom', name: 'New practice', created: today };
  state.habits.push(custom);
  assert.equal(activityDayStatus(state, custom, today, today), 'empty');
  assert.equal(activityDayStatus(state, custom, date, today), 'unavailable');
});
test('calendar statuses distinguish partial, rest, missed, off, future and archived dates', () => {
  const state = createInitial('2026-09-21'), habit = state.habits[0], today = '2026-10-06';
  state.entries[habit.id] = {
    '2026-09-21': { value: 30, note: '', rest: false },
    '2026-09-22': { value: 0, note: '', rest: true },
  };
  assert.equal(activityDayStatus(state, habit, '2026-09-21', today), 'partial');
  assert.equal(activityDayStatus(state, habit, '2026-09-22', today), 'recovery');
  assert.equal(activityDayStatus(state, habit, '2026-09-23', today), 'missed');
  assert.equal(activityDayStatus(state, habit, '2026-09-26', today), 'off');
  assert.equal(activityDayStatus(state, habit, '2026-10-07', today), 'unavailable');
  habit.archived = '2026-10-01';
  assert.equal(activityDayStatus(state, habit, '2026-10-01', today), 'unavailable');
  assert.equal(activityDayStatus(state, habit, '2026-09-21', today), 'partial');
});
