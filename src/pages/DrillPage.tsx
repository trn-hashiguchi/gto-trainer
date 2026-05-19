import { useEffect, useMemo, useState } from 'react';
import HandMatrix from '@/components/HandMatrix';
import CardPair from '@/components/CardPair';
import PositionTable from '@/components/PositionTable';
import NeighborHands from '@/components/NeighborHands';
import { spotById, AVAILABLE_SPOT_IDS } from '@/domain/spots';
import { loadRange, type LoadedRange, type ExploitProfile } from '@/data/rangeLoader';
import {
  ALL_HANDS,
  gradeChoice,
  type Action,
  type Grade,
} from '@/domain/poker';
import { categorize } from '@/domain/handCategory';
import { cardId, priorityScore, useProgress, type CardState, type AttemptLog } from '@/store/progress';

interface Question {
  spotId: string;
  hand: string;
}

type FilterMode = 'all' | 'new' | 'weak' | 'recent-miss';
type ExploitMode = 'gto' | 'vsFish' | 'vsNit' | 'vsAggro';

const EXPLOIT_LABEL: Record<ExploitMode, string> = {
  gto: 'GTO',
  vsFish: 'vs Fish',
  vsNit: 'vs Nit',
  vsAggro: 'vs Aggro',
};

const FILTER_LABEL: Record<FilterMode, string> = {
  all: '全て',
  new: '未学習',
  weak: '苦手',
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

  const recentMissIds = new Set(
    recent.filter((r) => r.grade === 'major' || r.grade === 'minor').slice(0, 50).map((r) => r.cardId),
  );

  const candidates: { item: Question; weight: number }[] = [];
  for (const spotId of spotPool) {
    for (const hand of ALL_HANDS) {
      if (prev && prev.spotId === spotId && prev.hand === hand) continue;
      const id = cardId(spotId, hand);
      const cs = cards[id];

      if (filterMode === 'new' && cs && cs.attempts > 0) continue;
      // 苦手 = EF < 2.0  または  (試行 ≥ 5 かつ 正答率 < 60%)
      // 試行 1 回でも major を引けば EF が 2.0 を下回るため、attempts 下限は設けない。
      if (filterMode === 'weak') {
        if (!cs) continue;
        const acc = cs.attempts > 0 ? cs.correct / cs.attempts : 1;
        const isLowEf = cs.ef < 2.0;
        const isLowAcc = cs.attempts >= 5 && acc < 0.6;
        if (!isLowEf && !isLowAcc) continue;
      }
      if (filterMode === 'recent-miss' && !recentMissIds.has(id)) continue;

      const w = priorityScore(cs, now);
      candidates.push({ item: { spotId, hand }, weight: Math.max(1, w) });
    }
  }

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

const GRADE_META: Record<
  Grade,
  { label: string; color: string; border: string; bg: string; btn: string }
> = {
  optimal:    { label: '✓ 最適',       color: 'text-emerald-300', border: 'border-emerald-500', bg: 'bg-emerald-950/40', btn: 'bg-emerald-600 ring-2 ring-emerald-300' },
  acceptable: { label: '◯ 許容',       color: 'text-sky-300',     border: 'border-sky-500',     bg: 'bg-sky-950/40',     btn: 'bg-sky-600 ring-2 ring-sky-300' },
  minor:      { label: '△ 小ミス',     color: 'text-amber-300',   border: 'border-amber-500',   bg: 'bg-amber-950/40',   btn: 'bg-amber-600 ring-2 ring-amber-300' },
  major:      { label: '✗ 明確なミス', color: 'text-rose-300',    border: 'border-rose-500',    bg: 'bg-rose-950/40',    btn: 'bg-rose-700 ring-2 ring-rose-400' },
};

// 答え合わせ時のボタン色付け。userPicked 行は GRADE_META.btn、
// それ以外は主戦略=緑薄、許容=青薄、それ以外=暗色。
function revealClass(opts: {
  userPicked: boolean;
  grade: Grade;
  freq: number;
}): string {
  if (opts.userPicked) return GRADE_META[opts.grade].btn;
  if (opts.freq >= 0.30) return 'bg-emerald-600/60 ring-1 ring-emerald-400/60';
  if (opts.freq >= 0.05) return 'bg-sky-700/40 ring-1 ring-sky-400/40';
  return 'bg-slate-700 opacity-40';
}

export default function DrillPage() {
  const cards = useProgress((s) => s.cards);
  const recent = useProgress((s) => s.recent);
  const streak = useProgress((s) => s.streak);
  const daily = useProgress((s) => s.daily);
  const dailyGoal = useProgress((s) => s.dailyGoal);
  const recordAttempt = useProgress((s) => s.recordAttempt);

  const [spotFilter, setSpotFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [exploitMode, setExploitMode] = useState<ExploitMode>('gto');
  const [question, setQuestion] = useState<Question>(() =>
    pickQuestion(cards, recent, 'all', undefined),
  );
  const [loaded, setLoaded] = useState<LoadedRange | undefined>();
  const [answered, setAnswered] = useState<{ action: Action; grade: Grade; evLoss: number } | undefined>();
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, evLoss: 0 });
  const [showMatrix, setShowMatrix] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSpotInfo, setShowSpotInfo] = useState(false);

  const spot = useMemo(() => spotById(question.spotId)!, [question.spotId]);
  const id = cardId(question.spotId, question.hand);
  const cardState = cards[id];

  useEffect(() => {
    setLoaded(undefined);
    setAnswered(undefined);
    setShowMatrix(false);
    setShowHint(false);
    loadRange(question.spotId).then(setLoaded);
  }, [question.spotId, question.hand]);

  const range = loaded?.range;
  const strategy = range?.[question.hand];

  function answer(action: Action) {
    if (answered || !strategy || !loaded) return;
    const result = gradeChoice(strategy, action, question.hand, loaded.evHints);
    setAnswered({ action, grade: result.grade, evLoss: result.evLoss });
    const isCorrect = result.grade === 'optimal' || result.grade === 'acceptable';
    setSessionStats((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
      evLoss: s.evLoss + result.evLoss,
    }));
    recordAttempt({
      cardId: id,
      spotId: question.spotId,
      hand: question.hand,
      chosen: action,
      grade: result.grade,
      evLoss: result.evLoss,
      at: Date.now(),
      hero: spot.hero,
      range,
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

  const dailyPct = Math.min(100, Math.round((daily.count / dailyGoal) * 100));

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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500 mr-1">相手:</span>
          {(Object.keys(EXPLOIT_LABEL) as ExploitMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setExploitMode(m)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                exploitMode === m
                  ? 'bg-amber-600 border-amber-400 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
            >
              {EXPLOIT_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <select
            value={spotFilter}
            onChange={(e) => resetWithSpot(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm flex-1 min-w-0 max-w-[220px]"
          >
            <option value="all">全スポット</option>
            {AVAILABLE_SPOT_IDS.map((sid) => (
              <option key={sid} value={sid}>
                {sid}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-[11px] sm:text-xs">
            <Pill label="今回" value={`${sessionStats.correct}/${sessionStats.total}`} />
            <Pill
              label="EV損"
              value={`${(sessionStats.evLoss * 1000).toFixed(0)} mbb`}
              tone="warn"
            />
            <Pill
              label="連続"
              value={`${streak.current}`}
              tone={streak.current >= 5 ? 'good' : undefined}
            />
            <Pill
              label="今日"
              value={`${daily.count}/${dailyGoal}`}
              tone={dailyPct >= 100 ? 'good' : undefined}
            />
          </div>
        </div>
        {/* デイリーゴールのバー */}
        <div className="h-1 bg-slate-800 rounded overflow-hidden">
          <div
            className={`h-full transition-all ${dailyPct >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${dailyPct}%` }}
          />
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
            {loaded?.meta.betSizes && <BetSizesLine sizes={loaded.meta.betSizes} />}
            {(loaded?.meta.longDescription || (loaded?.meta.keyPoints?.length ?? 0) > 0) && (
              <button
                onClick={() => setShowSpotInfo((v) => !v)}
                className="text-[11px] text-sky-400 active:text-sky-300 underline"
              >
                {showSpotInfo ? '解説を隠す' : 'このスポットの解説 ▾'}
              </button>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-slate-400">あなたのハンド</div>
            <CardPair handCode={question.hand} />
            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
              <span>{question.hand}</span>
              {cardState && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">
                  EF {cardState.ef.toFixed(2)}
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
            {showHint && !answered && (
              <HandHint hand={question.hand} note={loaded?.meta.handNotes?.[question.hand]} />
            )}
          </div>
        </div>

        {showSpotInfo && loaded && (
          <div className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-300 space-y-1.5">
            {loaded.meta.longDescription && <p>{loaded.meta.longDescription}</p>}
            {loaded.meta.keyPoints && loaded.meta.keyPoints.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                {loaded.meta.keyPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className={`grid gap-2 ${actionGridClass(spot.actions.length)}`}>
        {spot.actions.map((a) => {
          const isAnswered = !!answered;
          const userPicked = answered?.action === a;
          const freq = strategy?.[a] ?? 0;
          const cls = isAnswered
            ? revealClass({ userPicked, grade: answered.grade, freq })
            : ACTION_BTN_CLASS[a];
          return (
            <button
              key={a}
              disabled={isAnswered}
              onClick={() => answer(a)}
              className={`py-3.5 sm:py-3 rounded-lg font-bold text-white text-base transition-all active:scale-[0.98] ${cls}`}
            >
              <div className="flex flex-col items-center leading-tight">
                <span>{ACTION_LABEL[a]}</span>
                {isAnswered && freq > 0.001 && (
                  <span className="text-[10px] opacity-80 font-mono mt-0.5">
                    {(freq * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 結果 */}
      {answered && strategy && (
        <div
          className={`rounded-lg p-3 sm:p-4 border-2 ${GRADE_META[answered.grade].border} ${GRADE_META[answered.grade].bg}`}
        >
          <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
            <div className={`text-lg sm:text-xl font-bold ${GRADE_META[answered.grade].color}`}>
              {GRADE_META[answered.grade].label}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs text-slate-300">
                EV損: <span className="font-mono">{(answered.evLoss * 1000).toFixed(0)} mbb</span>
                {answered.evLoss === 0 && <span className="text-emerald-300 ml-1">(マッチ)</span>}
              </span>
              <button
                onClick={next}
                className="px-4 py-2 bg-sky-600 active:bg-sky-700 rounded font-bold text-sm"
              >
                次へ →
              </button>
            </div>
          </div>
          <GradeExplain grade={answered.grade} evLoss={answered.evLoss} />
          <div className="text-xs text-slate-300 mt-3 mb-1.5">GTO推奨頻度</div>
          <div className="space-y-1.5">
            {(Object.entries(strategy) as [Action, number][])
              .filter(([, f]) => (f ?? 0) > 0.001)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .map(([action, freq]) => (
                <FrequencyBar key={action} action={action} freq={freq} />
              ))}
          </div>
          {loaded?.meta.handNotes?.[question.hand] && (
            <div className="mt-3 text-[11px] sm:text-xs text-slate-300 bg-slate-900/40 border border-slate-700 rounded px-2 py-1.5">
              💡 {loaded.meta.handNotes[question.hand]}
            </div>
          )}
          {exploitMode !== 'gto' && loaded?.meta.exploit?.[exploitMode] && (
            <ExploitTip
              mode={exploitMode}
              profile={loaded.meta.exploit[exploitMode]!}
              hand={question.hand}
            />
          )}
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

      {/* 隣接ハンド比較は minor/major のみ自動表示 */}
      {answered && range && (answered.grade === 'minor' || answered.grade === 'major') && (
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

function actionGridClass(n: number): string {
  if (n <= 2) return 'grid-cols-2';
  if (n === 3) return 'grid-cols-3';
  if (n === 4) return 'grid-cols-2 sm:grid-cols-4';
  return 'grid-cols-3';
}

type Tone = 'good' | 'warn' | 'bad';

const TONE_PILL_CLASS: Record<Tone, string> = {
  good: 'bg-emerald-900/40 border-emerald-700 text-emerald-200',
  warn: 'bg-amber-900/30 border-amber-800 text-amber-200',
  bad:  'bg-rose-900/30 border-rose-800 text-rose-200',
};

function Pill({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const cls = tone ? TONE_PILL_CLASS[tone] : 'bg-slate-800 border-slate-700 text-slate-200';
  return (
    <div className={`px-2 py-0.5 rounded-full border text-[11px] flex items-center gap-1 ${cls}`}>
      <span className="opacity-70">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function BetSizesLine({ sizes }: { sizes: NonNullable<LoadedRange['meta']['betSizes']> }) {
  const parts: string[] = [];
  if (sizes.open) parts.push(`open ${sizes.open}`);
  if (sizes.threeBetIp) parts.push(`3b IP ${sizes.threeBetIp}`);
  if (sizes.threeBetOop) parts.push(`3b OOP ${sizes.threeBetOop}`);
  if (sizes.fourBetIp) parts.push(`4b IP ${sizes.fourBetIp}`);
  if (sizes.fourBetOop) parts.push(`4b OOP ${sizes.fourBetOop}`);
  if (parts.length === 0 && sizes.raiseLabel) parts.push(sizes.raiseLabel);
  if (parts.length === 0) return null;
  return (
    <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono leading-tight text-center">
      {parts.join(' / ')}
    </div>
  );
}

function ExploitTip({
  mode,
  profile,
  hand,
}: {
  mode: ExploitMode;
  profile: ExploitProfile;
  hand: string;
}) {
  const handAdj = profile.handAdjust?.[hand];
  return (
    <div className="mt-3 text-[11px] sm:text-xs bg-amber-950/30 border border-amber-700/60 rounded px-2 py-1.5">
      <div className="font-bold text-amber-300 mb-0.5">
        🎯 エクスプロイト ({EXPLOIT_LABEL[mode]}): {profile.summary}
      </div>
      <ul className="list-disc list-inside text-amber-100/90 space-y-0.5">
        {profile.guidelines.map((g, i) => (
          <li key={i}>{g}</li>
        ))}
      </ul>
      {handAdj && (
        <div className="mt-1.5 text-amber-200 border-t border-amber-800/40 pt-1">
          このハンド: {handAdj}
        </div>
      )}
      <div className="text-[10px] text-amber-200/60 mt-1">
        ※ GTO値は変えていません。エクスプロイト指針は参考表示のみ。
      </div>
    </div>
  );
}

function GradeExplain({ grade, evLoss }: { grade: Grade; evLoss: number }) {
  // minor は (a) 末端ミックスで evLoss=0、(b) 頻度0だが EV損が境界 (<0.10bb) の2系統。
  const minorText =
    evLoss === 0
      ? '末端ミックスの選択。EV損はほぼゼロだが、主戦略・許容範囲ではない。'
      : `境界ハンドの小ミス。EV損 ${(evLoss * 1000).toFixed(0)} mbb。`;
  const text: Record<Grade, string> = {
    optimal: '主戦略と一致。GTO上ベストの選択。',
    acceptable: 'ミックス戦略の許容範囲。EVほぼ同等で、GTO的に正解。',
    minor: minorText,
    major: `主戦略から外れEV損 ${(evLoss * 1000).toFixed(0)} mbb。明確に避けたい選択。`,
  };
  return <div className="text-[11px] sm:text-xs text-slate-300">{text[grade]}</div>;
}

function HandHint({ hand, note }: { hand: string; note?: string }) {
  const cat = categorize(hand);
  return (
    <div className="mt-1 text-[11px] text-slate-300 bg-slate-900/60 border border-slate-700 rounded px-2 py-1.5 max-w-[240px] text-center">
      <div className="font-bold text-sky-300">{cat.label}</div>
      {cat.tags.length > 0 && (
        <div className="text-[10px] text-slate-400 mt-0.5">
          {cat.tags.map((t) => `#${t}`).join(' ')}
        </div>
      )}
      {note && <div className="text-[10px] text-amber-200 mt-1">💡 {note}</div>}
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
