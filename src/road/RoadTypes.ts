export type RoadId = string;

export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type LaneDirection = 'forward' | 'reverse';

export type TurnRestriction = 'left' | 'right' | 'straight' | 'u-turn';

export type RoadSignType =
  | 'speed-limit'
  | 'give-way'
  | 'stop'
  | 'roundabout'
  | 'zebra-crossing'
  | 'parking'
  | 'school-zone'
  | 'warning';

export type PriorityRuleType =
  | 'give-way'
  | 'stop'
  | 'roundabout-give-right'
  | 'pedestrian-priority'
  | 'oncoming-priority'
  | 'carpark-priority';

export interface Bounds2D {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface RoadNode {
  readonly id: RoadId;
  readonly position: Vector3Like;
  readonly label?: string;
}

export interface Lane {
  readonly id: RoadId;
  readonly fromNodeId: RoadId;
  readonly toNodeId: RoadId;
  readonly centerLine: readonly Vector3Like[];
  readonly widthMeters: number;
  readonly direction: LaneDirection;
  readonly speedLimitMph: number;
  readonly allowedTurns: readonly TurnRestriction[];
  readonly adjacentLaneIds?: readonly RoadId[];
  readonly oppositeLaneId?: RoadId;
  readonly triggerZoneIds?: readonly RoadId[];
  readonly tags?: readonly string[];
}

export interface RoadSign {
  readonly id: RoadId;
  readonly type: RoadSignType;
  readonly position: Vector3Like;
  readonly facingYawDegrees: number;
  readonly appliesToLaneIds: readonly RoadId[];
  readonly speedLimitMph?: number;
  readonly triggerZoneId?: RoadId;
  readonly label?: string;
}

export interface TriggerZone {
  readonly id: RoadId;
  readonly bounds: Bounds2D;
  readonly laneIds?: readonly RoadId[];
  readonly ruleIds?: readonly RoadId[];
  readonly label?: string;
}

export interface ConflictZone {
  readonly id: RoadId;
  readonly bounds: Bounds2D;
  readonly entryLaneIds: readonly RoadId[];
  readonly exitLaneIds: readonly RoadId[];
  readonly priorityRuleIds: readonly RoadId[];
  readonly stopLine?: readonly Vector3Like[];
  readonly label?: string;
}

export interface PriorityRule {
  readonly id: RoadId;
  readonly type: PriorityRuleType;
  readonly controlledLaneIds: readonly RoadId[];
  readonly priorityLaneIds?: readonly RoadId[];
  readonly conflictZoneId?: RoadId;
  readonly signId?: RoadId;
  readonly mustStop?: boolean;
  readonly minimumClearGapSeconds?: number;
  readonly label?: string;
}

export interface Junction {
  readonly id: RoadId;
  readonly type: 't-junction' | 'crossroads' | 'roundabout' | 'carpark-entry' | 'crossing';
  readonly center: Vector3Like;
  readonly connectedLaneIds: readonly RoadId[];
  readonly conflictZones: readonly ConflictZone[];
  readonly priorityRules: readonly PriorityRule[];
  readonly signIds?: readonly RoadId[];
  readonly triggerZoneIds?: readonly RoadId[];
}

export interface RouteNode {
  readonly id: RoadId;
  readonly nodeId: RoadId;
  readonly expectedLaneId?: RoadId;
  readonly triggerZoneId?: RoadId;
}

export interface RoadGraph {
  readonly id: RoadId;
  readonly version: number;
  readonly units: 'meters';
  readonly upAxis: 'y';
  readonly nodes: readonly RoadNode[];
  readonly lanes: readonly Lane[];
  readonly junctions: readonly Junction[];
  readonly roadSigns: readonly RoadSign[];
  readonly triggerZones: readonly TriggerZone[];
  readonly routeNodes?: readonly RouteNode[];
}
