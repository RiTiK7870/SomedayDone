import type { Goal } from '../types';

export interface WeekBucket {
  label: string; // e.g. "17 Nov", the Monday that starts the week
  count: number;
  isCurrent: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Steps completed per week for the last `weeks` weeks. Weeks start on Monday.
export function weeklyStepCounts(goals: Goal[], weeks = 8, now = new Date()): WeekBucket[] {
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));

  const starts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() - i * 7);
    starts.push(d);
  }

  const counts = new Array<number>(weeks).fill(0);
  const firstStart = starts[0].getTime();

  for (const goal of goals) {
    for (const step of goal.goal_steps) {
      if (!step.is_completed || !step.completed_at) continue;
      const t = new Date(step.completed_at).getTime();
      if (t < firstStart) continue;
      // Find the last week that started on or before this completion.
      for (let i = weeks - 1; i >= 0; i--) {
        if (t >= starts[i].getTime()) {
          counts[i]++;
          break;
        }
      }
    }
  }

  return starts.map((d, i) => ({
    label: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
    count: counts[i],
    isCurrent: i === weeks - 1,
  }));
}
