import type { WhoRawItem, WhoServerFacts } from '@shared/whoami'
import type { FpStability } from './fingerprint'

// =============================================================
// 伪装检测：把「你自报的」和「实际读到的」放在一起比。
//
// 原则：只报有证据的冲突。证据不足的项（例如需要服务端才能观测的 TCP 指纹）
// 不进结论，最多作为「无法在本机判定」的说明，避免把正常情况误判成泄露。
// 每条都给出改法，且区分「真的是问题」与「只是更容易被认出来」。
// =============================================================

export type CheckLevel = 'ok' | 'info' | 'warn' | 'bad'

export interface DisguiseCheck {
  id: string
  level: CheckLevel
  zh: { title: string; finding: string; advice?: string }
  en: { title: string; finding: string; advice?: string }
}

function tzOffsetOf(zone: string, at = new Date()): number | null {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at)
    const off = s.find((p) => p.type === 'timeZoneName')?.value ?? ''
    if (off === 'GMT') return 0
    const m = off.match(/GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?/)
    if (!m) return null
    const sign = m[1] === '-' ? -1 : 1
    return sign * (Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60)
  } catch {
    return null
  }
}

function regionName(region: string, lang: string): string | null {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(region) ?? null
  } catch {
    return null
  }
}

export interface CheckInput {
  readings: WhoRawItem[]
  facts?: WhoServerFacts
  stability: FpStability
}

