import { RANKS, type HandInfo } from '@/domain/poker';

interface Props {
  handCode: string;
  size?: 'sm' | 'md' | 'lg';
}

function parseHandCode(code: string): HandInfo {
  // 13x13 マトリクスを走査するのは過剰なので簡易解析
  const high = code[0] as (typeof RANKS)[number];
  const low = code[1] as (typeof RANKS)[number];
  const suffix = code[2];
  if (high === low) return { code, high, low, shape: 'pair' };
  if (suffix === 's') return { code, high, low, shape: 'suited' };
  return { code, high, low, shape: 'offsuit' };
}

// 表記用の固定スーツ割当（視認性重視）
function suitsFor(shape: HandInfo['shape']): [Suit, Suit] {
  if (shape === 'suited') return ['♠', '♠'];
  if (shape === 'pair') return ['♠', '♥'];
  return ['♠', '♥']; // offsuit
}

type Suit = '♠' | '♥' | '♦' | '♣';
const RED: Suit[] = ['♥', '♦'];

function rankLabel(r: string): string {
  return r === 'T' ? '10' : r;
}

const SIZE_CLASSES = {
  sm: { card: 'w-10 h-14 text-base', rank: 'text-base', suit: 'text-base' },
  md: { card: 'w-16 h-24 text-2xl', rank: 'text-2xl', suit: 'text-2xl' },
  lg: { card: 'w-24 h-32 text-4xl', rank: 'text-4xl', suit: 'text-4xl' },
};

export default function CardPair({ handCode, size = 'lg' }: Props) {
  // 直接コードから判別（handAtを使わない）
  const info = parseHandCode(handCode);
  const [s1, s2] = suitsFor(info.shape);
  const cls = SIZE_CLASSES[size];
  return (
    <div className="flex gap-2 items-center">
      <Card rank={info.high} suit={s1} cls={cls} />
      <Card rank={info.low} suit={s2} cls={cls} />
    </div>
  );
}

function Card({ rank, suit, cls }: { rank: string; suit: Suit; cls: typeof SIZE_CLASSES.md }) {
  const isRed = RED.includes(suit);
  return (
    <div
      className={`${cls.card} bg-white rounded-md shadow-lg border border-slate-300 flex flex-col items-center justify-center font-bold relative`}
    >
      <span className={`${cls.rank} ${isRed ? 'text-rose-600' : 'text-slate-900'} leading-none`}>
        {rankLabel(rank)}
      </span>
      <span className={`${cls.suit} ${isRed ? 'text-rose-600' : 'text-slate-900'} leading-none`}>
        {suit}
      </span>
    </div>
  );
}
