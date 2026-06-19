# Project Status: UK Right-Hand Drive Trainer

本文件记录项目的全局开发进度、健康状态与里程碑阶段。

---

## 1. 全局进度摘要

* **当前阶段**: Stage 7 - MVP 已部署并完成上线验证
* **整体进度**: 100%
* **项目健康度**: Green
* **最后更新时间**: 2026-06-19
* **生产地址**: `https://geniusjunmin.github.io/uk-driving-trainer/`

---

## 2. 里程碑状态

| 里程碑 | 目标描述 | 计划完成时间 | 状态 | 责任人 |
| :--- | :--- | :--- | :--- | :--- |
| M0: 初始化 | 梳理开发计划、初始化 agent 设定、任务书及状态跟踪模板。 | 2026-06-17 | DONE | Coordinator |
| M1: 基础底盘与视觉 | 物理车辆受力移动、右舵驾驶舱及三面后视镜渲染完成。 | 2026-06-18 | DONE | Tech Lead / Frontend / Backend |
| M2: 道路与限速检测 | 道路路网 RoadGraph 加载、车道逆行/压线检测、限速超速扣分完成。 | 2026-06-18 | DONE | Tech Lead / Backend / QA |
| M3: 环岛与路口判定 | T 字路口、Give Way、环岛规则检测、NPC 车流交互实现。 | 2026-06-18 | DONE | PM / Frontend / Backend |
| M4: 评分与双语教练 | 扣分提示 HUD、结算结果面板与双语教练系统闭环。 | 2026-06-18 | DONE | PM / UI/UX / Frontend |
| M5: MVP 关卡交付 | Tesco 风格停车场、斑马线行人 AI、单关卡打包上线。 | 2026-06-18 | DONE | DevOps / Security / QA |
| PMV: 上线硬化 | 浏览器 smoke、Docker CI 健康检查、GitHub Pages 部署和生产 smoke。 | 2026-06-19 | DONE | DevOps / QA |

---

## 3. 核心统计数据

* **Agent 活跃数**: 10 / 10 已配置
* **总任务数**: 30
* **未启动 (TODO)**: 0
* **开发中 (IN_PROGRESS)**: 0
* **待评审 (NEED_REVIEW)**: 0
* **已完成 (DONE)**: 30
* **阻塞中 (BLOCKED)**: 0

---

## 4. 最新验证证据

* `npm.cmd run verify:deploy`: passed on 2026-06-19.
* Current local gate coverage: 17 test files / 100 tests.
* GitHub Actions run `27816609843`, attempt 2: `Build and test`, `Build Docker image`, and `Deploy GitHub Pages` all passed.
* Production URL returned HTTP 200.
* Remote production smoke passed with `SMOKE_BASE_URL=https://geniusjunmin.github.io/uk-driving-trainer`; screenshot size was 70102 bytes.

---

## 5. PMV-006 审查结论

* PMV-006 is complete.
* `src/main.ts` remains the production entry scene.
* `src/scene/TownScene.ts` is not adopted because it overlaps with the current playable route without the same rule/physics wiring.
* `src/ui/LevelSelectUI.ts` remains future menu work and should be connected only after multiple playable levels exist.
