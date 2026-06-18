# Current Context: UK Right-Hand Drive Trainer

本文件由 Coordinator 实时维护，描述当前开发会话的最细粒度上下文。新 Agent 进场时应以此恢复记忆。

---

## 1. 运行环境与状态

* **Git 状态**: 当前目录不是 Git 仓库，不能使用 `git status` 或 `git diff` 作为核验。
* **本地服务状态**: Vite dev server 已可用，常用地址为 `http://127.0.0.1:5173/`。
* **最新验证**:
  * `npm install` 通过。
  * `npm run build` 通过。
  * `npm run test` 通过：14 个测试文件，77 个测试用例。
  * DevOps Docker build 未验证：当前环境未安装或未暴露 Docker CLI。

---

## 2. 任务执行上下文

* **最后完成的任务**: `[DO-002]` GitHub Actions CI/CD 与 `[DO-003]` Docker/Nginx 部署配置。
* **当前正在执行的任务**: 无。
* **当前正在编辑的代码文件**: 无。
* **任务统计**:
  * DONE: 30
  * TODO: 0
  * NEED_REVIEW: 0
  * BLOCKED: 0

---

## 3. 已交付能力

* 工程：Vite + TypeScript + Three.js + Rapier + Vitest。
* 渲染：基础 Three.js 场景、CameraManager、右舵 CockpitView、三面后视镜 RenderTarget 骨架。
* 车辆：VehiclePhysics、PlayerCar、respawn/bounds、物理测试。
* 道路：RoadTypes、RoadGraphManager、RoadGraph JSON 公共规范。
* 规则：SpeedLimitRule、LaneDisciplineRule、GiveWayRule、RoundaboutRule、ZebraCrossingRule、ParkingBayRule、RuleEngine、ScoringSystem。
* 训练：LevelManager、关卡阈值、评分结算联动。
* 交通：TrafficAI、PedestrianAI。
* UI：HUD、ResultsPanel、HUD CSS、Results CSS、视觉 tokens。
* 数据：ScoreStorage，带 checksum 完整性校验。
* 文档：level specs、scoring rules、coach phrases、Highway Code rules mapping。
* 测试：14 个测试文件，77 个测试用例。

---

## 4. 下一步重点

1. 后续产品/工程扩展任务应新增到 `tasks/`，避免使用未登记的 BE-007/FE-007 等临时编号。
2. 如需要自动发布，先在目标平台创建正式 secret，再启用 CI workflow 中对应部署 job。

---

## 5. 协作提醒

* 所有 Agent 修改共享文件前必须读取 `docs/coordinator/agent_contracts.md`。
* 后续写入状态/任务文件必须保持 UTF-8。
* 不要重新创建 `uk-driving-trainer/` 嵌套项目目录；根目录 `D:\Desktop\UK Driver` 是唯一工作区。
