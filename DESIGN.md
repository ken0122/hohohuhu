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
  hud: "rgba(15, 25, 61, .9)"
  game-blue: "#4265db"
  game-blue-hover: "#5878e9"
  game-label: "#b9c6ef"
  game-hint: "#d9e0f8"
  game-button-text: "#f6f8ff"
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
    fontSize: "34px"
    fontWeight: 750
    letterSpacing: "-.03em"
rounded:
  bubble: "22px"
  field: "13px"
  dismiss: "7px"
  hud: "14px"
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
    backgroundColor: "{colors.game-blue}"
    textColor: "{colors.game-button-text}"
    rounded: "{rounded.game-button}"
    padding: "0 13px"
    height: "34px"
---

# Design System: Blue One-Eye Pet

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

桌面宠物采用绝对定位而非网页栅格：普通窗口为 118×118px，角色图像盒为 96×96px、底部留 7px。聊天窗口为 368×282px，气泡左右留 12px、顶部留 10px，尾尖指向下方角色；靠屏幕边缘时由主进程约束窗口位置。

游戏画布铺满屏幕；顶部计分条水平居中、距顶 22px，包含分数、方向键提示和退出按钮。过关短句居中。当前实现面向桌面，没有手机断点或响应式导航。

## Elevation & Depth

宠物脚下用低透明度模糊椭圆暗示落地。聊天气泡采用双层柔和阴影，发送按钮采用较短蓝色阴影；计分条采用深色阴影。豆豆的发光属于游戏反馈，不扩散成通用界面装饰。精确阴影值见 sidecar。

## Shapes

角色保持双角、单眼、柔软下摆的 SVG 轮廓。聊天气泡是大圆角加旋转方形尾尖；输入与发送按钮共享圆角和高度。计分条与退出按钮采用稍紧的圆角。无额外卡片、侧栏或常驻控制面板。

## Components

### Desktop Pet

默认使用原 SVG 的轻摇、视线与眨眼动画。逃离时小幅左右摆动；Pet 接近或 hover 时上移、微转并轻微压缩，三颗蓝色爱心错峰飘起。系统减少动态效果设置会停用 SVG 动画并缩短 CSS 状态动画。

### Speech Bubble

从角色头顶向上展开，底部为变换原点。状态标签、短回复和单行输入依次排列；回复区使用礼貌的实时播报。等待状态追加短条动画，回复和错误都留在同一气泡中。

### Input & Buttons

输入聚焦时浅化背景并显示品牌蓝内描边。发送使用纸飞机图标，hover 加深、键盘聚焦显示外轮廓；禁用时降低不透明度。Esc 是气泡右上方的轻量关闭按钮。游戏退出按钮保留清楚的文字动作与焦点轮廓。

### Game Canvas & HUD

同一角色以 72px 盒绘制；圆豆豆分普通与大颗两档，吃到时角色短促放大。计分条不承担模式导航。过关提示短暂放大显现后离开；减少动态效果时缩短提示动画，并将豆豆呼吸缩放固定为 1。游戏移动与吃豆反馈仍保留，不宣称整个游戏完全静态。

## Do's and Don'ts

### Do:

- Do 保留透明桌面与原角色轮廓，让交互面按需出现。
- Do 用系统字体、短句和清晰焦点反馈完成轻量交互。
- Do 将蓝色用于角色和动作，将奶黄保留给游戏食物与分数。

### Don't:

- Don't 把宠物包进常驻卡片、工具栏或应用窗口外壳。
- Don't 将 SVG 角色内部渐变替换成通用按钮配色。
- Don't 添加未实现的导航、卡片库、手机断点或状态能力。
