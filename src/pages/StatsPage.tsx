import { useMemo, useRef, useState } from 'react';
import { POSITIONS } from '@/domain/poker';
import { useProgress, type CardState } from '@/store/progress';
import { SPOTS } from '@/domain/spots';
import AccuracyHeatmap from '@/components/AccuracyHeatmap';

export default function StatsPage() {
  const totals = useProgress((s) => s.totals);
  const byPosition = useProgress((s) => s.byPosition);
  const bySpot = useProgress((s) => s.bySpot);
  const cards = useProgress((s) => s.cards);
  const recent = useProgress((s) => s.recent);
  const streak = useProgress((s) => s.streak);
  const daily = useProgress((s) => s.daily);
  const dailyGoal = useProgress((s) => s.dailyGoal);
  const setDailyGoal = useProgress((s) => s.setDailyGoal);
  const reset = useProgress((s) => s.reset);
  const exportJSON = useProgress((s) => s.exportJSON);
  const importJSON = useProgress((s) => s.importJSON);
  const [confirming, setConfirming] = useState(false);
  const [heatmapSpotId, setHeatmapSpotId] = useState(SPOTS[0].id);
  const importInputRef = useRef<HTMLInputElement>(null);

  const efDist = countByEfBucket(cards);
  const studiedTotal = Object.values(cards).filter((c) => c.attempts > 0).length;

  const spotRanking = useMemo(() => {
    const entries = Object.entries(bySpot).map(([spotId, s]) => ({
      spotId,
      correct: s.correct,
      total: s.total,
      evLoss: s.evLoss,
      acc: s.total > 0 ? s.correct / s.total : 0,
      avgEvLoss: s.total > 0 ? s.evLoss / s.total : 0,
      reliable: s.total >= 5,
    }));
    entries.sort((a, b) => {
      if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
      return b.avgEvLoss - a.avgEvLoss; // EV損が大きいスポット = 弱点
    });
    return entries;
  }, [bySpot]);

  const heatSummary = useMemo(() => {
    let attempts = 0;
    let correct = 0;
    let learned = 0;
    for (const [id, c] of Object.entries(cards)) {
      if (!id.startsWith(heatmapSpotId + '::')) continue;
      attempts += c.attempts;
      correct += c.correct;
      if (c.attempts > 0) learned += 1;
    }
    return { attempts, correct, learned };
  }, [cards, heatmapSpotId]);

  const totalAccPct = totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0;
  const avgEvLossMbb = totals.total > 0 ? (totals.evLoss / totals.total) * 1000 : 0;
  const dailyPct = Math.min(100, Math.round((daily.count / dailyGoal) * 100));

  function downloadExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poker-gto-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const r = importJSON(text);
      if (!r.ok) alert(`インポート失敗: ${r.error}`);
      else alert('インポート完了');
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* サマリ */}
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">サマリ</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="通算正答率" value={`${totalAccPct}%`} sub={`${totals.correct}/${totals.total}`} />
          <Metric
            label="平均EV損"
            value={`${avgEvLossMbb.toFixed(0)} mbb`}
            sub="1問あたり"
            tone={avgEvLossMbb < 20 ? 'good' : avgEvLossMbb < 50 ? 'warn' : 'bad'}
          />
          <Metric label="連続正解" value={`${streak.current}`} sub={`best: ${streak.best}`} />
          <Metric
            label="今日"
            value={`${daily.count}/${dailyGoal}`}
            sub={dailyPct >= 100 ? '目標達成 🎉' : `${dailyPct}%`}
            tone={dailyPct >= 100 ? 'good' : undefined}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
          <span className="text-slate-400">デイリー目標:</span>
          {[20, 30, 50, 100].map((n) => (
            <button
              key={n}
              onClick={() => setDailyGoal(n)}
              className={`px-2 py-0.5 rounded border ${
                dailyGoal === n
                  ? 'bg-emerald-700 border-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
            >
              {n}問
            </button>
          ))}
        </div>
      </section>

      {/* ヒートマップ */}
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">ハンド別正答率ヒートマップ</h2>
        <div className="flex items-center gap-2 mb-2">
          <select
            value={heatmapSpotId}
            onChange={(e) => setHeatmapSpotId(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm flex-1 min-w-0 max-w-[260px]"
          >
            {SPOTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-400 mb-2">
          学習済み {heatSummary.learned}/169 ハンド・試行 {heatSummary.attempts}（正答 {heatSummary.correct}・
          {heatSummary.attempts > 0
            ? Math.round((heatSummary.correct / heatSummary.attempts) * 100) + '%'
            : '—'}
          ）
        </div>
        <AccuracyHeatmap spotId={heatmapSpotId} cards={cards} />
        <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#1e293b' }} />
            未学習
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'hsl(0, 70%, 45%)' }} />
            0%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'hsl(60, 70%, 45%)' }} />
            50%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'hsl(120, 70%, 45%)' }} />
            100%
          </span>
          <span className="text-slate-500 ml-2">※ 試行数が少ないと薄く表示</span>
        </div>
      </section>

      {/* スポット別 EV損ランキング */}
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">スポット別 弱点ランキング（平均EV損順）</h2>
        {spotRanking.length === 0 && (
          <div className="text-sm text-slate-400">まだ記録がありません</div>
        )}
        {spotRanking.map((s) => {
          const pct = Math.round(s.acc * 100);
          const evLossMbb = s.avgEvLoss * 1000;
          return (
            <div key={s.spotId} className="flex items-center gap-2 sm:gap-3 py-1">
              <span className="w-24 sm:w-28 font-mono text-[11px] sm:text-sm truncate">{s.spotId}</span>
              <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? '#10b981' : pct >= 60 ? '#06b6d4' : pct >= 40 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              <span className="w-28 sm:w-36 text-right font-mono text-[11px] sm:text-xs text-slate-300">
                {s.correct}/{s.total} ({pct}%)
                <span className="text-amber-300/80 ml-1">{evLossMbb.toFixed(0)}mbb</span>
                {!s.reliable && <span className="text-slate-500 ml-1">*</span>}
              </span>
            </div>
          );
        })}
        {spotRanking.some((s) => !s.reliable) && (
          <div className="text-[10px] text-slate-500 mt-1">* 試行5回未満（信頼度低）</div>
        )}
      </section>

      {/* ポジション別 */}
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">ポジション別 正答率</h2>
        {POSITIONS.map((pos) => {
          const s = byPosition[pos];
          const pct = s && s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
          return (
            <div key={pos} className="flex items-center gap-2 sm:gap-3 py-1">
              <span className="w-10 sm:w-12 font-mono text-sm">{pos}</span>
              <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden">
                {pct !== null && (
                  <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                )}
              </div>
              <span className="w-24 sm:w-28 text-right font-mono text-xs sm:text-sm text-slate-300">
                {s ? `${s.correct}/${s.total}` : '—'}
                {pct !== null && <span className="text-slate-400 ml-1">({pct}%)</span>}
              </span>
            </div>
          );
        })}
      </section>

      {/* SRS 状態（EF 分布） */}
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">SRS 状態（Ease Factor 分布）</h2>
        <div className="text-xs sm:text-sm text-slate-400 mb-2">
          学習済みカード: {studiedTotal} ・ EF が高いほど習熟（SM-2 アルゴリズム）
        </div>
        {EF_BUCKETS.map((b) => {
          const count = efDist[b.label] ?? 0;
          const pct = studiedTotal > 0 ? (count / studiedTotal) * 100 : 0;
          return (
            <div key={b.label} className="flex items-center gap-2 sm:gap-3 py-1">
              <span className="w-24 sm:w-32 font-mono text-[11px] sm:text-sm">{b.label}</span>
              <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden">
                <div className="h-full" style={{ width: `${pct}%`, background: b.color }} />
              </div>
              <span className="w-12 sm:w-16 text-right font-mono text-sm">{count}</span>
            </div>
          );
        })}
      </section>

      {/* 最近の試行 */}
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">最近の試行</h2>
        {recent.length === 0 && <div className="text-sm text-slate-400">なし</div>}
        <ul className="space-y-1 text-xs sm:text-sm font-mono">
          {recent.slice(0, 15).map((r, i) => (
            <li key={i} className="flex items-center gap-2 truncate">
              <span className={gradeColor(r.grade)}>{gradeMark(r.grade)}</span>
              <span className="text-slate-300 truncate">{r.spotId}</span>
              <span className="text-slate-100">{r.hand}</span>
              <span className="text-slate-400 truncate">→ {r.chosen}</span>
              {r.evLoss > 0 && (
                <span className="text-amber-300/80 ml-auto">{(r.evLoss * 1000).toFixed(0)}mbb</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* データ管理 */}
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">データ管理</h2>
        <p className="text-xs text-slate-400 mb-2">
          進捗は端末の localStorage に保存されています。ブラウザのクリアで消えるため、定期的にエクスポートを推奨。
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadExport}
            className="px-3 py-1.5 bg-emerald-700 active:bg-emerald-800 rounded text-sm font-bold"
          >
            JSONエクスポート
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="px-3 py-1.5 bg-sky-700 active:bg-sky-800 rounded text-sm font-bold"
          >
            JSONインポート
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onImportFile}
          />
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="ml-auto text-xs text-slate-400 active:text-rose-400"
            >
              学習データをリセット…
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <span className="text-sm text-rose-300">本当に削除しますか？</span>
              <button
                onClick={() => {
                  reset();
                  setConfirming(false);
                }}
                className="px-3 py-1 bg-rose-700 active:bg-rose-800 rounded text-sm"
              >
                削除
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-1 bg-slate-700 active:bg-slate-800 rounded text-sm"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const EF_BUCKETS = [
  { label: '苦手 (EF<1.7)',     test: (ef: number) => ef < 1.7, color: '#ef4444' },
  { label: '要復習 (1.7-2.1)',  test: (ef: number) => ef >= 1.7 && ef < 2.1, color: '#f59e0b' },
  { label: '習得中 (2.1-2.5)',  test: (ef: number) => ef >= 2.1 && ef < 2.5, color: '#06b6d4' },
  { label: '習熟 (2.5+)',       test: (ef: number) => ef >= 2.5, color: '#10b981' },
];

function countByEfBucket(cards: Record<string, CardState>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of Object.values(cards)) {
    if (c.attempts === 0) continue;
    for (const b of EF_BUCKETS) {
      if (b.test(c.ef)) {
        out[b.label] = (out[b.label] ?? 0) + 1;
        break;
      }
    }
  }
  return out;
}

type Tone = 'good' | 'warn' | 'bad';

const METRIC_TONE_CLASS: Record<Tone, string> = {
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad:  'text-rose-300',
};

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  const valCls = tone ? METRIC_TONE_CLASS[tone] : 'text-slate-100';
  return (
    <div className="bg-slate-900/40 rounded border border-slate-700 px-3 py-2">
      <div className="text-[10px] sm:text-xs text-slate-400">{label}</div>
      <div className={`text-lg sm:text-2xl font-mono ${valCls}`}>{value}</div>
      {sub && <div className="text-[10px] sm:text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function gradeMark(g: 'optimal' | 'acceptable' | 'minor' | 'major'): string {
  return g === 'optimal' ? '✓' : g === 'acceptable' ? '◯' : g === 'minor' ? '△' : '✗';
}
function gradeColor(g: 'optimal' | 'acceptable' | 'minor' | 'major'): string {
  return g === 'optimal'
    ? 'text-emerald-400'
    : g === 'acceptable'
    ? 'text-sky-400'
    : g === 'minor'
    ? 'text-amber-400'
    : 'text-rose-400';
}
