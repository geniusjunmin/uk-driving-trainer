export type PedestrianState = 'idle' | 'waiting' | 'crossing' | 'exited';

export interface Pedestrian {
  readonly id: string;
  crossingId: string;
  state: PedestrianState;
  position: { x: number; y: number; z: number };
  heading: { x: number; y: number; z: number };
  progress: number;     // 0..1 along crossing path
  readonly walkSpeedMps: number;  // ~1.2 m/s
  readonly boundingRadius: number; // 0.3m
}

export interface CrossingPath {
  readonly crossingId: string;
  readonly waitPosition: { x: number; y: number; z: number };
  readonly startPosition: { x: number; y: number; z: number };
  readonly endPosition: { x: number; y: number; z: number };
  readonly widthMeters: number;
}

/**
 * Computes the Euclidean distance between two 3D points (start → end of crossing path).
 */
function crossingLength(path: CrossingPath): number {
  const dx = path.endPosition.x - path.startPosition.x;
  const dy = path.endPosition.y - path.startPosition.y;
  const dz = path.endPosition.z - path.startPosition.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Linearly interpolates between start and end positions based on progress (0..1).
 */
function interpolateCrossingPosition(
  path: CrossingPath,
  progress: number
): { position: { x: number; y: number; z: number }; heading: { x: number; y: number; z: number } } {
  const t = Math.max(0, Math.min(1, progress));

  const dx = path.endPosition.x - path.startPosition.x;
  const dy = path.endPosition.y - path.startPosition.y;
  const dz = path.endPosition.z - path.startPosition.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return {
    position: {
      x: path.startPosition.x + t * dx,
      y: path.startPosition.y + t * dy,
      z: path.startPosition.z + t * dz,
    },
    heading: len > 1e-6
      ? { x: dx / len, y: dy / len, z: dz / len }
      : { x: 0, y: 0, z: 1 },
  };
}

export class PedestrianAIManager {
  private readonly pedestrians: Map<string, Pedestrian> = new Map();
  private readonly crossingPaths: Map<string, CrossingPath> = new Map();

  /**
   * Spawns a new pedestrian on a given crossing path.
   * - 'idle': positioned at waitPosition (off-road, not relevant to rules)
   * - 'waiting': positioned at waitPosition, facing the crossing
   * - 'crossing': positioned at startPosition, progress = 0
   * - 'exited': positioned at endPosition, progress = 1
   */
  spawn(id: string, crossingPath: CrossingPath, initialState: PedestrianState = 'waiting'): Pedestrian {
    this.crossingPaths.set(id, crossingPath);

    let position: { x: number; y: number; z: number };
    let heading: { x: number; y: number; z: number };
    let progress: number;

    switch (initialState) {
      case 'idle':
        position = { ...crossingPath.waitPosition };
        heading = { x: 0, y: 0, z: 1 };
        progress = 0;
        break;
      case 'waiting': {
        position = { ...crossingPath.waitPosition };
        // Face towards the crossing start
        const dx = crossingPath.startPosition.x - crossingPath.waitPosition.x;
        const dy = crossingPath.startPosition.y - crossingPath.waitPosition.y;
        const dz = crossingPath.startPosition.z - crossingPath.waitPosition.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        heading = len > 1e-6
          ? { x: dx / len, y: dy / len, z: dz / len }
          : { x: 0, y: 0, z: 1 };
        progress = 0;
        break;
      }
      case 'crossing': {
        const interp = interpolateCrossingPosition(crossingPath, 0);
        position = interp.position;
        heading = interp.heading;
        progress = 0;
        break;
      }
      case 'exited': {
        position = { ...crossingPath.endPosition };
        const edx = crossingPath.endPosition.x - crossingPath.startPosition.x;
        const edy = crossingPath.endPosition.y - crossingPath.startPosition.y;
        const edz = crossingPath.endPosition.z - crossingPath.startPosition.z;
        const elen = Math.sqrt(edx * edx + edy * edy + edz * edz);
        heading = elen > 1e-6
          ? { x: edx / elen, y: edy / elen, z: edz / elen }
          : { x: 0, y: 0, z: 1 };
        progress = 1;
        break;
      }
    }

    const pedestrian: Pedestrian = {
      id,
      crossingId: crossingPath.crossingId,
      state: initialState,
      position,
      heading,
      progress,
      walkSpeedMps: 1.2,
      boundingRadius: 0.3,
    };

    this.pedestrians.set(id, pedestrian);
    return pedestrian;
  }

  /**
   * Removes a pedestrian by id. Returns true if found and removed.
   */
  despawn(id: string): boolean {
    this.crossingPaths.delete(id);
    return this.pedestrians.delete(id);
  }

  /**
   * Removes all pedestrians.
   */
  clearAll(): void {
    this.pedestrians.clear();
    this.crossingPaths.clear();
  }

  /**
   * Returns all currently managed pedestrians.
   */
  getPedestrians(): readonly Pedestrian[] {
    return Array.from(this.pedestrians.values());
  }

  /**
   * Returns pedestrians filtered by crossing id.
   */
  getCrossingPedestrians(crossingId: string): readonly Pedestrian[] {
    return Array.from(this.pedestrians.values()).filter(
      (p) => p.crossingId === crossingId
    );
  }

  /**
   * Transitions a waiting pedestrian to 'crossing' state.
   * Returns true if the transition was successful.
   */
  triggerCrossing(pedestrianId: string): boolean {
    const ped = this.pedestrians.get(pedestrianId);
    if (!ped || ped.state !== 'waiting') {
      return false;
    }

    const path = this.crossingPaths.get(pedestrianId);
    if (!path) {
      return false;
    }

    ped.state = 'crossing';
    ped.progress = 0;
    const interp = interpolateCrossingPosition(path, 0);
    ped.position = interp.position;
    ped.heading = interp.heading;
    return true;
  }

  /**
   * Advances the state machine for all crossing pedestrians.
   * - 'crossing' pedestrians interpolate from start to end at walkSpeedMps.
   * - When progress >= 1.0, transitions to 'exited'.
   * - 'waiting' pedestrians do NOT auto-transition (game logic decides when).
   * - 'idle' and 'exited' pedestrians are not updated.
   */
  update(deltaSeconds: number): void {
    for (const ped of this.pedestrians.values()) {
      if (ped.state !== 'crossing') {
        continue;
      }

      const path = this.crossingPaths.get(ped.id);
      if (!path) {
        continue;
      }

      const totalLength = crossingLength(path);
      if (totalLength < 1e-6) {
        ped.state = 'exited';
        ped.progress = 1;
        continue;
      }

      // Advance progress based on walk speed
      const progressDelta = (ped.walkSpeedMps * deltaSeconds) / totalLength;
      ped.progress = Math.min(1.0, ped.progress + progressDelta);

      // Update position and heading
      const interp = interpolateCrossingPosition(path, ped.progress);
      ped.position = interp.position;
      ped.heading = interp.heading;

      // Transition to exited when crossing is complete
      if (ped.progress >= 1.0) {
        ped.state = 'exited';
      }
    }
  }
}
