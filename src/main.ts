import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';

import type { DrivingContext, IndicatorState } from './rules/RuleEngine';
import type { Lane } from './road/RoadTypes';
import { LevelManager } from './training/LevelManager';
import { CockpitView } from './vehicle/CockpitView';
import { createDigitalCarInput, type Gear, type Indicator, PlayerCar } from './vehicle/PlayerCar';
import { VehiclePhysics } from './vehicle/VehiclePhysics';

type KeyState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App mount node was not found.');
}

app.textContent = '';
app.style.position = 'fixed';
app.style.inset = '0';
app.style.overflow = 'hidden';
app.style.background = '#6e8f6b';

const keys: KeyState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
};

let indicator: Indicator = 'off';
let gear: Gear = 'D';
const smokeMode = new URLSearchParams(window.location.search).get('smoke');

const scene = new Scene();
scene.background = new Color(0x9fc7df);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.touchAction = 'none';
app.append(renderer.domElement);

const levelLane: Lane = {
  id: 'residential-left-lane',
  fromNodeId: 'route-start',
  toNodeId: 'route-finish',
  centerLine: [
    { x: -1.75, y: 0, z: -40 },
    { x: -1.75, y: 0, z: 42 },
  ],
  widthMeters: 3.5,
  direction: 'forward',
  speedLimitMph: 20,
  allowedTurns: [],
  oppositeLaneId: 'residential-oncoming-lane',
  tags: ['residential'],
};

const zebraZone = {
  id: 'L5_zebra_prep',
  label: 'zebra',
  bounds: { minX: -4.2, maxX: 4.2, minZ: 8.5, maxZ: 11.5 },
};

