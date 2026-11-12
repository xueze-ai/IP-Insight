export const enWhoami = {
  kicker: 'What the Web Sees · no permission needed',
  title: 'What the web sees',
  desc:
    'No "allow" button is involved. Sites read your egress IP, TLS shape and DNS resolver egress on the wire, plus screen, GPU, fonts and Canvas locally. This page lays every item out — including the ones you cannot measure here but every server can see.',
  count: '{n} probes · no permission needed',
  tabs: {
    overview: 'Overview',
    items: 'All probes',
    disguise: 'Disguise check',
    toolbox: 'Network toolbox'
  },
  scanning: 'Reading…',
  rescan: 'Re-scan',
  copyText: 'Copy as text',
  copyJson: 'Copy JSON',
  copied: 'Copied',
  privacy: 'Every reading is computed on this machine. Nothing is sent to third parties or counted anywhere.',
  empty: 'No results yet — hit Re-scan.',
  overview: {
    summaryTitle: 'In one sentence',
    gradeLabel: 'Exposure',
    grade: {
      A: 'A · hard to single out',
      B: 'B · a few narrowing signals',
      C: 'C · several linkable signals',
      D: 'D · recognisable over time'
    },
    gradeNote: '{bad} hard conflicts · {warn} worth noting',
    noConflict: 'No hard conflicts. Everything left is public information that always leaks.',
    addrTitle: 'Address & network',
    envTitle: 'Device & environment',
    stabilityTitle: 'Fingerprint stability',
    stabilityFirst: 'First record on this machine. Reopen this page to see which components stay the same.',
    stabilityLine: '{unchanged} of {total} components are identical to last time.',
    stabilityChanged: 'Changed: {list}',
    stabilityStable: 'Nothing changed: sites recognise you without cookies.',
    idLabel: 'Fingerprint ID',
    baselineReset: 'Clear baseline',
    rtbTitle: 'What an ad exchange would receive',
    rtbDesc:
      'A bid request assembled from this page, using common OpenRTB field names. Real requests also carry platform IDs and the ad slot; interest labels come from profiles, not these readings.',
    rtbNote: 'Nothing here is ever sent anywhere.'
  },
  items: {
    search: 'Search probes or values',
    noResult: 'No matching items.',
    colItem: 'Probe',
    colValue: 'Value read',
    colSource: 'How it is read',
    all: 'All',
    unavailable: 'Not readable here',
    error: 'Read error',
    why: 'What a site can do with it',
    levelHigh: 'Strong ID',
    levelMid: 'Narrows',
    levelLow: 'Public',
    partial: 'Partial',
    serverOnly: 'Server-side only'
  },
  disguise: {
    title: 'Disguise check',
    desc: 'Compare what you claim with what is actually read. Only evidence-backed conflicts are reported; anything weaker is marked "not judged here".',
    count: '{n} spots may expose you',
    clean: 'No conflicts found.',
    advice: 'How to fix',
    ok: 'Consistent',
    info: 'Note',
    warn: 'Worth noting',
    bad: 'Conflict'
  },
  region: {
    title: 'Pretend to be elsewhere?',
    desc: 'Pick a target region and see exactly what is still missing. Only values actually read are compared; IP, timezone, language and DNS egress must all agree.',
    allOk: 'All {n} readable checks line up.',
    summary: '{n} of {total} checks line up, {missing} missing.'
  },
  tools: {
    note: 'All measurements are real: traceroute calls the system tracert, diagnostics run real TCP / DNS / HTTP probes, and the CDN radar hits public performance endpoints directly.',
    traceroute: {
      title: 'Traceroute',
      desc: 'See every router hop. No reverse DNS (-d), three probes per hop.',
      target: 'Target host or IP',
      placeholder: 'e.g. 1.1.1.1',
      run: 'Trace',
      running: 'Tracing…',
      colHop: 'Hop',
      colRtt: 'RTT',
      colAddr: 'Address',
      timeout: 'timeout',
      noData: 'No results yet.',
      empty: 'No hops parsed.'
    },
    diagnose: {
      title: 'Diagnostics',
      desc: 'Local addresses, DNS servers and resolution, TCP 443 reachability, HTTP latency, NIC MTU.',
      run: 'Run diagnostics',
      running: 'Running…',
      noData: 'No results yet.',
      check: {
        'local-ip': 'Local address',
        'dns-servers': 'DNS servers',
        'dns-resolve': 'DNS resolution',
        'tcp-cloudflare': 'Cloudflare 443',
        'tcp-github': 'GitHub 443',
        'tcp-baidu': 'Baidu 443',
        'http-latency': 'HTTP latency',
        mtu: 'NIC MTU'
      }
    },
    radar: {
      title: 'CDN radar',
      desc: 'Query 10 public CDN performance endpoints at once; read back node IDs, cache signals and timing.',
      run: 'Probe',
      running: 'Probing…',
      noData: 'No results yet.',
      colCdn: 'CDN',
      colNode: 'Node',
      colCache: 'Cache signal',
      colMs: 'Time'
    },
    shortcuts: {
      title: 'More tools',
      desc: 'Capabilities that already exist — jump straight there.',
      speedtest: 'Speed test',
      speedtestDesc: 'Real Cloudflare down/up, latency, jitter',
      ipQuality: 'IP quality',
      ipQualityDesc: 'Risk score plus native / broadcast / proxy verdicts',
      exitDiag: 'Exit diagnostics',
      exitDiagDesc: 'Egress, split routing, CDN nodes, DNS egress',
      fingerprint: 'Browser fingerprint',
      fingerprintDesc: 'Multi-source fingerprint comparison and details'
    }
  }
}
