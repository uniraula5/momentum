import { activeOn, completed, entryAt, scheduled, shiftDay, weekStart, type Habit, type State } from './tracker';

// A past week's later weekday must still be able to return to the current week.
export const canGoToNextWeek = (selected: string, today: string) => weekStart(selected) < weekStart(today);
export function nextWeekDate(selected: string, today: string) {
  const next = shiftDay(selected, 7);
  return next > today ? today : next;
}

export type CalendarStatus = 'complete' | 'partial' | 'recovery' | 'missed' | 'empty' | 'off' | 'unavailable';
export function activityDayStatus(state: State, habit: Habit, date: string, today: string): CalendarStatus {
  if (date > today || !activeOn(habit, date)) return 'unavailable';
  const entry = entryAt(state, habit, date);
  if (entry?.rest) return 'recovery';
  if (completed(state, habit, date)) return 'complete';
  if (entry && entry.value > 0) return 'partial';
  if (!scheduled(habit, date)) return 'off';
  return date < today ? 'missed' : 'empty';
}
export const calendarStatusLabels: Record<CalendarStatus, string> = {
  complete: 'Completed', partial: 'Partial progress', recovery: 'Recovery',
  missed: 'Missed target', empty: 'No check-in yet', off: 'Not scheduled', unavailable: 'Unavailable',
};
