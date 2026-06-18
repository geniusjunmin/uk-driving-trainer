# Frontend Tasks

This file tracks the backlog and execution status of the Frontend Agent.

---

## 任务列表

### [FE-001] 构建 Three.js 基础渲染循环与场景
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [ARC-001]
* **输入**: `PROJECT_DEVELOPMENT_PLAN.md`。
* **输出**: 
  * 创建 `src/core/CameraManager.ts`。
  * 编写 `src/main.ts` 实现 WebGLRenderer 的基础场景搭建。
* **验收标准**:
  * 渲染循环使用 `renderer.setAnimationLoop` 执行。
  * 页面上显示 3D 渲染画布，包含基础的光源（环境光、平行光并开启阴影）、网格地面与天空背景色。
  * 支持基本的轨道相机控制（仅用于调试）。
* **执行步骤**:
  1. 初始化 Three.js 渲染器、场景和相机管理器。
  2. 实现屏幕大小自适应（Resize 事件处理）。
  3. 创建基础网格及坐标辅助器以供调试。
* **完成后需要修改的文件**:
  * `src/main.ts`
  * `src/core/CameraManager.ts`
* **完成后需要记录的日志**:
  * "FE-001: 实现了基于 setAnimationLoop 的 Three.js 基础渲染场景及相机管理器。"

---

### [FE-002] 实现第一人称右舵驾驶舱相机与三面后视镜渲染
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [FE-001]
* **输入**: `需求.txt` 中“玩家视角设计”及“后视镜”要求。
* **输出**:
  * 创建 `src/vehicle/CockpitView.ts`。
* **验收标准**:
  * 实现 3 个镜子（中镜、左侧镜、右侧镜）的动态贴图渲染。
  * 三镜的画面必须镜像反射（使用独立的反向相机渲染至 `WebGLRenderTarget`，或使用镜面 Shader）。
  * 玩家可以通过键盘/鼠标进行轻微转头（改变相机 Yaw/Pitch），并且系统可以记录玩家是否把视线对准了左右后视镜。
* **执行步骤**:
  1. 在第一人称相机前方布置三个小平面，作为后视镜屏幕。
  2. 分别设置三个反向相机，并配置 RenderTarget 用于实时捕捉车后画面。
  3. 将 RenderTarget 的纹理赋予后视镜平面材质。
  4. 实现鼠标控制第一人称视角的视线偏移，并在转头度数到达阈值时，触发“观察动作”记录。
* **完成后需要修改的文件**:
  * `src/vehicle/CockpitView.ts`
* **完成后需要记录的日志**:
  * "FE-002: 成功实现了右舵驾驶舱的后视镜渲染和转头视线监测逻辑。"

---

### [FE-003] 制作 HUD 仪表盘与中英双语提示 Overlay
* **任务状态**: DONE
* **2026-06-18 Frontend Agent update**: DONE - added structured `updateHUD(state)` API while preserving the existing `update(...)` compatibility path; verified `npm run build` and `npm run test`.
* **优先级**: MEDIUM
* **依赖关系**: [FE-001]
* **输入**: `需求.txt`、UI/UX 规范及 `src/ui/variables.css`。
* **输出**:
  * 创建 `src/ui/HUD.ts`。
  * 仅在 UI/UX 已交付的 `src/ui/hud.css` 中追加数据绑定所需的状态类，不重写视觉 Token 或整体布局。
* **验收标准**:
  * HUD 包含：速度值（大字，带 mph 单位）、挡位指示 (P-R-N-D)、转向灯闪烁指示器（带声音 tick-tock）、双语教练对话框。
  * 页面采用全响应式，文字和仪表盘悬浮在 3D 画布上方，且有圆角和毛玻璃微发光效果。
* **执行步骤**:
  1. 创建 HTML 浮层结构，将 UI 组件按合理边距摆放。
  2. 编写 CSS 样式，引入设计 Token（Outfits 字体、玻璃质感）。
  3. 提供 `updateHUD(speed, gear, indicator, message)` API，方便主循环刷新数据。
  4. 加入转向灯闪烁音效的触发接口。
* **完成后需要修改的文件**:
  * `src/ui/HUD.ts`
  * `src/ui/hud.css`（仅限状态类和动态绑定钩子）
* **完成后需要记录的日志**:
  * "FE-003: 完成了 HUD 双语提示面板及 mph 仪表盘 UI 的开发与集成。"
