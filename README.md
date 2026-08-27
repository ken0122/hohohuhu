# 呼噜呼噜

一只会主动让路的蓝色单眼桌面宠物。忙的时候陪你工作，闲的时候摸摸头、聊一句，或者吃一屏豆豆。

![蓝色单眼宠物](assets/blue-one-eye-mascot.svg)

显示名称为「呼噜呼噜」；npm 包名 `blue-one-eye-pet`、命令 `bluepet` 与应用标识保持兼容。

当前版本 **0.4.3** · **macOS** · **MIT** · Electron + 原生 JavaScript

## 安装与启动

### macOS 应用

使用本地打包产物，或仓库 [Releases](https://github.com/ken0122/huluhulu/releases) 中实际已发布的附件；此链接不表示当前版本已经发布。

1. Apple Silicon（M 系列）选择 `mac-arm64` 包；Intel 需要单独构建的 `mac-x64` 包，不能混用。
2. 打开 DMG，将 **呼噜呼噜.app** 拖入「应用程序」；也可解压 ZIP 后移动进去。
3. 启动后看屏幕顶部菜单栏的单眼宠物细轮廓图标，Dock 不显示图标。
4. 可在菜单中开启「登录时自动启动」。退出请使用「退出呼噜呼噜」，隐藏不会退出后台。

应用包自带 Electron，不需要安装 Node.js。当前本地 release 包没有 Developer ID 签名、未经 Apple 公证，macOS 可能阻止首次打开；只运行你确认来源和校验值可信的包，不要关闭系统安全保护。

### 命令行安装

需要 **Node.js 22.12+**、npm，以及首次安装时下载 Electron 的网络连接。下载 `.tgz` 后，在其所在目录执行：

```bash
npm install -g ./blue-one-eye-pet-0.4.3.tgz
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
git clone https://github.com/ken0122/huluhulu.git
cd huluhulu
npm ci
npm link
bluepet
```

`npm link` 让命令行入口指向当前源码目录；不要移动或删除目录。卸载命令行入口使用 `npm uninstall -g blue-one-eye-pet`，再从菜单退出正在运行的实例。

## 三种模式

| 模式 | 行为 | 操作 |
| --- | --- | --- |
| Dodge · 自由让路 | 自主散步、点击穿透，黑色眼珠始终看向光标；光标慢慢靠近就让路，快速逼近会弹开再减速，不自动消失 | 正常使用桌面即可 |
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
| 粒子消散隐藏 / 恢复 | **⌃⌥B** |
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

隐藏时先轻轻鼓起、再散成蓝色粒子，动画约 420ms；主进程以 460ms 兜底隐藏窗口。开始隐藏即释放鼠标交互，期间再次恢复或选模式会取消消散；系统开启「减少动态效果」时直接隐藏。Pet、Dodge、聊天和 Pac-Man 均支持。

## 聊天与隐私

从 Dodge 打开聊天时停止自主散步，仍响应光标靠近与快速逼近的闪避；光标进入气泡时停稳，方便输入。气泡外的透明区域与角色继续点击穿透，Pet 聊天保持静止。气泡为 248×140px，采用无尾尖的柔软圆角、单眼状态标记和圆形发送按钮，输入区不叠加装饰层。

当前固定使用 **`deepseek-v4-flash`**，关闭思考（`thinking.type=disabled`），effort 参数为最低 `low`。直接从主进程请求 DeepSeek 的 Anthropic 兼容接口，不为每次聊天启动 Claude Code CLI，也不会跟随本地配置中的其他模型名。

从状态栏菜单打开「API 设置…」，填写 API Key 和 Base URL 后保存，下次聊天立即生效，无需重启。Base URL 支持 `https://api.deepseek.com` 或 `https://api.deepseek.com/anthropic`，统一使用 Anthropic 兼容接口，不支持第三方代理。保存不会发起连接测试。

密钥通过 Electron `safeStorage` 使用 macOS 系统加密，密文保存在应用 userData 的 `api-settings.enc` 文件中；系统加密不可用时拒绝保存，不降级为明文。已保存密钥不会回填页面；留空保留、输入新值替换。「清除本机配置」会删除此文件，恢复自动查找。关闭或 Esc 放弃未保存输入，不影响宠物的手动隐藏状态。

按顺序寻找可用配置：

1. 在「API 设置」中保存的本机配置。

2. 进程环境里的 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY`。
3. CC Switch 当前选中的 Claude provider（系统 `sqlite3` 只读查询）。
4. Claude Code 用户 `settings.json` 的 `env`（支持 `CLAUDE_CONFIG_DIR`）。

只接受官方 `https://api.deepseek.com`，不会把其他 provider 的密钥发送给 DeepSeek；未找到配置会提示错误，不自动换模型。普通陪伴和游戏不需要任何模型配置。

聊天会把你输入的文字和固定宠物系统提示词发送到 DeepSeek；每次请求不附带历史消息，也不将对话写入文件。当前气泡的回复会留在内存中，关闭再打开仍可能看到上次回复；关闭气泡不会取消已发送的请求。已保存和自动发现的凭据只在主进程内使用，不回传 renderer、不进入日志或安装包；设置窗口仅临时接收用户输入的新密钥，提交后清空，也不修改 Claude Code / CC Switch 全局配置。输入最多 500 个 UTF-16 代码单元（部分 emoji 会占多个单位），回复最多 50 个可见字符；HTTP 请求 15 秒超时，不含此前本机配置查找时间。提示词在 `src/chat.js`；旧 `BLUEPET_CLAUDE_PATH` 不再使用。

## 常见问题

- **没看到 Dock 图标？** 这是菜单栏常驻应用，Dock 图标默认隐藏。菜单栏图标是无底板的模板轮廓，由 macOS 随菜单栏明暗自动着色，与系统图标保持一致。
- **找不到宠物？** 先按 `⌃⌥B`，或从菜单选择「找回宠物到当前屏幕」。换显示器、休眠恢复有自动恢复处理；手动隐藏除外。
- **Pet 方向键没反应？** 先切到 Pet 或点击它获取焦点；Esc 和切到别的应用会释放控制。
- **聊天报 provider 错误？** 可先从菜单「API 设置…」填写有效的官方 DeepSeek 配置；当前版本不支持任意 Claude provider。不要把密钥粘贴到 issue 或日志中。
- **`bluepet: command not found`？** 执行 `npm prefix -g`，确认其 `bin` 目录在 PATH；源码安装确认执行过 `npm link`。
- **升级后仍是旧行为？** 从菜单退出旧实例，安装新包再启动；后台实例不会在文件更新后自动重载。不要同时运行源码版和应用版。

### 已知限制

- **游戏窗口缩小后可能无法清屏。** 切换到较小显示器或降低分辨率后，现有豆豆不会随窗口重新布局，可能留在屏幕外。可从菜单重新选择 Pac-Man 开局，分数和倍率会重置。
- **游戏窗口意外隐藏不会被定时 watchdog 找回。** 当前 500ms 检查仅覆盖桌面宠物窗口。可按隐藏 / 恢复快捷键或从菜单找回；手动隐藏不会自动恢复，这是预期行为。
- **游戏中途修改「减少动态效果」时，豆豆呼吸不会立即更新。** 该设置在游戏加载时读取，重开游戏后生效；宠物形变和眼睛动画另有动态监听。
- **聊天错误统一显示。** 当前气泡不区分凭证错误、限流、超时和网络失败，不应仅凭提示断定是哪一种原因。

## 开发与验证

贡献前阅读 [AGENTS.md](AGENTS.md)，当前视觉与交互约束见源码仓库内的 `DESIGN.md`（不随安装包分发）；`PRODUCT.md` 是早期构想，不是当前功能清单。目前实际验证平台为 macOS；没有 Windows / Linux 安装、开机启动或交互验收承诺。

```bash
npm ci
npm start               # 前台开发运行
npm test                # Node 单测，无真实模型请求
npm run test:desktop    # 真实 Electron 窗口回归
npm run pack            # 本机架构 .app，输出 dist/
```

桌面测试需要 macOS 图形会话，并会操作窗口与焦点；先从菜单退出运行中的宠物，测试后自行重启。截图写入被 Git 忽略的 `work/`，仅在本轮所选用例全部成功后写入 `desktop-test-results.json`；失败时旧结果文件可能仍在，不能用它判定本轮通过。`BLUEPET_TEST_MATCH` 可按名称筛选测试；只有显式设置 `BLUEPET_TEST_CHAT=1` 才会发送一条真实模型问候。焦点被其他应用抢走可能影响键盘、长按和拖拽测试；套件遇错立即退出，后续用例尚未执行，筛选通过不代表完整回归通过。

主进程负责窗口、输入与 HTTP；renderer 使用最小 IPC。所有窗口保持 `contextIsolation`、`sandbox`，关闭 `nodeIntegration`。逻辑回归在 `test/`，真实窗口检查在 `scripts/desktop-test.mjs`。

## Release 打包

在 macOS 源码目录执行：

```bash
npm ci
npm run release:mac
```

命令先检查 `package.json` 与 `package-lock.json` 的版本一致性、差异格式并运行单测，再生成**当前 Node 运行架构**的产物；README 版本号仍需人工同步核对。Apple Silicon 请使用 arm64 Node；Intel 使用 x64 Node。已有本机交付验证范围为 arm64，具体以对应产物的 `RELEASE.md` 和验收记录为准。

每次创建独立的 `outputs/releases/v0.4.3-mac-<arch>-<随机后缀>/`，不覆盖旧包：

| 文件 | 用途 |
| --- | --- |
| `呼噜呼噜-0.4.3-mac-<arch>-unsigned.dmg` | 拖入 Applications 安装 |
| `呼噜呼噜-0.4.3-mac-<arch>-unsigned.zip` | 解压即得应用 |
| `blue-one-eye-pet-0.4.3.tgz` | npm 命令行安装 |
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
