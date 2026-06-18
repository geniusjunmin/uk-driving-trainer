# Scoring Rules and Alert Engine

本文定义 MVP 训练关卡的扣分规则、警报分值引擎和 QA 可测边界。规则面向 `src/rules/RuleEngine.ts` 的后续实现，并作为 `SpeedLimitRule` 与 `QA-002` 的直接输入。

## 1. Scoring Model

* 每关初始分为 `100`。
* 每个 fault 使用负分记录，结算分为 `100 + sum(points)`。
* `severity` 只能为 `minor`, `major`, `dangerous`。
* 默认分值：
  * `minor`: `-3`
  * `major`: `-5`
  * `dangerous`: `-10`
* 同一规则可按风险升级分值，但必须仍落在上述三档之一。
* 任一碰撞行人、NPC 车辆、路缘、护栏、停车障碍物，直接产生 `dangerous` fault，并触发当前关卡失败。

建议数据结构：

```ts
type DrivingFault = {
  time: number;
  ruleId: string;
  severity: "minor" | "major" | "dangerous";
  points: -3 | -5 | -10;
  messageZh: string;
  messageEn: string;
  position: { x: number; y: number; z: number };
  levelId: string;
  zoneId?: string;
  relatedObjectId?: string;
};
```

## 2. Alert Engine

### 2.1 Live Alert Bands

| Remaining score | HUD state | Coach behavior |
| :--- | :--- | :--- |
| `80-100` | normal | 只显示必要导航与轻提示。 |
| `60-79` | caution | 出现下一次相同错误风险时触发 live hint。 |
| `40-59` | warning | 提示玩家当前关卡接近失败，优先播放最高严重度错误。 |
| `< 40` | fail | 关卡失败，进入结果页或回放。 |

### 2.2 Fault Deduplication

规则引擎应在 `RuleEngine.update(context)` 中先收集候选 fault，再由 scoring 层做去重：

* `dedupeKey = levelId + ruleId + zoneId + relatedObjectId`。
* 若同一 `dedupeKey` 在冷却时间内重复触发，只保留第一次。
* 连续状态类错误使用“进入违规状态时扣一次，状态持续超过升级阈值再扣一次”的方式，避免每帧扣分。
* 危险类错误如碰撞、闯入冲突区、未让行导致 NPC 急刹，不被普通冷却吞掉；同一事故只记录一次。

### 2.3 Severity Upgrade

同一行为可按持续时间、速度差或冲突距离升级：

* `minor`: 操作不规范，但玩家仍可安全修正。
* `major`: 明显违反训练目标，可能迫使其他道路使用者调整。
* `dangerous`: 已进入冲突、逆行、碰撞、行人风险或违反强制停止/让行规则。

## 3. Pass and Fail Thresholds

| Level | Pass threshold | Fail threshold | Instant fail conditions |
| :--- | :--- | :--- | :--- |
| Level 1 | `score >= 80` | `score < 60` | 碰撞、逆行超过 2 秒、离开道路、未停入终点区。 |
| Level 2 | `score >= 75` | `score < 55` | 碰撞、无理由占用对向车道超过 3 秒、减速带前超过 25 mph。 |
| Level 3 | `score >= 75` 且 `dangerous = 0` | `score < 55` | Give Way 抢行导致 NPC 急刹/碰撞，右转后逆行超过 2 秒。 |
| Level 4 | `score >= 70` 且未让右 dangerous 为 0 | `score < 50` | 环岛未让右导致冲突、环岛内逆行/碰撞、错误出口 10 秒未修正。 |
| Level 5 | `score >= 75` 且 `dangerous = 0` | `score < 55` | 未让斑马线行人、碰撞行人/校车、学校区超过 30 mph。 |
| Level 6 | `score >= 70` 且 `dangerous = 0` | `score < 50` | 停车场碰撞、倒车未观察超过 1 秒、停入错误车位 15 秒未修正。 |

全局失败规则：

* `score < fail threshold`。
* 任一 instant fail condition 成立。
* `dangerous` fault 数量达到 `2`，即使分数仍高于失败阈值也失败。

## 4. Rule Definitions

### 4.1 Lane Discipline

