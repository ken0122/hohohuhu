---
name: 呼噜呼噜
description: 透明桌面上的蓝色单眼小伙伴，先让路，再卖萌。
colors:
  settings-muted: "#52618a"
  settings-border: "#c4cee9"
  settings-error: "#a12635"
  blue: "#4569df"
  blue-dark: "#2949b6"
  ink: "#17234b"
  muted: "#67749a"
  ground: "rgba(25, 43, 98, .18)"
  affection-shadow: "rgba(37, 64, 155, .24)"
  speech-shadow: "rgba(22, 39, 91, .16)"
  paper: "#fbfcff"
  field: "#edf1ff"
  field-focus: "#f2f5ff"
  placeholder: "#626f94"
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
  settings-title:
    fontSize: "22px"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif'
    fontSize: "13px"
    lineHeight: "18px"
    letterSpacing: "normal"
  small:
    fontSize: "11px"
  status:
    fontSize: "11px"
    fontWeight: 500
  hint:
    fontSize: "13px"
  score:
    fontSize: "23px"
  level:
    fontSize: "12px"
rounded:
  bubble: "20px 20px 24px 24px"
  bubble-bottom: "24px"
  pet-focus: "14px"
  field: "12px"
  dismiss: "7px"
  game-button: "10px"
spacing:
  control-gap: "6px"
  form-top: "8px"
  hud-gap: "20px"
components:
  speech:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bubble}"
    padding: "12px"
  chat-input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 10px"
    height: "32px"
  send-button:
    backgroundColor: "{colors.blue}"
    textColor: "white"
    rounded: "50%"
    size: "32px"
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

# Design System: 呼噜呼噜

本文对照 **0.4.3** 源码维护当前视觉与交互约束，不代表本轮已完成所有桌面验收。尺寸以 `src/core.js`、`src/main.js`、`src/renderer/game-state.js` 和对应 CSS 为准；使用与发布说明见 `README.md`。`PRODUCT.md` 是早期构想，不作为当前功能清单。

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

桌面宠物采用绝对定位而非网页栅格：普通窗口为 **132×132px**，角色图像盒为 **84×84px**，水平居中、底部留 7px。聊天窗口为 **272×242px**，气泡左右留 12px、顶部留 10px，宽 248px、高 140px，无拼接尾尖；靠屏幕边缘时由主进程按显示器工作区约束窗口位置。原生窗口坐标与 CSS 尺寸使用逻辑像素，不等同于 Retina 截图的物理像素。

游戏窗口覆盖光标所在显示器的完整边界，画布铺满窗口。顶部 HUD 横跨窗口、高 **96px**，以 `12px 28px` 内边距排列分数、轮次、速度倍率、方向键提示和退出按钮；过关短句位于 HUD 内，不覆盖游玩区域。宽度不超过 600px 时，HUD 缩小间距并将右侧操作纵向排列；这只是窄窗口适配，不代表支持手机。

## Elevation & Depth

宠物脚下用低透明度模糊椭圆暗示落地。聊天气泡采用单层轻阴影，发送按钮不加投影；HUD 以深色半透明背景与游戏区区分，不使用悬浮卡片阴影。豆豆的发光属于游戏反馈，不扩散成通用界面装饰。精确值见 `src/renderer/pet.css` 与 `src/renderer/game.js`，不以旧 sidecar 作为当前视觉依据。

## Shapes

角色保持双角、单眼、柔软下摆的 SVG 轮廓。聊天气泡使用柔软的不对称圆角，无尾尖和遮挡输入的伪元素；输入为 12px 圆角，发送为圆形，均高 32px。HUD 为直角通栏，退出按钮使用 10px 圆角。无额外卡片、侧栏或常驻控制面板。

## Components

### Desktop Pet

角色实现分成静态形象、应用内置绑定和通用动作控制。`src/characters.js` 管理原角色的眼睛锚点、部件选择器与下摆形变参数；renderer 的 `character.js` 在运行时副本上标注部件，`character-motion.js` 驱动动作。互动状态同时映射到角色自身，不借用其他角色的 DOM 或全局 CSS 反应；替换前先完成新绑定，失败时保留旧角色，成功时销毁旧控制器的计时器、动画和监听器。

无眼睛的基础 SVG 绑定只提供整体变换，不自动添加眼睛、腿或身体层。原角色继续使用原路径形变，不能因通用动作而改变其轮廓和步态。角色库支持本机单色图片导入与确认切换，以下视觉约束仍以默认蓝色角色为准。

