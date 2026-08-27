# Blue One-Eye Pet

一只会主动让路的蓝色单眼桌面宠物。它平时在桌面散步、躲开光标，也可以固定陪伴、和你说一句悄悄话，或者把当前屏幕变成一局吃豆小游戏。

> 当前 MVP 面向 macOS；源码基于 Electron，后续可以补 Windows / Linux 的安装与开机启动适配。

## 三种模式

- **Dodge（默认）**：自由走动，光标靠近时主动躲开。窗口始终点击穿透，不阻挡正常操作。
- **Pet**：固定在当前屏幕右下角。Hover 时会靠近、扭捏并冒出小爱心。
- **Pac-Man**：当前屏幕出现遮罩和随机豆豆，用方向键移动，`Esc` 随时退出。

模式从 macOS 菜单栏里的宠物图标切换。

## 安装

需要 Node.js 22+ 与已经可用的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)。

从下载的 npm 包安装（npm 7+ 会自动安装 Electron peer 依赖）：

```bash
npm install -g ./blue-one-eye-pet-0.1.0.tgz
bluepet
```

从源码开发安装：

```bash
git clone https://github.com/ken0122/hohohuhu.git
cd hohohuhu
npm install
npm link
bluepet
```

`bluepet` 默认脱离终端、常驻后台。调试时可以保留日志：

```bash
bluepet --foreground
```

开发或演示时也可以直接指定启动模式：`bluepet --mode=pet` 或 `bluepet --mode=pacman`。

也可以生成 macOS DMG 与 ZIP：

```bash
npm run dist:mac
```

打包后的应用可在菜单栏开启“登录时自动启动”。

## 快捷键

| 操作 | 默认快捷键 | 说明 |
| --- | --- | --- |
| 立即隐藏 / 恢复 | `⌃⌥B` | 避开 `⌘H`、`⌘Space` 等高频系统组合 |
| 呼出聊天气泡 | `⌃⌥Space` | 气泡出现在宠物头顶 |

如本机已有软件占用，可在启动前修改：

```bash
BLUEPET_HIDE_SHORTCUT="Control+Alt+H" \
BLUEPET_CHAT_SHORTCUT="Control+Alt+P" \
bluepet
```

Electron 快捷键格式参见 `globalShortcut` 的 Accelerator 语法。注册失败时应用会发送系统通知，但不会覆盖已有快捷键。

## Claude Code 聊天

应用通过本机 `claude -p` 发起一次性、无工具、无会话持久化的请求，因此沿用 Claude Code 当前 provider 和认证配置，不读取、复制或保存密钥。宠物系统提示词位于 `src/main.js` 的 `SYSTEM_PROMPT`。

为了避免浮窗变成长对话：

- 输入最多 500 字；
- 系统提示要求只回一句；
- 应用端再次限制为最多 50 个可见字符，超长时优先在标点/空格收尾并加省略号；
- 单次请求 45 秒超时。

如果 `claude` 不在常见安装位置，可以指定完整路径：

```bash
BLUEPET_CLAUDE_PATH="/absolute/path/to/claude" bluepet
```

## 开发

```bash
npm start
npm test
npm run pack
```

核心进程只向渲染层暴露最小 IPC 接口，所有窗口启用 `contextIsolation`、`sandbox` 并关闭 `nodeIntegration`。聊天使用 `spawn` 参数数组调用 Claude Code，不经过 shell。

## License

[MIT](./LICENSE)
