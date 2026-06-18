import RAPIER, {
  type Collider,
  type ColliderDesc,
  type Vector,
  type World,
} from '@dimforge/rapier3d-compat';

export type PhysicsVector = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type GroundOptions = Readonly<{
  halfExtents?: PhysicsVector;
  translation?: PhysicsVector;
  friction?: number;
  restitution?: number;
}>;

export type VehiclePhysicsOptions = Readonly<{
  gravity?: PhysicsVector;
  fixedTimestepSeconds?: number;
  maxSubsteps?: number;
  maxDeltaSeconds?: number;
}>;

export type PhysicsStepResult = Readonly<{
  substeps: number;
  accumulatorSeconds: number;
  simulatedSeconds: number;
}>;

const DEFAULT_GRAVITY: PhysicsVector = Object.freeze({ x: 0, y: -9.81, z: 0 });
const DEFAULT_FIXED_TIMESTEP_SECONDS = 1 / 60;
const DEFAULT_MAX_SUBSTEPS = 5;
const DEFAULT_MAX_DELTA_SECONDS = 0.25;
const DEFAULT_GROUND_HALF_EXTENTS: PhysicsVector = Object.freeze({
  x: 100,
  y: 0.1,
  z: 100,
});
const DEFAULT_GROUND_TRANSLATION: PhysicsVector = Object.freeze({
  x: 0,
  y: -0.1,
  z: 0,
});

let rapierReady: Promise<void> | undefined;

export async function loadRapier(): Promise<typeof RAPIER> {
  rapierReady ??= RAPIER.init();
  await rapierReady;
  return RAPIER;
}

function toRapierVector(vector: PhysicsVector): Vector {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export class VehiclePhysics {
  private readonly fixedTimestepSeconds: number;
  private readonly maxSubsteps: number;
  private readonly maxDeltaSeconds: number;
  private readonly world: World;
  private accumulatorSeconds = 0;

  private constructor(options: VehiclePhysicsOptions = {}) {
    this.fixedTimestepSeconds = positiveOrDefault(
      options.fixedTimestepSeconds,
      DEFAULT_FIXED_TIMESTEP_SECONDS,
    );
    this.maxSubsteps = Math.max(
      1,
      Math.floor(positiveOrDefault(options.maxSubsteps, DEFAULT_MAX_SUBSTEPS)),
    );
    this.maxDeltaSeconds = positiveOrDefault(
      options.maxDeltaSeconds,
      DEFAULT_MAX_DELTA_SECONDS,
    );
    this.world = new RAPIER.World(toRapierVector(options.gravity ?? DEFAULT_GRAVITY));
    this.world.integrationParameters.dt = this.fixedTimestepSeconds;
  }

  static async init(options: VehiclePhysicsOptions = {}): Promise<VehiclePhysics> {
    await loadRapier();
    return new VehiclePhysics(options);
  }

  static async load(options: VehiclePhysicsOptions = {}): Promise<VehiclePhysics> {
    return VehiclePhysics.init(options);
  }

  getWorld(): World {
    return this.world;
  }

  getAccumulatorSeconds(): number {
    return this.accumulatorSeconds;
  }

  addGround(options: GroundOptions = {}): Collider {
    const halfExtents = options.halfExtents ?? DEFAULT_GROUND_HALF_EXTENTS;
    const translation = options.translation ?? DEFAULT_GROUND_TRANSLATION;
    let colliderDesc: ColliderDesc = RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z,
    ).setTranslation(translation.x, translation.y, translation.z);

    if (options.friction !== undefined) {
      colliderDesc = colliderDesc.setFriction(options.friction);
    }

    if (options.restitution !== undefined) {
      colliderDesc = colliderDesc.setRestitution(options.restitution);
    }

    return this.world.createCollider(colliderDesc);
  }

  step(deltaSeconds: number): PhysicsStepResult {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return {
        substeps: 0,
        accumulatorSeconds: this.accumulatorSeconds,
        simulatedSeconds: 0,
      };
    }

    const clampedDeltaSeconds = Math.min(deltaSeconds, this.maxDeltaSeconds);
    this.accumulatorSeconds = Math.min(
      this.accumulatorSeconds + clampedDeltaSeconds,
      this.fixedTimestepSeconds * this.maxSubsteps,
    );

    let substeps = 0;

    while (
      this.accumulatorSeconds >= this.fixedTimestepSeconds &&
      substeps < this.maxSubsteps
    ) {
      this.world.step();
      this.accumulatorSeconds -= this.fixedTimestepSeconds;
      substeps += 1;
    }

    if (substeps === this.maxSubsteps) {
      this.accumulatorSeconds = Math.min(
        this.accumulatorSeconds,
        this.fixedTimestepSeconds,
      );
    }

    return {
      substeps,
      accumulatorSeconds: this.accumulatorSeconds,
      simulatedSeconds: substeps * this.fixedTimestepSeconds,
    };
  }
}
