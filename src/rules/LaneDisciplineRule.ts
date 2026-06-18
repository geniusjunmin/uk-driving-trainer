import type { DrivingContext, DrivingFault, DrivingRule } from './RuleEngine';
import type { Vector3Like } from '../road/RoadTypes';

interface ProjectionResult {
  readonly distance: number;
  readonly heading: Vector3Like;
}

function projectToCenterLine(point: Vector3Like, centerLine: readonly Vector3Like[]): ProjectionResult | null {
  if (centerLine.length < 2) return null;
  let minDistance = Infinity;
  let bestHeading = { x: 0, y: 0, z: 1 };

  for (let i = 0; i < centerLine.length - 1; i++) {
    const p1 = centerLine[i];
    const p2 = centerLine[i + 1];

    const abX = p2.x - p1.x;
    const abY = p2.y - p1.y;
    const abZ = p2.z - p1.z;
    const abLengthSq = abX * abX + abY * abY + abZ * abZ;
    const abLength = Math.sqrt(abLengthSq);

    if (abLength < 1e-6) continue;

    const apX = point.x - p1.x;
    const apY = point.y - p1.y;
    const apZ = point.z - p1.z;

    let t = (apX * abX + apY * abY + apZ * abZ) / abLengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = p1.x + t * abX;
    const projY = p1.y + t * abY;
    const projZ = p1.z + t * abZ;

    const dx = point.x - projX;
    const dy = point.y - projY;
    const dz = point.z - projZ;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < minDistance) {
      minDistance = distance;
      bestHeading = { x: abX / abLength, y: abY / abLength, z: abZ / abLength };
    }
  }

  if (minDistance === Infinity) return null;
  return { distance: minDistance, heading: bestHeading };
}

export class LaneDisciplineRule implements DrivingRule {
  readonly id = 'LaneDisciplineRule';
  readonly category = 'lane';

  private driftStartSeconds: number | null = null;
  private lineTouchStartSeconds: number | null = null;
  private wrongSideStartSeconds: number | null = null;
  private reverseDirectionStartSeconds: number | null = null;
  private noEntryStartSeconds: number | null = null;

  private lastDriftTriggerTime = -9999;
  private lastLineTouchTriggerTime = -9999;
  private lastStraddleTriggerTime = -9999;
  private lastReverseDirectionTriggerTime = -9999;

  private hasTriggeredWrongSide = false;
  private readonly triggeredWrongTurnLanes = new Set<string>();