黑猫是首个转换样本：两只白眼、双耳、完整身体与右侧弯尾来自原图。单色转换生成独立静态 SVG，去除白底和浅灰阴影，归一到 64×64 viewBox；最长边约 56 单位、底部约 4 单位留白。`BLACK_CAT` 使用基础整体动作，并在可信运行时绑定中叠加两枚可转动瞳孔；不改写转换后的静态 SVG，也不添加眼皮或尾部骨骼。独立开发预览继续保留，角色库另提供正式操作入口；切换不改变聊天人设和菜单栏图标。

原始 `assets/blue-one-eye-mascot.svg` 保持不变；其内嵌样式受页面 CSP 限制，运行时动画由外部 CSS 与 Web Animations API 控制，不依赖原 SVG 的循环动画。行走与奔跑只形变原身体路径的下摆，不添加腿或身体层；周期分别为 680ms 与 220ms，静止后取消形变并恢复原路径。原生窗口移动由 renderer 的 `requestAnimationFrame` 触发，主进程按时间积分并约束位置，不用 CSS 动画代替窗口位移。

眼睛默认完全睁开，每隔 3.8–7.2 秒眨眼约 180ms；亲昵眼部反应约 280ms 后恢复睁开。Pet 接近或 hover 时上移、微转并轻微压缩；默认角色以三颗蓝色爱心错峰飘起，角色绑定可为同一抚摸反馈提供自己的符号、颜色与阴影，黑猫使用暖金色的星光与爱心。无互动、无移动且光标不靠近时，间隔 12–22 秒偶尔张望或伸展。摸头、挠痒、戳肚子、贴贴和长按抱抱有独立短反馈。

Dodge 的黑色眼珠始终朝向光标，以实际窗口中的眼白中心计算方向；视线独立于身体速度，光标视线按帧更新、不叠加 CSS 追赶过渡，闪避跑开、聊天停稳和打开菜单时仍跟随，Pet / Pac-Man 仍按原有交互控制视线。Dodge 点击穿透且持续可见，快速逼近触发带冷却与衰减的弹射；Pet 支持拖拽与方向键。Pet / Dodge 切换保留惯性，回到上次 Pet 停留位置时减速。拖拽阈值为 6px、长按约 650ms，拖拽不得兼触点击或抱抱；聊天、手动隐藏与模式切换需结束当前拖拽。

系统「减少动态效果」关闭自动眨眼、身体路径形变、稀疏自主动作与 Dodge 弹射，保留普通避让和用户控制移动；CSS 互动动画停用或显著缩短。手动隐藏独立于模式，不能因打开菜单、循环快捷键或自动恢复而自行现身。Pet 与 Pac-Man 共用可见性意图和低频意外隐藏恢复检查；watchdog 不抢焦点，也不更改仍有效的游戏窗口尺寸。

隐藏动效以原 SVG 的运行时副本取样，70ms 微膨胀后散为蓝白粒子，总长 420ms，主进程 460ms 兜底。立即释放鼠标命中；恢复、聊天或选模式会取消未完成效果，旧回调不能再隐藏新状态。减少动态效果启动前开启或运行中开启均跳过/结束粒子；游戏一并暂停，恢复保留进度。源 SVG 不变。

菜单栏使用源角色衍生的细轮廓与单眼，黑色透明模板图由 macOS 自动着色；末项「退出呼噜呼噜」是无图标的普通命令，避免系统 quit role 附带图标。

### Character Library

状态栏「角色库…」打开独立原生窗口（820×800px，最小 720×620px），沿用奶白背景、墨蓝文字、系统字体和蓝色主按钮。标题为 22px、角色名为 15px，正文为 13px，辅助文字为 11–12px。左侧本地列表与右侧预览用细分隔线区分；浅蓝预览台承载形象，不增加装饰阴影。窗口高度不超过 680px 时缩短上下留白并将放大预览从 144px 收至 112px；主内容继续滚动，底部说明与操作保持可见。这是一处按需打开的管理窗口，不成为桌面宠物的常驻外壳。

列表区分「内置角色」「本地导入」和「当前」，蓝色描边表示当前预览项；预览区另以文字说明预览与当前角色的关系。点击列表只预览，必须点击「使用这个角色」才切换，已是当前角色时主按钮改为中性的完成状态。右侧同时展示放大形象、桌面 84px 与游戏 64px 实际尺寸；步态控制集中为静止、行走、奔跑，轻跳与暂停 / 恢复作为独立预览操作。预览共用角色动作控制及系统「减少动态效果」设置；支持眼神的角色可随指针转动瞳孔，未绑定部件的形象明确提示不会自动识别可动部件。

