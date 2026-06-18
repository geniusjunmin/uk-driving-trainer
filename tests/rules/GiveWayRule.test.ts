import { describe, expect, it } from 'vitest';
import { GiveWayRule } from '../../src/rules/GiveWayRule';
import type { DrivingContext } from '../../src/rules/RuleEngine';
import type { PriorityRule, Lane } from '../../src/road/RoadTypes';

function createMockContext(overrides: Partial<DrivingContext> = {}): DrivingContext {
  const defaultLane: Lane = {
    id: 'controlled_lane',
    fromNodeId: 'n1',
    toNodeId: 'n2',
    centerLine: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 100 }, // Lane length = 100m, ends at z=100
    ],
    widthMeters: 3.5,
    direction: 'forward',
    speedLimitMph: 30,
    allowedTurns: [],
  };

  const defaultPriorityRule: PriorityRule = {
    id: 'pr_give_way',
    type: 'give-way',
    controlledLaneIds: ['controlled_lane'],
    priorityLaneIds: ['priority_lane'],
    minimumClearGapSeconds: 3.0,
  };

  return {
    timeSeconds: 0,
    deltaSeconds: 0.1,
    vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 0 },
    speedMph: 20,
    gear: 'drive',
    indicator: 'off',
    currentLane: defaultLane,
    priorityRules: [defaultPriorityRule],
    ...overrides,
  };
}

