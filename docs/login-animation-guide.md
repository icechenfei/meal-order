# GSAP 动画登录页 — 设计文档

> 最后更新：2026-06-20
> 效果地址：https://icechenfei.github.io/meal-order/login.html

---

## 一、整体布局

```
┌─────────────────────┬──────────────────────────┐
│                     │                          │
│   左侧插画区 (45%)   │     右侧登录区 (55%)      │
│   橙色渐变背景        │     浅暖色渐变背景         │
│                     │                          │
│   ┌──────────┐      │     ┌──────────────┐      │
│   │ 🍽️ LOGO  │      │     │  WELCOME     │      │
│   │          │      │     │  今天吃什么    │      │
│   │  🟠 🟠   │      │     │              │      │
│   │  🟠 🟡   │      │     │  邮箱 [____] │      │
│   │  🟣 🟡   │      │     │  密码 [____] │      │
│   │  🟣 ⚫   │      │     │  [ 登  录 ]  │      │
│   └──────────┘      │     └──────────────┘      │
│                     │                          │
└─────────────────────┴──────────────────────────┘
```

- **PC 端**：左右并排，左 45% + 右 55%
- **移动端**（≤768px）：上下堆叠，左侧高度 220px，右侧自适应

---

## 二、依赖

| 库 | 用途 | 部署方式 |
|---|---|---|
| GSAP 3.12.5 | 所有动画 | **本地 `js/gsap.min.js`**（不依赖外部 CDN） |
| Supabase JS | 登录认证 | CDN |

> ⚠️ GSAP 必须本地部署，国内 CDN 不稳定会导致动画失效。

---

## 三、4 个食物小人

纯 CSS 实现，无图片。每个小人是一个 `div` + `border-radius` 圆顶 + 两个 `eye` 子元素。

### 3.1 汤圆（左侧，白色胖圆）

```css
.tangyuan {
  width: 120px; height: 100px;
  background: #fff5eb;
  border-radius: 60px 60px 0 0;   /* 半圆顶 */
  bottom: 0; left: 10px;
}
```
- 眼球：`background: #333`，黑色
- 有嘴巴：`border-bottom: 3px solid #333` 弧线

### 3.2 饺子（中左，橙色尖顶）

```css
.jiaozi {
  width: 100px; height: 110px;
  background: #ff9966;
  border-radius: 50px 50px 10px 10px;
  bottom: 0; left: 110px;
}
/* 尖顶用 ::before 伪元素 */
.jiaozi::before {
  top: -18px; left: 25px;
  width: 50px; height: 30px;
  background: #ff9966;
  border-radius: 50% 50% 0 0;
}
```

### 3.3 面条（中右，紫色细高）

```css
.noodle {
  width: 60px; height: 160px;
  background: #7b42e0;
  border-radius: 30px 30px 0 0;
  bottom: 0; left: 190px;
}
```
- 眼球：`background: #fff`，白色（在深色背景上）

### 3.4 煎蛋（右侧，黄色矮胖 + 白色蛋黄）

```css
.egg {
  width: 100px; height: 80px;
  background: #f9d332;
  border-radius: 50px 50px 0 0;
  bottom: 0; left: 240px;
}
/* 蛋黄用 ::before 伪元素 */
.egg::before {
  top: 15px; left: 28px;
  width: 36px; height: 36px;
  background: #fff;
  border-radius: 50%;
}
```

### 3.5 关键结构

```html
<div class="cartoon-wrap" id="cartoonWrap">
  <div class="cart-item tangyuan">
    <div class="eye eye1"></div>
    <div class="eye eye2"></div>
    <div class="mouth"></div>
  </div>
  <div class="cart-item jiaozi">...</div>
  <div class="cart-item noodle">...</div>
  <div class="cart-item egg">...</div>
</div>
```

- `.cartoon-wrap`：`position: relative`，包含所有小人
- `.cart-item`：`position: absolute`，在 wrap 内自由定位
- `.eye`：`8px × 8px` 圆点，`position: absolute`，`transform-origin: center`

---

## 四、GSAP 动画详解

### 4.1 入场动画

```js
// 小人从下方弹性弹入
gsap.from(cartoonWrap, {
  opacity: 0, y: 40,
  duration: 1,
  ease: 'elastic.out(1, 0.5)'
});
// 登录卡片淡入
gsap.from(loginCard, {
  opacity: 0, y: 30,
  delay: 0.2, duration: 0.8,
  ease: 'power2.out'
});
```

### 4.2 持续悬浮

```js
// 所有小人交替上下浮动，错开 0.4s
gsap.to(allCart, {
  y: -8,
  repeat: -1, yoyo: true,
  duration: 3.5, stagger: 0.4,
  ease: 'sine.inOut'
});
```

### 4.3 眼球跟随鼠标（PC）+ 默认方向（移动端）

```js
const rotateEye = gsap.quickTo(allEyes, "rotation", {
  duration: 0.3, ease: "power2.out"
});

// 默认眼球看向右侧（表单方向），角度 30°
rotateEye(30);

// PC 端鼠标移动时实时跟随
document.addEventListener('mousemove', e => {
  const x = e.clientX - window.innerWidth / 2;
  const rad = Math.atan2(e.clientY - window.innerHeight / 2, x);
  const deg = rad * (180 / Math.PI);
  rotateEye(deg);
});
```

> `gsap.quickTo` 是高性能方法，内部做插值平滑，不会每帧都写 DOM。