导入仅接受白底或透明底的深色单色 PNG/JPG，草稿并排展示原图与生成的 SVG，名称输入上限为 40 个 UTF-16 代码单元。状态提示明确区分转换中、尚未保存、已使用和错误；处理期间禁用重复操作，保留关闭入口。主按钮在草稿状态变为「保存并使用」；换图、关闭或 Esc 遇到未保存草稿时先确认，放弃导入不保存草稿。只有本地导入角色显示低强调度的红色移除操作，并在确认中说明原图不受影响及当前角色的回退行为。所有控件保留键盘焦点轮廓，列表支持上下方向键及 Home / End，状态区礼貌播报结果；切换形象不重开游戏、不清空聊天，也不唤醒手动隐藏的宠物。

### Speech Bubble

从角色头顶向上展开，底部为变换原点。Dodge 聊天只保留光标避让和衰减反射，不自主散步；光标在气泡内时停稳，气泡外点击穿透。聊天原生窗口与物理角色锚点一起移动，并整体约束在显示器工作区内。状态标签、短回复和单行输入依次排列；回复区使用礼貌的实时播报。关闭时气泡设置 `inert` 与 `aria-hidden`，不能留在键盘焦点序列中。等待状态让单眼标记轻轻呼吸并禁用输入和发送按钮，回复和错误都留在同一气泡中。当前 renderer 对请求失败显示统一错误提示，不区分鉴权、限流与超时。

聊天只在用户提交后由主进程请求固定的 `deepseek-v4-flash`；不启动 Claude CLI，不向 renderer 暴露凭据，也不持久化对话。输入上限 500 个 UTF-16 代码单元，回复最多 50 个可见字符；交互设计不得假设连续多轮上下文或工具调用。

### Input & Buttons

输入聚焦时浅化背景并显示品牌蓝内描边。聊天与 API 设置窗口共用原生编辑快捷键处理，支持全选、复制、粘贴、剪切、撤销和重做。发送使用向上箭头图标，hover 加深、键盘聚焦显示外轮廓；禁用时降低不透明度。Esc 是气泡右上方的轻量关闭按钮。游戏退出按钮保留清楚的文字动作与焦点轮廓。

### Game Canvas & HUD

同一角色以 **64px** DOM / SVG 盒叠加在 canvas 上，运行时移除眼皮节点；canvas 绘制圆豆豆，普通与大颗分别计 1 分与 5 分，吃到时角色短促放大。初始速度 280px/s，每清完一屏乘 **1.3**，重新开局重置。方向键改变持续移动方向，左右穿屏，上下在 HUD 下方的游玩区域反弹。

HUD 不承担模式导航。过关提示在 HUD 内淡入淡出，持续 2.4 秒；减少动态效果时改为静态可见。豆豆呼吸在游戏加载时读取减少动态效果偏好；若设置在开局后变化，该项当前需要重开游戏才更新。游戏移动与吃豆缩放反馈仍保留，不宣称整个游戏完全静态。窗口缩放时，剩余豆豆和角色按可玩区域重排，保留分数、倍率、方向；不会把重排路径作为吃豆轨迹。反弹和穿屏保留本帧剩余路程，并仅对真实经过的分段路径检测碰撞。

## Do's and Don'ts

### Do:

- Do 保留透明桌面与原角色轮廓，让交互面按需出现。
- Do 用系统字体、短句和清晰焦点反馈完成轻量交互。
- Do 将蓝色用于角色和动作，将奶黄保留给游戏食物与分数。

### Don't:

- Don't 把宠物包进常驻卡片、工具栏或应用窗口外壳。
- Don't 将 SVG 角色内部渐变替换成通用按钮配色。
- Don't 添加未实现的导航、卡片库、手机断点或状态能力。

### API Settings

状态栏「API 设置…」打开独立 480×510 逻辑像素的原生窗口，复用奶白背景、墨蓝文字、系统字体与蓝色主按钮。不改变宠物模式或手动隐藏状态。页面仅含 Base URL、密码类型的 API Key、状态提示及清除 / 关闭 / 保存操作。已保存密钥不回显，留空保留；保存后清空输入，错误在表单中播报。关闭与 Esc 放弃未保存内容。只支持官方 DeepSeek HTTPS 地址，保存不等于连接验证。
