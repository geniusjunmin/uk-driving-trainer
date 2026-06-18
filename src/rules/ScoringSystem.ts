import type { DrivingFault, DrivingRuleSeverity } from './RuleEngine';

export interface ScoreRecord {
  readonly levelId: string;
  score: number;
  readonly faults: DrivingFault[];
  readonly startTimeSeconds: number;
  endTimeSeconds?: number;
  isPassed?: boolean;
}

const COOLDOWNS: Record<string, number> = {
  'lane.keep_left.drift': 8,
  'lane.line_touch': 6,
  'lane.line_straddle': 8,
  'speed.limit.minor': 8,
  'speed.limit.major': 8,
  'speed.parking_too_fast': 6,
  'lane.wrong_side_entry': 9999,
  'lane.turn_wrong_lane': 9999,
  'lane.no_entry_or_reverse_direction': 8,
  'speed.limit.dangerous': 9999,
  'speed.hazard_approach_fast': 9999,
  'give_way.approach_too_fast': 9999,
  'give_way.line_roll_through': 9999,
  'give_way.fail_priority': 9999,
  'stop.no_full_stop': 9999,
  'stop.observation_missing': 9999,
  'roundabout.entry_too_fast': 9999,
  'roundabout.fail_give_right': 9999,
  'roundabout.wrong_signal_first_exit': 9999,
  'roundabout.wrong_signal_straight': 9999,
  'roundabout.wrong_signal_right': 9999,
  'roundabout.wrong_exit': 9999,
  'roundabout.lane_cutting': 8,
  // Zebra crossing rules
  'zebra.approach_no_slow': 9999,
  'zebra.fail_waiting_pedestrian': 9999,
  'zebra.fail_crossing_pedestrian': 9999,
  'zebra.block_crossing': 9999,
  'pedestrian.restart_too_early': 9999,
  // Parking rules
  'parking.entry_no_give_way': 9999,
  'parking.reverse_setup_poor': 9999,
  'parking.reverse_no_observation': 9999,
  'parking.bay_line_touch': 6,
  'parking.final_misaligned': 9999,
  'parking.outside_target_bay': 9999,
  'parking.collision': 9999,
};

export function getPointsForSeverity(severity: DrivingRuleSeverity): number {
  switch (severity) {
    case 'minor':
      return -3;
    case 'serious':
      return -5;
    case 'dangerous':
      return -10;
    default:
      return 0;
  }
}

export class ScoringSystem {
  private currentRecord: ScoreRecord | null = null;
  private readonly lastTriggerTimes = new Map<string, number>();

  startLevel(levelId: string, startTimeSeconds: number): void {
    this.currentRecord = {
      levelId,
      score: 100,
      faults: [],
      startTimeSeconds,
    };
    this.lastTriggerTimes.clear();
  }

  getCurrentRecord(): ScoreRecord | null {
    return this.currentRecord;
  }

  processFaults(candidateFaults: readonly DrivingFault[], timeSeconds: number): readonly DrivingFault[] {
    if (!this.currentRecord) return [];

    const newFaultsProcessed: DrivingFault[] = [];

    for (const fault of candidateFaults) {
      const ruleId = fault.ruleId;
      const zoneId = fault.zoneId || '';
      const laneId = fault.laneId || '';
      const relatedObjectId = fault.evidence?.npcId || fault.evidence?.objectId || '';

      // dedupeKey = levelId + ruleId + zoneId + laneId + relatedObjectId
      const dedupeKey = `${this.currentRecord.levelId}-${ruleId}-${zoneId}-${laneId}-${relatedObjectId}`;

      // Get cooldown duration
      const cooldown = COOLDOWNS[ruleId] ?? 8;
      const lastTrigger = this.lastTriggerTimes.get(dedupeKey) ?? -9999;

      if (timeSeconds - lastTrigger < cooldown) {
        continue;
      }

      // Handle Speed Limit Upgrade: minor to major (serious)
      if (ruleId === 'speed.limit.major') {
        const minorKey = `${this.currentRecord.levelId}-speed.limit.minor-${zoneId}-${laneId}-${relatedObjectId}`;
        const lastMinorTrigger = this.lastTriggerTimes.get(minorKey);

        if (lastMinorTrigger !== undefined) {
          const existingMinorIndex = this.currentRecord.faults.findIndex(
            (f) => f.ruleId === 'speed.limit.minor' && (f.zoneId === zoneId || f.laneId === laneId)
          );
          if (existingMinorIndex !== -1) {
            // Upgrade: remove minor, add major, adjust score difference
            this.currentRecord.faults.splice(existingMinorIndex, 1);
            this.currentRecord.score += 3; // revert minor deduction (-3)

            this.currentRecord.faults.push(fault);
            this.currentRecord.score -= 5; // deduct serious deduction (-5)
            this.lastTriggerTimes.set(dedupeKey, timeSeconds);
            newFaultsProcessed.push(fault);
            continue;
          }
        }
      }

      // Deduct points
      const points = getPointsForSeverity(fault.severity);
      this.currentRecord.score += points;
      this.currentRecord.score = Math.max(0, this.currentRecord.score);

      // Record fault
      this.currentRecord.faults.push(fault);
      this.lastTriggerTimes.set(dedupeKey, timeSeconds);
      newFaultsProcessed.push(fault);
    }

    return newFaultsProcessed;
  }

  evaluatePassFail(passThreshold: number, failThreshold: number, instantFailCount = 0): void {
    if (!this.currentRecord) return;

    const dangerousCount = this.currentRecord.faults.filter(f => f.severity === 'dangerous').length;

    let failed = false;
    if (this.currentRecord.score < failThreshold) {
      failed = true;
    }
    if (dangerousCount >= 2) {
      failed = true;
    }
    if (instantFailCount > 0) {
      failed = true;
    }

    this.currentRecord.isPassed = !failed && this.currentRecord.score >= passThreshold;
  }
}
