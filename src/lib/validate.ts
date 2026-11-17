export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function validateGoal(input: { title: string; description: string; targetDate: string }): string | null {
  const title = input.title.trim();
  if (!title) return 'Give your goal a title.';
  if (title.length > 120) return 'Keep the title under 120 characters.';
  if (input.description.length > 1000) return 'Keep the description under 1000 characters.';
  if (input.targetDate && !isValidDate(input.targetDate)) return 'Use the date format YYYY-MM-DD.';
  return null;
}

export function validateStepTitle(s: string): string | null {
  const t = s.trim();
  if (!t) return 'Write a step first.';
  if (t.length > 200) return 'Keep steps under 200 characters.';
  return null;
}
