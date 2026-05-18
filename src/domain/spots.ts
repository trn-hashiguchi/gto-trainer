import type { Spot } from './poker';

// MVPで扱うスポット。レンジJSONのファイル名と一致させる
export const SPOTS: Spot[] = [
  // ===== RFI =====
  {
    id: 'RFI-UTG',
    format: '6max-100bb',
    scenario: 'RFI',
    hero: 'UTG',
    actions: ['open', 'fold'],
    description: 'UTG、フォールド回り。オープンするか？',
  },
  {
    id: 'RFI-HJ',
    format: '6max-100bb',
    scenario: 'RFI',
    hero: 'HJ',
    actions: ['open', 'fold'],
    description: 'HJ、フォールド回り。オープンするか？',
  },
  {
    id: 'RFI-CO',
    format: '6max-100bb',
    scenario: 'RFI',
    hero: 'CO',
    actions: ['open', 'fold'],
    description: 'CO、フォールド回り。オープンするか？',
  },
  {
    id: 'RFI-BTN',
    format: '6max-100bb',
    scenario: 'RFI',
    hero: 'BTN',
    actions: ['open', 'fold'],
    description: 'BTN、フォールド回り。オープンするか？',
  },
  {
    id: 'RFI-SB',
    format: '6max-100bb',
    scenario: 'RFI',
    hero: 'SB',
    actions: ['open', 'fold'],
    description: 'SB、BBのみ残り。オープン(raise)するか？',
  },

  // ===== vsRFI: BB defending =====
  {
    id: 'vsRFI-BB-UTG',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BB',
    villain: 'UTG',
    actions: ['3bet', 'call', 'fold'],
    description: 'UTGがオープン、他全員フォールド。BBでどう対応？',
  },
  {
    id: 'vsRFI-BB-HJ',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BB',
    villain: 'HJ',
    actions: ['3bet', 'call', 'fold'],
    description: 'HJがオープン、CO/BTN/SBフォールド。BBでどう対応？',
  },
  {
    id: 'vsRFI-BB-CO',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BB',
    villain: 'CO',
    actions: ['3bet', 'call', 'fold'],
    description: 'COがオープン、BTN/SBフォールド。BBでどう対応？',
  },
  {
    id: 'vsRFI-BB-BTN',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BB',
    villain: 'BTN',
    actions: ['3bet', 'call', 'fold'],
    description: 'BTNがオープン、SBフォールド。BBでどう対応？',
  },
  {
    id: 'vsRFI-BB-SB',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BB',
    villain: 'SB',
    actions: ['3bet', 'call', 'fold'],
    description: 'SBがオープン（他全員フォールド済み）。BBでどう対応？',
  },

  // ===== vsRFI: SB defending =====
  {
    id: 'vsRFI-SB-HJ',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'SB',
    villain: 'HJ',
    actions: ['3bet', 'call', 'fold'],
    description: 'HJがオープン、CO/BTNフォールド。SBでどう対応？',
  },
  {
    id: 'vsRFI-SB-CO',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'SB',
    villain: 'CO',
    actions: ['3bet', 'call', 'fold'],
    description: 'COがオープン、BTNフォールド。SBでどう対応？',
  },
  {
    id: 'vsRFI-SB-BTN',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'SB',
    villain: 'BTN',
    actions: ['3bet', 'call', 'fold'],
    description: 'BTNがオープン。SBでどう対応？(BBが背後)',
  },

  // ===== vsRFI: BTN defending =====
  {
    id: 'vsRFI-BTN-UTG',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BTN',
    villain: 'UTG',
    actions: ['3bet', 'call', 'fold'],
    description: 'UTGがオープン、HJ/COフォールド。BTNでどう対応？',
  },
  {
    id: 'vsRFI-BTN-HJ',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BTN',
    villain: 'HJ',
    actions: ['3bet', 'call', 'fold'],
    description: 'HJがオープン、COフォールド。BTNでどう対応？',
  },
  {
    id: 'vsRFI-BTN-CO',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BTN',
    villain: 'CO',
    actions: ['3bet', 'call', 'fold'],
    description: 'COがオープン。BTNでどう対応？',
  },

  // ===== vsRFI: CO defending =====
  {
    id: 'vsRFI-CO-UTG',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'CO',
    villain: 'UTG',
    actions: ['3bet', 'call', 'fold'],
    description: 'UTGがオープン、HJフォールド。COでどう対応？',
  },
  {
    id: 'vsRFI-CO-HJ',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'CO',
    villain: 'HJ',
    actions: ['3bet', 'call', 'fold'],
    description: 'HJがオープン。COでどう対応？',
  },

  // ===== vs3bet: opener facing 3bet =====
  {
    id: 'vs3bet-UTG-BB',
    format: '6max-100bb',
    scenario: 'vs3bet',
    hero: 'UTG',
    villain: 'BB',
    heroPrevAction: 'open',
    actions: ['4bet', 'call', 'fold'],
    description: 'UTGでオープン → BBが3bet。4bet/call/fold？',
  },
  {
    id: 'vs3bet-CO-BB',
    format: '6max-100bb',
    scenario: 'vs3bet',
    hero: 'CO',
    villain: 'BB',
    heroPrevAction: 'open',
    actions: ['4bet', 'call', 'fold'],
    description: 'COでオープン → BBが3bet。4bet/call/fold？',
  },
  {
    id: 'vs3bet-BTN-SB',
    format: '6max-100bb',
    scenario: 'vs3bet',
    hero: 'BTN',
    villain: 'SB',
    heroPrevAction: 'open',
    actions: ['4bet', 'call', 'fold'],
    description: 'BTNでオープン → SBが3bet。4bet/call/fold？',
  },
  {
    id: 'vs3bet-BTN-BB',
    format: '6max-100bb',
    scenario: 'vs3bet',
    hero: 'BTN',
    villain: 'BB',
    heroPrevAction: 'open',
    actions: ['4bet', 'call', 'fold'],
    description: 'BTNでオープン → BBが3bet。4bet/call/fold？',
  },
];

export function spotById(id: string): Spot | undefined {
  return SPOTS.find((s) => s.id === id);
}

// ドリル出題対象のスポットID
export const AVAILABLE_SPOT_IDS = SPOTS.map((s) => s.id);
