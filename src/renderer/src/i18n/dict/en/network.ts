import type { zhNetwork } from '../zh/network'

export const enNetwork: typeof zhNetwork = {
  kicker: 'Network Quality · Local measurements + global nodes',
  intro:
    'Download / Upload / Ping / Jitter are measured by the built-in official Cloudflare speed test engine in a hidden window; global node latency is provided by Net.Coffee; service availability aggregates each service’s official status page.',
  idleDesc:
    'The speed test runs the official Cloudflare measurement engine in a hidden window in the background, taking about 1–2 minutes (faster connections take longer). You can keep using other pages during the test; results stay on this page. Packet loss relies on WebRTC TURN relay and shows “Not measured” when unreachable from the current network.',
  startSpeedtest: 'Start speed test',
  phase: {
    preparing: 'Loading speed test page / starting engine',
    starting: 'Starting measurement engine',
    latency: 'Latency (Ping / Jitter)',
    download: 'Download',
    upload: 'Upload',
    finished: 'Done',
    error: 'Error'
  },
  running: {
    elapsed: 'Elapsed {s}s',
    desc: 'The engine ramps up load in stages to approach true bandwidth, sampling latency between load rounds. Runs in a hidden window in the background — no popups, no blocking.'
  },
  error: {
    badge: 'Speed test failed',
    hint: 'You can retry once the network recovers.'
  },
  downloadLabel: 'Download',
  uploadLabel: 'Upload',
  kv: {
    ping: 'Idle ping',
    jitter: 'Idle jitter',
    loadedPingDown: 'Loaded ping / jitter (download)',
    loadedPingUp: 'Loaded ping / jitter (upload)',
    loss: 'Packet loss',
    lossTitle: 'Requires WebRTC TURN relay; unavailable when unreachable from the current network',
    exitIp: 'Speed test egress IP',
    exitIpDetail: '({colo}{suffix})',
    exitIpSep: ' · {loc}',
    duration: 'Total time',
    durationSec: '{n} s',
    time: 'Measured at'
  },
  notMeasured: 'Not measured',
  lossNote: 'Packet loss requires WebRTC TURN relay; unavailable when unreachable from the current network.',
  aim: {
    title: 'Experience scores · Cloudflare AIM',
    streaming: 'Streaming',
    gaming: 'Gaming',
    rtc: 'Video calls',
    noScore: '{label}: —',
    note: 'Categories are computed live by the official Cloudflare engine from this run’s latency / jitter / bandwidth — not fixed values.'
  },
  retest: 'Re-run speed test',
  viewSource: 'View original site',
  rawShow: 'Show raw measurements',
  rawHide: 'Hide raw measurements',
  ping: {
    title: 'Global node latency · Net.Coffee',
    node: 'Node',
    min: 'Min',
    avg: 'Avg',
    max: 'Max',
    asia: 'Asia',
    america: 'Americas',
    europe: 'Europe',
    other: 'Other',
    unreachable: 'Unreachable',
    note: 'Source: Net.Coffee global speed test nodes from this scan (server cache or live measurement; min/avg/max use the site’s methodology). “Unreachable” means the node did not respond this time.',
    empty:
      'Global node latency is provided by Net.Coffee. Complete a scan on the “Dashboard” page first; this page will then show min / avg / max latency for 20 nodes grouped by Asia / Americas / Europe.'
  },
  svc: {
    title: 'Service availability · Net.Coffee aggregate',
    sourceSite: 'Source site',
    feedError: 'Failed to fetch service status',
    sourceDown: '(this data source is temporarily unavailable)',
    failing: '{n} services degraded',
    allOk: 'All operational',
    meta: '{count} services · site aggregated at {fetchedAt} · fetched locally at {fetchedLocalAt}',
    incidentsTitle: 'Current incidents on degraded services',
    incidentLine: '· {name}: {incident}',
    incidentStatus: '({status})',
    unknown: 'Unknown'
  },
  reach: {
    title: 'Local reachability · real HTTP probes',
    start: 'Start probing',
    redetect: 'Re-probe',
    probeError: 'Reachability probe failed',
    ok: 'Reachable · {ms} ms',
    fail: 'Unreachable',
    failMs: 'Unreachable · {ms} ms',
    probedAt: 'Probed at: {time}',
    note: 'Probes run inside a hidden browser page (same network stack and request headers as a real browser, honoring the system proxy). Any response counts as reachable; network-level failure (still failing after 1 retry) or an 8s timeout counts as unreachable with the real error shown. If your proxy is only set in a browser extension rather than the system proxy, these probes do not go through it. Results reflect the moment of probing only.'
  }
}