describe('GiveWayRule Unit Tests', () => {
  it('should not trigger faults when vehicle is far from the line', () => {
    const rule = new GiveWayRule();
    const context = createMockContext({
      vehiclePose: { position: { x: 0, y: 0, z: 10 }, yawDegrees: 0 },
      speedMph: 20,
    });
    expect(rule.evaluate(context)).toBeNull();
  });

  it('should trigger give_way.approach_too_fast when speed > 10 mph and within 15m of give-way line', () => {
    const rule = new GiveWayRule();
    // 86m from start means 14m from end of lane (100m)
    const context = createMockContext({
      timeSeconds: 1.0,
      vehiclePose: { position: { x: 0, y: 0, z: 86 }, yawDegrees: 0 },
      speedMph: 15,
    });

    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('give_way.approach_too_fast');
    expect(fault?.severity).toBe('serious');

    // Deduplication check: second evaluation should not trigger again
    const nextContext = createMockContext({
      timeSeconds: 1.1,
      vehiclePose: { position: { x: 0, y: 0, z: 87 }, yawDegrees: 0 },
      speedMph: 14,
    });
    expect(rule.evaluate(nextContext)).toBeNull();
  });

  it('should trigger stop.no_full_stop when crossing STOP line without stopping', () => {
    const rule = new GiveWayRule();
    const stopPriorityRule: PriorityRule = {
      id: 'pr_stop',
      type: 'stop',
      controlledLaneIds: ['controlled_lane'],
    };

    // Approach at 10 mph, distance to end = 1.0m (crossing)
    const context = createMockContext({
      timeSeconds: 1.0,
      priorityRules: [stopPriorityRule],
      vehiclePose: { position: { x: 0, y: 0, z: 99.0 }, yawDegrees: 0 },
      speedMph: 10,
    });

    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('stop.no_full_stop');
    expect(fault?.severity).toBe('dangerous');
  });

  it('should not trigger stop.no_full_stop when driver stops fully before crossing STOP line', () => {
    const rule = new GiveWayRule();
    const stopPriorityRule: PriorityRule = {
      id: 'pr_stop',
      type: 'stop',
      controlledLaneIds: ['controlled_lane'],
    };

    // 1. Simulate stopped at junction (dist to end = 4.0m, speed = 0) for 1.2s
    for (let t = 0; t <= 1.2; t += 0.2) {
      const stopCtx = createMockContext({
        timeSeconds: t,
        priorityRules: [stopPriorityRule],
        vehiclePose: { position: { x: 0, y: 0, z: 96.0 }, yawDegrees: 0 },
        speedMph: 0,
      });
      rule.evaluate(stopCtx);
    }

    // 2. Crosses line (speed = 5 mph, dist to end = 1.0m)
    const crossCtx = createMockContext({
      timeSeconds: 2.0,
      priorityRules: [stopPriorityRule],
      vehiclePose: { position: { x: 0, y: 0, z: 99.0 }, yawDegrees: 0 },
      speedMph: 5,
      observation: { checkedLeftMirror: true } // Check mirror to avoid observation missing fault
    });

    expect(rule.evaluate(crossCtx)).toBeNull();
  });

  it('should trigger give_way.fail_priority when crossing line with oncoming vehicle nearby', () => {
    const rule = new GiveWayRule();
    const priorityLane: Lane = {
      id: 'priority_lane',
      fromNodeId: 'pn1',
      toNodeId: 'pn2',
      centerLine: [
        { x: -50, y: 0, z: 100 },
        { x: 50, y: 0, z: 100 }, // Priority lane crosses the junction at z=100
      ],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 30,
      allowedTurns: [],
    };

    // Oncoming vehicle on priority lane is at x = -20m, speed is 20 mph (8.94 m/s)
    // Remaining distance along priority lane = 50 - (-20) = 70m.
    // Wait, end of priority lane centerline is at x = 50.
    // Remaining distance = 70m. Speed = 8.94 m/s. TTC = 70 / 8.94 = 7.83s. (Safe)
    // Let's place it at x = 40m (10m from end node pn2).
    // Remaining distance = 10m. Speed = 20 mph (8.94 m/s). TTC = 10 / 8.94 = 1.1s. (Unsafe!)
    const context = createMockContext({
      timeSeconds: 1.0,
      vehiclePose: { position: { x: 0, y: 0, z: 99.0 }, yawDegrees: 0 },
      speedMph: 5,
      nearbyLanes: [priorityLane],
      trafficVehicles: [
        {
          id: 'npc1',
          position: { x: 40, y: 0, z: 100 },
          speedMph: 20,
          laneId: 'priority_lane',
        },
      ],
    });

    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('give_way.fail_priority');
    expect(fault?.severity).toBe('dangerous');
  });

  it('should trigger give_way.line_roll_through when rolling through with moderate priority gap', () => {
    const rule = new GiveWayRule();
    const priorityLane: Lane = {
      id: 'priority_lane',
      fromNodeId: 'pn1',
      toNodeId: 'pn2',
      centerLine: [
        { x: -50, y: 0, z: 100 },
        { x: 50, y: 0, z: 100 },
      ],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 30,
      allowedTurns: [],
    };

    // Oncoming vehicle TTC = 35m / 8.94 m/s = 3.91s (between 3s and 5s, unsafe gap but not fail_priority instant failure)
    // Player speed is 8 mph (> 5 mph)
    const context = createMockContext({
      timeSeconds: 1.0,
      vehiclePose: { position: { x: 0, y: 0, z: 99.0 }, yawDegrees: 0 },
      speedMph: 8,
      nearbyLanes: [priorityLane],
      trafficVehicles: [
        {
          id: 'npc1',
          position: { x: 15, y: 0, z: 100 }, // 35m from end
          speedMph: 20,
          laneId: 'priority_lane',
        },
      ],
    });

    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('give_way.line_roll_through');
    expect(fault?.severity).toBe('serious');
  });

  it('should trigger stop.observation_missing when moving off after stopping without checking mirrors', () => {
    const rule = new GiveWayRule();

    // 1. Stopped at junction
    for (let t = 0; t <= 1.2; t += 0.2) {
      const stopCtx = createMockContext({
        timeSeconds: t,
        vehiclePose: { position: { x: 0, y: 0, z: 96.0 }, yawDegrees: 0 },
        speedMph: 0,
      });
      rule.evaluate(stopCtx);
    }

    // 2. Start moving off without mirror check
    const moveCtx = createMockContext({
      timeSeconds: 2.0,
      vehiclePose: { position: { x: 0, y: 0, z: 96.5 }, yawDegrees: 0 },
      speedMph: 3,
    });

    const fault = rule.evaluate(moveCtx);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('stop.observation_missing');
    expect(fault?.severity).toBe('serious');
  });

  it('should NOT trigger stop.observation_missing when driver checks mirrors before moving off', () => {
    const rule = new GiveWayRule();

    // 1. Stopped at junction
    for (let t = 0; t <= 1.2; t += 0.2) {
      const stopCtx = createMockContext({
        timeSeconds: t,
        vehiclePose: { position: { x: 0, y: 0, z: 96.0 }, yawDegrees: 0 },
        speedMph: 0,
      });
      rule.evaluate(stopCtx);
    }

    // 2. Perform left mirror check at t = 1.5s
    const checkCtx = createMockContext({
      timeSeconds: 1.5,
      vehiclePose: { position: { x: 0, y: 0, z: 96.0 }, yawDegrees: 0 },
      speedMph: 0,
      observation: { checkedLeftMirror: true }
    });
    rule.evaluate(checkCtx);

    // 3. Move off at t = 2.0s
    const moveCtx = createMockContext({
      timeSeconds: 2.0,
      vehiclePose: { position: { x: 0, y: 0, z: 96.5 }, yawDegrees: 0 },
      speedMph: 3,
    });

    expect(rule.evaluate(moveCtx)).toBeNull();
  });
});
