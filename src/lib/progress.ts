// Progress = completed steps / total steps, rounded to a whole percent.
// Zero steps returns percent = null so the UI shows a prompt instead of a misleading 0%.
export function calcProgress(steps: { is_completed: boolean }[]): {
  percent: number | null;
  done: number;
  total: number;
} {
  const total = steps.length;
  const done = steps.filter((s) => s.is_completed).length;
  if (total === 0) return { percent: null, done, total };
  return { percent: Math.round((done / total) * 100), done, total };
}
