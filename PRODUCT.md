# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

需要在桌面工作时获得轻量陪伴、短暂放松，又不希望宠物遮挡正常点击的 macOS 用户。

## Product Purpose

Blue One-Eye Pet 是常驻后台的桌面宠物。默认会在桌面自由移动并主动避开光标；也能固定陪伴、进行轻量互动，或临时变成全屏吃豆小游戏。成功意味着它有生命感、随时可玩，又不妨碍工作。

## Positioning

它不是一个固定悬浮按钮：宠物的行为会随工作情境切换——主动让路、留在身边、占据屏幕玩一局——并直接借用用户现有 Claude Code provider 完成简短聊天。

## Operating Context

- 通过命令行安装和启动。
- 启动后常驻系统托盘，关闭交互面不退出后台进程。
- 在桌面工作期间使用 Dodge 或 Pet，需要短暂放松时进入 Pac-Man。
- 聊天通过全局快捷键呼出，输入和回复都出现在宠物头顶的气泡中。

## Capabilities and Constraints

- Dodge 是默认模式，窗口点击穿透，宠物自由移动并躲避光标。
- Pet 固定在屏幕区域，支持 hover 和亲昵反馈。
- Pac-Man 使用屏幕遮罩、随机豆豆和方向键控制。
- 支持低冲突的全局隐藏与聊天快捷键；默认值可通过环境变量修改。
- 聊天由本机 `claude -p` 处理，沿用 Claude Code 当前 provider，不复制或存储 provider 密钥。
- 每条宠物回复最多 50 个 Unicode 字符。
- MIT 开源。

## Brand Commitments

- 复用蓝色、双角、单眼的品牌角色形象。
- 角色要乖巧、亲昵、撒娇、扭捏，但不幼稚聒噪。
- 角色资产：`assets/blue-one-eye-mascot.svg`，基于提供的蓝色单眼角色参考制作。

## Evidence on Hand

已有可直接复用的 64×64 SVG 品牌角色动画；没有需要伪造的客户、价格或效果声明。

## Product Principles

- 先让路，再卖萌。
- 一键消失，恢复时回到原状态。
- 互动短、轻、可随时退出。
- 不读取、不复制、不暴露本机模型凭据。
- 动画体现性格，不制造持续视觉噪声。

## Accessibility & Inclusion

尊重系统减少动态效果设置；游戏和核心操作均可通过键盘完成；聊天输入具有清晰焦点与状态反馈。