export function evaluateDisguise(input: CheckInput): DisguiseCheck[] {
  const { readings, facts, stability } = input
  const m = new Map(readings.map((r) => [r.id, r]))
  const v = (id: string): string | null => m.get(id)?.value ?? null
  const out: DisguiseCheck[] = []

  // 1. 时区 vs IP 时区
  const ipTz = v('server.ipTimezone')
  const sysTz = v('locale.timezone')?.split(' · ')[0]
  if (ipTz && sysTz) {
    const a = tzOffsetOf(sysTz)
    const b = tzOffsetOf(ipTz)
    if (a != null && b != null) {
      const same = a === b
      out.push({
        id: 'tz-ip',
        level: same ? 'ok' : 'warn',
        zh: {
          title: '时区和 IP 反馈',
          finding: same ? `两边都是 UTC${b >= 0 ? '+' : ''}${b}` : `系统时区 ${sysTz}（UTC${a >= 0 ? '+' : ''}${a}），IP 所在时区 ${ipTz}（UTC${b >= 0 ? '+' : ''}${b}）`,
          advice: same ? undefined : '让系统时区与出口 IP 所在地区一致，或接受「你在异地」这个事实'
        },
        en: {
          title: 'Timezone vs IP',
          finding: same ? `Both UTC${b >= 0 ? '+' : ''}${b}` : `System ${sysTz} (UTC${a >= 0 ? '+' : ''}${a}), IP ${ipTz} (UTC${b >= 0 ? '+' : ''}${b})`,
          advice: same ? undefined : 'Match the OS timezone to the egress region, or accept that you look like a traveller'
        }
      })
    }
  }

  // 2. 语言 vs IP 地区
  const lang = v('locale.browserLanguage')
  const country = facts?.geo?.country
  if (lang && country) {
    const region = lang.split('-')[1]?.toUpperCase()
    const name = region ? regionName(region, lang.startsWith('zh') ? 'zh-CN' : 'en') : null
    const match = name && country ? cityMatch(name, country) : false
    out.push({
      id: 'lang-ip',
      level: match ? 'ok' : 'info',
      zh: {
        title: '语言和 IP 反馈',
        finding: match
          ? `浏览器首选 ${lang}，与 IP 地区一致`
          : `浏览器首选 ${lang}，IP 在${country}：语言与所在地不一致，但英语/中文在任何地方都有人用，单凭这一项说明不了什么`,
        advice: match ? undefined : '如果想让地区看起来一致，把首选语言改成当地语言；不改也不会直接暴露'
      },
      en: {
        title: 'Language vs IP',
        finding: match
          ? `Preferred ${lang}, consistent with the IP region`
          : `Preferred ${lang}, while the IP is in ${country}: not a contradiction on its own — English and Chinese are used everywhere`,
        advice: match ? undefined : 'To look local, set the preferred language accordingly; otherwise this alone proves little'
      }
    })
  }

  // 3. DNS 出口 vs IP 国家
  const dnsGeo = v('server.dnsResolverGeo')
  if (dnsGeo && country) {
    const same = cityMatch(dnsGeo, country) || dnsGeo.includes(country) || country.includes(dnsGeo.split(' · ')[0] ?? '')
    out.push({
      id: 'dns-ip',
      level: same ? 'ok' : 'bad',
      zh: {
        title: 'DNS 泄露',
        finding: same
          ? `DNS 出口归属（${dnsGeo}）与 IP 地区一致`
          : `解析器出口在${dnsGeo}，IP 却在${country}：两边对不上，是代理环境最典型的痕迹`,
        advice: same ? undefined : '让 DNS 也走代理（TUN 模式 + fake-ip，或把 DNS 指向节点所在地的解析器）后重测'
      },
      en: {
        title: 'DNS leak',
        finding: same
          ? `Resolver egress (${dnsGeo}) matches the IP region`
          : `Resolver exits in ${dnsGeo} while the IP is in ${country}: the classic proxy tell`,
        advice: same ? undefined : 'Route DNS through the proxy too (TUN mode with fake-ip, or a resolver in the egress region), then re-test'
      }
    })
  }

  // 4. WebRTC 泄露
  const rtcPub = v('device.webrtcPublic')
  const ip = v('server.ip')
  if (rtcPub && ip) {
    const leak = rtcPub !== ip
    out.push({
      id: 'webrtc',
      level: leak ? 'bad' : 'ok',
      zh: {
        title: 'WebRTC 泄露',
        finding: leak ? `WebRTC 拿到公网地址 ${rtcPub}，与代理出口 ${ip} 不同：真实地址绕过了代理` : 'WebRTC 没有拿到与代理出口不同的公网地址',
        advice: leak ? '在浏览器里关掉 WebRTC，或让代理接管 UDP；指纹浏览器也常单独处理这一项' : undefined
      },
      en: {
        title: 'WebRTC leak',
        finding: leak ? `WebRTC public address ${rtcPub} differs from the proxy egress ${ip}` : 'No WebRTC public address beyond the proxy egress',
        advice: leak ? 'Disable WebRTC or let the proxy carry UDP' : undefined
      }
    })
  }

  // 5. 虚拟显卡 / 软件渲染
  const virt = v('device.virtualization')
  if (virt) {
    const bad = virt.startsWith('检测到')
    const unread = virt.startsWith('读不到')
    out.push({
      id: 'gpu',
      level: bad ? 'warn' : unread ? 'info' : 'ok',
      zh: {
        title: '显卡与渲染方式',
        finding: virt,
        advice: bad ? '打开浏览器硬件加速；远程桌面或虚拟机环境本身就容易被识别，属于环境特征而非可隐藏项' : undefined
      },
      en: {
        title: 'GPU & rendering',
        finding: bad ? 'Software rendering or a virtual GPU detected' : unread ? 'GPU unreadable: WebGL is unavailable, so virtualisation cannot be judged' : 'Normal GPU, no software-rendering traces',
        advice: bad ? 'Enable hardware acceleration; a VM or remote desktop is itself a detectable environment' : undefined
      }
    })
  }

  // 6. 机房 / 代理标记
  const netType = v('server.netType')
  if (netType) {
    const bad = /机房|代理/.test(netType) && !/非机房 · 未标代理/.test(netType)
    out.push({
      id: 'ip-type',
      level: bad ? 'warn' : 'ok',
      zh: {
        title: 'IP 类型',
        finding: netType,
        advice: bad ? '机房 IP 常被风控重点照顾；住宅或移动出口更接近普通用户' : undefined
      },
      en: {
        title: 'IP type',
        finding: netType,
        advice: bad ? 'Datacenter IPs draw more scrutiny; residential or mobile egress looks ordinary' : undefined
      }
    })
  }

  // 7. 多个出口 / 分流
  const egress = v('server.egress')
  const ipCount = facts?.egress.filter((e) => e.ip).length ?? 0
  if (ipCount > 1) {
    out.push({
      id: 'egress',
      level: 'info',
      zh: {
        title: '出口与分流',
        finding: `本次有 ${ipCount} 个站点看到了不同出口：${facts?.egress.map((e) => `${e.host}=${e.ip ?? '—'}`).join('，')}`,
        advice: '分流本身不是异常；但如果同一个站点在不同时间看到不同出口，行为会显得不稳定'
      },
      en: {
        title: 'Egress & split routing',
        finding: `${ipCount} sites saw different egress IPs: ${facts?.egress.map((e) => `${e.host}=${e.ip ?? '—'}`).join(', ')}`,
        advice: 'Split routing is not a fault; unstable egress for the same site is what looks odd'
      }
    })
  }

  // 8. 时钟偏差
  const skew = facts?.clockSkewMs
  if (skew != null) {
    const big = Math.abs(skew) > 30_000
    out.push({
      id: 'clock',
      level: big ? 'warn' : 'ok',
      zh: {
        title: '时钟偏差',
        finding: `本机比服务器${skew > 0 ? '快' : '慢'} ${(Math.abs(skew) / 1000).toFixed(1)} 秒`,
        advice: big ? '开启系统自动校时；大偏差常见于虚拟机快照恢复或长期休眠' : undefined
      },
      en: {
        title: 'Clock skew',
        finding: `${(Math.abs(skew) / 1000).toFixed(1)}s ${skew > 0 ? 'ahead of' : 'behind'} the server`,
        advice: big ? 'Enable automatic time sync; large drift is common after VM restores or long sleeps' : undefined
      }
    })
  }

  // 9. Tor
  if (facts?.torExit === true) {
    out.push({
      id: 'tor',
      level: 'bad',
      zh: { title: 'Tor 出口', finding: '出口 IP 在公开的 Tor 出口节点列表里', advice: 'Tor 出口几乎必然被风控标记；需要匿名时优先考虑其他方案' },
      en: { title: 'Tor exit', finding: 'The egress IP is on the public Tor exit list', advice: 'Tor exits are flagged almost everywhere' }
    })
  }

  // 10. 自动化
  const auto = v('browser.automation')
  const traces = v('browser.automationTraces')
  if (auto || traces) {
    const bad = /真/.test(auto ?? '') || (traces ? !/未发现/.test(traces) : false)
    out.push({
      id: 'automation',
      level: bad ? 'bad' : 'ok',
      zh: {
        title: '自动化痕迹',
        finding: bad ? `${auto ?? ''}${traces && !/未发现/.test(traces) ? ` · ${traces}` : ''}` : '没有 webdriver 或自动化框架痕迹',
        advice: bad ? '这类痕迹无法通过普通设置消除；用自动化工具访问时请预期被识别' : undefined
      },
      en: {
        title: 'Automation traces',
        finding: bad ? 'webdriver or framework markers present' : 'No webdriver or framework markers',
        advice: bad ? 'Not removable by ordinary settings; expect to be detected' : undefined
      }
    })
  }

  // 11. UA 与本机能力
  const uaOs = v('device.os')
  const platform = v('headers.secChUaPlatform')
  if (uaOs && platform) {
    const mismatch = !uaOs.startsWith(platform)
    out.push({
      id: 'ua-os',
      level: mismatch ? 'warn' : 'ok',
      zh: {
        title: 'UA 和真实系统',
        finding: mismatch ? `UA 说 ${uaOs}，Client Hints 却报 ${platform}` : `两边一致：${uaOs}`,
        advice: mismatch ? 'UA 与平台提示要一起改；只改 UA 反而更显眼' : undefined
      },
      en: {
        title: 'UA vs real OS',
        finding: mismatch ? `UA says ${uaOs}, Client Hints says ${platform}` : `Consistent: ${uaOs}`,
        advice: mismatch ? 'Change both the UA and the platform hint; changing UA alone stands out' : undefined
      }
    })
  }

  // 12. HTTP/3
  const http = v('server.http')
  if (http) {
    const h3 = http.includes('3')
    out.push({
      id: 'http3',
      level: h3 ? 'ok' : 'info',
      zh: {
        title: 'HTTP/3',
        finding: h3 ? '本次走的是 HTTP/3' : `本次是 ${http}：没走 HTTP/3，可能是浏览器还没切换，或 UDP 被挡`,
        advice: h3 ? undefined : '需要 HTTP/3 时确认代理允许 UDP'
      },
      en: {
        title: 'HTTP/3',
        finding: h3 ? 'HTTP/3 in use' : `This run used ${http}: either the browser has not upgraded yet, or UDP is blocked`,
        advice: h3 ? undefined : 'If you need HTTP/3, make sure the proxy forwards UDP'
      }
    })
  }

  // 13. ECH / 后量子：trace 不提供，只做说明，不下结论
  out.push({
    id: 'ech',
    level: 'info',
    zh: {
      title: 'ECH 与后量子加密',
      finding: '本次链路的 SNI 状态可读，但 trace 不提供 ECH 与后量子密钥交换结果：本页不判定，避免误报',
      advice: '要看这两项需要在服务端观测 TLS 握手，普通网页读不到'
    },
    en: {
      title: 'ECH & post-quantum',
      finding: 'SNI status is readable, but trace exposes neither ECH nor the post-quantum KEX result; this page does not guess',
      advice: 'These require server-side TLS observation'
    }
  })

  // 14. 指纹稳定性
  out.push({
    id: 'fingerprint',
    level: stability.firstVisit ? 'info' : stability.unchanged === stability.total ? 'warn' : 'ok',
    zh: {
      title: '指纹追踪',
      finding: stability.firstVisit
        ? '这是本机第一次记录，下次打开就能看出哪些分项没变'
        : `${stability.total} 项分项里有 ${stability.unchanged} 项与上次完全一样：换 Cookie、开无痕都躲不掉`,
      advice: stability.firstVisit ? undefined : '要打断追踪，需要让分项发生变化（换渲染后端或使用带随机化的浏览器），清 Cookie 没用'
    },
    en: {
      title: 'Fingerprint tracking',
      finding: stability.firstVisit
        ? 'First record on this machine; reopen to compare component stability'
        : `${stability.unchanged} of ${stability.total} components are identical to last time — clearing cookies will not help`,
      advice: stability.firstVisit ? undefined : 'Break it by changing components (different renderer or a randomizing browser); clearing cookies does nothing'
    }
  })

  return out
}

