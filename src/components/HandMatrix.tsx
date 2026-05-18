import { RANKS, handAt, type Range, type Action } from '@/domain/poker';

interface Props {
  range?: Range;
  highlight?: string;
  onCellClick?: (hand: string) => void;
}

const ACTION_COLOR: Record<Action, string> = {
  open: '#f43f5e',
  raise: '#f43f5e',
  '3bet': '#f59e0b',
  '4bet': '#b91c1c',
  call: '#10b981',
  fold: '#334155',
};

function cellBackground(strategy: Range[string] | undefined): string {
  if (!strategy) return ACTION_COLOR.fold;
  const entries = (Object.entries(strategy) as [Action, number][])
    .filter(([, f]) => (f ?? 0) > 0.001)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (entries.length === 0) return ACTION_COLOR.fold;
  if (entries.length === 1) return ACTION_COLOR[entries[0][0]];

  let cursor = 0;
  const stops: string[] = [];
  for (const [action, freq] of entries) {
    const start = (cursor * 100).toFixed(2);
    cursor += freq;
    const end = (cursor * 100).toFixed(2);
    stops.push(`${ACTION_COLOR[action]} ${start}% ${end}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export default function HandMatrix({ range, highlight, onCellClick }: Props) {
  return (
    <div
      className="grid gap-[2px] select-none"
      style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      {RANKS.map((_, r) =>
        RANKS.map((__, c) => {
          const hand = handAt(r, c);
          const strategy = range?.[hand.code];
          const isHighlight = highlight === hand.code;
          const bg = cellBackground(strategy);
          return (
            <button
              key={hand.code}
              onClick={() => onCellClick?.(hand.code)}
              className={`aspect-square text-[10px] sm:text-xs font-mono rounded-sm text-white flex items-center justify-center ${
                isHighlight ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-slate-900' : ''
              }`}
              style={{ background: bg }}
              title={hand.code}
            >
              {hand.code}
            </button>
          );
        }),
      )}
    </div>
  );
}
