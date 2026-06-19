import RAPIER, {
  type Collider,
  type Quaternion,
  type RigidBody,
  type World,
} from '@dimforge/rapier3d-compat';

import type { Vector3Like } from '../road/RoadTypes';
import type { PhysicsStepResult, PhysicsVector, VehiclePhysics } from './VehiclePhysics';

export type Gear = 'D' | 'R' | 'N' | 'P';

export type Indicator = 'off' | 'left' | 'right' | 'hazard';

export type CarInput = Readonly<{
  throttle?: number;
  brake?: number;
  steering?: number;
  gear?: Gear;
  indicator?: Indicator;
}>;

export type DigitalCarInput = Readonly<{
  forward?: boolean;
  backward?: boolean;
  left?: boolean;
  right?: boolean;
  gear?: Gear;
  indicator?: Indicator;
}>;

export type CarState = Readonly<{
  position: Vector3Like;
  rotation: Quaternion;
  yawDegrees: number;
  speedMph: number;
  signedSpeedMph: number;
  wheelAngleRadians: number;
  gear: Gear;
  indicator: Indicator;
}>;

export type PlayerCarOptions = Readonly<{
  initialPosition?: PhysicsVector;
  initialYawRadians?: number;
  halfExtents?: PhysicsVector;
  massKg?: number;
  engineForceNewtons?: number;
  reverseForceNewtons?: number;
  brakeForceNewtons?: number;
  maxSpeedMph?: number;
  maxReverseSpeedMph?: number;
  maxSteeringAngleRadians?: number;
  steeringResponseRadiansPerSecond?: number;
  steeringReturnRadiansPerSecond?: number;
  lateralGrip?: number;
  rollingResistance?: number;
  aerodynamicDrag?: number;
  linearDamping?: number;
  angularDamping?: number;
  friction?: number;
  restitution?: number;
}>;

const METERS_PER_SECOND_TO_MPH = 2.2369362920544;
const MPH_TO_METERS_PER_SECOND = 1 / METERS_PER_SECOND_TO_MPH;
const DEFAULT_HALF_EXTENTS: PhysicsVector = Object.freeze({ x: 0.9, y: 0.45, z: 1.9 });
const DEFAULT_POSITION: PhysicsVector = Object.freeze({ x: 0, y: 0.7, z: 0 });
const DEFAULT_OPTIONS = Object.freeze({
  massKg: 1_250,
  engineForceNewtons: 8_500,
  reverseForceNewtons: 4_200,
  brakeForceNewtons: 12_000,
  maxSpeedMph: 70,
  maxReverseSpeedMph: 18,
  maxSteeringAngleRadians: 0.55,
  steeringResponseRadiansPerSecond: 2.8,
  steeringReturnRadiansPerSecond: 3.8,
  lateralGrip: 8.5,
  rollingResistance: 30,
  aerodynamicDrag: 0.42,
  linearDamping: 0.35,
  angularDamping: 1.8,
  friction: 0.35,
  restitution: 0.08,
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(max, Math.max(min, value));
}

function yawQuaternion(yawRadians: number): Quaternion {
  const halfYaw = yawRadians / 2;
  return {
    x: 0,
    y: Math.sin(halfYaw),
    z: 0,
    w: Math.cos(halfYaw),
  };
}

function yawFromQuaternion(rotation: Quaternion): number {
  return Math.atan2(
    2 * (rotation.w * rotation.y + rotation.x * rotation.z),
    1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z),
  );
}

function vectorLength(vector: Vector3Like): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function signedForwardSpeedMetersPerSecond(rotation: Quaternion, velocity: Vector3Like): number {
  const yaw = yawFromQuaternion(rotation);
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);

  return velocity.x * forwardX + velocity.z * forwardZ;
}

function normaliseInput(input: CarInput): Required<CarInput> {
  return {
    throttle: clamp(input.throttle ?? 0, 0, 1),
    brake: clamp(input.brake ?? 0, 0, 1),
    steering: clamp(input.steering ?? 0, -1, 1),
    gear: input.gear ?? 'D',
    indicator: input.indicator ?? 'off',
  };
}

export function createDigitalCarInput(input: DigitalCarInput): CarInput {
  return {
    throttle: input.forward ? 1 : 0,
    brake: input.backward ? 1 : 0,
    steering: (input.right ? 1 : 0) - (input.left ? 1 : 0),
    gear: input.gear,
    indicator: input.indicator,
  };
}

export class PlayerCar {
  private readonly physics: VehiclePhysics;
  private readonly world: World;
  private readonly rigidBody: RigidBody;
  private readonly collider: Collider;
  private readonly options: Required<PlayerCarOptions>;
  private gear: Gear = 'D';
  private indicator: Indicator = 'off';
  private wheelAngleRadians = 0;

