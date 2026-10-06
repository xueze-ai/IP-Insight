import type { zhComponents } from '../zh/components'

export const enComponents: typeof zhComponents = {
  multiSource: {
    dims: {
      residential: 'Residential IP',
      datacenter: 'Datacenter',
      vpn: 'VPN',
      proxy: 'Proxy',
      tor: 'Tor'
    },
    exitChatGpt: 'ChatGPT egress',
    exitOther: 'Other egress',
    exitTitle: '{label} · Standalone profile',
    sourcesCovered: '{n} sources',
    typeResidential: 'Residential',
    typeDatacenter: 'Datacenter',
    typeUnknown: 'Undetermined',
    riskScore: 'Score {score}',
    noRiskScore: 'No risk score',
    noLocation: 'No location info',
    exitNoteMain:
      'This egress IP differs from the primary egress; its type verdict is not directly compared with the primary one; ',
    exitNoteSingle: 'Covered by only 1 data source; cross-source verification is not possible.',
    exitNoteMulti: 'Compared across the sources covering this egress.',
    viewSource: 'View source site',
    openSourceManual: 'Open source site manually',
    badgeOk: 'Check passed',
    badgeBad: 'Unavailable',
    duration: 'Elapsed {sec}s',
    completeness: 'Data completeness {pct}%',
    rawShow: 'Raw results',
    rawHide: 'Hide raw results',
    sourceUnavailable:
      'This data source is temporarily unavailable (timeout / access restricted / manual verification required).',
    consistencyTitle: 'Multi-source consistency · Primary egress',
    mainExitCovered: '{n} sources cover the primary egress',
    consistencySummary: 'Of {total} judgeable dimensions, {agrees} agree across covering sources.',
    hasConflict: 'Conflicting items cannot be confirmed for now and are marked as-is.',
    noConflict: 'No disagreement found among judgeable dimensions.',
    dimAgree: 'Consistent',
    dimConflict: 'Disagreement',
    dimNoData: 'No data',
    resultsTitle: 'Multi-source results'
  },
  exportDialog: {
    title: 'Export detection report',
    formats: {
      html: 'Self-contained web page; open in a browser; collapsible raw results',
      pdf: 'A4-formatted document, same layout as HTML, good for archiving and sharing',
      json: 'Full structured data with per-source raw results, good for further processing',
      txt: 'Plain-text report, good for quick reading and pasting'
    },
    reportIncludes:
      'Report includes: detection time ({start} — {end}), public IP ({ip}), {total} data source statuses, key-field multi-source aggregation, multi-source comparison, per-source raw results{aiPart}.',
    withAi: ', AI analysis',
    withoutAi: ' (AI analysis not included this time)',
    exportFailed: 'Export failed',
    locate: 'Locate',
    exporting: 'Exporting…',
    exportAgain: 'Export again',
    save: 'Save'
  }
}
