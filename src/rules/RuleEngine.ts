import type { ConflictZone, Lane, PriorityRule, RoadSign, TriggerZone, Vector3Like } from '../road/RoadTypes';

export type DrivingRuleSeverity = 'minor' | 'serious' | 'dangerous';

export type IndicatorState = 'off' | 'left' | 'right' | 'hazard';

export type GearState = 'park' | 'reverse' | 'neutral' | 'drive' | 'first';

export interface ObservationState {
  readonly checkedInteriorMirror?: boolean;
  readonly checkedLeftMirror?: boolean;
  readonly checkedRightMirror?: boolean;
  readonly checkedBlindSpot?: boolean;
  readonly checkedRearView?: boolean;
  readonly lastCheckedAtSeconds?: number;
}

export interface VehiclePose {
  readonly position: Vector3Like;
  readonly yawDegrees: number;
}

export interface DrivingContext {
  readonly timeSeconds: number;
  readonly deltaSeconds: number;
  readonly vehiclePose: VehiclePose;
  readonly speedMph: number;
  readonly gear: GearState;
  readonly indicator: IndicatorState;
  readonly currentLane?: Lane;
  readonly nearbyLanes?: readonly Lane[];
  readonly activeTriggerZones?: readonly TriggerZone[];
  readonly activeConflictZones?: readonly ConflictZone[];
  readonly activeRoadSigns?: readonly RoadSign[];
  readonly priorityRules?: readonly PriorityRule[];
  readonly observation?: ObservationState;
  readonly currentZone?: { readonly id: string; readonly speedLimitMph?: number };
  readonly levelId?: string;
  readonly roundaboutTaskExit?: 1 | 2 | 3;
  readonly passedExit1?: boolean;
  readonly passedExit2?: boolean;
  readonly trafficVehicles?: readonly {
    readonly id: string;
    readonly position: Vector3Like;
    readonly speedMph: number;
    readonly laneId: string;
  }[];
  readonly pedestrians?: readonly {
    readonly id: string;
    readonly state: 'idle' | 'waiting' | 'crossing' | 'exited';
    readonly crossingId: string;
    readonly position: Vector3Like;
    readonly boundingRadius: number;
  }[];
  readonly parkingBay?: {
    readonly targetBayId: string;
    readonly bayBounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
    readonly bayHeadingDegrees: number;
    readonly wheelPositions?: readonly Vector3Like[];
    readonly isVehicleInBay?: boolean;
    readonly alignmentAngleDegrees?: number;
    readonly lateralOffsetMeters?: number;
  };
}

export interface DrivingFault {
  readonly id: string;
  readonly ruleId: string;
  readonly severity: DrivingRuleSeverity;
  readonly message: string;
  readonly occurredAtSeconds: number;
  readonly laneId?: string;
  readonly zoneId?: string;
  readonly evidence?: Record<string, number | string | boolean | null>;
}

export interface DrivingRule {
  readonly id: string;
  readonly category: string;
  evaluate(context: DrivingContext): DrivingFault | null;
}

export class RuleEngine {
  private readonly rules: DrivingRule[] = [];

  addRule(rule: DrivingRule): void {
    if (this.rules.some((existingRule) => existingRule.id === rule.id)) {
      throw new Error(`DrivingRule with id "${rule.id}" already exists.`);
    }

    this.rules.push(rule);
  }

  clearRules(): void {
    this.rules.length = 0;
  }

  getRules(): readonly DrivingRule[] {
    return this.rules;
  }

  update(context: DrivingContext): readonly DrivingFault[] {
    const faults: DrivingFault[] = [];

    for (const rule of this.rules) {
      const fault = rule.evaluate(context);

      if (fault) {
        faults.push(fault);
      }
    }

    return faults;
  }
}
