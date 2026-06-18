import type { DrivingContext, DrivingFault, DrivingRule, DrivingRuleSeverity } from './RuleEngine';

/**
 * Severity ordering for comparing faults — higher index means higher severity.
 */
const SEVERITY_ORDER: Record<DrivingRuleSeverity, number> = {
  minor: 0,
  serious: 1,
  dangerous: 2,
};

/**
 * Checks whether a 2D point (x, z) is inside an axis-aligned bounding box.
 */
function isInsideBounds(
  px: number, pz: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
  return px >= bounds.minX && px <= bounds.maxX && pz >= bounds.minZ && pz <= bounds.maxZ;
}

/**
 * ZebraCrossingRule — Implements 5 sub-rules for UK zebra crossing behaviour:
 *
 * 1. `zebra.approach_no_slow` (major, -5)
 * 2. `zebra.fail_waiting_pedestrian` (dangerous, -10)
 * 3. `zebra.fail_crossing_pedestrian` (dangerous, -10)
 * 4. `zebra.block_crossing` (major, -5)
 * 5. `pedestrian.restart_too_early` (dangerous, -10)
 *
 * Returns the single highest-severity fault per evaluate() call, or null.
 */
export class ZebraCrossingRule implements DrivingRule {
  readonly id = 'zebra';
  readonly category = 'pedestrian-priority';

  // ── Internal state ──

  /** Rolling speed history for deceleration detection */
  private previousSpeedMph: number | null = null;
  private hasDeceleratedOnApproach = false;

  /** Tracks when the vehicle first entered the crossing conflict zone */
  private enteredCrossingZoneAtSeconds: number | null = null;

  /** Whether the vehicle was stopped (speed ≈ 0) last frame */
  private wasStoppedLastFrame = false;

  /** Cooldown timers to avoid spamming the same fault */
  private lastApproachNoSlowTime = -9999;
  private lastFailWaitingTime = -9999;
  private lastFailCrossingTime = -9999;
  private lastBlockCrossingTime = -9999;
  private lastRestartTooEarlyTime = -9999;

  /** Minimum cooldown between repeated faults of the same sub-rule (seconds) */
  private readonly COOLDOWN_SECONDS = 5.0;

  /** Approach distance threshold for zebra.approach_no_slow */
  private readonly APPROACH_DISTANCE_M = 40.0;

  /** How long the vehicle can sit on a crossing before triggering block_crossing */
  private readonly BLOCK_CROSSING_THRESHOLD_S = 3.0;

  /** Speed threshold below which the vehicle is considered "stopped" */
  private readonly STOPPED_SPEED_MPH = 0.5;

  evaluate(context: DrivingContext): DrivingFault | null {
    const pedestrians = context.pedestrians;
    const currentSpeed = context.speedMph;

    // If there are no pedestrians in the context, only track zone presence for block_crossing
    const hasPedestrians = pedestrians !== undefined && pedestrians.length > 0;

    // ── Determine if the vehicle is inside any zebra crossing conflict zone ──
    const crossingZone = this.findZebraCrossingZone(context);
    const isOnCrossing = crossingZone !== null;

    // Update zone entry tracking
    if (isOnCrossing) {
      if (this.enteredCrossingZoneAtSeconds === null) {
        this.enteredCrossingZoneAtSeconds = context.timeSeconds;
      }
    } else {
      this.enteredCrossingZoneAtSeconds = null;
    }

    // Collect all candidate faults, then return the highest-severity one
    const faults: DrivingFault[] = [];

    if (hasPedestrians) {
      // ── Sub-rule 1: zebra.approach_no_slow ──
      const approachFault = this.checkApproachNoSlow(context, pedestrians!);
      if (approachFault) faults.push(approachFault);

      // ── Sub-rule 2: zebra.fail_waiting_pedestrian ──
      const failWaitingFault = this.checkFailWaitingPedestrian(context, pedestrians!, isOnCrossing);
      if (failWaitingFault) faults.push(failWaitingFault);

      // ── Sub-rule 3: zebra.fail_crossing_pedestrian ──
      const failCrossingFault = this.checkFailCrossingPedestrian(context, pedestrians!, isOnCrossing);
      if (failCrossingFault) faults.push(failCrossingFault);

      // ── Sub-rule 5: pedestrian.restart_too_early ──
      const restartFault = this.checkRestartTooEarly(context, pedestrians!, isOnCrossing);
      if (restartFault) faults.push(restartFault);
    }

    // ── Sub-rule 4: zebra.block_crossing (checked regardless of pedestrian presence) ──
    const blockFault = this.checkBlockCrossing(context, isOnCrossing);
    if (blockFault) faults.push(blockFault);

    // Update state for next frame
    this.previousSpeedMph = currentSpeed;
    this.wasStoppedLastFrame = currentSpeed <= this.STOPPED_SPEED_MPH;

    // Return the highest-severity fault, or null
    if (faults.length === 0) return null;

    faults.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
    return faults[0];
  }

  // ────────────────────────────────────────────────
  // Sub-rule implementations
  // ────────────────────────────────────────────────