  evaluate(context: DrivingContext): DrivingFault | null {
    const lane = context.currentLane;
    if (!lane) {
      return null;
    }

    const position = context.vehiclePose.position;
    const proj = projectToCenterLine(position, lane.centerLine);
    if (!proj) {
      return null;
    }

    const yawRad = (context.vehiclePose.yawDegrees * Math.PI) / 180;
    const carHeading = { x: Math.sin(yawRad), y: 0, z: Math.cos(yawRad) };
    const dot = carHeading.x * proj.heading.x + carHeading.z * proj.heading.z;

    // 1. Check wrong side entry and reverse direction
    if (dot < 0 && context.gear === 'drive') {
      if (lane.oppositeLaneId) {
        // Opposing lane on a two-way road
        if (this.wrongSideStartSeconds === null) {
          this.wrongSideStartSeconds = context.timeSeconds;
        }
        if (context.timeSeconds - this.wrongSideStartSeconds >= 2.0 && !this.hasTriggeredWrongSide) {
          this.hasTriggeredWrongSide = true;
          return {
            id: `lane.wrong_side_entry-${context.timeSeconds}`,
            ruleId: 'lane.wrong_side_entry',
            severity: 'dangerous',
            message: '逆行危险！请立即驶回左侧行车道。 (You are on the wrong side, return left now.)',
            occurredAtSeconds: context.timeSeconds,
            laneId: lane.id,
            evidence: { yawDegrees: context.vehiclePose.yawDegrees, dotProduct: dot },
          };
        }
      } else {
        // One-way road or expected lane reverse driving
        if (this.reverseDirectionStartSeconds === null) {
          this.reverseDirectionStartSeconds = context.timeSeconds;
        }
        if (context.timeSeconds - this.reverseDirectionStartSeconds >= 1.0 && context.timeSeconds - this.lastReverseDirectionTriggerTime >= 8.0) {
          this.lastReverseDirectionTriggerTime = context.timeSeconds;
          return {
            id: `lane.no_entry_or_reverse_direction-${context.timeSeconds}`,
            ruleId: 'lane.no_entry_or_reverse_direction',
            severity: 'dangerous',
            message: '禁止进入或逆向行驶。 (No entry or wrong-way driving.)',
            occurredAtSeconds: context.timeSeconds,
            laneId: lane.id,
            evidence: { yawDegrees: context.vehiclePose.yawDegrees, dotProduct: dot },
          };
        }
      }
    } else {
      // Reset episode state when back in correct direction or reversing
      this.wrongSideStartSeconds = null;
      this.reverseDirectionStartSeconds = null;
      this.hasTriggeredWrongSide = false;
    }

    // 2. Check No Entry tag
    if (lane.tags?.some(tag => tag.toLowerCase() === 'no-entry')) {
      if (this.noEntryStartSeconds === null) {
        this.noEntryStartSeconds = context.timeSeconds;
      }
      if (context.timeSeconds - this.noEntryStartSeconds >= 1.0) {
        // Resets quickly to prevent spamming
        this.noEntryStartSeconds = -9999; 
        return {
          id: `lane.no_entry_or_reverse_direction-${context.timeSeconds}`,
          ruleId: 'lane.no_entry_or_reverse_direction',
          severity: 'dangerous',
          message: '禁止进入或逆向行驶。 (No entry or wrong-way driving.)',
          occurredAtSeconds: context.timeSeconds,
          laneId: lane.id,
        };
      }
    } else {
      this.noEntryStartSeconds = null;
    }

    // 3. Check turn wrong lane tag
    if (lane.tags?.some(tag => tag.toLowerCase() === 'wrong-turn-lane')) {
      if (!this.triggeredWrongTurnLanes.has(lane.id)) {
        this.triggeredWrongTurnLanes.add(lane.id);
        return {
          id: `lane.turn_wrong_lane-${context.timeSeconds}`,
          ruleId: 'lane.turn_wrong_lane',
          severity: 'serious',
          message: '转弯后未进入目标车道。 (Finish the turn into the left lane.)',
          occurredAtSeconds: context.timeSeconds,
          laneId: lane.id,
        };
      }
    }

    // 4. Check lane boundaries (touch and straddle)
    const carWidth = 1.8;
    const halfLaneWidth = lane.widthMeters / 2;
    const touchThreshold = halfLaneWidth - carWidth / 2; // Wheels touch the lane boundary line

    if (proj.distance >= touchThreshold) {
      if (context.indicator !== 'off') {
        // Player is signaling a lane change or turn, no violation
        this.lineTouchStartSeconds = null;
      } else {
        if (this.lineTouchStartSeconds === null) {
          this.lineTouchStartSeconds = context.timeSeconds;
        }

        const touchDuration = context.timeSeconds - this.lineTouchStartSeconds;

        if (touchDuration >= 1.0) {
          // Line Straddling (sustained >= 1s)
          if (context.timeSeconds - this.lastStraddleTriggerTime >= 8.0) {
            this.lastStraddleTriggerTime = context.timeSeconds;
            this.lastLineTouchTriggerTime = context.timeSeconds; // Cooldown touch too
            return {
              id: `lane.line_straddle-${context.timeSeconds}`,
              ruleId: 'lane.line_straddle',
              severity: 'serious',
              message: '请勿骑线行驶。 (Do not straddle the lane line.)',
              occurredAtSeconds: context.timeSeconds,
              laneId: lane.id,
              evidence: { distanceToCenter: proj.distance, threshold: touchThreshold },
            };
          }
        } else {
          // Line Touching (< 1s)
          if (context.timeSeconds - this.lastLineTouchTriggerTime >= 6.0) {
            this.lastLineTouchTriggerTime = context.timeSeconds;
            return {
              id: `lane.line_touch-${context.timeSeconds}`,
              ruleId: 'lane.line_touch',
              severity: 'minor',
              message: '您的车轮轻触车道线，请小幅修正方向。 (You touched the line, steer gently back.)',
              occurredAtSeconds: context.timeSeconds,
              laneId: lane.id,
              evidence: { distanceToCenter: proj.distance, threshold: touchThreshold },
            };
          }
        }
      }
      this.driftStartSeconds = null;
    } else {
      this.lineTouchStartSeconds = null;

      // 5. Check keep left drift
      const driftThreshold = lane.widthMeters * 0.35;
      if (proj.distance > driftThreshold) {
        if (this.driftStartSeconds === null) {
          this.driftStartSeconds = context.timeSeconds;
        }
        if (context.timeSeconds - this.driftStartSeconds >= 1.5) {
          if (context.timeSeconds - this.lastDriftTriggerTime >= 8.0) {
            this.lastDriftTriggerTime = context.timeSeconds;
            return {
              id: `lane.keep_left.drift-${context.timeSeconds}`,
              ruleId: 'lane.keep_left.drift',
              severity: 'minor',
              message: '您正在偏离车道，请保持在左侧行车道中央。 (Keep centred in the left lane.)',
              occurredAtSeconds: context.timeSeconds,
              laneId: lane.id,
              evidence: { distanceToCenter: proj.distance, threshold: driftThreshold },
            };
          }
        }
      } else {
        this.driftStartSeconds = null;
      }
    }

    return null;
  }
}
