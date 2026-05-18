import { useEffect, useMemo, useState } from 'react';
import HandMatrix from '@/components/HandMatrix';
import CardPair from '@/components/CardPair';
import PositionTable from '@/components/PositionTable';
import NeighborHands from '@/components/NeighborHands';
import { spotById, AVAILABLE_SPOT_IDS } from '@/domain/spots';
import { loadRange } from '@/data/rangeLoader';
import {
  ALL_HANDS,
  CORRECT_FREQUENCY_THRESHOLD,
  type Action,
  type Range,
} from '@/domain/poker';
import { categorize } from '@/domain/handCategory';
import { cardId, priorityScore, useProgress, type CardState, type AttemptLog } from '@/store/progress';

interface Question {
  spotId: string;
  hand: string;
}

type FilterMode = 'all' | 'new' | 'weak' | 'recent-miss';

const FILTER_LABEL: Record<FilterMode, string> = {
  all: '全て',
  new: '未学習',
  weak: '苦手(Box1-2)',
  'recent-miss': '直近ミス',
};

function weightedPick<T>(items: { item: T; weight: number }[]): T | undefined {
  if (items.length === 0) return undefined;
  const total = items.reduce((a, b) => a + b.weight, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)].item;
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

function pickQuestion(
  cards: Record<string, CardState>,
  recent: AttemptLog[],
  filterMode: FilterMode,
  spotIdOverride: string | undefined,
  prev?: Question,
): Question {
  const spotPool = spotIdOverride ? [spotIdOverride] : AVAILABLE_SPOT_IDS;
  const now = Date.now();

  // 直近ミスはセットで管理
  const recentMissIds = new Set(
    recent.filter((r) => !r.correct).slice(0, 50).map((r) => r.cardId),
  );

  const candidates: { item: Question; weight: number }[] = [];
  for (const spotId of spotPool) {
    for (const hand of ALL_HANDS) {
      if (prev && prev.spotId === spotId && prev.hand === hand) continue;
      const id = cardId(spotId, hand);
      const cs = cards[id];

      // フィルタ適用
      if (filterMode === 'new' && cs) continue;
      if (filterMode === 'weak' && (!cs || cs.box > 2)) continue;
      if (filterMode === 'recent-miss' && !recentMissIds.has(id)) continue;

      const w = priorityScore(cs, now);
      candidates.push({ item: { spotId, hand }, weight: Math.max(1, w) });
    }
  }

  // フィルタで0件になったらフォールバック
  if (candidates.length === 0) {
    return pickQuestion(cards, recent, 'all', spotIdOverride, prev);
  }
  return weightedPick(candidates)!;
}

const ACTION_LABEL: Record<Action, string> = {
  open: 'Open',
  raise: 'Raise',
  '3bet': '3-Bet',
  '4bet': '4-Bet',
  call: 'Call',
  fold: 'Fold',
};

const ACTION_COLOR: Record<Action, string> = {
  open: '#f43f5e',
  raise: '#f43f5e',
  '3bet': '#f59e0b',
  '4bet': '#b91c1c',
  call: '#10b981',
  fold: '#64748b',
};

const ACTION_BTN_CLASS: Record<Action, string> = {
  open: 'bg-rose-600 active:bg-rose-700',
  raise: 'bg-rose-600 active:bg-rose-700',
  '3bet': 'bg-amber-500 active:bg-amber-600',
  '4bet': 'bg-red-700 active:bg-red-800',
  call: 'bg-emerald-600 active:bg-emerald-700',
  fold: 'bg-slate-600 active:bg-slate-700',
};

