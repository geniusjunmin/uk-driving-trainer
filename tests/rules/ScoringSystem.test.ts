import { describe, expect, it } from 'vitest';
import { ScoringSystem } from '../../src/rules/ScoringSystem';
import type { DrivingFault } from '../../src/rules/RuleEngine';

function createMockFault(overrides: Partial<DrivingFault> = {}): DrivingFault {
  return {
    id: 'fault-1',
    ruleId: 'speed.limit.minor',
    severity: 'minor',
    message: 'speeding minor',
    occurredAtSeconds: 1.0,
    zoneId: 'zone1',
    ...overrides,
  };
}

describe('ScoringSystem Unit Tests', () => {
  it('should initialize level with 100 points and record faults', () => {
    const system = new ScoringSystem();
    system.startLevel('level_1', 0.0);

    const record = system.getCurrentRecord();
    expect(record).not.toBeNull();
    expect(record?.score).toBe(100);
    expect(record?.faults.length).toBe(0);

    // Add a minor fault (-3)
    const f1 = createMockFault({ id: 'f1', ruleId: 'lane.keep_left.drift', severity: 'minor' });
    const processed = system.processFaults([f1], 1.0);

    expect(processed.length).toBe(1);
    expect(record?.score).toBe(97);
    expect(record?.faults[0].ruleId).toBe('lane.keep_left.drift');
  });

  it('should ignore duplicate faults within cooldown period', () => {
    const system = new ScoringSystem();
    system.startLevel('level_1', 0.0);

    const f1 = createMockFault({ id: 'f1', ruleId: 'lane.keep_left.drift', severity: 'minor', occurredAtSeconds: 1.0 });
    const f2 = createMockFault({ id: 'f2', ruleId: 'lane.keep_left.drift', severity: 'minor', occurredAtSeconds: 5.0 }); // within 8s cooldown
    const f3 = createMockFault({ id: 'f3', ruleId: 'lane.keep_left.drift', severity: 'minor', occurredAtSeconds: 10.0 }); // after 8s cooldown

    // Trigger first fault
    expect(system.processFaults([f1], 1.0).length).toBe(1);
    expect(system.getCurrentRecord()?.score).toBe(97);

    // Trigger second fault within cooldown (should be ignored)
    expect(system.processFaults([f2], 5.0).length).toBe(0);
    expect(system.getCurrentRecord()?.score).toBe(97);

    // Trigger third fault after cooldown (should be processed)
    expect(system.processFaults([f3], 10.0).length).toBe(1);
    expect(system.getCurrentRecord()?.score).toBe(94);
  });

  it('should upgrade speed.limit.minor to speed.limit.major and adjust score difference', () => {
    const system = new ScoringSystem();
    system.startLevel('level_1', 0.0);

    const minorFault = createMockFault({
      id: 'f-minor',
      ruleId: 'speed.limit.minor',
      severity: 'minor',
      zoneId: 'zone1',
      occurredAtSeconds: 1.0,
    });

    const majorFault = createMockFault({
      id: 'f-major',
      ruleId: 'speed.limit.major',
      severity: 'serious',
      zoneId: 'zone1',
      occurredAtSeconds: 3.0,
    });

    // 1. Process minor fault (-3 points)
    system.processFaults([minorFault], 1.0);
    expect(system.getCurrentRecord()?.score).toBe(97);
    expect(system.getCurrentRecord()?.faults.length).toBe(1);
    expect(system.getCurrentRecord()?.faults[0].ruleId).toBe('speed.limit.minor');

    // 2. Process major fault (upgrade minor, net deduction should be -5 in total, score = 95)
    const processed = system.processFaults([majorFault], 3.0);
    expect(processed.length).toBe(1);
    expect(system.getCurrentRecord()?.score).toBe(95);
    expect(system.getCurrentRecord()?.faults.length).toBe(1);
    expect(system.getCurrentRecord()?.faults[0].ruleId).toBe('speed.limit.major');
  });

  it('should evaluate pass/fail criteria correctly', () => {
    const system = new ScoringSystem();
    system.startLevel('level_1', 0.0);

    // Pass threshold 80, fail threshold 60
    // Initial state: passes because score=100
    system.evaluatePassFail(80, 60);
    expect(system.getCurrentRecord()?.isPassed).toBe(true);

    // Deduct down to 70 (between thresholds)
    // 3 major faults (3 * -5 = -15) -> score = 85. Still >= passThreshold (80) -> passes
    const f1 = createMockFault({ id: 'f1', ruleId: 'lane.line_straddle', severity: 'serious' });
    const f2 = createMockFault({ id: 'f2', ruleId: 'lane.line_straddle', severity: 'serious' });
    const f3 = createMockFault({ id: 'f3', ruleId: 'lane.line_straddle', severity: 'serious' });
    system.processFaults([f1], 1.0);
    system.processFaults([f2], 10.0);
    system.processFaults([f3], 20.0);
    system.evaluatePassFail(80, 60);
    expect(system.getCurrentRecord()?.score).toBe(85);
    expect(system.getCurrentRecord()?.isPassed).toBe(true);

    // Deduct to 77 (below pass threshold 80, above fail threshold 60) -> fails because < passThreshold
    const f4 = createMockFault({ id: 'f4', ruleId: 'lane.line_straddle', severity: 'serious' });
    system.processFaults([f4], 30.0);
    system.evaluatePassFail(80, 60);
    expect(system.getCurrentRecord()?.score).toBe(80); // wait, 85 - 5 = 80. Still exactly passThreshold -> passes
    
    const f5 = createMockFault({ id: 'f5', ruleId: 'lane.line_straddle', severity: 'serious' });
    system.processFaults([f5], 40.0);
    system.evaluatePassFail(80, 60);
    expect(system.getCurrentRecord()?.score).toBe(75); // < 80, so should be failed!
    expect(system.getCurrentRecord()?.isPassed).toBe(false);

    // Instant fail condition: dangerous faults >= 2
    system.startLevel('level_1', 0.0);
    const fd1 = createMockFault({ id: 'fd1', ruleId: 'lane.wrong_side_entry', severity: 'dangerous' });
    const fd2 = createMockFault({ id: 'fd2', ruleId: 'roundabout.fail_give_right', severity: 'dangerous' });
    system.processFaults([fd1], 1.0); // score = 90
    system.processFaults([fd2], 10.0); // score = 80
    
    // Score is 80 (>= passThreshold 80) but there are 2 dangerous faults -> should FAIL
    system.evaluatePassFail(80, 60);
    expect(system.getCurrentRecord()?.isPassed).toBe(false);

    // Instant fail condition: instantFailCount > 0
    system.startLevel('level_1', 0.0);
    system.evaluatePassFail(80, 60, 1);
    expect(system.getCurrentRecord()?.isPassed).toBe(false);
  });
});
