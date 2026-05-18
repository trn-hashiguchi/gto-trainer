import { useEffect, useMemo, useState } from 'react';
import HandMatrix from '@/components/HandMatrix';
import CardPair from '@/components/CardPair';
import PositionTable from '@/components/PositionTable';
import { spotById } from '@/domain/spots';
import { loadRange } from '@/data/rangeLoader';
import {
  ALL_HANDS,
  CORRECT_FREQUENCY_THRESHOLD,
  type Action,
  type Range,
} from '@/domain/poker';
import { cardId, priorityScore, useProgress, type CardState } from '@/store/progress';

interface Question {
  spotId: string;
  hand: string;
}

const AVAILABLE_SPOT_IDS = [
  'RFI-UTG',
  'RFI-HJ',
  'RFI-CO',
  'RFI-BTN',
  'RFI-SB',
  'vsRFI-BB-BTN',
  'vsRFI-BB-CO',
  'vsRFI-BTN-CO',
];

function weightedPick<T>(items: { item: T; weight: number }[]): T {
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
  prev?: Question,
  spotIdOverride?: string,
): Question {
  const spotPool = spotIdOverride
    ? [spotIdOverride]
    : AVAILABLE_SPOT_IDS;
  const now = Date.now();

  const candidates: { item: Question; weight: number }[] = [];
  for (const spotId of spotPool) {
    for (const hand of ALL_HANDS) {
      if (prev && prev.spotId === spotId && prev.hand === hand) continue;
      const id = cardId(spotId, hand);
      const w = priorityScore(cards[id], now);
      candidates.push({ item: { spotId, hand }, weight: Math.max(1, w) });
    }
  }
  return weightedPick(candidates);
}

const ACTION_LABEL: Record<Action, string> = {
  open: 'Open (Raise)',
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
  open: 'bg-rose-600 hover:bg-rose-500',
  raise: 'bg-rose-600 hover:bg-rose-500',
  '3bet': 'bg-amber-500 hover:bg-amber-400',
  '4bet': 'bg-red-700 hover:bg-red-600',
  call: 'bg-emerald-600 hover:bg-emerald-500',
  fold: 'bg-slate-600 hover:bg-slate-500',
};

export default function DrillPage() {
  const cards = useProgress((s) => s.cards);
  const totals = useProgress((s) => s.totals);
  const recordAttempt = useProgress((s) => s.recordAttempt);

  const [spotFilter, setSpotFilter] = useState<string>('all');
  const [question, setQuestion] = useState<Question>(() =>
    pickQuestion(cards, undefined),
  );
  const [range, setRange] = useState<Range | undefined>();
  const [answered, setAnswered] = useState<Action | undefined>();
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

  const spot = useMemo(() => spotById(question.spotId)!, [question.spotId]);
  const id = cardId(question.spotId, question.hand);
  const cardState = cards[id];

  useEffect(() => {
    setRange(undefined);
    setAnswered(undefined);
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
    setQuestion((q) =>
      pickQuestion(useProgress.getState().cards, q, spotFilter === 'all' ? undefined : spotFilter),
    );
  }

  function resetWithFilter(value: string) {
    setSpotFilter(value);
    setQuestion(pickQuestion(cards, undefined, value === 'all' ? undefined : value));
  }

  const isCorrect = answered ? correctActions.has(answered) : undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">出題:</label>
          <select
            value={spotFilter}
            onChange={(e) => resetWithFilter(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
          >
            <option value="all">全RFI</option>
            {AVAILABLE_SPOT_IDS.map((sid) => (
              <option key={sid} value={sid}>
                {sid}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-slate-400">今回:</span>{' '}
            <span className="font-mono">
              {sessionStats.correct}/{sessionStats.total}
            </span>
          </div>
          <div>
            <span className="text-slate-400">通算:</span>{' '}
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

      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
        <div className="grid sm:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col items-center gap-3">
            <PositionTable hero={spot.hero} villain={spot.villain} />
            <div className="text-xs text-slate-400 text-center">{spot.description}</div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="text-sm text-slate-400">あなたのハンド</div>
            <CardPair handCode={question.hand} size="lg" />
            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
              <span>{question.hand}</span>
              {cardState && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">
                  Box {cardState.box}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-center flex-wrap">
        {spot.actions.map((a) => {
          const isCorrectChoice = answered && correctActions.has(a);
          const isUserChoice = answered === a;
          const isWrongUserChoice = isUserChoice && !correctActions.has(a);
          return (
            <button
              key={a}
              disabled={!!answered}
              onClick={() => answer(a)}
              className={`px-6 py-3 rounded-lg font-bold text-white text-base min-w-[140px] transition-all ${
                answered
                  ? isCorrectChoice
                    ? 'bg-emerald-600 ring-2 ring-emerald-300'
                    : isWrongUserChoice
                    ? 'bg-rose-700 ring-2 ring-rose-400'
                    : 'bg-slate-700 opacity-60'
                  : ACTION_BTN_CLASS[a]
              }`}
            >
              {ACTION_LABEL[a]}
            </button>
          );
        })}
      </div>

      {answered && strategy && (
        <div
          className={`rounded-lg p-4 border-2 ${
            isCorrect ? 'border-emerald-500 bg-emerald-950/30' : 'border-rose-500 bg-rose-950/30'
          }`}
        >
          <div className="flex items-baseline justify-between mb-3">
            <div className={`text-xl font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isCorrect ? '✓ 正解' : '✗ 不正解'}
            </div>
            <button
              onClick={next}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded font-bold text-sm"
            >
              次の問題 →
            </button>
          </div>
          <div className="text-xs text-slate-300 mb-2">GTO推奨頻度</div>
          <div className="space-y-1.5">
            {(Object.entries(strategy) as [Action, number][])
              .filter(([, f]) => (f ?? 0) > 0.001)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .map(([action, freq]) => (
                <FrequencyBar key={action} action={action} freq={freq} />
              ))}
          </div>
        </div>
      )}

      {answered && range && (
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

function FrequencyBar({ action, freq }: { action: Action; freq: number }) {
  const pct = (freq * 100).toFixed(0);
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm font-mono">{ACTION_LABEL[action]}</span>
      <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: ACTION_COLOR[action] }}
        />
      </div>
      <span className="w-12 text-right text-sm font-mono">{pct}%</span>
    </div>
  );
}
