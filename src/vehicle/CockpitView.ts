import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SphereGeometry,
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
const MAIN_CAMERA_FOV_DEGREES = 74;
const MIRROR_CAMERA_FOV_DEGREES = 58;
const MAIN_NEAR = 0.05;
const MAIN_FAR = 650;
const MIRROR_NEAR = 0.08;
const MIRROR_FAR = 260;
const LOOK_MIRROR_YAW_THRESHOLD_DEGREES = 18;
const BLIND_SPOT_YAW_THRESHOLD_DEGREES = 72;
const PITCH_LIMIT_DEGREES = 35;
const YAW_LIMIT_DEGREES = 105;
const localForward = new Vector3(0, 0, 1);
const localBackward = new Vector3(0, 0, -1);
const localLeftRear = new Vector3(-0.55, -0.04, -1).normalize();
const localRightRear = new Vector3(0.55, -0.04, -1).normalize();


const vehiclePosition = new Vector3();
const vehicleRotation = new Quaternion();

function createGPSTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  
  // Map Background (dark theme map)
  ctx.fillStyle = '#1b1d22';
  ctx.fillRect(0, 0, 256, 128);

  // Water body
  ctx.fillStyle = '#1c3d5a';
  ctx.fillRect(160, 10, 80, 40);

  // Parks
  ctx.fillStyle = '#1f3d24';
  ctx.beginPath();
  ctx.arc(40, 90, 30, 0, Math.PI * 2);
  ctx.fill();

  // Draw street grid
  ctx.strokeStyle = '#2d323f';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Roads
  ctx.beginPath();
  ctx.moveTo(10, 64); ctx.lineTo(246, 64);
  ctx.moveTo(100, 10); ctx.lineTo(100, 118);
  ctx.moveTo(180, 10); ctx.lineTo(180, 118);
  ctx.moveTo(10, 30); ctx.lineTo(100, 30);
  ctx.stroke();

  // GPS Route highlighted path (Cyan/Blue route)
  ctx.strokeStyle = '#00a8ff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(100, 118);
  ctx.lineTo(100, 64);
  ctx.lineTo(180, 64);
  ctx.lineTo(180, 20);
  ctx.stroke();

  // Navigation Arrow icon
  ctx.fillStyle = '#ff2b55';
  ctx.beginPath();
  ctx.moveTo(100, 95);
  ctx.lineTo(94, 105);
  ctx.lineTo(100, 102);
  ctx.lineTo(106, 105);
  ctx.closePath();
  ctx.fill();

  // Destination Flag
  ctx.fillStyle = '#00ff66';
  ctx.beginPath();
  ctx.arc(180, 20, 7, 0, Math.PI * 2);
  ctx.fill();

  // Overlay HUD
  ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
  ctx.fillRect(4, 4, 90, 52);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(4, 4, 90, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('GPS ACTIVE', 10, 16);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('ETA: 4 min', 10, 30);
  ctx.fillText('1.2 mi to destination', 10, 42);

  // Speed Limit Indicator
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(238, 106, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('20', 238, 106);

  ctx.textAlign = 'left'; // reset text align

  return new CanvasTexture(canvas);
}

function createTelemetryTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  
  // Background
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, 128, 128);

  // Draw grid lines
  ctx.strokeStyle = '#151c24';
  ctx.lineWidth = 1;
  for (let i = 16; i < 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
  }

  // Draw wave charts (diagnostic signals)
  ctx.strokeStyle = '#00f5d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < 128; x++) {
    const y = 80 + Math.sin(x * 0.15) * 12 + Math.cos(x * 0.08) * 4;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#ffb703';
  ctx.beginPath();
  for (let x = 0; x < 128; x++) {
    const y = 106 + Math.cos(x * 0.1) * 8;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Diagnostics text
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('SYSTEM OK', 8, 15);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '8px monospace';
  ctx.fillText('ABS: ACTIVE', 8, 28);
  ctx.fillText('ESC: STANDBY', 8, 38);
  ctx.fillText('TEMP: 92 C', 8, 48);
  ctx.fillText('PSI: 32 / 32', 8, 58);

  return new CanvasTexture(canvas);
}

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
  private steeringWheel!: Group;

  // References for dashboard animations
  private speedNeedle!: Mesh;
  private tachoNeedle!: Mesh;
  private leftArrow!: Mesh;
  private rightArrow!: Mesh;
  private pedalThrottle!: Group;
  private pedalBrake!: Group;
  private wiperL!: Mesh;
  private wiperR!: Mesh;

  constructor(options: CockpitViewOptions = {}) {
    this.camera = new PerspectiveCamera(
      options.cameraFovDegrees ?? MAIN_CAMERA_FOV_DEGREES,
      this.aspect,
      options.near ?? MAIN_NEAR,
      options.far ?? MAIN_FAR,
    );
    this.camera.position.set(0.38, 1.24, -0.12);
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

  updateFromVehiclePose(
    pose: VehiclePose & {
      wheelAngleRadians?: number;
      throttlePressed?: boolean;
      brakePressed?: boolean;
      indicatorState?: 'off' | 'left' | 'right' | 'hazard';
      speedMph?: number;
    }
  ): void {
    vehiclePosition.set(pose.position.x, pose.position.y, pose.position.z);
    vehicleRotation.setFromAxisAngle(new Vector3(0, 1, 0), degreesToRadians(pose.yawDegrees));

    this.root.position.copy(vehiclePosition);
    this.root.quaternion.copy(vehicleRotation);

    // 1. Steering Wheel
    if (this.steeringWheel && pose.wheelAngleRadians !== undefined) {
      this.steeringWheel.rotation.z = -pose.wheelAngleRadians * 4.2;
    }

    // 2. Accelerator & Brake Pedals
    if (this.pedalThrottle) {
      this.pedalThrottle.rotation.x = -Math.PI / 8 + (pose.throttlePressed ? 0.28 : 0);
    }
    if (this.pedalBrake) {
      this.pedalBrake.rotation.x = -Math.PI / 8 + (pose.brakePressed ? 0.28 : 0);
    }

    // 3. Dashboard Dials (Speedo & Tacho)
    const speed = pose.speedMph || 0;
    if (this.speedNeedle) {
      // Sweeps clockwise from -1.2 to -3.6 rad
      this.speedNeedle.rotation.z = -1.2 - Math.min(1.0, speed / 110) * 2.2;
    }
    if (this.tachoNeedle) {
      // Simulate engine RPM cycles + vibration
      const rpmCycle = speed === 0 ? 0.08 : 0.12 + ((speed % 22) / 22) * 0.58;
      const rpmVibe = Math.sin(performance.now() * 0.08) * 0.015;
      this.tachoNeedle.rotation.z = -0.6 - rpmCycle * 2.2 + rpmVibe;
    }

    // 4. Turn Signal Arrow Indicators
    if (this.leftArrow && this.rightArrow) {
      const isBlinkOn = Math.floor(performance.now() / 320) % 2 === 0;
      this.leftArrow.visible = (pose.indicatorState === 'left' || pose.indicatorState === 'hazard') && isBlinkOn;
      this.rightArrow.visible = (pose.indicatorState === 'right' || pose.indicatorState === 'hazard') && isBlinkOn;
    }

    // 5. Windshield Wipers
    if (this.wiperL && this.wiperR) {
      if (speed > 1) {
        // Sweep angle 0 to 1.2 radians
        const sweep = Math.sin(performance.now() * 0.005) * 0.6 + 0.6;
        this.wiperL.rotation.z = sweep;
        this.wiperR.rotation.z = sweep;
      } else {
        // Return to rest position
        this.wiperL.rotation.z = 0;
        this.wiperR.rotation.z = 0;
      }
    }
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

    this.cockpitGroup.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  private createCockpitSkeleton(): void {
    const darkTrim = new MeshStandardMaterial({ color: 0x181c20, roughness: 0.85 });
    const consolePlastic = new MeshStandardMaterial({ color: 0x1e2229, roughness: 0.9 });
    const metallicMaterial = new MeshStandardMaterial({ color: 0x606872, metalness: 0.8, roughness: 0.25 });
    const chromeTrim = new MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });
    const wheelMaterial = new MeshStandardMaterial({ color: 0x0f1113, roughness: 0.65 });
    const screenPlastic = new MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    const leatherSeatMat = new MeshStandardMaterial({ color: 0x22252a, roughness: 0.72 });
    
    // 1. Dashboard (Curved console assembly)
    const dashboard = new Group();
    dashboard.name = 'DashboardGroup';
    
    const dashboardMain = new Mesh(new BoxGeometry(1.7, 0.18, 0.36), darkTrim);
    dashboardMain.position.set(0, 0.9, 0.58);
    dashboard.add(dashboardMain);
    
    // Curved dashboard top cover
    const dashboardHood = new Mesh(new BoxGeometry(1.68, 0.06, 0.28), darkTrim);
    dashboardHood.position.set(0, 0.99, 0.52);
    dashboard.add(dashboardHood);
    
    // Center Console with styled trims
    const centerConsole = new Mesh(new BoxGeometry(0.36, 0.55, 0.32), consolePlastic);
    centerConsole.position.set(-0.08, 0.54, 0.46);
    dashboard.add(centerConsole);

    // Hazard Button (glowing red triangle)
    const hazardMat = new MeshBasicMaterial({ color: 0xff3b30 });
    const hazardBtn = new Mesh(new BoxGeometry(0.06, 0.04, 0.02), hazardMat);
    hazardBtn.position.set(-0.08, 0.72, 0.62);
    dashboard.add(hazardBtn);

    // Climate Control Dial buttons (AC knobs)
    const knobGeo = new CylinderGeometry(0.025, 0.025, 0.015, 12);
    knobGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const knob = new Mesh(knobGeo, chromeTrim);
      knob.position.set(-0.17 + i * 0.09, 0.64, 0.622);
      dashboard.add(knob);
    }
    
    // Air Vents
    const ventMaterial = new MeshStandardMaterial({ color: 0x080808, roughness: 0.95 });
    const ventGeo = new CylinderGeometry(0.035, 0.035, 0.01, 16);
    for (const xOffset of [-0.68, -0.08, 0.68]) {
      const vent = new Mesh(ventGeo, ventMaterial);
      vent.rotation.x = Math.PI / 2;
      vent.position.set(xOffset, 0.94, 0.74);
      dashboard.add(vent);
    }
    
    // A-pillars and Roof frame
    const pillarLeft = new Mesh(new BoxGeometry(0.06, 0.85, 0.06), darkTrim);
    pillarLeft.position.set(0.86, 1.48, 0.86);
    pillarLeft.rotation.z = -0.15;
    
    const pillarRight = new Mesh(new BoxGeometry(0.06, 0.85, 0.06), darkTrim);
    pillarRight.position.set(-0.86, 1.48, 0.86);
    pillarRight.rotation.z = 0.15;
    
    const roofHeader = new Mesh(new BoxGeometry(1.82, 0.05, 0.06), darkTrim);
    roofHeader.position.set(0, 1.88, 0.86);
    
    this.cockpitGroup.add(dashboard, pillarLeft, pillarRight, roofHeader);
 
    // 2. Instrument Cluster Hood and Panel
    const clusterHood = new Mesh(new BoxGeometry(0.48, 0.16, 0.22), darkTrim);
    clusterHood.position.set(0.42, 0.98, 0.56);
    
    const clusterPanel = new Mesh(
      new PlaneGeometry(0.42, 0.11),
      new MeshBasicMaterial({ color: 0x07090c })
    );
    clusterPanel.position.set(0.42, 0.98, 0.68);
    clusterPanel.rotation.x = -0.1;
    
    // Speedometer and Tachometer dials
    const dialMaterial = new MeshBasicMaterial({ color: 0x091420 });
    const dialBorderMaterial = new MeshBasicMaterial({ color: 0x00e5ff });
    const needleMaterial = new MeshBasicMaterial({ color: 0xff3b30 });
    
    const dialGeo = new CircleGeometry(0.045, 24);
    const borderGeo = new RingGeometry(0.044, 0.046, 24);
    
    const speedDial = new Mesh(dialGeo, dialMaterial);
    speedDial.position.set(0.35, 0.98, 0.682);
    const speedBorder = new Mesh(borderGeo, dialBorderMaterial);
    speedBorder.position.copy(speedDial.position);
    
    this.speedNeedle = new Mesh(new PlaneGeometry(0.038, 0.004), needleMaterial);
    // Offset pivot center of the needle
    this.speedNeedle.geometry.translate(0.016, 0, 0);
    this.speedNeedle.position.copy(speedDial.position);
    this.speedNeedle.rotation.z = -1.2;
    
    const tachoDial = new Mesh(dialGeo, dialMaterial);
    tachoDial.position.set(0.49, 0.98, 0.682);
    const tachoBorder = new Mesh(borderGeo, dialBorderMaterial);
    tachoBorder.position.copy(tachoDial.position);
    
    this.tachoNeedle = new Mesh(new PlaneGeometry(0.038, 0.004), needleMaterial);
    this.tachoNeedle.geometry.translate(0.016, 0, 0);
    this.tachoNeedle.position.copy(tachoDial.position);
    this.tachoNeedle.rotation.z = -0.6;
    
    // Dashboard Green Blinking Indicators
    const arrowGeo = new RingGeometry(0.006, 0.015, 3, 1, Math.PI, Math.PI); // rough triangle/arrow
    const arrowMat = new MeshBasicMaterial({ color: 0x22c55e });
    this.leftArrow = new Mesh(arrowGeo, arrowMat);
    this.leftArrow.position.set(0.41, 1.01, 0.683);
    this.leftArrow.rotation.z = Math.PI / 2; // point left
    this.leftArrow.visible = false;

    this.rightArrow = new Mesh(arrowGeo, arrowMat);
    this.rightArrow.position.set(0.43, 1.01, 0.683);
    this.rightArrow.rotation.z = -Math.PI / 2; // point right
    this.rightArrow.visible = false;

    this.cockpitGroup.add(
      clusterHood, clusterPanel, 
      speedDial, speedBorder, this.speedNeedle, 
      tachoDial, tachoBorder, this.tachoNeedle,
      this.leftArrow, this.rightArrow
    );
 
    // 3. Tablet screens (GPS Navigation + Telemetry)
    const gpsFrame = new Mesh(new BoxGeometry(0.36, 0.22, 0.02), screenPlastic);
    gpsFrame.position.set(0.06, 0.85, 0.58);
    gpsFrame.rotation.y = -0.15;
    gpsFrame.rotation.x = -0.1;
    
    const gpsScreen = new Mesh(
      new PlaneGeometry(0.34, 0.20),
      new MeshBasicMaterial({ map: createGPSTexture() })
    );
    gpsScreen.position.set(0, 0, 0.011);
    gpsFrame.add(gpsScreen);
    
    const teleFrame = new Mesh(new BoxGeometry(0.30, 0.18, 0.02), screenPlastic);
    teleFrame.position.set(0.72, 0.88, 0.60);
    teleFrame.rotation.y = 0.2;
    teleFrame.rotation.x = -0.1;
    
    const teleScreen = new Mesh(
      new PlaneGeometry(0.28, 0.16),
      new MeshBasicMaterial({ map: createTelemetryTexture() })
    );
    teleScreen.position.set(0, 0, 0.011);
    teleFrame.add(teleScreen);
    
    this.cockpitGroup.add(gpsFrame, teleFrame);
 
    // 4. Steering Wheel Group (Rotatable spokes + torus rim)
    this.steeringWheel = new Group();
    this.steeringWheel.position.set(0.42, 0.86, 0.66);
    this.steeringWheel.rotation.x = -Math.PI * 0.1;
    
    const rim = new Mesh(new TorusGeometry(0.19, 0.016, 12, 48), wheelMaterial);
    const boss = new Mesh(new CylinderGeometry(0.045, 0.045, 0.02, 16), metallicMaterial);
    boss.rotation.x = Math.PI / 2;
    
    const spokeL = new Mesh(new BoxGeometry(0.14, 0.018, 0.01), wheelMaterial);
    spokeL.position.set(-0.08, 0, 0);
    
    const spokeR = new Mesh(new BoxGeometry(0.14, 0.018, 0.01), wheelMaterial);
    spokeR.position.set(0.08, 0, 0);
    
    const spokeD = new Mesh(new BoxGeometry(0.018, 0.14, 0.01), wheelMaterial);
    spokeD.position.set(0, -0.08, 0);
    
    this.steeringWheel.add(rim, boss, spokeL, spokeR, spokeD);
    this.cockpitGroup.add(this.steeringWheel);
    
    // Steering column and control stalks
    const steeringColumn = new Mesh(new BoxGeometry(0.07, 0.07, 0.22), wheelMaterial);
    steeringColumn.position.set(0.42, 0.8, 0.54);
    steeringColumn.rotation.x = -Math.PI * 0.16;
    
    const stalkMat = new MeshStandardMaterial({ color: 0x090a0c, roughness: 0.9 });
    const stalkL = new Mesh(new BoxGeometry(0.14, 0.01, 0.01), stalkMat);
    stalkL.position.set(0.32, 0.82, 0.56);
    stalkL.rotation.y = 0.2;
    const stalkR = new Mesh(new BoxGeometry(0.14, 0.01, 0.01), stalkMat);
    stalkR.position.set(0.52, 0.82, 0.56);
    stalkR.rotation.y = -0.2;

    this.cockpitGroup.add(steeringColumn, stalkL, stalkR);
    
    // 5. Gear Shifter and Handbrake Levers
    const shifterGroup = new Group();
    shifterGroup.position.set(-0.08, 0.35, 0.42);
    const bootGeo = new ConeGeometry(0.05, 0.12, 8);
    const boot = new Mesh(bootGeo, darkTrim);
    const lever = new Mesh(new CylinderGeometry(0.01, 0.01, 0.18, 8), chromeTrim);
    lever.position.y = 0.08;
    const shiftKnob = new Mesh(new SphereGeometry(0.026, 12, 12), wheelMaterial);
    shiftKnob.position.y = 0.17;
    shifterGroup.add(boot, lever, shiftKnob);
    this.cockpitGroup.add(shifterGroup);

    // 6. Interactive Pedals (3D accelerator and brake)
    const pedalArmMat = new MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const pedalFaceMat = new MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 });

    this.pedalThrottle = new Group();
    this.pedalThrottle.position.set(0.46, 0.32, 0.52);
    const armT = new Mesh(new BoxGeometry(0.015, 0.18, 0.015), pedalArmMat);
    armT.geometry.translate(0, 0.09, 0);
    const faceT = new Mesh(new BoxGeometry(0.04, 0.10, 0.01), pedalFaceMat);
    faceT.position.set(0, 0.18, 0.01);
    this.pedalThrottle.add(armT, faceT);
    this.pedalThrottle.rotation.x = -Math.PI / 8;

    this.pedalBrake = new Group();
    this.pedalBrake.position.set(0.38, 0.32, 0.52);
    const armB = new Mesh(new BoxGeometry(0.02, 0.18, 0.02), pedalArmMat);
    armB.geometry.translate(0, 0.09, 0);
    const faceB = new Mesh(new BoxGeometry(0.06, 0.08, 0.01), pedalFaceMat);
    faceB.position.set(0, 0.18, 0.01);
    this.pedalBrake.add(armB, faceB);
    this.pedalBrake.rotation.x = -Math.PI / 8;

    this.cockpitGroup.add(this.pedalThrottle, this.pedalBrake);

    // 7. Windshield Wipers
    const wiperMat = new MeshStandardMaterial({ color: 0x050505, roughness: 0.95 });
    
    this.wiperL = new Mesh(new BoxGeometry(0.38, 0.012, 0.008), wiperMat);
    this.wiperL.geometry.translate(0.19, 0, 0);
    this.wiperL.position.set(0.45, 1.15, 0.87);
    this.wiperL.rotation.y = -0.05;
    
    this.wiperR = new Mesh(new BoxGeometry(0.38, 0.012, 0.008), wiperMat);
    this.wiperR.geometry.translate(0.19, 0, 0);
    this.wiperR.position.set(-0.15, 1.15, 0.87);
    this.wiperR.rotation.y = -0.05;

    this.cockpitGroup.add(this.wiperL, this.wiperR);

    // 8. Seating (Driver & Passenger Contoured Seats)
    const createSeat = (x: number): Group => {
      const seat = new Group();
      const baseS = new Mesh(new BoxGeometry(0.52, 0.22, 0.52), leatherSeatMat);
      baseS.position.y = 0.25;
      baseS.castShadow = true;
      const backS = new Mesh(new BoxGeometry(0.48, 0.65, 0.18), leatherSeatMat);
      backS.position.set(0, 0.62, -0.22);
      backS.rotation.x = -0.15;
      backS.castShadow = true;
      const headS = new Mesh(new BoxGeometry(0.24, 0.18, 0.14), leatherSeatMat);
      headS.position.set(0, 0.98, -0.28);
      headS.castShadow = true;
      seat.add(baseS, backS, headS);
      seat.position.set(x, 0.1, -0.25);
      return seat;
    };

    const driverSeat = createSeat(0.38);
    const passengerSeat = createSeat(-0.38);
    this.cockpitGroup.add(driverSeat, passengerSeat);

    // Windscreen base trim
    const windscreenBase = new Mesh(new BoxGeometry(1.8, 0.04, 0.08), darkTrim);
    windscreenBase.position.set(0, 1.16, 0.86);
    this.cockpitGroup.add(windscreenBase);

    // 9. Premium Windshield Glass & Frit Border
    const windshieldGroup = new Group();
    windshieldGroup.name = 'PremiumWindshield';
    
    const glassGeo = new PlaneGeometry(1.72, 0.72);
    const glassMat = new MeshStandardMaterial({
      color: 0x80deea,
      transparent: true,
      opacity: 0.08,
      roughness: 0.05,
      metalness: 0.95,
      side: DoubleSide,
    });
    const glassMesh = new Mesh(glassGeo, glassMat);
    glassMesh.position.set(0, 1.52, 0.86);
    
    const fritMat = new MeshStandardMaterial({
      color: 0x0c0f12,
      roughness: 0.9,
    });
    
    const fritL = new Mesh(new PlaneGeometry(0.05, 0.72), fritMat);
    fritL.position.set(-0.835, 0, 0.001);
    
    const fritR = new Mesh(new PlaneGeometry(0.05, 0.72), fritMat);
    fritR.position.set(0.835, 0, 0.001);
    
    const fritT = new Mesh(new PlaneGeometry(1.72, 0.05), fritMat);
    fritT.position.set(0, 0.335, 0.001);
    
    const fritB = new Mesh(new PlaneGeometry(1.72, 0.04), fritMat);
    fritB.position.set(0, -0.34, 0.001);
    
    glassMesh.add(fritL, fritR, fritT, fritB);
    windshieldGroup.add(glassMesh);
    this.cockpitGroup.add(windshieldGroup);
  }

  private createMirrors(textureSize: number): Record<MirrorId, CockpitMirror> {
    return {
      center: this.createMirror('center', textureSize, {
        meshPosition: new Vector3(0, 1.54, 0.58),
        meshScale: new Vector3(0.46, 0.14, 1),
        cameraPosition: new Vector3(0, 1.45, 0.24),
        rearDirection: localBackward,
      }),
      left: this.createMirror('left', textureSize, {
        meshPosition: new Vector3(-1.12, 1.18, 0.55),
        meshScale: new Vector3(0.28, 0.18, 1),
        cameraPosition: new Vector3(-1.08, 1.15, 0.45),
        rearDirection: localLeftRear,
        meshRotationY: Math.PI + 0.35,
      }),
      right: this.createMirror('right', textureSize, {
        meshPosition: new Vector3(1.12, 1.18, 0.55),
        meshScale: new Vector3(0.28, 0.18, 1),
        cameraPosition: new Vector3(1.08, 1.15, 0.45),
        rearDirection: localRightRear,
        meshRotationY: Math.PI - 0.35,
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
      readonly meshRotationY?: number;
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
    mesh.rotation.y = config.meshRotationY ?? Math.PI; // Face the camera at negative Z

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
