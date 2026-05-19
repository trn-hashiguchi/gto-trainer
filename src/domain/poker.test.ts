import { describe, it, expect } from 'vitest';
import {
  gradeChoice,
  estimateEvLoss,
  mainAction,
  type HandStrategy,
  type EvHints,
} from './poker';

describe('gradeChoice', () => {
  it('returns optimal for a pure strategy', () => {
    const strat: HandStrategy = { open: 1.0 };
    const r = gradeChoice(strat, 'open', 'AKs');
    expect(r.grade).toBe('optimal');
    expect(r.evLoss).toBe(0);
  });

  it('returns optimal for the highest-freq action in a mix even at 51%', () => {
    const strat: HandStrategy = { open: 0.51, fold: 0.49 };
    expect(gradeChoice(strat, 'open', 'A5s').grade).toBe('optimal');
  });

  it('returns optimal for all branches of a balanced four-way mix', () => {
    // 25/25/25/25: ratio = 1.0 ≥ 0.75 and freq ≥ 0.10 → optimal for every action
    const strat: HandStrategy = { open: 0.25, call: 0.25, '3bet': 0.25, fold: 0.25 };
    expect(gradeChoice(strat, 'open', 'AJs').grade).toBe('optimal');
    expect(gradeChoice(strat, '3bet', 'AJs').grade).toBe('optimal');
  });

  it('returns optimal for a low-peak action that still dominates its mix', () => {
    // Peak は 40% でも topFreq の 1.0倍なので主戦略扱い
    const strat: HandStrategy = { open: 0.4, call: 0.35, fold: 0.25 };
    expect(gradeChoice(strat, 'open', 'KTs').grade).toBe('optimal');
  });

  it('drops below optimal when freq < OPTIMAL_TOP_RATIO * topFreq', () => {
    // call=0.20 / open=0.80 → ratio 0.25 < 0.75 → acceptable
    const strat: HandStrategy = { open: 0.8, call: 0.2 };
    expect(gradeChoice(strat, 'call', 'A4s').grade).toBe('acceptable');
  });

  it('keeps freq < OPTIMAL_MIN_FREQ out of optimal even when ratio passes', () => {
    // chosen 0.08 / top 0.08 (ratio=1.0) だが MIN_FREQ=0.10 を下回るので optimal にしない
    const strat: HandStrategy = { open: 0.08, fold: 0.92 };
    expect(gradeChoice(strat, 'open', '85s').grade).toBe('acceptable');
  });

  it('returns minor when freq is 0 and evLoss < 0.10bb', () => {
    const strat: HandStrategy = { open: 1.0 };
    const hints: EvHints = { defaultMistakeLoss: { fold: 0.07 } };
    const r = gradeChoice(strat, 'fold', '76s', hints);
    expect(r.grade).toBe('minor');
    expect(r.evLoss).toBe(0.07);
  });

  it('returns major when freq is 0 and evLoss >= 0.10bb', () => {
    const strat: HandStrategy = { open: 1.0 };
    const hints: EvHints = { defaultMistakeLoss: { fold: 0.20 } };
    const r = gradeChoice(strat, 'fold', '76s', hints);
    expect(r.grade).toBe('major');
    expect(r.evLoss).toBe(0.20);
  });

  it('returns minor for tail mix (0 < freq < 5%) where evLoss is 0', () => {
    const strat: HandStrategy = { open: 0.04, fold: 0.96 };
    const r = gradeChoice(strat, 'open', '74s');
    expect(r.grade).toBe('minor');
    expect(r.evLoss).toBe(0);
  });

  it('uses evOverrides for the specific hand-action over defaults', () => {
    const strat: HandStrategy = { open: 1.0 };
    const hints: EvHints = {
      defaultMistakeLoss: { fold: 0.10 },
      evOverrides: { AA: { fold: 5.0 } },
    };
    const r = gradeChoice(strat, 'fold', 'AA', hints);
    expect(r.evLoss).toBe(5.0);
    expect(r.grade).toBe('major');
  });

  it('returns evLoss=0 when freq > 0 even if override is set (mixed actions are EV-equal)', () => {
    const strat: HandStrategy = { open: 0.5, fold: 0.5 };
    const hints: EvHints = { evOverrides: { AA: { fold: 5.0 } } };
    const r = gradeChoice(strat, 'fold', 'AA', hints);
    expect(r.evLoss).toBe(0);
    expect(r.grade).toBe('optimal'); // top-tied
  });

  it('falls back to 0.15bb when no hint is provided for freq=0', () => {
    const strat: HandStrategy = { open: 1.0 };
    expect(gradeChoice(strat, 'fold', 'AA').evLoss).toBe(0.15);
  });
});

describe('estimateEvLoss', () => {
  it('returns 0 for any freq > 0', () => {
    expect(estimateEvLoss({ open: 0.01 }, 'open', 'A2o')).toBe(0);
    expect(estimateEvLoss({ open: 0.99 }, 'open', 'A2o')).toBe(0);
  });
  it('returns override for freq=0 actions', () => {
    expect(
      estimateEvLoss({ open: 1 }, 'fold', 'AA', { evOverrides: { AA: { fold: 3.0 } } }),
    ).toBe(3.0);
  });
});

describe('mainAction', () => {
  it('returns the highest-freq action', () => {
    expect(mainAction({ open: 0.6, fold: 0.4 })).toBe('open');
    expect(mainAction({ fold: 0.6, open: 0.4 })).toBe('fold');
  });
  it('returns undefined for empty strategy', () => {
    expect(mainAction({})).toBeUndefined();
    expect(mainAction(undefined)).toBeUndefined();
  });
});
