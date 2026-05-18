// 6max NLH のドメインモデル

export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Position = (typeof POSITIONS)[number];

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type Rank = (typeof RANKS)[number];

// "AKs" / "AKo" / "AA" 形式のハンドコード
export type HandCode = string;

export type HandShape = 'pair' | 'suited' | 'offsuit';

export interface HandInfo {
  code: HandCode;
  high: Rank;
  low: Rank;
  shape: HandShape;
}

export function handAt(row: number, col: number): HandInfo {
  // row, col: 0..12 (0=A, 12=2)。マトリクス慣例: row<col=suited, row>col=offsuit, row==col=pair
  const high = RANKS[Math.min(row, col)];
  const low = RANKS[Math.max(row, col)];
  if (row === col) return { code: `${high}${high}`, high, low: high, shape: 'pair' };
  if (row < col) return { code: `${high}${low}s`, high, low, shape: 'suited' };
  return { code: `${high}${low}o`, high, low, shape: 'offsuit' };
}

export const ALL_HANDS: HandCode[] = Array.from({ length: 13 }, (_, r) =>
  Array.from({ length: 13 }, (_, c) => handAt(r, c).code),
).flat();

// 出題のアクション。MVPでは RFI / vs RFI までを表現できる集合に絞る
export type Action = 'fold' | 'call' | 'open' | 'raise' | '3bet' | '4bet';

// 1ハンドに対する各アクションの頻度（0〜1）。合計はおおむね1
export type HandStrategy = Partial<Record<Action, number>>;

// レンジ = 1スポット分の全ハンド戦略
export type Range = Record<HandCode, HandStrategy>;

// スポット定義
export interface Spot {
  id: string;            // 例: "RFI-BTN"
  format: '6max-100bb';
  scenario: 'RFI' | 'vsRFI' | 'vs3bet';
  hero: Position;
  villain?: Position;    // vsRFI 時のオープナー
  actions: Action[];     // ユーザーが選べる選択肢
  description: string;
}

// 採点用しきい値
export const CORRECT_FREQUENCY_THRESHOLD = 0.05;
