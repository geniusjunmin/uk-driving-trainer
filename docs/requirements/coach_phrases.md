# AI Coach Bilingual Phrase Library

This document defines HUD-friendly bilingual phrase content for the AI coach. Each phrase is short enough for the cockpit HUD and can also be spoken by a voice layer. Phrases are grouped by trigger type so Backend, Frontend, QA, and Documentation can map them directly to route zones and scoring rules.

Priority guidance:

* `P0`: safety-critical, may interrupt lower-priority coach text.
* `P1`: active correction or required manoeuvre guidance.
* `P2`: route guidance, success feedback, or low-risk reinforcement.

Cooldown values are recommended minimum repeat intervals for the same `phraseId`.

---

## Route Guidance

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.route.start_l1` | `route_guidance.level_1_start` | P2 | 8s | 检查后视镜，打右灯，安全起步。 | Check mirrors, signal right, move off safely. | `msm.no_signal_turn` |
| `coach.route.keep_left` | `route_guidance.keep_left_section` | P2 | 10s | 沿左侧车道继续前进。 | Continue in the left lane. | `lane.keep_left.drift` |
| `coach.route.stop_box` | `route_guidance.destination_stop_box` | P2 | 8s | 前方终点，靠左减速停车。 | Destination ahead, slow and stop left. | `stop-observe` |
| `coach.route.turn_right_main` | `route_guidance.right_turn_main_road` | P1 | 8s | 前方右转进入主路。 | Turn right onto the main road ahead. | `give_way.approach_too_fast` |
| `coach.route.roundabout_second` | `route_guidance.roundabout_second_exit` | P1 | 8s | 环岛第二出口直行。 | At the roundabout, take the second exit. | `roundabout.wrong_exit` |
| `coach.route.carpark_entry` | `route_guidance.carpark_entry` | P2 | 8s | 驶入停车场，保持步行速度。 | Enter the car park at walking pace. | `speed.parking_too_fast` |

## Speed Warning

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.speed.limit_20` | `speed_warning.over_20_zone` | P1 | 8s | 当前限速 20 mph，请减速。 | Limit is 20 mph, slow down. | `speed.limit.minor` |
| `coach.speed.limit_30` | `speed_warning.over_30_zone` | P1 | 8s | 当前限速 30 mph，请减速。 | Limit is 30 mph, slow down. | `speed.limit.minor` |
| `coach.speed.major` | `speed_warning.major_overspeed` | P0 | 8s | 明显超速，立即减速。 | Well over the limit, slow down now. | `speed.limit.major` |
| `coach.speed.dangerous` | `speed_warning.dangerous_overspeed` | P0 | 12s | 严重超速，危险。 | Dangerous speeding. | `speed.limit.dangerous` |
| `coach.speed.hazard` | `speed_warning.hazard_approach_fast` | P1 | 8s | 危险点前先减速。 | Slow before the hazard. | `speed.hazard_approach_fast` |
| `coach.speed.hump` | `speed_warning.speed_hump_fast` | P1 | 8s | 减速带前减速。 | Slow for the speed hump. | `speed.hazard_approach_fast` |

