import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Action, Grade, HandCode, HandStrategy, Range } from '@/domain/poker';
import { ALL_HANDS, RANKS, mainAction } from '@/domain/poker';

// SM-2 ベース SRS。Leitner からの移行理由: ミックス末端の小ミスと premium 大ミスを
// 区別できるよう EV損ベースの quality を扱う必要がある。

export interface CardState {
  ef: number;
  interval: number;
  rep: number;
  dueAt: number;
  lastReview: number;
  attempts: number;
  correct: number;
}

export interface AttemptLog {
  cardId: string;
  spotId: string;
  hand: string;
  chosen: Action;
  grade: Grade;
  evLoss: number;
  at: number;
}

export interface ProgressState {
  cards: Record<string, CardState>;
  recent: AttemptLog[];
  totals: { correct: number; total: number; evLoss: number };
  byPosition: Record<string, { correct: number; total: number; evLoss: number }>;
  bySpot: Record<string, { correct: number; total: number; evLoss: number }>;
  streak: { current: number; best: number };
  dailyGoal: number;
  daily: { date: string; count: number; correct: number };
  recordAttempt: (a: AttemptLog & { hero: string; range?: Range }) => void;
  reset: () => void;
  setDailyGoal: (n: number) => void;
  exportJSON: () => string;
  importJSON: (json: string) => { ok: true } | { ok: false; error: string };
}

export function cardId(spotId: string, hand: string): string {
  return `${spotId}::${hand}`;
}

// 未学習扱い: カードが無い、または attempts === 0（隣接伝播で生成された pseudo カード含む）
function isUnlearned(card: CardState | undefined): boolean {
  return !card || card.attempts === 0;
}

// 出題優先度。未学習を最優先、次に期限超過分、最後に EF/rep ペナルティ。
export function priorityScore(card: CardState | undefined, now = Date.now()): number {
  if (isUnlearned(card)) return 1_000_000;
  const c = card!;
  const overdueMin = Math.max(0, (now - c.dueAt) / 60_000);
  const easePenalty = Math.max(0, (2.5 - c.ef) * 10_000);
  const repPenalty = Math.max(0, (5 - c.rep) * 200);
  return overdueMin + easePenalty + repPenalty;
}

function gradeToQuality(grade: Grade): number {
  switch (grade) {
    case 'optimal': return 5;
    case 'acceptable': return 4;
    case 'minor': return 2;
    case 'major': return 1;
  }
}

const MS_PER_DAY = 86_400_000;

function defaultCard(): CardState {
  return { ef: 2.5, interval: 0, rep: 0, dueAt: 0, lastReview: 0, attempts: 0, correct: 0 };
}

// 直接試行による更新。weight は常に 1。
function sm2Update(prev: CardState | undefined, quality: number, now: number): CardState {
  const base = prev ?? defaultCard();
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const newEf = Math.max(1.3, base.ef + efDelta);

  let rep: number;
  let interval: number;
  if (quality < 3) {
    rep = 0;
    interval = 1;
  } else {
    rep = base.rep + 1;
    if (rep === 1) interval = 1;
    else if (rep === 2) interval = 6;
    else interval = Math.round(base.interval * newEf);
  }

  return {
    ef: newEf,
    interval,
    rep,
    lastReview: now,
    dueAt: now + interval * MS_PER_DAY,
    attempts: base.attempts + 1,
    correct: base.correct + (quality >= 4 ? 1 : 0),
  };
}

// 隣接伝播用の弱更新。既存カード（attempts > 0）のみ対象。
// EF を量 0.3 で動かし、interval は短縮側にのみ働く。rep/attempts/correct は触らない。
function sm2Propagate(prev: CardState, quality: number): CardState {
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const newEf = Math.max(1.3, prev.ef + efDelta * 0.3);
  // 失敗の伝播は interval を縮める方向に。成功時は据え置き。
  const interval = quality < 3
    ? Math.max(1, Math.round(prev.interval * 0.7))
    : prev.interval;
  const dueAt = quality < 3
    ? Math.min(prev.dueAt, prev.lastReview + interval * MS_PER_DAY)
    : prev.dueAt;
  return { ...prev, ef: newEf, interval, dueAt };
}

