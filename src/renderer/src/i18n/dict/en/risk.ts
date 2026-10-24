import type { zhRisk } from '../zh/risk'

export const enRisk: typeof zhRisk = {
  kicker: 'Risk Analysis · Multi-source cross-check',
  introBefore: 'Risk verdicts on the primary egress IP from {n} sources',
  introAfter: '. Methodologies differ by source; all normalized to a 0–100 risk score with original labels kept.',
  empty: {
    title: 'No risk data yet',
    desc: 'Complete a scan first to see the multi-source risk analysis.'
  },
  startDetection: 'Start scan',
  nodata: 'No data',
  level: {
    title: 'Overall risk level · Primary egress',
    score: 'Normalized risk {v} / 100',
    scaleItem: '{name}: {raw} ({scale})',
    scales: '{list}.',
    computedNote:
      'Note: the overall level is a computed value — this app normalizes each source’s different scales and takes the median, for quick comparison only; it is not a score measured by any risk institution.',
    conflictNote:
      ' Risk levels disagree across sources (see methodologies and values above); the overall level is the median, not a definitive verdict.'
  },
  leak: {
    dns: 'DNS egress consistency',
    webrtc: 'WebRTC egress consistency',
    dnsDesc: 'Source-reported status: {status}. A mismatch may come from normal split-tunnel rules or may expose the real location; only the sources’ reports are shown.',
    webrtcDesc: 'Source-reported status: {status}. Observed via STUN probes; represents that probe path only.'
  },
  gpt: {
    badge: 'ChatGPT split egress',
    risk: 'Normalized risk {v} ({level})',
    note: 'Different IP from the primary egress; not directly comparable'
  },
  tri: {
    sep: ', ',
    itemSep: '; ',
    hit: 'Flagged',
    miss: 'Not flagged',
    unknown: 'Unknown',
    found: '{hit} flagged as {label}.',
    foundMixed: '{hit} flagged as {label}; {unknown} did not provide this field.',
    clear: 'All {n} covering sources report no {label}.',
    clearMixed: '{clear} report no {label}; {unknown} did not provide this field.',
    conflict: 'Sources disagree ({detail}); cannot confirm at this time.',
    conflictItem: '{source}: {result}',
    unknownAll: 'All sources provide this field but none could determine it ({unknown}).',
    nodata: 'No data source provides a {label} verdict.',
    label: {
      vpn: 'VPN',
      proxy: 'proxy',
      torExit: 'Tor exit',
      crawler: 'crawler / spider traits',
      abuse: 'abuse flag'
    }
  },
  ti: {
    title: 'Threat Intelligence',
    blacklist: 'Blacklist',
    abuse: 'Abuse',
    spam: 'Spam',
    fraud: 'Fraud',
    threats: 'Threat tags',
    blacklistHit: '{hit} / {total} flagged',
    blacklistDescHit: 'Flagged by {n} DNSBLs: {engines}; expand for per-engine categories and return codes.',
    blacklistDescClear: 'No hits across 12 DNSBLs (measured by Net.Coffee, single source).',
    blacklistDescEmpty: 'No blacklist data retrieved in this scan.',
    abuseIntel:
      ' Also: Net.Coffee intel database historical abuse level {level}{scorePart} — a historical scoring methodology, different from the current live flags.',
    abuseIntelScore: '({raw})',
    spamHit: '{n} Spam lists flagged',
    spamClear: 'No Spam list hits',
    spamDescHit: 'Flagged by Spam lists: {engines} (return codes: {codes}).',
    spamDescClear: 'No hits on any Spam-type DNSBL list.',
    fraudDesc:
      'None of the connected data sources currently provide a fraud label; shown honestly as "No data" — not guessed, not filled in.',
    threatsHit: '{n} threat tags',
    threatsClear: 'No threat tags',
    threatsDescHit: 'Flagged by the Net.Coffee intel database: {tags} (single source).',
    threatsDescClear: 'The Net.Coffee intel database flagged no threat types (single source, not cross-checked).',
    threatsDescEmpty: 'No intel-database threat tags retrieved in this scan.',
    table: {
      engine: 'DNSBL engine',
      category: 'Category',
      status: 'Status',
      code: 'Return codes',
      ms: 'Time'
    }
  },
  proxy: {
    title: 'Proxy & Anonymity',
    vpn: 'VPN',
    proxy: 'Proxy',
    tor: 'Tor',
    crawler: 'Crawler'
  },
  nat: {
    title: 'Nativeness',
    native: 'Nativeness',
    shared: 'Shared egress',
    human: 'Human/bot traffic ratio',
    conflict: 'Sources disagree',
    nativeEmpty: 'No data source provides a native / broadcast verdict.',
    nativeAgree: 'All covering sources agree: {v}.',
    nativeConflict: 'Sources disagree: {detail}.',
    sharedEmpty: 'No data source provides a shared-user estimate.',
    sharedDesc: 'Ping0 estimates {v} users share this egress IP (single-source range estimate, not exact).',
    humanDesc: 'IPPure reports a human/bot traffic ratio of {v} for this IP range (single-source methodology).',
    humanEmpty: 'No human/bot traffic ratio retrieved in this scan.'
  },
  item: {
    expand: 'Expand per-source details',
    collapse: 'Collapse'
  },
  viewNetcoffee: 'View original Net.Coffee scan',
  viewPing0: 'View original Ping0 scan'
}
