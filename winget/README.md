# WinGet 上架步骤（免费）

上架后用户可以直接 `winget install xueze-ai.IP-Insight` 安装，
这是目前零成本缓解 SmartScreen 拦截体感最有效的办法。

## 步骤

1. **发布 v0.2.1 Release**
   `npm run dist` 打包后，把 `release/` 下的产物（`IP-Insight-0.2.1-Setup.exe`、
   `IP-Insight-Portable.zip`、`latest.yml`、`SHA256SUMS.txt`）全部上传到
   GitHub Release（tag `v0.2.1`）。
   > 注意：`latest.yml` 是自动更新必需的，一定要上传，否则客户端查不到新版本。

2. **填写安装包哈希**
   打开 `release/SHA256SUMS.txt`，把 `IP-Insight-0.2.1-Setup.exe` 对应的
   64 位哈希填到 `xueze-ai.IP-Insight.installer.yaml` 的 `InstallerSha256` 处，
   替换掉 `__FILL_FROM_SHA256SUMS_TXT__`。

3. **提交到 winget-pkgs**
   - Fork https://github.com/microsoft/winget-pkgs
   - 把本目录 4 个 yaml 拷到
     `manifests/x/xueze-ai/IP-Insight/0.2.1/` 目录下
   - 提 PR，标题如 `New version: xueze-ai.IP-Insight version 0.2.1`
   - 等机器人验证通过（通常 1–3 天）

   也可以用官方工具一条命令生成并提交：
   `wingetcreate submit --urls https://github.com/xueze-ai/IP-Insight/releases/download/v0.2.1/IP-Insight-0.2.1-Setup.exe`

4. **后续版本**：改 `PackageVersion` / `InstallerUrl` / `InstallerSha256` 后再提 PR，
   或 `wingetcreate update xueze-ai.IP-Insight -u <新版安装包URL>`。
