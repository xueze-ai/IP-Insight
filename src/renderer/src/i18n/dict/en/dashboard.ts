import type { zhDashboard } from '../zh/dashboard'

export const enDashboard: typeof zhDashboard = {
  start: 'Start full detection',
  rerun: 'Re-run detection',
  viewFull: 'View full results',
  exportReport: 'Export report',
  collapseFull: 'Collapse full results',
  step: {
    waiting: 'Waiting',
    running: 'Detecting',
    done: 'Done · {sec}s',
    failed: 'Failed / timed out'
  },
  hero: {
    kicker: 'IP Insight · Comprehensive network environment detection',
    title: 'See your network environment at a glance.',
    desc: 'Automatically visits multiple detection sites, aggregates real IP profiles, risk and leak data, and produces a trustworthy network environment report via cross-validation and AI analysis.',
    currentEnv: 'Current network environment',
    currentEnvHint: 'Click "{action}" to identify your current public IP'
  },
  running: 'Detection in progress',
  runningDesc: 'Visiting detection sites in the background, please wait…',
  currentIp: 'Current public IP',
  doneKicker: 'Detection complete · {ok}/4 sources succeeded',
  alert: {
    conflict: 'Sources disagree on some attributes; those items cannot be confirmed for now; ',
    leak: 'DNS / WebRTC egress differs from the ChatGPT egress — real location leak detected.',
    tail: 'Below are the per-item multi-source readings. See the full results and AI analysis for conclusions.'
  },
  row: {
    vpn: 'VPN',
    proxy: 'Proxy',
    tor: 'Tor',
    native: 'Nativeness',
    dnsLeak: 'DNS leak',
    webrtcLeak: 'WebRTC leak'
  },
  chatgptExit: ' · ChatGPT egress {ip} ({country})'
}
