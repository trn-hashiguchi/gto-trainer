import type { Range, HandStrategy } from '@/domain/poker';
import { ALL_HANDS } from '@/domain/poker';

// レンジJSONはペア/スーテッド/オフスートの「アクションごとの該当ハンドリスト」を持つ簡潔フォーマット。
// この方が手書きしやすく、目視でレンジを把握しやすい。
export interface RangeFile {
  spotId: string;
  source: string;     // 出典明記用
  notes?: string;
  // アクション → 採用ハンドの配列。各エントリは "hand" もしくは "hand@frequency"
  // 例: "AKs", "KTo@0.6"
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

  // 残余をfoldで埋める
  for (const hand of ALL_HANDS) {
    const total = Object.values(range[hand]).reduce((a, b) => a + (b ?? 0), 0);
    if (total < 0.999) {
      range[hand].fold = (range[hand].fold ?? 0) + (1 - total);
    }
  }
  return range;
}

const cache = new Map<string, Range>();

export async function loadRange(spotId: string): Promise<Range> {
  if (cache.has(spotId)) return cache.get(spotId)!;
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}ranges/6max-100bb/${spotId}.json`);
  if (!res.ok) throw new Error(`Failed to load range ${spotId}: ${res.status}`);
  const file = (await res.json()) as RangeFile;
  const range = expandRange(file);
  cache.set(spotId, range);
  return range;
}
