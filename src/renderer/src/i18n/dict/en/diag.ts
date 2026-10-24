export const enDiag = {
  title: 'Network Exit Diagnostics',
  intro:
    'Observe the egress your machine actually uses from multiple independent vantage points: public IP, website split tunneling, CDN edge node, and DNS query exit. Different exits per target can come from normal split-tunnel rules and is not an anomaly by itself.',
  stop: 'Stop',
  runAll: 'Run exit diagnostics',
  rerunAll: 'Re-run all',
  runningHint: 'Diagnostics in progress (run {id}); a failed probe does not affect others. You can stop anytime.',
  runEnd: {
    canceled: 'Run canceled ({time}); completed probes are kept.',
    timeout: 'Run timed out ({time}); completed probes are kept.'
  },
  runMeta: 'Run {runId} · started {start} · {stats}',
  moduleStats: '{ok}/{total} probes OK',
  privacyNote: 'Probes are sent directly from your machine and stored locally. Vantage points only see the egress and the diagnostic target; evidence is size-capped and sanitized.',
  empty: 'This run contains no probes for this module.',
  module: {
    publicIp: 'Public IP',
    splitTunnel: 'Website split tunneling',
    cdnNode: 'CDN edge node',
    dnsExit: 'DNS exit lookup'
  },
  note: {
    publicIp:
      'Shows the public egress observed by external services — not your LAN adapter address. Different vantage points may see different exits (e.g. split rules or IPv4/IPv6 differences); all are kept. When IPv6 is unavailable it shows "not measured" — never a placeholder.',
    splitTunnel:
      'Compare which egress each target sees. Differences can come from normal split-tunnel rules. Only official diagnostic endpoints of each target are tested; the result describes that endpoint only, not the whole website. Targets that do not echo the IP only report reachability.',
    cdnNode:
      'Shows which CDN edge node served this request. The node location does not directly represent where you are, and is not the DNS answer, the cache HIT/MISS, or your public IP. Node codes are kept as-is without guessing cities; no HIT/MISS is shown without evidence; latency here is HTTP request time, not ICMP ping.',
    dnsExit:
      'Shows the DNS query exit that resolved this test (the address a recursive resolver exposes to authoritative DNS). It is usually NOT your public IP. A DNS exit different from the HTTP exit is common and alone does not indicate a "DNS leak". This test covers the queried resolvers only, not every app or domain.'
  },
  status: {
    success: 'OK',
    partial: 'Partial',
    failed: 'Failed',
    timeout: 'Timed out',
    canceled: 'Canceled',
    skipped: 'Skipped',
    unsupported: 'Unsupported',
    running: 'Running',
    pending: 'Pending'
  },
  via: {
    'main-http': 'Main-process network stack (system proxy aware)',
    'browser-page': 'Hidden browser page context',
    'dns-udp': 'Direct UDP 53 to the resolver'
  },
  family: {
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    unknown: 'Unknown family'
  },
  keyResult: {
    reachableOnly: 'Reachable (no IP echo)'
  },
  summary: {
    publicIp: {
      multi: 'Vantage points disagree: {ips}',
      one: 'Public egress: {ips}',
      none: 'No egress observed this run'
    },
    splitTunnel: {
      exits: '{n} distinct exit(s) observed ({ips}…)',
      none: 'No target echoed an exit IP'
    },
    cdnNode: {
      hit: '{n} CDN(s) reported a node (e.g. {first})',
      none: 'No node info obtained'
    },
    dnsExit: {
      exits: '{n} recursive exit(s) observed ({ips}…)',
      none: 'No recursive exit observed'
    },
    partial: '{n} probe(s) failed or timed out'
  },
  field: {
    method: 'Method',
    time: 'Time & duration',
    httpStatus: 'HTTP status',
    family: 'Address family',
    node: 'Node code (as reported)',
    cdn: 'CDN',
    sourceUrl: 'Source reference',
    error: 'Failure reason'
  },
  evidence: {
    toggle: 'Show raw evidence (truncated / sanitized)'
  }
}
