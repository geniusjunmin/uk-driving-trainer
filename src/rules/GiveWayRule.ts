import type { DrivingContext, DrivingFault, DrivingRule } from './RuleEngine';
import type { Vector3Like } from '../road/RoadTypes';

function distance(p1: Vector3Like, p2: Vector3Like): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
}

function getRemainingDistance(point: Vector3Like, centerLine: readonly Vector3Like[]): number {
  if (centerLine.length < 2) return 0;
  let minDistance = Infinity;
  let closestSegmentIndex = 0;
  let projectionT = 0;

  for (let i = 0; i < centerLine.length - 1; i++) {
    const p1 = centerLine[i];
    const p2 = centerLine[i + 1];

    const abX = p2.x - p1.x;
    const abY = p2.y - p1.y;
    const abZ = p2.z - p1.z;
    const abLengthSq = abX * abX + abY * abY + abZ * abZ;
    if (abLengthSq < 1e-6) continue;

    const apX = point.x - p1.x;
    const apY = point.y - p1.y;
    const apZ = point.z - p1.z;

    let t = (apX * abX + apY * abY + apZ * abZ) / abLengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = p1.x + t * abX;
    const projY = p1.y + t * abY;
    const projZ = p1.z + t * abZ;

    const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2 + (point.z - projZ) ** 2);
    if (dist < minDistance) {
      minDistance = dist;
      closestSegmentIndex = i;
      projectionT = t;
    }
  }

  let remainingDist = 0;
  const p1 = centerLine[closestSegmentIndex];
  const p2 = centerLine[closestSegmentIndex + 1];
  const segLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2);
  remainingDist += (1 - projectionT) * segLength;

  for (let i = closestSegmentIndex + 1; i < centerLine.length - 1; i++) {
    const pa = centerLine[i];
    const pb = centerLine[i + 1];
    remainingDist += Math.sqrt((pb.x - pa.x) ** 2 + (pb.y - pa.y) ** 2 + (pb.z - pa.z) ** 2);
  }

  return remainingDist;
}

export class GiveWayRule implements DrivingRule {
  readonly id = 'GiveWayRule';
  readonly category = 'give_way';

  // State trackers
  private stoppedStartTime: number | null = null;
  private hasStoppedAtJunction = false;
  private isCurrentlyStopped = false;
  private wasStopped = false;

  private lastLeftMirrorCheckTime = -9999;
  private lastRightMirrorCheckTime = -9999;
  private lastBlindSpotCheckTime = -9999;

  // Trigger cooldown trackers
  private readonly triggeredApproachTooFast = new Set<string>();
  private readonly triggeredLineRollThrough = new Set<string>();
  private readonly triggeredFailPriority = new Set<string>();
  private readonly triggeredNoFullStop = new Set<string>();
  private readonly triggeredObservationMissing = new Set<string>();