| ruleId | Severity | Points | Trigger condition | Cooldown / dedupe | Prompt summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `lane.keep_left.drift` | minor | -3 | 车辆中心偏离当前左侧车道中心超过车道宽 `35%`，持续 `1.5s`，但未压线。 | 每个 lane segment `8s`；修正回中心后重置。 | 中：保持在左侧车道中央。EN: Keep centred in the left lane. |
| `lane.line_touch` | minor | -3 | 车轮或车身包围盒触碰车道线/路缘线少于 `1s`，无交通冲突。 | 同一 lane boundary `6s`。 | 中：轻微压线，请小幅修正。EN: You touched the line, steer gently back. |
| `lane.line_straddle` | major | -5 | 车身跨越车道线或骑线持续 `1s+`。 | 同一 boundary `8s`；持续 `4s` 可再次扣分。 | 中：不要长时间骑线。EN: Do not straddle the lane line. |
| `lane.wrong_side_entry` | dangerous | -10 | 无超车/避让/右转理由时，进入对向车道超过 `2s`。 | 同一 wrong-side episode 只扣一次。 | 中：已进入对向车道，请立即回到左侧。EN: You are on the wrong side, return left now. |
| `lane.turn_wrong_lane` | major | -5 | 左转/右转完成后 `30m` 内未进入目标道路左侧车道。 | 每个 junction/exit 一次。 | 中：转弯后进入左侧车道。EN: Finish the turn into the left lane. |
| `lane.no_entry_or_reverse_direction` | dangerous | -10 | 进入 No Entry 区域或沿 lane direction 反向行驶超过 `1s`。 | 每个 no-entry zone 一次；可 instant fail。 | 中：禁止进入或逆向行驶。EN: No entry or wrong-way driving. |

### 4.2 Speed Limit

SpeedLimitRule 应以当前 lane 或 zone 的 `speedLimitMph` 为准，并支持进入新限速区后 `2s` 宽限用于自然减速，但学校区、停车场和减速带前不享受宽限。

| ruleId | Severity | Points | Trigger condition | Cooldown / dedupe | Prompt summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `speed.limit.minor` | minor | -3 | `speedMph > limit + 3` 且 `<= limit + 7`，持续 `1s`。 | 同一 speed zone `8s`；降回 `limit + 1` 后重置。 | 中：当前限速 {limit} mph，请减速。EN: Limit is {limit} mph, slow down. |
| `speed.limit.major` | major | -5 | `speedMph > limit + 7` 且 `<= limit + 10`，持续 `1s`。 | 同一 speed zone `8s`；若已触发 minor，升级为 major 时只补记 major，不重复 minor。 | 中：明显超速，请立即减速。EN: You are well over the limit, slow down now. |
| `speed.limit.dangerous` | dangerous | -10 | `speedMph > limit + 10`，或 20 mph 学校/住宅区达到 `30 mph+`。 | 同一 speed zone 一次；学校区 dangerous 可 instant fail。 | 中：严重超速。EN: Dangerous speeding. |
| `speed.hazard_approach_fast` | major | -5 | 接近 Give Way、Stop、环岛、斑马线、减速带、停车场入口前的 hazard zone，速度高于该 zone 建议速度 `+5 mph`。 | 每个 hazard zone 一次。 | 中：危险点前应提前减速。EN: Slow down before the hazard. |
| `speed.parking_too_fast` | major | -5 | 停车场或倒车训练中速度超过 `12 mph`；倒车超过 `5 mph`。 | 每个 parking zone `6s`。 | 中：停车场保持步行速度。EN: Keep walking pace in the car park. |

QA-002 对 `SpeedLimitRule` 至少覆盖：

* 20 mph zone: 22 mph 不扣分，24 mph 触发 `speed.limit.minor`，28 mph 触发 `speed.limit.major`，31 mph 触发 `speed.limit.dangerous`。
* 30 mph zone: 33 mph 不扣分或仅边界不触发，34 mph 触发 minor，38 mph 触发 major，41 mph 触发 dangerous。
* 同一限速区冷却内不重复扣分。
* 新限速区可重新触发。
* 降速回 `limit + 1` 后再次超速可重新触发。

### 4.3 Give Way and Stop

| ruleId | Severity | Points | Trigger condition | Cooldown / dedupe | Prompt summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `give_way.approach_too_fast` | major | -5 | Give Way 线前 `15m` 内速度高于 `10 mph`，且前方存在冲突区或视野受限。 | 每个 junction approach 一次。 | 中：Give Way 前请准备停车观察。EN: Prepare to stop and look at Give Way. |
| `give_way.line_roll_through` | major | -5 | 有 Give Way 标线且视线/间隙不足时，未低速或未停车即越过线。 | 每个 junction 一次。 | 中：间隙不足时不要抢行。EN: Do not roll through without a safe gap. |
| `give_way.fail_priority` | dangerous | -10 | 进入 conflict zone 时主路车辆 TTC 小于安全阈值，导致 NPC 急刹、避让或碰撞。 | 每个 conflict event 一次；instant fail。 | 中：未让主路车辆先行。EN: You failed to give way to priority traffic. |
| `stop.no_full_stop` | dangerous | -10 | Stop 标志/停止线前未达到 `speedMph <= 0.5` 并保持至少 `1s` 即越线。 | 每个 stop junction 一次；instant fail 可配置。 | 中：Stop 标志必须完全停车。EN: You must make a full stop at STOP. |
| `stop.observation_missing` | major | -5 | Stop/Give Way 后起步前 `3s` 内无左/右或对应盲区观察事件。 | 每个 junction 一次。 | 中：起步前观察左右和盲区。EN: Check both ways and blind spots before moving. |

