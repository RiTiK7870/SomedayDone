import { isValidDate, isValidTime, validateGoal } from './validate';

describe('validation', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('26-1-1')).toBe(false);
  });

  it('accepts 24-hour times only', () => {
    expect(isValidTime('08:05')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
  });

  it('requires a title', () => {
    expect(validateGoal({ title: '   ', description: '', targetDate: '' })).not.toBeNull();
  });
});
