import type { zhIpinfo } from '../zh/ipinfo'

export const enIpinfo: typeof zhIpinfo = {
  startDetection: 'Start full detection',
  differ: 'Sources differ in wording',
  conflict: 'Multi-source mismatch',
  none: 'None',
  kicker: 'IP Information · Public IP',
  coverage: '{n} data sources cover the main egress',
  latest: ' · Last checked {date}',
  othersNote: 'Other egress IPs ({ips}, e.g. the ChatGPT egress) are profiled separately in the standalone egress cards under "Dashboard → Full results" and are not directly compared with the main egress.',
  rangeFmt: '{first} – {last} ({count} addresses, /{prefix})',
  empty: {
    title: 'No IP information',
    desc: 'Complete a full detection first to view the aggregated network and location info.'
  },
  section: {
    network: 'Network',
    location: 'Location'
  },
  row: {
    isp: 'ISP',
    asn: 'ASN',
    org: 'Organization',
    netType: 'Network type',
    country: 'Country',
    region: 'Region / State',
    city: 'City',
    timezone: 'Timezone',
    lat: 'Latitude',
    lon: 'Longitude'
  },
  netTypeVal: {
    residential: 'Residential',
    datacenter: 'Datacenter',
    hosting: 'Hosting'
  },
  ext: {
    title: 'Extended network info · Net.Coffee lookup (single source, not cross-validated)',
    viewSource: 'View source site',
    rdns: 'rDNS',
    rpki: 'RPKI status',
    regCountry: 'Registered country/region',
    asnKind: 'ASN type',
    asnBandwidth: 'ASN bandwidth',
    asnIpv4: 'ASN IPv4 size',
    asnAllocated: 'ASN allocated',
    dcName: 'Datacenter name'
  }
}
