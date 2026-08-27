# Blue One-Eye Pet

一只会主动让路的蓝色单眼桌面宠物。它平时在桌面散步、躲开光标，也可以固定陪伴、和你说一句悄悄话，或者把当前屏幕变成一局吃豆小游戏。

> 当前 MVP 面向 macOS；源码基于 Electron，后续可以补 Windows / Linux 的安装与开机启动适配。

## 桌面模式与小游戏

- **Dodge（默认）**：持续可见、自由走动，光标靠近时主动躲开，不再自动消失。窗口点击穿透，不阻挡正常操作。
- **Pet**：固定在当前屏幕右下角。靠近会害羞、冒爱心；停留会蹭蹭；在头部来回移动光标会享受摸头；点击会跳一下或扭捏。无人互动时，每次安静 12–22 秒后会短暂张望或轻轻伸展，光标靠近、聊天和隐藏时停止自主动作。
- **Control**：选择后用方向键自由移动，松键停下，原轮廓快速形变模拟跑动，眼珠朝向移动方向。`Esc` 回到 Pet；切到其他应用后停止接收方向键，点击宠物可继续控制。
- **Pac-Man**：当前屏幕出现遮罩和随机豆豆，用方向键移动，`Esc` 随时退出。游戏角色不带眼皮，始终睁眼。

模式从 macOS 菜单栏里的单色宠物轮廓图标切换。图标为固定纯白色透明轮廓，没有方框底板，并提供 Retina 素材。点击图标只打开菜单，不会唤醒宠物或呼出聊天；选定具体模式才显示宠物。

直接加载原始 SVG，保持源文件、配色和结构不变，不叠加独立的腿或身体层。走路、跑步只改变原身体路径的下摆形状，停止后恢复原轮廓。

桌面模式默认完全睁眼，每隔约 3.8–7.2 秒短促眨眼一次；情绪眨眼不超过 0.28 秒，连续摸头不会让眼皮一直下垂。游戏仅在运行时移除眼皮节点，原 SVG 文件不变。系统开启「减少动态效果」时停止眨眼与自主小动作。

菜单打开期间暂停移动。`Control + Option + B` 可手动隐藏或恢复；隐藏后不会自行现身。

如果切换显示器或桌面后找不到它，选择菜单「找回宠物到当前屏幕」。休眠恢复、显示器变化和渲染进程重载也有自动恢复处理。

## 安装

需要 Node.js 22+ 与已经可用的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)。

从下载的 npm 包安装（npm 7+ 会自动安装 Electron peer 依赖）：

```bash
npm install -g ./blue-one-eye-pet-0.2.2.tgz
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

也可以指定模式：`bluepet --mode=dodge`、`bluepet --mode=pet`、`bluepet --mode=control` 或 `bluepet --mode=pacman`。已运行时会在同一个实例中切换。

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

应用通过本机 `claude -p` 发起一次性、无工具、无会话持久化的请求，因此沿用 Claude Code 当前 provider 和认证配置，不读取、复制或保存密钥。宠物系统提示词位于 `src/chat.js` 的 `SYSTEM_PROMPT`。

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
npm run test:desktop
npm run pack
```

核心进程只向渲染层暴露最小 IPC 接口，所有窗口启用 `contextIsolation`、`sandbox` 并关闭 `nodeIntegration`。聊天使用 `spawn` 参数数组调用 Claude Code，不经过 shell。

桌面集成测试需要 macOS 图形会话；先退出已运行的宠物，以免测试快捷键与正式实例冲突。测试创建真实窗口，验证原 SVG 结构、路径形变、像素可见性、方向键、模式切换、持续可见和恢复流程，结果仅保存到被 Git 忽略的 `work/`。不会请求模型。

## License

[MIT](./LICENSE)