function addLights(): void {
  const ambientLight = new AmbientLight(0xffffff, 0.58);
  scene.add(ambientLight);

  const sunLight = new DirectionalLight(0xffffff, 2.2);
  sunLight.position.set(8, 14, 5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 70;
  sunLight.shadow.camera.left = -28;
  sunLight.shadow.camera.right = 28;
  sunLight.shadow.camera.top = 45;
  sunLight.shadow.camera.bottom = -20;
  scene.add(sunLight);
}

function addTrainingRoute(): void {
  const grass = new Mesh(
    new PlaneGeometry(90, 110),
    new MeshStandardMaterial({ color: 0x58745a, roughness: 0.95 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  const road = new Mesh(
    new PlaneGeometry(7.2, 86),
    new MeshStandardMaterial({ color: 0x30363a, roughness: 0.9 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.012;
  road.receiveShadow = true;
  scene.add(road);

  const kerbMaterial = new MeshStandardMaterial({ color: 0xc7c4b8, roughness: 0.8 });
  for (const x of [-3.75, 3.75]) {
    const kerb = new Mesh(new BoxGeometry(0.18, 0.12, 86), kerbMaterial);
    kerb.position.set(x, 0.07, 0);
    kerb.receiveShadow = true;
    scene.add(kerb);
  }

  const lineMaterial = new MeshStandardMaterial({ color: 0xf2f0db, roughness: 0.7 });
  for (let z = -37; z <= 37; z += 8) {
    const centerDash = new Mesh(new BoxGeometry(0.12, 0.018, 3.2), lineMaterial);
    centerDash.position.set(0, 0.035, z);
    scene.add(centerDash);
  }

  const startBox = createRoadMarking(0xeff4f0, 2.9, 0.12, -34);
  scene.add(startBox);

  const finishBox = createRoadMarking(0xaee7bb, 2.9, 0.12, 35);
  scene.add(finishBox);

  for (const z of [8.7, 9.35, 10, 10.65, 11.3]) {
    const stripe = createRoadMarking(0xf7f7ef, 6.6, 0.26, z);
    scene.add(stripe);
  }

  const pavementMaterial = new MeshStandardMaterial({ color: 0x9ba39b, roughness: 0.86 });
  for (const x of [-6.6, 6.6]) {
    const pavement = new Mesh(new PlaneGeometry(4.4, 86), pavementMaterial);
    pavement.rotation.x = -Math.PI / 2;
    pavement.position.set(x, 0.018, 0);
    pavement.receiveShadow = true;
    scene.add(pavement);
  }

  const pedestrian = new Mesh(
    new BoxGeometry(0.42, 1.55, 0.42),
    new MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.65 }),
  );
  pedestrian.position.set(-4.5, 0.78, 9.7);
  pedestrian.castShadow = true;
  scene.add(pedestrian);

  const sign = new Group();
  const post = new Mesh(
    new BoxGeometry(0.08, 1.6, 0.08),
    new MeshStandardMaterial({ color: 0xb8bdc2, roughness: 0.55 }),
  );
  post.position.y = 0.8;
  const plate = new Mesh(
    new BoxGeometry(0.9, 0.55, 0.06),
    new MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.48 }),
  );
  plate.position.y = 1.72;
  sign.add(post, plate);
  sign.position.set(-4.25, 0, -20);
  scene.add(sign);
}

function createRoadMarking(color: number, width: number, depth: number, z: number): Mesh {
  const marking = new Mesh(
    new BoxGeometry(width, 0.018, depth),
    new MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  marking.position.set(-1.75, 0.038, z);
  return marking;
}

function createCarMesh(): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(1.8, 0.9, 3.8),
    new MeshStandardMaterial({ color: 0xc93d2b, roughness: 0.62 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function updateKey(event: KeyboardEvent, pressed: boolean): void {
  const key = event.key.toLowerCase();
  if (key === 'w') keys.forward = pressed;
  else if (key === 's') keys.backward = pressed;
  else if (key === 'a') keys.left = pressed;
  else if (key === 'd') keys.right = pressed;
  else if (event.code === 'Space') keys.handbrake = pressed;
  else if (pressed && key === 'r') gear = gear === 'R' ? 'D' : 'R';
  else if (pressed && key === 'q') indicator = indicator === 'left' ? 'off' : 'left';
  else if (pressed && key === 'e') indicator = indicator === 'right' ? 'off' : 'right';
  else return;

  event.preventDefault();
}

function toRuleGear(playerGear: Gear): DrivingContext['gear'] {
  if (keys.handbrake) return 'park';
  if (playerGear === 'R') return 'reverse';
  if (playerGear === 'N') return 'neutral';
  if (playerGear === 'P') return 'park';
  return 'drive';
}

function toIndicatorState(playerIndicator: Indicator): IndicatorState {
  return playerIndicator;
}

function createContext(
  timeSeconds: number,
  deltaSeconds: number,
  car: PlayerCar,
  cockpit: CockpitView,
): DrivingContext {
  const state = car.getState();
  const activeTriggerZones =
    state.position.z > 4 && state.position.z < 12.5 ? [zebraZone] : undefined;
  const activeConflictZones =
    state.position.z > 8.5 && state.position.z < 11.5
      ? [{ ...zebraZone, entryLaneIds: [levelLane.id], exitLaneIds: [levelLane.id], priorityRuleIds: ['pedestrian-priority'] as readonly string[] }]
      : undefined;
  const pedestrianState: 'idle' | 'waiting' | 'crossing' | 'exited' =
    state.position.z > 3 && state.position.z < 14
      ? 'waiting'
      : state.position.z >= 14
        ? 'exited'
        : 'idle';

  return {
    timeSeconds,
    deltaSeconds,
    vehiclePose: {
      position: state.position,
      yawDegrees: state.yawDegrees,
    },
    speedMph: state.speedMph,
    gear: toRuleGear(state.gear),
    indicator: toIndicatorState(state.indicator),
    currentLane: levelLane,
    nearbyLanes: [levelLane],
    activeTriggerZones,
    activeConflictZones,
    activeRoadSigns: [{ id: 'speed-20', type: 'speed-limit' as const, facingYawDegrees: 0, appliesToLaneIds: [levelLane.id], label: 'residential', position: { x: -4.25, y: 0, z: -20 }, speedLimitMph: 20 }],
    currentZone: { id: 'residential-demo-zone', speedLimitMph: 20 },
    observation: cockpit.getObservationState(),
    levelId: 'level-1',
    pedestrians: [
      {
        id: 'ped-zebra-1',
        state: pedestrianState,
        crossingId: 'zebra-demo',
        position: { x: -4.5, y: 0, z: 9.7 },
        boundingRadius: 0.45,
      },
    ],
  };
}

async function start(): Promise<void> {
  addLights();
  addTrainingRoute();

  const physics = await VehiclePhysics.init();
  physics.addGround({ halfExtents: { x: 45, y: 0.1, z: 55 }, friction: 1.15 });

  const car = new PlayerCar(physics, {
    initialPosition: { x: -1.75, y: 0.7, z: -34 },
    initialYawRadians: 0,
    maxSpeedMph: 45,
  });
  const carMesh = createCarMesh();
  scene.add(carMesh);

  const cockpit = new CockpitView({ mirrorTextureSize: 256 });
  scene.add(cockpit.object3D);

  const levelManager = new LevelManager(app!, {
    onRetry: () => window.location.reload(),
    onNextLevel: () => window.location.reload(),
    onMainMenu: () => window.location.reload(),
  });
  levelManager.startLevel('level-1', 0);

  let elapsedSeconds = 0;
  let lastFrameSeconds = performance.now() / 1000;
  let completed = false;
  let smokeResultShown = false;

  if (smokeMode === 'results') {
    window.setTimeout(() => {
      if (!smokeResultShown) {
        smokeResultShown = true;
        completed = true;
        levelManager.completeLevel(Math.max(elapsedSeconds, 1.2));
      }
    }, 1_200);
  }

  window.addEventListener('keydown', (event) => updateKey(event, true));
  window.addEventListener('keyup', (event) => updateKey(event, false));

  const resize = (): void => {
    const width = app!.clientWidth || window.innerWidth;
    const height = app!.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    cockpit.resize(width, height);
  };

  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    const nowSeconds = performance.now() / 1000;
    const deltaSeconds = Math.min(0.05, nowSeconds - lastFrameSeconds);
    lastFrameSeconds = nowSeconds;
    elapsedSeconds += deltaSeconds;

    const inputGear = keys.handbrake ? 'P' : gear;
    const state = car.update(
      createDigitalCarInput({
        forward: keys.forward,
        backward: keys.backward || keys.handbrake,
        left: keys.left,
        right: keys.right,
        gear: inputGear,
        indicator,
      }),
      deltaSeconds,
    );

    carMesh.position.set(state.position.x, state.position.y, state.position.z);
    carMesh.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    cockpit.updateFromVehiclePose({
      position: state.position,
      yawDegrees: state.yawDegrees,
    });

    levelManager.update(createContext(elapsedSeconds, deltaSeconds, car, cockpit));

    if (!smokeResultShown && smokeMode === 'results' && elapsedSeconds > 1.2) {
      smokeResultShown = true;
      completed = true;
      levelManager.completeLevel(elapsedSeconds);
    }

    if (!completed && state.position.z > 34 && state.speedMph < 3) {
      completed = true;
      levelManager.completeLevel(elapsedSeconds);
    }

    cockpit.renderMirrors(scene, renderer);
    renderer.render(scene, cockpit.activeCamera);
  });
}

start().catch((error) => {
  app.textContent = 'Failed to start UK Driving Trainer. Please check the console.';
  console.error(error);
});