  evaluate(context: DrivingContext): DrivingFault | null {
    const lane = context.currentLane;
    if (!lane) {
      this.resetJunctionState();
      return null;
    }

    const priorityRules = context.priorityRules || [];
    // Find if the current lane is controlled by a give-way or stop priority rule
    const rule = priorityRules.find(
      (r) =>
        (r.type === 'give-way' || r.type === 'stop') &&
        r.controlledLaneIds.includes(lane.id)
    );

    // Track observation times
    if (context.observation) {
      if (context.observation.checkedLeftMirror) {
        this.lastLeftMirrorCheckTime = context.timeSeconds;
      }
      if (context.observation.checkedRightMirror) {
        this.lastRightMirrorCheckTime = context.timeSeconds;
      }
      if (context.observation.checkedBlindSpot) {
        this.lastBlindSpotCheckTime = context.timeSeconds;
      }
    }

    if (!rule) {
      // If we are no longer on a controlled lane, reset our stopped/junction state
      this.resetJunctionState();
      return null;
    }

    const position = context.vehiclePose.position;
    const laneEnd = lane.centerLine[lane.centerLine.length - 1];
    const distToLine = distance(position, laneEnd);

    // Track vehicle stopping behaviour near the junction line (within 8 meters)
    const isNearJunction = distToLine <= 8.0;
    this.isCurrentlyStopped = context.speedMph <= 0.5;

    if (isNearJunction && this.isCurrentlyStopped) {
      if (this.stoppedStartTime === null) {
        this.stoppedStartTime = context.timeSeconds;
      }
      if (context.timeSeconds - this.stoppedStartTime >= 1.0) {
        this.hasStoppedAtJunction = true;
      }
    }

    // 1. Give Way Approach Too Fast (within 15m, speed > 10 mph)
    if (distToLine <= 15.0 && context.speedMph > 10.0) {
      const key = `${rule.id}-${lane.id}`;
      if (!this.triggeredApproachTooFast.has(key)) {
        this.triggeredApproachTooFast.add(key);
        return {
          id: `give_way.approach_too_fast-${context.timeSeconds}`,
          ruleId: 'give_way.approach_too_fast',
          severity: 'serious',
          message: 'Give Way 前请准备停车观察。 (Prepare to stop and look at Give Way.)',
          occurredAtSeconds: context.timeSeconds,
          laneId: lane.id,
          evidence: { speedMph: context.speedMph, distanceToLine: distToLine }
        };
      }
    }

    // Check priority vehicles
    const trafficVehicles = context.trafficVehicles || [];
    let minimumTtc = Infinity;
    let closestNpcId = '';

    if (rule.priorityLaneIds && rule.priorityLaneIds.length > 0) {
      for (const priorityLaneId of rule.priorityLaneIds) {
        const laneObj = context.nearbyLanes?.find((l) => l.id === priorityLaneId);
        if (!laneObj) continue;

        const npcsOnLane = trafficVehicles.filter((v) => v.laneId === priorityLaneId);
        for (const npc of npcsOnLane) {
          const remainingDist = getRemainingDistance(npc.position, laneObj.centerLine);
          const speedMps = npc.speedMph * 0.44704;
          const ttc = speedMps > 0.5 ? remainingDist / speedMps : Infinity;
          if (ttc < minimumTtc) {
            minimumTtc = ttc;
            closestNpcId = npc.id;
          }
        }
      }
    }

    // 2. Junction crossing evaluation (when player crosses the line, i.e., distToLine <= 1.5m and heading forward)
    const isCrossingLine = distToLine <= 1.5;

    if (isCrossingLine) {
      const key = `${rule.id}-${lane.id}`;

      // A. STOP sign: No full stop rule
      if (rule.type === 'stop') {
        if (!this.hasStoppedAtJunction && !this.triggeredNoFullStop.has(key)) {
          this.triggeredNoFullStop.add(key);
          return {
            id: `stop.no_full_stop-${context.timeSeconds}`,
            ruleId: 'stop.no_full_stop',
            severity: 'dangerous',
            message: 'Stop 标志必须完全停车。 (You must make a full stop at STOP.)',
            occurredAtSeconds: context.timeSeconds,
            laneId: lane.id,
            evidence: { speedMph: context.speedMph, stoppedDuration: this.stoppedStartTime ? context.timeSeconds - this.stoppedStartTime : 0 }
          };
        }
      }

      // B. Give Way: Fail priority (TTC < 3.0s with oncoming traffic)
      const safetyThreshold = rule.minimumClearGapSeconds ?? 3.0;
      if (minimumTtc < safetyThreshold) {
        if (!this.triggeredFailPriority.has(key)) {
          this.triggeredFailPriority.add(key);
          return {
            id: `give_way.fail_priority-${context.timeSeconds}`,
            ruleId: 'give_way.fail_priority',
            severity: 'dangerous',
            message: '未让主路车辆先行。 (You failed to give way to priority traffic.)',
            occurredAtSeconds: context.timeSeconds,
            laneId: lane.id,
            evidence: { ttcSeconds: minimumTtc, npcId: closestNpcId }
          };
        }
      }

      // C. Give Way: Line roll through (insufficient gap TTC < 5.0s, and crossed without lowering speed below 5mph)
      if (rule.type === 'give-way' && minimumTtc < 5.0 && context.speedMph > 5.0) {
        if (!this.triggeredLineRollThrough.has(key)) {
          this.triggeredLineRollThrough.add(key);
          return {
            id: `give_way.line_roll_through-${context.timeSeconds}`,
            ruleId: 'give_way.line_roll_through',
            severity: 'serious',
            message: '间隙不足时不要抢行。 (Do not roll through without a safe gap.)',
            occurredAtSeconds: context.timeSeconds,
            laneId: lane.id,
            evidence: { speedMph: context.speedMph, ttcSeconds: minimumTtc }
          };
        }
      }
    }

    // 3. Observation checking on move off
    if (this.wasStopped && !this.isCurrentlyStopped) {
      // Vehicle just started moving off after being stopped near the junction
      if (distToLine <= 8.0) {
        const timeSinceLeftCheck = context.timeSeconds - this.lastLeftMirrorCheckTime;
        const timeSinceRightCheck = context.timeSeconds - this.lastRightMirrorCheckTime;
        const timeSinceBlindSpotCheck = context.timeSeconds - this.lastBlindSpotCheckTime;

        // If no mirrors or blind spot checked within the last 3.0 seconds
        const checkedRecent =
          timeSinceLeftCheck <= 3.0 ||
          timeSinceRightCheck <= 3.0 ||
          timeSinceBlindSpotCheck <= 3.0;

        if (!checkedRecent) {
          const key = `${rule.id}-${lane.id}`;
          if (!this.triggeredObservationMissing.has(key)) {
            this.triggeredObservationMissing.add(key);
            return {
              id: `stop.observation_missing-${context.timeSeconds}`,
              ruleId: 'stop.observation_missing',
              severity: 'serious',
              message: '起步前观察左右和盲区。 (Check both ways and blind spots before moving.)',
              occurredAtSeconds: context.timeSeconds,
              laneId: lane.id,
            };
          }
        }
      }
    }

    this.wasStopped = this.isCurrentlyStopped;
    return null;
  }

  private resetJunctionState(): void {
    this.stoppedStartTime = null;
    this.hasStoppedAtJunction = false;
    this.isCurrentlyStopped = false;
    this.wasStopped = false;
  }
}
