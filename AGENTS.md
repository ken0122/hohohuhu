# 项目协作指南

本文件适用于整个仓库。Blue One-Eye Pet 是 MIT 开源的 Electron 桌面宠物，目前交付和验证平台为 macOS；不要把跨平台源码等同于 Windows / Linux 已支持。

## 开始工作

- 先读 `README.md`、`package.json`，检查 `git status --short --branch`，保留用户已有改动。
- 使用 Node.js 22.12+ 和 npm；首次开发执行 `npm ci`。项目为原生 JavaScript / ESM，无前端框架或编译步骤，preload 使用 CommonJS。
- `DESIGN.md` / `PRODUCT.md` 是早期设计背景，部分尺寸和聊天方式已过时；当前行为以源码、测试和 README 为准。不要根据旧说明恢复已移除的功能。
- 不读取或打印真实 provider 密钥来排查普通 UI、构建或文档问题。

## 代码地图

| 路径 | 职责 |
| --- | --- |
| `bin/bluepet.js` | CLI、后台启动、参数透传 |
| `src/main.js` | 原生窗口、托盘、快捷键、焦点、模式、可见性、IPC |
| `src/preload.cjs` | 最小化的 renderer bridge |
| `src/core.js` | 模式、尺寸、位置约束、回复截断等纯函数 |
| `src/dodge.js` / `src/mode-motion.js` | 闪躲反射、速度与模式切换惯性 |
| `src/chat-provider.js` / `src/chat.js` | 只读 provider 配置、主进程 HTTP、宠物提示词 |
| `src/renderer/` | 宠物、聊天、游戏界面及眼睛/形变/拖拽/互动状态机 |
| `assets/` | 原始 SVG、应用图标、1x / 2x 托盘图标 |
| `test/` / `scripts/desktop-test.mjs` | Node 单测 / 真实 Electron 桌面回归 |
| `scripts/release.mjs` | 本地 release 打包、包内容检查、校验清单 |

## 不可回退的交互约束

- 只有 Dodge、Pet、Pac-Man 三种模式；旧 `--mode=control` 仅兼容映射为 Pet。
- 原始 `assets/blue-one-eye-mascot.svg` 不改写、不重绘、不加腿或身体层。行走和奔跑通过运行时原身体路径形变实现，静止后恢复；衍生图标用现有脚本生成。
- 桌面默认角色 84px、游戏 64px。眼睛大多数时间睁开，眨眼短促；Pac-Man 的运行时角色不带眼皮，不能为此修改源 SVG。
- Dodge 持续可见、点击穿透；光标越快逼近，反射弹射越强，并有冷却和减速。不要用自动隐藏代替避让。
- Pet 保留拖拽、方向键、摸头/挠痒/长按等互动和稀疏自主动作。拖拽不能同时触发点击或长按，聊天不能误触方向键移动；失焦和 Esc 要释放控制。
- Pet / Dodge 切换保留速度，平滑起步和停靠；中途切换、拖拽、聊天、隐藏须正确取消或接续过渡。
- 原生移动由 renderer `requestAnimationFrame` 驱动、按经过时间积分，位置整数未变时不重复调用 `setPosition`。不要恢复 32ms 定时器，也不要把速度绑定到帧数。
- 手动隐藏是独立状态：恢复检查、菜单打开、循环快捷键不得把它意外唤醒。显式聊天/恢复/选模式可以显示。独立低频 watchdog 只恢复意外隐藏。
- 默认快捷键为隐藏 `Control+Alt+B`、聊天 `Control+Alt+Space`、循环 `Control+Alt+Command+M`。保留环境变量覆盖、注册失败反馈和 400ms 循环防连发；菜单不能重复注册全局快捷键。
- Pac-Man 每清完一屏乘 **1.3**，重新开局归零重算；提示、宠物和豆豆遵守顶部 96px 安全区。
- 尊重系统「减少动态效果」，避免频繁自主动作；不同屏幕坐标、休眠恢复和焦点变化不能造成丢失或抢键。

## 安全与聊天

- 保持 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`；IPC 校验来源及输入，不向 renderer 暴露通用文件、进程或网络能力。
- 当前固定 `deepseek-v4-flash`，关闭 thinking，effort 为 `low`；不是每条消息启动 Claude CLI，也不自动跟随其他 provider 的模型名。
- 配置优先级：有效 DeepSeek 进程环境 → CC Switch 当前 Claude provider（SQLite 只读）→ Claude Code 用户 settings（支持 `CLAUDE_CONFIG_DIR`）。只向官方 HTTPS DeepSeek 域名发送对应密钥，拒绝重定向。
- 不修改用户全局配置；密钥不落库、不复制进项目、不进日志、renderer、测试快照或安装包。测试用虚构凭证和 mock provider。
- 输入上限 500，回复最多 50 个可见字符；单句宠物提示词、160 token 预算、15 秒超时，不保存对话历史。

## 验证与交付

```bash
npm test                 # 纯逻辑回归，不请求真实模型
npm run test:desktop     # 真实窗口，需要 macOS 图形会话
npm run pack             # 生成本机架构 .app 到 dist/
npm run release:mac      # 单测 + 本机架构 DMG / ZIP / tgz + SHA256SUMS
```

- 桌面测试前先确认并退出该项目正在运行的实例，测试后按需恢复，不能杀掉所有 Electron 进程。测试会操作窗口、焦点和快捷键。
- `BLUEPET_TEST_MATCH` 可筛选桌面测试，但必须报告筛选范围；只在用户授权真实模型请求时设置 `BLUEPET_TEST_CHAT=1`。
- 改动画、拖拽、焦点、可见性或窗口移动必须补对应桌面验证；测实际原生窗口位移，不用 CSS 帧数冒充窗口流畅度。图形会话阻塞或跳过项要如实说明。
- 文档/打包改动至少跑单测、语法/差异检查、真实构建与产物检查；构建通过不等于桌面交互或签名公证验收。
- release 默认本地打包、无 Developer ID 签名/公证、禁止自动上传。每次使用独立输出目录，不覆盖旧包；校验清单和 release 说明与包一起交付。
- 版本变更同步 `package.json`、`package-lock.json` 和 README。不要只为文档整理擅自升级功能版本。
- `dist/`、`work/`、`outputs/`、安装包和本机配置不入库。仅按明确授权提交/推送/创建 tag/发布 GitHub Release/npm；这些是不同操作，不互相推定授权。
- 提交前检查 staged diff 和测试，显式暂存本次路径；推送后核对远端 SHA。反馈区分已修改、已测试、已打包、已提交和已发布。