function cityMatch(a: string, b: string): boolean {
  const x = a.split(' · ')[0]?.trim() ?? a
  return x.includes(b) || b.includes(x)
}

/** 由检测结果给一个等级：只看有证据的冲突，不按「稀有项多」加分 */
export function exposureGrade(checks: DisguiseCheck[]): { grade: 'A' | 'B' | 'C' | 'D'; bad: number; warn: number } {
  const bad = checks.filter((c) => c.level === 'bad').length
  const warn = checks.filter((c) => c.level === 'warn').length
  const score = bad * 2 + warn
  const grade = score <= 1 ? 'A' : score <= 3 ? 'B' : score <= 5 ? 'C' : 'D'
  return { grade, bad, warn }
}


// ---------------- 目标地区模拟 ----------------

export interface RegionPreset {
  code: string
  /** 该地区常用时区（取一个代表） */
  tz: string
  /** 该地区常见浏览器语言前缀 */
  langs: string[]
}

export const REGION_PRESETS: RegionPreset[] = [
  { code: 'HK', tz: 'Asia/Hong_Kong', langs: ['zh', 'en'] },
  { code: 'SG', tz: 'Asia/Singapore', langs: ['en', 'zh'] },
  { code: 'TW', tz: 'Asia/Taipei', langs: ['zh'] },
  { code: 'JP', tz: 'Asia/Tokyo', langs: ['ja'] },
  { code: 'US', tz: 'America/New_York', langs: ['en'] },
  { code: 'GB', tz: 'Europe/London', langs: ['en'] },
  { code: 'DE', tz: 'Europe/Berlin', langs: ['de'] }
]

