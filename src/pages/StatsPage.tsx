import { useState } from 'react';
import { POSITIONS } from '@/domain/poker';
import { useProgress, type CardState } from '@/store/progress';

export default function StatsPage() {
  const totals = useProgress((s) => s.totals);
  const byPosition = useProgress((s) => s.byPosition);
  const bySpot = useProgress((s) => s.bySpot);
  const cards = useProgress((s) => s.cards);
  const recent = useProgress((s) => s.recent);
  const reset = useProgress((s) => s.reset);
  const [confirming, setConfirming] = useState(false);

  const boxDist = countByBox(cards);
  const studiedTotal = Object.values(cards).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-bold mb-3">通算スコア</h2>
        <div className="text-3xl font-mono">
          {totals.correct}
          <span className="text-slate-500">/{totals.total}</span>
          {totals.total > 0 && (
            <span className="text-slate-400 text-lg ml-3">
              {Math.round((totals.correct / totals.total) * 100)}%
            </span>
          )}
        </div>
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-bold mb-3">ポジション別正答率</h2>
        {POSITIONS.map((pos) => {
          const s = byPosition[pos];
          const pct = s && s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
          return (
            <div key={pos} className="flex items-center gap-3 py-1">
              <span className="w-12 font-mono text-sm">{pos}</span>
              <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden relative">
                {pct !== null && (
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <span className="w-24 text-right font-mono text-sm text-slate-300">
                {s ? `${s.correct}/${s.total}` : '—'}{' '}
                {pct !== null && <span className="text-slate-400">({pct}%)</span>}
              </span>
            </div>
          );
        })}
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-bold mb-3">スポット別正答率</h2>
        {Object.entries(bySpot).length === 0 && (
          <div className="text-sm text-slate-400">まだ記録がありません</div>
        )}
        {Object.entries(bySpot).map(([spotId, s]) => {
          const pct = Math.round((s.correct / s.total) * 100);
          return (
            <div key={spotId} className="flex items-center gap-3 py-1">
              <span className="w-24 font-mono text-sm">{spotId}</span>
              <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 text-right font-mono text-sm text-slate-300">
                {s.correct}/{s.total} <span className="text-slate-400">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-bold mb-3">SRS 進捗（Leitner Box分布）</h2>
        <div className="text-sm text-slate-400 mb-2">
          学習済みカード: {studiedTotal}（box5に到達 = 習得）
        </div>
        {[1, 2, 3, 4, 5].map((box) => {
          const count = boxDist[box] ?? 0;
          const pct = studiedTotal > 0 ? (count / studiedTotal) * 100 : 0;
          return (
            <div key={box} className="flex items-center gap-3 py-1">
              <span className="w-16 font-mono text-sm">Box {box}</span>
              <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${pct}%`,
                    background: box === 5 ? '#10b981' : box >= 3 ? '#06b6d4' : '#f59e0b',
                  }}
                />
              </div>
              <span className="w-16 text-right font-mono text-sm">{count}</span>
            </div>
          );
        })}
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-bold mb-3">最近の試行</h2>
        {recent.length === 0 && <div className="text-sm text-slate-400">なし</div>}
        <ul className="space-y-1 text-sm font-mono">
          {recent.slice(0, 15).map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={r.correct ? 'text-emerald-400' : 'text-rose-400'}>
                {r.correct ? '✓' : '✗'}
              </span>
              <span className="text-slate-300">{r.spotId}</span>
              <span className="text-slate-100">{r.hand}</span>
              <span className="text-slate-400">→ {r.chosen}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-slate-400 hover:text-rose-400"
          >
            学習データをリセット…
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-rose-300">本当に全データを削除しますか？</span>
            <button
              onClick={() => {
                reset();
                setConfirming(false);
              }}
              className="px-3 py-1 bg-rose-700 hover:bg-rose-600 rounded text-sm"
            >
              削除
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
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
