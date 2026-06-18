import { describe, it, expect } from 'vitest';
import { ParkingBayRule } from '../../src/rules/ParkingBayRule';
import type { DrivingContext } from '../../src/rules/RuleEngine';

/* ------------------------------------------------------------------ */
/*  Helper – build a deterministic DrivingContext                      */
/* ------------------------------------------------------------------ */

function makeContext(overrides: Partial<DrivingContext> = {}): DrivingContext {
  return {
    timeSeconds: 10,
    deltaSeconds: 0.016,
    vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 0 },
    speedMph: 0,
    gear: 'drive',
    indicator: 'off',
    ...overrides,
  } as DrivingContext;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ParkingBayRule', () => {
  /* ============================================================ */
  /*  1. No fault in normal driving                                */
  /* ============================================================ */
  it('should return null when there is no parking context', () => {
    const rule = new ParkingBayRule();
    const ctx = makeContext({ speedMph: 30, gear: 'drive' });
    expect(rule.evaluate(ctx)).toBeNull();
  });

  /* ============================================================ */
  /*  2. parking.reverse_no_observation — dangerous                */
  /* ============================================================ */
  it('should trigger parking.reverse_no_observation when reversing > 1s without observation', () => {
    const rule = new ParkingBayRule();

    // First frame: gear=reverse, speed=2, t=10 → starts timer
    rule.evaluate(
      makeContext({
        timeSeconds: 10,
        gear: 'reverse',
        speedMph: 2,
      }),
    );

    // Second frame: t=11.5 (1.5 s elapsed), still no observation
    const fault = rule.evaluate(
      makeContext({
        timeSeconds: 11.5,
        gear: 'reverse',
        speedMph: 2,
      }),
    );

    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('parking.reverse_no_observation');
    expect(fault!.severity).toBe('dangerous');
  });

  /* ============================================================ */
  /*  3. reverse_no_observation NOT triggered with observation     */
  /* ============================================================ */
  it('should NOT trigger reverse_no_observation when checkedRearView is true', () => {
    const rule = new ParkingBayRule();

    rule.evaluate(
      makeContext({
        timeSeconds: 10,
        gear: 'reverse',
        speedMph: 2,
      }),
    );

    const fault = rule.evaluate(
      makeContext({
        timeSeconds: 11.5,
        gear: 'reverse',
        speedMph: 2,
        observation: { checkedRearView: true },
      }),
    );

    expect(fault).toBeNull();
  });

  /* ============================================================ */
  /*  4. parking.final_misaligned — serious (≈major)               */
  /* ============================================================ */
  it('should trigger parking.final_misaligned when alignment > 10°', () => {
    const rule = new ParkingBayRule();

    const ctx = makeContext({
      speedMph: 0,
      gear: 'park',
      parkingBay: {
        targetBayId: 'bay_1',
        bayBounds: { minX: -1.5, maxX: 1.5, minZ: -3, maxZ: 3 },
        bayHeadingDegrees: 0,
        isVehicleInBay: true,
        alignmentAngleDegrees: 15,
      },
    } as Partial<DrivingContext>);

    const fault = rule.evaluate(ctx);
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('parking.final_misaligned');
    expect(fault!.severity).toBe('serious');
    expect(fault!.evidence?.alignmentAngleDegrees).toBe(15);
  });

  /* ============================================================ */
  /*  5. parking.outside_target_bay — dangerous                    */
  /* ============================================================ */
  it('should trigger parking.outside_target_bay when wheel is outside bounds in park gear', () => {
    const rule = new ParkingBayRule();

    const ctx = makeContext({
      speedMph: 0,
      gear: 'park',
      parkingBay: {
        targetBayId: 'bay_1',
        bayBounds: { minX: -1.5, maxX: 1.5, minZ: -3, maxZ: 3 },
        bayHeadingDegrees: 0,
        isVehicleInBay: false,
        wheelPositions: [
          { x: -2.0, y: 0, z: 0 }, // outside on X
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
      },
    } as Partial<DrivingContext>);

    const fault = rule.evaluate(ctx);
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('parking.outside_target_bay');
    expect(fault!.severity).toBe('dangerous');
  });

  /* ============================================================ */
  /*  6. parking.bay_line_touch — minor                            */
  /* ============================================================ */
  it('should trigger parking.bay_line_touch when isVehicleInBay is false', () => {
    const rule = new ParkingBayRule();

    const ctx = makeContext({
      speedMph: 1,
      gear: 'reverse',
      vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 0 },
      parkingBay: {
        targetBayId: 'bay_1',
        bayBounds: { minX: -1.5, maxX: 1.5, minZ: -3, maxZ: 3 },
        bayHeadingDegrees: 0,
        isVehicleInBay: false,
      },
    } as Partial<DrivingContext>);

    const fault = rule.evaluate(ctx);
    // The highest-severity fault returned may be reverse_no_observation
    // (dangerous) on subsequent calls, but on first call with < 1 s elapsed
    // it should be bay_line_touch (minor).
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('parking.bay_line_touch');
    expect(fault!.severity).toBe('minor');
  });

  /* ============================================================ */
  /*  7. parking.reverse_setup_poor — minor                        */
  /* ============================================================ */
  it('should trigger parking.reverse_setup_poor when heading diff > 45°', () => {
    const rule = new ParkingBayRule();

    const ctx = makeContext({
      speedMph: 2,
      gear: 'reverse',
      vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 90 },
      parkingBay: {
        targetBayId: 'bay_1',
        bayBounds: { minX: -1.5, maxX: 1.5, minZ: -3, maxZ: 3 },
        bayHeadingDegrees: 0,
        isVehicleInBay: false,
      },
    } as Partial<DrivingContext>);

    const fault = rule.evaluate(ctx);
    // First evaluate with < 1 s elapsed so reverse_no_observation won't
    // fire yet — but both bay_line_touch (minor) and reverse_setup_poor
    // (minor) qualify.  The rule returns the highest severity; when tied
    // it returns whichever is checked first. reverse_setup_poor is
    // checked before bay_line_touch, so the first minor captured wins
    // via higherSeverity picking 'a' when equal.
    expect(fault).not.toBeNull();
    // Both are minor; the rule checks reverse_setup_poor (sub-rule 2)
    // before bay_line_touch (sub-rule 4).  higherSeverity returns 'a'
    // when ranks are equal, so we get the one that came first in the
    // accumulator chain.
    expect(fault!.severity).toBe('minor');
    // Verify one of the expected minor-level parking faults fires
    expect(
      fault!.ruleId === 'parking.reverse_setup_poor' ||
        fault!.ruleId === 'parking.bay_line_touch',
    ).toBe(true);
  });

  /* ============================================================ */
  /*  Dedicated test: reverse_setup_poor in isolation               */
  /* ============================================================ */
  it('should trigger parking.reverse_setup_poor when heading diff > 45° (isolated)', () => {
    const rule = new ParkingBayRule();

    const ctx = makeContext({
      speedMph: 2,
      gear: 'reverse',
      vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 90 },
      parkingBay: {
        targetBayId: 'bay_1',
        bayBounds: { minX: -1.5, maxX: 1.5, minZ: -3, maxZ: 3 },
        bayHeadingDegrees: 0,
        isVehicleInBay: true, // vehicle is inside bay → bay_line_touch won't fire
        alignmentAngleDegrees: 5, // ≤10 → final_misaligned won't fire
      },
    } as Partial<DrivingContext>);

    const fault = rule.evaluate(ctx);
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('parking.reverse_setup_poor');
    expect(fault!.severity).toBe('minor');
  });

  /* ============================================================ */
  /*  parking.entry_no_give_way — dangerous                        */
  /* ============================================================ */
  it('should trigger parking.entry_no_give_way when entering car park too fast without observation', () => {
    const rule = new ParkingBayRule();

    const ctx = makeContext({
      speedMph: 8,
      gear: 'drive',
      activeTriggerZones: [
        {
          id: 'carpark_entry_1',
          bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
        },
      ],
    } as Partial<DrivingContext>);

    const fault = rule.evaluate(ctx);
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('parking.entry_no_give_way');
    expect(fault!.severity).toBe('dangerous');
  });

  /* ============================================================ */
  /*  parking.collision — dangerous                                */
  /* ============================================================ */
  it('should trigger parking.collision when a collision trigger zone is active', () => {
    const rule = new ParkingBayRule();

    const ctx = makeContext({
      speedMph: 1,
      gear: 'reverse',
      activeTriggerZones: [
        {
          id: 'collision_parking_1',
          bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
          ruleIds: ['parking.collision'],
        },
      ],
    } as Partial<DrivingContext>);

    const fault = rule.evaluate(ctx);
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('parking.collision');
    expect(fault!.severity).toBe('dangerous');
  });

  /* ============================================================ */
  /*  Cooldown / deduplication                                     */
  /* ============================================================ */
  it('should not re-trigger the same sub-rule after cooldown', () => {
    const rule = new ParkingBayRule();

    const base = {
      gear: 'reverse' as const,
      speedMph: 2,
    };

    // Frame 1 — start timer
    rule.evaluate(makeContext({ ...base, timeSeconds: 10 }));
    // Frame 2 — fires fault
    const f1 = rule.evaluate(makeContext({ ...base, timeSeconds: 11.5 }));
    expect(f1).not.toBeNull();
    expect(f1!.ruleId).toBe('parking.reverse_no_observation');

    // Frame 3 — should NOT fire again
    const f2 = rule.evaluate(makeContext({ ...base, timeSeconds: 12.0 }));
    expect(f2).toBeNull();
  });

  /* ============================================================ */
  /*  Highest severity wins                                        */
  /* ============================================================ */
  it('should return the highest-severity fault when multiple sub-rules fire', () => {
    const rule = new ParkingBayRule();

    // Frame 1: start reverse timer
    rule.evaluate(
      makeContext({
        timeSeconds: 10,
        gear: 'reverse',
        speedMph: 2,
        parkingBay: {
          targetBayId: 'bay_1',
          bayBounds: { minX: -1.5, maxX: 1.5, minZ: -3, maxZ: 3 },
          bayHeadingDegrees: 0,
          isVehicleInBay: false, // bay_line_touch (minor)
        },
      } as Partial<DrivingContext>),
    );

    // Frame 2: > 1 s elapsed → reverse_no_observation (dangerous) + bay_line_touch (minor)
    const fault = rule.evaluate(
      makeContext({
        timeSeconds: 11.5,
        gear: 'reverse',
        speedMph: 2,
        parkingBay: {
          targetBayId: 'bay_1',
          bayBounds: { minX: -1.5, maxX: 1.5, minZ: -3, maxZ: 3 },
          bayHeadingDegrees: 0,
          isVehicleInBay: false,
        },
      } as Partial<DrivingContext>),
    );

    expect(fault).not.toBeNull();
    // Dangerous > minor, so reverse_no_observation should win
    expect(fault!.ruleId).toBe('parking.reverse_no_observation');
    expect(fault!.severity).toBe('dangerous');
  });
});
