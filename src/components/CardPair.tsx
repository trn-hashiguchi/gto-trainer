import { RANKS, type HandInfo } from '@/domain/poker';

interface Props {
  handCode: string;
  size?: 'sm' | 'md' | 'lg' | 'responsive';
}

function parseHandCode(code: string): HandInfo {
  const high = code[0] as (typeof RANKS)[number];
  const low = code[1] as (typeof RANKS)[number];
  const suffix = code[2];
  if (high === low) return { code, high, low, shape: 'pair' };
  if (suffix === 's') return { code, high, low, shape: 'suited' };
  return { code, high, low, shape: 'offsuit' };
}

function suitsFor(shape: HandInfo['shape']): [Suit, Suit] {
  if (shape === 'suited') return ['♠', '♠'];
  if (shape === 'pair') return ['♠', '♥'];
  return ['♠', '♥'];
}

type Suit = '♠' | '♥' | '♦' | '♣';
const RED: Suit[] = ['♥', '♦'];

function rankLabel(r: string): string {
  return r === 'T' ? '10' : r;
}

const SIZE_CLASSES = {
  sm: { card: 'w-10 h-14', rank: 'text-base', suit: 'text-base', gap: 'gap-1.5' },
  md: { card: 'w-16 h-24', rank: 'text-2xl', suit: 'text-2xl', gap: 'gap-2' },
  lg: { card: 'w-24 h-32', rank: 'text-4xl', suit: 'text-4xl', gap: 'gap-2' },
  // モバイル中サイズ、デスクトップ大サイズ
  responsive: {
    card: 'w-16 h-24 sm:w-24 sm:h-32',
    rank: 'text-3xl sm:text-4xl',
    suit: 'text-3xl sm:text-4xl',
    gap: 'gap-2',
  },
};

export default function CardPair({ handCode, size = 'responsive' }: Props) {
  const info = parseHandCode(handCode);
  const [s1, s2] = suitsFor(info.shape);
  const cls = SIZE_CLASSES[size];
  return (
    <div className={`flex items-center ${cls.gap}`}>
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
      <span className={`${cls.suit} ${isRed ? 'text-rose-600' : 'text-slate-900'} leading-none mt-0.5`}>
        {suit}
      </span>
    </div>
  );
}
