import { describe, expect, it } from 'vitest';
import { RoundaboutRule } from '../../src/rules/RoundaboutRule';
import type { DrivingContext } from '../../src/rules/RuleEngine';
import type { PriorityRule, Lane } from '../../src/road/RoadTypes';

function createMockContext(overrides: Partial<DrivingContext> = {}): DrivingContext {
  const defaultLane: Lane = {
    id: 'roundabout_entry_lane',
    fromNodeId: 'n1',
    toNodeId: 'n2',
    centerLine: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 100 }, // ends at z=100
    ],
    widthMeters: 3.5,
    direction: 'forward',
    speedLimitMph: 30,
    allowedTurns: [],
    tags: ['roundabout-entry'],
  };

  const defaultPriorityRule: PriorityRule = {
    id: 'pr_roundabout',
    type: 'roundabout-give-right',
    controlledLaneIds: ['roundabout_entry_lane'],
    priorityLaneIds: ['roundabout_circle_lane'],
    minimumClearGapSeconds: 3.0,
  };

  return {
    timeSeconds: 0,
    deltaSeconds: 0.1,
    vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 0 },
    speedMph: 12,
    gear: 'drive',
    indicator: 'off',
    currentLane: defaultLane,
    priorityRules: [defaultPriorityRule],
    ...overrides,
  };
}

