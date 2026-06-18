import type { RoadGraph, Lane, RoadNode, Vector3Like } from './RoadTypes';

export interface LaneProjection {
  readonly distanceToCenter: number;
  readonly projectionPoint: Vector3Like;
  readonly progress: number;
  readonly heading: Vector3Like;
}

export class RoadGraphManager {
  private graph: RoadGraph | null = null;
  private readonly lanesMap = new Map<string, Lane>();
  private readonly nodesMap = new Map<string, RoadNode>();
  private readonly predecessors = new Map<string, string[]>();
  private readonly successors = new Map<string, string[]>();

  load(graph: RoadGraph): void {
    // 1. Validation
    if (graph.units !== 'meters' || graph.upAxis !== 'y') {
      throw new Error('Invalid RoadGraph: units must be meters and upAxis must be y.');
    }

    // 2. Check for duplicate IDs
    const ids = new Set<string>();
    const checkId = (id: string) => {
      if (ids.has(id)) {
        throw new Error(`Duplicate ID "${id}" found in RoadGraph.`);
      }
      ids.add(id);
    };

    graph.nodes.forEach(n => checkId(n.id));
    graph.lanes.forEach(l => checkId(l.id));
    graph.junctions.forEach(j => {
      checkId(j.id);
      j.conflictZones.forEach(cz => checkId(cz.id));
      j.priorityRules.forEach(pr => checkId(pr.id));
    });
    graph.roadSigns.forEach(s => checkId(s.id));
    graph.triggerZones.forEach(tz => checkId(tz.id));

    this.graph = graph;
    this.lanesMap.clear();
    this.nodesMap.clear();
    this.predecessors.clear();
    this.successors.clear();

    graph.lanes.forEach(lane => {
      this.lanesMap.set(lane.id, lane);
    });

    graph.nodes.forEach(node => {
      this.nodesMap.set(node.id, node);
    });

    // 3. Build predecessor/successor lookup tables
    graph.lanes.forEach(lane => {
      const fromNode = lane.fromNodeId;
      const toNode = lane.toNodeId;

      graph.lanes.forEach(other => {
        if (other.toNodeId === fromNode) {
          const list = this.predecessors.get(lane.id) || [];
          if (!list.includes(other.id)) {
            list.push(other.id);
          }
          this.predecessors.set(lane.id, list);
        }
        if (other.fromNodeId === toNode) {
          const list = this.successors.get(lane.id) || [];
          if (!list.includes(other.id)) {
            list.push(other.id);
          }
          this.successors.set(lane.id, list);
        }
      });
    });
  }

  getGraph(): RoadGraph | null {
    return this.graph;
  }

  getLane(id: string): Lane | undefined {
    return this.lanesMap.get(id);
  }

  getNode(id: string): RoadNode | undefined {
    return this.nodesMap.get(id);
  }

  getPredecessors(laneId: string): readonly string[] {
    return this.predecessors.get(laneId) || [];
  }

  getSuccessors(laneId: string): readonly string[] {
    return this.successors.get(laneId) || [];
  }

  getLaneProjection(point: Vector3Like, lane: Lane): LaneProjection | null {
    const points = lane.centerLine;
    if (points.length < 2) return null;

    let minDistance = Infinity;
    let bestProjPoint: Vector3Like = { x: 0, y: 0, z: 0 };
    let bestProgress = 0;
    let bestHeading: Vector3Like = { x: 0, y: 0, z: 1 };

    let accumulatedLength = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const abX = p2.x - p1.x;
      const abY = p2.y - p1.y;
      const abZ = p2.z - p1.z;
      const abLengthSq = abX * abX + abY * abY + abZ * abZ;
      const abLength = Math.sqrt(abLengthSq);

      if (abLength < 1e-6) continue;

      const apX = point.x - p1.x;
      const apY = point.y - p1.y;
      const apZ = point.z - p1.z;

      let t = (apX * abX + apY * abY + apZ * abZ) / abLengthSq;
      t = Math.max(0, Math.min(1, t));

      const projX = p1.x + t * abX;
      const projY = p1.y + t * abY;
      const projZ = p1.z + t * abZ;

      const dx = point.x - projX;
      const dy = point.y - projY;
      const dz = point.z - projZ;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < minDistance) {
        minDistance = distance;
        bestProjPoint = { x: projX, y: projY, z: projZ };
        bestProgress = accumulatedLength + t * abLength;
        bestHeading = { x: abX / abLength, y: abY / abLength, z: abZ / abLength };
      }

      accumulatedLength += abLength;
    }

    if (minDistance === Infinity) return null;

    return {
      distanceToCenter: minDistance,
      projectionPoint: bestProjPoint,
      progress: bestProgress,
      heading: bestHeading,
    };
  }

  getNearestLane(point: Vector3Like, searchRadius = 10): Lane | null {
    if (!this.graph) return null;

    let nearestLane: Lane | null = null;
    let minDistance = Infinity;

    for (const lane of this.graph.lanes) {
      const proj = this.getLaneProjection(point, lane);
      if (proj && proj.distanceToCenter < minDistance) {
        minDistance = proj.distanceToCenter;
        nearestLane = lane;
      }
    }

    if (minDistance <= searchRadius) {
      return nearestLane;
    }

    return null;
  }
}