export interface RegionItem {
  id: string
  ok: boolean
  zh: { label: string; detail: string }
  en: { label: string; detail: string }
  adviceZh?: string
  adviceEn?: string
}

export interface RegionResult {
  code: string
  total: number
  ok: number
  items: RegionItem[]
}

function regionNames(code: string): { zh: string; en: string } {
  const get = (l: string): string => {
    try {
      return new Intl.DisplayNames([l], { type: 'region' }).of(code) ?? code
    } catch {
      return code
    }
  }
  return { zh: get('zh-CN'), en: get('en') }
}

/** 想「装成」某个地区时，逐项告诉你还差什么。只比较已读到的值。 */
export function simulateRegion(code: string, readings: WhoRawItem[], facts?: WhoServerFacts): RegionResult | null {
  const preset = REGION_PRESETS.find((p) => p.code === code)
  if (!preset) return null
  const m = new Map(readings.map((r) => [r.id, r]))
  const v = (id: string): string | null => m.get(id)?.value ?? null
  const names = regionNames(code)
  const items: RegionItem[] = []

  const country = facts?.geo?.country
  if (country) {
    const hit = country === names.zh || country === names.en || country.includes(names.zh) || names.en.includes(country)
    items.push({
      id: 'ip',
      ok: hit,
      zh: { label: 'IP 所在地', detail: hit ? `在${names.zh}` : `在${country}，不是${names.zh}` },
      en: { label: 'IP location', detail: hit ? `In ${names.en}` : `In ${country}, not ${names.en}` },
      adviceZh: hit ? undefined : `换到${names.zh}的出口节点`,
      adviceEn: hit ? undefined : `Switch to an egress node in ${names.en}`
    })
  }

  const sysTz = v('locale.timezone')?.split(' · ')[0]
  if (sysTz) {
    const a = tzOffsetOf(sysTz)
    const b = tzOffsetOf(preset.tz)
    const hit = a != null && b != null && a === b
    items.push({
      id: 'tz',
      ok: hit,
      zh: { label: '系统时区', detail: hit ? `与${preset.tz}同一时区` : `现在是 ${sysTz}，${preset.tz} 需要另一套时区` },
      en: { label: 'System timezone', detail: hit ? `Same offset as ${preset.tz}` : `Currently ${sysTz}; ${preset.tz} needs a different one` },
      adviceZh: hit ? undefined : `把系统时区改成 ${preset.tz}`,
      adviceEn: hit ? undefined : `Set the OS timezone to ${preset.tz}`
    })
  }

  const blang = v('locale.browserLanguage')
  if (blang) {
    const hit = preset.langs.some((l) => blang.toLowerCase().startsWith(l))
    items.push({
      id: 'lang',
      ok: hit,
      zh: { label: '浏览器语言', detail: hit ? `${blang} 符合当地常见语言` : `${blang} 不在当地常见语言（${preset.langs.join(' / ')}）里` },
      en: { label: 'Browser language', detail: hit ? `${blang} fits the region` : `${blang} is not typical there (${preset.langs.join(' / ')})` },
      adviceZh: hit ? undefined : `把首选语言改成 ${preset.langs[0]} 开头`,
      adviceEn: hit ? undefined : `Set the preferred language to ${preset.langs[0]}`
    })
  }

  const dnsGeo = v('server.dnsResolverGeo')
  if (dnsGeo) {
    const hit = dnsGeo.includes(names.zh) || dnsGeo.includes(names.en)
    items.push({
      id: 'dns',
      ok: hit,
      zh: { label: 'DNS 出口', detail: hit ? 'DNS 出口和 IP 在同一地区' : `DNS 出口在 ${dnsGeo.split(' · ')[0]}，不在${names.zh}` },
      en: { label: 'DNS egress', detail: hit ? 'DNS egress is in the same region' : `DNS exits in ${dnsGeo.split(' · ')[0]}, not ${names.en}` },
      adviceZh: hit ? undefined : '让 DNS 也走代理（TUN + fake-ip 或当地解析器）',
      adviceEn: hit ? undefined : 'Route DNS through the proxy too (TUN + fake-ip or a local resolver)'
    })
  }

  const rtc = v('device.webrtcPublic')
  const ip = v('server.ip')
  if (rtc && ip) {
    const hit = rtc === ip
    items.push({
      id: 'webrtc',
      ok: hit,
      zh: { label: 'WebRTC', detail: hit ? '没有额外的公网地址' : `另有一个公网地址 ${rtc}` },
      en: { label: 'WebRTC', detail: hit ? 'No extra public address' : `A second public address ${rtc}` },
      adviceZh: hit ? undefined : '关掉 WebRTC 或让代理接管 UDP',
      adviceEn: hit ? undefined : 'Disable WebRTC or let the proxy carry UDP'
    })
  }

  return { code, total: items.length, ok: items.filter((i) => i.ok).length, items }
}
