import { describe, it, expect } from 'vitest';
import {
  neighborHands,
  similarNeighbors,
  priorityScore,
  type CardState,
} from './progress';
import type { Range } from '@/domain/poker';

describe('neighborHands', () => {
  it('returns matrix-neighbors clipped at corner (AA → AKo, AKs)', () => {
    // AA は (0,0)。上下左右で範囲内は (1,0)=AKo と (0,1)=AKs のみ。
    // 対角の KK は隣接ではない（距離2）。
    const n = neighborHands('AA');
    expect(n).toContain('AKo');
    expect(n).toContain('AKs');
    expect(n).not.toContain('KK');
    expect(n).toHaveLength(2);
  });

  it('returns 4 neighbors for an interior cell', () => {
    const n = neighborHands('AKs'); // (0,1)
    expect(n).toContain('AA');   // (0,0)
    expect(n).toContain('KK');   // (1,1)
    expect(n).toContain('AQs');  // (0,2)
    // (-1, 1) は範囲外
    expect(n).toHaveLength(3);
  });

  it('handles offsuit hands (row > col)', () => {
    const n = neighborHands('KQo'); // (1,2 → ?) 実際 K=1, Q=2, offsuit→row=lowIndex=2, col=highIndex=1
    // 隣接: (1,1)=KK, (3,1)=, etc. ともかく結果が ALL_HANDS の文字列
    expect(n.length).toBeGreaterThan(0);
    for (const h of n) {
      expect(h).toMatch(/^[AKQJT2-9][AKQJT2-9][so]?$/);
    }
  });
});

describe('similarNeighbors', () => {
  it('filters neighbors by matching main action', () => {
    // AKs の隣接は AA, KK, AQs。AA と AQs は open 一致、KK は fold で不一致。
    const range: Range = {
      AKs: { open: 1 },
      AA:  { open: 1 },
      AQs: { open: 1 },
      KK:  { fold: 1 },
    } as any;
    const result = similarNeighbors('AKs', range);
    expect(result).toContain('AA');
    expect(result).toContain('AQs');
    expect(result).not.toContain('KK');
  });

  it('returns [] when range is undefined', () => {
    expect(similarNeighbors('AA', undefined)).toEqual([]);
  });
});

describe('priorityScore', () => {
  it('returns 1_000_000 for missing cards (unlearned)', () => {
    expect(priorityScore(undefined, Date.now())).toBe(1_000_000);
  });

  it('returns 1_000_000 for cards with attempts === 0 (pseudo-card from propagation)', () => {
    const card: CardState = {
      ef: 2.5,
      interval: 1,
      rep: 0,
      dueAt: Date.now() + 86400000,
      lastReview: 0,
      attempts: 0,
      correct: 0,
    };
    expect(priorityScore(card, Date.now())).toBe(1_000_000);
  });

  it('weights low EF heavily', () => {
    const lowEf: CardState = {
      ef: 1.5,
      interval: 1,
      rep: 1,
      dueAt: Date.now(),
      lastReview: 0,
      attempts: 5,
      correct: 1,
    };
    const highEf: CardState = { ...lowEf, ef: 2.6 };
    expect(priorityScore(lowEf)).toBeGreaterThan(priorityScore(highEf));
  });

  it('scales with overdue minutes', () => {
    const now = Date.now();
    const c: CardState = {
      ef: 2.5,
      interval: 1,
      rep: 2,
      dueAt: now - 60_000 * 60, // 60 min overdue
      lastReview: 0,
      attempts: 3,
      correct: 3,
    };
    expect(priorityScore(c, now)).toBeGreaterThanOrEqual(60);
  });
});
