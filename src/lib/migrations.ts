import type { State } from './tracker';

/** Update original starter labels without changing IDs, logs, schedules or custom names. */
export function refreshStarterLabels(state: State): State {
  let changed = false;
  const habits = state.habits.map(habit => {
    let name = habit.name, description = habit.description;
    if (habit.id === 'ai' && name === 'AI & deep learning') name = 'Computer science study';
    if (habit.id === 'build' && description === 'Move an AI or software portfolio project forward. Save what you shipped.')
      description = 'Move a software portfolio project forward. Save what you shipped.';
    if (name === habit.name && description === habit.description) return habit;
    changed = true;
    return { ...habit, name, description };
  });
  return changed ? { ...state, habits } : state;
}
