# 品牌定制与发版维护手册（Medcaptain / CodeCaptain）

本仓库是上游 **codecaptain** 的定制分支。定制内容全部做成**可重复脚本**，目标是：
**拉取上游更新后，跑两个脚本 + 构建，就能出我们的品牌版安装包**，手工改动降到最低。

- 公司名：**Medcaptain**（图标/Logo）
- 产品名：**CodeCaptain**（codecaptain → CodeCaptain）
- 内核 CLI 显示名：**CodeCaptain-core**（opencode 的显示文字；技术契约保持不变）

## 一次性发版 / 每次同步上游后的流程

```bash
# 0. 同步上游（首次定制时跳过）
git fetch upstream && git merge upstream/main      # 或你的同步方式

# 1. 品牌改名（codecaptain→CodeCaptain 全量；opencode→CodeCaptain-core 仅显示文字）
node scripts/rebrand.mjs --dry                     # 先预览
node scripts/rebrand.mjs                           # 应用

# 2. 依赖 & 校验
bun install                                        # 包作用域变为 @codecaptain/*，重生成 lockfile
bun run type-check
bun run lint

# 3. 构建（gen:icons 与 vendor:opencode 已接入 package 流程，自动执行）
set CODECAPTAIN_REQUIRE_BUNDLED_OPENCODE=1         # 强制安装包内置 opencode（PowerShell 用 $env:）
bun run electron:build
```

产物：`packages/electron/dist/CodeCaptain-<版本>-win-x64.exe`

## 各脚本职责

### `scripts/rebrand.mjs` — 文本与文件改名
- **codecaptain → CodeCaptain（全量）**：`CODECAPTAIN_*`→`CODECAPTAIN_*`、`@codecaptain/*`→`@codecaptain/*`、`CodeCaptain`→`CodeCaptain`、`dev.codecaptain.desktop`→`dev.codecaptain.desktop`、含 codecaptain 的文件/目录名，以及所有引用（定义与调用一起改，保持一致）。
- **opencode → CodeCaptain-core（仅显示文字）**：文档（.md/.mdx）整篇；i18n 文案**只改值不改键名**；另有 4 条针对 .tsx 硬编码界面文字的精准规则（见脚本内 `OPENCODE_CODE_DISPLAY_RULES`）。
- **有意保留的 opencode 技术契约**（动了会拆坏与真实 opencode 的集成）：`@opencode-ai/sdk` 导入、`opencode.exe`/`.opencode`、`OPENCODE_*` 环境变量、代码里的 `CodeCaptain-core` 标识符。
- 幂等：可反复运行。上游若新增需要改的界面文字，往 `OPENCODE_CODE_DISPLAY_RULES` 加一条即可。

### `packages/electron/scripts/gen-icons.mjs` — 图标生成（已接入构建）
- 单一来源：`packages/electron/resources/icons/icon-source.svg`（方形 Medcaptain "M" 标记）。
- 生成：`icon.ico`（多尺寸，Windows 应用 + NSIS 安装包）、`icon.png`、托盘 `trayTemplate-*.png`（白色描边，适配 Windows 深色任务栏）。
- **换 logo 只需替换 `icon-source.svg` 再构建**，无需其他改动。

### `packages/electron/scripts/vendor-opencode.mjs` — 内置 opencode（已接入构建）
- 构建前把 opencode 二进制拷进安装包，实现离线开箱即用。详见 `packages/electron/BUILD-OFFLINE.md`。

## 应用内 Logo

`packages/ui/src/components/ui/CodeCaptainLogo.tsx`（改名后为 `CodeCaptainLogo.tsx`）已重写为渲染 Medcaptain "M" 标记：黑色描边用 `currentColor` 自适应明暗主题，紫色作强调色。其美术与 `icon-source.svg` 同源，换 logo 时一并更新。

## 维护成本说明
- 绝大多数定制是**纯文本规则**或**资源生成**，跟着脚本走，几乎不与上游冲突。
- 会与上游产生冲突的手工改动只有两处：`CodeCaptainLogo.tsx`（logo 组件，是我们的品牌内容，保留我方版本即可）和极少量 .tsx 界面文字规则（在 rebrand 脚本里集中维护）。
- 不要手工散改品牌字符串——一律通过 `rebrand.mjs` 的规则，保证可重复、不丢失。

bun run electron:dev
bun run electron:build