export const enDiag = {
  title: 'Network Exit Diagnostics',
  intro:
    'See the egress your machine actually uses per target: public IP, website split tunneling, CDN edge nodes, DNS query exits. Key results are shown directly; technical details and raw evidence are expandable.',
  stop: 'Stop',
  runAll: 'Run all',
  rerunAll: 'Re-run all',
  runningHint: 'Running (run {id}); a failed probe does not affect others. You can stop anytime.',
  runEnd: {
    canceled: 'Run stopped ({time}); completed probes are kept. You can re-run immediately.',
    timeout: 'Run timed out ({time}); completed probes are kept. You can re-run immediately.'
  },
  runMeta: 'Run {runId} · started {start}',
  progress: '{done}/{total} probes done',
  elapsed: '{s}s elapsed',
  moduleStats: '{ok}/{total} probes OK',
  runModule: 'Run this module',
  rerunModule: 'Re-run this module',
  privacyNote: 'Probes are sent directly from your machine and stored locally. Vantage points only see the egress and the diagnostic target; evidence is size-capped and sanitized.',
  empty: 'No diagnostics yet. Click "Run all", or run a single module below.',
  verifiedAt: 'Target list verified on {date}',
  historyBanner:
    'Viewing a history snapshot ({time} · run {runId}), unrelated to the current network. Starting a new run switches back to live view.',
  overview: {
    title: 'Run overview',
    httpExits: '{n} HTTP egress(es) observed',
    splitGotIp: '{n} sites returned an exit IP',
    splitReachOnly: '{n} reachable only',
    failed: '{n} failed',
    dnsExits: '{n} DNS recursive exits (counted separately)',
    multiExitNote: 'Multiple exits can come from normal split-tunnel rules — not an anomaly by itself; counts are deduplicated by unique IP.',
    nothingYet: 'No results yet'
  },
  module: {
    publicIp: 'Public IP',
    splitTunnel: 'Website split tunneling',
    cdnNode: 'CDN edge node',
    dnsExit: 'DNS exit lookup'
  },
  tabDesc: {
    publicIp: 'The public egress observed by external services (not your LAN address); IPv4 / IPv6 in separate rows.',
    splitTunnel: 'Which exit each site sees; differences can come from normal split rules.',
    cdnNode: 'Which CDN node served this request; node location does not represent where you are.',
    dnsExit: 'The exit a recursive resolver exposes to authoritative DNS; usually NOT your public IP.'
  },
  status: {
    queued: 'Queued',
    running: 'Running',
    success: 'OK',
    partial: 'Partial',
    failed: 'Failed',
    timeout: 'Timed out',
    canceled: 'Canceled',
    skipped: 'Skipped',
    unsupported: 'Unsupported',
    pending: 'Not started'
  },
  statusLong: {
    gotExit: 'Exit obtained',
    reachOnly: 'Reachable, no exit IP provided',
    gotNode: 'Node obtained',
    dnsAnswered: 'Answered, no recursive exit',
    dnsOnlyEcs: 'ECS / TXT only'
  },
  via: {
    'main-http': 'Main-process HTTP (system proxy)',
    'node-direct': 'Node direct (no app-layer proxy)',
    'dns-udp': 'Local UDP DNS',
    'browser-page': 'Hidden browser page'
  },
  mech: {
    'http-proxy': 'HTTP request following the system proxy',
    'node-direct': 'Node https direct (no app-layer proxy)',
    'dns-udp': 'UDP 53 direct to resolver',
    'page': 'Page-flow extraction'
  },
  mechNote: {
    'http-proxy': 'Follows the system proxy like the browser; proxies configured only in a browser extension are not on this path.',
    'node-direct':
      'Node HTTPS does not use an app-layer proxy, but this does not mean it bypasses all system routing or TUN; it only describes its own path, not others.',
    'dns-udp': 'udp4 / udp6 chosen by server address.',
    'page': 'Reuses the page’s own detection flow and reads its displayed results.'
  },
  family: {
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    unknown: 'Unknown'
  },
  category: {
    all: 'All categories',
    cn: 'CN',
    intl: 'Intl',
    ai: 'AI',
    dev: 'Dev'
  },
  col: {
    site: 'Website / domain',
    category: 'Category',
    exit: 'Observed exit IP',
    geo: 'Country/Region · ISP',
    status: 'Status',
    actions: 'Actions',
    vantage: 'Vantage point',
    family: 'Family',
    geoFull: 'Country & network',
    mech: 'Mechanism',
    cdn: 'CDN',
    host: 'Test domain',
    node: 'Raw node ID',
    cache: 'Cache signals',
    ms: 'Latency',
    resolver: 'Resolver',
    server: 'Server',
    recExit: 'Recursive exit',
    ecs: 'ECS subnet'
  },
  geo: {
    notFetched: 'Not fetched',
    source: 'Geo source: {source} · {time}',
    inline: 'Provided by the target'
  },
  action: {
    copyIp: 'Copy IP',
    copyTable: 'Copy table',
    copied: 'Copied',
    retryItem: 'Retry',
    retryFailed: 'Retry failed',
    detail: 'Details'
  },
  search: 'Search website or domain…',
  filter: {
    failOnly: 'Failures / no IP only',
    groupByExit: 'Group by exit',
    exitGroup: 'Exit {label} ({n} targets)',
    exitLabelA: 'A',
    exitLabelB: 'B',
    exitLabelC: 'C',
    exitLabelD: 'D',
    exitLabelE: 'E',
    reachOnlyGroup: 'No exit obtained ({n} targets)'
  },
  reachOnlyText: 'Reachable, no exit IP provided.',
  noNode: 'No node info provided',
  noCache: 'No cache signals provided',
  cacheOrderNote: 'Cache signals are kept in response order (segments not merged).',
  cdnNote: 'Node IDs are raw values (not truncated); a CDN node location is not the exit IP’s city; HTTP latency is not ICMP ping.',
  dns: {
    groupSystem: 'System-configured resolver',
    groupPublic: 'Specified public DNS (direct UDP)',
    publicNote:
      'Results for specified public DNS show the recursive exit when querying that server — they do not represent the browser’s actual DNS. This test cannot fully cover browser secure DNS (DoH), in-app DoH, proxy-side remote resolution, or all system split-DNS rules.',
    dnsLeakNote: 'A DNS exit differing from the HTTP exit is common and alone does not indicate a “DNS leak”.',
    exitSource: 'Exit semantics: {v}',
    exitSourceNs: 'ns segment (Akamai official: recursive resolver exit)',
    exitSourceTxt: 'bare-IP TXT record (Google official: recursive resolver exit)',
    noExit: 'Not obtained',
    ecsRepLabel: 'ECS representative address (not the resolver exit)',
    recordsLabel: 'Answer TXT records ({n})'
  },
  detail: {
    url: 'Request URL',
    method: 'Method',
    mech: 'Mechanism',
    family: 'Family',
    http: 'HTTP status',
    ms: 'Latency',
    time: 'Measured at',
    source: 'Data source',
    sourceUrl: 'Source reference',
    records: 'TXT records',
    attempts: 'Attempt history',
    firstAt: 'First: {time}',
    retriedAt: 'Attempt #{n}: {time} · {status}',
    evidence: 'Raw evidence (truncated / sanitized)',
    historyNoEvidence: 'History snapshots do not include raw evidence.'
  },
  save: {
    toHistory: 'Save to history',
    saved: 'Saved',
    kindBadge: 'Exit-diagnostics snapshot',
    savedHint: 'Saved as a standalone history record — view, export, or send to AI from the History page.'
  },
  compare: {
    title: 'Snapshot compare',
    desc: 'Compare two runs by the same target, family and mechanism: exit, node and status.',
    pick: 'Pick a snapshot',
    run: 'Compare',
    a: 'Current',
    b: 'History {time}',
    changed: 'Exit changed',
    same: 'Same',
    missing: 'Missing (not counted as a change)',
    noPairs: 'No common targets between the two snapshots.'
  }
}
