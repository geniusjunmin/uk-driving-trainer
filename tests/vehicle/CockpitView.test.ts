import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CockpitView } from '../../src/vehicle/CockpitView';

describe('CockpitView observation mapping', () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeAll(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      lineJoin: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('maps negative yaw to the left mirror and positive yaw to the right mirror', () => {
    const cockpit = new CockpitView({ mirrorTextureSize: 32 });

    expect(cockpit.setLookOffset(-30, 0).observedMirror).toBe('left');
    expect(cockpit.setLookOffset(30, 0).observedMirror).toBe('right');

    cockpit.dispose();
  });

  it('maps negative yaw to the left blind spot and positive yaw to the right blind spot', () => {
    const cockpit = new CockpitView({ mirrorTextureSize: 32 });

    expect(cockpit.setLookOffset(-82, 0).observedBlindSpot).toBe('left');
    expect(cockpit.setLookOffset(82, 0).observedBlindSpot).toBe('right');

    cockpit.dispose();
  });

  it('keeps the visible cockpit laid out as a UK right-hand-drive view', () => {
    const cockpit = new CockpitView({ mirrorTextureSize: 32 });
    const steeringWheel = cockpit.object3D.getObjectByName('SteeringWheel_RightHandDrive_VisualRight');
    const leftMirror = cockpit.getMirror('left').mesh;
    const rightMirror = cockpit.getMirror('right').mesh;

    expect(steeringWheel?.position.x).toBeLessThan(0);
    expect(leftMirror.position.x).toBeGreaterThan(0);
    expect(rightMirror.position.x).toBeLessThan(0);
    expect(leftMirror.renderOrder).toBeGreaterThan(0);
    expect(rightMirror.renderOrder).toBeGreaterThan(0);
    expect(leftMirror.material.depthTest).toBe(false);
    expect(rightMirror.material.depthTest).toBe(false);

    cockpit.dispose();
  });
});
