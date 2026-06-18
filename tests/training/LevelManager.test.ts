import { describe, expect, it, vi } from 'vitest';
import { LevelManager } from '../../src/training/LevelManager';
import type { DrivingContext } from '../../src/rules/RuleEngine';

function createBaseContext(overrides: Partial<DrivingContext> = {}): DrivingContext {
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

describe('LevelManager Integration Tests', () => {
  it('should initialize game systems, trigger rules, update HUD, and show ResultsPanel on completion', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const onRetry = vi.fn();
    const onNextLevel = vi.fn();
    const onMainMenu = vi.fn();

    const manager = new LevelManager(parent, {
      onRetry,
      onNextLevel,
      onMainMenu,
    });

    // 1. Start Level 1
    manager.startLevel('level-1', 10.0);
    manager.update(createBaseContext({ timeSeconds: 10.0 }));

    const record = manager.getScoringSystem().getCurrentRecord();
    expect(record).not.toBeNull();
    expect(record?.levelId).toBe('level-1');
    expect(record?.score).toBe(100);

    const hudMsg = parent.querySelector('#hud-coach-message');
    expect(hudMsg).not.toBeNull();
    expect(hudMsg?.querySelector('.hud-coach-message__zh')?.textContent).toContain('欢迎来到英国');

    // 2. Simulate speeding violation (Limit 30, speed 45 -> dangerous speeding fault triggers instantly)
    const speedingCtx = createBaseContext({
      timeSeconds: 12.0,
      speedMph: 45,
    });
    manager.update(speedingCtx);

    // Score should drop by -10 points (dangerous severity)
    expect(record?.score).toBe(90);
    expect(record?.faults.length).toBe(1);
    expect(record?.faults[0].ruleId).toBe('speed.limit.dangerous');

    // HUD should show the speeding warning message
    expect(hudMsg?.querySelector('.hud-coach-message__zh')?.textContent).toContain('严重超速');

    // 3. Check trigger zone pre-hints (should be overridden by active fault warning)
    const preHintCtx = createBaseContext({
      timeSeconds: 13.0,
      speedMph: 20, // speed is fine now
      activeTriggerZones: [{ id: 'L1_gentle_bend', bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } }],
    });
    manager.update(preHintCtx);

    // Fault occurred at 12.0s. It should still display fault message at 13.0s (under 5s override window)
    expect(hudMsg?.querySelector('.hud-coach-message__zh')?.textContent).toContain('严重超速');

    // 4. Move past the 5s override window (at 18.0s)
    const clearCtx = createBaseContext({
      timeSeconds: 18.0,
      speedMph: 20,
      activeTriggerZones: [{ id: 'L1_gentle_bend', bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } }],
    });
    manager.update(clearCtx);

    // Should now display the pre-hint for the gentle bend
    expect(hudMsg?.querySelector('.hud-coach-message__zh')?.textContent).toContain('前方缓弯');

    // 5. Complete Level 1 (at 20.0s)
    manager.completeLevel(20.0);

    expect(record?.endTimeSeconds).toBe(20.0);
    // score 90 >= pass threshold 80 -> should PASS
    expect(record?.isPassed).toBe(true);

    const overlay = parent.querySelector('.results-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelector('.results-status.passed')?.textContent).toContain('评估通过');

    manager.dispose();
    document.body.removeChild(parent);
  });

  it('should trigger instant failure when dangerous faults count >= 2', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const manager = new LevelManager(parent, {
      onRetry: vi.fn(),
    });

    manager.startLevel('level-1', 0.0);

    // Trigger first dangerous fault (wrong side entry 2.0s)
    const oncomingLane = {
      id: 'oncoming_lane',
      fromNodeId: 'n2',
      toNodeId: 'n1',
      centerLine: [{ x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: 0 }],
      widthMeters: 3.5,
      direction: 'forward' as const,
      speedLimitMph: 30,
      allowedTurns: [],
      oppositeLaneId: 'lane1',
    };

    // 2.0 seconds of wrong-way driving
    manager.update(createBaseContext({ timeSeconds: 0.0, currentLane: oncomingLane }));
    manager.update(createBaseContext({ timeSeconds: 2.0, currentLane: oncomingLane }));

    expect(manager.getScoringSystem().getCurrentRecord()?.score).toBe(90); // -10 points

    // Trigger second dangerous fault (dangerous speeding > limit + 10)
    manager.update(createBaseContext({ timeSeconds: 10.0, speedMph: 45 }));

    // Scoring system should have triggered automatic complete due to 2 dangerous faults
    const record = manager.getScoringSystem().getCurrentRecord();
    expect(record?.isPassed).toBe(false);
    expect(parent.querySelector('.results-status.failed')).not.toBeNull();

    manager.dispose();
    document.body.removeChild(parent);
  });
});
