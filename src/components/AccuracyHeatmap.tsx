import { RANKS, handAt } from '@/domain/poker';
import { cardId, type CardState } from '@/store/progress';

interface Props {
  spotId: string;
  cards: Record<string, CardState>;
}

// 正答率 0.0〜1.0 を緑/赤グラデーションに変換。
// 試行0は灰、少試行は不透明度で示す。
function cellStyle(state: CardState | undefined): { background: string; opacity: number } {
  if (!state || state.attempts === 0) {
    return { background: '#1e293b', opacity: 1 };
  }
  const acc = state.correct / state.attempts;
  // hue: 0 (red) → 120 (green)
  const hue = Math.round(120 * acc);
  // 信頼度: 試行数で不透明度を上げる
  const opacity = Math.min(1, 0.4 + state.attempts * 0.15);
  return { background: `hsl(${hue}, 70%, 45%)`, opacity };
}

export default function AccuracyHeatmap({ spotId, cards }: Props) {
  return (
    <div
      className="grid gap-[1px] sm:gap-[2px] select-none w-full"
      style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      {RANKS.map((_, r) =>
        RANKS.map((__, c) => {
          const hand = handAt(r, c);
          const state = cards[cardId(spotId, hand.code)];
          const { background, opacity } = cellStyle(state);
          const tip = state
            ? `${hand.code}: ${state.correct}/${state.attempts} (${Math.round(
                (state.correct / state.attempts) * 100,
              )}%)`
            : `${hand.code}: 未学習`;
          return (
            <div
              key={hand.code}
              className="aspect-square text-[8px] sm:text-[10px] font-mono rounded-[2px] text-white flex items-center justify-center leading-none"
              style={{ background, opacity }}
              title={tip}
            >
              <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">{hand.code}</span>
            </div>
          );
        }),
      )}
    </div>
  );
}
