# 6-Level Training Specifications

本文档定义 MVP 的 6 个训练关卡，供 Architect / Backend 后续转换为 RoadGraph、Scenario 配置、规则检测与 QA 用例。

## 1. 设计原则

* 项目定位是英国新手驾驶训练模拟器，不是竞速游戏。
* 关卡路线以小镇低速道路为主，所有速度单位使用 mph。
* 每关都必须从右舵驾驶视角训练靠左行驶、观察、让行和指示灯习惯。
* 每个关键训练点都应在 RoadGraph 中有可检测的 trigger zone、lane id、junction id 或 crossing id。
* 教学提示分为三类：
  * `pre_hint`: 进入训练点前 3-6 秒提示。
  * `live_hint`: 玩家正在接近风险或动作不完整时提示。
  * `review_hint`: 关卡结算或错误回放时提示。

## 2. 通用 RoadGraph / Scenario 字段建议

```ts
type LevelSpec = {
  id: "level-1" | "level-2" | "level-3" | "level-4" | "level-5" | "level-6";
  nameZh: string;
  startNodeId: string;
  endNodeId: string;
  routeNodeIds: string[];
  primaryRules: string[];
  triggerZoneIds: string[];
  passCriteria: string[];
  failCriteria: string[];
};
```

通用检测对象建议：

| 类型 | 命名示例 | 用途 |
| :--- | :--- | :--- |
| `lane` | `L1_residential_westbound_left` | 判定靠左、逆行、压线、限速 |
| `node` | `N1_home_bay_start` | 路线起点/终点/导航点 |
| `zone` | `Z1_speed_20_entry` | 触发限速、教学提示、观察要求 |
| `junction` | `J1_give_way_t` | Give Way / Stop / 右转冲突检测 |
| `crossing` | `C1_school_zebra` | 斑马线、行人优先检测 |
| `roundabout` | `R1_mini_roundabout` | 环岛入口、出口、让右检测 |
| `parking_bay` | `P1_tesco_reverse_bay` | 停车入位检测 |

## 3. 通用规则类别

| 规则类别 | 检测意图 |
| :--- | :--- |
| `keep-left` | 正常行驶应保持在左侧车道，转弯后进入正确车道。 |
| `speed-limit` | 遵守 20 / 30 mph 区域限速，靠近风险点提前减速。 |
| `msm` | Mirrors - Signal - Manoeuvre：观察、打灯、再动作。 |
| `psl` | Position - Speed - Look：位置、速度、观察。 |
| `give-way` | Give Way 线前减速或停车，确认主路安全间隙。 |
| `roundabout-give-right` | 进入环岛前让右侧来车，按出口选择信号和位置。 |
| `pedestrian-priority` | 斑马线和学校区对行人让行。 |
| `stop-observe` | 停车、观察盲区、确认安全再起步或倒车。 |
| `parking-control` | 低速、正确档位、观察周边、停入指定车位。 |

## 4. Level 1 - 右舵与靠左基础

### 训练目的

让玩家适应右舵视角、mph 速度表、靠左行驶、车道居中和低速起步停车。

### 场景与路线

* 地图区域：安静住宅区直线道路，单向每侧一条车道，无 NPC 车辆。
* 起点：`N1_home_bay_start`，左侧路边停车位，车头朝行驶方向。
* 终点：`N1_residential_stop_box`，300 米外左侧临时停车框。
* 路线：
  1. 从 `P1_home_kerb_bay` 起步。
  2. 并入 `L1_residential_eastbound_left`。
  3. 沿左侧车道通过轻微弯道 `N1_gentle_bend`。
  4. 在 `P1_stop_box` 内平稳停车。

### 关键触发点

| 触发点 | 位置 | 检测内容 |
| :--- | :--- | :--- |
| `Z1_start_observation` | 起点车位 | 起步前是否观察右镜/中镜，是否打右灯并确认安全。 |
| `Z1_lane_join` | 并入车道前 10 米 | 是否进入左侧行驶车道，是否压到对向车道。 |
| `Z1_speed_20_entry` | 住宅区入口 | 限速 20 mph，检测超速。 |
| `Z1_lane_centering` | 中段 150 米 | 检测是否长时间偏离车道中心或骑线。 |
| `Z1_stop_box_entry` | 终点前 20 米 | 是否提前减速，是否停在指定区域内。 |

### 关联规则类别

`keep-left`, `speed-limit`, `msm`, `psl`, `stop-observe`

### 通关条件

