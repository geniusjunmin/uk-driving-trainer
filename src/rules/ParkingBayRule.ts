import type { DrivingContext, DrivingFault, DrivingRule, DrivingRuleSeverity } from './RuleEngine';

/* ------------------------------------------------------------------ */
/*  Parking-specific context extension                                */
/* ------------------------------------------------------------------ */

/**
 * Extended context fields that the parking-bay system injects into
 * DrivingContext at runtime.  We cast to this interface inside
 * `evaluate()` so that the base DrivingContext type stays unchanged.
 */
export interface ParkingBayData {
  readonly targetBayId: string;
  readonly bayBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  readonly bayHeadingDegrees: number;
  readonly wheelPositions?: readonly { x: number; y: number; z: number }[];
  readonly isVehicleInBay?: boolean;
  readonly alignmentAngleDegrees?: number;
  readonly lateralOffsetMeters?: number;
}

interface ParkingDrivingContext extends DrivingContext {
  readonly parkingBay?: ParkingBayData;
}

/* ------------------------------------------------------------------ */
/*  Severity helpers                                                  */
/* ------------------------------------------------------------------ */

const SEVERITY_RANK: Record<DrivingRuleSeverity, number> = {
  minor: 1,
  serious: 2,
  dangerous: 3,
};

function higherSeverity(
  a: DrivingFault | null,
  b: DrivingFault | null,
): DrivingFault | null {
  if (!a) return b;
  if (!b) return a;
  return SEVERITY_RANK[a.severity] >= SEVERITY_RANK[b.severity] ? a : b;
}

/* ------------------------------------------------------------------ */
/*  Angle normalisation                                               */
/* ------------------------------------------------------------------ */

/** Normalise an angle into (-180, 180]. */
function normaliseDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/* ------------------------------------------------------------------ */
/*  Cooldown tracker                                                  */
/* ------------------------------------------------------------------ */

/** Simple per-subrule cooldown so a fault fires at most once. */
class CooldownTracker {
  private readonly fired = new Set<string>();
  /** Returns true the *first* time `key` is tried. */
  tryFire(key: string): boolean {
    if (this.fired.has(key)) return false;
    this.fired.add(key);
    return true;
  }
}

/* ------------------------------------------------------------------ */
/*  ParkingBayRule                                                     */
/* ------------------------------------------------------------------ */

export class ParkingBayRule implements DrivingRule {
  readonly id = 'parking';
  readonly category = 'parking-control';

  /* ---- internal state ---- */
  private reverseStartTime: number | null = null;
  private parkingEntryChecked = false;
  private readonly cooldown = new CooldownTracker();

  /* ------------------------------------------------------------ */
  /*  evaluate – checks all 7 sub-rules; returns highest severity */
  /* ------------------------------------------------------------ */

  evaluate(context: DrivingContext): DrivingFault | null {
    const ctx = context as ParkingDrivingContext;
    let worst: DrivingFault | null = null;

    // 1 – parking.entry_no_give_way
    worst = higherSeverity(worst, this.checkEntryNoGiveWay(ctx));

    // 2 – parking.reverse_setup_poor
    worst = higherSeverity(worst, this.checkReverseSetupPoor(ctx));

    // 3 – parking.reverse_no_observation
    worst = higherSeverity(worst, this.checkReverseNoObservation(ctx));

    // 4 – parking.bay_line_touch
    worst = higherSeverity(worst, this.checkBayLineTouch(ctx));

    // 5 – parking.final_misaligned
    worst = higherSeverity(worst, this.checkFinalMisaligned(ctx));

    // 6 – parking.outside_target_bay
    worst = higherSeverity(worst, this.checkOutsideTargetBay(ctx));

    // 7 – parking.collision
    worst = higherSeverity(worst, this.checkCollision(ctx));

    return worst;
  }

  /* ============================================================ */
  /*  Sub-rule implementations                                     */
  /* ============================================================ */

