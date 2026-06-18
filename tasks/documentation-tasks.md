# Documentation Tasks

This file tracks the backlog and execution status of the Documentation Agent.

---

## 任务列表

### [DOC-001] 编写项目主 README 部署开发环境说明书
* **任务状态**: DONE
* **复核说明**: 2026-06-18 已在根目录验证 `npm install`、`npm run dev`、`npm run build`、`npm run test`，并更新 README 的命令状态。
* **优先级**: HIGH
* **依赖关系**: 无
* **输入**: `PROJECT_DEVELOPMENT_PLAN.md` 目录结构和规范。
* **输出**:
  * 创建/更新 `README.md`。
* **验收标准**:
  * 详细写明如何进行克隆、安装依赖、启动开发环境、运行单元测试以及执行打包构建。
  * 列出系统键盘操作说明书与玩法规则概述。
* **执行步骤**:
  1. 梳理完整的本地运行及测试命令。
  2. 编写操作按键图表（W/S/A/D, Q/E 等）。
  3. 介绍 `/status/` 断点续接的使用说明，指引新 AI 快速接手。
* **完成后需要修改的文件**:
  * `README.md`
* **完成后需要记录的日志**:
  * "DOC-001: 完成了项目根目录 README.md 使用与开发部署指南的编制。"

---

### [DOC-002] 编写 RoadGraph JSON 路网配置协议标准说明文档
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [ARC-002]
* **输入**: `src/road/RoadTypes.ts` 类型定义及 `docs/architecture/roadgraph_model_notes.md` 架构说明。
* **输出**:
  * 创建 `docs/architecture/roadgraph_spec.md`。
* **验收标准**:
  * 通过示例 JSON 数据，逐字段解释 Lane、Junction、RoadSign 属性。
  * 提供坐标系图解说明，指导如何扩展新的路网配置。
* **执行步骤**:
  1. 编写 Markdown 示例文档，嵌入一段完整的路网 JSON 片段。
  2. 详细说明车道的前驱 (predecessor) 和后继 (successor) 车道 ID，阐释路网拓扑连通性。
  3. 保持本文档作为面向开发者和内容配置者的唯一 RoadGraph 公共规范；架构侧草案仅作为输入。
* **完成后需要修改的文件**:
  * `docs/architecture/roadgraph_spec.md`
* **完成后需要记录的日志**:
  * "DOC-002: 交付了完整的 RoadGraph 道路数据拓扑协议和 JSON 配置 Schema 规范文档。"

---

### [DOC-003] 编制游戏规则与英国 Highway Code 官方条例映射关系文档
* **任务状态**: DONE
* **复核说明**: 2026-06-18 已按官方 GOV.UK / Highway Code 来源重新核对并刷新 `docs/requirements/rules_mapping.md`，矩阵包含 ruleId、游戏判定摘要、官方规则/来源链接与实现备注。
* **优先级**: MEDIUM
* **依赖关系**: [PM-002]
* **输入**: PM 的扣分设计文档及英国官方交通法文档。
* **输出**:
  * 创建 `docs/requirements/rules_mapping.md`。
* **验收标准**:
  * 列出游戏内全部扣分规则，并对齐至具体的 Highway Code 序号（如 靠左行驶 -> Rule 160，进入环岛让右 -> Rule 185，斑马线让行 -> Rule 195）。
  * 给出每个对应法则的简短官方文字描述，并外链至官方网站。
* **执行步骤**:
  1. 查阅英国政府网关于 Highway Code 的公开规则。
  2. 提取限速、超车、路口让行、行车灯光、环岛路线、人行斑马线等规则，形成映射表格。
* **完成后需要修改的文件**:
  * `docs/requirements/rules_mapping.md`
* **完成后需要记录的日志**:
  * "DOC-003: 完成了游戏评分规则与英国 Highway Code 条例映射矩阵文档。"