### 4.4 Roundabout

| ruleId | Severity | Points | Trigger condition | Cooldown / dedupe | Prompt summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `roundabout.entry_too_fast` | major | -5 | 环岛入口前 `15m` 内速度高于 `15 mph`。 | 每个 roundabout entry 一次。 | 中：进入环岛前减速。EN: Slow down before entering the roundabout. |
| `roundabout.fail_give_right` | dangerous | -10 | 右侧或环岛内车辆有优先权，玩家进入 conflict zone 导致 TTC 低于安全阈值、NPC 急刹或碰撞。 | 每次 entry conflict 一次；instant fail。 | 中：进入环岛前让右侧来车。EN: Give way to traffic from the right. |
| `roundabout.wrong_signal_first_exit` | minor | -3 | 第一出口任务未在入口前打左灯。 | 每个 roundabout task 一次。 | 中：第一出口请提前打左灯。EN: Signal left for the first exit. |
| `roundabout.wrong_signal_straight` | minor | -3 | 第二出口直行任务入口前错误打右灯，或过第一出口后未打左灯离开。 | 每个 roundabout task 一次。 | 中：直行通常入口不打灯，离开前打左灯。EN: No signal on entry for straight ahead, signal left to exit. |
| `roundabout.wrong_signal_right` | minor | -3 | 第三出口/右转任务入口前未打右灯，或离开前未改左灯。 | 每个 roundabout task 一次。 | 中：右转先右灯，离开前改左灯。EN: Signal right on entry, then left to exit. |
| `roundabout.wrong_exit` | major | -5 | 从非导航指定出口离开，且 `10s` 内未回到修正路线。 | 每个 roundabout task 一次。 | 中：出口选择错误，请按导航修正。EN: Wrong exit, follow the route to recover. |
| `roundabout.lane_cutting` | major | -5 | 环岛内明显切线、压中心岛或挤压相邻车辆。 | 每次 roundabout pass 一次。 | 中：环岛内保持正确位置。EN: Hold a steady position on the roundabout. |

### 4.5 Indicators and MSM Observation

| ruleId | Severity | Points | Trigger condition | Cooldown / dedupe | Prompt summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `msm.no_signal_turn` | major | -5 | 转弯、并线、出环岛、驶离停车位前未在动作前 `1s` 打对应转向灯。 | 每个 manoeuvre 一次。 | 中：动作前先观察、打灯、再操作。EN: Mirror, signal, then manoeuvre. |
| `msm.signal_late` | minor | -3 | 转向灯在动作开始后才开启，或提示距离少于 `1s`。 | 每个 manoeuvre 一次。 | 中：转向灯打得太晚。EN: Signal earlier. |
| `msm.signal_not_cancelled` | minor | -3 | 转弯或出环岛完成后 `5s` 仍未取消转向灯。 | 每个 manoeuvre 一次。 | 中：完成后取消转向灯。EN: Cancel the signal after the manoeuvre. |
| `observation.mirror_missing` | major | -5 | 起步、转弯、并线、避让停放车辆前缺少相关镜面观察事件。 | 每个 required observation zone 一次。 | 中：动作前检查后视镜和侧镜。EN: Check mirrors before moving. |
| `observation.blindspot_missing` | major | -5 | 起步、倒车、停车场转向或低速挪车前缺少盲区观察事件。 | 每个 blindspot-required zone 一次。 | 中：检查盲区后再移动。EN: Check the blind spot before moving. |
| `observation.move_without_check_danger` | dangerous | -10 | 无观察直接起步/倒车，并导致行人/NPC TTC 低于安全阈值或对方急刹。 | 每个 conflict event 一次；instant fail 可配置。 | 中：未观察就移动造成危险。EN: Moving without observation created danger. |

### 4.6 Pedestrians and Zebra Crossing

