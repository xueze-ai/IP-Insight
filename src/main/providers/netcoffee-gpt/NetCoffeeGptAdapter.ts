import type {
  Fingerprint,
  LeakInfo,
  NormalizedIPResult,
  ProviderAdapter,
  ProviderMeta
} from '@shared/types'
import { HiddenPage, CHALLENGE_DETECT_EXPR } from '../base/hiddenPage'

// =============================================================
// Net.Coffee GPT Adapter（/gpt/）
// 在页面上下文真实复现站点逻辑：
//   多出口 trace（中国直连 / Cloudflare / ChatGPT）、ChatGPT 出口
//   iprisk+geoip 画像与信任分、Codex/OpenAI 可达性、自建权威 DNS
//   泄露检测、WebRTC(STUN) UDP 泄露、设备指纹、服务状态。
// 网站改版只需修改本文件。
// =============================================================

const SOURCE_URL = 'https://ip.net.coffee/gpt/'

// 字体探测候选集（宽度差异法；站点改版/增删字体只改本文件）
const FONT_CANDIDATES = [
  'Arial',
  'Arial Black',
  'Calibri',
  'Cambria',
  'Candara',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Impact',
  'Lucida Console',
  'Microsoft YaHei',
  'PingFang SC',
  'Segoe UI',
  'SimHei',
  'SimSun',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Wingdings'
]

const READY_EXPR = "(document.readyState === 'complete') ? true : false"

