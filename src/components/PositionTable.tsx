import { POSITIONS, type Position } from '@/domain/poker';

interface Props {
  hero: Position;
  villain?: Position; // 例: vs RFI でのオープナー
}

// 6席を楕円上に配置する座標（％）。アクションは時計回り: BB→UTG→HJ→CO→BTN→SB→BB。
// 12時=BB から時計回りに 2時=UTG, 4時=HJ, 6時=CO, 8時=BTN, 10時=SB。
const SEAT_COORDS: Record<Position, { x: number; y: number }> = {
  BB:  { x: 50, y: 8 },
  UTG: { x: 86, y: 38 },
  HJ:  { x: 86, y: 78 },
  CO:  { x: 50, y: 92 },
  BTN: { x: 14, y: 78 },
  SB:  { x: 14, y: 38 },
};

export default function PositionTable({ hero, villain }: Props) {
  return (
    <div className="relative w-full max-w-[260px] aspect-[5/4]">
      {/* テーブル（楕円） */}
      <div className="absolute inset-[10%] rounded-[50%] bg-emerald-800 border-4 border-amber-900/60 shadow-inner" />
      <div className="absolute inset-[18%] rounded-[50%] border border-emerald-600/40" />

      {/* 座席 */}
      {POSITIONS.map((pos) => {
        const { x, y } = SEAT_COORDS[pos];
        const isHero = pos === hero;
        const isVillain = pos === villain;
        return (
          <div
            key={pos}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                isHero
                  ? 'bg-yellow-400 text-slate-900 border-yellow-200 ring-2 ring-yellow-300/60 scale-110'
                  : isVillain
                  ? 'bg-rose-600 text-white border-rose-300 ring-2 ring-rose-400/60'
                  : 'bg-slate-700 text-slate-300 border-slate-500'
              }`}
            >
              {pos}
            </div>
            {isHero && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-yellow-300 whitespace-nowrap font-bold">
                YOU
              </div>
            )}
            {isVillain && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-rose-300 whitespace-nowrap font-bold">
                RAISE
              </div>
            )}
          </div>
        );
      })}
      {/* 時計回りを示す矢印（中央上） */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-700/40 text-xs select-none pointer-events-none">
        ↻
      </div>
    </div>
  );
}
