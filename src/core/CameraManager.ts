import {
  PerspectiveCamera,
  Spherical,
  Vector2,
  Vector3,
  type Camera,
} from 'three';

type DebugCameraOptions = {
  distance?: number;
  target?: Vector3;
};

const MIN_ELEVATION = 0.18;
const MAX_ELEVATION = Math.PI * 0.46;
const ROTATION_SPEED = 0.006;

export class CameraManager {
  private readonly camera: PerspectiveCamera;
  private readonly target = new Vector3();
  private readonly spherical = new Spherical();
  private readonly pointer = new Vector2();
  private isDragging = false;

  constructor(private readonly inputElement: HTMLElement, options: DebugCameraOptions = {}) {
    this.camera = new PerspectiveCamera(60, 1, 0.1, 500);
    this.target.copy(options.target ?? new Vector3(0, 0.8, 0));
    this.spherical.set(options.distance ?? 11, Math.PI * 0.34, Math.PI * 0.24);
    this.updateCameraTransform();
    this.bindDebugInput();
  }

  get activeCamera(): Camera {
    return this.camera;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.updateCameraTransform();
  }

  rotate(deltaAzimuth: number, deltaElevation: number): void {
    this.spherical.theta += deltaAzimuth;
    this.spherical.phi = Math.min(
      MAX_ELEVATION,
      Math.max(MIN_ELEVATION, this.spherical.phi + deltaElevation),
    );
    this.updateCameraTransform();
  }

  dispose(): void {
    this.inputElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private bindDebugInput(): void {
    this.inputElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private updateCameraTransform(): void {
    this.camera.position.setFromSpherical(this.spherical).add(this.target);
    this.camera.lookAt(this.target);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.isDragging = true;
    this.pointer.set(event.clientX, event.clientY);
    this.inputElement.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDragging) {
      return;
    }

    const deltaX = event.clientX - this.pointer.x;
    const deltaY = event.clientY - this.pointer.y;
    this.pointer.set(event.clientX, event.clientY);
    this.rotate(-deltaX * ROTATION_SPEED, deltaY * ROTATION_SPEED);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.isDragging = false;

    if (this.inputElement.hasPointerCapture(event.pointerId)) {
      this.inputElement.releasePointerCapture(event.pointerId);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowLeft':
        this.rotate(0.08, 0);
        break;
      case 'ArrowRight':
        this.rotate(-0.08, 0);
        break;
      case 'ArrowUp':
        this.rotate(0, -0.06);
        break;
      case 'ArrowDown':
        this.rotate(0, 0.06);
        break;
      default:
        return;
    }

    event.preventDefault();
  };
}