  private readonly spawnPosition: Vector3Like;
  private readonly spawnRotation: Quaternion;

  constructor(physics: VehiclePhysics, options: PlayerCarOptions = {}) {
    this.physics = physics;
    this.world = physics.getWorld();
    this.options = {
      initialPosition: options.initialPosition ?? DEFAULT_POSITION,
      initialYawRadians: options.initialYawRadians ?? 0,
      halfExtents: options.halfExtents ?? DEFAULT_HALF_EXTENTS,
      massKg: options.massKg ?? DEFAULT_OPTIONS.massKg,
      engineForceNewtons: options.engineForceNewtons ?? DEFAULT_OPTIONS.engineForceNewtons,
      reverseForceNewtons: options.reverseForceNewtons ?? DEFAULT_OPTIONS.reverseForceNewtons,
      brakeForceNewtons: options.brakeForceNewtons ?? DEFAULT_OPTIONS.brakeForceNewtons,
      maxSpeedMph: options.maxSpeedMph ?? DEFAULT_OPTIONS.maxSpeedMph,
      maxReverseSpeedMph: options.maxReverseSpeedMph ?? DEFAULT_OPTIONS.maxReverseSpeedMph,
      maxSteeringAngleRadians:
        options.maxSteeringAngleRadians ?? DEFAULT_OPTIONS.maxSteeringAngleRadians,
      steeringResponseRadiansPerSecond:
        options.steeringResponseRadiansPerSecond ??
        DEFAULT_OPTIONS.steeringResponseRadiansPerSecond,
      steeringReturnRadiansPerSecond:
        options.steeringReturnRadiansPerSecond ??
        DEFAULT_OPTIONS.steeringReturnRadiansPerSecond,
      lateralGrip: options.lateralGrip ?? DEFAULT_OPTIONS.lateralGrip,
      rollingResistance: options.rollingResistance ?? DEFAULT_OPTIONS.rollingResistance,
      aerodynamicDrag: options.aerodynamicDrag ?? DEFAULT_OPTIONS.aerodynamicDrag,
      linearDamping: options.linearDamping ?? DEFAULT_OPTIONS.linearDamping,
      angularDamping: options.angularDamping ?? DEFAULT_OPTIONS.angularDamping,
      friction: options.friction ?? DEFAULT_OPTIONS.friction,
      restitution: options.restitution ?? DEFAULT_OPTIONS.restitution,
    };

    const position = this.options.initialPosition;
    const halfExtents = this.options.halfExtents;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(yawQuaternion(this.options.initialYawRadians))
      .setLinearDamping(this.options.linearDamping)
      .setAngularDamping(this.options.angularDamping)
      .setCanSleep(false);

    this.rigidBody = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z,
    )
      .setMass(this.options.massKg)
      .setFriction(this.options.friction)
      .setRestitution(this.options.restitution);

    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    const initialRot = yawQuaternion(this.options.initialYawRadians);
    this.spawnPosition = { x: position.x, y: position.y, z: position.z };
    this.spawnRotation = { x: initialRot.x, y: initialRot.y, z: initialRot.z, w: initialRot.w };
  }

  getRigidBody(): RigidBody {
    return this.rigidBody;
  }

  getCollider(): Collider {
    return this.collider;
  }

  getState(): CarState {
    const position = this.rigidBody.translation();
    const rotation = this.rigidBody.rotation();
    const velocity = this.rigidBody.linvel();
    const signedSpeedMph =
      signedForwardSpeedMetersPerSecond(rotation, velocity) * METERS_PER_SECOND_TO_MPH;

    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      yawDegrees: (yawFromQuaternion(rotation) * 180) / Math.PI,
      speedMph: vectorLength(velocity) * METERS_PER_SECOND_TO_MPH,
      signedSpeedMph,
      wheelAngleRadians: this.wheelAngleRadians,
      gear: this.gear,
      indicator: this.indicator,
    };
  }

  respawn(position: Vector3Like, rotation: Quaternion): void {
    this.rigidBody.setTranslation(position, true);
    this.rigidBody.setRotation(rotation, true);
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.resetForces(true);
    this.rigidBody.resetTorques(true);
    this.wheelAngleRadians = 0;
  }

  fixedUpdate(input: CarInput, deltaSeconds: number): CarState {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return this.getState();
    }

    // Reset accumulated forces and torques at the beginning of each step
    this.rigidBody.resetForces(true);
    this.rigidBody.resetTorques(true);

    const resolvedInput = normaliseInput(input);
    this.gear = resolvedInput.gear;
    this.indicator = resolvedInput.indicator;

    this.updateSteering(resolvedInput.steering, deltaSeconds);
    this.applyDrivetrainForces(resolvedInput);
    this.applyPlanarStabilisation();

    if (this.rigidBody.translation().y < -10) {
      this.respawn(this.spawnPosition, this.spawnRotation);
    }

    return this.getState();
  }

  update(input: CarInput, deltaSeconds: number): CarState & { physicsStep: PhysicsStepResult } {
    this.fixedUpdate(input, deltaSeconds);
    const physicsStep = this.physics.step(deltaSeconds);

    if (this.rigidBody.translation().y < -10) {
      this.respawn(this.spawnPosition, this.spawnRotation);
    }

    return {
      ...this.getState(),
      physicsStep,
    };
  }

  private updateSteering(targetInput: number, deltaSeconds: number): void {
    const targetAngle = targetInput * this.options.maxSteeringAngleRadians;
    const rate =
      Math.abs(targetInput) > 0
        ? this.options.steeringResponseRadiansPerSecond
        : this.options.steeringReturnRadiansPerSecond;
    const maxChange = rate * deltaSeconds;
    const angleDelta = clamp(targetAngle - this.wheelAngleRadians, -maxChange, maxChange);

    this.wheelAngleRadians = clamp(
      this.wheelAngleRadians + angleDelta,
      -this.options.maxSteeringAngleRadians,
      this.options.maxSteeringAngleRadians,
    );
  }

  private applyDrivetrainForces(input: Required<CarInput>): void {
    if (this.gear === 'P') {
      this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const rotation = this.rigidBody.rotation();
    const yaw = yawFromQuaternion(rotation);
    const forward = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
    const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
    const velocity = this.rigidBody.linvel();
    const forwardSpeed = signedForwardSpeedMetersPerSecond(rotation, velocity);

    if (this.gear === 'D' && input.throttle > 0) {
      const maxForwardSpeed = this.options.maxSpeedMph * MPH_TO_METERS_PER_SECOND;

      if (forwardSpeed < maxForwardSpeed) {
        this.rigidBody.addForce(
          {
            x: forward.x * this.options.engineForceNewtons * input.throttle,
            y: 0,
            z: forward.z * this.options.engineForceNewtons * input.throttle,
          },
          true,
        );
      }
    }

    if (this.gear === 'R' && input.throttle > 0) {
      const maxReverseSpeed = -this.options.maxReverseSpeedMph * MPH_TO_METERS_PER_SECOND;

      if (forwardSpeed > maxReverseSpeed) {
        this.rigidBody.addForce(
          {
            x: -forward.x * this.options.reverseForceNewtons * input.throttle,
            y: 0,
            z: -forward.z * this.options.reverseForceNewtons * input.throttle,
          },
          true,
        );
      }
    }

    if (input.brake > 0) {
      const brakeDirection = Math.sign(forwardSpeed);

      if (brakeDirection !== 0) {
        this.rigidBody.addForce(
          {
            x: -forward.x * brakeDirection * this.options.brakeForceNewtons * input.brake,
            y: 0,
            z: -forward.z * brakeDirection * this.options.brakeForceNewtons * input.brake,
          },
          true,
        );
      }
    }

    if (this.gear !== 'N') {
      const lateralVelocity = velocity.x * right.x + velocity.z * right.z;
      const lateralImpulse = -lateralVelocity * this.options.massKg * this.options.lateralGrip;

      this.rigidBody.addForce(
        {
          x: right.x * lateralImpulse,
          y: 0,
          z: right.z * lateralImpulse,
        },
        true,
      );
    }

    this.applySpeedDependentResistance(forward, forwardSpeed);
    this.applySteeringTorque(forwardSpeed);
  }

  private applySpeedDependentResistance(
    forward: Readonly<{ x: number; y: number; z: number }>,
    forwardSpeed: number,
  ): void {
    const dragMagnitude =
      forwardSpeed * Math.abs(forwardSpeed) * this.options.aerodynamicDrag +
      forwardSpeed * this.options.rollingResistance;

    this.rigidBody.addForce(
      {
        x: -forward.x * dragMagnitude,
        y: 0,
        z: -forward.z * dragMagnitude,
      },
      true,
    );
  }

  private applySteeringTorque(forwardSpeed: number): void {
    const speedFactor = clamp(Math.abs(forwardSpeed) / 8, 0, 1);
    const reverseMultiplier = forwardSpeed < 0 ? -1 : 1;
    const yawTorque =
      this.wheelAngleRadians * speedFactor * reverseMultiplier * this.options.massKg * 5;

    if (yawTorque !== 0) {
      this.rigidBody.addTorque({ x: 0, y: yawTorque, z: 0 }, true);
    }
  }

  private applyPlanarStabilisation(): void {
    const rotation = this.rigidBody.rotation();
    const yaw = yawFromQuaternion(rotation);
    const angularVelocity = this.rigidBody.angvel();

    this.rigidBody.setRotation(yawQuaternion(yaw), true);
    this.rigidBody.setAngvel({ x: 0, y: angularVelocity.y, z: 0 }, true);
  }
}