describe('RoundaboutRule Unit Tests', () => {
  it('should not trigger faults when vehicle is far from entrance', () => {
    const rule = new RoundaboutRule();
    const context = createMockContext({
      vehiclePose: { position: { x: 0, y: 0, z: 10 }, yawDegrees: 0 },
      speedMph: 12,
    });
    expect(rule.evaluate(context)).toBeNull();
  });

  it('should trigger roundabout.entry_too_fast when speed > 15 mph and within 15m of entrance', () => {
    const rule = new RoundaboutRule();
    const context = createMockContext({
      timeSeconds: 1.0,
      vehiclePose: { position: { x: 0, y: 0, z: 88 }, yawDegrees: 0 },
      speedMph: 18,
    });

    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('roundabout.entry_too_fast');
    expect(fault?.severity).toBe('serious');
  });

  it('should trigger roundabout.fail_give_right when entering roundabout with oncoming circle traffic', () => {
    const rule = new RoundaboutRule();
    const circleLane: Lane = {
      id: 'roundabout_circle_lane',
      fromNodeId: 'cn1',
      toNodeId: 'cn2',
      centerLine: [
        { x: -20, y: 0, z: 100 },
        { x: 20, y: 0, z: 100 },
      ],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 30,
      allowedTurns: [],
    };

    // Oncoming vehicle TTC = 10m / 8.94 m/s = 1.1s (unsafe!)
    const context = createMockContext({
      timeSeconds: 1.0,
      vehiclePose: { position: { x: 0, y: 0, z: 99.0 }, yawDegrees: 0 },
      speedMph: 10,
      nearbyLanes: [circleLane],
      trafficVehicles: [
        {
          id: 'npc1',
          position: { x: 10, y: 0, z: 100 }, // 10m from end
          speedMph: 20,
          laneId: 'roundabout_circle_lane',
        },
      ],
    });

    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('roundabout.fail_give_right');
    expect(fault?.severity).toBe('dangerous');
  });

  it('should trigger wrong approach signals based on roundabout task exit target', () => {
    const rule1 = new RoundaboutRule();
    // 1. Task Exit 1, but no left indicator
    const ctx1 = createMockContext({
      roundaboutTaskExit: 1,
      vehiclePose: { position: { x: 0, y: 0, z: 90 }, yawDegrees: 0 },
      indicator: 'off',
    });
    expect(rule1.evaluate(ctx1)?.ruleId).toBe('roundabout.wrong_signal_first_exit');

    const rule2 = new RoundaboutRule();
    // 2. Task Exit 2, but has right indicator on approach (straight ahead should be off)
    const ctx2 = createMockContext({
      roundaboutTaskExit: 2,
      vehiclePose: { position: { x: 0, y: 0, z: 90 }, yawDegrees: 0 },
      indicator: 'right',
    });
    expect(rule2.evaluate(ctx2)?.ruleId).toBe('roundabout.wrong_signal_straight');

    const rule3 = new RoundaboutRule();
    // 3. Task Exit 3, but has no right indicator
    const ctx3 = createMockContext({
      roundaboutTaskExit: 3,
      vehiclePose: { position: { x: 0, y: 0, z: 90 }, yawDegrees: 0 },
      indicator: 'off',
    });
    expect(rule3.evaluate(ctx3)?.ruleId).toBe('roundabout.wrong_signal_right');
  });

  it('should trigger wrong inside signals based on passed exits', () => {
    const roundaboutCircleLane: Lane = {
      id: 'circle_lane',
      fromNodeId: 'c1',
      toNodeId: 'c2',
      centerLine: [
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 0, z: 50 },
      ],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 20,
      allowedTurns: [],
      tags: ['roundabout-circle'],
    };

    const rule1 = new RoundaboutRule();
    // Exit 2, inside roundabout, before Exit 1: indicator should not be active (left or right)
    const ctx1 = createMockContext({
      currentLane: roundaboutCircleLane,
      roundaboutTaskExit: 2,
      passedExit1: false,
      indicator: 'right',
    });
    expect(rule1.evaluate(ctx1)?.ruleId).toBe('roundabout.wrong_signal_straight');

    const rule2 = new RoundaboutRule();
    // Exit 2, inside roundabout, after Exit 1: indicator MUST be left
    const ctx2 = createMockContext({
      currentLane: roundaboutCircleLane,
      roundaboutTaskExit: 2,
      passedExit1: true,
      indicator: 'off',
    });
    expect(rule2.evaluate(ctx2)?.ruleId).toBe('roundabout.wrong_signal_straight');

    const rule3 = new RoundaboutRule();
    // Exit 3, inside roundabout, before Exit 2: indicator MUST be right
    const ctx3 = createMockContext({
      currentLane: roundaboutCircleLane,
      roundaboutTaskExit: 3,
      passedExit2: false,
      indicator: 'off',
    });
    expect(rule3.evaluate(ctx3)?.ruleId).toBe('roundabout.wrong_signal_right');

    const rule4 = new RoundaboutRule();
    // Exit 3, inside roundabout, after Exit 2: indicator MUST be left
    const ctx4 = createMockContext({
      currentLane: roundaboutCircleLane,
      roundaboutTaskExit: 3,
      passedExit2: true,
      indicator: 'right',
    });
    expect(rule4.evaluate(ctx4)?.ruleId).toBe('roundabout.wrong_signal_right');
  });

  it('should trigger wrong exit rule if player takes wrong exit for 10s', () => {
    const rule = new RoundaboutRule();
    const wrongExitLane: Lane = {
      id: 'exit3_lane',
      fromNodeId: 'ex1',
      toNodeId: 'ex2',
      centerLine: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 30,
      allowedTurns: [],
      tags: ['roundabout-exit'],
    };

    // Expected exit is 2, but enters exit3_lane
    // Simulate staying in it for 10.0 seconds
    for (let t = 0; t < 10.0; t += 1.0) {
      const ctx = createMockContext({
        timeSeconds: t,
        currentLane: wrongExitLane,
        roundaboutTaskExit: 2,
      });
      expect(rule.evaluate(ctx)).toBeNull();
    }

    const triggerCtx = createMockContext({
      timeSeconds: 10.0,
      currentLane: wrongExitLane,
      roundaboutTaskExit: 2,
    });
    const fault = rule.evaluate(triggerCtx);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('roundabout.wrong_exit');
    expect(fault?.severity).toBe('serious');
  });

  it('should trigger lane cutting when driving too close to roundabout center', () => {
    const rule = new RoundaboutRule();
    const roundaboutCircleLane: Lane = {
      id: 'circle_lane',
      fromNodeId: 'c1',
      toNodeId: 'c2',
      centerLine: [
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 0, z: 50 },
      ],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 20,
      allowedTurns: [],
      tags: ['roundabout-circle'],
    };

    // Center is (0, 0, 0). Player is at (2, 0, 2) which has distance = sqrt(8) = 2.82m < 4.5m
    const context = createMockContext({
      currentLane: roundaboutCircleLane,
      vehiclePose: { position: { x: 2, y: 0, z: 2 }, yawDegrees: 45 },
    });

    const fault = rule.evaluate(context);
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('roundabout.lane_cutting');
    expect(fault?.severity).toBe('serious');
  });
});
