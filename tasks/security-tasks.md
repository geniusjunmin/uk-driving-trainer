# Security Tasks

This file tracks the backlog and execution status of the Security Agent.

---

## 任务列表

### [SEC-001] 编写运行时间步长校验与最大 Delta Time 钳制
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [ARC-003]
* **输入**: `src/core/Time.ts`。
* **输出**: 
  * 创建/更新 `src/core/Time.ts`。
* **验收标准**:
  * 限制单帧最大 delta time 不超过 0.1 秒，防止由于后台挂起或外挂篡改时间线导致物理世界瞬移穿模。
  * 平滑大起大落的帧率波动，确保物理积分步长稳定。
* **执行步骤**:
  1. 在 `Time.ts` 中维护真实的系统时间与物理模拟时间。
  2. 对传入的真实时间间隔进行 `Math.min(dt, MAX_DT_LIMIT)` 过滤。
  3. 平滑计算滚动平均帧率 (FPS)。
* **完成后需要修改的文件**:
  * `src/core/Time.ts`
* **完成后需要记录的日志**:
  * "SEC-001: 实现了最大 Delta Time 钳制，消除了挂起进程造成的刚体瞬移穿墙隐患。"

---

### [SEC-002] 编写物理空间越界检测与刚体安全复位 (Respawn)
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [BE-002]
* **输入**: `src/vehicle/PlayerCar.ts` 物理底盘。
* **输出**:
  * 更新 `src/vehicle/PlayerCar.ts`。
* **验收标准**:
  * 周期性检测车辆位置。一旦 Y 轴高度低于 -10 米（掉落出界）或远离城镇中心，自动重置其坐标至最近的安全路网起点。
  * 重置时必须将刚体的线速度 and 角速度归零，消除残余冲量。
* **执行步骤**:
  1. 在车辆的 update 物理逻辑中加入三维位置界限校验。
  2. 实现 `respawn(position, rotation)` 方法，调用 Rapier API 重设刚体状态并清空力（forces）和冲量（impulses）。
* **完成后需要修改的文件**:
  * `src/vehicle/PlayerCar.ts`
* **完成后需要记录的日志**:
  * "SEC-002: 编写了空间越界自动捕获与物理线速度/角速度归零复位功能。"

---

### [SEC-003] 编写本地存档校验和与防篡改逻辑
* **任务状态**: DONE
* **优先级**: LOW
* **依赖关系**: [BE-003]
* **输入**: `src/data/ScoreStorage.ts`。
* **输出**:
  * 更新 `src/data/ScoreStorage.ts`。
* **验收标准**:
  * 存储高分和解锁状态时，根据内容生成哈希校验和 (Checksum)。
  * 读取存档时，重新计算哈希并比对，若不匹配则视作存档损坏并重置，目标是完整性校验与损坏恢复；不得承诺浏览器本地存储具备真正安全性。
* **执行步骤**:
  1. 选择一个简易快速的哈希算法（例如 SHA-256 或轻量 checksum）。
  2. 在保存数据时，基于规范化 JSON 字符串计算哈希值。
  3. 读取数据时比对哈希值。
* **完成后需要修改的文件**:
  * `src/data/ScoreStorage.ts`
* **完成后需要记录的日志**:
  * "SEC-003: 引入了本地存档完整性校验和损坏恢复机制。"
