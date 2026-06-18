import type { DrivingContext, DrivingFault, DrivingRule } from './RuleEngine';

type SpeedBand = 'minor' | 'major' | 'dangerous';

interface SpeedAssessment {
  readonly band: SpeedBand;
  readonly ruleId: 'speed.limit.minor' | 'speed.limit.major' | 'speed.limit.dangerous';
}

const SPEEDING_DURATION_SECONDS = 1.0;
const LOWER_LIMIT_GRACE_SECONDS = 2.0;
const REPEAT_COOLDOWN_SECONDS = 8.0;

function hasAnyTag(context: DrivingContext, tags: readonly string[]): boolean {
  const wanted = new Set(tags.map((tag) => tag.toLowerCase()));

  if (context.currentLane?.tags?.some((tag) => wanted.has(tag.toLowerCase()))) {
    return true;
  }

  if (context.activeTriggerZones?.some((zone) => zone.label && wanted.has(zone.label.toLowerCase()))) {
    return true;
  }

  return context.activeRoadSigns?.some((sign) => sign.label && wanted.has(sign.label.toLowerCase())) ?? false;
}

function isGracePeriodExcluded(context: DrivingContext): boolean {
  return hasAnyTag(context, ['school', 'school-zone', 'residential', 'parking', 'carpark', 'speed-bump']);
}

function getSpeedZoneKey(context: DrivingContext, limitMph: number): string {
  return context.currentZone?.id ?? context.currentLane?.id ?? `limit-${limitMph}`;
}

function getSpeedLimitMph(context: DrivingContext): number | null {
  return context.currentZone?.speedLimitMph ?? context.currentLane?.speedLimitMph ?? null;
}

function assessSpeed(speedMph: number, limitMph: number, context: DrivingContext): SpeedAssessment | null {
  const excludedGrace = isGracePeriodExcluded(context);
  const isSchoolZoneDanger = limitMph === 20 && speedMph >= 30 && excludedGrace;

  if (speedMph > limitMph + 10 || isSchoolZoneDanger) {
    return { band: 'dangerous', ruleId: 'speed.limit.dangerous' };
  }

  if (speedMph > limitMph + 7) {
    return { band: 'major', ruleId: 'speed.limit.major' };
  }

  if (speedMph > limitMph + 3) {
    return { band: 'minor', ruleId: 'speed.limit.minor' };
  }

  return null;
}

function getFaultMessage(band: SpeedBand, speedMph: number, limitMph: number): string {
  const speed = speedMph.toFixed(1);

  if (band === 'dangerous') {
    return `严重超速。Dangerous speeding. Current speed is ${speed} mph, limit is ${limitMph} mph.`;
  }

  if (band === 'major') {
    return `明显超速，请立即减速。You are well over the limit. Current speed is ${speed} mph, limit is ${limitMph} mph.`;
  }

  return `当前限速 ${limitMph} mph，请减速。Limit is ${limitMph} mph, slow down. Current speed is ${speed} mph.`;
}

export class SpeedLimitRule implements DrivingRule {
  readonly id = 'SpeedLimitRule';
  readonly category = 'speed';

  private activeZoneKey: string | null = null;
  private activeLimitMph: number | null = null;
  private zoneEnteredAtSeconds = -Infinity;
  private violationBand: SpeedBand | null = null;
  private violationStartedAtSeconds: number | null = null;
  private readonly lastTriggeredAtSeconds = new Map<SpeedBand, number>();

  evaluate(context: DrivingContext): DrivingFault | null {
    const limitMph = getSpeedLimitMph(context);
    if (limitMph === null) {
      this.resetViolation();
      return null;
    }

    const zoneKey = getSpeedZoneKey(context, limitMph);
    this.updateZoneState(context, zoneKey, limitMph);

    const speedMph = context.speedMph;
    if (speedMph <= limitMph + 1) {
      this.resetViolation();
      this.lastTriggeredAtSeconds.clear();
      return null;
    }

    const graceEndsAtSeconds = this.getGraceEndsAtSeconds(context);
    const assessment = assessSpeed(speedMph, limitMph, context);

    if (context.timeSeconds < graceEndsAtSeconds) {
      if (assessment && assessment.band !== 'dangerous') {
        this.trackSustainedViolation(context, assessment.band, graceEndsAtSeconds);
      } else {
        this.resetViolation();
      }
      return null;
    }

    if (!assessment) {
      this.resetViolation();
      return null;
    }

    if (assessment.band === 'dangerous') {
      return this.createFault(context, assessment, speedMph, limitMph);
    }

    this.trackSustainedViolation(context, assessment.band, graceEndsAtSeconds);
    if (
      this.violationStartedAtSeconds === null ||
      context.timeSeconds - this.violationStartedAtSeconds < SPEEDING_DURATION_SECONDS
    ) {
      return null;
    }

    const lastTriggered = this.lastTriggeredAtSeconds.get(assessment.band) ?? -Infinity;
    if (context.timeSeconds - lastTriggered < REPEAT_COOLDOWN_SECONDS) {
      return null;
    }

    this.lastTriggeredAtSeconds.set(assessment.band, context.timeSeconds);
    return this.createFault(context, assessment, speedMph, limitMph);
  }

  private updateZoneState(context: DrivingContext, zoneKey: string, limitMph: number): void {
    const previousLimit = this.activeLimitMph;

    if (this.activeZoneKey === zoneKey && this.activeLimitMph === limitMph) {
      return;
    }

    this.activeZoneKey = zoneKey;
    this.activeLimitMph = limitMph;
    this.zoneEnteredAtSeconds =
      previousLimit !== null && limitMph < previousLimit ? context.timeSeconds : -Infinity;
    this.resetViolation();
    this.lastTriggeredAtSeconds.clear();
  }

  private getGraceEndsAtSeconds(context: DrivingContext): number {
    if (isGracePeriodExcluded(context)) {
      return this.zoneEnteredAtSeconds;
    }

    return this.zoneEnteredAtSeconds + LOWER_LIMIT_GRACE_SECONDS;
  }

  private trackSustainedViolation(
    context: DrivingContext,
    band: SpeedBand,
    earliestStartSeconds: number
  ): void {
    if (this.violationBand !== band || this.violationStartedAtSeconds === null) {
      this.violationBand = band;
      this.violationStartedAtSeconds = Math.max(context.timeSeconds, earliestStartSeconds);
    }
  }

  private resetViolation(): void {
    this.violationBand = null;
    this.violationStartedAtSeconds = null;
  }

  private createFault(
    context: DrivingContext,
    assessment: SpeedAssessment,
    speedMph: number,
    limitMph: number
  ): DrivingFault {
    return {
      id: `${assessment.ruleId}-${context.timeSeconds}`,
      ruleId: assessment.ruleId,
      severity: assessment.band === 'major' ? 'serious' : assessment.band,
      message: getFaultMessage(assessment.band, speedMph, limitMph),
      occurredAtSeconds: context.timeSeconds,
      laneId: context.currentLane?.id,
      zoneId: context.currentZone?.id,
      evidence: { speedMph, limitMph },
    };
  }
}
