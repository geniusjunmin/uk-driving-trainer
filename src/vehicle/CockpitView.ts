import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type WebGLRenderer,
} from 'three';

import type { ObservationState, VehiclePose } from '../rules/RuleEngine';

export type MirrorId = 'center' | 'left' | 'right';

export interface CockpitLookState {
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
  readonly observedMirror: MirrorId | null;
  readonly observedBlindSpot: 'left' | 'right' | null;
}

export interface CockpitObservationState extends ObservationState {
  readonly checkedInteriorMirror?: boolean;
  readonly checkedLeftMirror?: boolean;
  readonly checkedRightMirror?: boolean;
  readonly checkedBlindSpot?: boolean;
  readonly checkedRearView?: boolean;
  readonly lastCheckedAtSeconds?: number;
  readonly lastObservedMirror?: MirrorId;
  readonly lastObservedBlindSpot?: 'left' | 'right';
}

export interface CockpitViewOptions {
  readonly mirrorTextureSize?: number;
  readonly cameraFovDegrees?: number;
  readonly near?: number;
  readonly far?: number;
}

export interface CockpitMirror {
  readonly id: MirrorId;
  readonly camera: PerspectiveCamera;
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly renderTarget: WebGLRenderTarget;
  readonly group: Group;
}

type MutableObservationState = {
  -readonly [Key in keyof CockpitObservationState]: CockpitObservationState[Key];
};

const DEFAULT_MIRROR_TEXTURE_SIZE = 512;
const MAIN_CAMERA_FOV_DEGREES = 64;
const MIRROR_CAMERA_FOV_DEGREES = 58;
const MAIN_NEAR = 0.05;
const MAIN_FAR = 650;
const MIRROR_NEAR = 0.08;
const MIRROR_FAR = 260;
const LOOK_MIRROR_YAW_THRESHOLD_DEGREES = 18;
const BLIND_SPOT_YAW_THRESHOLD_DEGREES = 72;
const PITCH_LIMIT_DEGREES = 35;
const YAW_LIMIT_DEGREES = 105;

const localForward = new Vector3(0, 0, -1);
const localBackward = new Vector3(0, 0, 1);
const localLeftRear = new Vector3(-0.55, -0.04, 1).normalize();
const localRightRear = new Vector3(0.55, -0.04, 1).normalize();

const vehiclePosition = new Vector3();
const vehicleRotation = new Quaternion();

/**
 * Cockpit local axes use Three.js metres with Y up:
 * +X is the driver's right side, -X is passenger/left side, -Z is forward,
 * and +Z is rearward. This keeps a UK right-hand-drive wheel at positive X.
 */
export class CockpitView {
  readonly root = new Group();
  readonly cockpitGroup = new Group();
  readonly mirrorGroup = new Group();

  private readonly camera: PerspectiveCamera;
  private readonly mirrors: Record<MirrorId, CockpitMirror>;
  private readonly target = new Vector3();
  private readonly lookEulerDegrees = { yaw: 0, pitch: 0 };
  private observation: CockpitObservationState = {};
  private aspect = 1;

  constructor(options: CockpitViewOptions = {}) {
    this.camera = new PerspectiveCamera(
      options.cameraFovDegrees ?? MAIN_CAMERA_FOV_DEGREES,
      this.aspect,
      options.near ?? MAIN_NEAR,
      options.far ?? MAIN_FAR,
    );
    this.camera.position.set(0.38, 1.24, 0.12);
    this.camera.lookAt(this.camera.position.clone().add(localForward));

    this.root.name = 'RightHandDriveCockpitView';
    this.cockpitGroup.name = 'CockpitShell_RightHandDrive';
    this.mirrorGroup.name = 'CockpitMirrors';
    this.root.add(this.cockpitGroup, this.mirrorGroup, this.camera);

    this.createCockpitSkeleton();
    this.mirrors = this.createMirrors(options.mirrorTextureSize ?? DEFAULT_MIRROR_TEXTURE_SIZE);
  }

  get activeCamera(): PerspectiveCamera {
    return this.camera;
  }

  get object3D(): Object3D {
    return this.root;
  }

  getMirror(id: MirrorId): CockpitMirror {
    return this.mirrors[id];
  }

  getMirrorGroup(): Group {
    return this.mirrorGroup;
  }

  getLookState(): CockpitLookState {
    const mirror = this.detectObservedMirror();
    const blindSpot = this.detectObservedBlindSpot();

    return {
      yawDegrees: this.lookEulerDegrees.yaw,
      pitchDegrees: this.lookEulerDegrees.pitch,
      observedMirror: mirror,
      observedBlindSpot: blindSpot,
    };
  }

