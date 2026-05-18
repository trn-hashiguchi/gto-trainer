#!/usr/bin/env node
// レンジJSONの妥当性チェック。
// - source フィールドが存在し非空
// - すべてのハンドコードが 169 セットに含まれる
// - 各ハンドのアクション合計頻度が 1.001 以下
// - 同一アクション内でハンド重複なし
// 失敗時は非ゼロ終了。CI / pre-build から呼ぶ。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RANGE_DIR = path.join(ROOT, 'public/ranges/6max-100bb');

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const ALL_HANDS = new Set();
for (let r = 0; r < 13; r++) {
  for (let c = 0; c < 13; c++) {
    const high = RANKS[Math.min(r, c)];
    const low = RANKS[Math.max(r, c)];
    if (r === c) ALL_HANDS.add(`${high}${high}`);
    else if (r < c) ALL_HANDS.add(`${high}${low}s`);
    else ALL_HANDS.add(`${high}${low}o`);
  }
}

const VALID_ACTIONS = new Set(['fold', 'call', 'open', 'raise', '3bet', '4bet']);

const errors = [];

function validateFile(file) {
  const full = path.join(RANGE_DIR, file);
  const expectedId = file.replace(/\.json$/, '');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    errors.push(`${file}: JSON parse error: ${e.message}`);
    return;
  }

  if (data.spotId !== expectedId) {
    errors.push(`${file}: spotId "${data.spotId}" does not match filename`);
  }
  if (!data.source || typeof data.source !== 'string' || data.source.trim() === '') {
    errors.push(`${file}: source field is required (non-empty string)`);
  }
  if (!data.strategy || typeof data.strategy !== 'object') {
    errors.push(`${file}: strategy field missing`);
    return;
  }

  // ハンドごとに頻度を集計
  const perHand = new Map(); // hand -> sum
  for (const [action, entries] of Object.entries(data.strategy)) {
    if (!VALID_ACTIONS.has(action)) {
      errors.push(`${file}: unknown action "${action}"`);
      continue;
    }
    if (!Array.isArray(entries)) {
      errors.push(`${file}: strategy.${action} must be an array`);
      continue;
    }
    const seen = new Set();
    for (const entry of entries) {
      const [hand, freqStr] = String(entry).split('@');
      const freq = freqStr === undefined ? 1 : Number(freqStr);
      if (!ALL_HANDS.has(hand)) {
        errors.push(`${file}: ${action}: unknown hand "${hand}"`);
        continue;
      }
      if (!Number.isFinite(freq) || freq < 0 || freq > 1) {
        errors.push(`${file}: ${action}: invalid frequency in "${entry}"`);
        continue;
      }
      if (seen.has(hand)) {
        errors.push(`${file}: ${action}: duplicate hand "${hand}"`);
        continue;
      }
      seen.add(hand);
      perHand.set(hand, (perHand.get(hand) ?? 0) + freq);
    }
  }

  for (const [hand, total] of perHand) {
    if (total > 1.001) {
      errors.push(`${file}: ${hand}: frequency sum ${total.toFixed(3)} exceeds 1.0`);
    }
  }
}

const files = fs.readdirSync(RANGE_DIR).filter((f) => f.endsWith('.json'));
files.sort();
for (const f of files) validateFile(f);

if (errors.length > 0) {
  console.error(`✗ ${errors.length} validation error(s):\n`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`✓ Validated ${files.length} range file(s).`);
