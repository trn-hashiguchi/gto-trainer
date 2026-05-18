import { useEffect, useState } from 'react';
import HandMatrix from '@/components/HandMatrix';
import { SPOTS } from '@/domain/spots';
import { loadRange } from '@/data/rangeLoader';
import type { Range } from '@/domain/poker';

export default function ReferencePage() {
  const [spotId, setSpotId] = useState(SPOTS[3].id); // BTN
  const [range, setRange] = useState<Range | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setRange(undefined);
    setError(undefined);
    loadRange(spotId)
      .then(setRange)
      .catch((e) => setError(String(e)));
  }, [spotId]);

  const spot = SPOTS.find((s) => s.id === spotId)!;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm text-slate-300">スポット:</label>
        <select
          value={spotId}
          onChange={(e) => setSpotId(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
        >
          {SPOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-slate-300">{spot.description}</p>
      {error && <p className="text-rose-400 text-sm">{error}（このスポットのレンジJSONは未提供かもしれません）</p>}
      {range && <HandMatrix range={range} />}
      <Legend />
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ['open / raise', '#f43f5e'],
    ['3bet', '#f59e0b'],
    ['4bet', '#b91c1c'],
    ['call', '#10b981'],
    ['fold', '#334155'],
  ];
  return (
    <div className="flex gap-3 text-xs text-slate-300 flex-wrap">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
