import type { WhoRawItem, WhoStatus } from '@shared/whoami'

// =============================================================
// 浏览器侧采集：只用标准 Web API，全部在本机完成，不发往任何地方。
//
// 约定：
// · 每条读数都真实读取；读不到 → status 'unavailable'，不补默认值、不猜。
// · 慢接口（音频、WebGPU、媒体设备、蓝牙、WebRTC）统一带超时，超时即标 unavailable。
// · 组合指纹由各分项哈希合成；只用于与本机历史对比，不声称全球稀有度。
// =============================================================

type Reading = WhoRawItem

function mk(id: string, value: string | null, detail?: string, status?: WhoStatus): Reading {
  return { id, value, detail, source: '', status: status ?? (value ? 'ok' : 'unavailable') }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

async function sha256(s: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return fnv(s)
  }
}

const shortId = (hex: string): string => `${hex.slice(0, 8)} · ${hex.slice(8, 16)}`

// ---------------- Canvas / WebGL / 音频 ----------------

const FONT_PROBE =
  'mmmmmmmmmmlli1|mmmmmmmmmmlli2|mmmmmmmmmmlli3|mmmmmmmmmmlli4|mmmmmmmmmmlli5|mmmmmmmmmmlli6|mmmmmmmmmmlli7'

const FONT_CANDIDATES = [
  'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Cambria Math', 'Candara', 'Comic Sans MS',
  'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi',
  'Georgia', 'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode',
  'Malgun Gothic', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa',
  'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti', 'MingLiU-ExtB',
  'Mongolian Baiti', 'MS Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Palatino Linotype',
  'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Historic', 'SimSun', 'Sitka Text',
  'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings',
  'Yu Gothic', 'DejaVu Sans', 'Liberation Sans', 'Noto Sans', 'Roboto', 'Helvetica Neue'
]

function baseFonts(): string[] {
  return ['monospace', 'serif', 'sans-serif']
}

function detectFonts(): { installed: string[]; tested: number } {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (!ctx) return { installed: [], tested: 0 }
  const base: Record<string, number> = {}
  for (const f of baseFonts()) {
    ctx.font = `72px ${f}`
    base[f] = ctx.measureText(FONT_PROBE).width
  }
  const installed: string[] = []
  for (const name of FONT_CANDIDATES) {
    let hit = false
    for (const f of baseFonts()) {
      ctx.font = `72px "${name}", ${f}`
      const w = ctx.measureText(FONT_PROBE).width
      if (Math.abs(w - base[f]) > 0.5) {
        hit = true
        break
      }
    }
    if (hit) installed.push(name)
  }
  return { installed, tested: FONT_CANDIDATES.length }
}

function drawCanvas(): string {
  const c = document.createElement('canvas')
  c.width = 260
  c.height = 70
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.textBaseline = 'alphabetic'
  const g = ctx.createLinearGradient(0, 0, 260, 0)
  g.addColorStop(0, '#f60')
  g.addColorStop(0.5, '#0a6')
  g.addColorStop(1, '#06f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 260, 70)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '17px "Arial"'
  ctx.fillText('IP Insight 网鉴 🙂 finger', 6, 26)
  ctx.fillStyle = 'rgba(20,20,20,0.9)'
  ctx.font = 'italic 15px "Times New Roman"'
  ctx.fillText('canvas 指纹 · 0.3.1', 8, 50)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.arc(220, 40, 18, 0, Math.PI * 1.5)
  ctx.stroke()
  return c.toDataURL()
}

function fontSmoothing(): { kind: string; detail: string } {
  const c = document.createElement('canvas')
  c.width = 60
  c.height = 24
  const ctx = c.getContext('2d')
  if (!ctx) return { kind: '未知', detail: 'canvas 不可用' }
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 60, 24)
  ctx.fillStyle = '#000'
  ctx.font = '14px Arial'
  ctx.fillText('网鉴A', 2, 17)
  const data = ctx.getImageData(0, 0, 60, 24).data
  let chroma = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (Math.max(r, g, b) - Math.min(r, g, b) > 6) chroma++
  }
  return chroma > 0
    ? { kind: '子像素抗锯齿（ClearType 一类）', detail: `边缘检出 ${chroma} 个彩色像素` }
    : { kind: '灰度抗锯齿', detail: '边缘无彩色像素' }
}

interface GlInfo {
  vendor: string
  renderer: string
  version: string
  hash: string
  imageHash: string
}

function readGl(): GlInfo {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const gl = (c.getContext('webgl') ?? c.getContext('experimental-webgl')) as WebGLRenderingContext | null
  if (!gl) {
    return { vendor: '无', renderer: '无', version: '无', hash: '', imageHash: '' }
  }
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const vendor = String(gl.getParameter(dbg ? dbg.UNMASKED_VENDOR_WEBGL : gl.VENDOR) ?? '')
  const renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
  const version = String(gl.getParameter(gl.VERSION) ?? '')
  gl.clearColor(0.13, 0.42, 0.87, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST)
  const px = new Uint8Array(4)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const imageHash = fnv(Array.from(px).join(','))
  const attrs = {
    vendor,
    renderer,
    version,
    shading: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxView: gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.toString?.(),
    ext: (gl.getSupportedExtensions() ?? []).length
  }
  return { vendor, renderer, version, hash: fnv(JSON.stringify(attrs)), imageHash }
}

