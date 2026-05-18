import { POSITIONS, type Position } from '@/domain/poker';

interface Props {
  hero: Position;
  villain?: Position;
  /** villain のアクションラベル。デフォルトは "RAISE"。vs3bet なら "3BET" など */
  villainLabel?: string;
  /** hero が既に取ったアクション。vs3bet で表示する "RAISED" 等 */
  heroPrevLabel?: string;
  compact?: boolean;
}

// 6席を楕円上に配置（％）。時計回り: BB(12時)→UTG(2時)→HJ(4時)→CO(6時)→BTN(8時)→SB(10時)
const SEAT_COORDS: Record<Position, { x: number; y: number }> = {
  BB:  { x: 50, y: 8 },
  UTG: { x: 86, y: 38 },
  HJ:  { x: 86, y: 78 },
  CO:  { x: 50, y: 92 },
  BTN: { x: 14, y: 78 },
  SB:  { x: 14, y: 38 },
};

export default function PositionTable({
  hero,
  villain,
  villainLabel = 'RAISE',
  heroPrevLabel,
  compact = false,
}: Props) {
  const sizeWrap = compact
    ? 'w-full max-w-[180px]'
    : 'w-full max-w-[200px] sm:max-w-[260px]';
  const seatSize = compact
    ? 'w-7 h-7 text-[9px]'
    : 'w-8 h-8 sm:w-10 sm:h-10 text-[9px] sm:text-[10px]';
  return (
    <div className={`relative aspect-[5/4] ${sizeWrap}`}>
      <div className="absolute inset-[10%] rounded-[50%] bg-emerald-800 border-4 border-amber-900/60 shadow-inner" />
      <div className="absolute inset-[18%] rounded-[50%] border border-emerald-600/40" />

      {POSITIONS.map((pos) => {
        const { x, y } = SEAT_COORDS[pos];
        const isHero = pos === hero;
        const isVillain = pos === villain;
        // hero に既アクションがある場合、座席色をオレンジ寄りにして"既に動いた"ことを示す
        const heroBg = heroPrevLabel
          ? 'bg-amber-300 text-slate-900 border-amber-200 ring-2 ring-amber-300/60 scale-110'
          : 'bg-yellow-400 text-slate-900 border-yellow-200 ring-2 ring-yellow-300/60 scale-110';
        return (
          <div
            key={pos}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div
              className={`${seatSize} rounded-full flex items-center justify-center font-bold border-2 ${
                isHero
                  ? heroBg
                  : isVillain
                  ? 'bg-rose-600 text-white border-rose-300 ring-2 ring-rose-400/60'
                  : 'bg-slate-700 text-slate-300 border-slate-500'
              }`}
            >
              {pos}
            </div>
            {isHero && (
              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap font-bold flex flex-col items-center leading-tight">
                <span className={heroPrevLabel ? 'text-amber-300' : 'text-yellow-300'}>YOU</span>
                {heroPrevLabel && (
                  <span className="text-amber-200/90 text-[8px]">{heroPrevLabel}</span>
                )}
              </div>
            )}
            {isVillain && (
              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-rose-300 whitespace-nowrap font-bold">
                {villainLabel}
              </div>
            )}
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-700/40 text-xs select-none pointer-events-none">
        ↻
      </div>
    </div>
  );
}