// 页面上下文聚合脚本（避免使用反引号，一律字符串拼接）
const AGG_EXPR = `
(async () => {
  const out = { exits: {} };
  const jget = async (u, to) => {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(to || 8000) });
      return await r.json(); } catch (e) { return { __error: String(e) }; }
  };
  const traceIp = async (u) => {
    try { const t = await (await fetch(u, { signal: AbortSignal.timeout(7000) })).text();
      const m = t.match(/ip=([^\\n]+)/); return m ? m[1].trim() : null;
    } catch (e) { return null; }
  };

  // ── 三个出口 ──
  const cfIp = await traceIp('https://1.1.1.1/cdn-cgi/trace');
  const gptIp = await traceIp('https://chatgpt.com/cdn-cgi/trace');
  let chinaIp = null;
  try { const t = await (await fetch('https://my.ip.cn/',
      { signal: AbortSignal.timeout(7000) })).text();
    const m = t.match(/[0-9]+\\.[0-9.]+[0-9]/); chinaIp = m ? m[0] : null;
  } catch (e) {}
  const ipList = [chinaIp, cfIp, gptIp].filter(Boolean);
  const batch = ipList.length
    ? await jget('/api/geoip-batch?ips=' + ipList.join(','), 8000) : {};
  out.exits = {
    china: { ip: chinaIp, geo: chinaIp ? batch[chinaIp] : null },
    cloudflare: { ip: cfIp, geo: cfIp ? batch[cfIp] : null },
    chatgpt: { ip: gptIp, geo: gptIp ? batch[gptIp] : null }
  };

  // ── ChatGPT 出口画像 ──
  const gptRisk = gptIp ? await jget('/api/iprisk/' + gptIp, 9000) : null;
  const gptGeo = gptIp ? await jget('/api/geoip/' + gptIp, 6000) : null;
  out.gptRisk = gptRisk;
  out.gptGeo = gptGeo;

  // ── Codex / OpenAI 可达性（no-cors 计时）──
  const availability = [];
  const targets = [
    { name: 'chatgpt.com', url: 'https://chatgpt.com/cdn-cgi/trace' },
    { name: 'api.openai.com', url: 'https://api.openai.com/' }
  ];
  for (const t of targets) {
    const s = performance.now();
    try { await fetch(t.url, { mode: 'no-cors', signal: AbortSignal.timeout(7000) });
      availability.push({ name: t.name, ms: Math.round(performance.now() - s), ok: true });
    } catch (e) { availability.push({ name: t.name, ms: -1, ok: false }); }
  }
  out.availability = availability;

  // ── DNS 泄露（自建权威 DNS）──
  async function detectDNS() {
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    for (let i = 1; i <= 2; i++) {
      await new Promise (function (res) {
        const img = new Image(); const tm = setTimeout(res, 2000);
        img.onload = img.onerror = function () { clearTimeout(tm); res(); };
        img.src = 'https://' + token + '-' + i + '.d.ip.net.coffee/pixel.gif?_=' + Date.now();
      });
    }
    await new Promise (function (r) { setTimeout(r, 1500); });
    let servers = [];
    for (let a = 0; a < 3; a++) {
      const d = await jget('/api/dns/result/' + token, 4000);
      if (d && d.dns_servers && d.dns_servers.length) { servers = d.dns_servers; break; }
      await new Promise (function (r) { setTimeout(r, 1300); });
    }
    if (!servers.length) return { status: 'DNS 加密或未暴露出口', servers: [] };
    const cc0 = String((gptRisk && (gptRisk.countryCode || gptRisk.country)) ||
      (gptGeo && gptGeo.country_code) || '').toLowerCase();
    const gptCN = /china|cn|中国/.test(cc0);
    let show = null, leaked = false;
    for (const ip of servers) {
      const g = await jget('/api/geoip/' + ip, 4000);
      const cc = String(g.country_code || '').toLowerCase();
      const isp = g.isp || '';
      if (cc === 'cn' && !gptCN) { show = { ip: ip, cc: cc, isp: isp }; leaked = true; break; }
      if (!show) show = { ip: ip, cc: cc, isp: isp };
    }
    return { status: leaked ? '可能泄露' : '未检测到泄露',
      exitIp: show && show.ip, isp: show && show.isp,
      cc: show && show.cc, servers: servers };
  }
  out.dnsLeak = await detectDNS();

  // ── WebRTC UDP 泄露（STUN 收集，与 ChatGPT 出口比对）──
  async function detectWebRTC() {
    const ips = new Set();
    try {
      const pc = new RTCPeerConnection({ iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' } ] });
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise (function (res) {
        const tm = setTimeout(function () { pc.close(); res(); }, 6000);
        pc.onicecandidate = function (e) {
          if (!e.candidate) { clearTimeout(tm); pc.close(); res(); return; }
          const m = e.candidate.candidate.match(/([0-9]{1,3}\\.){3}[0-9]{1,3}/);
          if (m) { const ip = m[0];
            if (!/^(0\\.|127\\.)/.test(ip) && ip !== '0.0.0.0') ips.add(ip); }
          const m6 = e.candidate.candidate.match(/([a-f0-9]{1,4}:){2,7}[a-f0-9]{1,4}/i);
          if (m6) ips.add(m6[0]);
        };
      });
    } catch (e) {}
    const all = Array.from(ips);
    const isV6 = function (ip) { return ip.includes(':'); };
    const pub = all.filter(function (ip) {
      return !isV6(ip) &&
        !/^(192\\.168\\.|10\\.|172\\.|198\\.18\\.|198\\.19\\.|100\\.64\\.|127\\.|0\\.)/.test(ip);
    });
    if (!all.length) return { status: 'WebRTC 已禁用或无泄露', ips: [] };
    if (!pub.length) return { status: '未检测到泄露', ips: all };
    let leak = false, showIP = null;
    for (const ip of pub) {
      if (gptIp && ip !== gptIp) { leak = true; showIP = ip; break; }
      if (!showIP) showIP = ip;
    }
    const geo = showIP ? await jget('/api/geoip/' + showIP, 4000) : null;
    return { status: leak ? '可能泄露' : '未检测到泄露',
      exitIp: showIP, country: geo && geo.country,
      cc: geo && geo.country_code, matches: !leak, ips: all };
  }
  out.webRTCLeak = await detectWebRTC();

  // ── 设备指纹（固定绘制，保证稳定）──
  const fp = {};
  const ua = navigator.userAgent;
  fp.userAgent = ua;
  fp.os = /Windows NT 10/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : (navigator.platform || '');
  fp.platform = navigator.platform || '';
  fp.browser = /Edg\\//.test(ua) ? 'Edge'
    : /Chrome\\//.test(ua) ? 'Chrome'
    : /Firefox\\//.test(ua) ? 'Firefox'
    : /Safari\\//.test(ua) ? 'Safari' : '';
  const bv = ua.match(/(?:Chrome|Edg|Firefox|Version)\\/([0-9.]+)/);
  fp.browserVersion = bv ? bv[1] : '';
  fp.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  fp.timezoneConsistent = (gptRisk && gptRisk.timezone)
    ? fp.timezone === gptRisk.timezone : null;
  fp.language = navigator.language || '';
  fp.languages = Array.from(navigator.languages || []);
  fp.languageConsistent = null;
  fp.screen = screen.width + 'x' + screen.height;
  fp.colorDepth = screen.colorDepth;
  fp.hardwareConcurrency = navigator.hardwareConcurrency;
  fp.deviceMemory = navigator.deviceMemory || null;
  fp.cookiesEnabled = navigator.cookieEnabled;
  try {
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    c.width = 240; c.height = 32;
    x.textBaseline = 'top'; x.font = '15px Arial';
    x.fillStyle = '#f60'; x.fillRect(6, 6, 50, 20);
    x.fillStyle = '#069'; x.fillText('IP Insight fingerprint canvas', 5, 7);
    const cd = c.toDataURL();
    let h = 0; for (let i = 0; i < cd.length; i++) { h = (h * 31 + cd.charCodeAt(i)) | 0; }
    fp.canvas = Math.abs(h).toString(16).toUpperCase();
  } catch (e) {}
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      fp.webglRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      const s = fp.webglRenderer + String(gl.getParameter(gl.VERSION));
      let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
      fp.webgl = Math.abs(h).toString(16).toUpperCase();
    }
  } catch (e) {}
  // 音频指纹：固定激励信号经 OfflineAudioContext 渲染后取尾部能量和，稳定可复现
  try {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (AC) {
      const ac = new AC(1, 5000, 44100);
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(10000, ac.currentTime);
      const comp = ac.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-50, ac.currentTime);
      comp.knee.setValueAtTime(40, ac.currentTime);
      comp.ratio.setValueAtTime(12, ac.currentTime);
      comp.attack.setValueAtTime(0, ac.currentTime);
      comp.release.setValueAtTime(0.25, ac.currentTime);
      osc.connect(comp); comp.connect(ac.destination);
      osc.start(0);
      const buf = await ac.startRendering();
      let sum = 0;
      const ch = buf.getChannelData(0);
      for (let i = 4500; i < 5000; i++) sum += Math.abs(ch[i]);
      fp.audio = sum.toString().slice(0, 12);
    }
  } catch (e) {}
  // 字体探测：候选字体 + 基准字体族渲染宽度差异法（纯浏览器端计算）
  try {
    const bases = ['monospace', 'sans-serif', 'serif'];
    const probe = 'mmmmmmmmmmlli';
    const sp = document.createElement('span');
    sp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:72px;visibility:hidden;';
    sp.textContent = probe;
    document.body.appendChild(sp);
    const baseW = {};
    for (const b of bases) { sp.style.fontFamily = b; baseW[b] = sp.offsetWidth; }
    const found = [];
    for (const f of ${JSON.stringify(FONT_CANDIDATES)}) {
      for (const b of bases) {
        sp.style.fontFamily = '"' + f + '",' + b;
        if (sp.offsetWidth !== baseW[b]) { found.push(f); break; }
      }
    }
    document.body.removeChild(sp);
    fp.fonts = found;
  } catch (e) {}
  // 综合指纹 ID：本机对 canvas/webgl/audio/屏幕/时区/语言/核数 的哈希，
  // 仅用于自我前后对比，非跨站跟踪 ID，不上传
  try {
    const combo = [fp.canvas, fp.webgl, fp.audio, fp.screen, fp.timezone, fp.language, fp.hardwareConcurrency].join('|');
    let h = 0; for (let i = 0; i < combo.length; i++) { h = (h * 31 + combo.charCodeAt(i)) | 0; }
    fp.visitorId = Math.abs(h).toString(16).toUpperCase();
  } catch (e) {}
  out.fingerprint = fp;

  // ── 服务状态 ──
  out.serviceStatus = await jget('/gpt/status.json', 6000);
  return out;
})()
`

