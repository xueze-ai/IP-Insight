// 探针页：仅标记就绪。真实探测脚本由主进程注入本页上下文执行，
// 因此探测走与真实浏览器完全相同的网络栈 / 请求头 / 系统代理。
declare global {
  interface Window {
    __PROBE_READY__: boolean
  }
}
window.__PROBE_READY__ = true

export {}
