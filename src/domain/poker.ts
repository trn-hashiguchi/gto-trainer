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
  villain?: Position;    // vsRFI 時のオープナー / vs3bet 時の3bettor
  // PositionTable の villain バッジ表示文字（"RAISE" / "3BET" 等）。
  // 未指定なら scenario から推定（vs3bet → "3BET", それ以外 → "RAISE"）
  villainLabel?: string;
  // hero が既に取ったアクション。vs3bet で hero が open 済みであることを示すため。
  heroPrevAction?: 'open';
  actions: Action[];     // ユーザーが選べる選択肢
  description: string;
}

// ====== 採点 / EV ======

// 4段階評価。学習効果を担保するため、ミックス末端でも EV 損が小さければ minor 扱い。
//   optimal:    主戦略（freq ≥ 30% またはそのスポットの最大頻度アクション）
//   acceptable: GTO 的に許容（freq ≥ 5%）
//   minor:      推定 EV 損 < 0.05 bb の小ミス
//   major:      推定 EV 損 ≥ 0.05 bb の明確なミス
export type Grade = 'optimal' | 'acceptable' | 'minor' | 'major';

export interface GradeResult {
  grade: Grade;
  evLoss: number;     // bb 単位。0 ならEVマッチ
  chosenFreq: number; // 選択したアクションの推奨頻度
  topFreq: number;    // このハンドの最大頻度
}

// spot レベルの EV 推定ヒント。レンジ JSON で defaultMistakeLoss / evOverrides として与える。
export interface EvHints {
  // アクション別の「主戦略を外した時のデフォルトEV損失（bb）」
  // 例: { fold: 0.30, call: 0.10, '4bet': 0.20 }
  defaultMistakeLoss?: Partial<Record<Action, number>>;
  // 個別ハンドの個別アクションEV損失（bb）。最優先で使う。
  // 例: { "AA": { fold: 3.0 }, "32o": { open: 0.04 } }
  evOverrides?: Record<string, Partial<Record<Action, number>>>;
}

const FREQ_THRESHOLD_OPTIMAL = 0.30;   // これ以上で主戦略
const FREQ_THRESHOLD_ACCEPTABLE = 0.05; // これ以上で許容
const EV_THRESHOLD_MINOR = 0.05;        // bb。これ未満なら minor

// 採点関数。
// 設計原則: GTO ナッシュ均衡では「混合戦略に含まれるアクションは EV 同等」。
// よって freq > 0 のアクションは原則 evLoss = 0。freq = 0 のアクションのみ EV 損が発生する。
//
// grade は freq を主、evLoss を従とする:
//   freq ≥ 30%:                        optimal
//   freq ≥ 5%:                         acceptable
//   freq = 0% かつ evLoss < 0.05bb:     minor   (境界の小ミス)
//   freq = 0% かつ evLoss ≥ 0.05bb:    major   (明確なミス)
//   0 < freq < 5%:                     末端ミックス。evLoss は 0 だが optimal でも acceptable でもない
//                                       → 「許容寄りの minor」として minor 扱い
export function gradeChoice(
  strategy: HandStrategy,
  chosen: Action,
  hand: HandCode,
  hints?: EvHints,
): GradeResult {
  const chosenFreq = strategy[chosen] ?? 0;
  const topFreq = Math.max(0, ...Object.values(strategy).map((f) => f ?? 0));
  const evLoss = estimateEvLoss(strategy, chosen, hand, hints);

  let grade: Grade;
  if (chosenFreq >= FREQ_THRESHOLD_OPTIMAL || (chosenFreq > 0 && chosenFreq >= topFreq * 0.95)) {
    grade = 'optimal';
  } else if (chosenFreq >= FREQ_THRESHOLD_ACCEPTABLE) {
    grade = 'acceptable';
  } else if (evLoss < EV_THRESHOLD_MINOR) {
    grade = 'minor';
  } else {
    grade = 'major';
  }

  return { grade, evLoss, chosenFreq, topFreq };
}

// EV 損失（bb）の推定。
// - freq > 0: 0（GTO 混合戦略では含まれるアクションの EV は同等）
// - freq = 0: hand-action override → spot の defaultMistakeLoss → 0.15bb のフォールバック
export function estimateEvLoss(
  strategy: HandStrategy,
  chosen: Action,
  hand: HandCode,
  hints?: EvHints,
): number {
  if ((strategy[chosen] ?? 0) > 0) return 0;

  const ovr = hints?.evOverrides?.[hand]?.[chosen];
  if (typeof ovr === 'number') return ovr;

  const fallback = hints?.defaultMistakeLoss?.[chosen];
  if (typeof fallback === 'number') return fallback;
  return 0.15;
}

// このハンドの最大頻度アクション。隣接伝播判定用。
export function mainAction(strategy: HandStrategy | undefined): Action | undefined {
  if (!strategy) return undefined;
  let best: Action | undefined;
  let bestFreq = 0;
  for (const [k, v] of Object.entries(strategy) as [Action, number][]) {
    if ((v ?? 0) > bestFreq) {
      bestFreq = v ?? 0;
      best = k;
    }
  }
  return best;
}

export const CORRECT_FREQUENCY_THRESHOLD = FREQ_THRESHOLD_ACCEPTABLE;

// ============================================================
// シナリオチェーン（プリフロップ → 簡易フロップの連鎖問題）
// ============================================================
// 1問の中で複数の意思決定ノードを連結する形式。
// 例: hero=BTN で AJs を持ち、CO open に call → flop K♠T♣2♦ → check-call vs check-raise vs fold ?
//
// MVP では Range JSON とは別に「scenario JSON」を用意し、ノード単位で簡易戦略を保持する。
// データ実装は次回イテレーション。
export interface ScenarioStep {
  // ステップID（出題進行管理用）
  id: string;
  // 表示する状況テキスト
  prompt: string;
  // ボード（フロップ以降。プリフロップは空）
  board?: string[];   // 例: ["Ks","Tc","2d"]
  // ポットサイズ・スタック残（bb）
  pot: number;
  stack: number;
  // 選択肢
  actions: ScenarioAction[];
}

export interface ScenarioAction {
  id: string;
  label: string;          // 表示文字列
  isCorrect?: boolean;    // 主戦略か否か
  freq?: number;          // GTO 頻度（0〜1）
  evBb?: number;          // 期待 EV（bb）
  // 次のステップへの分岐
  next?: string;          // 次ステップID（undefined なら終了）
  outcomeNote?: string;   // この選択をした時の解説
}

export interface ScenarioChain {
  id: string;             // 例: "scenario-btn-ajs-vs-co-3bet"
  title: string;
  description: string;
  // hero/villain は初期状況。各ステップで誰が動いているかは prompt 内で表記。
  hero: Position;
  villain?: Position;
  // 初期スタック（bb）
  startingStack: number;
  // ステップ集合（ID で参照、tree 構造）
  steps: Record<string, ScenarioStep>;
  rootStep: string;
}