  /**
   * Sub-rule 1: zebra.approach_no_slow
   * Within 40m of a crossing with waiting/crossing pedestrians, player hasn't slowed down.
   */
  private checkApproachNoSlow(
    context: DrivingContext,
    pedestrians: readonly { id: string; state: string; crossingId: string; position: { x: number; y: number; z: number }; boundingRadius: number }[]
  ): DrivingFault | null {
    if (context.timeSeconds - this.lastApproachNoSlowTime < this.COOLDOWN_SECONDS) {
      return null;
    }

    const relevantPedestrians = pedestrians.filter(
      (p) => p.state === 'waiting' || p.state === 'crossing'
    );
    if (relevantPedestrians.length === 0) return null;

    // Check if any relevant pedestrian is within approach distance
    let closestDistance = Infinity;
    for (const ped of relevantPedestrians) {
      const dx = context.vehiclePose.position.x - ped.position.x;
      const dz = context.vehiclePose.position.z - ped.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < closestDistance) closestDistance = dist;
    }

    if (closestDistance > this.APPROACH_DISTANCE_M) {
      // Reset deceleration tracking when far from pedestrians
      this.hasDeceleratedOnApproach = false;
      return null;
    }

    // Detect deceleration: current speed < previous speed by at least 2 mph
    if (
      this.previousSpeedMph !== null &&
      this.previousSpeedMph - context.speedMph >= 2.0
    ) {
      this.hasDeceleratedOnApproach = true;
    }

    // Only fault if vehicle is moving at a meaningful speed and hasn't decelerated
    if (context.speedMph > 5.0 && !this.hasDeceleratedOnApproach) {
      this.lastApproachNoSlowTime = context.timeSeconds;
      return {
        id: `zebra.approach_no_slow-${context.timeSeconds}`,
        ruleId: 'zebra.approach_no_slow',
        severity: 'serious',
        message: 'Approaching zebra crossing with pedestrians — slow down. (接近有行人的斑马线，请减速。)',
        occurredAtSeconds: context.timeSeconds,
        evidence: {
          distanceMeters: closestDistance,
          speedMph: context.speedMph,
          decelerated: false,
        },
      };
    }

