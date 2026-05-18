import type { Spot } from './poker';

// MVPで扱うスポット。レンジJSONのファイル名と一致させる
export const SPOTS: Spot[] = [
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
  {
    id: 'vsRFI-BB-BTN',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BB',
    villain: 'BTN',
    actions: ['3bet', 'call', 'fold'],
    description: 'BTNがオープン、SBはフォールド。BBでどう対応？',
  },
  {
    id: 'vsRFI-BB-CO',
    format: '6max-100bb',
    scenario: 'vsRFI',
    hero: 'BB',
    villain: 'CO',
    actions: ['3bet', 'call', 'fold'],
    description: 'COがオープン、BTN/SBはフォールド。BBでどう対応？',
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
];

export function spotById(id: string): Spot | undefined {
  return SPOTS.find((s) => s.id === id);
}
