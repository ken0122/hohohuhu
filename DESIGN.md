---
name: Blue One-Eye Pet
description: 透明桌面上的蓝色单眼小伙伴，先让路，再卖萌。
colors:
  blue: "#4569df"
  blue-dark: "#2949b6"
  ink: "#17234b"
  muted: "#67749a"
  paper: "#fbfcff"
  field: "#edf1ff"
  field-focus: "#f2f5ff"
  placeholder: "#7683a8"
  affection: "#6e89f1"
  night: "rgba(7, 12, 34, .82)"
  hud: "rgba(7, 12, 34, .94)"
  game-button: "rgba(15, 25, 61, .9)"
  game-blue: "#4265db"
  game-label: "#b9c6ef"
  game-hint: "#d9e0f8"
  game-button-text: "#d9e0f8"
  pellet: "#fff0a6"
  power-pellet: "#ffda67"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif'
    fontSize: "15px"
    lineHeight: 1.48
    letterSpacing: "-.01em"
  status:
    fontSize: "12px"
    fontWeight: 700
  hint:
    fontSize: "13px"
  score:
    fontSize: "23px"
  level:
    fontSize: "12px"
rounded:
  bubble: "22px"
  field: "13px"
  dismiss: "7px"
  game-button: "10px"
spacing:
  control-gap: "8px"
  form-top: "12px"
  hud-gap: "20px"
components:
  speech:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bubble}"
    padding: "18px 18px 14px"
  chat-input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "42px"
  send-button:
    backgroundColor: "{colors.blue}"
    textColor: "white"
    rounded: "{rounded.field}"
    size: "42px"
  send-button-hover:
    backgroundColor: "{colors.blue-dark}"
  dismiss-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.dismiss}"
    padding: "5px 7px"
  game-exit:
    backgroundColor: "{colors.game-button}"
    textColor: "{colors.game-button-text}"
    rounded: "{rounded.game-button}"
    padding: "0 12px"
    height: "34px"
  game-exit-hover:
    backgroundColor: "{colors.game-blue}"
---

# Design System: Blue One-Eye Pet

本文对照 **0.4.1** 源码维护当前视觉与交互约束，不代表本轮已完成所有桌面验收。尺寸以 `src/core.js`、`src/main.js`、`src/renderer/game-state.js` 和对应 CSS 为准；使用与发布说明见 `README.md`。`PRODUCT.md` 是早期构想，不作为当前功能清单。

## Overview

**Creative North Star: "透明桌面活物"**

角色先于界面：蓝色双角单眼宠物直接站在用户桌面上，没有卡片外壳。奶白气泡只在被呼唤时展开；游戏用墨蓝夜幕暂时覆盖桌面。温柔、轻巧、能及时让路，是这套视觉语言的核心。

**Key Characteristics:**

- 蓝色角色是持续可见的品牌主体。
- 常态透明；只有聊天与游戏提供有边界的交互面。
- 系统字体、短句和克制的状态提示。
- 亲昵通过姿态、眨眼和小爱心表达。

## Colors

### Primary

品牌蓝用于发送、状态提示和交互强调；深蓝用于发送按钮悬停。角色内部蓝色渐变由 `assets/blue-one-eye-mascot.svg` 原样管理，不用按钮色重新绘制角色。爱心用更轻的蓝色。

### Secondary

奶黄用于豆豆与游戏分数；较暖的金黄区分大豆豆。

### Neutral

奶白承载聊天，墨蓝承载文字。浅蓝输入底色与内描边区分焦点。游戏遮罩与顶部计分条采用不同透明度的墨蓝，提示文字使用低层级浅蓝。

## Typography

全局使用系统字体栈，不加载外部字体。回复正文是紧凑但可读的 body 层级，状态标签更小且加粗；游戏用独立的分数和过关字号。计分数字使用等宽数字特性 `tabular-nums`。关闭气泡的 Esc 标签为 11px。

## Layout

桌面宠物采用绝对定位而非网页栅格：普通窗口为 **132×132px**，角色图像盒为 **84×84px**，水平居中、底部留 7px。聊天窗口为 **368×300px**，气泡左右留 12px、顶部留 10px，尾尖指向下方角色；靠屏幕边缘时由主进程按显示器工作区约束窗口位置。原生窗口坐标与 CSS 尺寸使用逻辑像素，不等同于 Retina 截图的物理像素。

游戏窗口覆盖光标所在显示器的完整边界，画布铺满窗口。顶部 HUD 横跨窗口、高 **96px**，以 `12px 28px` 内边距排列分数、轮次、速度倍率、方向键提示和退出按钮；过关短句位于 HUD 内，不覆盖游玩区域。宽度不超过 600px 时，HUD 缩小间距并将右侧操作纵向排列；这只是窄窗口适配，不代表支持手机。

## Elevation & Depth

