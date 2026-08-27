# Blue One-Eye Pet

一只会主动让路的蓝色单眼桌面宠物。忙的时候陪你工作，闲的时候摸摸头、聊一句，或者吃一屏豆豆。

![蓝色单眼宠物](assets/blue-one-eye-mascot.svg)

当前版本 **0.4.1** · **macOS** · **MIT** · Electron + 原生 JavaScript

## 安装与启动

### macOS 应用

使用本地打包产物，或仓库 [Releases](https://github.com/ken0122/hohohuhu/releases) 中实际已发布的附件；此链接不表示当前版本已经发布。

1. Apple Silicon（M 系列）选择 `mac-arm64` 包；Intel 需要单独构建的 `mac-x64` 包，不能混用。
2. 打开 DMG，将 **Blue One-Eye Pet.app** 拖入「应用程序」；也可解压 ZIP 后移动进去。
3. 启动后看屏幕顶部菜单栏的白色宠物轮廓图标，Dock 不显示图标。
4. 可在菜单中开启「登录时自动启动」。退出请使用「退出 Blue One-Eye Pet」，隐藏不会退出后台。

应用包自带 Electron，不需要安装 Node.js。当前本地 release 包没有 Developer ID 签名、未经 Apple 公证，macOS 可能阻止首次打开；只运行你确认来源和校验值可信的包，不要关闭系统安全保护。

### 命令行安装

需要 **Node.js 22.12+**、npm，以及首次安装时下载 Electron 的网络连接。下载 `.tgz` 后，在其所在目录执行：

```bash
npm install -g ./blue-one-eye-pet-0.4.1.tgz
bluepet
```

不依赖 npm registry 已发布同名包。npm 7+ 会安装 Electron peer 依赖；`.tgz` 本身不包含 Electron 二进制。

```bash
bluepet --mode=dodge     # 自由让路，默认模式
bluepet --mode=pet       # 陪伴、互动与移动
bluepet --mode=pacman    # 吃豆小游戏
bluepet --foreground    # 前台运行，方便查看错误
```

默认启动后脱离终端、常驻后台；已运行时，命令把模式切换交给同一实例。旧参数 `--mode=control` 兼容映射为 Pet。CLI / 源码运行时，「登录时自动启动」不可用，请用打包后的 `.app`。

### 从源码安装

```bash
git clone https://github.com/ken0122/hohohuhu.git
cd hohohuhu
npm ci
npm link
bluepet
```

`npm link` 让命令行入口指向当前源码目录；不要移动或删除目录。卸载命令行入口使用 `npm uninstall -g blue-one-eye-pet`，再从菜单退出正在运行的实例。

## 三种模式

| 模式 | 行为 | 操作 |
| --- | --- | --- |
| Dodge · 自由让路 | 自主散步、点击穿透；光标慢慢靠近就让路，快速逼近会弹开再减速，不自动消失 | 正常使用桌面即可 |
| Pet · 互动与移动 | 留在身边，可以拖动、亲昵互动；安静 12–22 秒后偶尔张望或伸展 | 鼠标互动；选 Pet 或点击后用方向键移动，松键停止；Esc 释放键盘焦点 |
| Pac-Man · 吃颗豆豆 | 当前屏幕出现遮罩和随机豆豆，每清完一屏，速度再乘 **1.3** | 方向键移动，Esc 退出并回到 Pet |

Pet / Dodge 互相切换保留物理惯性：平滑起步，回到上次 Pet 停留位置时减速停稳；拖拽、方向键、聊天和隐藏可中断过渡。桌面原生窗口移动跟随屏幕渲染帧，按经过时间计算速度。

Pac-Man 初始速度 280 px/s，之后为 364、473.2……，不是每屏固定加 30% 初始速度；重新开局重置。顶部 96px 留给分数、倍率与操作提示，宠物和豆豆不会进入该区域。游戏角色没有眼皮。

### Pet 怎么玩

| 操作 | 小反应 |
| --- | --- |
| 按住并拖动 | 移动超过 6px 开始拖拽，松开停在新位置 |
| 不按鼠标，在头顶来回摸 | 短暂眯眼，“摸摸头，好舒服” |
| 不按鼠标，在肚子左右挠 | 扭动怕痒，“哎呀呀，好痒！” |
| 点击肚子 | 软软缩一下，“哎呀！戳到肚肚啦” |
| 点击脸颊 / 停留陪伴 | 贴贴、蹭蹭 |
| 按住约 0.65 秒，不拖动 | 抱抱 |
| 点击耳朵 / 眼睛附近 | 害羞 / 开心跳一下 |

反应有冷却，不播放声音。拖拽不会同时触发点击或抱抱；Esc、失焦、切换模式会结束拖拽。切到其他应用后不接收方向键，聊天输入时也不会误移动。

保持原 SVG 的轮廓、配色和结构，不加腿或身体图层；行走与奔跑只改变原身体路径的形状。桌面角色 84px、游戏 64px。桌面眼睛大多数时间睁开，每隔约 3.8–7.2 秒短促眨眼；系统「减少动态效果」会关闭弹射、眨眼及自主小动作，保留普通避让。

## 快捷键与菜单

`⌃` 是 Control，`⌥` 是 Option，`⌘` 是 Command。

| 操作 | 默认快捷键 |
| --- | --- |
| 立即隐藏 / 恢复 | **⌃⌥B** |
| 呼出头顶聊天气泡 | **⌃⌥Space** |
| Dodge → Pet → Pac-Man → Dodge 循环切换 | **⌃⌥⌘M** |

循环键有 400ms 防连发，手动隐藏时不响应。单纯打开菜单不会显示宠物；明确选择模式、聊天或「找回宠物到当前屏幕」会显示。隐藏后不会自行现身。

默认组合避开常见系统快捷键，但无法保证不与第三方软件自定义快捷键冲突。注册失败会通知，仍可从菜单操作。要改快捷键，先退出当前实例，再从终端启动：

```bash
BLUEPET_HIDE_SHORTCUT="Control+Alt+H" \
BLUEPET_CHAT_SHORTCUT="Control+Alt+P" \
BLUEPET_MODE_SHORTCUT="Control+Alt+Command+N" \
bluepet
```

这些环境变量作用于本次启动；给已运行实例再次传入环境变量不会重新注册快捷键。

## 聊天与隐私

当前固定使用 **`deepseek-v4-flash`**，关闭思考（`thinking.type=disabled`），effort 参数为最低 `low`。直接从主进程请求 DeepSeek 的 Anthropic 兼容接口，不为每次聊天启动 Claude Code CLI，也不会跟随本地配置中的其他模型名。

只读复用本机 DeepSeek provider 凭据，按顺序寻找可用配置：

1. 进程环境里的 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY`。
2. CC Switch 当前选中的 Claude provider（系统 `sqlite3` 只读查询）。
3. Claude Code 用户 `settings.json` 的 `env`（支持 `CLAUDE_CONFIG_DIR`）。

只接受官方 `https://api.deepseek.com`，不会把其他 provider 的密钥发送给 DeepSeek；未找到配置会提示错误，不自动换模型。普通陪伴和游戏不需要任何模型配置。

聊天会把你输入的文字和固定宠物系统提示词发送到 DeepSeek；应用不保存聊天历史。凭据只在主进程内使用，不进入 renderer、日志或安装包，也不修改 Claude Code / CC Switch 全局配置。输入最多 500 字符，回复最多 50 个可见字符，单次请求 15 秒超时。提示词在 `src/chat.js`；旧 `BLUEPET_CLAUDE_PATH` 不再使用。

## 常见问题

- **没看到 Dock 图标？** 这是菜单栏常驻应用，Dock 图标默认隐藏。菜单栏图标是无底板的固定白色轮廓，浅色背景上可能不明显。
- **找不到宠物？** 先按 `⌃⌥B`，或从菜单选择「找回宠物到当前屏幕」。换显示器、休眠恢复有自动恢复处理；手动隐藏除外。
- **Pet 方向键没反应？** 先切到 Pet 或点击它获取焦点；Esc 和切到别的应用会释放控制。
- **聊天报 provider 错误？** 确认上述来源中有有效的官方 DeepSeek 配置；当前版本不支持任意 Claude provider。不要把密钥粘贴到 issue 或日志中。
- **`bluepet: command not found`？** 执行 `npm prefix -g`，确认其 `bin` 目录在 PATH；源码安装确认执行过 `npm link`。
- **升级后仍是旧行为？** 从菜单退出旧实例，安装新包再启动；后台实例不会在文件更新后自动重载。不要同时运行源码版和应用版。

## 开发与验证

贡献前阅读 [AGENTS.md](AGENTS.md)。目前实际验证平台为 macOS；没有 Windows / Linux 安装、开机启动或交互验收承诺。

```bash
npm ci
npm start               # 前台开发运行
npm test                # Node 单测，无真实模型请求
npm run test:desktop    # 真实 Electron 窗口回归
npm run pack            # 本机架构 .app，输出 dist/
```

桌面测试需要 macOS 图形会话，并会操作窗口与焦点；先从菜单退出运行中的宠物，测试后自行重启。结果写入被 Git 忽略的 `work/`。`BLUEPET_TEST_MATCH` 可按名称筛选测试；只有显式设置 `BLUEPET_TEST_CHAT=1` 才会发送一条真实模型问候。焦点被其他应用抢走可能影响键盘测试；筛选通过不代表完整回归通过。

主进程负责窗口、输入与 HTTP；renderer 使用最小 IPC。所有窗口保持 `contextIsolation`、`sandbox`，关闭 `nodeIntegration`。逻辑回归在 `test/`，真实窗口检查在 `scripts/desktop-test.mjs`。

## Release 打包

在 macOS 源码目录执行：

```bash
npm ci
npm run release:mac
```

命令先检查版本一致性、差异格式并运行单测，再生成**当前 Node 运行架构**的产物。Apple Silicon 请使用 arm64 Node；Intel 使用 x64 Node。本轮交付仅验证 arm64。

每次创建独立的 `outputs/releases/v0.4.1-mac-<arch>-<随机后缀>/`，不覆盖旧包：

| 文件 | 用途 |
| --- | --- |
| `Blue-One-Eye-Pet-0.4.1-mac-<arch>-unsigned.dmg` | 拖入 Applications 安装 |
| `Blue-One-Eye-Pet-0.4.1-mac-<arch>-unsigned.zip` | 解压即得应用 |
| `blue-one-eye-pet-0.4.1.tgz` | npm 命令行安装 |
| `SHA256SUMS` | 三个安装包的 SHA-256 校验值 |
| `RELEASE.md` | 基础提交、未提交状态、构建范围与安装说明 |
| `README.md` / `AGENTS.md` / `LICENSE` | 使用手册、协作指南与 MIT 协议副本 |

在产物目录校验：

```bash
shasum -a 256 -c SHA256SUMS
```

脚本同时检查 DMG / ZIP 完整性和 npm 包文件清单。打包不会运行桌面交互测试、请求聊天、签署 Developer ID、进行 Apple 公证、创建 Git tag，或上传 GitHub / npm。`RELEASE.md` 会明确标记未提交工作区，公开发布前应完成代码提交、桌面验收和签名策略确认。

只需要原始 DMG / ZIP 构建可用 `npm run dist:mac`，输出 `dist/`；完整交付用 `release:mac`。`dist/`、`work/`、`outputs/` 和安装包都不入 Git。

## License

[MIT](LICENSE)
