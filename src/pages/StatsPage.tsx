import { useMemo, useState } from 'react';
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
  const reset = useProgress((s) => s.reset);
  const [confirming, setConfirming] = useState(false);
  const [heatmapSpotId, setHeatmapSpotId] = useState(SPOTS[0].id);

  const boxDist = countByBox(cards);
  const studiedTotal = Object.values(cards).length;

  // スポット別: 正答率の悪い順（試行5回未満は末尾）
  const spotRanking = useMemo(() => {
    const entries = Object.entries(bySpot).map(([spotId, s]) => ({
      spotId,
      correct: s.correct,
      total: s.total,
      acc: s.total > 0 ? s.correct / s.total : 0,
      reliable: s.total >= 5,
    }));
    entries.sort((a, b) => {
      if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
      return a.acc - b.acc; // 悪い順
    });
    return entries;
  }, [bySpot]);

  // ヒートマップ対象スポットの試行サマリ
  const heatSummary = useMemo(() => {
    let attempts = 0;
    let correct = 0;
    let learned = 0;
    for (const [id, c] of Object.entries(cards)) {
      if (!id.startsWith(heatmapSpotId + '::')) continue;
      attempts += c.attempts;
      correct += c.correct;
      learned += 1;
    }
    return { attempts, correct, learned };
  }, [cards, heatmapSpotId]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">通算スコア</h2>
        <div className="text-2xl sm:text-3xl font-mono">
          {totals.correct}
          <span className="text-slate-500">/{totals.total}</span>
          {totals.total > 0 && (
            <span className="text-slate-400 text-base sm:text-lg ml-3">
              {Math.round((totals.correct / totals.total) * 100)}%
            </span>
          )}
        </div>
      </section>

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

      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">スポット別正答率（弱点順）</h2>
        {spotRanking.length === 0 && (
          <div className="text-sm text-slate-400">まだ記録がありません</div>
        )}
        {spotRanking.map((s) => {
          const pct = Math.round(s.acc * 100);
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
              <span className="w-20 sm:w-28 text-right font-mono text-xs sm:text-sm text-slate-300">
                {s.correct}/{s.total}
                <span className="text-slate-400 ml-1">({pct}%)</span>
                {!s.reliable && <span className="text-slate-500 ml-1">*</span>}
              </span>
            </div>
          );
        })}
        {spotRanking.some((s) => !s.reliable) && (
          <div className="text-[10px] text-slate-500 mt-1">* 試行5回未満（信頼度低）</div>
        )}
      </section>

      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">ポジション別正答率</h2>
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
              <span className="w-20 sm:w-24 text-right font-mono text-xs sm:text-sm text-slate-300">
                {s ? `${s.correct}/${s.total}` : '—'}
                {pct !== null && <span className="text-slate-400 ml-1">({pct}%)</span>}
              </span>
            </div>
          );
        })}
      </section>

      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">SRS 進捗（Leitner Box分布）</h2>
        <div className="text-xs sm:text-sm text-slate-400 mb-2">
          学習済みカード: {studiedTotal}（box5に到達 = 習得）
        </div>
        {[1, 2, 3, 4, 5].map((box) => {
          const count = boxDist[box] ?? 0;
          const pct = studiedTotal > 0 ? (count / studiedTotal) * 100 : 0;
          return (
            <div key={box} className="flex items-center gap-2 sm:gap-3 py-1">
              <span className="w-12 sm:w-16 font-mono text-sm">Box {box}</span>
              <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${pct}%`,
                    background: box === 5 ? '#10b981' : box >= 3 ? '#06b6d4' : '#f59e0b',
                  }}
                />
              </div>
              <span className="w-12 sm:w-16 text-right font-mono text-sm">{count}</span>
            </div>
          );
        })}
      </section>

      <section className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
        <h2 className="text-base sm:text-lg font-bold mb-2">最近の試行</h2>
        {recent.length === 0 && <div className="text-sm text-slate-400">なし</div>}
        <ul className="space-y-1 text-xs sm:text-sm font-mono">
          {recent.slice(0, 15).map((r, i) => (
            <li key={i} className="flex items-center gap-2 truncate">
              <span className={r.correct ? 'text-emerald-400' : 'text-rose-400'}>
                {r.correct ? '✓' : '✗'}
              </span>
              <span className="text-slate-300 truncate">{r.spotId}</span>
              <span className="text-slate-100">{r.hand}</span>
              <span className="text-slate-400 truncate">→ {r.chosen}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-slate-400 active:text-rose-400"
          >
            学習データをリセット…
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-rose-300">本当に全データを削除しますか？</span>
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
      </section>
    </div>
  );
}

function countByBox(cards: Record<string, CardState>): Record<number, number> {
  const dist: Record<number, number> = {};
  for (const c of Object.values(cards)) {
    dist[c.box] = (dist[c.box] ?? 0) + 1;
  }
  return dist;
}