* 完成全部 route nodes，最终车辆完全停在 `P1_stop_box` 内。
* 全程无逆行、无碰撞、无离开道路。
* 20 mph 区域内最高速度不超过 23 mph。
* 严重错误数量为 0，累计扣分不超过 20。

### 失败条件

* 进入对向车道持续超过 2 秒。
* 碰撞路缘、标志、车辆或行人。
* 终点停车区域外停车超过 10 秒仍未修正。
* 累计扣分超过 40。

### 教学提示时机

| 时机 | 触发条件 | 提示方向 |
| :--- | :--- | :--- |
| `pre_hint` | 起步前 | 先观察中镜和右镜，打右灯，再平稳起步。 |
| `live_hint` | 横向偏离左侧车道中心超过阈值 | 轻微修正方向，保持靠左车道居中。 |
| `live_hint` | 速度超过 20 mph | 当前为 20 mph 住宅区，请松油或轻刹。 |
| `review_hint` | 发生压线/逆行 | 说明右舵视角下应以左侧车道线和路缘作为定位参考。 |

## 5. Level 2 - 住宅区限速与窄路会车

### 训练目的

训练 20 / 30 mph 限速切换、通过减速带、避让路边停车车辆和窄路会车。

### 场景与路线

* 地图区域：住宅区支路接入较宽主路，存在路边停车车队与减速带。
* 起点：`N2_culdesac_start`，住宅尽头掉头后位置。
* 终点：`N2_main_road_marker`，30 mph 主路直行 250 米处。
* 路线：
  1. 从 `L2_culdesac_left` 以 20 mph 区域起步。
  2. 通过 `Z2_speed_hump_1` 和 `Z2_speed_hump_2`。
  3. 经过左侧停放车辆 `O2_parked_car_cluster`，保持安全侧距。
  4. 在 `Z2_narrow_meet` 与对向 NPC 低速会车。
  5. 进入 `L2_main_road_30_left` 后保持 30 mph 内行驶至终点。

### 关键触发点

| 触发点 | 位置 | 检测内容 |
| :--- | :--- | :--- |
| `Z2_speed_20_zone` | 起点至住宅区出口 | 20 mph 限速和减速带前减速。 |
| `Z2_parked_car_offset` | 路边停车车辆旁 | 是否提前调整位置，是否压入对向车道过多。 |
| `Z2_oncoming_priority` | 窄路会车点 | 如果本车侧有障碍，是否让对向车优先。 |
| `Z2_speed_30_entry` | 主路限速牌后 | 限速切换为 30 mph。 |
| `Z2_follow_lane` | 主路中段 | 靠左、车道保持、稳定速度。 |

### 关联规则类别

`keep-left`, `speed-limit`, `psl`, `give-way`, `msm`

### 通关条件

* 按路线驶出住宅区并到达 `N2_main_road_marker`。
* 20 mph 区域最高速度不超过 23 mph，30 mph 区域最高速度不超过 33 mph。
* 通过停放车辆时不发生碰撞，横向侧距保持在设计安全阈值内。
* 窄路会车时没有迫使 NPC 急刹或进入冲突区。
* 累计扣分不超过 25。

### 失败条件

* 与停放车辆或对向 NPC 碰撞。
* 在对向车道连续行驶超过 3 秒且无避让理由。
* 减速带前速度超过 25 mph。
* 累计扣分超过 45。

### 教学提示时机

| 时机 | 触发条件 | 提示方向 |
| :--- | :--- | :--- |
| `pre_hint` | 进入住宅区 | 住宅区通常风险多，保持 20 mph 内并持续观察。 |
| `pre_hint` | 减速带前 30 米 | 提前减速，直线通过减速带。 |
| `live_hint` | 接近停放车辆且未调整位置 | 稍向右避让停放车辆，但不要长时间占用对向车道。 |
| `live_hint` | 对向车进入窄路冲突区 | 本侧有障碍时请等待，让对向车辆先通过。 |
| `review_hint` | 会车扣分 | 解释窄路会车时的位置、速度和观察判断。 |

## 6. Level 3 - T 字路口 Give Way 与右转入主路

### 训练目的

训练 Give Way 线前减速/停车、左右观察、判断安全间隙、右转进入主路后保持左侧车道。

### 场景与路线

* 地图区域：小路 T 字路口接入双向主路，主路有左右来车。
* 起点：`N3_side_road_start`，小路距路口 120 米处。
* 终点：`N3_main_road_finish`，主路右转后 220 米处。
* 路线：
  1. 沿 `L3_side_road_left` 接近 `J3_give_way_t`。
  2. 在 Give Way 三角线前减速，必要时停车。
  3. 观察右侧近车道与左侧远车道 NPC。
  4. 右转进入 `L3_main_road_westbound_left`。
  5. 取消右转灯并稳定行驶至终点。