  getObservationState(): CockpitObservationState {
    return { ...this.observation };
  }

  setLookOffset(yawDegrees: number, pitchDegrees: number, timeSeconds?: number): CockpitLookState {
    this.lookEulerDegrees.yaw = clamp(yawDegrees, -YAW_LIMIT_DEGREES, YAW_LIMIT_DEGREES);
    this.lookEulerDegrees.pitch = clamp(pitchDegrees, -PITCH_LIMIT_DEGREES, PITCH_LIMIT_DEGREES);
    this.applyLookOffset();
    return this.recordObservationFromLook(timeSeconds);
  }

  addLookOffset(deltaYawDegrees: number, deltaPitchDegrees: number, timeSeconds?: number): CockpitLookState {
    return this.setLookOffset(
      this.lookEulerDegrees.yaw + deltaYawDegrees,
      this.lookEulerDegrees.pitch + deltaPitchDegrees,
      timeSeconds,
    );
  }

  recordObservationFromLook(timeSeconds?: number): CockpitLookState {
    const lookState = this.getLookState();
    const nextObservation: MutableObservationState = { ...this.observation };

    if (lookState.observedMirror) {
      nextObservation.lastObservedMirror = lookState.observedMirror;
      nextObservation.lastCheckedAtSeconds = timeSeconds;
      nextObservation.checkedRearView = true;

      if (lookState.observedMirror === 'center') {
        nextObservation.checkedInteriorMirror = true;
      } else if (lookState.observedMirror === 'left') {
        nextObservation.checkedLeftMirror = true;
      } else {
        nextObservation.checkedRightMirror = true;
      }
    }

    if (lookState.observedBlindSpot) {
      nextObservation.checkedBlindSpot = true;
      nextObservation.lastObservedBlindSpot = lookState.observedBlindSpot;
      nextObservation.lastCheckedAtSeconds = timeSeconds;
    }

    this.observation = nextObservation;
    return lookState;
  }

  clearObservationState(): void {
    this.observation = {};
  }

  updateFromVehiclePose(pose: VehiclePose): void {
    vehiclePosition.set(pose.position.x, pose.position.y, pose.position.z);
    vehicleRotation.setFromAxisAngle(new Vector3(0, 1, 0), degreesToRadians(pose.yawDegrees));

    this.root.position.copy(vehiclePosition);
    this.root.quaternion.copy(vehicleRotation);
  }

  resize(width: number, height: number, mirrorTextureSize?: number): void {
    this.aspect = width / Math.max(height, 1);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();

    if (mirrorTextureSize) {
      for (const mirror of Object.values(this.mirrors)) {
        mirror.renderTarget.setSize(mirrorTextureSize, mirrorTextureSize);
      }
    }
  }

  renderMirrors(scene: Scene, renderer: WebGLRenderer): void {
    const previousRenderTarget = renderer.getRenderTarget();

    for (const mirror of Object.values(this.mirrors)) {
      mirror.mesh.visible = false;
      renderer.setRenderTarget(mirror.renderTarget);
      renderer.render(scene, mirror.camera);
      mirror.mesh.visible = true;
    }

    renderer.setRenderTarget(previousRenderTarget);
  }

