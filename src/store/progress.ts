import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Action } from '@/domain/poker';

// Leitner: box 1〜5。正解で次の箱、不正解で1へ。
// 「次に出題するべき」優先度を計算するために dueAt を持つ。
export interface CardState {
  box: 1 | 2 | 3 | 4 | 5;
  dueAt: number;       // epoch ms。これ以下なら出題対象
  lastReview: number;  // epoch ms
  attempts: number;
  correct: number;
}

// 箱別の復習間隔（ms）。即/1日/3日/7日/14日
const BOX_INTERVAL_MS: Record<CardState['box'], number> = {
  1: 0,
  2: 24 * 60 * 60 * 1000,
  3: 3 * 24 * 60 * 60 * 1000,
  4: 7 * 24 * 60 * 60 * 1000,
  5: 14 * 24 * 60 * 60 * 1000,
};

export interface AttemptLog {
  cardId: string;
  spotId: string;
  hand: string;
  chosen: Action;
  correct: boolean;
  at: number;
}

export interface ProgressState {
  cards: Record<string, CardState>;
  recent: AttemptLog[]; // 直近の試行（最大200件）
  totals: { correct: number; total: number };
  byPosition: Record<string, { correct: number; total: number }>;
  bySpot: Record<string, { correct: number; total: number }>;
  recordAttempt: (a: AttemptLog & { hero: string }) => void;
  reset: () => void;
}

export function cardId(spotId: string, hand: string): string {
  return `${spotId}::${hand}`;
}

export function isDue(card: CardState | undefined, now = Date.now()): boolean {
  if (!card) return true; // 未学習は常に出題対象
  return card.dueAt <= now;
}

export function priorityScore(card: CardState | undefined, now = Date.now()): number {
  // 未学習は高優先、box低・期限超過大ほど高優先
  if (!card) return 1_000_000;
  const overdue = Math.max(0, now - card.dueAt);
  return overdue / (1000 * 60) + (6 - card.box) * 1000;
}

function nextState(prev: CardState | undefined, correct: boolean, now = Date.now()): CardState {
  const box = (correct
    ? Math.min(5, (prev?.box ?? 1) + 1)
    : 1) as CardState['box'];
  return {
    box,
    dueAt: now + BOX_INTERVAL_MS[box],
    lastReview: now,
    attempts: (prev?.attempts ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
  };
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      cards: {},
      recent: [],
      totals: { correct: 0, total: 0 },
      byPosition: {},
      bySpot: {},
      recordAttempt: ({ cardId: id, spotId, hand, chosen, correct, at, hero }) =>
        set((s) => {
          const next = nextState(s.cards[id], correct, at);
          const recent = [{ cardId: id, spotId, hand, chosen, correct, at }, ...s.recent].slice(0, 200);
          const totals = {
            correct: s.totals.correct + (correct ? 1 : 0),
            total: s.totals.total + 1,
          };
          const pos = s.byPosition[hero] ?? { correct: 0, total: 0 };
          const sp = s.bySpot[spotId] ?? { correct: 0, total: 0 };
          return {
            cards: { ...s.cards, [id]: next },
            recent,
            totals,
            byPosition: {
              ...s.byPosition,
              [hero]: { correct: pos.correct + (correct ? 1 : 0), total: pos.total + 1 },
            },
            bySpot: {
              ...s.bySpot,
              [spotId]: { correct: sp.correct + (correct ? 1 : 0), total: sp.total + 1 },
            },
          };
        }),
      reset: () =>
        set({ cards: {}, recent: [], totals: { correct: 0, total: 0 }, byPosition: {}, bySpot: {} }),
    }),
    { name: 'poker-gto-v1' },
  ),
);