### 关键触发点

| 触发点 | 位置 | 检测内容 |
| :--- | :--- | :--- |
| `Z3_give_way_approach` | 路口前 50 米 | 是否提前减速，是否打右灯。 |
| `Z3_give_way_line` | Give Way 线 | 是否低速通过或停车观察，是否越线过深。 |
| `Z3_right_gap_check` | 路口冲突区 | 是否让主路来车，是否选择足够安全间隙。 |
| `Z3_turn_entry_lane` | 转入主路后 20 米 | 是否进入主路左侧车道，是否切入对向车道。 |
| `Z3_indicator_cancel` | 转弯完成后 5 秒 | 是否取消右转灯。 |

### 关联规则类别

`give-way`, `keep-left`, `msm`, `psl`, `speed-limit`

### 通关条件

* 成功从小路右转进入主路并到达终点。
* 进入冲突区前速度低于 10 mph；若 NPC 安全间隙不足，必须停车等待。
* 未造成主路 NPC 急刹、碰撞或危险避让。
* 转弯后 30 米内进入并保持主路左侧车道。
* 累计扣分不超过 25，危险错误为 0。

### 失败条件

* 未让主路车辆导致 NPC 急刹或碰撞。
* 直接越过 Give Way 线并以超过 15 mph 进入冲突区。
* 右转后进入错误车道或逆行超过 2 秒。
* 累计扣分超过 45。

### 教学提示时机

| 时机 | 触发条件 | 提示方向 |
| :--- | :--- | :--- |
| `pre_hint` | 路口前 60 米 | 前方 Give Way，减速、右灯、观察左右。 |
| `live_hint` | 未明显减速 | Give Way 前请把速度降下来，准备停车。 |
| `live_hint` | 主路 NPC 距离不足 | 等待安全间隙，不要抢行。 |
| `live_hint` | 转入主路后偏向右侧 | 右转后进入左侧车道，不要切到对向车道。 |
| `review_hint` | Give Way 失败 | 回放说明观察顺序、间隙判断和进入车道。 |

## 7. Level 4 - Mini-Roundabout 三种出口

### 训练目的

训练小环岛接近速度、让右侧来车、出口选择、指示灯时机和环岛内车道位置。

### 场景与路线

* 地图区域：四臂 mini-roundabout，含低速 NPC 来车。
* 起点：`N4_south_approach_start`，南侧入口前 150 米。
* 终点：按子任务变化：
  * `N4_exit_1_finish`：第一出口左转。
  * `N4_exit_2_finish`：第二出口直行。
  * `N4_exit_3_finish`：第三出口右转。
* 路线模式：
  1. 子任务 A：南入口进入，第一出口离开。
  2. 子任务 B：南入口进入，第二出口离开。
  3. 子任务 C：南入口进入，第三出口离开。
* MVP 可将三次子任务串成同一关，玩家依导航依次完成。

### 关键触发点

| 触发点 | 位置 | 检测内容 |
| :--- | :--- | :--- |
| `Z4_roundabout_sign` | 环岛前 80 米 | 是否按导航准备出口，是否开始减速。 |
| `Z4_give_right_line` | 入口 Give Way 线 | 是否让右侧环岛内车辆。 |
| `Z4_entry_speed` | 入口前 15 米 | 进入速度是否低于 15 mph。 |
| `Z4_signal_exit_1` | 第一出口任务接近入口 | 左转应提前打左灯。 |
| `Z4_signal_exit_2` | 第二出口任务 | 进入前通常不打灯，经过第一出口后打左灯离开。 |
| `Z4_signal_exit_3` | 第三出口任务 | 进入前打右灯，经过第二出口后打左灯离开。 |
| `Z4_exit_lane` | 每个出口后 20 米 | 离开后是否进入左侧车道。 |

### 关联规则类别

`roundabout-give-right`, `give-way`, `keep-left`, `msm`, `psl`, `speed-limit`

### 通关条件

* 三个出口子任务均完成，或当前 Scenario 配置的指定出口完成。
* 每次进入环岛前均正确让右侧来车。
* 入口速度低于 15 mph，环岛内无碰撞、无逆行。
* 出口信号错误不超过 1 次；无“未让右”危险错误。
* 累计扣分不超过 30。

### 失败条件