    return null;
  }

  /**
   * Sub-rule 2: zebra.fail_waiting_pedestrian
   * Pedestrian is waiting and facing crossing, player drives through crossing zone without stopping.
   */
  private checkFailWaitingPedestrian(
    context: DrivingContext,
    pedestrians: readonly { id: string; state: string; crossingId: string; position: { x: number; y: number; z: number }; boundingRadius: number }[],
    isOnCrossing: boolean
  ): DrivingFault | null {
    if (!isOnCrossing) return null;
    if (context.speedMph <= this.STOPPED_SPEED_MPH) return null;
    if (context.timeSeconds - this.lastFailWaitingTime < this.COOLDOWN_SECONDS) return null;

    const waitingPedestrians = pedestrians.filter((p) => p.state === 'waiting');
    if (waitingPedestrians.length === 0) return null;

    // Check if any waiting pedestrian is near the crossing (within 10m)
    const nearbyWaiting = waitingPedestrians.some((ped) => {
      const dx = context.vehiclePose.position.x - ped.position.x;
      const dz = context.vehiclePose.position.z - ped.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      return dist <= 20.0;
    });

    if (!nearbyWaiting) return null;

    this.lastFailWaitingTime = context.timeSeconds;
    return {
      id: `zebra.fail_waiting_pedestrian-${context.timeSeconds}`,
      ruleId: 'zebra.fail_waiting_pedestrian',
      severity: 'dangerous',
      message: 'Failed to stop for pedestrian waiting at zebra crossing. (未在斑马线前为等待的行人停车。)',
      occurredAtSeconds: context.timeSeconds,
      evidence: {
        speedMph: context.speedMph,
        waitingCount: waitingPedestrians.length,
      },
    };
  }

  /**
   * Sub-rule 3: zebra.fail_crossing_pedestrian
   * Pedestrian is crossing (on the zebra), player doesn't stop. INSTANT FAIL.
   */
  private checkFailCrossingPedestrian(
    context: DrivingContext,
    pedestrians: readonly { id: string; state: string; crossingId: string; position: { x: number; y: number; z: number }; boundingRadius: number }[],
    isOnCrossing: boolean
  ): DrivingFault | null {
    if (!isOnCrossing) return null;
    if (context.speedMph <= this.STOPPED_SPEED_MPH) return null;
    if (context.timeSeconds - this.lastFailCrossingTime < this.COOLDOWN_SECONDS) return null;

    const crossingPedestrians = pedestrians.filter((p) => p.state === 'crossing');
    if (crossingPedestrians.length === 0) return null;

    // Check if any crossing pedestrian is nearby (within 15m — on or near the crossing)
    const nearbyCrossing = crossingPedestrians.some((ped) => {
      const dx = context.vehiclePose.position.x - ped.position.x;
      const dz = context.vehiclePose.position.z - ped.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      return dist <= 20.0;
    });

    if (!nearbyCrossing) return null;

    this.lastFailCrossingTime = context.timeSeconds;
    return {
      id: `zebra.fail_crossing_pedestrian-${context.timeSeconds}`,
      ruleId: 'zebra.fail_crossing_pedestrian',
      severity: 'dangerous',
      message: 'Failed to stop for pedestrian on zebra crossing — INSTANT FAIL. (行人正在过斑马线时未停车 — 即时失败。)',
      occurredAtSeconds: context.timeSeconds,
      evidence: {
        speedMph: context.speedMph,
        crossingCount: crossingPedestrians.length,
      },
    };
  }

  /**
   * Sub-rule 4: zebra.block_crossing
   * Vehicle stopped ON the crossing zone for > 3 seconds.
   */
  private checkBlockCrossing(
    context: DrivingContext,
    isOnCrossing: boolean
  ): DrivingFault | null {
    if (!isOnCrossing) return null;
    if (context.speedMph > this.STOPPED_SPEED_MPH) return null;
    if (context.timeSeconds - this.lastBlockCrossingTime < this.COOLDOWN_SECONDS) return null;

    if (
      this.enteredCrossingZoneAtSeconds !== null &&
      context.timeSeconds - this.enteredCrossingZoneAtSeconds > this.BLOCK_CROSSING_THRESHOLD_S
    ) {
      this.lastBlockCrossingTime = context.timeSeconds;
      return {
        id: `zebra.block_crossing-${context.timeSeconds}`,
        ruleId: 'zebra.block_crossing',
        severity: 'serious',
        message: 'Vehicle is blocking the zebra crossing. (车辆阻塞了斑马线。)',
        occurredAtSeconds: context.timeSeconds,
        evidence: {
          timeOnCrossingSeconds: context.timeSeconds - this.enteredCrossingZoneAtSeconds,
        },
      };
    }

    return null;
  }

  /**
   * Sub-rule 5: pedestrian.restart_too_early
   * Pedestrian hasn't fully exited the player's path, player starts moving.
   */
  private checkRestartTooEarly(
    context: DrivingContext,
    pedestrians: readonly { id: string; state: string; crossingId: string; position: { x: number; y: number; z: number }; boundingRadius: number }[],
    isOnCrossing: boolean
  ): DrivingFault | null {
    if (!isOnCrossing) return null;
    if (context.timeSeconds - this.lastRestartTooEarlyTime < this.COOLDOWN_SECONDS) return null;

    // Detect transition from stopped to moving
    if (!this.wasStoppedLastFrame || context.speedMph <= this.STOPPED_SPEED_MPH) {
      return null;
    }

    // Check if any pedestrian is still crossing (hasn't exited)
    const activePedestrians = pedestrians.filter(
      (p) => p.state === 'crossing'
    );
    if (activePedestrians.length === 0) return null;

    // Check if any active pedestrian is still close to the vehicle path
    const dangerousPed = activePedestrians.some((ped) => {
      const dx = context.vehiclePose.position.x - ped.position.x;
      const dz = context.vehiclePose.position.z - ped.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      return dist <= 10.0;
    });

    if (!dangerousPed) return null;

    this.lastRestartTooEarlyTime = context.timeSeconds;
    return {
      id: `pedestrian.restart_too_early-${context.timeSeconds}`,
      ruleId: 'pedestrian.restart_too_early',
      severity: 'dangerous',
      message: 'Started moving before pedestrian has fully cleared the crossing. (行人尚未完全通过斑马线就起步了。)',
      occurredAtSeconds: context.timeSeconds,
      evidence: {
        speedMph: context.speedMph,
        activeCrossingCount: activePedestrians.length,
      },
    };
  }

  // ────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────

  /**
   * Finds a zebra-crossing-related conflict zone that the vehicle is currently inside.
   * Uses activeConflictZones or activeTriggerZones with 'zebra' or 'crossing' labels.
   */
  private findZebraCrossingZone(context: DrivingContext): { id: string } | null {
    const vx = context.vehiclePose.position.x;
    const vz = context.vehiclePose.position.z;

    // Check active conflict zones
    if (context.activeConflictZones) {
      for (const zone of context.activeConflictZones) {
        const isZebra = zone.label?.toLowerCase().includes('zebra') ||
                        zone.label?.toLowerCase().includes('crossing') ||
                        zone.id.toLowerCase().includes('zebra') ||
                        zone.id.toLowerCase().includes('crossing');
        if (isZebra && isInsideBounds(vx, vz, zone.bounds)) {
          return { id: zone.id };
        }
      }
    }

    // Fall back to trigger zones
    if (context.activeTriggerZones) {
      for (const zone of context.activeTriggerZones) {
        const isZebra = zone.label?.toLowerCase().includes('zebra') ||
                        zone.label?.toLowerCase().includes('crossing') ||
                        zone.id.toLowerCase().includes('zebra') ||
                        zone.id.toLowerCase().includes('crossing');
        if (isZebra && isInsideBounds(vx, vz, zone.bounds)) {
          return { id: zone.id };
        }
      }
    }

    return null;
  }
}
