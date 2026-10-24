<div align="center">

<img src="resources/Logo.png" width="96" alt="IP Insight Logo" />

# Wang Jian · IP Insight

**Multi-source IP detection + network exit diagnostics + AI analysis (Windows desktop app)**

[简体中文](README.md) · [English](README_EN.md)

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.2.3-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-44-47848F.svg)

Copyright © 2026 [Xue Ze](https://github.com/xueze-ai)

</div>

---

## What it is

IP Insight is a free, open-source Windows desktop app that answers a deceptively simple question: **“What does my network environment actually look like?”**

It combines three capabilities:

1. **Multi-source IP detection** — visits Ping0, Net.Coffee, Net.Coffee GPT and IPPure, then cross-validates their IP-profile, risk and leak verdicts for the same machine;
2. **Network exit diagnostics** — measures, from independent vantage points, which egress your machine actually uses per target: public IP, website split tunneling, CDN edge nodes, DNS query exits;
3. **AI analysis** — sends the detection + diagnostics data to an AI provider you configure locally, producing a plain-language report that clearly separates “confirmed / cannot confirm”.

**Current version: v0.2.3** (see [CHANGELOG.md](CHANGELOG.md)).

**Requirements**: Windows 10/11 x64. No Node/Python needed.

**Download**: grab from [Releases](https://github.com/xueze-ai/IP-Insight/releases) —

| File | For |
| --- | --- |
| `IP-Insight-<ver>-Setup.exe` | NSIS installer (Start-menu shortcuts, auto-update) |
| `IP-Insight-Portable.zip` | Portable (unzip and run) |
| `SHA256SUMS.txt` | Integrity: `certutil -hashfile <file> SHA256` |

> Unsigned build: SmartScreen may warn on first run — “More info → Run anyway”. Free code-signing path: `docs/code-signing.md`.
> WinGet manifests live in `winget/`; whether the package is actually installable via WinGet should be verified with `winget search` at install time.

---

## Three-minute quick start

1. **Pick a build**: installer for daily use, portable otherwise.
2. **Run a detection**: open the app → “开始综合检测” (Start comprehensive detection) on the home page (~30–60s, four sources).
3. **Read results**:
   - Home page: primary egress IP, carrier and key attributes;
   - “网络出口诊断” (Exit Diagnostics): the real egress per website you visit;
   - “风险分析” (Risk Analysis): multi-source risk semantics and disagreements;
   - For a readable summary → “AI 分析” → “生成分析” (configure any provider in Settings, or local Ollama key-free).
4. **Keep**: every run is saved to local history; export HTML / PDF / JSON / TXT anytime.

> Want to preview the UI without installing? The repo ships a **Demo mode**: `npm install && npm run build && npm run preview:web`, then open the printed URL in a browser (sample data, Demo badge on top bar).

---

## Page guide

| Page | Question it answers |
| --- | --- |
| Overview (综合检测) | “How is my network overall?” — four-source cross-check + summary |
| IP Info | “What are this IP’s network attributes?” — multi-source field comparison |
| Network Quality | “Speed, latency to regions, reachability?” — speedtest / global nodes / reachability / service status |
| **Exit Diagnostics** (new) | “Which egress do I actually use per site?” — four measured modules |
| Risk Analysis | “How is this IP flagged? Do sources agree?” — threat intel with semantics |
| Fingerprint | “What browser traits can detectors see?” — five groups + details |
| AI Analysis | “Explain this data in plain language” — streaming report + scenario Q&A |
| History | “What were last week’s results?” — local snapshots + reload + export |

---

## Network Exit Diagnostics (0.2.3 highlight)

Open from the left navigation. “Run all” at the top; the overview gives one-sentence stats, e.g.:

> 3 HTTP egresses observed; 8 sites returned an exit IP; 2 reachable only; 1 failed; 4 DNS recursive exits (counted separately).

Four tabs, each runnable on its own; switching tabs keeps results.

### ① Website split tunneling (default tab)

**What for**: see which egress each site actually sees. Different exits can come from normal split-tunnel rules — not an anomaly by themselves.

![Split tunneling](docs/images/05-exitdiag-split.png)

**How to read**: one row per site. The category chip (CN / Intl / AI / Dev) classifies the *target*; the “Country/Region · ISP” column is *geo of the measured exit IP* (source & time in the detail view). Targets that echo show the real IPv4/IPv6; targets that don’t explicitly read “Reachable, no exit IP provided” — never filled with the main egress or another site’s result.

Supports: search by site/domain, category filter, failures/no-IP-only filter, group-by-exit, copy IP / copy table, retry item / retry all failed. Click a row for details (URL, mechanism, HTTP status, latency, measured time, data source, attempt history and raw evidence).

**Limits**: only official diagnostic endpoints of each target are tested; results describe that endpoint — they do not claim the whole site uses the same egress, and a reachable endpoint never means “service unlocked”.

### ② Public IP

**What for**: the public egress observed by external services (not your LAN address).

![Public IP](docs/images/06-exitdiag-publicip.png)

**How to read**: one row per vantage point; IPv4 / IPv6 in separate rows — an IPv6-only success keeps the real address. The mechanism column distinguishes “HTTP following the system proxy” from “Node https forced-IPv6 direct (no app-layer proxy)” — the latter may still be routed by system routing/TUN and only describes its own path.

**Limits**: no IPv6 connectivity shows a neutral “Unsupported”, never a network fault; different vantage points seeing different exits are shown side by side, never merged into one “true IP”.

### ③ CDN edge node

**What for**: which CDN edge served this request.

![CDN nodes](docs/images/07-exitdiag-cdn.png)

**How to read**: node IDs are kept **raw and complete** (`HKG61-P1`, `cache-hkg17922-HKG`) — no truncation, no city guessing; cache signals are kept in response order (`Miss from cloudfront → Hit from cloudfront` is never simplified to HIT).

**Limits**: a CDN node location is not where you are, not the DNS answer, and not your egress; latency is HTTP request time, not ICMP ping; CDNs that don’t echo a PoP only report reachability.

### ④ DNS exit lookup

**What for**: the egress a recursive resolver exposes to authoritative DNS — usually **not** your public IP.

![DNS exit](docs/images/08-exitdiag-dns.png)

**How to read**: two groups — “System-configured resolver” and “Specified public DNS (direct UDP)”. Field semantics follow Google/Akamai official docs: Akamai’s `ns` segment is the resolver exit; `ip` is the ECS representative address (not an exit); `ecs` is the client subnet. ECS/TXT-only answers never produce a guessed exit. udp4/udp6 chosen by server address.

**Limits**: results for specified public DNS do not represent “the browser’s actual DNS”; the test cannot cover browser secure DNS (DoH), in-app DoH, proxy-side remote resolution, or all system split-DNS rules. **A DNS exit differing from the HTTP exit is common and alone does not indicate a “DNS leak”.**

> All endpoints verified live on 2026-10-24; sources, field semantics and limits: [docs/exit-diagnostics-data-sources.md](docs/exit-diagnostics-data-sources.md) (Chinese).

---

## Network Quality

Order: **speedtest → global node latency → local reachability → service status**, with quick anchors at the top.

![Network quality](docs/images/03-network-quality.png)

- **Speedtest**: built-in official Cloudflare engine (down/up/latency/jitter/loaded latency; packet loss requires WebRTC TURN and shows “Not measured” — never 0 — when unavailable).
- **Global latency**: 20 nodes, min/avg/max (from the Net.Coffee source).
- **Reachability**: tests whether your machine receives a response; a response does not mean your account, region, entitlements or the whole service are available.
- **Service status**: public info from each service’s official status page (no probing of the service itself); “all normal” likewise does not mean your account/region is enabled.

---

## Reading multi-source results, risk and fingerprint

- **Overview & multi-source**: after detection, “View full results” expands per-source cards and a consistency matrix — agreements ✓, conflicts ⚠ with per-source values, no forced single verdict. ![Multi-source](docs/images/02-multisource.png)
- **Risk**: the overall level is “a program-computed value: each source’s scales normalized, median taken” — labeled as such, with each source’s original semantics; the ChatGPT split egress is a separate card. ![Risk](docs/images/09-risk.png)
- **Fingerprint**: data comes from the app’s built-in hidden browser (may differ from your daily Chrome/Edge — stated on the page); having a fingerprint is not itself a risk and does not imply tracking. ![Fingerprint](docs/images/10-fingerprint.png)

---

## AI, history and export

### AI (optional — everything else works without it)

Settings → AI Providers: 9 built-in OpenAI-compatible providers + custom + **local Ollama (key-free, data never leaves your machine)**. The API key is stored only in local `%AppData%/IP-Insight/settings.json` and sent directly to your chosen provider as login credentials (this app never proxies or stores it elsewhere); detection never auto-triggers AI — only clicking “Generate” sends a bounded summary.

Report structure: confirmed / worth attention / cannot confirm / consistency & semantics / next steps. Scenario Q&A is supported, and **standalone exit-diagnostics snapshots can be analyzed without running multi-source detection first**.

![AI](docs/images/11-ai.png)

### History

Every comprehensive run is auto-saved (failed/partial sources included, with the linked exit-diagnostics summary); a full manual diagnostics run can be saved as a standalone snapshot. Loading history shows a “Viewing history” banner — history is an immutable snapshot that live runs never overwrite. ![History](docs/images/12-history.png)

### Export

HTML / PDF / JSON / TXT all follow the currently selected snapshot: readable summary + key data + sources + times + statuses + failure reasons, plus professional detail (exit-diagnostics geo / node / cache-signal / ECS columns; long tables and IPv6 do not overflow in PDF). JSON additionally carries the full structured data.

---

## Privacy, data locations and FAQ

### Privacy boundaries

| Data | Location | Notes |
| --- | --- | --- |
| Settings (incl. AI API key) | local `%AppData%/IP-Insight/settings.json` | never uploaded |
| History (incl. diagnostics snapshots) | local `%AppData%/IP-Insight/history.json` | can be disabled / day-limited / cleared on exit |
| Detection & diagnostics | memory | not written to disk except history; evidence truncated & sanitized — no cookies/auth headers/tokens |

Third-party requests (details in [PRIVACY.md](PRIVACY.md)):

- Detection sites (Ping0 / Net.Coffee / IPPure / ip.skk.moe page flow): same as opening them in your browser;
- Exit-diagnostics targets: official Cloudflare trace, per-target official diagnostic endpoints, public perf-test resources (see the data-sources doc);
- **Exit-IP geo lookup**: unique measured exit IPs are looked up via public geo APIs (ip-api.com, fallback ipwho.is; deduplicated per IP, concurrency-limited to 2, 10-min cache; some targets like bilibili/IPIP.net provide geo themselves and are labeled as such);
- DNS exit lookup: official diagnostic TXT zones (Google / Akamai) queried against system and public resolvers;
- AI provider: only on explicit “Generate / Ask” clicks, sending normalized results + bounded diagnostics fact lines.

No browsing history, local files or clipboard collection; no telemetry/statistics/crash reporting. The hidden browser windows keep normal Chromium cache/site storage (local userData) for browser-consistent behavior; clear it in Settings or delete the folder.

### FAQ

| Symptom | Handling |
| --- | --- |
| SmartScreen block | Unsigned build: “More info → Run anyway” |
| A source says “manual verification required” | The site raised a challenge; open the source site manually, pass it, re-run (never bypassed) |
| ip.skk.moe shows a challenge page | Cloudflare challenge for your current egress; reported honestly — retry after passing it manually |
| A diagnostics row shows 403 / 429 | Target refused or rate-limited (reason shown in the row); retry that item later |
| Global nodes show “—” | Run a comprehensive detection first (data comes from the Net.Coffee source) |
| Packet loss “Not measured” | Requires WebRTC TURN; unavailable networks show “Not measured”, not 0 |
| Geo column “Not fetched” | Exit IP obtained but the public geo API failed; the IP is kept and the row is not a failure |
| DNS exit ≠ public IP | Common (carrier resolver clusters, ECS…); not a “DNS leak” by itself |
| Reachable / status OK but still unusable | Those two only mean “got a response” and “the vendor says normal” — not account/region/entitlement availability |
| AI connection failed | Use “Test connection” in Settings to see the server’s real error |
| Reachability differs from browsing | Probes follow the system proxy; extension-only proxies are not on this path |
| Packaging download timeouts | Use the npmmirror mirror: `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run dist` |

---

## Building from source & verification

```bash
git clone https://github.com/xueze-ai/IP-Insight.git
cd IP-Insight
npm install

npm run dev                          # dev mode (Electron)
npm run typecheck:node && npm run typecheck:web   # type checks (both sides, zero errors)
npm run build                        # build all three targets
npm run dist                         # Windows packaging: NSIS + portable zip + SHA256SUMS
node scripts/test-textparse.cjs      # parsing unit tests (sanitized real samples, offline)
node scripts/capture-demo.cjs        # regenerate docs/images screenshots (asserted; fails loudly)
```

Automated verification hooks (real window + real network):

```bash
# IPI_AUTO_TEST=diag IPI_DIAG_MODULES=publicIp,splitTunnel,cdnNode,dnsExit electron out/main/index.js
#   → live collection of all four modules, writes test-output/diag.result.json
# IPI_UI_VERIFY=1 / _HIST / _RISK / _SETTINGS / _FP / _EXIT
#   → real-window regression flows
```

Verification records (pass / fail / environment-limited): [docs/verification-0.2.3.md](docs/verification-0.2.3.md) (Chinese).
Screenshot inventory: [docs/screenshots.md](docs/screenshots.md).

### Directory layout

```
├─ src/
│  ├─ main/                  # Electron main process
│  │  ├─ diag/               # exit diagnostics: targets / probes / textparse / geo / orchestrator
│  │  ├─ providers/          # one adapter per site + hidden-browser base
│  │  └─ ai/ …               # settings / history / export / i18n / SSE client & prompts
│  ├─ preload/               # contextBridge minimal API surface
│  ├─ renderer/              # React UI (Material 3), incl. standalone ExitDiagnostics page
│  └─ shared/                # unified data models / diagnostics model / API types
├─ docs/                     # data sources / verification / screenshot inventory / images
└─ scripts/                  # packaging finalize / unit tests / capture & shot-check scripts
```

---

## Contributing

Issues and PRs welcome:

1. Fork; use `feat/xxx` / `fix/xxx` branches;
2. Keep the constraints: one adapter per site, unified data model, never fabricate data, never bypass challenges;
3. `npm run typecheck:node && npm run typecheck:web && npm run build` green before commit;
4. Describe motivation, scope and verification in the PR.

Code of conduct: friendly, on-topic; respect data sources’ terms of service.

## License

[MIT](LICENSE): free to use, modify, distribute and commercialize — the only condition is keeping the copyright notice (Copyright © 2026 Xue Ze). Keep the author/repo info from the About page when redistributing.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) (0.2.3: exit diagnostics as a standalone page + four table modules + real geo pipeline + search/filter/group/copy/retry + state & snapshot-identity fixes + full README/screenshot redo).

---

<div align="center">

**Wang Jian · IP Insight** — see your exit IP clearly, every time.

Copyright © 2026 [Xue Ze](https://github.com/xueze-ai) · MIT License

</div>