* 未让右侧来车导致冲突或 NPC 急刹。
* 从错误出口离开且未在 10 秒内按导航修正。
* 环岛内逆行、停在中心岛上或碰撞。
* 累计扣分超过 50。

### 教学提示时机

| 时机 | 触发条件 | 提示方向 |
| :--- | :--- | :--- |
| `pre_hint` | 环岛前 80 米 | 前方小环岛，按导航选择出口，减速观察右侧。 |
| `live_hint` | 右侧有来车且玩家仍加速 | 让右侧车辆先行。 |
| `live_hint` | 第一出口任务未打左灯 | 第一出口请提前打左灯并靠左离开。 |
| `live_hint` | 第三出口任务未打右灯 | 右转或第三出口通常先打右灯，离开前改左灯。 |
| `review_hint` | 出口/信号错误 | 展示入口、环岛内和出口前的正确信号时机。 |

## 8. Level 5 - 学校区与斑马线行人优先

### 训练目的

训练学校区低速观察、斑马线让行、儿童突然出现风险和停车后重新起步观察。

### 场景与路线

* 地图区域：学校门口 20 mph 区域，带斑马线、校车/停放车辆和行人 AI。
* 起点：`N5_school_zone_start`，学校区入口前 120 米。
* 终点：`N5_school_zone_exit`，离开学校区后的直线路段。
* 路线：
  1. 进入 `Z5_school_20_entry`，降至 20 mph 内。
  2. 经过停放校车 `O5_school_bus_stop`，观察遮挡风险。
  3. 接近 `C5_zebra_crossing`，根据行人状态减速或停车。
  4. 行人完全离开斑马线后重新起步。
  5. 通过学校区出口至终点。

### 关键触发点

| 触发点 | 位置 | 检测内容 |
| :--- | :--- | :--- |
| `Z5_school_20_entry` | 学校区入口 | 20 mph 限速，是否提前减速。 |
| `Z5_bus_occlusion` | 校车旁 | 是否降低速度并观察潜在行人。 |
| `C5_zebra_approach` | 斑马线前 40 米 | 是否准备减速，是否观察等待行人。 |
| `C5_zebra_stop_line` | 斑马线前停车位置 | 行人已进入或等待时是否停车让行。 |
| `Z5_restart_observation` | 停车后重新起步 | 是否确认行人完全通过并观察后再起步。 |

### 关联规则类别

`pedestrian-priority`, `speed-limit`, `stop-observe`, `psl`, `keep-left`

### 通关条件

* 通过学校区和斑马线，最终到达 `N5_school_zone_exit`。
* 行人进入斑马线时必须停车让行。
* 行人在路边等待且朝向斑马线时，必须明显减速并准备停车。
* 20 mph 区域最高速度不超过 23 mph。
* 无碰撞，危险错误为 0，累计扣分不超过 25。

### 失败条件

* 未给斑马线上的行人让行。
* 碰撞行人、校车、停放车辆或路缘。
* 学校区超过 30 mph。
* 在斑马线上停车阻挡行人超过 3 秒。
* 累计扣分超过 45。

### 教学提示时机

| 时机 | 触发条件 | 提示方向 |
| :--- | :--- | :--- |
| `pre_hint` | 学校区入口 | 学校区保持低速，注意儿童和遮挡。 |
| `pre_hint` | 斑马线前 50 米 | 前方斑马线，观察两侧行人，准备停车。 |
| `live_hint` | 行人等待且玩家未减速 | 有行人准备过街，请松油并覆盖刹车。 |
| `live_hint` | 车停在斑马线上 | 不要停在斑马线内，保持横道畅通。 |
| `review_hint` | 行人优先错误 | 说明斑马线前的减速、停车和重新起步观察流程。 |

## 9. Level 6 - Tesco 风格停车场倒车入库

### 训练目的

训练低速控制、停车场让行、倒车档、镜面观察、盲区观察和倒车入指定车位。

### 场景与路线

* 地图区域：小型超市停车场，入口 Give Way、行人通道、两排停车位和少量 NPC 车辆。
* 起点：`N6_tesco_access_road_start`，超市入口道路。
* 终点：`P6_target_reverse_bay`，指定倒车入库车位。
* 路线：
  1. 从入口道路驶向 `J6_carpark_give_way`。
  2. 让停车场内横向车辆和行人通道行人先行。
  3. 以低速进入 `L6_carpark_aisle_left`。
  4. 经过目标车位后停车，挂 R 档。
  5. 倒车入 `P6_target_reverse_bay`。
  6. 车辆居中、完全进入车位后挂 P 或保持刹车 2 秒结束。

