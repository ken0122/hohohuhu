# Blue One-Eye Pet

一只会主动让路的蓝色单眼桌面宠物。它平时在桌面散步、躲开光标，也可以固定陪伴、和你说一句悄悄话，或者把当前屏幕变成一局吃豆小游戏。

> 当前 MVP 面向 macOS；源码基于 Electron，后续可以补 Windows / Linux 的安装与开机启动适配。

## 桌面模式与小游戏

- **Dodge（默认）**：持续可见、自由走动，光标慢慢靠近时正常让路，快速逼近时像神经反射一样弹开；逼近越快弹射越强，随后迅速减速恢复散步。短冷却避免连续乱弹，屏幕边缘会转向，不自动消失。系统开启「减少动态效果」时关闭弹射，保留普通避让。窗口点击穿透，不阻挡正常操作。
- **Pet**：互动与移动合为一体。选择 Pet 或点击宠物后，方向键移动、松键停下；`Esc` 释放键盘焦点，宠物留在原地。切到其他应用不接收方向键，聊天时也不会误移动。无人互动时，每次安静 12–22 秒后短暂张望或伸展。
- **Pac-Man**：当前屏幕出现遮罩和随机豆豆，用方向键移动，`Esc` 随时退出。每吃完一屏，当前速度乘 1.3（即提速 30%，280 → 364 → 473.2 像素/秒），保持当前方向立即生效；重新开局重置。提示、分数和倍率仅出现在顶部 96px 安全区，宠物和豆豆不会进入提示区。游戏角色不带眼皮。

Pet / Dodge 互相切换不会瞬移：Dodge 平滑起步；回 Pet 时保留惯性，加速靠近上次停留的位置后减速停稳。途中再次切换会从当前速度接续；拖拽、方向键、Esc、聊天或隐藏可以中断过渡。「减少动态效果」下不播放长距离过渡。

桌面移动跟随可见渲染器的 `requestAnimationFrame`，不再受旧 32ms 定时器限制，适配屏幕刷新节奏；静止时不重复移动原生窗口，隐藏/聊天时停止帧请求。独立低频检查仍负责意外隐藏恢复，不会唤醒手动隐藏的宠物。

Pet 支持不同部位的反馈，均为短促动作与文字，不播放声音：

| 操作 | 反馈 |
| --- | --- |
| 按住并拖动 | 移动超过 6px 后开始拖拽；松开留在新位置，不触发点击 |
| 头顶来回摸 | 轻轻眯眼，“摸摸头，好舒服” |
| 肚子左右挠几下 | 扭动怕痒，“哎呀呀，好痒！” |
| 点击肚子 | 软软缩一下，“哎呀！戳到肚肚啦” |
| 点击脸颊 / 停留陪伴 | 贴贴、蹭蹭 |
| 按住约 0.65 秒 | 抱抱；松开不会再触发戳肚子 |
| 点击耳朵 / 眼睛附近 | 害羞 / 开心跳一下 |

同类反应有冷却时间；移动、聊天、隐藏会中断互动和自主动作。拖拽时暂停键盘移动和互动，屏幕边缘会限制位置以保持可见；Esc、失去焦点或切换模式会结束拖拽。摸头和挠痒使用不按鼠标的悬停移动，按住不移动仍是抱抱。默认桌面形象为 84px（原 96px），游戏为 64px（原 72px），聊天框和文字不缩小。

模式从 macOS 菜单栏里的单色宠物轮廓图标切换。图标为固定纯白色透明轮廓，没有方框底板，并提供 Retina 素材。点击图标只打开菜单，不会唤醒宠物或呼出聊天；选定具体模式才显示宠物。

直接加载原始 SVG，保持源文件、配色和结构不变，不叠加独立的腿或身体层。走路、跑步只改变原身体路径的下摆形状，停止后恢复原轮廓。

桌面模式默认完全睁眼，每隔约 3.8–7.2 秒短促眨眼一次；情绪眨眼不超过 0.28 秒，连续摸头不会让眼皮一直下垂。游戏仅在运行时移除眼皮节点，原 SVG 文件不变。系统开启「减少动态效果」时停止眨眼与自主小动作。

