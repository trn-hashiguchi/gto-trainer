import { type Rank } from './poker';

// ハンドのカテゴリ分類と簡易タグ。ヒント表示・解説に使用。

const RANK_VALUE: Record<Rank, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5,
  '4': 4, '3': 3, '2': 2,
};

export interface HandCategory {
  label: string;       // 主カテゴリ
  tags: string[];      // 追加タグ
}

export function categorize(code: string): HandCategory {
  const high = code[0] as Rank;
  const low = code[1] as Rank;
  const suffix = code[2];

  if (high === low) {
    const v = RANK_VALUE[high];
    if (v >= 11) return { label: 'プレミアペア', tags: ['ペア'] }; // JJ+
    if (v >= 8) return { label: '中ペア', tags: ['ペア', 'セットマイニング向き'] }; // 88-TT
    return { label: '小ペア', tags: ['ペア', 'セットマイニング向き'] }; // 22-77
  }

  const suited = suffix === 's';
  const hv = RANK_VALUE[high];
  const lv = RANK_VALUE[low];
  const gap = hv - lv;
  const bothBroadway = hv >= 10 && lv >= 10; // 両方T以上 = ブロードウェイ

  const tags: string[] = [];

  // ベース分類: ブロードウェイを Axs/Kxs より優先
  // (KQs/KJs/KTs/QJs/QTs/JTs などを「Kxs」より「ブロードウェイ・スーテッド」と説明する方が学習価値が高い)
  let label: string;
  if (bothBroadway) {
    label = suited ? 'ブロードウェイ・スーテッド' : 'ブロードウェイ・オフスート';
  } else if (high === 'A') {
    label = suited ? 'Aハイ・スーテッド (Axs)' : 'Aハイ・オフスート (Axo)';
    // ホイール系（A2-A5）はスーテッドのみ意味がある（ストレートを引きやすい）
    if (suited && lv <= 5) tags.push('ホイール系（ローカード）');
  } else if (high === 'K') {
    label = suited ? 'Kハイ・スーテッド (Kxs)' : 'Kハイ・オフスート (Kxo)';
  } else if (suited && gap === 1) {
    label = 'スーテッドコネクター (SC)';
  } else if (suited && gap === 2) {
    label = 'スーテッド・ワンギャッパー';
  } else if (suited && gap === 3) {
    label = 'スーテッド・ツーギャッパー';
  } else if (suited) {
    label = 'スーテッド (その他)';
  } else if (gap === 1) {
    label = 'オフスート・コネクター';
  } else {
    label = 'オフスート (その他)';
  }

  // 共通タグ
  if (suited) tags.push('スーテッド');
  else tags.push('オフスート');
  if (gap === 1) tags.push('コネクター');
  if (bothBroadway) tags.push('ブロードウェイ');
  if (high === 'A') tags.push('Aブロッカー');
  if (high === 'K') tags.push('Kブロッカー');

  return { label, tags };
}
