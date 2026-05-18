import { ALL_HANDS, CORRECT_FREQUENCY_THRESHOLD, RANKS, handAt, type Action, type Range } from '@/domain/poker';

interface Props {
  range: Range;
  hand: string;
}

const ACTION_COLOR: Record<Action, string> = {
  open: '#f43f5e',
  raise: '#f43f5e',
  '3bet': '#f59e0b',
  '4bet': '#b91c1c',
  call: '#10b981',
  fold: '#334155',
};

const ACTION_SHORT: Record<Action, string> = {
  open: 'OPEN',
  raise: 'RAISE',
  '3bet': '3B',
  '4bet': '4B',
  call: 'CALL',
  fold: 'FOLD',
};

function primaryActions(strategy: Range[string] | undefined): Action[] {
  if (!strategy) return ['fold'];
  const above = (Object.entries(strategy) as [Action, number][])
    .filter(([, f]) => (f ?? 0) >= CORRECT_FREQUENCY_THRESHOLD)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return above.length > 0 ? above.map(([a]) => a) : ['fold'];
}

function indexOfHand(code: string): { row: number; col: number } | null {
  const i = ALL_HANDS.indexOf(code);
  if (i < 0) return null;
  return { row: Math.floor(i / 13), col: i % 13 };
}

// 同じ行 + 同じ列に位置するハンド = 似た形のハンド群
// row<col=suited, row>col=offsuit, row==col=pair なので、
// 同じハイカードのスーテッド系/オフスート系を並べて見られる。
export default function NeighborHands({ range, hand }: Props) {
  const pos = indexOfHand(hand);
  if (!pos) return null;
  const { row, col } = pos;

  const rowHands = Array.from({ length: 13 }, (_, c) => handAt(row, c).code);
  const colHands = Array.from({ length: 13 }, (_, r) => handAt(r, col).code);

  return (
    <div className="space-y-2 text-xs">
      <div className="text-slate-400">
        同形ハンドの推奨アクション（このハンドは <span className="text-yellow-300 font-mono">{hand}</span>）
      </div>
      <NeighborRow
        title={`${RANKS[row]} 始まり（横一列）`}
        hands={rowHands}
        range={range}
        highlight={hand}
      />
      <NeighborRow
        title={`${RANKS[col]} を含む（縦一列）`}
        hands={colHands}
        range={range}
        highlight={hand}
      />
    </div>
  );
}

function NeighborRow({
  title,
  hands,
  range,
  highlight,
}: {
  title: string;
  hands: string[];
  range: Range;
  highlight: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 mb-1">{title}</div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
        {hands.map((h) => {
          const acts = primaryActions(range[h]);
          const primary = acts[0];
          const isHighlight = h === highlight;
          return (
            <div
              key={h}
              className={`aspect-square rounded-[2px] flex flex-col items-center justify-center text-[8px] font-mono text-white leading-none ${
                isHighlight ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-slate-900' : ''
              }`}
              style={{ background: ACTION_COLOR[primary] }}
              title={`${h}: ${acts.join(' / ')}`}
            >
              <span className="text-[8px] sm:text-[9px]">{h}</span>
              <span className="text-[7px] sm:text-[8px] opacity-90">{ACTION_SHORT[primary]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
