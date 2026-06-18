import { describe, expect, it } from 'vitest';
import { TrafficAIManager, getLaneLength } from '../../src/traffic/TrafficAI';
import { RoadGraphManager } from '../../src/road/RoadGraphManager';
import type { RoadGraph, Lane } from '../../src/road/RoadTypes';

function createMockRoadGraph(): RoadGraph {
  const lane1: Lane = {
    id: 'lane1',
    fromNodeId: 'n1',
    toNodeId: 'n2',
    centerLine: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 10 }, // length = 10m
    ],
    widthMeters: 3.5,
    direction: 'forward',
    speedLimitMph: 30,
    allowedTurns: [],
  };

  const lane2: Lane = {
    id: 'lane2',
    fromNodeId: 'n2',
    toNodeId: 'n3',
    centerLine: [
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 30 }, // length = 20m
    ],
    widthMeters: 3.5,
    direction: 'forward',
    speedLimitMph: 30,
    allowedTurns: [],
  };

  return {
    id: 'test_graph',
    version: 1,
    units: 'meters',
    upAxis: 'y',
    nodes: [
      { id: 'n1', position: { x: 0, y: 0, z: 0 } },
      { id: 'n2', position: { x: 0, y: 0, z: 10 } },
      { id: 'n3', position: { x: 0, y: 0, z: 30 } },
    ],
    lanes: [lane1, lane2],
    junctions: [],
    roadSigns: [],
    triggerZones: [],
  };
}

describe('TrafficAI Unit Tests', () => {
  it('should spawn a vehicle at the correct location', () => {
    const manager = new TrafficAIManager();
    const graph = createMockRoadGraph();
    const lane1 = graph.lanes[0];

    // Spawn at 5m along lane1
    const vehicle = manager.spawnVehicle('car1', lane1, 5, 20);
    expect(vehicle.id).toBe('car1');
    expect(vehicle.progress).toBe(5);
    expect(vehicle.position.z).toBeCloseTo(5);
    expect(vehicle.heading.z).toBeCloseTo(1);
  });

  it('should move vehicle forward based on elapsed time and speed', () => {
    const manager = new TrafficAIManager();
    const rgm = new RoadGraphManager();
    const graph = createMockRoadGraph();
    rgm.load(graph);

    const lane1 = graph.lanes[0];
    manager.spawnVehicle('car1', lane1, 0, 22.37); // 22.37 mph ≈ 10.0 m/s

    // Move by 0.5s -> should progress by 5.0m
    manager.update(0.5, rgm);

    const vehicles = manager.getVehicles();
    expect(vehicles[0].progress).toBeCloseTo(5.0);
    expect(vehicles[0].position.z).toBeCloseTo(5.0);
  });

  it('should transition to successor lane when reaching end of lane', () => {
    const manager = new TrafficAIManager();
    const rgm = new RoadGraphManager();
    const graph = createMockRoadGraph();
    rgm.load(graph);

    const lane1 = graph.lanes[0];
    // Spawns at 8.0m (2.0m from end of lane1 which is 10.0m)
    manager.spawnVehicle('car1', lane1, 8.0, 22.37); // 10.0 m/s

    // Move by 0.5s -> total progress change is 5.0m
    // Remaining in lane1: 2.0m -> leaves 3.0m spillover into lane2
    manager.update(0.5, rgm);

    const vehicles = manager.getVehicles();
    expect(vehicles[0].currentLane.id).toBe('lane2');
    expect(vehicles[0].progress).toBeCloseTo(3.0);
    expect(vehicles[0].position.z).toBeCloseTo(13.0); // 10 + 3 = 13
  });

  it('should wrap back to the start if reaching a dead end with no successor', () => {
    const manager = new TrafficAIManager();
    const rgm = new RoadGraphManager();
    const graph = createMockRoadGraph();
    rgm.load(graph);

    const lane2 = graph.lanes[1]; // Ends at z=30, length = 20m, no successors
    // Spawns at 18.0m (2.0m from end of lane2)
    manager.spawnVehicle('car1', lane2, 18.0, 22.37); // 10.0 m/s

    // Move by 0.5s (5m progress) -> exceeds lane length (20m) by 3m. Dead end -> wraps to start (progress = 0)
    manager.update(0.5, rgm);

    const vehicles = manager.getVehicles();
    expect(vehicles[0].currentLane.id).toBe('lane2');
    expect(vehicles[0].progress).toBe(0);
    expect(vehicles[0].position.z).toBe(10);
  });
});