  /* 1. parking.entry_no_give_way — dangerous (-10)
   *    At carpark entry zone (activeTriggerZones containing 'carpark'
   *    or 'parking_entry'), speed > 5 mph and no observation.
   */
  private checkEntryNoGiveWay(ctx: ParkingDrivingContext): DrivingFault | null {
    if (this.parkingEntryChecked) return null;

    const triggerZones = ctx.activeTriggerZones;
    if (!triggerZones) return null;

    const entryZone = triggerZones.find(
      (z) => z.id.includes('carpark') || z.id.includes('parking_entry'),
    );
    if (!entryZone) return null;

    if (ctx.speedMph <= 5) return null;

    const obs = ctx.observation;
    const hasObservation =
      obs &&
      (obs.checkedInteriorMirror ||
        obs.checkedLeftMirror ||
        obs.checkedRightMirror ||
        obs.checkedBlindSpot ||
        obs.checkedRearView);

    if (hasObservation) return null;

    this.parkingEntryChecked = true;
    if (!this.cooldown.tryFire('parking.entry_no_give_way')) return null;

    return {
      id: `parking.entry_no_give_way-${ctx.timeSeconds}`,
      ruleId: 'parking.entry_no_give_way',
      severity: 'dangerous',
      message:
        'Entered car park area too fast without observation. Instant fail.',
      occurredAtSeconds: ctx.timeSeconds,
      zoneId: entryZone.id,
      evidence: { speedMph: ctx.speedMph },
    };
  }

  /* 2. parking.reverse_setup_poor — minor (-3)
   *    In reverse gear near the target bay, vehicle heading vs bay
   *    heading differs by > 45°.
   */
  private checkReverseSetupPoor(ctx: ParkingDrivingContext): DrivingFault | null {
    if (ctx.gear !== 'reverse') return null;
    const bay = ctx.parkingBay;
    if (!bay) return null;

    const diff = Math.abs(normaliseDeg(ctx.vehiclePose.yawDegrees - bay.bayHeadingDegrees));
    if (diff <= 45) return null;

    if (!this.cooldown.tryFire('parking.reverse_setup_poor')) return null;

    return {
      id: `parking.reverse_setup_poor-${ctx.timeSeconds}`,
      ruleId: 'parking.reverse_setup_poor',
      severity: 'minor',
      message:
        'Poor setup positioning for reverse bay park. Heading misalignment exceeds 45°.',
      occurredAtSeconds: ctx.timeSeconds,
      evidence: { headingDiffDegrees: diff },
    };
  }

  /* 3. parking.reverse_no_observation — dangerous (-10)
   *    Gear is reverse, speed > 0.5 mph for > 1 s, but rear-view,
   *    left-mirror, and blind-spot checks are all false/undefined.
   */
  private checkReverseNoObservation(ctx: ParkingDrivingContext): DrivingFault | null {
    if (ctx.gear !== 'reverse') {
      this.reverseStartTime = null;
      return null;
    }

    if (ctx.speedMph <= 0.5) {
      // Not moving significantly — don't start/continue the timer
      return null;
    }

    // Start the clock on first qualifying frame
    if (this.reverseStartTime === null) {
      this.reverseStartTime = ctx.timeSeconds;
    }

    const elapsed = ctx.timeSeconds - this.reverseStartTime;
    if (elapsed < 1.0) return null;

    const obs = ctx.observation;
    const hasObs =
      obs &&
      (obs.checkedRearView || obs.checkedLeftMirror || obs.checkedBlindSpot);
    if (hasObs) return null;

    if (!this.cooldown.tryFire('parking.reverse_no_observation')) return null;

    return {
      id: `parking.reverse_no_observation-${ctx.timeSeconds}`,
      ruleId: 'parking.reverse_no_observation',
      severity: 'dangerous',
      message:
        'Reversed for over 1 second without checking rear view, left mirror, or blind spot. Instant fail.',
      occurredAtSeconds: ctx.timeSeconds,
      evidence: { elapsedReverseSeconds: elapsed },
    };
  }