菜单打开期间暂停移动。`Control + Option + B` 可手动隐藏或恢复；隐藏后不会自行现身。

如果切换显示器或桌面后找不到它，选择菜单「找回宠物到当前屏幕」。休眠恢复、显示器变化和渲染进程重载也有自动恢复处理。

## 安装

需要 Node.js 22+。聊天需在 Claude Code 或 CC Switch 中配置可用的 DeepSeek provider；本机 CC Switch 的配置读取使用系统 `sqlite3`，不写入其数据库。

从下载的 npm 包安装（npm 7+ 会自动安装 Electron peer 依赖）：

```bash
npm install -g ./blue-one-eye-pet-0.4.1.tgz
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

也可以指定模式：`bluepet --mode=dodge`、`bluepet --mode=pet` 或 `bluepet --mode=pacman`。已运行时会在同一个实例中切换。旧的 `--mode=control` 兼容映射为 Pet，菜单不再单列 Control。

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
| 循环切换模式 | `⌃⌥⌘M` | Dodge → Pet → Pac-Man → Dodge；400ms 防连发，隐藏时不响应 |

如本机已有软件占用，可在启动前修改：

```bash
BLUEPET_HIDE_SHORTCUT="Control+Alt+H" \
BLUEPET_CHAT_SHORTCUT="Control+Alt+P" \
BLUEPET_MODE_SHORTCUT="Control+Alt+Command+N" \
bluepet
```

Electron 快捷键格式参见 `globalShortcut` 的 Accelerator 语法。循环键使用 Control + Option + Command + M，避开常用单/双修饰键组合；无法保证所有第三方软件均未自定义占用。注册失败时应用会发送系统通知，不覆盖已有快捷键，仍可使用菜单切换。

## 快速宠物聊天

固定使用 `deepseek-v4-flash`，关闭思考（`thinking.type=disabled`），思考等级参数设为最低 `low`。配置依据：[DeepSeek 思考参数](https://api-docs.deepseek.com/guides/thinking_mode/)。直接请求 DeepSeek 的 Anthropic 兼容接口，省去每条消息启动 Claude Code CLI 的开销；不带工具、不保存历史。宠物系统提示词位于 `src/chat.js`。

凭证只在主进程内读取和使用：先检查进程内 DeepSeek 环境变量，再读 CC Switch 当前选中的 Claude provider，最后检查 Claude Code 用户 `settings.json`（支持 `CLAUDE_CONFIG_DIR`）。只接受官方 `https://api.deepseek.com`，不会拿其他 provider 的密钥请求 DeepSeek，也不会修改全局 Claude Code / CC Switch 配置。未找到可用配置时会报错，不悄悄回退到其他模型。

为了避免浮窗变成长对话：

- 输入最多 500 字；
- 系统提示要求只回一句；
- 应用端再次限制为最多 50 个可见字符，超长时优先在标点/空格收尾并加省略号；
- 单次请求 15 秒超时。

原 `BLUEPET_CLAUDE_PATH` 不再需要；不要把密钥写入仓库或安装包。

## 开发

```bash
npm start
npm test
npm run test:desktop
npm run pack
```

核心进程只向渲染层暴露最小 IPC 接口，所有窗口启用 `contextIsolation`、`sandbox` 并关闭 `nodeIntegration`。聊天 HTTP 与凭证读取均在主进程，密钥不传入渲染层、不打印日志，拒绝 HTTP 重定向。

桌面集成测试需要 macOS 图形会话；先退出已运行的宠物，以免测试快捷键与正式实例冲突。测试创建真实窗口，验证原 SVG、路径形变、像素可见性、方向键、惯性切换和恢复流程，结果仅保存到被 Git 忽略的 `work/`。默认不请求模型；显式设置 `BLUEPET_TEST_CHAT=1` 才会发送一条真实问候，验证聊天气泡。

## License

[MIT](./LICENSE)
