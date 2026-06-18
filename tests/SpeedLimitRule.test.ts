import { describe, expect, it } from 'vitest';
import { SpeedLimitRule } from '../src/rules/SpeedLimitRule';
import type { DrivingContext, DrivingFault } from '../src/rules/RuleEngine';

function createBaseContext(overrides: Partial<DrivingContext> = {}): DrivingContext {
  return {
    timeSeconds: 0,
    deltaSeconds: 0.1,
    vehiclePose: { position: { x: 0, y: 0, z: 0 }, yawDegrees: 0 },
    speedMph: 0,
    gear: 'drive',
    indicator: 'off',
    currentLane: {
      id: 'lane-1',
      fromNodeId: 'node-1',
      toNodeId: 'node-2',
      centerLine: [],
      widthMeters: 3.5,
      direction: 'forward',
      speedLimitMph: 30,
      allowedTurns: ['straight'],
    },
    ...overrides,
  };
}

describe('SpeedLimitRule', () => {
  it('does not trigger a fault when within the limit plus 3 mph', () => {
    const rule = new SpeedLimitRule();
    
    // 30 mph limit, speed is 33 mph (limit + 3)
    const ctx = createBaseContext({ speedMph: 33 });
    const fault = rule.evaluate(ctx);
    expect(fault).toBeNull();
  });

  it('triggers minor fault when exceeding limit + 3 to limit + 7 sustained for 1s', () => {
    const rule = new SpeedLimitRule();
    
    // Evaluate over a 1.2s period at 34 mph (limit 30)
    let fault: DrivingFault | null = null;
    for (let t = 0; t <= 1.2; t += 0.1) {
      const ctx = createBaseContext({ timeSeconds: t, speedMph: 34 });
      const f = rule.evaluate(ctx);
      if (f) fault = f;
    }
    
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('speed.limit.minor');
    expect(fault!.severity).toBe('minor');
  });

  it('does not trigger minor fault if not sustained for 1s', () => {
    const rule = new SpeedLimitRule();
    
    // Evaluate only for 0.8s
    let fault: DrivingFault | null = null;
    for (let t = 0; t <= 0.8; t += 0.1) {
      const ctx = createBaseContext({ timeSeconds: t, speedMph: 34 });
      fault = rule.evaluate(ctx);
    }
    
    expect(fault).toBeNull();
  });

  it('triggers major fault when exceeding limit + 7 to limit + 10 sustained for 1s', () => {
    const rule = new SpeedLimitRule();
    
    let fault: DrivingFault | null = null;
    for (let t = 0; t <= 1.2; t += 0.1) {
      const ctx = createBaseContext({ timeSeconds: t, speedMph: 38 });
      const f = rule.evaluate(ctx);
      if (f) fault = f;
    }
    
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('speed.limit.major');
    expect(fault!.severity).toBe('serious');
  });

  it('triggers dangerous fault instantly (no 1s delay) when exceeding limit + 10', () => {
    const rule = new SpeedLimitRule();
    
    // Limit 30, speed 41. Instant trigger.
    const ctx = createBaseContext({ timeSeconds: 0, speedMph: 41 });
    const fault = rule.evaluate(ctx);
    
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('speed.limit.dangerous');
    expect(fault!.severity).toBe('dangerous');
  });

  it('triggers dangerous fault instantly at 30+ mph in 20 mph school/residential zone', () => {
    const rule = new SpeedLimitRule();
    
    // Limit 20, speed 30, school zone trigger
    const ctx = createBaseContext({
      timeSeconds: 0,
      speedMph: 30,
      currentLane: {
        id: 'lane-1',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        centerLine: [],
        widthMeters: 3.5,
        direction: 'forward',
        speedLimitMph: 20,
        allowedTurns: [],
        tags: ['school'],
      },
    });
    const fault = rule.evaluate(ctx);
    
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('speed.limit.dangerous');
    expect(fault!.severity).toBe('dangerous');
  });

  it('allows 2-second grace period when entering a new speed zone', () => {
    const rule = new SpeedLimitRule();
    
    // First, establish we are in a 50 mph zone
    rule.evaluate(createBaseContext({
      timeSeconds: 0,
      speedMph: 45,
      currentLane: {
        id: 'lane-1',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        centerLine: [],
        widthMeters: 3.5,
        direction: 'forward',
        speedLimitMph: 50,
        allowedTurns: [],
      },
    }));

    // Enter a new 30 mph zone. Speed is 45 mph (well above 30 + 10 = 40, which would normally trigger dangerous instantly)
    // Within 2 seconds, no fault should be triggered.
    for (let t = 0.1; t < 2.0; t += 0.2) {
      const ctx = createBaseContext({
        timeSeconds: t,
        speedMph: 45,
        currentLane: {
          id: 'lane-2',
          fromNodeId: 'node-2',
          toNodeId: 'node-3',
          centerLine: [],
          widthMeters: 3.5,
          direction: 'forward',
          speedLimitMph: 30,
          allowedTurns: [],
        },
      });
      const fault = rule.evaluate(ctx);
      expect(fault).toBeNull();
    }

    // After 2.0s grace period, speeding checks resume. 45 mph is > 30 + 10, so dangerous triggers.
    const postGraceCtx = createBaseContext({
      timeSeconds: 2.1,
      speedMph: 45,
      currentLane: {
        id: 'lane-2',
        fromNodeId: 'node-2',
        toNodeId: 'node-3',
        centerLine: [],
        widthMeters: 3.5,
        direction: 'forward',
        speedLimitMph: 30,
        allowedTurns: [],
      },
    });
    const fault = rule.evaluate(postGraceCtx);
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('speed.limit.dangerous');
  });

  it('does not allow grace period in school zones', () => {
    const rule = new SpeedLimitRule();
    
    // First, establish we are in a 50 mph zone
    rule.evaluate(createBaseContext({
      timeSeconds: 0,
      speedMph: 45,
      currentLane: {
        id: 'lane-1',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        centerLine: [],
        widthMeters: 3.5,
        direction: 'forward',
        speedLimitMph: 50,
        allowedTurns: [],
      },
    }));

    // Enter a new 20 mph school zone. We are going 31 mph.
    // Dangerous speeding (30+ in 20 mph school zone) should trigger instantly even within 2 seconds.
    const ctx = createBaseContext({
      timeSeconds: 0.5,
      speedMph: 31,
      currentLane: {
        id: 'lane-2',
        fromNodeId: 'node-2',
        toNodeId: 'node-3',
        centerLine: [],
        widthMeters: 3.5,
        direction: 'forward',
        speedLimitMph: 20,
        allowedTurns: [],
        tags: ['school'],
      },
    });
    const fault = rule.evaluate(ctx);
    expect(fault).not.toBeNull();
    expect(fault!.ruleId).toBe('speed.limit.dangerous');
  });
});
