import { describe, it, expect } from 'vitest';
import { PedestrianAIManager } from '../../src/traffic/PedestrianAI';
import type { CrossingPath } from '../../src/traffic/PedestrianAI';

const crossingPath: CrossingPath = {
  crossingId: 'zebra-1',
  waitPosition: { x: -4.5, y: 0, z: 9.7 },
  startPosition: { x: -3.5, y: 0, z: 10 },
  endPosition: { x: 3.5, y: 0, z: 10 },
  widthMeters: 7,
};

describe('PedestrianAIManager', () => {
  it('should spawn a pedestrian in the specified initial state', () => {
    const manager = new PedestrianAIManager();
    const ped = manager.spawn('ped-1', crossingPath, 'waiting');

    expect(ped.id).toBe('ped-1');
    expect(ped.state).toBe('waiting');
    expect(ped.crossingId).toBe('zebra-1');
    expect(ped.progress).toBe(0);
    expect(ped.walkSpeedMps).toBeCloseTo(1.2, 1);
    expect(ped.boundingRadius).toBeCloseTo(0.3, 1);
  });

  it('should default to waiting state when no initial state specified', () => {
    const manager = new PedestrianAIManager();
    const ped = manager.spawn('ped-2', crossingPath);

    expect(ped.state).toBe('waiting');
  });

  it('should transition from waiting to crossing via triggerCrossing', () => {
    const manager = new PedestrianAIManager();
    manager.spawn('ped-3', crossingPath, 'waiting');

    const result = manager.triggerCrossing('ped-3');
    expect(result).toBe(true);

    const peds = manager.getPedestrians();
    expect(peds[0].state).toBe('crossing');
  });

  it('should advance crossing progress over time', () => {
    const manager = new PedestrianAIManager();
    manager.spawn('ped-4', crossingPath, 'waiting');
    manager.triggerCrossing('ped-4');

    manager.update(1.0);

    const ped = manager.getPedestrians()[0];
    expect(ped.state).toBe('crossing');
    expect(ped.progress).toBeGreaterThan(0);
  });

  it('should transition to exited when crossing completes', () => {
    const manager = new PedestrianAIManager();
    manager.spawn('ped-5', crossingPath, 'waiting');
    manager.triggerCrossing('ped-5');

    // Walk speed is ~1.2 m/s, crossing is 7m wide, so ~5.8 seconds
    manager.update(7);

    const ped = manager.getPedestrians()[0];
    expect(ped.state).toBe('exited');
    expect(ped.progress).toBeGreaterThanOrEqual(1.0);
  });

  it('should filter pedestrians by crossingId', () => {
    const manager = new PedestrianAIManager();
    manager.spawn('ped-a', crossingPath, 'waiting');
    manager.spawn('ped-b', { ...crossingPath, crossingId: 'zebra-2' }, 'waiting');

    const zebra1Peds = manager.getCrossingPedestrians('zebra-1');
    expect(zebra1Peds).toHaveLength(1);
    expect(zebra1Peds[0].id).toBe('ped-a');
  });

  it('should despawn a pedestrian', () => {
    const manager = new PedestrianAIManager();
    manager.spawn('ped-del', crossingPath, 'waiting');

    expect(manager.despawn('ped-del')).toBe(true);
    expect(manager.getPedestrians()).toHaveLength(0);
  });

  it('should not trigger crossing for non-waiting pedestrians', () => {
    const manager = new PedestrianAIManager();
    manager.spawn('ped-idle', crossingPath, 'idle');

    const result = manager.triggerCrossing('ped-idle');
    expect(result).toBe(false);
  });
});
