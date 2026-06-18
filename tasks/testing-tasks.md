# Testing Tasks

This file tracks the backlog and execution status of the QA / Testing Agent.

---

## 任务列表

### [QA-001] 搭建 Vitest 测试框架与运行配置
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [ARC-001]
* **输入**: `package.json` 及 TypeScript 构建环境。
* **输出**: 
  * 创建 `vitest.config.ts`。
  * 创建测试入口脚本 `tests/setup.ts`。
* **验收标准**:
  * 终端运行 `npm run test` 可以成功拉起测试，并无错运行测试套件。
  * 提供基本的 Mock 配置以隔离 Three.js WebGL 上下文。
* **执行步骤**:
  1. 安装 `vitest` 与 `jsdom`（如果 UI 测试需要）。
  2. 编写 `vitest.config.ts` 指定测试包含文件和环境。
  3. 编写一个基础数学函数测试以确保 Vitest 工作正常。
* **完成后需要修改的文件**:
  * `vitest.config.ts`
  * `tests/setup.ts`
* **完成后需要记录的日志**:
  * "QA-001: 成功集成并搭建 Vitest 自动化测试框架。"

---

### [QA-002] 编写规则引擎限速检测规则 (SpeedLimitRule) 单元测试
* **任务状态**: DONE
* **QA-002 复核**: DONE (2026-06-18) - 补充 30 mph 道路下 25/35/45 mph 的 RuleEngine 回归测试，并验证扣分与 message/ruleId 基本字段。
* **优先级**: HIGH
* **依赖关系**: [ARC-003], [QA-001]
* **输入**: `RuleEngine.ts` 抽象类及 PM 限速规则。
* **输出**:
*   * 创建 `tests/rules/SpeedLimitRule.test.ts`。
* **验收标准**:
*   * 模拟在限速 30 mph 道路上车速为 25 mph，断言无扣分。
*   * 模拟车速为 35 mph，断言扣分 3 分，评级为 minor。
*   * 模拟车速为 45 mph，断言扣分 10 分，评级为 major。
* **执行步骤**:
*   1. 引入 RuleEngine 和 SpeedLimitRule 类。
*   2. 构造 `DrivingContext` 的 mock 数据（车速、限速）。
*   3. 执行 `check` 方法并用 `expect` 验证返回的扣分对象各项属性是否正确。
* **完成后需要修改的文件**:
*   * `tests/rules/SpeedLimitRule.test.ts`
* **完成后需要记录 of 日志**:
*   * "QA-002: 交付了 SpeedLimitRule 限速规则引擎判定器的全覆盖单元测试。"
* 
* ---
* 
* ### [QA-003] 编写车辆物理仿真与碰撞沙盒测试脚本
* **任务状态**: DONE
* **优先级**: MEDIUM
* **依赖关系**: [BE-002], [QA-001]
* **输入**: `PlayerCar.ts` 物理底盘。
* **输出**:
  * 创建 `tests/physics/CarPhysics.spec.ts`。
* **验收标准**:
  * 仿真车辆施加推力 10 秒后，断言车辆的位移和车速为正值。
  * 模拟车辆以 100 mph 撞击静态墙体刚体，断言车辆没有穿墙漏过去，并且最终车速衰减至安全范围。
* **执行步骤**:
  1. 在测试用例中引入并实例化 Rapier 物理引擎。
  2. 构造一个包含车辆刚体和一堵静态碰撞墙的虚拟物理世界。
  3. 通过循环手动步进（step）物理世界，记录车辆轨迹，断言碰撞行为。
* **完成后需要修改的文件**:
  * `tests/physics/CarPhysics.spec.ts`
* **完成后需要记录的日志**:
  * "QA-003: 编写并运行了物理底盘在虚拟碰撞墙体下的防穿透物理仿真测试。"
