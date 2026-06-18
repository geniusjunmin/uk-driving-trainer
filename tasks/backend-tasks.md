# Backend Tasks

This file tracks the backlog and execution status of the Backend Agent.

---

## 任务列表

### [BE-001] 集成 Rapier 物理引擎并配置物理世界更新
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [ARC-001]
* **输入**: `PROJECT_DEVELOPMENT_PLAN.md`。
* **输出**:
  * 创建 `src/vehicle/VehiclePhysics.ts`。
* **验收标准**:
  * 成功初始化 Rapier 物理世界，带有默认向下重力 (e.g. -9.81 m/s²)。
  * 实现物理世界的时间步长同步更新 (Fixed Timestep)，并在 Three.js 帧循环中同步更新刚体位置。
* **执行步骤**:
  1. 初始化 `@dimforge/rapier3d-compat`（加载 WASM 依赖）。
  2. 创建物理世界实例 `World`。
  3. 编写物理世界的更新接口，支持传入 delta time 进行积分更新。
* **完成后需要修改的文件**:
  * `src/vehicle/VehiclePhysics.ts`
* **完成后需要记录的日志**:
  * "BE-001: 成功载入并集成 Rapier WASM 物理引擎，搭建好物理仿真主循环。"

---

### [BE-002] 编写半物理车辆底盘控制器与动力学计算
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [BE-001]
* **输入**: `需求.txt` 中“七、车辆控制”及 MVP 车辆参数。
* **输出**:
  * 创建 `src/vehicle/PlayerCar.ts`。
* **验收标准**:
  * 玩家输入加速键 W，施加前进推力；输入刹车键 S，施加制动力。
  * 键盘 A/D 控制前轮转向角，带有合理的最大转角限制和回正阻尼。
  * 档位系统功能完备：D 档前进，R 档倒车，N 档滑行，P 档锁死刚体。
  * 物理碰撞有效：撞击地面或障碍物时，有正常的刚体弹性碰撞和阻尼反馈。
* **执行步骤**:
  1. 在 Rapier 中为车辆创建主刚体 (RigidBody) 和碰撞箱 (Collider)。
  2. 结合键盘输入状态，在物理循环中计算牵引力、空气阻力、摩擦力及刹车减速度。
  3. 更新车辆速度（折算为 mph）和当前坐标，暴露给前端。
  4. 实现 R 档和 D 档的推力方向反转逻辑。
* **完成后需要修改的文件**:
  * `src/vehicle/PlayerCar.ts`
* **完成后需要记录的日志**:
  * "BE-002: 完成了车辆底盘半物理受力动力学计算，支持前进、倒车、转向与刹车。"

---

### [BE-003] 实现关卡进度与高分本地持久化层
* **任务状态**: DONE
* **优先级**: LOW
* **依赖关系**: 无
* **输入**: `需求.txt` 中的扣分与评分数据结构。
* **输出**:
  * 创建 `src/data/ScoreStorage.ts`。
* **验收标准**:
  * 能够将单次挑战的结果数据（时间、得分、扣分明细）写入 LocalStorage。
  * 支持读取历史最高分和当前已解锁的关卡列表（Level 1 至 Level 6）。
* **执行步骤**:
  1. 编写 LocalStorage 封装类。
  2. 定义关卡解锁状态及历史驾驶日志的 JSON 数据存储格式。
  3. 提供 `saveRecord(levelId, score, faults)` 和 `getHighScores()` 方法。
* **完成后需要修改的文件**:
  * `src/data/ScoreStorage.ts`
* **完成后需要记录的日志**:
  * "BE-003: 实现了基于 LocalStorage 的驾驶考核评分本地持久化模块。"
