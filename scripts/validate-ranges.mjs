#!/usr/bin/env node
// レンジJSONの妥当性チェック（v2 対応）。
// - spotId / source / strategy の必須チェック
// - 169 ハンドコードの妥当性
// - 各ハンドのアクション合計頻度 ≤ 1.001
// - 同一アクション内のハンド重複なし
// - v2 任意フィールド: betSizes / defaultMistakeLoss / evOverrides / handNotes / exploit / keyPoints / longDescription
// - 未知のトップレベルフィールドを警告（タイポ検出）
// 失敗時は非ゼロ終了。

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
const KNOWN_TOP_FIELDS = new Set([
  'spotId', 'source', 'notes', 'strategy',
  'betSizes', 'longDescription', 'keyPoints', 'handNotes',
  'defaultMistakeLoss', 'evOverrides', 'exploit',
]);
const KNOWN_BET_SIZE_FIELDS = new Set([
  'open', 'threeBetIp', 'threeBetOop', 'fourBetIp', 'fourBetOop', 'raiseLabel',
]);
const KNOWN_EXPLOIT_PROFILES = new Set(['vsFish', 'vsNit', 'vsAggro']);
const KNOWN_EXPLOIT_FIELDS = new Set([
  'summary', 'guidelines', 'widerActions', 'tighterActions', 'handAdjust',
]);

const errors = [];
const warnings = [];

function reportError(file, msg) { errors.push(`${file}: ${msg}`); }
function reportWarn(file, msg) { warnings.push(`${file}: ${msg}`); }

function validateActionMap(file, label, m) {
  if (typeof m !== 'object' || m === null) {
    reportError(file, `${label} must be an object`);
    return;
  }
  for (const [k, v] of Object.entries(m)) {
    if (!VALID_ACTIONS.has(k)) reportError(file, `${label}: unknown action "${k}"`);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      reportError(file, `${label}.${k}: must be a finite number`);
    }
  }
}

function validateEvOverrides(file, m) {
  if (typeof m !== 'object' || m === null) {
    reportError(file, 'evOverrides must be an object');
    return;
  }
  for (const [hand, perAction] of Object.entries(m)) {
    if (!ALL_HANDS.has(hand)) {
      reportError(file, `evOverrides: unknown hand "${hand}"`);
      continue;
    }
    if (typeof perAction !== 'object' || perAction === null) {
      reportError(file, `evOverrides.${hand}: must be an object`);
      continue;
    }
    for (const [act, val] of Object.entries(perAction)) {
      if (!VALID_ACTIONS.has(act)) reportError(file, `evOverrides.${hand}: unknown action "${act}"`);
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        reportError(file, `evOverrides.${hand}.${act}: must be a non-negative finite number`);
      }
    }
  }
}

function validateBetSizes(file, b) {
  if (typeof b !== 'object' || b === null) {
    reportError(file, 'betSizes must be an object');
    return;
  }
  for (const k of Object.keys(b)) {
    if (!KNOWN_BET_SIZE_FIELDS.has(k)) {
      reportWarn(file, `betSizes: unknown field "${k}" (typo?)`);
    }
    if (typeof b[k] !== 'string') reportError(file, `betSizes.${k}: must be a string`);
  }
}

function validateExploit(file, ex) {
  if (typeof ex !== 'object' || ex === null) {
    reportError(file, 'exploit must be an object');
    return;
  }
  for (const profileKey of Object.keys(ex)) {
    if (!KNOWN_EXPLOIT_PROFILES.has(profileKey)) {
      reportWarn(file, `exploit: unknown profile "${profileKey}"`);
      continue;
    }
    const p = ex[profileKey];
    if (typeof p !== 'object' || p === null) {
      reportError(file, `exploit.${profileKey}: must be an object`);
      continue;
    }
    for (const k of Object.keys(p)) {
      if (!KNOWN_EXPLOIT_FIELDS.has(k)) {
        reportWarn(file, `exploit.${profileKey}: unknown field "${k}"`);
      }
    }
    if (typeof p.summary !== 'string') reportError(file, `exploit.${profileKey}.summary: must be a string`);
    if (!Array.isArray(p.guidelines)) reportError(file, `exploit.${profileKey}.guidelines: must be an array`);
    if (p.widerActions && !Array.isArray(p.widerActions)) {
      reportError(file, `exploit.${profileKey}.widerActions: must be an array`);
    }
    if (p.tighterActions && !Array.isArray(p.tighterActions)) {
      reportError(file, `exploit.${profileKey}.tighterActions: must be an array`);
    }
    if (p.handAdjust && typeof p.handAdjust !== 'object') {
      reportError(file, `exploit.${profileKey}.handAdjust: must be an object`);
    }
  }
}

