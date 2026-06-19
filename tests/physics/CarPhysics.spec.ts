import { describe, expect, it } from 'vitest';
import { VehiclePhysics, loadRapier } from '../../src/vehicle/VehiclePhysics';
import { PlayerCar } from '../../src/vehicle/PlayerCar';

describe('PlayerCar Physics Simulation Tests', () => {
  it('should displace the vehicle forward and increase speed when throttle is applied', async () => {
    // 1. Initialize physics world
    const physics = await VehiclePhysics.init();
    physics.addGround({ friction: 0.35 });

    // 2. Instantiate PlayerCar at (0, 0.7, 0) facing forward (yaw = 0)
    const car = new PlayerCar(physics, {
      initialPosition: { x: 0, y: 0.7, z: 0 },
      initialYawRadians: 0,
    });

    const initialState = car.getState();
    expect(initialState.position.z).toBeCloseTo(0);
    expect(initialState.speedMph).toBeCloseTo(0);

    // 3. Simulate throttle application (W key equivalent) for 2 seconds
    const dt = 1 / 60; // 60 FPS
    const totalSteps = 2 * 60; // 2 seconds

    for (let i = 0; i < totalSteps; i++) {
      car.update({ throttle: 1, gear: 'D' }, dt);
    }

    const finalState = car.getState();

    // 4. Assert vehicle displacement and speed are positive and reasonable
    expect(finalState.position.z).toBeGreaterThan(0.5); // Has moved forward
    expect(finalState.speedMph).toBeGreaterThan(5); // Speed is positive
    expect(finalState.signedSpeedMph).toBeGreaterThan(5);
  });

  it('should prevent tunneling and decelerate the car when crashing into a static wall at 100 mph', async () => {
    // 1. Initialize physics world
    const physics = await VehiclePhysics.init();
    physics.addGround({ friction: 0.35 });

    // 2. Instantiate PlayerCar at (0, 0.7, 0)
    const car = new PlayerCar(physics, {
      initialPosition: { x: 0, y: 0.7, z: 0 },
      initialYawRadians: 0,
    });

    // 3. Create a static wall perpendicular to the Z axis at z = 20
    const RAPIER = await loadRapier();
    const world = physics.getWorld();
    const wallBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.7, 20);
    const wallBody = world.createRigidBody(wallBodyDesc);
    // Wall collider: half extents 10 (width), 5 (height), 1 (thickness in Z)
    // This makes the wall span from z = 19 to z = 21.
    const wallColliderDesc = RAPIER.ColliderDesc.cuboid(10, 5, 1);
    world.createCollider(wallColliderDesc, wallBody);

    // 4. Set the car velocity to ~100 mph (44.7 m/s) directly towards the wall (+Z direction)
    const carBody = car.getRigidBody();
    carBody.setLinvel({ x: 0, y: 0, z: 44.7 }, true);

    // 5. Simulate for 2 seconds to allow crash to occur
    const dt = 1 / 60;
    const steps = 2 * 60;

    let maxZ = 0;
    for (let i = 0; i < steps; i++) {
      const state = car.update({ throttle: 0, gear: 'D' }, dt);
      if (state.position.z > maxZ) {
        maxZ = state.position.z;
      }
    }

    const endState = car.getState();

    // 6. Assertions
    // Car half-length is 1.9, wall starts at z = 19.
    // If the car does not tunnel/pass through the wall, its center Z must never exceed 19.5 (allowing slight penetration during collision).
    expect(maxZ).toBeLessThan(19.5);
    // The final speed should be close to 0 or negative (bouncing back)
    expect(endState.speedMph).toBeLessThan(5);
  });
  it('should yaw and displace right when steering right while moving forward', async () => {
    const physics = await VehiclePhysics.init();
    physics.addGround({ friction: 0.35 });

    const car = new PlayerCar(physics, {
      initialPosition: { x: 0, y: 0.7, z: 0 },
      initialYawRadians: 0,
    });

    const dt = 1 / 60;
    for (let i = 0; i < 3 * 60; i++) {
      car.update({ throttle: 0.8, steering: 1, gear: 'D' }, dt);
    }

    const finalState = car.getState();
    expect(finalState.yawDegrees).toBeGreaterThan(5);
    expect(finalState.position.x).toBeGreaterThan(0.15);
  });
});