interface AnyObj {
  [k: string]: unknown
}
function asObj(v: unknown): AnyObj | null {
  return v && typeof v === 'object' && !('__error' in (v as AnyObj))
    ? (v as AnyObj)
    : null
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function bool(v: unknown): boolean | null {
  return v === true || v === false ? v : null
}

function toLeak(d: AnyObj | null): LeakInfo | undefined {
  if (!d) return undefined
  return {
    status: String(d['status'] || '未知'),
    exitIp: d['exitIp'] ? String(d['exitIp']) : undefined,
    provider: d['isp'] ? String(d['isp']) : undefined,
    detail: d['cc'] ? String(d['cc']) : undefined
  }
}

export class NetCoffeeGptAdapter implements ProviderAdapter {
  readonly meta: ProviderMeta = {
    id: 'netcoffee_gpt',
    name: 'Net.Coffee GPT',
    sourceUrl: SOURCE_URL
  }

  async detect(ctx?: {
    timeoutMs?: number
    onLog?: (m: string) => void
  }): Promise<NormalizedIPResult> {
    const fetchedAt = new Date().toISOString()
    const base: NormalizedIPResult = {
      provider: this.meta,
      fetchedAt,
      ok: false
    }
    const page = new HiddenPage()
    try {
      await page.open({
        url: SOURCE_URL,
        readyExpr: READY_EXPR,
        timeoutMs: ctx?.timeoutMs ?? 30000,
        onLog: ctx?.onLog
      })

      const challenge = await page.eval<boolean>(CHALLENGE_DETECT_EXPR)
      if (challenge) {
        return {
          ...base,
          error: '该数据源需要人工验证/暂不可自动获取（出现人机验证挑战）'
        }
      }

      const data = await page.eval<AnyObj>(AGG_EXPR)
      if (!data) {
        return { ...base, error: '聚合脚本未返回结果（页面可能未就绪）' }
      }

      const exits = asObj(data['exits'])
      const gptExit = asObj(exits?.['chatgpt'])
      const gptRisk = asObj(data['gptRisk'])
      const gptGeo = asObj(data['gptGeo'])

      const gptIp = gptExit?.['ip']
        ? String(gptExit['ip'])
        : undefined
      if (!gptIp || !gptRisk) {
        return {
          ...base,
          error: '未能获取 ChatGPT 出口及其画像（trace/iprisk 可能不可用）',
          raw: data
        }
      }

      const trust = num(gptRisk['trust_score'])
      const fingerprint = asObj(data['fingerprint'])
      const trustLabel =
        trust == null
          ? undefined
          : `ChatGPT 出口信任分 ${trust}/100（越高越安全）· ` +
            (trust >= 95 ? '极度纯净'
              : trust >= 80 ? '纯净'
                : trust >= 50 ? '良好'
                  : trust >= 25 ? '中性' : '高风险')

      const isBroadcast = bool(gptRisk['isBroadcast'])

      return {
        provider: this.meta,
        fetchedAt,
        ok: true,
        ip: gptIp,
        ipv4: gptIp,
        isp:
          (gptGeo?.['isp'] as string) ||
          (gptRisk['asOrganization'] as string) ||
          undefined,
        asn: gptRisk['asn'] != null
          ? `AS${gptRisk['asn']}`
          : null,
        organization:
          (gptRisk['company_name'] as string) ||
          (gptRisk['asOrganization'] as string) ||
          undefined,
        country:
          (gptRisk['country'] as string) ||
          (gptGeo?.['country'] as string) ||
          undefined,
        region: (gptRisk['region'] as string) || undefined,
        city: (gptRisk['city'] as string) || undefined,
        timezone: (gptRisk['timezone'] as string) || undefined,
        flags: {
          residential: bool(gptRisk['isResidential']),
          datacenter: bool(gptRisk['is_datacenter']),
          hosting: gptRisk['company_type'] === 'hosting' ? true : null,
          vpn: bool(gptRisk['is_vpn']),
          proxy: bool(gptRisk['is_proxy']),
          tor: bool(gptRisk['is_tor']),
          crawler: bool(gptRisk['is_crawler']),
          mobile: bool(gptRisk['is_mobile']),
          abuser: bool(gptRisk['is_abuser'])
        },
        riskScore: trust,
        riskLabel: trustLabel,
        nativeLabel:
          isBroadcast === true ? '广播 IP'
            : isBroadcast === false ? '原生 IP' : undefined,
        dnsLeak: toLeak(asObj(data['dnsLeak'])),
        webRTCLeak: toLeak(asObj(data['webRTCLeak'])),
        fingerprint: fingerprint as Fingerprint | undefined,
        raw: {
          exits: data['exits'],
          gptRisk,
          gptGeo,
          availability: data['availability'],
          dnsLeak: data['dnsLeak'],
          webRTCLeak: data['webRTCLeak'],
          serviceStatus: data['serviceStatus']
        }
      }
    } catch (e) {
      return { ...base, error: `数据源访问失败：${(e as Error).message}` }
    } finally {
      await page.close()
    }
  }
}

export const netCoffeeGptAdapter = new NetCoffeeGptAdapter()
