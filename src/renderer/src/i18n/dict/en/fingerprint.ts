import type { zhFingerprint } from '../zh/fingerprint'

export const enFingerprint: typeof zhFingerprint = {
  startDetection: 'Start full detection',
  leakNotChecked: 'Not checked',
  openIppure: 'Open IPPure fingerprint page',
  viewGptSource: 'View GPT source website',
  empty: {
    intro: 'Fingerprint data is computed by the Net.Coffee GPT source inside the hidden browser.',
    failed: 'This source failed in the last detection: {reason}',
    hint: 'Complete a full detection first to view it.'
  },
  tz: {
    consistent: 'Matches ChatGPT egress timezone',
    inconsistent: 'Does not match ChatGPT egress timezone',
    unknown: 'Unknown'
  },
  kicker: 'Browser Fingerprint · Measured in hidden browser',
  desc: 'The environment fingerprint below comes from the built-in hidden browser (Chromium) used for detection. It is computed by the Net.Coffee GPT source with fixed rendering inside the page, stable and reproducible. It is used to assess the fingerprint exposure of the detection egress and may differ from your daily browser. Uncollected items show "—".',
  group: {
    browser: 'Browser',
    device: 'Device',
    graphics: 'Graphics & Audio',
    privacy: 'Privacy consistency'
  },
  row: {
    browser: 'Browser',
    os: 'OS',
    language: 'Language',
    cookie: 'Cookie',
    screen: 'Screen resolution',
    colorDepth: 'Color depth',
    cpuThreads: 'CPU threads',
    deviceMemory: 'Device memory',
    deviceMemoryVal: '{gb} GB (browser-reported upper limit)',
    gpuRenderer: 'GPU renderer',
    webgl: 'WebGL fingerprint',
    canvas: 'Canvas fingerprint',
    audio: 'Audio fingerprint',
    timezone: 'Timezone',
    tzConsistency: 'Timezone consistency',
    dnsLeak: 'DNS leak',
    webrtcLeak: 'WebRTC leak'
  },
  cookie: {
    enabled: 'Enabled',
    disabled: 'Disabled'
  },
  full: {
    title: 'Fingerprint · Combined fingerprint',
    fontCount: '{n} fonts detected',
    prefLanguage: 'Preferred languages',
    rerun: 'Re-run full detection to get the new fingerprint fields',
    desc: 'The combined fingerprint ID is hashed locally from Canvas / WebGL / audio / screen / timezone / language / thread count. It is only for before-after comparison by yourself (e.g. whether it changes after switching proxy or browser kernel). It is not a cross-site tracking ID and is never uploaded to any server.',
    legacyNote: '(This detection used an older adapter version; this item is unavailable)'
  },
  detail: {
    expand: 'View detailed fingerprint',
    collapse: 'Collapse detailed fingerprint',
    prefLanguageList: 'Preferred language list',
    fontListTitle: 'Detected fonts (width-difference method, computed in browser)',
    noFonts: 'No candidate fonts detected',
    fontsNotCollected: 'Font items were not collected in this detection',
    rawJson: 'Raw fingerprint JSON'
  }
}