| ruleId | Severity | Points | Trigger condition | Cooldown / dedupe | Prompt summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `zebra.approach_no_slow` | major | -5 | 斑马线前 `40m` 内有等待或接近行人，玩家未明显减速或覆盖刹车。 | 每个 crossing approach 一次。 | 中：斑马线前观察两侧行人并准备停车。EN: Look for pedestrians and be ready to stop. |
| `zebra.fail_waiting_pedestrian` | dangerous | -10 | 行人已在等待并朝向斑马线，玩家未让行且穿越 crossing conflict zone。 | 每个 pedestrian/crossing event 一次。 | 中：斑马线有行人等待，应停车让行。EN: Stop for pedestrians waiting at the zebra crossing. |
| `zebra.fail_crossing_pedestrian` | dangerous | -10 | 行人已进入斑马线，玩家未停车让行、迫使行人停步/退让或发生碰撞。 | 每个 pedestrian/crossing event 一次；instant fail。 | 中：行人已在斑马线上，必须停车。EN: Pedestrians on the crossing have priority. |
| `zebra.block_crossing` | major | -5 | 车辆停在斑马线区域内超过 `3s`，阻碍行人通行。 | 每个 crossing 一次。 | 中：不要停在斑马线上。EN: Do not stop on the crossing. |
| `pedestrian.restart_too_early` | dangerous | -10 | 行人未完全离开本车路径或 crossing zone 即起步。 | 每个 restart event 一次。 | 中：等行人完全通过后再起步。EN: Wait until pedestrians have fully crossed. |

### 4.7 Parking Training

| ruleId | Severity | Points | Trigger condition | Cooldown / dedupe | Prompt summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `parking.entry_no_give_way` | dangerous | -10 | 停车场入口未让横向车辆或行人，导致冲突或急刹。 | 每个 carpark entry 一次；instant fail。 | 中：停车场入口先让行。EN: Give way at the car park entrance. |
| `parking.reverse_setup_poor` | minor | -3 | 未驶过目标车位或停车角度明显不适合倒车，但未造成冲突。 | 每次 parking attempt 一次。 | 中：先摆好倒车起点。EN: Set up the reverse position first. |
| `parking.reverse_no_observation` | dangerous | -10 | 挂 R 后移动超过 `1s` 但没有后方/侧镜/盲区观察事件。 | 每次 reverse episode 一次；instant fail。 | 中：倒车前观察后方和两侧盲区。EN: Look behind and check mirrors before reversing. |
| `parking.bay_line_touch` | minor | -3 | 停车过程中轻触车位线或短时跨线，最终可修正。 | 每次 parking attempt `6s`。 | 中：车位线内小幅修正。EN: Adjust gently inside the bay lines. |
| `parking.final_misaligned` | major | -5 | 结束时四轮在目标车位内，但车身角度超过 `10°` 或横向偏离超过配置阈值。 | 每次 final assessment 一次。 | 中：车身未摆正。EN: The car is not aligned in the bay. |
| `parking.outside_target_bay` | dangerous | -10 | 结束时任一车轮不在目标车位内，或停入错误车位超过 `15s` 未修正。 | 每次 final assessment 一次；可 instant fail。 | 中：未停入指定车位。EN: You are outside the target bay. |
| `parking.collision` | dangerous | -10 | 碰撞行人、NPC、购物车、护栏、停放车辆或路缘。 | 每个 collision object 一次；instant fail。 | 中：停车训练发生碰撞。EN: Collision during parking. |

## 5. RuleEngine Implementation Notes

* 每条 `DrivingRule` 只负责判断当前帧是否产生候选 fault，不直接累加分数。
* Scoring 层负责 `dedupeKey`、冷却、严重度升级和结算。
* `SpeedLimitRule` 输入应至少包含：
  * `ctx.time`
  * `ctx.vehicle.speedMph`
  * `ctx.currentLane.speedLimitMph`
  * `ctx.currentZone?.speedLimitMph`
  * `ctx.currentZone?.id`
  * `ctx.levelId`
  * `ctx.vehicle.position`
* QA-002 应通过构造 deterministic `DrivingContext` 验证规则输出，而不是依赖真实 Three.js/Rapier 场景。
* 对连续违规，测试应覆盖：首次触发、冷却内不重复、冷却后仍违规再次触发、恢复正常后再次触发。

## 6. Minimum QA-002 Test Matrix

| Area | Required cases |
| :--- | :--- |
| SpeedLimitRule | 20/30 mph 边界、minor/major/dangerous 升级、冷却、换 zone 重置、降速恢复后重触发。 |
| Lane discipline | 靠左偏移、短时压线、持续骑线、逆行 dangerous、转弯进错车道。 |
| Give Way / Stop | Give Way 接近过快、间隙不足抢行、Stop 未完全停车、停车后未观察。 |
| Roundabout | 未让右 dangerous、入口过快、第一/第二/第三出口打灯规则、错出口。 |
| Zebra | 有行人等待未减速、行人已进入未让行、停在斑马线内、行人未离开就起步。 |
| Observation | 起步未看镜、倒车未看盲区、未观察导致冲突 dangerous。 |
| Parking | 停车场入口未让行、倒车未观察、车位线触碰、最终未入位、碰撞 instant fail。 |