async function audioFingerprint(): Promise<{ hash: string; detail: string }> {
  const Ctor =
    (window as Window & { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext ??
    (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!Ctor) return { hash: '', detail: '当前环境不提供 OfflineAudioContext' }
  const ctx = new Ctor(1, 44100, 44100)
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(440, 0)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.setValueAtTime(-50, 0)
  comp.knee.setValueAtTime(40, 0)
  comp.ratio.setValueAtTime(12, 0)
  comp.attack.setValueAtTime(0, 0)
  comp.release.setValueAtTime(0.25, 0)
  osc.connect(comp)
  comp.connect(ctx.destination)
  osc.start(0)
  const buf = await withTimeout(ctx.startRendering(), 5000, '音频渲染')
  const ch = buf.getChannelData(0)
  const vals: string[] = []
  for (let i = 0; i < ch.length; i += 512) vals.push(ch[i].toFixed(7))
  return { hash: fnv(vals.slice(0, 200).join('|')), detail: `${ch.length} 采样` }
}

// ---------------- 其它单项 ----------------

function safeMemory(): { limit?: number; used?: number } {
  const perf = performance as Performance & {
    memory?: { jsHeapSizeLimit?: number; usedJSHeapSize?: number; totalJSHeapSize?: number }
  }
  return { limit: perf.memory?.jsHeapSizeLimit, used: perf.memory?.usedJSHeapSize }
}

function timerResolution(): number {
  let last = performance.now()
  let best = Infinity
  for (let i = 0; i < 200000; i++) {
    const now = performance.now()
    if (now !== last) {
      best = Math.min(best, now - last)
      last = now
      if (best < 0.001) break
    }
  }
    return best
}

function recursionDepth(): number {
  let depth = 0
  const probe = (n: number): void => {
    depth = n
    probe(n + 1)
  }
  try {
    probe(0)
  } catch {
    /* 栈溢出即结束 */
  }
  return depth
}

function nativeCheck(): { checked: number; broken: string[] } {
  const pairs: Array<[string, string]> = [
    ['navigator.userAgent', 'ua'],
    ['navigator.languages', 'languages'],
    ['navigator.hardwareConcurrency', 'hc'],
    ['screen.width', 'screen'],
    ['performance.now', 'now'],
    ['CanvasRenderingContext2D.prototype.fillText', 'fillText'],
    ['CanvasRenderingContext2D.prototype.toDataURL', 'toDataURL'],
    ['HTMLCanvasElement.prototype.getContext', 'getContext'],
    ['WebGLRenderingContext.prototype.getParameter', 'glParam'],
    ['AudioContext.prototype.createOscillator', 'osc'],
    ['RTCPeerConnection.prototype.createOffer', 'rtcOffer'],
    ['Date.now', 'dateNow'],
    ['Intl.DateTimeFormat', 'dtf'],
    ['Notification.requestPermission', 'notif'],
    ['Function.prototype.toString', 'fnToString'],
    ['XMLHttpRequest.prototype.open', 'xhrOpen'],
    ['Storage.prototype.getItem', 'sGet'],
    ['MediaDevices.prototype.enumerateDevices', 'enumDev'],
    ['Crypto.prototype.getRandomValues', 'rand'],
    ['document.createElement', 'createEl'],
    ['Worker', 'worker'],
    ['fetch', 'fetch'],
    ['SpeechSynthesis.prototype.getVoices', 'voices'],
    ['History.prototype.pushState', 'pushState'],
    ['Element.prototype.getBoundingClientRect', 'rect'],
    ['CSS.supports', 'cssSupports'],
    ['navigator.mediaDevices', 'mediaDev'],
    ['navigator.permissions', 'perms'],
    ['navigator.gpu', 'gpu'],
    ['navigator.sendBeacon', 'beacon'],
    ['navigator.connection', 'conn'],
    ['window.requestAnimationFrame', 'raf']
  ]
  const broken: string[] = []
  let checked = 0
  for (const [path, label] of pairs) {
    try {
      const parts = path.split('.')
      let obj: unknown = window
      for (let i = 0; i < parts.length - 1; i++) {
        obj = (obj as Record<string, unknown>)?.[parts[i]]
        if (obj == null) break
      }
      const fn = (obj as Record<string, unknown> | undefined)?.[parts[parts.length - 1]]
      if (typeof fn !== 'function') continue
      checked++
      const src = Function.prototype.toString.call(fn)
      if (!src.includes('[native code]')) broken.push(label)
    } catch {
      /* 单项失败不计入 */
    }
  }
  return { checked, broken }
}

function cssFeatureCount(): number {
  const list = [
    'display:grid', 'display:flex', 'display:contents', 'gap:1px', 'aspect-ratio:1', 'color:color-mix(in srgb, red, blue)',
    'width:min-content', 'container-type:inline-size', 'text-wrap:balance', 'view-transition-name:x',
    'backdrop-filter:blur(1px)', 'mask-image:linear-gradient(red,blue)', 'scroll-snap-type:x mandatory',
    'clip-path:circle(1px)', 'inset:0', 'accent-color:red', 'font-variation-settings:"wght" 400',
    'paint-order:stroke', 'scrollbar-gutter:stable', 'hyphens:auto', 'text-box-trim:trim-both',
    'color:oklch(50% 0.1 200)', 'animation-timeline:auto'
  ]
  let n = 0
  for (const f of list) {
    try {
      if (CSS.supports(f)) n++
    } catch {
      /* 忽略 */
    }
  }
  return n
}

async function webgl2Caps(): Promise<{ ok: boolean; detail: string }> {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') as WebGL2RenderingContext | null
  if (!gl) return { ok: false, detail: '不支持 WebGL2' }
  const ext = (gl.getSupportedExtensions() ?? []).length
  return {
    ok: true,
    detail: `WebGL2 · 最大纹理 ${gl.getParameter(gl.MAX_TEXTURE_SIZE)} · ${ext} 个扩展 · 着色器 ${gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)} 向量`
  }
}

async function webgpuInfo(): Promise<{ adapter?: string; caps?: string }> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
  if (!gpu) return {}
  try {
    const adapter = (await withTimeout(gpu.requestAdapter(), 3000, 'WebGPU 适配器')) as {
      info?: { vendor?: string; architecture?: string; device?: string; description?: string }
      limits?: Record<string, number>
      features?: Set<string>
    } | null
    if (!adapter) return { adapter: '无可用适配器' }
    const i = adapter.info
    const name = [i?.vendor, i?.architecture, i?.device, i?.description].filter(Boolean).join(' · ') || '适配器信息未公开'
    return {
      adapter: name,
      caps: `${adapter.features?.size ?? 0} 项特性 · maxBuffer ${adapter.limits?.maxBufferSize ?? '—'}`
    }
  } catch (e) {
    return { adapter: `读取失败：${errText(e)}` }
  }
}

async function batteryInfo(): Promise<{ text: string; detail: string } | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }
  if (!nav.getBattery) return null
  try {
    const b = await withTimeout(nav.getBattery(), 3000, '电池')
    return {
      text: `${Math.round(b.level * 100)}%${b.charging ? ' · 充电中' : ''}`,
      detail: b.level === 1 && b.charging ? '接着电源（台式机或满电）' : '来自系统电池状态'
    }
  } catch {
    return null
  }
}