  /* 4. parking.bay_line_touch — minor (-3)
   *    parkingBay is present, isVehicleInBay is false (wheel outside bounds).
   */
  private checkBayLineTouch(ctx: ParkingDrivingContext): DrivingFault | null {
    const bay = ctx.parkingBay;
    if (!bay) return null;

    // Only relevant when the vehicle isn't fully in the bay
    if (bay.isVehicleInBay !== false) return null;

    if (!this.cooldown.tryFire('parking.bay_line_touch')) return null;

    return {
      id: `parking.bay_line_touch-${ctx.timeSeconds}`,
      ruleId: 'parking.bay_line_touch',
      severity: 'minor',
      message:
        'Vehicle is touching or crossing the bay line — a wheel is outside the bay bounds.',
      occurredAtSeconds: ctx.timeSeconds,
      evidence: { isVehicleInBay: false },
    };
  }

  /* 5. parking.final_misaligned — serious (maps to 'major' / -5)
   *    isVehicleInBay is true but alignmentAngleDegrees > 10°.
   *    NOTE: DrivingRuleSeverity has no 'major'; using 'serious'.
   */
  private checkFinalMisaligned(ctx: ParkingDrivingContext): DrivingFault | null {
    const bay = ctx.parkingBay;
    if (!bay) return null;
    if (!bay.isVehicleInBay) return null;
    if (bay.alignmentAngleDegrees === undefined) return null;
    if (bay.alignmentAngleDegrees <= 10) return null;

    if (!this.cooldown.tryFire('parking.final_misaligned')) return null;

    return {
      id: `parking.final_misaligned-${ctx.timeSeconds}`,
      ruleId: 'parking.final_misaligned',
      severity: 'serious',
      message:
        'Vehicle is in the bay but final alignment exceeds 10°.',
      occurredAtSeconds: ctx.timeSeconds,
      evidence: { alignmentAngleDegrees: bay.alignmentAngleDegrees },
    };
  }

  /* 6. parking.outside_target_bay — dangerous (-10)
   *    End of parking manoeuvre (speed < 0.5 mph, gear is 'park'),
   *    any wheel is outside the target bay bounds.
   */
  private checkOutsideTargetBay(ctx: ParkingDrivingContext): DrivingFault | null {
    const bay = ctx.parkingBay;
    if (!bay) return null;

    // Must be at end of manoeuvre
    if (ctx.speedMph >= 0.5 || ctx.gear !== 'park') return null;

    const wheels = bay.wheelPositions;
    if (!wheels || wheels.length === 0) return null;

    const bounds = bay.bayBounds;
    const anyOutside = wheels.some(
      (w) =>
        w.x < bounds.minX ||
        w.x > bounds.maxX ||
        w.z < bounds.minZ ||
        w.z > bounds.maxZ,
    );
    if (!anyOutside) return null;

    if (!this.cooldown.tryFire('parking.outside_target_bay')) return null;

    return {
      id: `parking.outside_target_bay-${ctx.timeSeconds}`,
      ruleId: 'parking.outside_target_bay',
      severity: 'dangerous',
      message:
        'Parked with a wheel outside the target bay. Instant fail.',
      occurredAtSeconds: ctx.timeSeconds,
      evidence: { targetBayId: bay.targetBayId },
    };
  }

  /* 7. parking.collision — dangerous (-10)
   *    Detected via a trigger zone whose id contains 'collision'
   *    or whose ruleIds include 'parking.collision'.
   */
  private checkCollision(ctx: ParkingDrivingContext): DrivingFault | null {
    const triggerZones = ctx.activeTriggerZones;
    if (!triggerZones) return null;

    const collisionZone = triggerZones.find(
      (z) =>
        z.id.includes('collision') ||
        (z.ruleIds && z.ruleIds.includes('parking.collision')),
    );
    if (!collisionZone) return null;

    if (!this.cooldown.tryFire('parking.collision')) return null;

    return {
      id: `parking.collision-${ctx.timeSeconds}`,
      ruleId: 'parking.collision',
      severity: 'dangerous',
      message:
        'Collision detected during parking manoeuvre. Instant fail.',
      occurredAtSeconds: ctx.timeSeconds,
      zoneId: collisionZone.id,
    };
  }
}
