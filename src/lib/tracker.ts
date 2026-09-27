export type Category = "Learning" | "Career" | "Training" | "Wellbeing";
export type Plan = {
  from: string;
  days: number[];
  target: number;
  unit: string;
};
export type Habit = {
  id: string;
  name: string;
  category: Category;
  description: string;
  created: string;
  archived: string | null;
  plans: Plan[];
};
export type Entry = { value: number; note: string; rest: boolean };
export type Goal = {
  id: string;
  name: string;
  category: Category;
  target: number;
  current: number;
  unit: string;
  due: string;
};
export type Review = {
  win: string;
  friction: string;
  next: string;
  energy: number;
};
export type State = {
  version: 1;
  name: string;
  timezone: string;
  habits: Habit[];
  entries: Record<string, Record<string, Entry>>;
  goals: Goal[];
  reviews: Record<string, Review>;
};
export const categories: Category[] = [
  "Learning",
  "Career",
  "Training",
  "Wellbeing",
];
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dateKey = (d = new Date(), timezone = "America/Denver") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export const parseDay = (s: string) => new Date(s + "T12:00:00Z");
export const shiftDay = (s: string, n: number) => {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekStart = (s: string) =>
  shiftDay(s, -(parseDay(s).getUTCDay() + 6) % 7);
export const dateLabel = (
  s: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) => parseDay(s).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
export function dateRange(from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) days.push(d);
  return days;
}
export const planAt = (h: Habit, d: string) =>
  [...h.plans].reverse().find((p) => p.from <= d) ?? h.plans[0];
export const activeOn = (h: Habit, d: string) =>
  d >= h.created && (!h.archived || d < h.archived);
export const scheduled = (h: Habit, d: string) =>
  activeOn(h, d) && planAt(h, d).days.includes(parseDay(d).getUTCDay());
export const entryAt = (s: State, h: Habit, d: string) => s.entries[h.id]?.[d];
export const completed = (s: State, h: Habit, d: string) => {
  const e = entryAt(s, h, d);
  return !!e && !e.rest && e.value >= planAt(h, d).target;
};
export function streaks(s: State, h: Habit, today: string) {
  let run = 0,
    best = 0;
  for (const d of dateRange(h.created, today)) {
    if (!scheduled(h, d) || entryAt(s, h, d)?.rest) continue;
    if (completed(s, h, d)) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) run = 0;
  }
  return { current: run, best };
}
export function stats(s: State, habits: Habit[], from: string, to: string) {
  let due = 0,
    done = 0,
    minutes = 0,
    rest = 0;
  for (const d of dateRange(from, to))
    for (const h of habits) {
      const e = entryAt(s, h, d);
      if (e && !e.rest && planAt(h, d).unit === "min") minutes += e.value;
      if (!scheduled(h, d)) continue;
      if (e?.rest) {
        rest++;
        continue;
      }
      due++;
      if (completed(s, h, d)) done++;
    }
  return {
    due,
    done,
    minutes,
    rest,
    percent: due ? Math.round((done / due) * 100) : 0,
  };
}
export function createInitial(today: string): State {
  const all = [0, 1, 2, 3, 4, 5, 6];
  const make = (
    id: string,
    name: string,
    category: Category,
    description: string,
    days: number[],
    target: number,
    unit = "min",
  ): Habit => ({
    id,
    name,
    category,
    description,
    created: today,
    archived: null,
    plans: [{ from: today, days, target, unit }],
  });
  return {
    version: 1,
    name: "Utshab",
    timezone: "America/Denver",
    entries: {},
    reviews: {},
    habits: [
      make(
        "study",
        "Computer science study",
        "Learning",
        "Study, implement, and explain one concept in your own words.",
        [1, 2, 3, 4, 5],
        60,
      ),
      make(
        "build",
        "Build something real",
        "Learning",
        "Move a software portfolio project forward. Save what you shipped.",
        [1, 3, 5, 6],
        45,
      ),
      make(
        "dsa",
        "Interview practice",
        "Career",
        "Solve a problem, review the approach, or rehearse an interview answer.",
        [1, 2, 4, 5],
        30,
      ),
      make(
        "career",
        "Internship pipeline",
        "Career",
        "One tailored application, recruiter follow-up, or useful connection.",
        [1, 3, 5],
        1,
        "action",
      ),
      make(
        "gym",
        "Strength & conditioning",
        "Training",
        "Follow your current training plan; use recovery days whenever needed.",
        [1, 2, 3, 4, 5, 6],
        1,
        "session",
      ),
      make(
        "swim",
        "Swimming technique",
        "Training",
        "Log the stroke, drill, or water skill you practiced.",
        [2, 6],
        1,
        "session",
      ),
      make(
        "skills",
        "Calisthenics practice",
        "Training",
        "Track quality practice for handstands, levers, or your chosen skill.",
        [1, 3, 5],
        1,
        "session",
      ),
      make(
        "mobility",
        "Mobility & flexibility",
        "Wellbeing",
        "Make room for controlled movement and your personal mobility routine.",
        all,
        10,
      ),
      make(
        "meditate",
        "Meditation",
        "Wellbeing",
        "A quiet, intentional pause. Breath, body scan, or your preferred practice.",
        all,
        10,
      ),
      make(
        "recovery",
        "Recovery check-in",
        "Wellbeing",
        "Notice sleep, energy, and how you feel. Adjust your day accordingly.",
        all,
        1,
        "check-in",
      ),
    ],
    goals: [
      {
        id: "portfolio",
        name: "Ship portfolio projects",
        category: "Career",
        current: 0,
        target: 3,
        unit: "projects",
        due: "2027-05-01",
      },
      {
        id: "applications",
        name: "Tailored applications",
        category: "Career",
        current: 0,
        target: 50,
        unit: "applications",
        due: "2027-05-01",
      },
      {
        id: "network",
        name: "Career conversations",
        category: "Career",
        current: 0,
        target: 12,
        unit: "conversations",
        due: "2027-05-01",
      },
      {
        id: "handstand",
        name: "Freestanding handstand",
        category: "Training",
        current: 0,
        target: 15,
        unit: "seconds",
        due: "",
      },
      {
        id: "swimskill",
        name: "Swimming skills learned",
        category: "Training",
        current: 0,
        target: 4,
        unit: "skills",
        due: "",
      },
    ],
  };
}