function validateHandNotes(file, h) {
  if (typeof h !== 'object' || h === null) {
    reportError(file, 'handNotes must be an object');
    return;
  }
  for (const [hand, text] of Object.entries(h)) {
    if (!ALL_HANDS.has(hand)) reportError(file, `handNotes: unknown hand "${hand}"`);
    if (typeof text !== 'string') reportError(file, `handNotes.${hand}: must be a string`);
  }
}

function validateFile(file) {
  const full = path.join(RANGE_DIR, file);
  const expectedId = file.replace(/\.json$/, '');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    reportError(file, `JSON parse error: ${e.message}`);
    return;
  }

  if (data.spotId !== expectedId) {
    reportError(file, `spotId "${data.spotId}" does not match filename`);
  }
  if (!data.source || typeof data.source !== 'string' || data.source.trim() === '') {
    reportError(file, 'source field is required (non-empty string)');
  }
  if (!data.strategy || typeof data.strategy !== 'object') {
    reportError(file, 'strategy field missing');
    return;
  }

  // 未知のトップレベルフィールドを警告
  for (const k of Object.keys(data)) {
    if (!KNOWN_TOP_FIELDS.has(k)) reportWarn(file, `unknown top-level field "${k}" (typo?)`);
  }

  // strategy 検証
  const perHand = new Map();
  for (const [action, entries] of Object.entries(data.strategy)) {
    if (!VALID_ACTIONS.has(action)) {
      reportError(file, `unknown action "${action}"`);
      continue;
    }
    if (!Array.isArray(entries)) {
      reportError(file, `strategy.${action} must be an array`);
      continue;
    }
    const seen = new Set();
    for (const entry of entries) {
      const [hand, freqStr] = String(entry).split('@');
      const freq = freqStr === undefined ? 1 : Number(freqStr);
      if (!ALL_HANDS.has(hand)) {
        reportError(file, `${action}: unknown hand "${hand}"`);
        continue;
      }
      if (!Number.isFinite(freq) || freq < 0 || freq > 1) {
        reportError(file, `${action}: invalid frequency in "${entry}"`);
        continue;
      }
      if (seen.has(hand)) {
        reportError(file, `${action}: duplicate hand "${hand}"`);
        continue;
      }
      seen.add(hand);
      perHand.set(hand, (perHand.get(hand) ?? 0) + freq);
    }
  }
  for (const [hand, total] of perHand) {
    if (total > 1.001) {
      reportError(file, `${hand}: frequency sum ${total.toFixed(3)} exceeds 1.0`);
    }
  }

  // v2 任意フィールド
  if (data.betSizes !== undefined) validateBetSizes(file, data.betSizes);
  if (data.defaultMistakeLoss !== undefined) {
    validateActionMap(file, 'defaultMistakeLoss', data.defaultMistakeLoss);
  }
  if (data.evOverrides !== undefined) validateEvOverrides(file, data.evOverrides);
  if (data.handNotes !== undefined) validateHandNotes(file, data.handNotes);
  if (data.exploit !== undefined) validateExploit(file, data.exploit);
  if (data.keyPoints !== undefined && !Array.isArray(data.keyPoints)) {
    reportError(file, 'keyPoints must be an array');
  }
  if (data.longDescription !== undefined && typeof data.longDescription !== 'string') {
    reportError(file, 'longDescription must be a string');
  }
  if (data.notes !== undefined && typeof data.notes !== 'string') {
    reportError(file, 'notes must be a string');
  }
}

const files = fs.readdirSync(RANGE_DIR).filter((f) => f.endsWith('.json'));
files.sort();
for (const f of files) validateFile(f);

if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn('  ' + w);
}
if (errors.length > 0) {
  console.error(`✗ ${errors.length} validation error(s):\n`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`✓ Validated ${files.length} range file(s).`);
