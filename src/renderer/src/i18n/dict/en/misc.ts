import type { zhMisc } from '../zh/misc'

export const enMisc: typeof zhMisc = {
  tri: {
    found: 'Found',
    clear: 'Not found',
    conflict: 'Sources disagree',
    unknown: 'Unknown',
    nodata: 'No data'
  },
  flagText: {
    hit: 'Hit',
    miss: 'Miss',
    na: 'N/A'
  },
  netType: {
    residential: 'Residential',
    datacenter: 'Datacenter',
    hosting: 'Hosting'
  },
  riskLevels: {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical'
  },
  riskScale: {
    trust: 'Trust score · higher is safer',
    ping0: 'Risk value · higher is riskier',
    ippure: 'IPPure coefficient · higher is riskier'
  },
  consistency: {
    mainExit: 'Primary egress: {ip} ({n} sources)',
    unknown: 'Unknown',
    otherExit: 'Other egress: {ip} ({names}; differs from primary egress, not directly compared)',
    flagLine: '{label}: {text}{detail}',
    conflictDetail: ' ({items})',
    sourceVerdict: '{source}: {verdict}',
    note: 'Note: Net.Coffee and IPPure share some backend; Ping0 is relatively independent.'
  },
  report: {
    inconsistent: 'Sources disagree',
    flagLabels: {
      residential: 'Residential',
      datacenter: 'Datacenter',
      hosting: 'Hosting'
    },
    rows: {
      publicIp: 'Public IP',
      isp: 'ISP',
      org: 'Organization',
      location: 'Location',
      coords: 'Coordinates',
      timezone: 'Timezone',
      netType: 'Network type',
      risk: 'Risk label',
      native: 'Nativeness',
      shared: 'Shared egress',
      flags: 'Attribute flags',
      blacklist: 'DNSBL',
      dnsLeak: 'DNS leak',
      webrtcLeak: 'WebRTC leak',
      ping: 'Global ping',
      speed: 'Local speedtest',
      fingerprint: 'Browser fingerprint',
      scenarios: 'Scenario scores'
    },
    blacklistValue: '{listed}/{checked} listed{names}',
    blacklistNames: ': {names}',
    leakValue: '{status}{exit}',
    leakExit: ' (egress {ip})',
    speedValue: 'Down {down} Mbps / Up {up} Mbps',
    fpVisitor: 'Combined {id}',
    matrix: {
      publicIp: 'Public IP',
      location: 'Location',
      netType: 'Network type',
      risk: 'Risk label'
    },
    summary: {
      isp: 'ISP',
      netType: 'Network type',
      country: 'Country / Region',
      region: 'State / Province',
      city: 'City',
      timezone: 'Timezone',
      coords: 'Lat / Lon',
      proxy: 'Proxy',
      crawler: 'Crawler',
      native: 'Nativeness',
      dnsLeak: 'DNS leak',
      webrtcLeak: 'WebRTC leak',
      blacklist: 'DNSBL',
      blacklistValue: '{listed} / {checked} listed'
    }
  },
  speedtest: {
    failed: 'Speed test failed; no bandwidth data obtained'
  },
  ai: {
    alreadyRunning: 'An analysis is already running',
    failed: 'AI analysis failed'
  },
  shell: {
    brandAlt: 'IP Insight',
    brandSub: 'IP Insight · IP Check Assistant',
    groupDetect: 'Detect',
    collapseNav: 'Collapse navigation',
    toggleTheme: 'Toggle theme'
  },
  placeholderDesc: 'This module will be completed in a later phase; the underlying data collection and all source Adapters are ready and verified by real tests.'
}
