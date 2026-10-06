# 免费代码签名路线图（SignPath Foundation）

> 现状：未签名。Windows SmartScreen 会对未签名安装包弹「Windows 已保护你的电脑」
> 提示，用户需点「更多信息 → 仍要运行」。
>
> 目标：零成本获得受信任的代码签名。注意——免费方案的签名发布者显示为
> "SignPath Foundation"，**不是「薛泽」**；想要署自己名字的证书目前没有免费渠道
> （最便宜的是 Certum 开源证书，约 €69 首年）。

## 免费三件套（现在就能做）

1. **WinGet 上架**：见 `winget/README.md`。`winget install` 的用户基本感知不到
   SmartScreen，且多一个分发渠道。
2. **提交给微软做恶意软件分析**（免费，有助于积累 SmartScreen 信誉）：
   https://www.microsoft.com/en-us/wdsi/filesubmission ，上传
   `IP-Insight-<版本>-Setup.exe`，选择「软件开发人员」提交。
3. **Release 附 SHA256SUMS.txt**：已由 `scripts/finalize-release.mjs` 自动生成，
   发布时记得一起上传，让用户能校验完整性。

## SignPath 申请（等项目有一定 star / 下载量后再申请）

申请地址：https://signpath.org/（先读 https://signpath.org/terms.html 的开源条款）

**申请条件自查**（对照本项目）：

- [x] OSI 批准的开源许可证（MIT），无商业双授权
- [x] 无专有/闭源组件
- [x] 已发布可供签名的版本（GitHub Releases）
- [x] 源码公开（本仓库）
- [x] 功能在下载页有文档说明（README）
- [x] 有隐私政策（`PRIVACY.md`）
- [x] 代码签名策略已公示（见下方）
- [ ] 有一定可验证的知名度（star / 下载量 / 社区讨论）——**目前不满足，先积累**
- [ ] 可重复的构建流程（建议补 GitHub Actions 自动打包，见下方）

**申请方式**：在 signpath.org 下载申请表（OSSRequestForm），填好发到
oss-support@signpath.org，审核通常几天到几周。

**获批后的集成**：用官方 GitHub Action（`signpath/github-action-submit-signing-request`）
在 Release 流程里提交安装包签名；私钥由 SignPath 的 HSM 保管，你接触不到。

## 代码签名策略（公示用，SignPath 要求发布在项目主页）

- 本项目的所有 Windows 发布产物（`IP-Insight-<版本>-Setup.exe`、
  `IP-Insight-Portable.zip`）均由本仓库公开源码构建，构建脚本见 `package.json`
  的 `dist` / `dist:portable` 与 `scripts/finalize-release.mjs`。
- 仅项目维护者（薛泽，xueze-ai）可触发正式 Release 构建；签名产物与对应
  git tag 的源码一致，任何人可用 `SHA256SUMS.txt` 校验。
- 不签名任何非本仓库构建的二进制文件；不将签名用于其他项目。

## 建议补的 GitHub Actions（申请前）

`.github/workflows/release.yml`：在打 tag（`v*`）时自动
`npm install && npm run dist`，把 `release/` 产物上传到 GitHub Release。
可重复构建是 SignPath 审核的加分项，也省得每次手动打包。
