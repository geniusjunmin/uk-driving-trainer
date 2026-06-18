import { describe, expect, it } from 'vitest';
import { SpeedLimitRule } from '../../src/rules/SpeedLimitRule';
import { RuleEngine } from '../../src/rules/RuleEngine';
import { ScoringSystem } from '../../src/rules/ScoringSystem';
import type { DrivingContext, DrivingFault } from '../../src/rules/RuleEngine';

function createMockContext(overrides: Partial<DrivingContext> = {}): DrivingContext {
  return {
    timeSeconds: 0,
    deltaSeconds: 0.1,
    vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 0 },
    speedMph: 0,
    gear: 'drive',
    indicator: 'off',
    currentLane: {
      id: 'lane1',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      centerLine: [],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 30,
      allowedTurns: [],
    },
    ...overrides,
  };
}

describe('SpeedLimitRule Unit Tests', () => {
  it('covers QA-002 30 mph acceptance cases through RuleEngine and scoring', () => {
    const createEngine = () => {
      const engine = new RuleEngine();
      engine.addRule(new SpeedLimitRule());
      return engine;
    };

    const processFaults = (faults: readonly DrivingFault[], timeSeconds: number) => {
      const scoring = new ScoringSystem();
      scoring.startLevel('qa-002', 0);
      scoring.processFaults(faults, timeSeconds);
      return scoring.getCurrentRecord();
    };

    const safeEngine = createEngine();
    expect(
      safeEngine.update(createMockContext({ timeSeconds: 1, speedMph: 25 }))
    ).toHaveLength(0);

    const minorEngine = createEngine();
    expect(minorEngine.update(createMockContext({ timeSeconds: 0, speedMph: 35 }))).toHaveLength(
      0
    );
    const minorFaults = minorEngine.update(createMockContext({ timeSeconds: 1, speedMph: 35 }));
    expect(minorFaults).toHaveLength(1);
    expect(minorFaults[0]).toMatchObject({
      ruleId: 'speed.limit.minor',
      severity: 'minor',
      laneId: 'lane1',
    });
    expect(minorFaults[0].message).toEqual(expect.stringContaining('35.0 mph'));
    expect(processFaults(minorFaults, 1)?.score).toBe(97);

    const severeEngine = createEngine();
    const severeFaults = severeEngine.update(createMockContext({ timeSeconds: 1, speedMph: 45 }));
    expect(severeFaults).toHaveLength(1);
    expect(severeFaults[0]).toMatchObject({
      ruleId: 'speed.limit.dangerous',
      severity: 'dangerous',
      laneId: 'lane1',
    });
    expect(severeFaults[0].message).toEqual(expect.stringContaining('45.0 mph'));
    expect(processFaults(severeFaults, 1)?.score).toBe(90);
  });

  it('should not trigger faults when driving under or within the buffer limit (+3 mph)', () => {
    const rule = new SpeedLimitRule();

    // 30 mph limit, driving at 33 mph
    for (let t = 0; t <= 3; t += 0.5) {
      const context = createMockContext({ timeSeconds: t, speedMph: 33 });
      expect(rule.evaluate(context)).toBeNull();
    }

    // 20 mph limit, driving at 22 mph
    const rule2 = new SpeedLimitRule();
    for (let t = 0; t <= 3; t += 0.5) {
      const context = createMockContext({
        timeSeconds: t,
        speedMph: 22,
        currentLane: {
          id: 'lane_20',
          fromNodeId: 'n1',
          toNodeId: 'n2',
          centerLine: [],
          widthMeters: 3.5,
          direction: 'forward',
          speedLimitMph: 20,
          allowedTurns: [],
        },
      });
      expect(rule2.evaluate(context)).toBeNull();
    }
  });

  it('should trigger speed.limit.minor when speed is between limit+3 and limit+7 for 1s', () => {
    const rule = new SpeedLimitRule();

    // 30 mph limit, speed 34 mph
    // At t = 0, start speeding
    expect(rule.evaluate(createMockContext({ timeSeconds: 0, speedMph: 34 }))).toBeNull();
    expect(rule.evaluate(createMockContext({ timeSeconds: 0.5, speedMph: 34 }))).toBeNull();

    // At t = 1.0, has been speeding for 1.0s
    const fault = rule.evaluate(createMockContext({ timeSeconds: 1.0, speedMph: 34 }));
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('speed.limit.minor');
    expect(fault?.severity).toBe('minor');
  });

  it('should trigger speed.limit.major when speed is between limit+7 and limit+10 for 1s', () => {
    const rule = new SpeedLimitRule();

    // 30 mph limit, speed 38 mph
    expect(rule.evaluate(createMockContext({ timeSeconds: 0, speedMph: 38 }))).toBeNull();
    expect(rule.evaluate(createMockContext({ timeSeconds: 0.5, speedMph: 38 }))).toBeNull();

    // At t = 1.0, has been speeding for 1.0s
    const fault = rule.evaluate(createMockContext({ timeSeconds: 1.0, speedMph: 38 }));
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('speed.limit.major');
    expect(fault?.severity).toBe('serious');
  });

  it('should trigger speed.limit.dangerous instantly when speed is above limit+10', () => {
    const rule = new SpeedLimitRule();

    // 30 mph limit, speed 41 mph
    const fault = rule.evaluate(createMockContext({ timeSeconds: 0, speedMph: 41 }));
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('speed.limit.dangerous');
    expect(fault?.severity).toBe('dangerous');
  });

  it('should trigger speed.limit.dangerous instantly in 20 mph school zone when speed is >= 30 mph', () => {
    const rule = new SpeedLimitRule();

    // 20 mph limit, school zone tag on lane, speed 30 mph
    const fault = rule.evaluate(
      createMockContext({
        timeSeconds: 0,
        speedMph: 30,
        currentLane: {
          id: 'school_lane',
          fromNodeId: 'n1',
          toNodeId: 'n2',
          centerLine: [],
          widthMeters: 3.5,
          direction: 'forward',
          speedLimitMph: 20,
          allowedTurns: [],
          tags: ['school-zone'],
        },
      })
    );
    expect(fault).not.toBeNull();
    expect(fault?.ruleId).toBe('speed.limit.dangerous');
    expect(fault?.severity).toBe('dangerous');
  });

  it('should respect the 8s cooldown and not trigger multiple faults of the same level within 8s', () => {
    const rule = new SpeedLimitRule();

    // t = 0: speed 34 (starts)
    rule.evaluate(createMockContext({ timeSeconds: 0, speedMph: 34 }));
    // t = 1.0: triggers minor
    const f1 = rule.evaluate(createMockContext({ timeSeconds: 1.0, speedMph: 34 }));
    expect(f1?.ruleId).toBe('speed.limit.minor');

    // t = 2.0 to 8.0: still speeding at 34, should not trigger again (cooldown is 8s)
    for (let t = 2.0; t < 9.0; t += 1.0) {
      expect(rule.evaluate(createMockContext({ timeSeconds: t, speedMph: 34 }))).toBeNull();
    }

    // t = 9.0: (8.0s after the trigger at t = 1.0), should trigger again
    const f2 = rule.evaluate(createMockContext({ timeSeconds: 9.0, speedMph: 34 }));
    expect(f2?.ruleId).toBe('speed.limit.minor');
  });

  it('should reset triggers and cooldowns when vehicle speed drops below limit+1', () => {
    const rule = new SpeedLimitRule();

    // t = 0: starts speeding
    rule.evaluate(createMockContext({ timeSeconds: 0, speedMph: 34 }));
    // t = 1.0: triggers minor
    expect(rule.evaluate(createMockContext({ timeSeconds: 1.0, speedMph: 34 }))?.ruleId).toBe(
      'speed.limit.minor'
    );

    // t = 2.0: drops speed below limit + 1 (speed 30 mph for a 30 mph limit)
    expect(rule.evaluate(createMockContext({ timeSeconds: 2.0, speedMph: 30 }))).toBeNull();

    // t = 3.0: speeds up again to 34 mph
    expect(rule.evaluate(createMockContext({ timeSeconds: 3.0, speedMph: 34 }))).toBeNull();
    // t = 4.0: (only 3.0s after first trigger, but since we reset, it should trigger again after 1.0s)
    const fault = rule.evaluate(createMockContext({ timeSeconds: 4.0, speedMph: 34 }));
    expect(fault?.ruleId).toBe('speed.limit.minor');
  });

  it('should support the 2s grace period when entering a new lower speed limit zone', () => {
    const rule = new SpeedLimitRule();

    const lane30 = {
      id: 'lane30',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      centerLine: [],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 30,
      allowedTurns: [],
    };
    const lane20 = {
      id: 'lane20',
      fromNodeId: 'n2',
      toNodeId: 'n3',
      centerLine: [],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 20,
      allowedTurns: [],
    };

    // t = 0: driving at 25 mph in 30 mph zone (OK)
    expect(rule.evaluate(createMockContext({ timeSeconds: 0, speedMph: 25, currentLane: lane30 }))).toBeNull();

    // t = 1.0: enters 20 mph zone, still driving at 25 mph. (limit + 5 -> minor range)
    // Should have 2s grace period, so no faults yet
    expect(rule.evaluate(createMockContext({ timeSeconds: 1.0, speedMph: 25, currentLane: lane20 }))).toBeNull();
    expect(rule.evaluate(createMockContext({ timeSeconds: 2.0, speedMph: 25, currentLane: lane20 }))).toBeNull();
    // At t = 2.9 (still < 2s grace period which ends at t = 3.0)
    expect(rule.evaluate(createMockContext({ timeSeconds: 2.9, speedMph: 25, currentLane: lane20 }))).toBeNull();

    // Grace period ends at t = 3.0. Speed limit violation check starts.
    // Needs 1.0s of continuous violation to trigger minor.
    expect(rule.evaluate(createMockContext({ timeSeconds: 3.5, speedMph: 25, currentLane: lane20 }))).toBeNull();
    // At t = 4.5 (1.0s after the first post-grace overspeed sample), minor fault should trigger
    const fault = rule.evaluate(createMockContext({ timeSeconds: 4.5, speedMph: 25, currentLane: lane20 }));
    expect(fault?.ruleId).toBe('speed.limit.minor');
  });

  it('should NOT allow a grace period when entering a speed limit zone in a school zone', () => {
    const rule = new SpeedLimitRule();

    const lane30 = {
      id: 'lane30',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      centerLine: [],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 30,
      allowedTurns: [],
    };
    const schoolLane20 = {
      id: 'school_lane20',
      fromNodeId: 'n2',
      toNodeId: 'n3',
      centerLine: [],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 20,
      allowedTurns: [],
      tags: ['school-zone'],
    };

    // t = 0: driving at 25 mph in 30 mph zone (OK)
    expect(rule.evaluate(createMockContext({ timeSeconds: 0, speedMph: 25, currentLane: lane30 }))).toBeNull();

    // t = 1.0: enters 20 mph school zone, driving at 25 mph.
    // Grace period should be excluded.
    expect(rule.evaluate(createMockContext({ timeSeconds: 1.0, speedMph: 25, currentLane: schoolLane20 }))).toBeNull();
    // At t = 2.0 (1.0s of speeding, since no grace period), minor fault should trigger
    const fault = rule.evaluate(createMockContext({ timeSeconds: 2.0, speedMph: 25, currentLane: schoolLane20 }));
    expect(fault?.ruleId).toBe('speed.limit.minor');
  });
});
