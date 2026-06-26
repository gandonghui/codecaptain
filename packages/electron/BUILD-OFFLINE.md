# 离线内网构建：内置 opencode CLI 的 Windows 安装包

目标：编译出一个 Windows 安装包（NSIS），把 **opencode CLI 直接打进安装包**，
同事在内网/离线环境装完就能开箱即用，不需要单独安装 opencode，也不依赖系统 PATH。

## 工作原理

1. 构建时，`scripts/vendor-opencode.mjs` 把 opencode 二进制拷到
   `packages/electron/resources/opencode/`。
2. electron-builder 通过 `build.extraResources` 把该目录打进安装包，
   运行时位于 `<安装目录>/resources/opencode/opencode.exe`。
3. 应用启动时，`main.mjs` 的 `applyBundledOpencodeBinary()` 检测到这个二进制，
   就把环境变量 `OPENCHAMBER_OPENCODE_BIN` 指向它。
   该变量在 opencode 解析逻辑里优先级最高，所以会直接用内置版本。
   （用户若自己配置了 opencode 路径，仍然以用户配置为准，内置版只兜底。）

## 一、准备（联网机器上做一次）

> 构建机需要：Node ≥ 22、Bun（`packageManager` 指定 `bun@1.3.14`）、
> Windows + NSIS（electron-builder 会自带处理）。

1. 安装依赖（首次需联网，把 node_modules 准备好）：

   ```bash
   bun install
   ```

2. 准备 opencode 的 Windows 二进制。三选一：

   - **已安装 opencode**：确保它在标准位置
     `%USERPROFILE%\.opencode\bin\opencode.exe`，vendor 脚本会自动找到。
   - **手头有 opencode.exe**：构建时用参数或环境变量指定来源（见下）。
   - **npm 方式**：`bun add -g opencode-ai`（或在内网 npm 源安装），
     装好后通常也会落到上面的标准位置。

   > 内网无法联网时，请在能联网的机器上先把 opencode.exe 拉好，
   > 拷到构建机，再用 `--source` 指定路径。

## 二、构建安装包

仓库根目录执行：

```bash
bun run electron:build
```

它会依次：构建 UI → 打包 main → 重建原生模块 →
**vendor opencode（拷贝二进制）** → 跑 electron-builder。

产物在 `packages/electron/dist/`，例如 `OpenChamber-<版本>-win-x64.exe`。

### 指定 opencode 来源

如果 opencode 不在标准位置，用下面任一方式告诉 vendor 脚本：

```bash
# 方式 A：环境变量
set OPENCHAMBER_OPENCODE_SOURCE=D:\tools\opencode.exe   # cmd
$env:OPENCHAMBER_OPENCODE_SOURCE="D:\tools\opencode.exe" # PowerShell
bun run electron:build

# 方式 B：单独先跑 vendor，再构建
bun run --cwd packages/electron vendor:opencode -- --source D:\tools\opencode.exe
bun run electron:build
```

来源可以是单个 `opencode.exe`，也可以是一个**目录**（整目录会被拷进去，
适合 opencode 带附属文件的情况）。

### 强制要求内置（发布构建推荐）

默认情况下，如果找不到 opencode，构建会**警告但继续**（安装包将回退到系统 PATH）。
发布给同事的安装包必须自带 opencode，建议开启硬校验，找不到就直接构建失败：

```bash
set OPENCHAMBER_REQUIRE_BUNDLED_OPENCODE=1   # cmd
bun run electron:build
```

## 三、验证

1. 构建日志里应出现 `[vendor-opencode] bundled opencode ready: ...`。
2. 安装后检查 `<安装目录>\resources\opencode\opencode.exe` 存在。
3. 启动应用，在日志里应看到 `[desktop] Using bundled opencode CLI: ...`
   （`electron-log` 的日志路径，应用名 `OpenChamber`）。
4. 在一台**没装过 opencode、PATH 里也没有**的干净机器上安装验证开箱即用。

## 关键文件

| 文件 | 作用 |
|------|------|
| `scripts/vendor-opencode.mjs` | 构建前把 opencode 二进制拷进 `resources/opencode/` |
| `resources/opencode/` | 打包进安装包的 opencode 目录（由 vendor 脚本填充） |
| `package.json` → `build.extraResources` | 把上面目录打进安装包 |
| `package.json` → `scripts.package` | 在 electron-builder 之前调用 vendor 步骤 |
| `main.mjs` → `applyBundledOpencodeBinary()` | 运行时把 `OPENCHAMBER_OPENCODE_BIN` 指向内置二进制 |

## 注意

- opencode 二进制是平台相关的：给 Windows 同事就要放 Windows 版 `opencode.exe`。
  在 Windows 机器上构建即可。
- `resources/opencode/` 里除 `README.md` 外的二进制建议加进 `.gitignore`，
  不要提交到仓库（体积大、平台相关）。