## Lane Discipline

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.lane.center` | `lane_discipline.drift_left_lane` | P1 | 8s | 回到左侧车道中央。 | Centre in the left lane. | `lane.keep_left.drift` |
| `coach.lane.line_touch` | `lane_discipline.line_touch` | P1 | 6s | 轻触车道线，小幅修正。 | Line touched, steer gently back. | `lane.line_touch` |
| `coach.lane.straddle` | `lane_discipline.line_straddle` | P1 | 8s | 不要骑线行驶。 | Do not straddle the line. | `lane.line_straddle` |
| `coach.lane.wrong_side` | `lane_discipline.wrong_side_entry` | P0 | 10s | 逆行危险，立即回左侧。 | Wrong side, return left now. | `lane.wrong_side_entry` |
| `coach.lane.after_turn` | `lane_discipline.turn_wrong_lane` | P1 | 8s | 转弯后进入左侧车道。 | Finish the turn into the left lane. | `lane.turn_wrong_lane` |
| `coach.lane.no_entry` | `lane_discipline.no_entry` | P0 | 12s | 禁止驶入，请修正路线。 | No entry, correct your route. | `lane.no_entry_or_reverse_direction` |

## Give Way / Stop

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.giveway.prepare` | `give_way_stop.approach_give_way` | P1 | 8s | 前方让行，准备停车观察。 | Give Way ahead, prepare to stop. | `give_way.approach_too_fast` |
| `coach.giveway.safe_gap` | `give_way_stop.no_safe_gap` | P0 | 8s | 间隙不足，等待。 | Unsafe gap, wait. | `give_way.line_roll_through` |
| `coach.giveway.priority` | `give_way_stop.failed_priority` | P0 | 12s | 必须让主路车辆先行。 | Give way to priority traffic. | `give_way.fail_priority` |
| `coach.stop.full_stop` | `give_way_stop.stop_sign` | P0 | 12s | STOP 标志前完全停稳。 | Make a full stop at STOP. | `stop.no_full_stop` |
| `coach.stop.look_both` | `give_way_stop.observation_missing` | P1 | 8s | 起步前左右观察。 | Check both ways before moving. | `stop.observation_missing` |

## Roundabout

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.roundabout.prepare` | `roundabout.approach` | P1 | 8s | 前方环岛，减速看右侧。 | Roundabout ahead, slow and look right. | `roundabout.entry_too_fast` |
| `coach.roundabout.give_right` | `roundabout.traffic_from_right` | P0 | 8s | 让右侧来车先行。 | Give way to traffic from the right. | `roundabout.fail_give_right` |
| `coach.roundabout.first_exit` | `roundabout.first_exit_route` | P1 | 8s | 第一出口，提前打左灯。 | First exit, signal left early. | `roundabout.wrong_signal_first_exit` |
| `coach.roundabout.straight` | `roundabout.second_exit_route` | P1 | 8s | 直行，驶出前打左灯。 | Straight ahead, signal left to exit. | `roundabout.wrong_signal_straight` |
| `coach.roundabout.right_exit` | `roundabout.third_exit_route` | P1 | 8s | 第三出口，先右灯再左灯。 | Third exit, right then left signal. | `roundabout.wrong_signal_right` |
| `coach.roundabout.wrong_exit` | `roundabout.wrong_exit` | P1 | 10s | 出口错误，按导航修正。 | Wrong exit, follow the route. | `roundabout.wrong_exit` |
| `coach.roundabout.position` | `roundabout.lane_cutting` | P1 | 8s | 环岛内保持稳定位置。 | Hold position on the roundabout. | `roundabout.lane_cutting` |

## Zebra Crossing

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.zebra.prepare` | `zebra_crossing.approach` | P1 | 8s | 前方斑马线，准备停车。 | Zebra crossing ahead, prepare to stop. | `zebra.approach_no_slow` |
| `coach.zebra.waiting` | `zebra_crossing.pedestrian_waiting` | P0 | 8s | 行人等待，停车让行。 | Pedestrian waiting, stop and give way. | `zebra.fail_waiting_pedestrian` |
| `coach.zebra.crossing` | `zebra_crossing.pedestrian_on_crossing` | P0 | 10s | 行人已上斑马线，立即停车。 | Pedestrian on crossing, stop now. | `zebra.fail_crossing_pedestrian` |
| `coach.zebra.clear` | `zebra_crossing.vehicle_blocking` | P1 | 8s | 不要停在斑马线上。 | Do not stop on the crossing. | `zebra.block_crossing` |
| `coach.zebra.restart` | `zebra_crossing.restart_too_early` | P0 | 10s | 等行人完全通过再起步。 | Wait until pedestrians fully cross. | `pedestrian.restart_too_early` |

