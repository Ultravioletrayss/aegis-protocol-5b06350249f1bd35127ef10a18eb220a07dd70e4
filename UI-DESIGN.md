这份 Markdown 文件为你详细定义了 **Aegis Protocol** 的 UI 设计规范。它结合了彭博终端的专业性、液态玻璃的质感以及高斯模糊的层级感。你可以将此文件内容直接作为前端开发的 UI 指导手册或项目的 UI 设计说明文档。

---

# Aegis Protocol UI 设计规范 (v1.0)

## 1. 核心设计哲学

* **专业主义 (Professionalism)**: 继承彭博终端的高信息密度，无留白网格布局。
* **空间深度 (Spatial Depth)**: 利用高斯模糊区分任务层级，模拟液态玻璃折射。
* **动态感知 (Luminous Logic)**: 流光效果仅用于表达 AI 意图的流动与执行状态，拒绝无意义的装饰。

---

## 2. 色彩系统 (Color Palette)

| 用途 | 颜色变量 (Tailwind / Hex) | 视觉效果 |
| --- | --- | --- |
| **底色 (Background)** | `bg-[#050505]` | 深邃黑，微暖调，消除廉价感 |
| **主卡片 (Surface)** | `bg-white/5` + `backdrop-blur-xl` | 液态玻璃质感，吸收背景色 |
| **文字-首要 (Primary)** | `text-zinc-100` | 高亮白，用于关键指标 |
| **文字-次要 (Secondary)** | `text-zinc-400` | 灰调，用于标签和次要描述 |
| **状态-成功 (Success)** | `text-emerald-400` / `shadow-emerald-500/20` | 用于 Gas 节省、执行成功流光 |
| **状态-处理 (Pending)** | `text-amber-400` / `shadow-amber-500/20` | 用于意图排队、批处理中流光 |
| **状态-警告 (Danger)** | `text-rose-500` | 用于高 Gas 警示、执行失败 |

---

## 3. 字体与排版 (Typography)

* **等宽字体 (Monospace)**: 全局强制使用 `font-mono` (推荐: *JetBrains Mono*, *Roboto Mono*)。
* **字号层级**:
* `text-2xl tracking-tighter`: 用于大屏数据指标 (如 Total Gas Saved)。
* `text-xs uppercase`: 用于模块标题，增加金融终端的严肃感。
* `leading-tight`: 紧凑行高，适应高信息密度。



---

## 4. 关键组件实现 (Tailwind CSS 代码参考)

### A. 液态流光玻璃卡片 (Liquid Luminous Card)

```html
<div class="relative overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-2xl p-4 transition-all duration-500 hover:border-emerald-500/30">
  <div class="absolute -inset-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
  
  <h3 class="text-xs font-mono text-zinc-500 uppercase mb-2">Intent Queue</h3>
  <div class="text-xl font-mono text-zinc-100">128 Intents</div>
</div>

```

### B. 被遮挡的高斯模糊遮罩 (Occlusion Blur)

```html
<div class="filter blur-md saturate-150 transition-all duration-700">
  </div>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
  <div class="w-full max-w-2xl rounded-2xl border border-white/20 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-3xl">
    </div>
</div>

```

---

## 5. UI 模块布局 (The Dashboard)

### 第一屏：实时执行监控 (Real-time Monitor)

1. **左侧 (30%) - AI Intent Terminal**:
* 风格：黑底绿字等宽流。
* 动态：DeepSeek 每输出一个意图，该区域边缘闪烁一次液态白光。


2. **中间 (40%) - Batching Engine**:
* 视觉：展示意图进入“液态桶”进行聚合的过程。
* 效果：意图卡片堆叠时带有 `saturate-200` 的视觉增强。


3. **右侧 (30%) - Performance Metrics**:
* 视觉：ECharts 渲染的实时对比折线图。
* 交互：点击“传统模式”切换，全屏进入高斯模糊，仅保留对比数据。



---

## 6. 交互动效 (Interaction Design)

* **进入动画**: 模块加载时使用 `opacity-0` 配合 `translate-y-4` 的平滑升起。
* **流光触发**: 当合约事件 `BatchExecuted` 触发时，对应卡片边框执行一次 `linear-gradient` 滚动动画。
* **液态反馈**: 按钮悬停时，背景模糊度从 `blur-xl` 缓慢过渡到 `blur-3xl`，模拟压力感。

---

## 7. Git 规范提醒

* `feat(ui): implement liquid glass card component`
* `feat(ui): add backdrop-blur occlusion for modals`
* `style(ui): adjust bloomberg terminal font-spacing`