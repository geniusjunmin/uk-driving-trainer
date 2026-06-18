import type { Vector3Like, Lane } from '../road/RoadTypes';
import type { RoadGraphManager } from '../road/RoadGraphManager';

export interface TrafficVehicle {
  readonly id: string;
  currentLane: Lane;
  progress: number;
  speedMph: number;
  position: Vector3Like;
  heading: Vector3Like;
}

export function getLaneLength(centerLine: readonly Vector3Like[]): number {
  let length = 0;
  for (let i = 0; i < centerLine.length - 1; i++) {
    const p1 = centerLine[i];
    const p2 = centerLine[i + 1];
    length += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2);
  }
  return length;
}

export function getCenterlineCoordinates(progress: number, centerLine: readonly Vector3Like[]): { position: Vector3Like; heading: Vector3Like } {
  if (centerLine.length < 2) {
    return { position: { x: 0, y: 0, z: 0 }, heading: { x: 0, y: 0, z: 1 } };
  }
  let currentLength = 0;
  for (let i = 0; i < centerLine.length - 1; i++) {
    const p1 = centerLine[i];
    const p2 = centerLine[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    const segLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (segLength < 1e-6) continue;

    if (progress <= currentLength + segLength) {
      const t = (progress - currentLength) / segLength;
      return {
        position: {
          x: p1.x + t * dx,
          y: p1.y + t * dy,
          z: p1.z + t * dz,
        },
        heading: {
          x: dx / segLength,
          y: dy / segLength,
          z: dz / segLength,
        },
      };
    }
    currentLength += segLength;
  }
  const lastPoint = centerLine[centerLine.length - 1];
  const secondToLast = centerLine[centerLine.length - 2];
  const dx = lastPoint.x - secondToLast.x;
  const dy = lastPoint.y - secondToLast.y;
  const dz = lastPoint.z - secondToLast.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return {
    position: lastPoint,
    heading: len > 1e-6 ? { x: dx / len, y: dy / len, z: dz / len } : { x: 0, y: 0, z: 1 },
  };
}

export class TrafficAIManager {
  private readonly vehicles: Map<string, TrafficVehicle> = new Map();

  spawnVehicle(id: string, startLane: Lane, startProgress: number, speedMph: number): TrafficVehicle {
    const { position, heading } = getCenterlineCoordinates(startProgress, startLane.centerLine);
    const vehicle: TrafficVehicle = {
      id,
      currentLane: startLane,
      progress: startProgress,
      speedMph,
      position,
      heading,
    };
    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  despawnVehicle(id: string): boolean {
    return this.vehicles.delete(id);
  }

  clearVehicles(): void {
    this.vehicles.clear();
  }

  getVehicles(): readonly TrafficVehicle[] {
    return Array.from(this.vehicles.values());
  }

  getTrafficContextList(): readonly { id: string; position: Vector3Like; speedMph: number; laneId: string }[] {
    return this.getVehicles().map((v) => ({
      id: v.id,
      position: v.position,
      speedMph: v.speedMph,
      laneId: v.currentLane.id,
    }));
  }

  update(deltaTimeSeconds: number, roadGraphManager: RoadGraphManager): void {
    for (const vehicle of this.vehicles.values()) {
      const speedMps = vehicle.speedMph * 0.44704;
      let newProgress = vehicle.progress + speedMps * deltaTimeSeconds;
      let laneLength = getLaneLength(vehicle.currentLane.centerLine);

      if (newProgress >= laneLength) {
        // Find successor lanes
        const successors = roadGraphManager.getSuccessors(vehicle.currentLane.id);
        if (successors.length > 0) {
          // Choose the first successor or transition smoothly
          const nextLaneId = successors[0];
          const nextLane = roadGraphManager.getLane(nextLaneId);
          if (nextLane) {
            newProgress = newProgress - laneLength;
            vehicle.currentLane = nextLane;
            laneLength = getLaneLength(nextLane.centerLine);
          } else {
            // successor not found in manager, wrap back to start of current
            newProgress = 0;
          }
        } else {
          // No successor (dead end), wrap back to the start of current lane
          newProgress = 0;
        }
      }

      vehicle.progress = Math.max(0, Math.min(laneLength, newProgress));
      const { position, heading } = getCenterlineCoordinates(vehicle.progress, vehicle.currentLane.centerLine);
      vehicle.position = position;
      vehicle.heading = heading;
    }
  }
}
