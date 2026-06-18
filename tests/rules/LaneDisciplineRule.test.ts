import { describe, expect, it } from 'vitest';
import { LaneDisciplineRule } from '../../src/rules/LaneDisciplineRule';
import type { DrivingContext } from '../../src/rules/RuleEngine';

function createMockContext(overrides: Partial<DrivingContext> = {}): DrivingContext {
  return {
    timeSeconds: 0,
    deltaSeconds: 0.1,
    vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 0 },
    speedMph: 20,
    gear: 'drive',
    indicator: 'off',
    currentLane: {
      id: 'lane1',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      centerLine: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 100 },
      ],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 30,
      allowedTurns: [],
    },
    ...overrides,
  };
}

describe('LaneDisciplineRule Unit Tests', () => {
  it('should not trigger faults when vehicle is perfectly centered', () => {
    const rule = new LaneDisciplineRule();
    const context = createMockContext();
    expect(rule.evaluate(context)).toBeNull();
  });

  it('should trigger lane.keep_left.drift when vehicle center offset > 35% of lane width for 1.5s', () => {
    const rule = new LaneDisciplineRule();
    // Use an 8.0m wide lane so that the drift threshold (2.8m) is below the touch threshold (3.1m)
    const wideLane = {
      id: 'wide_lane',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      centerLine: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 100 },
      ],
      widthMeters: 8.0,
      direction: 'forward' as const,
      speedLimitMph: 30,
      allowedTurns: [],
    };

    // Offset is 2.9m (greater than 0.35 * 8.0 = 2.8m, but less than 4.0 - 0.9 = 3.1m touch threshold)
    // t = 0 to t = 1.4: should not trigger (needs 1.5s)
    for (let t = 0; t < 1.5; t += 0.2) {
      const context = createMockContext({
        timeSeconds: t,
        deltaSeconds: 0.2,
        vehiclePose: { position: { x: 2.9, y: 0, z: 10 }, yawDegrees: 0 },
        currentLane: wideLane,
      });
      expect(rule.evaluate(context)).toBeNull();
    }

    // At t = 1.6 (has been drifting for 1.6s >= 1.5s)
    const contextTrigger = createMockContext({
      timeSeconds: 1.6,
      deltaSeconds: 0.2,
      vehiclePose: { position: { x: 2.9, y: 0, z: 10 }, yawDegrees: 0 },
      currentLane: wideLane,
    });
    const fault = rule.evaluate(contextTrigger);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('lane.keep_left.drift');
    expect(fault?.severity).toBe('minor');
  });

  it('should trigger lane.line_touch when vehicle touches the line for less than 1s', () => {
    const rule = new LaneDisciplineRule();
    // Lane width 3.5m, touch threshold = 1.75 - 0.9 = 0.85m.
    // Offset is 1.0m (greater than 0.85m, so touching).
    // Under 1s, it should trigger line touch on the first step after cooldown checks (which is immediate if first trigger).
    const context = createMockContext({
      timeSeconds: 0,
      deltaSeconds: 0.1,
      vehiclePose: { position: { x: 1.0, y: 0, z: 10 }, yawDegrees: 0 },
    });
    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('lane.line_touch');
    expect(fault?.severity).toBe('minor');
  });

  it('should trigger lane.line_straddle when vehicle straddles/crosses the line for 1.0s or more', () => {
    const rule = new LaneDisciplineRule();
    // Offset is 1.0m (touching).
    // From t = 0 to t = 0.9s: triggers minor touch on first frame, then cooldown prevents further touch triggers.
    // At t = 1.0s (straddling for 1.0s), it should trigger serious line straddle.
    for (let t = 0; t < 1.0; t += 0.1) {
      const context = createMockContext({
        timeSeconds: t,
        deltaSeconds: 0.1,
        vehiclePose: { position: { x: 1.0, y: 0, z: 10 }, yawDegrees: 0 },
      });
      // t = 0 will trigger line_touch, t = 0.1 to 0.9 will return null due to cooldown.
      if (t === 0) {
        expect(rule.evaluate(context)?.ruleId).toBe('lane.line_touch');
      } else {
        expect(rule.evaluate(context)).toBeNull();
      }
    }

    const contextStraddle = createMockContext({
      timeSeconds: 1.0,
      deltaSeconds: 0.1,
      vehiclePose: { position: { x: 1.0, y: 0, z: 10 }, yawDegrees: 0 },
    });
    const fault = rule.evaluate(contextStraddle);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('lane.line_straddle');
    expect(fault?.severity).toBe('serious');
  });

  it('should NOT trigger touch or straddle faults if player is indicating', () => {
    const rule = new LaneDisciplineRule();
    const context = createMockContext({
      timeSeconds: 0,
      indicator: 'left',
      vehiclePose: { position: { x: 1.0, y: 0, z: 10 }, yawDegrees: 0 },
    });
    expect(rule.evaluate(context)).toBeNull();
  });

  it('should trigger lane.wrong_side_entry when entering opposing lane for more than 2s', () => {
    const rule = new LaneDisciplineRule();
    const oncomingLane = {
      id: 'oncoming_lane',
      fromNodeId: 'n2',
      toNodeId: 'n1',
      centerLine: [
        { x: 0, y: 0, z: 100 },
        { x: 0, y: 0, z: 0 }, // Lane centerline points backwards
      ],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 30,
      allowedTurns: [],
      oppositeLaneId: 'lane1',
    };

    // Player heading is forward (yaw = 0, vector = 0, 0, 1)
    // Lane heading is reverse (vector = 0, 0, -1)
    // Dot product = -1 < 0. Gear = D (drive).
    // Needs 2s of continuous violation.
    for (let t = 0; t < 2.0; t += 0.5) {
      const context = createMockContext({
        timeSeconds: t,
        deltaSeconds: 0.5,
        vehiclePose: { position: { x: 0, y: 0, z: 10 }, yawDegrees: 0 },
        currentLane: oncomingLane,
      });
      expect(rule.evaluate(context)).toBeNull();
    }

    const contextTrigger = createMockContext({
      timeSeconds: 2.0,
      deltaSeconds: 0.5,
      vehiclePose: { position: { x: 0, y: 0, z: 10 }, yawDegrees: 0 },
      currentLane: oncomingLane,
    });
    const fault = rule.evaluate(contextTrigger);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('lane.wrong_side_entry');
    expect(fault?.severity).toBe('dangerous');
  });

  it('should trigger lane.no_entry_or_reverse_direction when entering lane tagged no-entry for more than 1s', () => {
    const rule = new LaneDisciplineRule();
    const noEntryLane = {
      id: 'no_entry_lane',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      centerLine: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 100 },
      ],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 30,
      allowedTurns: [],
      tags: ['no-entry'],
    };

    // t = 0: enters lane, no fault yet
    expect(rule.evaluate(createMockContext({ timeSeconds: 0, deltaSeconds: 0.5, currentLane: noEntryLane }))).toBeNull();
    
    // t = 0.5: still in it
    expect(rule.evaluate(createMockContext({ timeSeconds: 0.5, deltaSeconds: 0.5, currentLane: noEntryLane }))).toBeNull();

    // t = 1.1: (> 1.0s), triggers fault
    const fault = rule.evaluate(createMockContext({ timeSeconds: 1.1, deltaSeconds: 0.6, currentLane: noEntryLane }));
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('lane.no_entry_or_reverse_direction');
    expect(fault?.severity).toBe('dangerous');
  });

  it('should trigger lane.turn_wrong_lane instantly when entering lane tagged wrong-turn-lane', () => {
    const rule = new LaneDisciplineRule();
    const wrongTurnLane = {
      id: 'wrong_turn_lane',
      fromNodeId: 'n2',
      toNodeId: 'n3',
      centerLine: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 100 },
      ],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 30,
      allowedTurns: [],
      tags: ['wrong-turn-lane'],
    };

    const fault = rule.evaluate(createMockContext({ timeSeconds: 0, currentLane: wrongTurnLane }));
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('lane.turn_wrong_lane');
    expect(fault?.severity).toBe('serious');
  });
});