async function mediaDeviceCounts(): Promise<string> {
  const md = navigator.mediaDevices
  if (!md?.enumerateDevices) return ''
  const list = await withTimeout(md.enumerateDevices(), 3000, '设备枚举')
  const c = { audioinput: 0, audiooutput: 0, videoinput: 0 } as Record<string, number>
  for (const d of list) c[d.kind] = (c[d.kind] ?? 0) + 1
  return `摄像头 ${c.videoinput} · 麦克风 ${c.audioinput} · 扬声器 ${c.audiooutput}`
}

async function audioHardware(): Promise<string> {
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return ''
  const ctx = new Ctor()
  const out = `${ctx.sampleRate} Hz · ${ctx.destination.channelCount} 声道${
    'baseLatency' in ctx ? ` · 延迟 ${Math.round((ctx.baseLatency as number) * 1000)} ms` : ''
  }`
  await ctx.close().catch(() => undefined)
  return out
}

async function passkeyInfo(): Promise<string> {
  if (!('PublicKeyCredential' in window)) return ''
  const pk = window.PublicKeyCredential as unknown as {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
  }
  const parts: string[] = []
  try {
    if (pk.isUserVerifyingPlatformAuthenticatorAvailable) {
      parts.push((await withTimeout(pk.isUserVerifyingPlatformAuthenticatorAvailable(), 2000, '通行密钥')) ? '支持内置认证器' : '无内置认证器')
    }
  } catch {
    /* 忽略 */
  }
  return parts.join(' · ') || '接口存在'
}

async function bluetoothInfo(): Promise<string> {
  const bt = (navigator as Navigator & { bluetooth?: { getAvailability?: () => Promise<boolean> } }).bluetooth
  if (!bt?.getAvailability) return ''
  try {
    return (await withTimeout(bt.getAvailability(), 2000, '蓝牙')) ? '可用' : '不可用'
  } catch {
    return '不可用'
  }
}

async function xrInfo(): Promise<string> {
  const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr
  if (!xr) return ''
  try {
    return (await withTimeout(xr.isSessionSupported('immersive-vr'), 2000, 'XR')) ? '支持沉浸式 VR' : '无 VR/AR 会话'
  } catch {
    return '无 VR/AR 会话'
  }
}

function codecList(): string {
  const m = ['video/mp4; codecs="avc1.42E01E"', 'video/webm; codecs="vp9"', 'video/mp4; codecs="av01.0.05M.08"']
  try {
    const ok = m.filter((t) => MediaSource.isTypeSupported(t))
    return ok.length ? `${ok.length}/3 · ${ok.map((t) => t.split(';')[0].split('/')[1]).join(' ')}` : '均不支持'
  } catch {
    return ''
  }
}

function rtcCodecs(): string {
  try {
    const a = RTCRtpSender.getCapabilities?.('audio')?.codecs.length ?? 0
    const v = RTCRtpSender.getCapabilities?.('video')?.codecs.length ?? 0
    const names = RTCRtpSender.getCapabilities?.('video')?.codecs.slice(0, 4).map((c) => c.mimeType.split('/')[1]) ?? []
    return `音频 ${a} 种 · 视频 ${v} 种${names.length ? ` · ${names.join(' ')}` : ''}`
  } catch {
    return ''
  }
}

function recorderFormats(): string {
  const types = [
    'video/webm', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm;codecs=h264',
    'video/mp4', 'video/mp4;codecs=avc1', 'audio/webm', 'audio/webm;codecs=opus',
    'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav'
  ]
  try {
    const ok = types.filter((t) => MediaRecorder.isTypeSupported(t)).length
    return `支持 ${ok}/${types.length} 种`
  } catch {
    return ''
  }
}

async function hwDecode(): Promise<string> {
  const mc = navigator.mediaCapabilities
  if (!mc?.decodingInfo) return ''
  try {
    const r = await mc.decodingInfo({
      type: 'file',
      video: { contentType: 'video/mp4; codecs="avc1.42E01E"', width: 1920, height: 1080, bitrate: 4_000_000, framerate: 30 }
    })
    return r.powerEfficient ? 'H.264 可硬件解码' : '无可用硬件解码格式'
  } catch {
    return ''
  }
}

async function drmInfo(): Promise<string> {
  const nav = navigator as Navigator & { requestMediaKeySystemAccess?: (k: string, c: unknown[]) => Promise<unknown> }
  if (!nav.requestMediaKeySystemAccess) return ''
  const cfg = [{ initDataTypes: ['cenc'], audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }] }] as MediaKeySystemConfiguration[]
  const out: string[] = []
  for (const [key, label] of [['com.widevine.alpha', 'Widevine'], ['org.w3.clearkey', 'ClearKey']] as const) {
    try {
      await withTimeout(nav.requestMediaKeySystemAccess(key, cfg), 2000, label)
      out.push(label)
    } catch {
      /* 不支持 */
    }
  }
  return out.join(' · ')
}

async function storageQuota(): Promise<string> {
  try {
    const e = await navigator.storage.estimate()
    const gb = (e.quota ?? 0) / 1024 ** 3
    return `${gb.toFixed(1)} GB 可用${e.usage ? ` · 已用 ${(e.usage / 1024 ** 2).toFixed(1)} MB` : ''}`
  } catch {
    return ''
  }
}

