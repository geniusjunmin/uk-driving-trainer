export const DEFAULT_MAX_DELTA_SECONDS = 0.1;
export const DEFAULT_FIXED_TIMESTEP_SECONDS = 1 / 60;
export const DEFAULT_MAX_FIXED_STEPS = 5;
export const DEFAULT_FPS_SAMPLE_SIZE = 60;

export type TimeOptions = Readonly<{
  fixedTimeStepSeconds?: number;
  maxDeltaSeconds?: number;
  maxFixedSteps?: number;
  fpsSampleSize?: number;
}>;

export type TimeFrame = Readonly<{
  rawDeltaSeconds: number;
  deltaSeconds: number;
  elapsedSeconds: number;
  simulatedElapsedSeconds: number;
  averageFps: number;
}>;

export type FixedStepResult = Readonly<{
  steps: number;
  fixedTimeStepSeconds: number;
  accumulatorSeconds: number;
  simulatedSeconds: number;
  interpolationAlpha: number;
  droppedSeconds: number;
}>;

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function nowSeconds(): number {
  return performance.now() / 1_000;
}

export class Time {
  readonly fixedTimeStepSeconds: number;
  readonly maxDeltaSeconds: number;
  readonly maxFixedSteps: number;
  readonly fpsSampleSize: number;

  private lastTimestampSeconds: number | null = null;
  private rawElapsedSeconds = 0;
  private simulatedElapsedSecondsValue = 0;
  private rawDeltaSecondsValue = 0;
  private deltaSecondsValue = 0;
  private accumulatorSecondsValue = 0;
  private fpsSampleTotalSeconds = 0;
  private readonly fpsDeltaSamples: number[] = [];

  constructor(options: TimeOptions = {}) {
    this.fixedTimeStepSeconds = positiveOrDefault(
      options.fixedTimeStepSeconds,
      DEFAULT_FIXED_TIMESTEP_SECONDS,
    );
    this.maxDeltaSeconds = positiveOrDefault(
      options.maxDeltaSeconds,
      DEFAULT_MAX_DELTA_SECONDS,
    );
    this.maxFixedSteps = Math.max(
      1,
      Math.floor(positiveOrDefault(options.maxFixedSteps, DEFAULT_MAX_FIXED_STEPS)),
    );
    this.fpsSampleSize = Math.max(
      1,
      Math.floor(positiveOrDefault(options.fpsSampleSize, DEFAULT_FPS_SAMPLE_SIZE)),
    );
  }

  reset(timestampSeconds = nowSeconds()): void {
    this.lastTimestampSeconds = Number.isFinite(timestampSeconds)
      ? timestampSeconds
      : nowSeconds();
    this.rawElapsedSeconds = 0;
    this.simulatedElapsedSecondsValue = 0;
    this.rawDeltaSecondsValue = 0;
    this.deltaSecondsValue = 0;
    this.accumulatorSecondsValue = 0;
    this.fpsSampleTotalSeconds = 0;
    this.fpsDeltaSamples.length = 0;
  }

  update(timestampSeconds = nowSeconds()): TimeFrame {
    const safeTimestampSeconds = Number.isFinite(timestampSeconds)
      ? timestampSeconds
      : nowSeconds();
    const rawDeltaSeconds =
      this.lastTimestampSeconds === null
        ? 0
        : safeTimestampSeconds - this.lastTimestampSeconds;

    this.lastTimestampSeconds = safeTimestampSeconds;

    return this.updateFromDelta(rawDeltaSeconds);
  }

  updateFromDelta(deltaSeconds: number): TimeFrame {
    const safeRawDeltaSeconds =
      Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    const clampedDeltaSeconds = Math.min(
      safeRawDeltaSeconds,
      this.maxDeltaSeconds,
    );

    this.rawDeltaSecondsValue = safeRawDeltaSeconds;
    this.deltaSecondsValue = clampedDeltaSeconds;
    this.rawElapsedSeconds += safeRawDeltaSeconds;
    this.simulatedElapsedSecondsValue += clampedDeltaSeconds;
    this.accumulatorSecondsValue += clampedDeltaSeconds;
    this.recordFpsDelta(clampedDeltaSeconds);

    return this.frame;
  }

  consumeFixedSteps(): FixedStepResult {
    const maxAccumulatorSeconds = this.fixedTimeStepSeconds * this.maxFixedSteps;
    const droppedSeconds = Math.max(
      0,
      this.accumulatorSecondsValue - maxAccumulatorSeconds,
    );

    if (droppedSeconds > 0) {
      this.accumulatorSecondsValue = maxAccumulatorSeconds;
    }

    const steps = Math.min(
      this.maxFixedSteps,
      Math.floor(this.accumulatorSecondsValue / this.fixedTimeStepSeconds),
    );
    const simulatedSeconds = steps * this.fixedTimeStepSeconds;

    this.accumulatorSecondsValue -= simulatedSeconds;

    return {
      steps,
      fixedTimeStepSeconds: this.fixedTimeStepSeconds,
      accumulatorSeconds: this.accumulatorSecondsValue,
      simulatedSeconds,
      interpolationAlpha: this.accumulatorSecondsValue / this.fixedTimeStepSeconds,
      droppedSeconds,
    };
  }

  get frame(): TimeFrame {
    return {
      rawDeltaSeconds: this.rawDeltaSecondsValue,
      deltaSeconds: this.deltaSecondsValue,
      elapsedSeconds: this.rawElapsedSeconds,
      simulatedElapsedSeconds: this.simulatedElapsedSecondsValue,
      averageFps: this.averageFps,
    };
  }

  get rawDeltaSeconds(): number {
    return this.rawDeltaSecondsValue;
  }

  get deltaSeconds(): number {
    return this.deltaSecondsValue;
  }

  get elapsedSeconds(): number {
    return this.rawElapsedSeconds;
  }

  get simulatedElapsedSeconds(): number {
    return this.simulatedElapsedSecondsValue;
  }

  get accumulatorSeconds(): number {
    return this.accumulatorSecondsValue;
  }

  get averageFps(): number {
    return this.fpsSampleTotalSeconds > 0
      ? this.fpsDeltaSamples.length / this.fpsSampleTotalSeconds
      : 0;
  }

  private recordFpsDelta(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    this.fpsDeltaSamples.push(deltaSeconds);
    this.fpsSampleTotalSeconds += deltaSeconds;

    while (this.fpsDeltaSamples.length > this.fpsSampleSize) {
      this.fpsSampleTotalSeconds -= this.fpsDeltaSamples.shift() ?? 0;
    }
  }
}
