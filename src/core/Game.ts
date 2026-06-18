import {
  Clock,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

export interface GameOptions {
  readonly container: HTMLElement;
  readonly renderer?: WebGLRenderer;
  readonly scene?: Scene;
  readonly camera?: PerspectiveCamera;
  readonly fixedTimeStepSeconds?: number;
}

export interface GameUpdateContext {
  readonly deltaSeconds: number;
  readonly elapsedSeconds: number;
  readonly fixedTimeStepSeconds: number;
}

export abstract class Game {
  protected readonly container: HTMLElement;
  protected readonly scene: Scene;
  protected readonly camera: PerspectiveCamera;
  protected readonly renderer: WebGLRenderer;
  protected readonly fixedTimeStepSeconds: number;

  private readonly clock = new Clock();
  private animationFrameId: number | null = null;
  private elapsedSeconds = 0;
  private initialized = false;

  protected constructor(options: GameOptions) {
    this.container = options.container;
    this.scene = options.scene ?? new Scene();
    this.camera =
      options.camera ??
      new PerspectiveCamera(60, this.aspectRatio, 0.1, 1_000);
    this.renderer = options.renderer ?? new WebGLRenderer({ antialias: true });
    this.fixedTimeStepSeconds = options.fixedTimeStepSeconds ?? 1 / 60;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadAssets();
    await this.createPhysicsWorld();
    this.attachRenderer();
    this.onInit();
    this.initialized = true;
  }

  start(): void {
    if (!this.initialized) {
      throw new Error('Game must be initialized before start().');
    }

    if (this.animationFrameId !== null) {
      return;
    }

    this.clock.start();
    this.animationFrameId = window.requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.animationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.clock.stop();
  }

  resize(width = this.container.clientWidth, height = this.container.clientHeight): void {
    const nextHeight = Math.max(1, height);
    this.camera.aspect = Math.max(1, width) / nextHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, nextHeight);
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
  }

  protected async loadAssets(): Promise<void> {
    await Promise.resolve();
  }

  protected async createPhysicsWorld(): Promise<void> {
    await Promise.resolve();
  }

  protected onInit(): void {
    this.resize();
  }

  protected abstract update(context: GameUpdateContext): void;

  protected render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private readonly tick = (): void => {
    const deltaSeconds = this.clock.getDelta();
    this.elapsedSeconds += deltaSeconds;

    this.update({
      deltaSeconds,
      elapsedSeconds: this.elapsedSeconds,
      fixedTimeStepSeconds: this.fixedTimeStepSeconds,
    });
    this.render();

    this.animationFrameId = window.requestAnimationFrame(this.tick);
  };

  private attachRenderer(): void {
    if (!this.renderer.domElement.parentElement) {
      this.container.appendChild(this.renderer.domElement);
    }
  }

  private get aspectRatio(): number {
    const height = Math.max(1, this.container.clientHeight);
    return Math.max(1, this.container.clientWidth) / height;
  }
}