async function rtcLeak(): Promise<{ pub?: string; local?: string; count: number }> {
  const PC =
    (window as Window & { RTCPeerConnection?: typeof RTCPeerConnection }).RTCPeerConnection ??
    (window as Window & { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection
  if (!PC) return { count: 0 }
  const pc = new PC({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] })
  const cands: string[] = []
  try {
    pc.createDataChannel('probe')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await new Promise<void>((resolve) => {
      const done = (): void => resolve()
      pc.onicecandidate = (e): void => {
        if (!e.candidate) {
          done()
          return
        }
        cands.push(e.candidate.candidate)
      }
      setTimeout(done, 3000)
    })
  } catch {
    /* 无候选 */
  } finally {
    pc.close()
  }
  let pub: string | undefined
  let local: string | undefined
  for (const c of cands) {
    const parts = c.split(' ')
    const type = parts[7]
    const addr = parts[4]
    if (!addr) continue
    if (type === 'srflx' && !pub) pub = addr
    if (type === 'host' && !local && !addr.startsWith('0.0.0.0')) local = addr
  }
  return { pub, local, count: cands.length }
}

async function workerNav(): Promise<string> {
  try {
    const src = `self.onmessage=()=>{postMessage({ua:navigator.userAgent,hc:navigator.hardwareConcurrency,lang:navigator.language})}`
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
    const w = new Worker(url)
    const data = await withTimeout(
      new Promise<{ ua: string; hc: number; lang: string }>((resolve) => {
        w.onmessage = (e): void => resolve(e.data as { ua: string; hc: number; lang: string })
        w.postMessage('go')
      }),
      3000,
      'Worker'
    )
    w.terminate()
    URL.revokeObjectURL(url)
    const same =
      data.ua === navigator.userAgent && data.hc === navigator.hardwareConcurrency && data.lang === navigator.language
    return same ? '与页面一致' : `不一致：${data.ua.slice(0, 40)}`
  } catch (e) {
    return `无法建立 Worker：${errText(e)}`
  }
}

function adblockProbe(): string {
  try {
    const el = document.createElement('div')
    el.className = 'ad-banner adsbox pub_300x250 ad-placement'
    el.style.cssText = 'position:absolute;left:-9999px;top:0;width:300px;height:250px;'
    document.body.appendChild(el)
    const blocked = el.offsetHeight === 0 || el.offsetParent === null
    el.remove()
    return blocked ? '疑似开启了广告拦截' : '未检测到拦截'
  } catch {
    return ''
  }
}

function extensionTraces(): string {
  const found: string[] = []
  const w = window as Window & { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown; ethereum?: unknown }
  if (w.__REACT_DEVTOOLS_GLOBAL_HOOK__) found.push('React DevTools')
  if (w.ethereum) found.push('钱包扩展（window.ethereum）')
  try {
    const root = document.documentElement
    if (root.dataset?.immersiveTranslate !== undefined) found.push('Immersive Translate')
  } catch {
    /* 忽略 */
  }
  return found.length ? found.join(' · ') : '未发现可识别的扩展痕迹'
}

function automationTraces(): string {
  const w = window as unknown as Record<string, unknown>
  const hits: string[] = []
  for (const k of Object.keys(w)) {
    if (/^cdc_|^\$cdc_|__nightmare|__selenium|_phantom|callSelenium/.test(k)) hits.push(k)
  }
  if (document.documentElement.getAttribute('webdriver')) hits.push('webdriver 属性')
  if (navigator.userAgent.includes('Electron')) hits.push('Electron UA')
  if (navigator.userAgent.includes('HeadlessChrome')) hits.push('HeadlessChrome UA')
  return hits.length ? hits.join(' · ') : '未发现'
}

function sensitiveApiCount(): string {
  const n = navigator as unknown as Record<string, unknown>
  const keys = ['usb', 'serial', 'hid', 'requestMIDIAccess', 'idle', 'computePressure', 'fonts', 'windowManagement', 'getInstalledRelatedApps', 'showOpenFilePicker']
  const present = keys.filter((k) => k in n || k in window)
  return `开放 ${present.length}/${keys.length} 项${present.length ? ` · ${present.join(' ')}` : ''}`
}

async function builtinAi(): Promise<string> {
  const lm = (window as Window & { LanguageModel?: { availability?: () => Promise<string> } }).LanguageModel
  if (!lm?.availability) return ''
  try {
    return `LanguageModel ${await withTimeout(lm.availability(), 2000, '内置 AI')}`
  } catch {
    return ''
  }
}

async function permissionStates(): Promise<string> {
  if (!navigator.permissions?.query) return ''
  const names = ['geolocation', 'notifications', 'clipboard-write', 'camera', 'microphone', 'persistent-storage'] as const
  const out: string[] = []
  for (const name of names) {
    try {
      const st = await navigator.permissions.query({ name: name as PermissionName })
      out.push(`${name === 'clipboard-write' ? '剪贴板' : name}:${st.state}`)
    } catch {
      /* 不支持的名字跳过 */
    }
  }
  return out.join(' · ')
}

function screenOrientation(): string {
  const o = screen.orientation
  return o ? `${o.type}${o.angle != null ? ` · ${o.angle}°` : ''}` : ''
}

function refreshRate(): Promise<number> {
  return new Promise((resolve) => {
    const times: number[] = []
    let last = performance.now()
    const tick = (t: number): void => {
      times.push(t - last)
      last = t
      if (times.length < 12) requestAnimationFrame(tick)
      else {
        const sorted = times.slice(1).sort((a, b) => a - b)
        const med = sorted[Math.floor(sorted.length / 2)] || 16.7
        resolve(Math.round(1000 / med))
      }
    }
    requestAnimationFrame(tick)
  })
}

function motionInfo(): string {
  if (!('DeviceMotionEvent' in window)) return ''
  const dme = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
  return dme.requestPermission ? '需要授权（未请求）' : '接口存在'
}

// ---------------- 主入口 ----------------

export async function collectClient(): Promise<Reading[]> {
  const r: Reading[] = []
  const push = (x: Reading): void => {
    r.push(x)
  }

  // 请求头
  const uaData = (navigator as Navigator & {
    userAgentData?: {
      brands: { brand: string; version: string }[]
      platform: string
      mobile: boolean
      getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>>
    }
  }).userAgentData

  push(mk('headers.ua', navigator.userAgent, '客户端自报的 UA；Electron 默认会带应用标识'))
  push(mk('headers.acceptLanguage', navigator.languages?.join(',') || navigator.language, '实际随请求发出的语言权重'))
  push(
    mk(
      'headers.secChUa',
      uaData ? uaData.brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ') : '当前浏览器不上报 Client Hints',
      undefined,
      uaData ? 'ok' : 'unavailable'
    )
  )
  push(mk('headers.secChUaPlatform', uaData?.platform ?? null, undefined, uaData ? 'ok' : 'unavailable'))
  if (uaData?.getHighEntropyValues) {
    try {
      const h = await withTimeout(
        uaData.getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'wow64', 'formFactors', 'fullVersionList']),
        3000,
        'Client Hints'
      )
      push(
        mk(
          'headers.clientHints',
          [h.architecture, h.bitness ? `${h.bitness} 位` : null, h.model, h.platformVersion ? `平台 ${h.platformVersion}` : null, h.wow64 ? 'WOW64' : null]
            .filter(Boolean)
            .join(' · ') || '未返回明细'
        )
      )
    } catch (e) {
      push(mk('headers.clientHints', `读取失败：${errText(e)}`))
    }
  } else {
    push(mk('headers.clientHints', null))
  }
  push(mk('headers.acceptEncoding', null, '由浏览器在传输层自动发送，页面脚本读不到（服务端可观测）'))
  push(
    mk(
      'headers.dnt',
      `DNT ${navigator.doNotTrack ?? '未发送'} · GPC ${(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ? '开' : '关'}`
    )
  )
  push(mk('headers.referer', document.referrer || '', document.referrer ? undefined : '本次没有来源页面'))

  // 语言与地区
  const dtf = Intl.DateTimeFormat().resolvedOptions()
  push(mk('locale.browserLanguage', navigator.language))
  push(mk('locale.languages', navigator.languages?.join(',') || navigator.language))
  push(mk('locale.intlLocale', dtf.locale))
  push(mk('locale.timezone', `${dtf.timeZone} · UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60}`))
  push(mk('locale.timezoneOffset', `UTC${new Date().getTimezoneOffset() <= 0 ? '+' : '-'}${Math.abs(new Date().getTimezoneOffset() / 60)} · ${new Date().toTimeString().slice(17, 22)}`))
  push(mk('locale.hourCycle', `${dtf.hourCycle ?? '—'} · ${new Date().toLocaleTimeString()}`))
  try {
    const loc = new Intl.Locale(dtf.locale) as Intl.Locale & { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } }
    const wi = loc.weekInfo ?? loc.getWeekInfo?.()
    push(mk('locale.weekStart', wi ? ['日', '一', '二', '三', '四', '五', '六'][wi.firstDay] ?? String(wi.firstDay) : null))
  } catch {
    push(mk('locale.weekStart', null))
  }
  push(mk('locale.numberFormat', `${(1234567.89).toLocaleString()} · ${(0.5).toLocaleString()}`))
  push(mk('locale.dateFormat', new Date(2026, 10, 12).toLocaleDateString()))
  push(mk('locale.calendar', `${dtf.calendar ?? '—'} · ${dtf.numberingSystem ?? '—'}`))
  try {
    push(mk('locale.collator', new Intl.Collator().resolvedOptions().locale))
  } catch {
    push(mk('locale.collator', null))
  }
  try {
    push(mk('locale.currency', new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1)))
  } catch {
    push(mk('locale.currency', null))
  }
  try {
    const ti = (new Intl.Locale(dtf.locale) as Intl.Locale & { getTextInfo?: () => { direction: string } }).getTextInfo?.()
    push(mk('locale.textDirection', ti?.direction ?? null))
  } catch {
    push(mk('locale.textDirection', null))
  }
  try {
    const voices = speechSynthesis.getVoices()
    push(
      mk(
        'locale.speechVoices',
        voices.length
          ? `${voices.length} 个 · ${voices.slice(0, 6).map((v) => `${v.name}(${v.lang})`).join(' ')}`
          : null,
        voices.length ? undefined : '语音列表尚未加载（需要页面停留一会儿）'
      )
    )
  } catch {
    push(mk('locale.speechVoices', null))
  }
  try {
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard
    if (kb?.getLayoutMap) {
      const map = await withTimeout(kb.getLayoutMap(), 2000, '键盘布局')
      const keys = [...map.entries()].slice(0, 6).map(([k, v]) => `${k}=${v}`)
      push(mk('locale.keyboardLayout', `${map.size} 键 · ${keys.join(' ')}`))
    } else {
      push(mk('locale.keyboardLayout', null))
    }
  } catch {
    push(mk('locale.keyboardLayout', null))
  }

  // 指纹
  const engine = (() => {
    try {
      const e = new Error('x')
      return e.stack?.includes('V8') || /V8/.test(e.stack ?? '') ? 'V8' : e.stack?.split('\n')[0] ?? '未知'
    } catch {
      return '未知'
    }
  })()
  push(mk('fp.jsEngine', engine))
  const features: Array<[string, boolean]> = [
    ['replaceAll', typeof String.prototype.replaceAll === 'function'],
    ['at', typeof [].at === 'function'],
    ['findLast', typeof (Array.prototype as unknown as { findLast?: unknown }).findLast === 'function'],
    ['structuredClone', typeof structuredClone === 'function'],
    ['Array.fromAsync', typeof (Array as unknown as { fromAsync?: unknown }).fromAsync === 'function'],
    ['Promise.withResolvers', typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === 'function'],
    ['Object.groupBy', typeof (Object as unknown as { groupBy?: unknown }).groupBy === 'function'],
    ['Set.union', typeof (Set.prototype as unknown as { union?: unknown }).union === 'function']
  ]
  push(mk('fp.engineVersion', `${features.filter(([, v]) => v).length}/${features.length} 项新特性`))
  const wasm = (() => {
    try {
      return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
    } catch {
      return false
    }
  })()
  push(mk('fp.wasm', wasm ? '可用（基础模块校验通过）' : '不可用', wasm ? undefined : 'WASM 被策略关闭'))
  const nc = nativeCheck()
  push(
    mk(
      'fp.lieCheck',
      nc.broken.length ? `发现 ${nc.broken.length} 处被改写：${nc.broken.join(' ')}` : `未发现改写（查了 ${nc.checked} 个接口）`
    )
  )
  push(mk('fp.cssSupport', `支持 ${cssFeatureCount()}/22 项新特性`))
  const fs = fontSmoothing()
  push(mk('fp.fontSmoothing', fs.kind, fs.detail))

  const c1 = drawCanvas()
  const c2 = drawCanvas()
  const canvasHash = await sha256(c1)
  push(mk('fp.canvas', shortId(canvasHash), `${c1.length} 字节 dataURL`))
  push(mk('fp.canvasRepeat', c1 === c2 ? '两次绘制完全一致' : '两次绘制不同（存在噪声或随机化）'))

  const gl = readGl()
  push(mk('fp.webgl', gl.hash ? `${gl.hash.slice(0, 8)} · ${gl.hash.slice(8, 16)}` : null, gl.version ?? undefined))
  push(mk('fp.webglVendor', gl.vendor || null))
  push(mk('fp.webglImage', gl.imageHash ? `${gl.imageHash.slice(0, 4)} · ${gl.imageHash.slice(4, 8)}` : null, gl.imageHash ? '4 像素 readPixels' : undefined))

  try {
    const a = await audioFingerprint()
    push(mk('fp.audio', a.hash ? `${a.hash.slice(0, 8)} · ${a.hash.slice(8, 16)}` : null, a.detail, a.hash ? 'ok' : 'unavailable'))
  } catch (e) {
    push(mk('fp.audio', `读取失败：${errText(e)}`))
  }

  const mathStr = [
    Math.acos(0.123), Math.acos(0.456), Math.sin(1.234), Math.tan(0.987), Math.exp(2.345),
    Math.log(3.456), Math.sqrt(5.678), Math.pow(1.23, 4.56), Math.atan(6.789), Math.cosh(7.89)
  ].map((n) => n.toString()).join('|')
  push(mk('fp.math', shortId(await sha256(mathStr))))

  const emoji = (() => {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    if (!ctx) return null
    const test = ['😀', '🫠', '🩷', '🧑‍🚀']
    ctx.font = '24px "Segoe UI Emoji", sans-serif'
    return test.map((e) => `${e}:${Math.round(ctx.measureText(e).width)}`).join(' ')
  })()
  push(mk('fp.emoji', emoji))

  const fonts = detectFonts()
  push(mk('fp.fontList', fonts.installed.length ? `${fonts.installed.length}/${fonts.tested} 种` : null, fonts.installed.join(', ') || '未探测到额外字体'))
  push(mk('fp.fontCount', fonts.installed.length ? `${fonts.installed.length} 种` : null))

  const rects = (() => {
    const el = document.createElement('div')
    el.textContent = 'IP Insight 网鉴 rect'
    el.style.cssText = 'position:absolute;left:-9999px;font:13px Arial;'
    document.body.appendChild(el)
    const rect = el.getBoundingClientRect()
    el.remove()
    return `${rect.width.toFixed(3)},${rect.height.toFixed(3)}`
  })()
  push(mk('fp.domRect', shortId(await sha256(rects)), rects))

  const svg = (() => {
    try {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      s.setAttribute('width', '200')
      s.setAttribute('height', '40')
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      t.setAttribute('x', '4')
      t.setAttribute('y', '24')
      t.setAttribute('font-family', 'Arial')
      t.setAttribute('font-size', '14')
      t.textContent = 'IP Insight 网鉴'
      s.appendChild(t)
      document.body.appendChild(s)
      const b = t.getBBox()
      const len = t.getComputedTextLength()
      s.remove()
      return `${b.width.toFixed(3)},${len.toFixed(3)}`
    } catch {
      return ''
    }
  })()
  push(mk('fp.svgText', svg ? shortId(await sha256(svg)) : null, svg))

  const metrics = (() => {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    ctx.font = '16px "Segoe UI"'
    const m = ctx.measureText('网鉴 insight 0123')
    return `${m.width.toFixed(4)},${m.actualBoundingBoxAscent?.toFixed(4)},${m.actualBoundingBoxDescent?.toFixed(4)}`
  })()
  push(mk('fp.textMetrics', metrics ? shortId(await sha256(metrics)) : null, metrics))

  push(
    mk(
      'fp.apiCounts',
      `window ${Object.getOwnPropertyNames(window).length} · HTMLElement ${Object.getOwnPropertyNames(HTMLElement.prototype).length} · CSS ${Object.getOwnPropertyNames(CSS).length}`
    )
  )
  push(mk('fp.timerResolution', `${timerResolution().toFixed(4)} ms`))
  push(mk('fp.recursionDepth', `${recursionDepth().toLocaleString()} 层`))

  const composite = await sha256([canvasHash, gl.hash, gl.imageHash, fonts.installed.join('|'), `${screen.width}x${screen.height}`, dtf.timeZone, navigator.language, navigator.hardwareConcurrency].join('#'))
  push(mk('fp.compositeId', shortId(composite)))
  const hw = await sha256([`${screen.width}x${screen.height}`, navigator.hardwareConcurrency, gl.renderer, fonts.installed.join(',')].join('|'))
  push(mk('fp.hardwareId', `${hw.slice(0, 4)} · ${hw.slice(4, 8)} · ${hw.slice(8, 12)}`))
  push(mk('fp.cacheTag', null, '需要站点在响应头写入 ETag 才可能出现；本应用不向任何站点写入标记'))
  push(
    mk(
      'fp.antiFingerprint',
      c1 === c2 ? '关：画两次完全一样' : '开：读数被随机化',
      c1 === c2 ? '没有检测到噪声注入' : '两次读数不同，说明有随机化'
    )
  )
  const brave = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave
  push(
    mk(
      'fp.protection',
      brave ? 'Brave 的隐私接口存在' : nc.broken.length ? '有接口被改写' : '没有：浏览器原样报出了指纹'
    )
  )
  const storageTrace = (() => {
    const out: string[] = []
    try {
      out.push(localStorage.length ? `localStorage ${localStorage.length} 项` : 'localStorage 空')
    } catch {
      out.push('localStorage 不可用')
    }
    out.push('indexedDB' in window ? 'IndexedDB 可用' : '无 IndexedDB')
    out.push('caches' in window ? 'CacheStorage 可用' : '无 CacheStorage')
    out.push(window.name ? 'window.name 有值' : 'window.name 空')
    return out.join(' · ')
  })()
  push(mk('fp.storageTrace', storageTrace))

  // 设备
  const osGuess = (() => {
    const u = navigator.userAgent
    if (/Windows NT 10/.test(u)) return 'Windows 10/11'
    if (/Windows NT/.test(u)) return 'Windows（旧版）'
    if (/Mac OS X/.test(u)) return 'macOS'
    if (/Android/.test(u)) return 'Android'
    if (/iPhone|iPad/.test(u)) return 'iOS'
    if (/Linux/.test(u)) return 'Linux'
    return '未知'
  })()
  push(mk('device.os', osGuess, uaData ? `Client Hints 平台：${uaData.platform}` : undefined))
  const brands = uaData?.brands.filter((b) => !/Not.?A.?Brand/i.test(b.brand)) ?? []
  push(
    mk(
      'device.browser',
      brands.length ? brands.map((b) => `${b.brand} ${b.version}`).join(' · ') : navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/)?.[0] ?? '未知'
    )
  )
  push(mk('device.cpuArch', `${navigator.userAgent.includes('x86_64') || navigator.userAgent.includes('Win64') ? 'x86 · 64 位' : '按 UA 推断'}`, '没有 Client Hints 时无法确证位数'))
  push(mk('device.form', uaData ? (uaData.mobile ? '移动' : '桌面') : navigator.maxTouchPoints > 0 ? '触控设备' : '桌面'))
  push(mk('device.model', (navigator as unknown as { userAgentData?: { model?: string } }).userAgentData?.model || null, '桌面上通常读不到具体型号'))
  push(mk('device.screen', `${screen.width}×${screen.height} · ${devicePixelRatio} 倍 · ${screen.colorDepth} 位色`))
  push(mk('device.colorDepth', `${screen.colorDepth} 位`))
  push(mk('device.pixelRatio', `${devicePixelRatio}`))
  push(mk('device.availScreen', `${screen.availWidth}×${screen.availHeight}（系统栏 ${screen.height - screen.availHeight} px）`))
  push(mk('device.screenOrientation', screenOrientation()))
  let hz = 0
  try {
    hz = await withTimeout(refreshRate(), 3000, '刷新率')
  } catch {
    hz = 0
  }
  push(mk('device.refreshRate', hz ? `${hz} Hz` : null))
  push(mk('device.monitors', `${(screen as Screen & { isExtended?: boolean }).isExtended ? '多显示器' : '一台'} · 窗口位置 ${screenX}, ${screenY}`))
  push(mk('device.windowSize', `${innerWidth}×${innerHeight}（外框 ${outerWidth}×${outerHeight}）`))
  push(mk('device.windowPosition', `${screenX}, ${screenY}`))
  const sbw = (() => {
    const d = document.createElement('div')
    d.style.cssText = 'width:100px;height:100px;overflow:scroll;position:absolute;left:-9999px'
    document.body.appendChild(d)
    const w = d.offsetWidth - d.clientWidth
    d.remove()
    return w
  })()
  push(mk('device.scrollbar', `${sbw} 像素`))
  push(
    mk(
      'device.gpuRenderer',
      gl.renderer && gl.renderer !== '无' ? gl.renderer : null,
      gl.renderer === '无' ? 'WebGL 不可用（GPU 被禁用或环境没有显卡）' : undefined
    )
  )
  push(
    mk(
      'device.virtualization',
      !gl.renderer || gl.renderer === '无'
        ? '读不到显卡信息：WebGL 不可用，无法判断是否虚拟化'
        : /Basic Render|Microsoft Basic|VMware|VirtualBox|llvmpipe|SwiftShader|WARP/i.test(gl.renderer)
          ? '检测到软件渲染或虚拟显卡：可能是虚拟机、远程桌面，或关闭了硬件加速'
          : '未检测到虚拟显卡特征',
      gl.renderer || undefined
    )
  )
  const gpu = await webgpuInfo()
  push(mk('device.webgpu', gpu.adapter ?? null))
  push(mk('device.webgpuCaps', gpu.caps ?? null))
  const gl2 = await webgl2Caps()
  push(mk('device.webgl2Caps', gl2.detail, undefined, gl2.ok ? 'ok' : 'unavailable'))
  push(mk('device.cpuThreads', `${navigator.hardwareConcurrency} 线程`))
  push(mk('device.memory', (navigator as Navigator & { deviceMemory?: number }).deviceMemory ? `≥ ${(navigator as Navigator & { deviceMemory?: number }).deviceMemory} GB` : null, (navigator as Navigator & { deviceMemory?: number }).deviceMemory ? undefined : '浏览器不提供（Chrome 仅在部分平台给出）'))
  const mem = safeMemory()
  push(mk('device.jsHeap', mem.limit ? `每个页面最多 ${(mem.limit / 1024 ** 3).toFixed(1)} GB` : null))
  push(mk('device.touch', `${navigator.maxTouchPoints} 个触控点`))
  const bat = await batteryInfo()
  push(mk('device.battery', bat?.text ?? null, bat?.detail))
  const geoPerm = await (async () => {
    try {
      const st = await navigator.permissions.query({ name: 'geolocation' })
      return st.state
    } catch {
      return 'unknown'
    }
  })()
  push(mk('device.geolocation', `权限：${geoPerm}`, '本页不主动请求定位，只读权限状态'))
  push(mk('device.motion', motionInfo()))
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean; type?: string } }).connection
  push(mk('device.connection', conn ? `${conn.effectiveType ?? '—'} · ${conn.rtt ?? '—'} ms · ${conn.downlink ?? '—'} Mbps` : null))
  try {
    const counts = await mediaDeviceCounts()
    push(mk('device.mediaDevices', counts || null, counts ? undefined : '需要媒体设备权限或环境不支持'))
  } catch (e) {
    push(mk('device.mediaDevices', `读取失败：${errText(e)}`))
  }
  try {
    push(mk('device.audioHardware', await audioHardware()))
  } catch {
    push(mk('device.audioHardware', null))
  }
  const audioLat = (() => {
    const Ctor = window.AudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    const v = `${Math.round(((ctx.baseLatency ?? 0) as number) * 1000)} ms 基础延迟${
      'outputLatency' in ctx ? ` · ${Math.round((ctx.outputLatency as number) * 1000)} ms 输出延迟` : ''
    }`
    void ctx.close()
    return v
  })()
  push(mk('device.audioLatency', audioLat))
  push(mk('device.passkey', await passkeyInfo()))
  push(mk('device.bluetooth', await bluetoothInfo()))
  const pads = navigator.getGamepads?.() ?? []
  push(mk('device.gamepad', pads.filter(Boolean).length ? `${pads.filter(Boolean).length} 个手柄` : '未接入手柄'))
  push(mk('device.vr', await xrInfo()))
  push(mk('device.vrDisplays', await xrInfo()))
  push(mk('device.usbDevices', 'usb' in navigator ? '接口开放' : '未开放'))
  push(mk('device.midiDevices', 'requestMIDIAccess' in navigator ? '接口开放' : '未开放'))
  push(mk('device.videoCodecs', codecList()))
  push(mk('device.rtcCodecs', rtcCodecs()))
  push(mk('device.recorderFormats', recorderFormats()))
  push(mk('device.hwDecode', await hwDecode()))
  push(mk('device.drm', await drmInfo()))
  push(mk('device.storageQuota', await storageQuota()))
  try {
    const rtc = await rtcLeak()
    push(mk('device.webrtcPublic', rtc.pub ?? '没有公网地址', rtc.pub ? '来自 STUN 反射候选' : '未获得 srflx 候选', rtc.pub ? 'ok' : 'partial'))
    push(mk('device.webrtcLocal', rtc.local ?? null, rtc.local ? 'host 候选（局域网地址）' : '未获得 host 候选'))
    push(mk('device.webrtcCandidates', `${rtc.count} 个候选`))
  } catch (e) {
    push(mk('device.webrtcPublic', `读取失败：${errText(e)}`))
    push(mk('device.webrtcLocal', null))
    push(mk('device.webrtcCandidates', null))
  }

  // 浏览器设置
  const mq = (q: string): boolean => {
    try {
      return matchMedia(q).matches
    } catch {
      return false
    }
  }
  push(mk('browser.colorScheme', mq('(prefers-color-scheme: dark)') ? '深色' : '浅色'))
  push(mk('browser.reducedMotion', mq('(prefers-reduced-motion: reduce)') ? '减少动画' : '正常动画'))
  push(
    mk(
      'browser.colorGamut',
      mq('(color-gamut: rec2020)') ? 'Rec.2020' : mq('(color-gamut: p3)') ? 'Display P3' : 'sRGB',
      mq('(dynamic-range: high)') ? 'HDR' : 'SDR'
    )
  )
  push(
    mk(
      'browser.contrast',
      mq('(prefers-contrast: more)') ? '更高对比' : '默认',
      mq('(forced-colors: active)') ? '强制配色已开启' : '强制配色关'
    )
  )
  push(mk('browser.forcedColors', mq('(forced-colors: active)') ? '开启' : '关闭'))
  push(mk('browser.defaultFont', `${getComputedStyle(document.documentElement).fontSize} · 强调色 ${getComputedStyle(document.documentElement).getPropertyValue('accent-color') || '系统默认'}`))
  push(
    mk(
      'browser.displayMode',
      ['standalone', 'fullscreen', 'minimal-ui'].find((m) => mq(`(display-mode: ${m})`)) ?? '浏览器标签页'
    )
  )
  push(
    mk(
      'browser.privacySignals',
      `DNT ${navigator.doNotTrack ?? '未发送'} · GPC ${(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ? '开' : '关'}`
    )
  )
  push(mk('browser.cookies', navigator.cookieEnabled ? '开' : '关'))
  try {
    push(mk('browser.permissions', await permissionStates()))
  } catch {
    push(mk('browser.permissions', null))
  }
  push(mk('browser.notifPermission', typeof Notification !== 'undefined' ? Notification.permission : null))
  push(mk('browser.geoPermission', geoPerm))
  push(
    mk(
      'browser.clipboardPermission',
      await (async () => {
        try {
          return (await navigator.permissions.query({ name: 'clipboard-write' as PermissionName })).state
        } catch {
          return null
        }
      })()
    )
  )
  push(
    mk(
      'browser.storagePersisted',
      await navigator.storage.persisted().then((v) => (v ? '已持久化' : '未持久化')).catch(() => null)
    )
  )
  push(mk('browser.sensitiveApis', sensitiveApiCount()))
  push(mk('browser.pdfViewer', navigator.pdfViewerEnabled ? '内置 PDF 阅读器' : '无内置阅读器'))
  push(mk('browser.builtinAi', await builtinAi()))
  push(mk('browser.automation', navigator.webdriver ? 'webdriver = 真（自动化）' : 'webdriver = 否'))
  push(mk('browser.automationTraces', automationTraces()))
  push(
    mk(
      'browser.identityStrings',
      `${navigator.vendor || '—'} · ${navigator.productSub || '—'} · ${navigator.plugins?.length ?? 0} 个插件`
    )
  )
  push(mk('browser.interaction', interactionState(), '由本页记录的最近指针事件'))
  try {
    push(mk('browser.workerNav', await workerNav()))
  } catch {
    push(mk('browser.workerNav', null))
  }
  push(mk('browser.adblock', adblockProbe()))
  push(mk('browser.trackerBlock', null, '需要主动向 7 家追踪域名发请求才能测；本应用不向第三方发送这类请求'))
  push(mk('browser.extensions', extensionTraces()))
  push(mk('browser.tabHistory', `${history.length} 个页面`))
  push(mk('browser.installedFonts', fonts.installed.join(', ') || null))

  // 网络
  push(mk('network.effectiveType', conn?.effectiveType ?? null))
  push(mk('network.rtt', conn?.rtt != null ? `${conn.rtt} ms` : null))
  push(mk('network.downlink', conn?.downlink != null ? `${conn.downlink} Mbps` : null))
  push(mk('network.saveData', conn?.saveData ? '开' : conn ? '关' : null))

  return r
}

// ---------------- 交互记录（让「操作方式」这一项有真实数据） ----------------

let pointerMoves = 0
let lastClickHadTrail = false
let interactionBound = false

export function bindInteractionProbe(): void {
  if (interactionBound) return
  interactionBound = true
  let movesSinceMark = 0
  window.addEventListener('pointermove', () => {
    pointerMoves++
    movesSinceMark++
  })
  window.addEventListener('pointerdown', (e) => {
    lastClickHadTrail = e.isTrusted && movesSinceMark > 2
    movesSinceMark = 0
  })
}

function interactionState(): string {
  if (!pointerMoves) return '尚未记录到指针移动'
  return `${pointerMoves} 次指针移动 · 最近点击${lastClickHadTrail ? '前有连续轨迹（像真人）' : '尚无完整轨迹'}`
}
