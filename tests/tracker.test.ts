import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitial,
  streaks,
  stats,
  planAt,
  completed,
  scheduled,
  weekStart,
  shiftDay,
  dateKey,
  type State,
} from "../src/lib/tracker";
import { stateSchema } from "../src/lib/validation";
const fixture = () => {
  const s = createInitial("2026-09-21");
  s.habits = [s.habits[0]];
  return s;
};
const add = (s: State, d: string, value = 60, rest = false) => {
  s.entries.study ??= {};
  s.entries.study[d] = { value, note: "", rest };
};
test("today stays open; a missed previous scheduled day resets current but keeps longest", () => {
  const s = fixture();
  for (const d of ["2026-09-21", "2026-09-22"]) add(s, d);
  assert.deepEqual(streaks(s, s.habits[0], "2026-09-23"), {
    current: 2,
    best: 2,
  });
  assert.deepEqual(streaks(s, s.habits[0], "2026-09-24"), {
    current: 0,
    best: 2,
  });
});
test("weekend does not break a weekday streak or count as extra scheduled completions", () => {
  const s = fixture();
  for (const d of [
    "2026-09-21",
    "2026-09-22",
    "2026-09-23",
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
  ])
    add(s, d);
  assert.deepEqual(streaks(s, s.habits[0], "2026-09-28"), {
    current: 5,
    best: 5,
  });
  assert.equal(stats(s, s.habits, "2026-09-21", "2026-09-27").done, 5);
});
test("explicit recovery pauses the streak and is excluded from rate", () => {
  const s = fixture();
  add(s, "2026-09-21");
  add(s, "2026-09-22", 0, true);
  add(s, "2026-09-23");
  assert.deepEqual(streaks(s, s.habits[0], "2026-09-23"), {
    current: 2,
    best: 2,
  });
  assert.deepEqual(stats(s, s.habits, "2026-09-21", "2026-09-23"), {
    due: 2,
    done: 2,
    minutes: 120,
    rest: 1,
    percent: 100,
  });
});
test("partial progress does not complete the target or keep a closed day alive", () => {
  const s = fixture();
  add(s, "2026-09-21");
  add(s, "2026-09-22", 30);
  assert.equal(completed(s, s.habits[0], "2026-09-22"), false);
  assert.equal(streaks(s, s.habits[0], "2026-09-23").current, 0);
  assert.equal(stats(s, s.habits, "2026-09-21", "2026-09-22").minutes, 90);
});
test("schedule and target changes preserve prior history", () => {
  const s = fixture(),
    h = s.habits[0];
  h.plans.push({
    from: "2026-09-24",
    days: [1, 2, 3, 4, 5],
    target: 90,
    unit: "min",
  });
  add(s, "2026-09-21");
  add(s, "2026-09-22");
  add(s, "2026-09-23");
  add(s, "2026-09-24", 60);
  assert.equal(planAt(h, "2026-09-23").target, 60);
  assert.equal(streaks(s, h, "2026-09-24").current, 3);
  assert.equal(completed(s, h, "2026-09-24"), false);
});
test("archive excludes future scheduled opportunities and preserves best", () => {
  const s = fixture(),
    h = s.habits[0];
  add(s, "2026-09-21");
  h.archived = "2026-09-22";
  assert.equal(scheduled(h, "2026-09-23"), false);
  assert.equal(stats(s, s.habits, "2026-09-21", "2026-09-25").due, 1);
  assert.deepEqual(streaks(s, h, "2026-09-25"), { current: 1, best: 1 });
});
test("creation date prevents pre-habit missed days", () => {
  const s = fixture();
  assert.equal(scheduled(s.habits[0], "2026-09-18"), false);
  assert.equal(stats(s, s.habits, "2026-09-01", "2026-09-21").due, 1);
});
test("calendar arithmetic handles DST, leap days, and year boundaries", () => {
  assert.equal(shiftDay("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2026-03-08", 1), "2026-03-09");
  assert.equal(weekStart("2026-09-27"), "2026-09-21");
  assert.equal(weekStart("2026-09-28"), "2026-09-28");
});
test("timezone has a real local date boundary", () => {
  assert.equal(
    dateKey(new Date("2026-09-27T05:59:00Z"), "America/Denver"),
    "2026-09-26",
  );
  assert.equal(
    dateKey(new Date("2026-09-27T06:01:00Z"), "America/Denver"),
    "2026-09-27",
  );
});
test("fresh account has no fabricated history or goal progress", () => {
  const s = createInitial("2026-09-21");
  assert.deepEqual(s.entries, {});
  assert.ok(s.goals.every((g) => g.current === 0));
  assert.ok(stateSchema.safeParse(s).success);
});
test("backup validation rejects duplicate IDs, impossible dates, and unsafe values", () => {
  const s = fixture();
  s.habits.push(s.habits[0]);
  assert.equal(stateSchema.safeParse(s).success, false);
  const t = fixture();
  add(t, "2026-02-30");
  assert.equal(stateSchema.safeParse(t).success, false);
  const u = fixture();
  add(u, "2026-09-21", -1);
  assert.equal(stateSchema.safeParse(u).success, false);
});
test("backup validation rejects future logs and malformed recovery", () => {
  const s = fixture();
  add(s, "2099-01-01");
  assert.equal(stateSchema.safeParse(s).success, false);
  const t = fixture();
  add(t, "2026-09-21", 60, true);
  assert.equal(stateSchema.safeParse(t).success, false);
});
