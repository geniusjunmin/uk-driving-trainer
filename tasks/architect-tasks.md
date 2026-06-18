# Tech Lead / Architect Tasks

This file tracks the backlog and execution status of the Tech Lead / Architect Agent.

---

## 任务列表

### [ARC-001] 初始化项目工程与编译器环境配置
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: 无
* **输入**: `PROJECT_DEVELOPMENT_PLAN.md` 推荐技术栈。
* **输出**: 
  * `package.json`（引入 Vite, Three.js, TypeScript, @types/three, @dimforge/rapier3d-compat, vitest 依赖）
  * `tsconfig.json`（配置严格 TS 类型及路径映射）
  * `vite.config.ts`（基础构建与热更新配置）
* **验收标准**:
  * 运行 `npm run dev` 能成功启动本地开发服务器，无编译报错。
  * 运行 `npm run build` 能产出静态资源包。
* **执行步骤**:
  1. 生成 `package.json`，配置运行脚本（`dev`, `build`, `test`）。
  2. 生成 `tsconfig.json`，开启 `strict: true` 及 `noImplicitAny: true`。
  3. 创建 Vite 配置文件，配置静态资源路径。
* **完成后需要修改的文件**:
  * `package.json`
  * `tsconfig.json`
  * `vite.config.ts`
* **完成后需要记录的日志**:
  * "ARC-001: 项目工程框架初始化完成，支持 TypeScript 与 Vite 编译。"

---

### [ARC-002] 设计 RoadGraph 道路路网数据模型与 Schema 规约
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: 无
* **输入**: `需求.txt` 中“八、道路系统”一节。
* **输出**: 
  * 创建文件 `src/road/RoadTypes.ts`（定义 Lane, Junction, RoadSign 等 TypeScript 接口）。
  * 创建文件 `docs/architecture/roadgraph_model_notes.md`（说明架构侧数据模型与坐标系映射）。
* **验收标准**:
  * TS 类型定义包含车道中心线坐标数组、限速数值、转向限制、冲突区域、标志牌等关键属性。
  * 所有路网节点坐标系统一以米 (m) 为单位，以 Y 轴为垂直高度。
* **执行步骤**:
  1. 在 `RoadTypes.ts` 中定义 `Lane` 接口，包含中心线插值路径点 `Vector3[]`。
  2. 定义 `Junction` 接口，包含冲突区（Conflict Zones）和通行优先级标记。
  3. 编写路网规范文档，说明 JSON 数据如何表征车道连通性。
* **完成后需要修改的文件**:
  * `src/road/RoadTypes.ts`
  * `docs/architecture/roadgraph_model_notes.md`
* **完成后需要记录的日志**:
  * "ARC-002: 完成 RoadGraph 数据拓扑的 TypeScript 接口定义与格式规范文档。"

---

### [ARC-003] 设计主游戏类与规则引擎抽象基类
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [ARC-001]
* **输入**: `需求.txt` 中“最小可行规则引擎思路”。
* **输出**:
  * 创建 `src/core/Game.ts` 基类。
  * 创建 `src/rules/RuleEngine.ts` 接口及基类。
* **验收标准**:
  * `Game` 类具备初始化、载入资源、添加物理世界、游戏主更新循环生命周期。
  * `RuleEngine` 具备 `addRule` 和 `update` 方法，接口返回 `DrivingFault` 或 `null`。
* **执行步骤**:
  1. 编写 `Game.ts` 的基础骨架，将 Three.js 场景初始化和更新逻辑纳入管理。
  2. 声明 `DrivingRule` 接口与 `DrivingContext` 上下文结构（包含当前车辆速度、车道信息、转向灯状态、时间）。
* **完成后需要修改的文件**:
  * `src/core/Game.ts`
  * `src/rules/RuleEngine.ts`
* **完成后需要记录的日志**:
  * "ARC-003: 交付了核心 Game 运行环生命周期及 RuleEngine 接口抽象基类。"