### 关键触发点

| 触发点 | 位置 | 检测内容 |
| :--- | :--- | :--- |
| `Z6_carpark_entry_speed` | 停车场入口 | 入口速度是否低于 10 mph。 |
| `J6_carpark_give_way` | 停车场入口线 | 是否让横向车辆/行人。 |
| `Z6_pedestrian_walkway` | 停车场行人通道 | 是否给行人让行。 |
| `Z6_reverse_setup` | 目标车位前 | 是否驶过车位并以合适角度停车准备倒车。 |
| `Z6_reverse_observation` | 挂 R 档后 | 是否观察左右镜/后方视角后开始倒车。 |
| `P6_bay_alignment` | 目标车位 | 车辆是否在车位线内、方向是否基本平行。 |

### 关联规则类别

`parking-control`, `stop-observe`, `give-way`, `pedestrian-priority`, `msm`, `speed-limit`

### 通关条件

* 车辆最终停在 `P6_target_reverse_bay` 内：
  * 四轮在车位边界内。
  * 车辆航向与车位方向夹角不超过 10 度。
  * 前/后保险杠不越出车位边界超过配置阈值。
* 停车场内最高速度不超过 12 mph。
* 倒车前至少完成一次后方或镜面观察事件。
* 无碰撞，危险错误为 0，累计扣分不超过 30。

### 失败条件

* 碰撞行人、NPC 车辆、停放车辆、购物车或护栏。
* 未让停车场内已有车辆/行人导致冲突。
* 倒车时没有观察后方且进入倒车移动超过 1 秒。
* 车辆停入错误车位且超过 15 秒未修正。
* 累计扣分超过 50。

### 教学提示时机

| 时机 | 触发条件 | 提示方向 |
| :--- | :--- | :--- |
| `pre_hint` | 停车场入口前 40 米 | 停车场保持步行速度，准备让行。 |
| `live_hint` | 入口横向车辆接近 | 先让停车场内车辆通过。 |
| `pre_hint` | 接近目标车位 | 驶过车位后停车，准备倒车入库。 |
| `live_hint` | 挂 R 档但未观察 | 倒车前看后方和两侧镜，确认盲区安全。 |
| `live_hint` | 车身角度过大 | 小幅修正方向，保持低速倒入车位。 |
| `review_hint` | 停车不合格 | 回放倒车起点、转向时机、观察动作和最终车位偏差。 |

## 10. MVP 关卡路线图与依赖

| 优先级 | 关卡 | 依赖模块 | 交付价值 |
| :--- | :--- | :--- | :--- |
| P0 | Level 1 | 车辆控制、车道检测、速度检测、基础 HUD | 建立右舵、靠左、限速的核心训练闭环。 |
| P0 | Level 2 | RoadGraph 车道、障碍物、简单 NPC | 扩展真实住宅区驾驶风险。 |
| P1 | Level 3 | Junction / Give Way / NPC 主路车流 | 支撑路口优先权和安全间隙判断。 |
| P1 | Level 4 | Roundabout 模型、出口导航、信号检测 | 覆盖英国驾驶高频难点。 |
| P2 | Level 5 | 行人 AI、斑马线 trigger、学校区素材 | 覆盖行人优先与低速观察。 |
| P2 | Level 6 | 停车位检测、倒车观察、低速停车控制 | 形成完整训练终点和实用停车技能。 |

建议实现顺序：

1. 先实现 Level 1 的完整闭环，包括评分、提示和结算。
2. 复用 Level 1 的 lane / speed / hint 框架实现 Level 2。
3. 在 Level 3 引入通用 `JunctionConflictZone`。
4. 在 Level 4 将环岛拆成 entry zone、circulatory lane、exit zone 三类检测。
5. 在 Level 5 引入 `PedestrianIntentState`，区分等待、进入、通过、离开。
6. 在 Level 6 引入 `ParkingBayFitCheck`，检测车辆包围盒、角度和静止时间。

## 11. 后续交接建议

* Architect 可基于本文定义 `Scenario`, `RouteNode`, `TriggerZone`, `PriorityRule` 的 TypeScript 类型。
* Backend 可将每个触发点转成规则检测器输入事件，例如 `enteredZone`, `crossedGiveWayLine`, `indicatorChanged`, `observationRecorded`。
* QA 可按每关通关条件和失败条件编写自动驾驶路径测试与边界测试。
* PM-002 应在本文基础上细化各类 fault 的扣分权重、严重等级和失败阈值。
* PM-003 应在本文提示时机基础上扩展完整中英双语教练话术。
