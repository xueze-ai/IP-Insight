# 发版流程

以 `0.3.1` 为例，目标是把代码、安装包、Release 页和 WinGet 清单一起对齐。整个过程可重复，不依赖某台特定机器。

## 0. 前置检查

- `package.json` 的 `version` 是要发的版本号；
- `CHANGELOG.md` 有对应条目；
- `docs/release-notes-<version>.md` 已写好（GitHub Release 正文直接从这份拷贝）；
- `README.md` / `README_EN.md` 的版本徽章与下载表格已同步。

## 1. 本地构建与自测

```powershell
npm ci
npm run typecheck:node
npm run typecheck:web
npm run build
npm run dist            # NSIS 安装包 + 便携 zip + latest.yml + SHA256SUMS
```

产物在 `release/`：

| 文件 | 用途 |
| --- | --- |
| `IP-Insight-<ver>-Setup.exe` | 安装版（NSIS，per-user，可选目录） |
| `IP-Insight-Portable.zip` | 便携版（解压即用） |
| `latest.yml` | electron-updater 的更新清单，**必须上传**，否则老客户端查不到新版 |
| `SHA256SUMS.txt` | 只含当前版本的校验和 |

自测至少做三件事：

1. 启动 `release/win-unpacked/IP-Insight.exe`，确认窗口能起、标题正常；
2. 解压便携 zip，从解压目录启动一次；
3. 打开「网站眼里的你」，跑一次网络诊断 / CDN 雷达，确认读数是真实值而不是占位。

> 国内网络拉 Electron 慢：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run dist`。

## 2. 提交并打 tag

```powershell
git add -A
git commit -m "chore(release): v0.3.1"
git tag -a v0.3.1 -m "IP Insight v0.3.1"
git push origin main
git push origin v0.3.1
```

推到 tag 后，`.github/workflows/build-windows.yml` 会自动构建，并把产物挂到一个**草稿 Release** 上（需要仓库 Actions 有写权限，工作流里已声明 `contents: write`）。

## 3. 发布 Release

- 打开草稿 Release，正文粘贴 `docs/release-notes-<version>.md`；
- 核对资产：`Setup.exe`、`Portable.zip`、`latest.yml`、`SHA256SUMS.txt`（`.blockmap` 可选，自动更新增量用）；
- 手动构建的包，用 `Get-FileHash -Algorithm SHA256` 复核后填入正文；
- 确认后发布，**不要改 tag 名**（`latest.yml` 里的路径依赖它）。

## 4. WinGet（可选，但强烈建议）

上架后 `winget install xueze-ai.IP-Insight` 可直接装，是零成本缓解 SmartScreen 体感最有效的办法。

1. 把 `winget/*.yaml` 的 `PackageVersion`、`InstallerUrl`、`InstallerSha256`、`ReleaseNotesUrl` 更新到当前版本；
2. Fork `microsoft/winget-pkgs`，把 4 个 yaml 拷到 `manifests/x/xueze-ai/IP-Insight/<version>/`；
3. 提 PR：`New version: xueze-ai.IP-Insight version <version>`；
4. 或一条命令：`wingetcreate update xueze-ai.IP-Insight -u <新版安装包 URL> -v <version>`。

## 5. 发完检查

- 从 Release 页重新下载一次安装包，安装、启动、检查「关于」页版本号；
- 老版本客户端能收到更新提示（`latest.yml` 与 `blockmap` 都在）；
- Release 正文里的图片链接使用 `raw.githubusercontent.com/<owner>/<repo>/<tag>/...`，tag 存在才不裂图。

## 附：签名

当前包未做代码签名，首次运行会被 SmartScreen 拦。免费路线见 [code-signing.md](code-signing.md)；有证书后在 `package.json` 的 `build.win` 下配置 `certificateFile` / `certificateSubjectName` 即可，不需要改发版流程。
