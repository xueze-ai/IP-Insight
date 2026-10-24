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
  currentIp: 'Current public egress IP',
  doneKicker: 'Detection complete · {ok}/{total} sources succeeded',
  alert: {
    conflict: 'Detection sources disagree on some attributes; those items cannot be confirmed for now; ',
    leak: 'Sources report that DNS / WebRTC request egress differs from the main egress (possible location leak).',
    tail: 'Below are the per-source readings; full evidence is available in expandable details and the AI analysis.'
  },
  row: {
    vpn: 'VPN flag',
    proxy: 'Proxy flag',
    tor: 'Tor exit flag',
    native: 'Nativeness',
    dnsLeak: 'DNS egress consistency',
    webrtcLeak: 'WebRTC egress consistency'
  },
  chatgptExit: ' · ChatGPT egress {ip} ({country})',
  diagBadge: 'Exit diagnostics',
  diagExits: 'Public egress (multiple vantage points): {ips}',
  diagNone: 'No public egress observed this run',
  diagFailed: '{n} vantage point(s) failed',
  diagMore: 'Open full exit diagnostics →',
  diagOnlyHint: 'This is a standalone exit-diagnostics snapshot (no multi-source IP detection); full results live on the Exit Diagnostics page.',
  explain: {
    show: 'What do these fields mean?',
    hide: 'Hide explanations',
    isp: 'ISP: the company providing your internet access, e.g. a home broadband carrier or a hosting operator.',
    asn: 'ASN (Autonomous System Number): the unique number of a network on the internet; it identifies which operator network the IP belongs to.',
    vpnProxy: 'VPN / Proxy flags: what each detection source records about this address (a database entry, not a scan of your device). "Flagged" means at least one source marks it; "Not found" means a source explicitly says otherwise.',
    native: 'Nativeness: whether the IP is announced by its own carrier (so-called "native IP"). This reflects the source database — not good/bad, and not fitness for any specific use.',
    leak: 'DNS / WebRTC egress consistency: whether the exit that "resolved domains / made UDP connections" for you differs from the main egress. A difference may come from normal split-tunnel rules, or may expose your real location; only the sources\' reports are shown.',
    diag: 'Exit diagnostics: observe the actual egress your requests use from independent vantage points (e.g. Cloudflare diagnostic endpoints, authoritative DNS records). Different exits per target are common and not automatically an anomaly.'
  }
}