export default function DrillPage() {
  const cards = useProgress((s) => s.cards);
  const recent = useProgress((s) => s.recent);
  const totals = useProgress((s) => s.totals);
  const recordAttempt = useProgress((s) => s.recordAttempt);

  const [spotFilter, setSpotFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [question, setQuestion] = useState<Question>(() =>
    pickQuestion(cards, recent, 'all', undefined),
  );
  const [range, setRange] = useState<Range | undefined>();
  const [answered, setAnswered] = useState<Action | undefined>();
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [showMatrix, setShowMatrix] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const spot = useMemo(() => spotById(question.spotId)!, [question.spotId]);
  const id = cardId(question.spotId, question.hand);
  const cardState = cards[id];

  useEffect(() => {
    setRange(undefined);
    setAnswered(undefined);
    setShowMatrix(false);
    setShowHint(false);
    loadRange(question.spotId).then(setRange);
  }, [question.spotId, question.hand]);

  const strategy = range?.[question.hand];
  const correctActions = useMemo(() => {
    if (!strategy) return new Set<Action>();
    return new Set(
      (Object.entries(strategy) as [Action, number][])
        .filter(([, f]) => (f ?? 0) >= CORRECT_FREQUENCY_THRESHOLD)
        .map(([a]) => a),
    );
  }, [strategy]);

  function answer(action: Action) {
    if (answered || !strategy) return;
    const isCorrect = correctActions.has(action);
    setAnswered(action);
    setSessionStats((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));
    recordAttempt({
      cardId: id,
      spotId: question.spotId,
      hand: question.hand,
      chosen: action,
      correct: isCorrect,
      at: Date.now(),
      hero: spot.hero,
    });
  }

  function next() {
    const s = useProgress.getState();
    setQuestion((q) =>
      pickQuestion(s.cards, s.recent, filterMode, spotFilter === 'all' ? undefined : spotFilter, q),
    );
  }

  function resetWithSpot(value: string) {
    setSpotFilter(value);
    const s = useProgress.getState();
    setQuestion(
      pickQuestion(s.cards, s.recent, filterMode, value === 'all' ? undefined : value),
    );
  }

  function setMode(mode: FilterMode) {
    setFilterMode(mode);
    const s = useProgress.getState();
    setQuestion(
      pickQuestion(s.cards, s.recent, mode, spotFilter === 'all' ? undefined : spotFilter),
    );
  }

  const isCorrect = answered ? correctActions.has(answered) : undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-3 sm:space-y-5">
      {/* 上部: フィルタとスコア */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(FILTER_LABEL) as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                filterMode === m
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
            >
              {FILTER_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <select
            value={spotFilter}
            onChange={(e) => resetWithSpot(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm flex-1 min-w-0 max-w-[200px]"
          >
            <option value="all">全スポット</option>
            {AVAILABLE_SPOT_IDS.map((sid) => (
              <option key={sid} value={sid}>
                {sid}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <div>
              <span className="text-slate-400">今回</span>{' '}
              <span className="font-mono">
                {sessionStats.correct}/{sessionStats.total}
              </span>
            </div>
            <div>
              <span className="text-slate-400">通算</span>{' '}
              <span className="font-mono">
                {totals.correct}/{totals.total}
                {totals.total > 0 && (
                  <span className="text-slate-400 ml-1">
                    ({Math.round((totals.correct / totals.total) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* シチュエーション＋ハンド */}
      <div className="bg-slate-800/50 rounded-lg p-3 sm:p-6 border border-slate-700">
        <div className="grid grid-cols-[auto_1fr] sm:grid-cols-2 gap-3 sm:gap-6 items-center">
          <div className="flex flex-col items-center gap-1.5">
            <PositionTable
              hero={spot.hero}
              villain={spot.villain}
              villainLabel={spot.villainLabel ?? (spot.scenario === 'vs3bet' ? '3BET' : 'RAISE')}
              heroPrevLabel={spot.heroPrevAction === 'open' ? 'RAISED' : undefined}
              compact
            />
            <div className="text-[10px] sm:text-xs text-slate-400 text-center max-w-[180px] leading-tight">
              {spot.description}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-slate-400">あなたのハンド</div>
            <CardPair handCode={question.hand} />
            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
              <span>{question.hand}</span>
              {cardState && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">
                  Box {cardState.box}
                </span>
              )}
            </div>
            {!answered && (
              <button
                onClick={() => setShowHint((v) => !v)}
                className="text-[11px] text-sky-400 active:text-sky-300 underline"
              >
                {showHint ? 'ヒントを隠す' : 'ヒントを見る 💡'}
              </button>
            )}
            {showHint && !answered && <HandHint hand={question.hand} />}
          </div>
        </div>
      </div>

      {/* アクションボタン: 個数に応じて列数を調整（2/3/4対応） */}
      <div className={`grid gap-2 ${actionGridClass(spot.actions.length)}`}>
        {spot.actions.map((a) => {
          const isCorrectChoice = answered && correctActions.has(a);
          const isUserChoice = answered === a;
          const isWrongUserChoice = isUserChoice && !correctActions.has(a);
          return (
            <button
              key={a}
              disabled={!!answered}
              onClick={() => answer(a)}
              className={`py-3.5 sm:py-3 rounded-lg font-bold text-white text-base transition-all active:scale-[0.98] ${
                answered
                  ? isCorrectChoice
                    ? 'bg-emerald-600 ring-2 ring-emerald-300'
                    : isWrongUserChoice
                    ? 'bg-rose-700 ring-2 ring-rose-400'
                    : 'bg-slate-700 opacity-50'
                  : ACTION_BTN_CLASS[a]
              }`}
            >
              {ACTION_LABEL[a]}
            </button>
          );
        })}
      </div>

      {/* 結果 */}
      {answered && strategy && (
        <div
          className={`rounded-lg p-3 sm:p-4 border-2 ${
            isCorrect ? 'border-emerald-500 bg-emerald-950/30' : 'border-rose-500 bg-rose-950/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className={`text-lg sm:text-xl font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isCorrect ? '✓ 正解' : '✗ 不正解'}
            </div>
            <button
              onClick={next}
              className="px-4 py-2 bg-sky-600 active:bg-sky-700 rounded font-bold text-sm"
            >
              次へ →
            </button>
          </div>
          <div className="text-xs text-slate-300 mb-1.5">GTO推奨頻度</div>
          <div className="space-y-1.5">
            {(Object.entries(strategy) as [Action, number][])
              .filter(([, f]) => (f ?? 0) > 0.001)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .map(([action, freq]) => (
                <FrequencyBar key={action} action={action} freq={freq} />
              ))}
          </div>
          {range && (
            <button
              onClick={() => setShowMatrix((v) => !v)}
              className="mt-3 text-xs text-sky-400 active:text-sky-300"
            >
              {showMatrix ? 'レンジを隠す' : 'レンジ全体を表示 ▼'}
            </button>
          )}
        </div>
      )}

      {/* 不正解時は隣接ハンド比較を自動表示 */}
      {answered && range && isCorrect === false && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
          <NeighborHands range={range} hand={question.hand} />
        </div>
      )}

      {answered && range && showMatrix && (
        <div>
          <div className="text-xs text-slate-400 mb-2">
            レンジ全体（このハンドは黄色で強調）
          </div>
          <HandMatrix range={range} highlight={question.hand} />
        </div>
      )}
    </div>
  );
}

// アクション数に応じたグリッド列数。Tailwindのpurgeに静的に拾われる必要があるため
// 動的文字列ではなく完全形のクラスを返す。
function actionGridClass(n: number): string {
  if (n <= 2) return 'grid-cols-2';
  if (n === 3) return 'grid-cols-3';
  if (n === 4) return 'grid-cols-2 sm:grid-cols-4';
  return 'grid-cols-3'; // 5以上はフォールバック（現状想定なし）
}

function HandHint({ hand }: { hand: string }) {
  const cat = categorize(hand);
  return (
    <div className="mt-1 text-[11px] text-slate-300 bg-slate-900/60 border border-slate-700 rounded px-2 py-1.5 max-w-[220px] text-center">
      <div className="font-bold text-sky-300">{cat.label}</div>
      {cat.tags.length > 0 && (
        <div className="text-[10px] text-slate-400 mt-0.5">
          {cat.tags.map((t) => `#${t}`).join(' ')}
        </div>
      )}
    </div>
  );
}

function FrequencyBar({ action, freq }: { action: Action; freq: number }) {
  const pct = (freq * 100).toFixed(0);
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="w-14 sm:w-24 text-xs sm:text-sm font-mono">{ACTION_LABEL[action]}</span>
      <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: ACTION_COLOR[action] }}
        />
      </div>
      <span className="w-10 sm:w-12 text-right text-xs sm:text-sm font-mono">{pct}%</span>
    </div>
  );
}