const RANK_INDEX: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i]));

function handMatrixPos(hand: HandCode): { row: number; col: number } | undefined {
  if (hand.length === 2) {
    const i = RANK_INDEX[hand[0]];
    return i === undefined ? undefined : { row: i, col: i };
  }
  if (hand.length === 3) {
    const hi = RANK_INDEX[hand[0]];
    const lo = RANK_INDEX[hand[1]];
    if (hi === undefined || lo === undefined) return undefined;
    if (hand[2] === 's') return { row: hi, col: lo };
    if (hand[2] === 'o') return { row: lo, col: hi };
  }
  return undefined;
}

export function neighborHands(hand: HandCode): HandCode[] {
  const pos = handMatrixPos(hand);
  if (!pos) return [];
  const result: HandCode[] = [];
  const cands = [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ];
  for (const { row, col } of cands) {
    if (row < 0 || row > 12 || col < 0 || col > 12) continue;
    const r = RANKS[Math.min(row, col)];
    const c = RANKS[Math.max(row, col)];
    if (row === col) result.push(`${r}${r}`);
    else if (row < col) result.push(`${r}${c}s`);
    else result.push(`${r}${c}o`);
  }
  return result;
}

export function similarNeighbors(hand: HandCode, range: Range | undefined): HandCode[] {
  if (!range) return [];
  const own = mainAction(range[hand]);
  if (!own) return [];
  return neighborHands(hand).filter((n) => mainAction(range[n]) === own);
}

function todayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}`;
}

// v1 → v2 migration
// v1 schema: { cards: { id: { box, dueAt, lastReview, attempts, correct } }, recent: { ..., correct: boolean }, totals: {correct,total}, byPosition/bySpot: {correct,total} }
function migrateLegacy(persisted: unknown): Partial<ProgressState> {
  if (!persisted || typeof persisted !== 'object') return {};
  const p = persisted as Record<string, any>;

  const cards: Record<string, CardState> = {};
  for (const [id, c] of Object.entries(p.cards ?? {}) as [string, any][]) {
    if (!c || typeof c !== 'object') continue;
    if (typeof c.ef === 'number') {
      cards[id] = c as CardState;
    } else if (typeof c.box === 'number') {
      const box: number = c.box;
      const ef = 2.0 + (box - 1) * 0.15;
      const interval = [0, 1, 3, 7, 14][Math.max(0, Math.min(4, box - 1))];
      cards[id] = {
        ef,
        interval,
        rep: Math.max(0, box - 1),
        dueAt: c.dueAt ?? 0,
        lastReview: c.lastReview ?? 0,
        attempts: c.attempts ?? 0,
        correct: c.correct ?? 0,
      };
    }
  }

  // recent: correct(bool) → grade に変換（正解→acceptable、誤答→major）
  const recent: AttemptLog[] = [];
  for (const r of (p.recent ?? []) as any[]) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.grade === 'string') {
      recent.push(r as AttemptLog);
    } else if (typeof r.correct === 'boolean') {
      recent.push({
        cardId: r.cardId,
        spotId: r.spotId,
        hand: r.hand,
        chosen: r.chosen,
        grade: r.correct ? 'acceptable' : 'major',
        evLoss: 0,
        at: r.at,
      });
    }
  }

  // totals/byPosition/bySpot: evLoss を補完
  function liftStats<T extends { correct: number; total: number }>(
    s: T | undefined,
  ): { correct: number; total: number; evLoss: number } {
    if (!s) return { correct: 0, total: 0, evLoss: 0 };
    return { correct: s.correct, total: s.total, evLoss: (s as any).evLoss ?? 0 };
  }
  const totals = liftStats(p.totals);
  const byPosition: Record<string, { correct: number; total: number; evLoss: number }> = {};
  for (const [k, v] of Object.entries(p.byPosition ?? {}) as [string, any][]) byPosition[k] = liftStats(v);
  const bySpot: Record<string, { correct: number; total: number; evLoss: number }> = {};
  for (const [k, v] of Object.entries(p.bySpot ?? {}) as [string, any][]) bySpot[k] = liftStats(v);

  return {
    cards,
    recent,
    totals,
    byPosition,
    bySpot,
    streak: p.streak ?? { current: 0, best: 0 },
    dailyGoal: p.dailyGoal ?? 30,
    daily: p.daily ?? { date: todayKey(), count: 0, correct: 0 },
  };
}

// ===== import バリデーション =====
function isCardState(c: unknown): c is CardState {
  if (!c || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  return (
    typeof x.ef === 'number' &&
    typeof x.interval === 'number' &&
    typeof x.rep === 'number' &&
    typeof x.dueAt === 'number' &&
    typeof x.lastReview === 'number' &&
    typeof x.attempts === 'number' &&
    typeof x.correct === 'number'
  );
}

function isAttemptLog(r: unknown): r is AttemptLog {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.cardId === 'string' &&
    typeof x.spotId === 'string' &&
    typeof x.hand === 'string' &&
    typeof x.chosen === 'string' &&
    typeof x.grade === 'string' &&
    typeof x.evLoss === 'number' &&
    typeof x.at === 'number'
  );
}

function isStatBucket(b: unknown): b is { correct: number; total: number; evLoss: number } {
  if (!b || typeof b !== 'object') return false;
  const x = b as Record<string, unknown>;
  return typeof x.correct === 'number' && typeof x.total === 'number' && typeof x.evLoss === 'number';
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      cards: {},
      recent: [],
      totals: { correct: 0, total: 0, evLoss: 0 },
      byPosition: {},
      bySpot: {},
      streak: { current: 0, best: 0 },
      dailyGoal: 30,
      daily: { date: todayKey(), count: 0, correct: 0 },
      recordAttempt: ({ cardId: id, spotId, hand, chosen, grade, evLoss, at, hero, range }) =>
        set((s) => {
          const quality = gradeToQuality(grade);
          const isCorrect = grade === 'optimal' || grade === 'acceptable';

          const updatedCards = { ...s.cards };
          updatedCards[id] = sm2Update(s.cards[id], quality, at);

          // 隣接ハンドへ伝播。既存カード (attempts > 0) のみ対象。
          const propTargets = similarNeighbors(hand, range);
          for (const nb of propTargets) {
            const nid = cardId(spotId, nb);
            const target = s.cards[nid];
            if (target && target.attempts > 0) {
              updatedCards[nid] = sm2Propagate(target, quality);
            }
          }

          const recent = [
            { cardId: id, spotId, hand, chosen, grade, evLoss, at },
            ...s.recent,
          ].slice(0, 200);
          const totals = {
            correct: s.totals.correct + (isCorrect ? 1 : 0),
            total: s.totals.total + 1,
            evLoss: s.totals.evLoss + evLoss,
          };
          const pos = s.byPosition[hero] ?? { correct: 0, total: 0, evLoss: 0 };
          const sp = s.bySpot[spotId] ?? { correct: 0, total: 0, evLoss: 0 };

          const streakNext = isCorrect
            ? { current: s.streak.current + 1, best: Math.max(s.streak.best, s.streak.current + 1) }
            : { current: 0, best: s.streak.best };

          const tk = todayKey(at);
          const daily = s.daily.date === tk
            ? { date: tk, count: s.daily.count + 1, correct: s.daily.correct + (isCorrect ? 1 : 0) }
            : { date: tk, count: 1, correct: isCorrect ? 1 : 0 };

          return {
            cards: updatedCards,
            recent,
            totals,
            byPosition: {
              ...s.byPosition,
              [hero]: {
                correct: pos.correct + (isCorrect ? 1 : 0),
                total: pos.total + 1,
                evLoss: pos.evLoss + evLoss,
              },
            },
            bySpot: {
              ...s.bySpot,
              [spotId]: {
                correct: sp.correct + (isCorrect ? 1 : 0),
                total: sp.total + 1,
                evLoss: sp.evLoss + evLoss,
              },
            },
            streak: streakNext,
            daily,
          };
        }),
      reset: () =>
        set({
          cards: {},
          recent: [],
          totals: { correct: 0, total: 0, evLoss: 0 },
          byPosition: {},
          bySpot: {},
          streak: { current: 0, best: 0 },
          daily: { date: todayKey(), count: 0, correct: 0 },
        }),
      setDailyGoal: (n) => set({ dailyGoal: Math.max(1, Math.min(500, Math.floor(n))) }),
      exportJSON: () => {
        const s = get();
        const payload = {
          version: 2,
          exportedAt: new Date().toISOString(),
          cards: s.cards,
          totals: s.totals,
          byPosition: s.byPosition,
          bySpot: s.bySpot,
          streak: s.streak,
          dailyGoal: s.dailyGoal,
          daily: s.daily,
          recent: s.recent,
        };
        return JSON.stringify(payload, null, 2);
      },
      importJSON: (json) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch (e) {
          return { ok: false, error: 'JSON パースエラー: ' + String(e) };
        }
        if (!parsed || typeof parsed !== 'object') {
          return { ok: false, error: '不正な形式（オブジェクトではない）' };
        }
        const p = parsed as Record<string, unknown>;

        const cards: Record<string, CardState> = {};
        if (p.cards && typeof p.cards === 'object') {
          for (const [id, c] of Object.entries(p.cards)) {
            if (isCardState(c)) cards[id] = c;
          }
        }

        const recent: AttemptLog[] = [];
        if (Array.isArray(p.recent)) {
          for (const r of p.recent) if (isAttemptLog(r)) recent.push(r);
        }

        const totals = isStatBucket(p.totals)
          ? p.totals
          : { correct: 0, total: 0, evLoss: 0 };

        const byPosition: Record<string, { correct: number; total: number; evLoss: number }> = {};
        if (p.byPosition && typeof p.byPosition === 'object') {
          for (const [k, v] of Object.entries(p.byPosition)) {
            if (isStatBucket(v)) byPosition[k] = v;
          }
        }

        const bySpot: Record<string, { correct: number; total: number; evLoss: number }> = {};
        if (p.bySpot && typeof p.bySpot === 'object') {
          for (const [k, v] of Object.entries(p.bySpot)) {
            if (isStatBucket(v)) bySpot[k] = v;
          }
        }

        const streak =
          p.streak &&
          typeof p.streak === 'object' &&
          typeof (p.streak as any).current === 'number' &&
          typeof (p.streak as any).best === 'number'
            ? (p.streak as { current: number; best: number })
            : { current: 0, best: 0 };

        const dailyGoal = typeof p.dailyGoal === 'number' ? Math.max(1, Math.min(500, p.dailyGoal)) : 30;

        const daily =
          p.daily &&
          typeof p.daily === 'object' &&
          typeof (p.daily as any).date === 'string' &&
          typeof (p.daily as any).count === 'number' &&
          typeof (p.daily as any).correct === 'number'
            ? (p.daily as { date: string; count: number; correct: number })
            : { date: todayKey(), count: 0, correct: 0 };

        set({ cards, recent, totals, byPosition, bySpot, streak, dailyGoal, daily });
        return { ok: true };
      },
    }),
    {
      // name は v1 のまま維持し、version 2 で migrate を走らせる。
      name: 'poker-gto-v1',
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          return { ...(persisted as object), ...migrateLegacy(persisted) } as ProgressState;
        }
        return persisted as ProgressState;
      },
    },
  ),
);

export function allCardIds(spotIds: string[]): string[] {
  const out: string[] = [];
  for (const s of spotIds) for (const h of ALL_HANDS) out.push(cardId(s, h));
  return out;
}

// Re-export for ergonomics (used by external test files)
export type { HandStrategy };
