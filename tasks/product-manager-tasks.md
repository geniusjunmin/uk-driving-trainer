# Product Manager Tasks

This file tracks the backlog and execution status of the Product Manager Agent.

---

## 任务列表

### [PM-001] 制定6个训练关卡详细规约与路线图
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: 无
* **输入**: `需求.txt` 及官方 Highway Code 中关于限速、环岛和人行横道的条例。
* **输出**: 创建新文件 `docs/requirements/level_specs.md`。
* **验收标准**:
  * 文档详细定义 Level 1 至 Level 6 的驾驶路线、起点与终点位置。
  * 每一个关卡标明训练目的、教学提示时机和对应的英国交通法规依据。
* **执行步骤**:
  1. 分析 `需求.txt` 中关于 6 个关卡的设计初衷。
  2. 结合 Highway Code 详细画出（或文字描述）各关卡的中心行车路径。
  3. 定义每一关的“通关条件”（例如：停入指定车位且扣分不超过 30 分）。
* **完成后需要修改的文件**:
  * `docs/requirements/level_specs.md`
* **完成后需要记录的日志**:
  * "PM-001: 交付了6个训练关卡的详细路线规约及通关目标文档。"

---

### [PM-002] 细化扣分规则与警报分值引擎定义
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [PM-001]
* **输入**: `需求.txt` 中“评分系统设计”一节。
* **输出**: 创建新文件 `docs/requirements/scoring_rules.md`。
* **验收标准**:
  * 每一项违规行为（如超速、环岛不让行、不打左灯等）都有明确的扣分分值（-3, -5, -10）和扣分等级。
  * 规定当扣分值累计低于多少分时，关卡挑战失败。
* **执行步骤**:
  1. 梳理“靠左行驶检测”、“环岛训练”、“路口与转弯”、“行人和斑马线”四大核心检测类目。
  2. 将错误划分为 `minor` (轻微), `major` (中等), `dangerous` (严重) 三个级别并绑定分值。
* **完成后需要修改的文件**:
  * `docs/requirements/scoring_rules.md`
* **完成后需要记录的日志**:
  * "PM-002: 完成了扣分规则的评级和分值权重设计。"

---

### [PM-003] 设计 AI 教练中英双语语音/文本提示库
* **任务状态**: DONE
* **本次更新**: 已按触发类型重构 `docs/requirements/coach_phrases.md`，补齐 `phraseId`、`trigger`、`priority`、`cooldown`、`messageZh`、`messageEn`、`relatedRuleId` 字段，覆盖 route guidance、speed warning、lane discipline、give way/stop、roundabout、zebra crossing、mirror/blind spot、parking、success/failure summary。
* **优先级**: MEDIUM
* **依赖关系**: [PM-001]
* **输入**: 关卡路线图及驾驶环境中的触发事件（如接近环岛、人行横道有行人等待等）。
* **输出**: 创建新文件 `docs/requirements/coach_phrases.md`。
* **验收标准**:
  * 形成一张完整的触发条件与提示话术表格，提示必须包含对应的中英文对照。
  * 例如：“At the roundabout, take the second exit” 对应 “在前方环岛，请从第二出口直行”。
* **执行步骤**:
  1. 针对 6 个关卡中的重要路段和玩家可能犯错的地方，编写实时教练提示话术。
  2. 针对通关成功、通关失败和单项扣分，编写相应的教练反馈语。
* **完成后需要修改的文件**:
  * `docs/requirements/coach_phrases.md`
* **完成后需要记录的日志**:
  * "PM-003: 编制并交付了完整的 AI 教练双语提示语库。"