宠物脚下用低透明度模糊椭圆暗示落地。聊天气泡采用双层柔和阴影，发送按钮采用较短蓝色阴影；HUD 以深色半透明背景与游戏区区分，不使用悬浮卡片阴影。豆豆的发光属于游戏反馈，不扩散成通用界面装饰。精确值见 `src/renderer/pet.css` 与 `src/renderer/game.js`，仓库没有独立 sidecar。

## Shapes

角色保持双角、单眼、柔软下摆的 SVG 轮廓。聊天气泡是大圆角加旋转方形尾尖；输入与发送按钮共享圆角和高度。HUD 为直角通栏，退出按钮使用 10px 圆角。无额外卡片、侧栏或常驻控制面板。

## Components

### Desktop Pet

原始 `assets/blue-one-eye-mascot.svg` 保持不变；其内嵌样式受页面 CSP 限制，运行时动画由外部 CSS 与 Web Animations API 控制，不依赖原 SVG 的循环动画。行走与奔跑只形变原身体路径的下摆，不添加腿或身体层；周期分别为 680ms 与 220ms，静止后取消形变并恢复原路径。原生窗口移动由 renderer 的 `requestAnimationFrame` 触发，主进程按时间积分并约束位置，不用 CSS 动画代替窗口位移。

眼睛默认完全睁开，每隔 3.8–7.2 秒眨眼约 180ms；亲昵眼部反应约 280ms 后恢复睁开。Pet 接近或 hover 时上移、微转并轻微压缩，三颗蓝色爱心错峰飘起；无互动、无移动且光标不靠近时，间隔 12–22 秒偶尔张望或伸展。摸头、挠痒、戳肚子、贴贴和长按抱抱有独立短反馈。

Dodge 点击穿透且持续可见，快速逼近触发带冷却与衰减的弹射；Pet 支持拖拽与方向键。Pet / Dodge 切换保留惯性，回到上次 Pet 停留位置时减速。拖拽阈值为 6px、长按约 650ms，拖拽不得兼触点击或抱抱；聊天、手动隐藏与模式切换需结束当前拖拽。

系统「减少动态效果」关闭自动眨眼、身体路径形变、稀疏自主动作与 Dodge 弹射，保留普通避让和用户控制移动；CSS 互动动画停用或显著缩短。手动隐藏独立于模式，不能因打开菜单、循环快捷键或自动恢复而自行现身。

### Speech Bubble

从角色头顶向上展开，底部为变换原点。状态标签、短回复和单行输入依次排列；回复区使用礼貌的实时播报。关闭时气泡设置 `inert` 与 `aria-hidden`，不能留在键盘焦点序列中。等待状态追加短条动画并禁用输入和发送按钮，回复和错误都留在同一气泡中。当前 renderer 对请求失败显示统一错误提示，不区分鉴权、限流与超时。

聊天只在用户提交后由主进程请求固定的 `deepseek-v4-flash`；不启动 Claude CLI，不向 renderer 暴露凭据，也不持久化对话。输入上限 500 个 UTF-16 代码单元，回复最多 50 个可见字符；交互设计不得假设连续多轮上下文或工具调用。

### Input & Buttons

输入聚焦时浅化背景并显示品牌蓝内描边。发送使用纸飞机图标，hover 加深、键盘聚焦显示外轮廓；禁用时降低不透明度。Esc 是气泡右上方的轻量关闭按钮。游戏退出按钮保留清楚的文字动作与焦点轮廓。

### Game Canvas & HUD

同一角色以 **64px** DOM / SVG 盒叠加在 canvas 上，运行时移除眼皮节点；canvas 绘制圆豆豆，普通与大颗分别计 1 分与 5 分，吃到时角色短促放大。初始速度 280px/s，每清完一屏乘 **1.3**，重新开局重置。方向键改变持续移动方向，左右穿屏，上下在 HUD 下方的游玩区域反弹。

HUD 不承担模式导航。过关提示在 HUD 内淡入淡出，持续 2.4 秒；减少动态效果时改为静态可见。豆豆呼吸在游戏加载时读取减少动态效果偏好；若设置在开局后变化，该项当前需要重开游戏才更新。游戏移动与吃豆缩放反馈仍保留，不宣称整个游戏完全静态。跨屏缩小后的豆豆重排属于待修复边界，详见 README 的已知限制。

## Do's and Don'ts

### Do:

- Do 保留透明桌面与原角色轮廓，让交互面按需出现。
- Do 用系统字体、短句和清晰焦点反馈完成轻量交互。
- Do 将蓝色用于角色和动作，将奶黄保留给游戏食物与分数。

### Don't:

- Don't 把宠物包进常驻卡片、工具栏或应用窗口外壳。
- Don't 将 SVG 角色内部渐变替换成通用按钮配色。
- Don't 添加未实现的导航、卡片库、手机断点或状态能力。
