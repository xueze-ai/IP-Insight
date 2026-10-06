import type { zhHistory } from '../zh/history'

export const enHistory: typeof zhHistory = {
  kicker: 'History · Saved locally',
  clearAll: 'Clear all',
  confirmClear: 'Clear all history records? This cannot be undone.',
  desc: 'Automatically saved locally after each full detection (time / IP / data sources / full results). Retention days and the on/off switch are configured under "Settings → Data & Privacy".',
  disabled: 'History is off',
  disabledDesc: 'New detections will no longer be written to history; below are records saved before it was turned off.',
  goEnable: 'Enable in Settings',
  empty: 'No history yet. Records will be saved here automatically after a full detection.',
  goDetect: 'Go to detection',
  noRiskData: 'No risk data',
  today: 'Today',
  yesterday: 'Yesterday',
  sourceCount: '{ok}/{total} sources',
  withAi: ' · with AI analysis',
  ok: 'OK',
  fail: 'Failed',
  detectTime: 'Detected: ',
  riskValue: ' · normalized risk {v}/100',
  loadPage: 'Load into analysis pages',
  exportReport: 'Export report',
  confirmDelete: 'Delete this history record?'
}
