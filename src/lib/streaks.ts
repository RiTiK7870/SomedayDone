import type { Goal } from '../types';

// Local midnight for a date, as a timestamp. Used as a day key.
function dayOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// The day before a day key. Uses calendar arithmetic so daylight saving changes don't skew it.
function previousDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime();
}

function completedDays(goals: Goal[]): Set<number> {
  const days = new Set<number>();
  for (const g of goals) {
    for (const s of g.goal_steps) {
      if (s.is_completed && s.completed_at) days.add(dayOf(new Date(s.completed_at)));
    }
  }
  return days;
}

// Days in a row, ending today or yesterday, with at least one completed step.
export function currentStreak(goals: Goal[], now = new Date()): number {
  const days = completedDays(goals);
  let cursor = dayOf(now);
  if (!days.has(cursor)) cursor = previousDay(cursor);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}

// The longest run of consecutive days ever.
export function longestStreak(goals: Goal[]): number {
  const sorted = [...completedDays(goals)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const t of sorted) {
    run = prev !== null && previousDay(t) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}
