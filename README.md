# VehicleVault · CI 构建镜像（脱敏）

这是 VehicleVault（iOS 保养记录 App）在 GitHub Actions macOS runner 上的**脱敏构建镜像**：源码在此公开，仅用于免费账户的 macOS runner 跑 prebuild / 模拟器验收 / 归档上传。

## 脱敏规则（本仓库不含任何真实身份标识）

| 项 | 处理方式 |
|---|---|
| 个人姓名 / 邮箱 / 电话 | 不写入任何文件；历史无残留（本仓库只有一次初始提交） |
| `bundle id`（主 App、widget 扩展） | 代码里是占位值 `com.example.vehiclevault` / `.widget`，真实值由**仓库变量** `VV_BUNDLE_ID` / `VV_WIDGET_BUNDLE_ID` 注入 |
| Team ID | 占位为空，真实值来自变量 `VV_TEAM_ID` |
| App Group | 约定 `group.<主 App bundle id>`，真实值来自变量 `VV_APP_GROUP` 兜底 |
| ASC API Key / 发行证书 / 描述文件 | 全部走仓库 Secrets，不进代码；文件名只引用变量名 |
| 本机路径 | 不出现（工作流全部用 `$RUNNER_TEMP` / `$HOME`） |

代码侧读取顺序：`process.env.VV_*` → `app.json` / `app.config.js` 占位值。Swift 侧一律由 `Bundle.main.bundleIdentifier` 推导 App Group（扩展去掉 `.widget` 后缀），因此换 bundle id 不需要改 Swift。

## 工作流

| 文件 | 用途 |
|---|---|
| `widget.yml` | 签名构建（`CODE_SIGN_IDENTITY="-"`）+ 校验 appex/entitlements + 模拟器跑 demo 读 App Group 与提醒条数 + 截屏 |
| `release.yml` | 归档 App Store 包（逐 target 手动签名 + 双描述文件 + 双 bundle export 映射），可选上传 |
| `shots.yml` | 商店截图（iPhone 6.9" / iPad 13"） |
| `check.yml` | 冒烟：启动、导出、通知排期自检 |

## 需要的仓库变量与 Secrets

变量（Settings → Variables）：`VV_BUNDLE_ID`、`VV_WIDGET_BUNDLE_ID`、`VV_TEAM_ID`、`VV_APP_GROUP`

Secrets：`ASC_KEY_ID`、`ASC_ISSUER`、`ASC_KEY_B64`、`DIST_P12_B64`、`DIST_P12_PASSWORD`、`PROFILE_MAIN_UUID`、`PROFILE_WIDGET_UUID`、`PROFILE_MAIN_B64`、`PROFILE_WIDGET_B64`

## 说明

- 免费账户的私有仓库没有 macOS runner，所以构建仓库必须公开；公开的代价通过上面的脱敏规则隔离。
- 真实上架凭据与提审记录留在本地项目的 `上架包/`，不在本仓库。
- 本仓库只保留一次初始提交，不含历史。