  dispose(): void {
    for (const mirror of Object.values(this.mirrors)) {
      mirror.mesh.geometry.dispose();
      mirror.mesh.material.map = null;
      mirror.mesh.material.dispose();
      mirror.renderTarget.dispose();
    }

    for (const child of this.cockpitGroup.children) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  private createCockpitSkeleton(): void {
    const darkTrim = new MeshStandardMaterial({ color: 0x20252a, roughness: 0.86 });
    const wheelMaterial = new MeshStandardMaterial({ color: 0x111417, roughness: 0.72 });
    const dashboard = new Mesh(new BoxGeometry(1.7, 0.18, 0.36), darkTrim);
    dashboard.name = 'DashboardCrossbar';
    dashboard.position.set(0, 0.9, -0.58);

    const rightHandWheel = new Mesh(new TorusGeometry(0.19, 0.018, 12, 36), wheelMaterial);
    rightHandWheel.name = 'SteeringWheel_RightHandDrive_PositiveX';
    rightHandWheel.position.set(0.42, 0.86, -0.66);
    rightHandWheel.rotation.x = Math.PI * 0.1;

    const steeringColumn = new Mesh(new BoxGeometry(0.08, 0.08, 0.22), wheelMaterial);
    steeringColumn.name = 'SteeringColumn_RightSide';
    steeringColumn.position.set(0.42, 0.8, -0.54);
    steeringColumn.rotation.x = Math.PI * 0.16;

    const windscreenBase = new Mesh(new BoxGeometry(1.8, 0.04, 0.08), darkTrim);
    windscreenBase.name = 'WindscreenBase';
    windscreenBase.position.set(0, 1.16, -0.86);

    this.cockpitGroup.add(dashboard, rightHandWheel, steeringColumn, windscreenBase);
  }

  private createMirrors(textureSize: number): Record<MirrorId, CockpitMirror> {
    return {
      center: this.createMirror('center', textureSize, {
        meshPosition: new Vector3(0, 1.54, -0.58),
        meshScale: new Vector3(0.46, 0.16, 1),
        cameraPosition: new Vector3(0, 1.45, -0.24),
        rearDirection: localBackward,
      }),
      left: this.createMirror('left', textureSize, {
        meshPosition: new Vector3(-0.78, 1.2, -0.7),
        meshScale: new Vector3(0.28, 0.2, 1),
        cameraPosition: new Vector3(-0.82, 1.15, -0.35),
        rearDirection: localLeftRear,
      }),
      right: this.createMirror('right', textureSize, {
        meshPosition: new Vector3(0.9, 1.18, -0.7),
        meshScale: new Vector3(0.28, 0.2, 1),
        cameraPosition: new Vector3(0.86, 1.15, -0.35),
        rearDirection: localRightRear,
      }),
    };
  }

  private createMirror(
    id: MirrorId,
    textureSize: number,
    config: {
      readonly meshPosition: Vector3;
      readonly meshScale: Vector3;
      readonly cameraPosition: Vector3;
      readonly rearDirection: Vector3;
    },
  ): CockpitMirror {
    const renderTarget = new WebGLRenderTarget(textureSize, textureSize);
    renderTarget.texture.name = `CockpitMirror_${id}_Texture`;
    renderTarget.texture.wrapS = RepeatWrapping;
    renderTarget.texture.repeat.x = -1;
    renderTarget.texture.offset.x = 1;

    const material = new MeshBasicMaterial({
      color: new Color(0xffffff),
      map: renderTarget.texture,
      side: DoubleSide,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    mesh.name = `CockpitMirror_${id}_Plane`;
    mesh.position.copy(config.meshPosition);
    mesh.scale.copy(config.meshScale);

    const camera = new PerspectiveCamera(MIRROR_CAMERA_FOV_DEGREES, 1, MIRROR_NEAR, MIRROR_FAR);
    camera.name = `CockpitMirror_${id}_Camera`;
    camera.position.copy(config.cameraPosition);
    this.target.copy(config.cameraPosition).add(config.rearDirection);
    camera.lookAt(this.target);

    const group = new Group();
    group.name = `CockpitMirror_${id}_Group`;
    group.add(mesh, camera);
    this.mirrorGroup.add(group);

    return { id, camera, mesh, renderTarget, group };
  }

  private applyLookOffset(): void {
    const yawRadians = degreesToRadians(this.lookEulerDegrees.yaw);
    const pitchRadians = degreesToRadians(this.lookEulerDegrees.pitch);
    const lookDirection = localForward.clone().applyAxisAngle(new Vector3(0, 1, 0), yawRadians);
    lookDirection.applyAxisAngle(new Vector3(1, 0, 0), pitchRadians);

    this.camera.lookAt(this.camera.position.clone().add(lookDirection));
  }

  private detectObservedMirror(): MirrorId | null {
    const yaw = this.lookEulerDegrees.yaw;
    const pitch = Math.abs(this.lookEulerDegrees.pitch);

    if (pitch > 24) {
      return null;
    }

    if (Math.abs(yaw) <= LOOK_MIRROR_YAW_THRESHOLD_DEGREES) {
      return 'center';
    }

    if (yaw <= -LOOK_MIRROR_YAW_THRESHOLD_DEGREES && yaw > -BLIND_SPOT_YAW_THRESHOLD_DEGREES) {
      return 'left';
    }

    if (yaw >= LOOK_MIRROR_YAW_THRESHOLD_DEGREES && yaw < BLIND_SPOT_YAW_THRESHOLD_DEGREES) {
      return 'right';
    }

    return null;
  }

  private detectObservedBlindSpot(): 'left' | 'right' | null {
    if (this.lookEulerDegrees.yaw <= -BLIND_SPOT_YAW_THRESHOLD_DEGREES) {
      return 'left';
    }

    if (this.lookEulerDegrees.yaw >= BLIND_SPOT_YAW_THRESHOLD_DEGREES) {
      return 'right';
    }

    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
