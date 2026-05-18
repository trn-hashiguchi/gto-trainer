import type { Range, HandStrategy, Action, EvHints } from '@/domain/poker';
import { ALL_HANDS } from '@/domain/poker';

// エクスプロイト指針。
//   - summary: 1行サマリ（ヘッダーに出す）
//   - guidelines: 箇条書きの行動指針
//   - widerActions / tighterActions: アクション別に「広げる/絞る」の方向感
//   - handAdjust: 特定ハンドのGTOからの偏差注釈
export interface ExploitProfile {
  summary: string;
  guidelines: string[];
  widerActions?: Action[];
  tighterActions?: Action[];
  handAdjust?: Record<string, string>;
}

// レンジ JSON v2 フォーマット。
// 既存 v1 (strategy のみ) は引き続き読み込める。v2 追加フィールドは optional。
export interface RangeFile {
  spotId: string;
  source: string;             // 出典明記用
  notes?: string;

  // v2: ベットサイズ前提
  betSizes?: {
    open?: string;            // 例: "2.5bb"
    threeBetIp?: string;      // 例: "3.3x" or "8.5bb"
    threeBetOop?: string;     // 例: "4x"
    fourBetIp?: string;
    fourBetOop?: string;
    raiseLabel?: string;      // 自由形式の補足
  };

  // v2: スポット解説（複数行）
  longDescription?: string;
  // v2: 主要ポイントの箇条書き（学習時に見せる）
  keyPoints?: string[];

  // v2: ハンドレベルの簡易解説。ハンドコード → 1行説明
  handNotes?: Record<string, string>;

  // v2: EV 推定ヒント
  defaultMistakeLoss?: Partial<Record<Action, number>>;
  evOverrides?: Record<string, Partial<Record<Action, number>>>;

  // v2: エクスプロイト調整。GTOからどう動かすかの指針。
  exploit?: {
    vsFish?: ExploitProfile;   // ルース・コール多めの相手
    vsNit?: ExploitProfile;    // タイト・受身の相手
    vsAggro?: ExploitProfile;  // 3bet/4bet多めの相手
  };

  // 戦略（必須）。アクション → 採用ハンドの配列、"hand" もしくは "hand@frequency"
  strategy: Record<string, string[]>;
}

function parseEntry(entry: string): { hand: string; freq: number } {
  const [hand, freqStr] = entry.split('@');
  const freq = freqStr ? Number(freqStr) : 1;
  if (Number.isNaN(freq) || freq < 0 || freq > 1) {
    throw new Error(`Invalid frequency in entry: ${entry}`);
  }
  return { hand, freq };
}

export function expandRange(file: RangeFile): Range {
  const range: Range = {};
  for (const hand of ALL_HANDS) range[hand] = {};

  for (const [actionRaw, entries] of Object.entries(file.strategy)) {
    const action = actionRaw as keyof HandStrategy;
    for (const entry of entries) {
      const { hand, freq } = parseEntry(entry);
      if (!(hand in range)) throw new Error(`Unknown hand: ${hand} in ${file.spotId}`);
      range[hand][action] = (range[hand][action] ?? 0) + freq;
    }
  }

  // 残余を fold で埋める
  for (const hand of ALL_HANDS) {
    const total = Object.values(range[hand]).reduce((a, b) => a + (b ?? 0), 0);
    if (total < 0.999) {
      range[hand].fold = (range[hand].fold ?? 0) + (1 - total);
    }
  }
  return range;
}

export interface LoadedRange {
  range: Range;
  meta: RangeFile;
  evHints: EvHints;
}

const cache = new Map<string, LoadedRange>();

export async function loadRange(spotId: string): Promise<LoadedRange> {
  if (cache.has(spotId)) return cache.get(spotId)!;
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}ranges/6max-100bb/${spotId}.json`);
  if (!res.ok) throw new Error(`Failed to load range ${spotId}: ${res.status}`);
  const file = (await res.json()) as RangeFile;
  const range = expandRange(file);
  const evHints: EvHints = {
    defaultMistakeLoss: file.defaultMistakeLoss,
    evOverrides: file.evOverrides,
  };
  const loaded: LoadedRange = { range, meta: file, evHints };
  cache.set(spotId, loaded);
  return loaded;
}
