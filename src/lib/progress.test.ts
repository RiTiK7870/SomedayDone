import { calcProgress } from './progress';

describe('calcProgress', () => {
  it('returns null percent for a goal with no steps', () => {
    expect(calcProgress([])).toEqual({ percent: null, done: 0, total: 0 });
  });

  it('rounds to a whole percent', () => {
    const steps = [{ is_completed: true }, { is_completed: false }, { is_completed: false }];
    expect(calcProgress(steps).percent).toBe(33);
  });

  it('reaches 100 when every step is done', () => {
    const steps = [{ is_completed: true }, { is_completed: true }];
    expect(calcProgress(steps).percent).toBe(100);
  });

  it('drops back when a completed step is reopened', () => {
    const steps = [{ is_completed: true }, { is_completed: false }];
    expect(calcProgress(steps).percent).toBe(50);
  });
});