### 4.4 邮箱聚焦：小人探头看

```js
// focus + touchstart 双保险（移动端 focus 可能不触发）
function emailFocus() {
  gsap.killTweensOf(cartoonWrap);
  gsap.to(cartoonWrap, {
    y: -18,           // 往上探
    scale: 1.06,      // 微微放大
    rotate: 12,       // 向右转头看表单
    duration: 0.5,
    ease: 'power2.out'
  });
}
function emailBlur() {
  gsap.killTweensOf(cartoonWrap);
  gsap.to(cartoonWrap, {
    y: 0, scale: 1,
    rotate: 8,        // 恢复默认偏转角度
    duration: 0.4,
    ease: 'power2.inOut'
  });
}
emailInput.addEventListener('focus', emailFocus);
emailInput.addEventListener('touchstart', emailFocus);
emailInput.addEventListener('blur', emailBlur);
```

### 4.5 密码聚焦：转头 + 闭眼

**核心要点**：闭眼时必须先 `rotation: 0` 再 `scaleY: 0.1`，否则会变成斜线。

```js
const isMobile = window.innerWidth <= 768;

pwdInput.addEventListener('focus', () => {
  gsap.killTweensOf(cartoonWrap);

  // 闭眼：先归零旋转再压扁
  gsap.to(allEyes, {
    rotation: 0,
    scaleY: 0.1,
    duration: 0.3,
    ease: 'power2.out'
  });

  if (isMobile) {
    // 移动端：上下布局，小人抬头看天
    gsap.to(cartoonWrap, {
      rotate: 12, y: -10, x: 0,
      duration: 0.4, ease: 'power2.out'
    });
  } else {
    // PC端：左右布局，小人向左转头避开
    gsap.to(cartoonWrap, {
      rotate: -14, x: -12, y: -5,
      duration: 0.4, ease: 'power2.out'
    });
  }
});

pwdInput.addEventListener('blur', () => {
  gsap.killTweensOf(cartoonWrap);
  // 睁眼
  gsap.to(allEyes, {
    scaleY: 1,
    duration: 0.2, ease: 'power2.out'
  });
  // 恢复默认姿态
  gsap.to(cartoonWrap, {
    rotate: 8, x: 0, y: 0, scale: 1,
    duration: 0.4, ease: 'power2.inOut'
  });
});
```

### 4.6 登录失败：摇头

```js
function shakeHead() {
  gsap.killTweensOf(cartoonWrap);
  gsap.to(cartoonWrap, {
    x: -12,
    repeat: 4, yoyo: true,
    duration: 0.15,
    onComplete: () => {
      gsap.to(cartoonWrap, { x: 0, duration: 0.3 });
    }
  });
}
```

### 4.7 按钮呼吸光效

```js
gsap.to(loginBtn, {
  filter: 'brightness(1.1)',
  repeat: -1, yoyo: true,
  duration: 2.5,
  ease: 'sine.inOut'
});
```

---

## 五、CSS 背景细节

### 5.1 左侧网格流动背景

```css
@keyframes gridMove {
  0% { background-position: 0 0; }
  100% { background-position: 40px 40px; }
}
.grid-bg {
  background-image:
    linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
  background-size: 40px 40px;
  animation: gridMove 8s linear infinite;
}
```

### 5.2 默认偏转角

```css
.cartoon-wrap {
  transform: rotate(8deg);  /* 默认向右偏，面向表单 */
}
```

移动端：
```css
.cartoon-wrap {
  transform: scale(0.7) rotate(8deg);
}
```

---

## 六、移动端适配要点

| 特性 | PC 端 | 移动端（≤768px） |
|------|-------|-----------------|
| 布局 | 左右并排 | 上下堆叠 |
| 左侧高度 | 自适应 | 固定 220px |
| 小人缩放 | 1 | scale(0.7) |
| 眼球跟随 | mousemove | 不生效（无鼠标） |
| 密码转头方向 | 向左（rotate: -14） | 向右抬头（rotate: 12） |
| 邮箱探头 | touchstart 兜底 | touchstart 兜底 |

---

## 七、踩坑记录

1. **`gsap.from('#leftBox', { width: 0 })` + `overflow: hidden`** → 小人全部被裁剪，不可见
2. **`opacity: 0` 在 CSS 里设，依赖 GSAP 动画改为 1** → GSAP 加载失败时左侧全白
3. **闭眼只设 `scaleY: 0.1` 不清 `rotation`** → 眼球变成斜线而非水平闭眼线
4. **jsdelivr / bootcdn CDN** → 国内移动端可能加载失败，必须本地部署 GSAP
5. **移动端 focus 事件** → 不一定触发，需加 `touchstart` 兜底

---

## 八、文件结构

```
meal-order/
├── login.html          ← 登录页（含所有 CSS + JS）
├── js/
│   └── gsap.min.js     ← GSAP 3.12.5 本地库
├── css/
│   └── style.css       ← 全局样式（登录页未使用）
└── ...
```

---

## 九、复现步骤

1. 下载 GSAP 3.12.5：`https://cdn.bootcdn.net/ajax/libs/gsap/3.12.5/gsap.min.js`
2. 放到 `js/gsap.min.js`
3. 按本文档创建 `login.html`
4. 替换 Supabase URL 和 Key
5. 部署到任意静态服务器

> 不需要任何构建工具，纯 HTML + CSS + JS，开箱即用。