## Mirror / Blind Spot

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.msm.sequence` | `mirror_blind_spot.msm_required` | P1 | 8s | 先看镜，打灯，再动作。 | Mirror, signal, manoeuvre. | `msm.no_signal_turn` |
| `coach.msm.signal_early` | `mirror_blind_spot.late_signal` | P1 | 8s | 转向灯要更早。 | Signal earlier. | `msm.signal_late` |
| `coach.msm.cancel` | `mirror_blind_spot.signal_not_cancelled` | P2 | 8s | 动作完成，关闭转向灯。 | Manoeuvre done, cancel signal. | `msm.signal_not_cancelled` |
| `coach.observe.mirrors` | `mirror_blind_spot.mirror_missing` | P1 | 8s | 动作前检查后视镜。 | Check mirrors before moving. | `observation.mirror_missing` |
| `coach.observe.blindspot` | `mirror_blind_spot.blindspot_missing` | P1 | 8s | 移动前检查盲区。 | Check blind spot before moving. | `observation.blindspot_missing` |
| `coach.observe.danger` | `mirror_blind_spot.move_without_check` | P0 | 12s | 未观察就移动，危险。 | Moving without looking is dangerous. | `observation.move_without_check_danger` |

## Parking

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.parking.entry` | `parking.carpark_entry_give_way` | P0 | 10s | 停车场入口先让行。 | Give way at the car park entrance. | `parking.entry_no_give_way` |
| `coach.parking.walking_pace` | `parking.too_fast` | P1 | 6s | 停车场保持步行速度。 | Keep walking pace in the car park. | `speed.parking_too_fast` |
| `coach.parking.setup` | `parking.reverse_setup_poor` | P1 | 8s | 先摆好倒车起点。 | Set up the reverse position first. | `parking.reverse_setup_poor` |
| `coach.parking.look_back` | `parking.reverse_no_observation` | P0 | 10s | 倒车前看后方和两侧。 | Look behind and check both sides. | `parking.reverse_no_observation` |
| `coach.parking.line_touch` | `parking.bay_line_touch` | P1 | 6s | 触碰车位线，小幅修正。 | Bay line touched, adjust gently. | `parking.bay_line_touch` |
| `coach.parking.align` | `parking.final_misaligned` | P1 | 8s | 车身未摆正，请对齐。 | Car not aligned, straighten up. | `parking.final_misaligned` |
| `coach.parking.outside` | `parking.outside_target_bay` | P0 | 10s | 未停入目标车位。 | Outside the target bay. | `parking.outside_target_bay` |
| `coach.parking.collision` | `parking.collision` | P0 | 12s | 停车碰撞，训练失败。 | Parking collision, training failed. | `parking.collision` |

## Success / Failure Summary

| phraseId | trigger | priority | cooldown | messageZh | messageEn | relatedRuleId |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `coach.summary.level_start` | `success_failure_summary.level_start` | P2 | 20s | 按导航行驶，安全第一。 | Follow the route, safety first. | `level.start` |
| `coach.summary.pass` | `success_failure_summary.level_pass` | P2 | 30s | 通关成功，习惯很好。 | Level passed, good habits. | `level.pass` |
| `coach.summary.fail_score` | `success_failure_summary.score_fail` | P1 | 30s | 分数不足，再练一次。 | Score too low, try again. | `level.fail.score` |
| `coach.summary.fail_critical` | `success_failure_summary.instant_fail` | P0 | 30s | 触发危险错误，训练失败。 | Critical fault, training failed. | `level.fail.instant` |
| `coach.summary.score_warning` | `success_failure_summary.score_warning` | P1 | 15s | 分数下降，稳住车速和位置。 | Score dropping, steady speed and position. | `score.warning` |
| `coach.summary.best_fault` | `success_failure_summary.review_primary_fault` | P2 | 30s | 复盘最大错误，再试一次。 | Review the main fault and retry. | `review.primary_fault` |

---

## Implementation Notes

* HUD should display one phrase at a time, choosing the highest priority phrase whose cooldown has expired.
* `P0` phrases should override route guidance immediately.
* `P1` phrases may override `P2` route hints for 5 seconds.
* `relatedRuleId` values map to `docs/requirements/scoring_rules.md`; route and summary IDs are product-level pseudo-rules for non-fault states.
