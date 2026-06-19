import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

import type { DrivingContext, IndicatorState } from './rules/RuleEngine';
import type { Lane } from './road/RoadTypes';
import { LevelManager } from './training/LevelManager';
import { CockpitView } from './vehicle/CockpitView';
import { createDigitalCarInput, type Gear, type Indicator, PlayerCar } from './vehicle/PlayerCar';
import { VehiclePhysics } from './vehicle/VehiclePhysics';
import { PedestrianAIManager } from './traffic/PedestrianAI';

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
let pedestrianManager: PedestrianAIManager;
let pedestrianMesh: Group;
const smokeMode = new URLSearchParams(window.location.search).get('smoke');

const scene = new Scene();
scene.background = new Color(0x9fc7df);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = SRGBColorSpace;
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
  // Hemisphere light representing sky (sky color, ground color, intensity)
  const hemiLight = new HemisphereLight(0xa6cbe6, 0x5d7350, 0.78);
  scene.add(hemiLight);

  const ambientLight = new AmbientLight(0xffffff, 0.16);
  scene.add(ambientLight);

  const sunLight = new DirectionalLight(0xfffaed, 2.0);
  sunLight.position.set(22, 38, 12);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 140;
  sunLight.shadow.camera.left = -45;
  sunLight.shadow.camera.right = 45;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -40;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);
}

function createSkyTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Sky vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#2e5077'); // Deep sky blue top
  grad.addColorStop(0.4, '#49709c'); // Medium blue
  grad.addColorStop(0.72, '#94b3d1'); // Light blue-cyan
  grad.addColorStop(0.88, '#d5e6f0'); // Horizon white-blue
  grad.addColorStop(1.0, '#ffd3a8'); // Sunrise peach horizon
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  
  // Draw organic cumulus clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  for (let i = 0; i < 9; i++) {
    const cx = Math.random() * 512;
    const cy = 60 + Math.random() * 160;
    const cr = 45 + Math.random() * 50;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.arc(cx - cr * 0.5, cy + 10, cr * 0.7, 0, Math.PI * 2);
    ctx.arc(cx + cr * 0.5, cy + 10, cr * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const texture = new CanvasTexture(canvas);
  return texture;
}

function addSkyDome(): void {
  const skyGeo = new SphereGeometry(450, 32, 15);
  const skyMat = new MeshBasicMaterial({
    map: createSkyTexture(),
    side: BackSide,
    fog: false
  });
  const skyDome = new Mesh(skyGeo, skyMat);
  scene.add(skyDome);
  
  scene.background = new Color(0xd5e6f0);
}

function createNoiseBumpTexture(width: number, height: number, density: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);
  
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * density * 255;
    const val = Math.min(255, Math.max(0, 128 + noise));
    data[i] = val;
    data[i+1] = val;
    data[i+2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
  
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function createGrassTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4c6e4f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 20000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const size = Math.random() * 2 + 1;
    const colorVal = Math.floor(Math.random() * 40) - 20;
    ctx.fillStyle = `rgb(${76 + colorVal}, ${110 + colorVal}, ${79 + colorVal})`;
    ctx.fillRect(x, y, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(20, 20);
  return texture;
}

function createAsphaltTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#22252a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = Math.random() * 1.5 + 0.5;
    const opacity = Math.random() * 0.15;
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.fillRect(x, y, size, size);
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.moveTo(128, 0); ctx.lineTo(128, 512);
  ctx.moveTo(384, 0); ctx.lineTo(384, 512);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 10);
  return texture;
}

function createPavementTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#555960'; // Joint grout
  ctx.fillRect(0, 0, 128, 256);
  
  ctx.fillStyle = '#828790'; // Concrete block base
  const w = 64;
  const h = 64;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.fillRect(x * w + 1, y * h + 1, w - 2, h - 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.08})`;
      ctx.fillRect(x * w + 2, y * h + 2, w - 4, h - 4);
      ctx.fillStyle = '#828790';
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 20);
  return texture;
}

function createKerbTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#444850';
  ctx.fillRect(0, 0, 32, 128);
  
  ctx.fillStyle = '#a0a5b0';
  ctx.fillRect(0, 1, 32, 126);
  
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 40);
  return texture;
}

function createTree(x: number, z: number): Group {
  const tree = new Group();
  
  // Trunk cylinder
  const trunkGeo = new CylinderGeometry(0.12, 0.22, 2.2, 8);
  const trunkCanvas = document.createElement('canvas');
  trunkCanvas.width = 64; trunkCanvas.height = 128;
  const tCtx = trunkCanvas.getContext('2d')!;
  tCtx.fillStyle = '#4a3319'; tCtx.fillRect(0, 0, 64, 128);
  // bark vertical lines
  tCtx.fillStyle = '#2d1f0f';
  for (let i = 0; i < 12; i++) {
    tCtx.fillRect(Math.random() * 64, 0, Math.random() * 4 + 1, 128);
  }
  const trunkTex = new CanvasTexture(trunkCanvas);
  const trunkMat = new MeshStandardMaterial({
    map: trunkTex,
    bumpMap: trunkTex,
    bumpScale: 0.04,
    roughness: 0.9,
  });
  const trunk = new Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  // Volumetric Foliage (layered spheres of varying shades of green, slightly shiny/waxy)
  const colors = [0x274e13, 0x38761d, 0x5b8f3a, 0x274e13, 0x6aa84f];
  const sphereGeo = new SphereGeometry(0.85, 12, 12);
  const offsets = [
    { x: 0, y: 2.1, z: 0, s: 1.25, c: 0 },
    { x: -0.5, y: 2.5, z: 0.4, s: 1.0, c: 1 },
    { x: 0.5, y: 2.6, z: -0.4, s: 0.95, c: 2 },
    { x: 0.3, y: 3.1, z: 0.3, s: 0.85, c: 3 },
    { x: -0.4, y: 3.0, z: -0.3, s: 0.9, c: 4 },
  ];
  
  for (const off of offsets) {
    const folMat = new MeshStandardMaterial({
      color: colors[off.c],
      roughness: 0.75,
      metalness: 0.05,
    });
    const clump = new Mesh(sphereGeo, folMat);
    clump.position.set(off.x, off.y, off.z);
    clump.scale.set(off.s, off.s * 1.1, off.s);
    clump.castShadow = true;
    clump.receiveShadow = true;
    tree.add(clump);
  }
  
  tree.position.set(x, 0, z);
  return tree;
}

function createBrickTexture(colorHex: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b0b5be'; // Mortar joints
  ctx.fillRect(0, 0, 128, 128);
  
  ctx.fillStyle = colorHex;
  const rows = 16;
  const cols = 8;
  const h = 128 / rows;
  const w = 128 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2 === 0) ? 0 : w / 2;
    for (let c = -1; c <= cols; c++) {
      ctx.fillRect(c * w + offset + 1, r * h + 1, w - 2, h - 2);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function createRoofTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#22252a';
  ctx.fillRect(0, 0, 128, 128);
  
  ctx.fillStyle = '#484d54';
  const rows = 12;
  const cols = 6;
  const h = 128 / rows;
  const w = 128 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2 === 0) ? 0 : w / 2;
    for (let c = -1; c <= cols; c++) {
      ctx.fillRect(c * w + offset + 0.5, r * h + 0.5, w - 1, h - 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function createHouse(x: number, z: number, rotationY = 0): Group {
  const house = new Group();
  
  // Walls
  const brickColors = ['#b85c38', '#994d2f', '#a85b37', '#b5613c'];
  const randColor = brickColors[Math.floor(Math.random() * brickColors.length)];
  const wallsMat = new MeshStandardMaterial({
    map: createBrickTexture(randColor),
    bumpMap: createBrickTexture(randColor),
    bumpScale: 0.02,
    roughness: 0.85,
  });
  wallsMat.map!.repeat.set(3, 2);
  wallsMat.bumpMap!.repeat.set(3, 2);
  const walls = new Mesh(new BoxGeometry(6, 4.5, 5), wallsMat);
  walls.position.y = 2.25;
  walls.castShadow = true;
  walls.receiveShadow = true;
  house.add(walls);

  // Roof
  const roofTex = createRoofTexture();
  roofTex.repeat.set(4, 4);
  const roofMat = new MeshStandardMaterial({
    map: roofTex,
    bumpMap: roofTex,
    bumpScale: 0.015,
    roughness: 0.75,
  });
  const roof = new Mesh(new ConeGeometry(4.2, 2.2, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 5.6, 0);
  roof.scale.set(1.4, 1.0, 1.4);
  roof.castShadow = true;
  house.add(roof);

  // Chimney
  const chimneyMat = new MeshStandardMaterial({
    map: createBrickTexture('#7a3d24'),
    roughness: 0.9
  });
  const chimney = new Mesh(new BoxGeometry(0.5, 1.5, 0.5), chimneyMat);
  chimney.position.set(1.5, 5.8, 0.8);
  chimney.castShadow = true;
  house.add(chimney);

  // Chimney Smoke Puffs (transparent gray/white spheres)
  const smokeGroup = new Group();
  const smokeMat = new MeshStandardMaterial({
    color: 0xeeeeee,
    transparent: true,
    opacity: 0.45,
    roughness: 0.95
  });
  const smokeGeo = new SphereGeometry(0.3, 8, 8);
  for (let i = 0; i < 3; i++) {
    const puff = new Mesh(smokeGeo, smokeMat);
    puff.position.set(1.5 + (i * 0.15), 6.7 + (i * 0.4), 0.8 + (Math.random() - 0.5) * 0.2);
    puff.scale.set(1 + i * 0.3, 0.8 + i * 0.2, 1 + i * 0.3);
    smokeGroup.add(puff);
  }
  house.add(smokeGroup);

  // Windows & Frames (white frames with shiny blue-sky reflective glass)
  const frameMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const glassMat = new MeshStandardMaterial({ color: 0x88ccee, roughness: 0.1, metalness: 0.95 });
  const frameGeo = new BoxGeometry(0.9, 0.9, 0.08);
  const glassGeo = new BoxGeometry(0.8, 0.8, 0.09);

  const windowPositions = [
    { x: -1.6, y: 1.8, z: 2.5 },
    { x: -1.6, y: 3.4, z: 2.5 },
    { x: 1.6, y: 3.4, z: 2.5 }
  ];

  for (const pos of windowPositions) {
    const fMesh = new Mesh(frameGeo, frameMat);
    fMesh.position.set(pos.x, pos.y, pos.z);
    const gMesh = new Mesh(glassGeo, glassMat);
    gMesh.position.set(pos.x, pos.y, pos.z + 0.01);
    house.add(fMesh, gMesh);
  }

  // Door Frame & Wood Panel Door
  const doorFrame = new Mesh(new BoxGeometry(1.12, 2.06, 0.08), frameMat);
  doorFrame.position.set(1.2, 1.03, 2.5);
  
  const doorMat = new MeshStandardMaterial({ color: 0x6e2a14, roughness: 0.8 });
  const door = new Mesh(new BoxGeometry(1.0, 2.0, 0.06), doorMat);
  door.position.set(1.2, 1.0, 2.52);

  // Door panels (recessed design)
  const panelMat = new MeshStandardMaterial({ color: 0x531f0f, roughness: 0.85 });
  const panelGeo = new BoxGeometry(0.32, 0.36, 0.02);
  const p1 = new Mesh(panelGeo, panelMat);
  p1.position.set(1.02, 1.4, 2.535);
  const p2 = new Mesh(panelGeo, panelMat);
  p2.position.set(1.38, 1.4, 2.535);
  const p3 = new Mesh(panelGeo, panelMat);
  p3.position.set(1.02, 0.8, 2.535);
  const p4 = new Mesh(panelGeo, panelMat);
  p4.position.set(1.38, 0.8, 2.535);

  // Brass knob
  const knob = new Mesh(new SphereGeometry(0.045, 8, 8), new MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 }));
  knob.position.set(1.36, 1.0, 2.55);

  house.add(doorFrame, door, p1, p2, p3, p4, knob);

  house.position.set(x, 0, z);
  house.rotation.y = rotationY;
  return house;
}

function createStreetlight(x: number, z: number, rotateY = 0): Group {
  const lightGroup = new Group();
  const poleMat = new MeshStandardMaterial({ color: 0x2c3539, metalness: 0.7, roughness: 0.3 });
  const pole = new Mesh(new CylinderGeometry(0.04, 0.05, 4.0, 8), poleMat);
  pole.position.y = 2.0;
  pole.castShadow = true;
  lightGroup.add(pole);

  const head = new Mesh(new BoxGeometry(0.12, 0.08, 0.38), poleMat);
  head.position.set(0, 4.0, 0.12);
  lightGroup.add(head);

  const lens = new Mesh(new BoxGeometry(0.10, 0.02, 0.32), new MeshBasicMaterial({ color: 0xfff3a8 }));
  lens.position.set(0, 3.95, 0.12);
  lightGroup.add(lens);

  const bulb = new DirectionalLight(0xfff5bc, 0.68);
  bulb.position.set(0, 3.9, 0.15);
  lightGroup.add(bulb);

  // Volumetric streetlight cone
  const coneGeo = new ConeGeometry(1.6, 4.0, 16, 1, true);
  const coneMat = new MeshBasicMaterial({
    color: 0xfff3a8,
    transparent: true,
    opacity: 0.12,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false
  });
  const lightCone = new Mesh(coneGeo, coneMat);
  lightCone.position.set(0, 1.95, 0.2);
  lightCone.rotation.x = 0.05;
  lightGroup.add(lightCone);

  lightGroup.position.set(x, 0, z);
  lightGroup.rotation.y = rotateY;
  return lightGroup;
}

function createTrafficCone(x: number, z: number): Group {
  const coneGroup = new Group();
  const baseMat = new MeshStandardMaterial({ color: 0x181818, roughness: 0.95 });
  const coneMat = new MeshStandardMaterial({ color: 0xff5500, roughness: 0.45 });
  const stripeMat = new MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3, metalness: 0.1 });
  
  const base = new Mesh(new BoxGeometry(0.3, 0.04, 0.3), baseMat);
  base.position.y = 0.02;
  base.receiveShadow = true;
  
  const cone = new Mesh(new ConeGeometry(0.09, 0.42, 16), coneMat);
  cone.position.y = 0.21;
  cone.castShadow = true;
  
  const band = new Mesh(new CylinderGeometry(0.055, 0.068, 0.12, 16), stripeMat);
  band.position.y = 0.24;
  band.castShadow = true;
  
  coneGroup.add(base, cone, band);
  coneGroup.position.set(x, 0, z);
  return coneGroup;
}

function createPedestrianMesh(): Group {
  const pedGroup = new Group();
  pedGroup.name = 'PedestrianDetailedGroup';

  const skinMat = new MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 }); // Peach skin tone
  const shirtMat = new MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.7 }); // Blue shirt
  const pantsMat = new MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 }); // Dark pants
  const shoeMat = new MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }); // Black shoes

  // Torso
  const torso = new Mesh(new BoxGeometry(0.36, 0.6, 0.22), shirtMat);
  torso.position.y = 0.95;
  torso.castShadow = true;
  torso.receiveShadow = true;
  pedGroup.add(torso);

  // Head
  const head = new Mesh(new SphereGeometry(0.14, 12, 12), skinMat);
  head.position.y = 1.35;
  head.castShadow = true;
  pedGroup.add(head);

  // Hair/Hat
  const hair = new Mesh(new SphereGeometry(0.145, 12, 12), shoeMat);
  hair.position.set(0, 1.38, 0.02);
  hair.scale.set(1.02, 0.95, 1.02);
  pedGroup.add(hair);

  // Left Leg
  const leftLeg = new Group();
  leftLeg.position.set(-0.1, 0.65, 0);
  const leftLegMesh = new Mesh(new BoxGeometry(0.12, 0.55, 0.12), pantsMat);
  leftLegMesh.geometry.translate(0, -0.275, 0);
  leftLegMesh.castShadow = true;
  const leftShoe = new Mesh(new BoxGeometry(0.13, 0.08, 0.18), shoeMat);
  leftShoe.position.set(0, -0.55, 0.03);
  leftShoe.castShadow = true;
  leftLeg.add(leftLegMesh, leftShoe);

  // Right Leg
  const rightLeg = new Group();
  rightLeg.position.set(0.1, 0.65, 0);
  const rightLegMesh = new Mesh(new BoxGeometry(0.12, 0.55, 0.12), pantsMat);
  rightLegMesh.geometry.translate(0, -0.275, 0);
  rightLegMesh.castShadow = true;
  const rightShoe = new Mesh(new BoxGeometry(0.13, 0.08, 0.18), shoeMat);
  rightShoe.position.set(0, -0.55, 0.03);
  rightShoe.castShadow = true;
  rightLeg.add(rightLegMesh, rightShoe);

  pedGroup.add(leftLeg, rightLeg);

  // Left Arm
  const leftArm = new Group();
  leftArm.position.set(-0.22, 1.15, 0);
  const leftArmMesh = new Mesh(new BoxGeometry(0.09, 0.5, 0.09), shirtMat);
  leftArmMesh.geometry.translate(0, -0.25, 0);
  leftArmMesh.castShadow = true;
  const leftHand = new Mesh(new SphereGeometry(0.05, 8, 8), skinMat);
  leftHand.position.set(0, -0.52, 0);
  leftHand.castShadow = true;
  leftArm.add(leftArmMesh, leftHand);

  // Right Arm
  const rightArm = new Group();
  rightArm.position.set(0.22, 1.15, 0);
  const rightArmMesh = new Mesh(new BoxGeometry(0.09, 0.5, 0.09), shirtMat);
  rightArmMesh.geometry.translate(0, -0.25, 0);
  rightArmMesh.castShadow = true;
  const rightHand = new Mesh(new SphereGeometry(0.05, 8, 8), skinMat);
  rightHand.position.set(0, -0.52, 0);
  rightHand.castShadow = true;
  rightArm.add(rightArmMesh, rightHand);

  pedGroup.add(leftArm, rightArm);

  pedGroup.userData = { leftLeg, rightLeg, leftArm, rightArm };

  return pedGroup;
}

function addTrainingRoute(): void {
  scene.fog = new FogExp2(0xd5e6f0, 0.015);
  addSkyDome();

  const bumpNoise = createNoiseBumpTexture(128, 128, 0.4);

  const grassMat = new MeshStandardMaterial({
    map: createGrassTexture(),
    bumpMap: bumpNoise,
    bumpScale: 0.04,
    roughness: 0.95,
  });
  const grass = new Mesh(new PlaneGeometry(150, 180), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  const roadMat = new MeshStandardMaterial({
    map: createAsphaltTexture(),
    bumpMap: createNoiseBumpTexture(256, 256, 0.25),
    bumpScale: 0.012,
    roughness: 0.82,
  });
  const road = new Mesh(new PlaneGeometry(7.2, 86), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.012;
  road.receiveShadow = true;
  scene.add(road);

  const kerbMaterial = new MeshStandardMaterial({
    map: createKerbTexture(),
    roughness: 0.82
  });
  for (const x of [-3.75, 3.75]) {
    const kerb = new Mesh(new BoxGeometry(0.18, 0.12, 86), kerbMaterial);
    kerb.position.set(x, 0.07, 0);
    kerb.receiveShadow = true;
    scene.add(kerb);
  }

  const lineMaterial = new MeshStandardMaterial({ color: 0xdedac8, roughness: 0.86 });
  for (let z = -37; z <= 37; z += 8) {
    const centerDash = new Mesh(new BoxGeometry(0.12, 0.018, 3.2), lineMaterial);
    centerDash.position.set(0, 0.035, z);
    scene.add(centerDash);
  }

  const startBox = createRoadMarking(0xdedac8, 2.9, 0.12, -34);
  scene.add(startBox);

  const finishBox = createRoadMarking(0x8bc34a, 2.9, 0.12, 35);
  scene.add(finishBox);

  // Center zebra stripes at x = 0 with width 7.2 so they cover the entire road width
  for (const z of [8.7, 9.35, 10, 10.65, 11.3]) {
    const stripe = new Mesh(
      new BoxGeometry(7.2, 0.018, 0.26),
      new MeshStandardMaterial({ color: 0xdedac8, roughness: 0.7 }),
    );
    stripe.position.set(0, 0.038, z);
    scene.add(stripe);
  }

  const pavementMaterial = new MeshStandardMaterial({
    map: createPavementTexture(),
    roughness: 0.88
  });
  for (const x of [-6.6, 6.6]) {
    const pavement = new Mesh(new PlaneGeometry(4.4, 86), pavementMaterial);
    pavement.rotation.x = -Math.PI / 2;
    pavement.position.set(x, 0.018, 0);
    pavement.receiveShadow = true;
    scene.add(pavement);
  }

  for (const z of [-35, -20, -5, 15, 30]) {
    scene.add(createTree(-8.5, z));
    scene.add(createTree(8.5, z + 5));
  }

  scene.add(createHouse(-12, -25, Math.PI / 2));
  scene.add(createHouse(-12, -5, Math.PI / 2));
  scene.add(createHouse(-12, 20, Math.PI / 2));
  scene.add(createHouse(12, -15, -Math.PI / 2));
  scene.add(createHouse(12, 10, -Math.PI / 2));
  scene.add(createHouse(12, 30, -Math.PI / 2));

  for (const z of [-30, -10, 10, 30]) {
    scene.add(createStreetlight(-5.5, z, Math.PI / 2));
    scene.add(createStreetlight(5.5, z + 5, -Math.PI / 2));
  }

  for (let z = -43; z <= 43; z += 4) {
    scene.add(createTrafficCone(-4.2, z));
    scene.add(createTrafficCone(4.2, z));
  }

  // Add the 3D detailed walking pedestrian
  pedestrianMesh = createPedestrianMesh();
  scene.add(pedestrianMesh);

  // Spawn the pedestrian in the AI manager (waiting at the left curb x = -4.2)
  const crossingPath = {
    crossingId: 'zebra-demo',
    waitPosition: { x: -4.2, y: 0.08, z: 9.7 },
    startPosition: { x: -3.6, y: 0.08, z: 9.7 },
    endPosition: { x: 3.6, y: 0.08, z: 9.7 },
    widthMeters: 2.0,
  };
  pedestrianManager.spawn('ped-zebra-1', crossingPath, 'waiting');

  const sign = new Group();
  const post = new Mesh(
    new BoxGeometry(0.08, 1.6, 0.08),
    new MeshStandardMaterial({ color: 0x7b8288, roughness: 0.55 }),
  );
  post.position.y = 0.8;
  const plate = new Mesh(
    new BoxGeometry(0.9, 0.55, 0.06),
    new MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.48 }),
  );
  plate.position.y = 1.72;
  sign.add(post, plate);
  sign.position.set(-4.25, 0, -20);
  sign.rotation.y = Math.PI; // Face the oncoming driver from -Z
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

function createLicensePlateTexture(isRear: boolean): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isRear ? '#f5b002' : '#ffffff'; // Yellow rear, white front
  ctx.fillRect(0, 0, 128, 32);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 124, 28);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LS26 GDM', 64, 16);
  return new CanvasTexture(canvas);
}

function createCarMesh(): Group {
  const carGroup = new Group();
  carGroup.name = 'PlayerCarDetailedGroup';

  const chassisMat = new MeshStandardMaterial({ color: 0xb31111, metalness: 0.85, roughness: 0.16 });
  const plasticMat = new MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.8 });
  const glassMat = new MeshStandardMaterial({ color: 0x05080c, metalness: 0.95, roughness: 0.05, transparent: true, opacity: 0.85 });
  const wheelMat = new MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.88 });
  const rimMat = new MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.85, roughness: 0.18 });
  const headlampMat = new MeshBasicMaterial({ color: 0xffffee });
  const taillampMat = new MeshBasicMaterial({ color: 0xff3b30 });

  // 1. Lower Body Chassis
  const body = new Mesh(new BoxGeometry(1.8, 0.48, 3.8), chassisMat);
  body.position.y = 0.34;
  body.castShadow = true;
  body.receiveShadow = true;
  carGroup.add(body);

  // Wheel arch details (flanks to cover wheels slightly)
  const flankL = new Mesh(new BoxGeometry(0.08, 0.35, 3.7), chassisMat);
  flankL.position.set(0.86, 0.28, 0);
  const flankR = flankL.clone();
  flankR.position.x = -0.86;
  carGroup.add(flankL, flankR);

  // 2. Cabin Glass Greenhouse
  const cabin = new Mesh(new BoxGeometry(1.5, 0.48, 2.2), glassMat);
  cabin.position.set(0, 0.76, -0.2);
  cabin.castShadow = true;
  carGroup.add(cabin);

  // Pillars (thin red trims)
  const aPillarL = new Mesh(new BoxGeometry(0.04, 0.52, 0.04), chassisMat);
  aPillarL.position.set(0.72, 0.74, 0.9);
  aPillarL.rotation.x = 0.4;
  aPillarL.rotation.z = -0.1;

  const aPillarR = new Mesh(new BoxGeometry(0.04, 0.52, 0.04), chassisMat);
  aPillarR.position.set(-0.72, 0.74, 0.9);
  aPillarR.rotation.x = 0.4;
  aPillarR.rotation.z = 0.1;

  const cPillarL = new Mesh(new BoxGeometry(0.06, 0.52, 0.06), chassisMat);
  cPillarL.position.set(0.72, 0.74, -1.3);
  cPillarL.rotation.x = -0.3;

  const cPillarR = new Mesh(new BoxGeometry(0.06, 0.52, 0.06), chassisMat);
  cPillarR.position.set(-0.72, 0.74, -1.3);
  cPillarR.rotation.x = -0.3;

  carGroup.add(aPillarL, aPillarR, cPillarL, cPillarR);

  // Roof plane
  const roof = new Mesh(new BoxGeometry(1.42, 0.04, 2.1), chassisMat);
  roof.position.set(0, 1.0, -0.2);
  roof.castShadow = true;
  carGroup.add(roof);

  // 3. Wheels with silver alloy spokes
  const wheelGeo = new CylinderGeometry(0.35, 0.35, 0.24, 16);
  wheelGeo.rotateZ(Math.PI / 2); // Rotate to lie flat horizontally
  
  // Spokes geometry (silver inner circle with spokes)
  const spokeGroupGeo = new Group();
  const rimCenter = new Mesh(new CylinderGeometry(0.24, 0.24, 0.25, 12), rimMat);
  rimCenter.rotateZ(Math.PI / 2);
  spokeGroupGeo.add(rimCenter);
  // Add 5 spokes
  for (let i = 0; i < 5; i++) {
    const spoke = new Mesh(new BoxGeometry(0.03, 0.42, 0.03), rimMat);
    spoke.rotation.x = (i * Math.PI * 2) / 5;
    spoke.position.x = 0.126; // align to outer edge
    spokeGroupGeo.add(spoke);
  }

  // Create wheel assemblies
  const createWheel = (xSign: number): Group => {
    const wGroup = new Group();
    const tire = new Mesh(wheelGeo, wheelMat);
    tire.castShadow = true;
    const spokes = spokeGroupGeo.clone();
    spokes.scale.x = xSign; // Flip design for other side
    wGroup.add(tire, spokes);
    // Reference the rolling tire mesh directly on the wheel assembly
    wGroup.userData = { tire };
    return wGroup;
  };

  // Front pivots for steering
  const lfPivot = new Group();
  lfPivot.position.set(0.85, 0.35, 1.15);
  const lfWheel = createWheel(1);
  lfPivot.add(lfWheel);

  const rfPivot = new Group();
  rfPivot.position.set(-0.85, 0.35, 1.15);
  const rfWheel = createWheel(-1);
  rfPivot.add(rfWheel);

  carGroup.add(lfPivot, rfPivot);

  // Rear wheels (no steer pivot needed)
  const lrWheel = createWheel(1);
  lrWheel.position.set(0.85, 0.35, -1.15);
  const rrWheel = createWheel(-1);
  rrWheel.position.set(-0.85, 0.35, -1.15);

  carGroup.add(lrWheel, rrWheel);

  // 4. Headlights and Taillights
  const grill = new Mesh(new BoxGeometry(1.4, 0.22, 0.08), plasticMat);
  grill.position.set(0, 0.34, 1.91);
  carGroup.add(grill);

  const headlightL = new Mesh(new BoxGeometry(0.2, 0.12, 0.06), headlampMat);
  headlightL.position.set(0.68, 0.36, 1.91);
  const headlightR = headlightL.clone();
  headlightR.position.x = -0.68;
  carGroup.add(headlightL, headlightR);

  // Taillights
  const taillightL = new Mesh(new BoxGeometry(0.24, 0.1, 0.06), taillampMat);
  taillightL.position.set(0.68, 0.36, -1.91);
  const taillightR = taillightL.clone();
  taillightR.position.x = -0.68;
  carGroup.add(taillightL, taillightR);

  // 5. License Plates
  const plateMatF = new MeshBasicMaterial({ map: createLicensePlateTexture(false) });
  const plateMatR = new MeshBasicMaterial({ map: createLicensePlateTexture(true) });
  const plateGeo = new PlaneGeometry(0.48, 0.12);

  const plateF = new Mesh(plateGeo, plateMatF);
  plateF.position.set(0, 0.16, 1.91);
  // face forward (facing positive Z)
  plateF.rotation.y = 0;

  const plateR = new Mesh(plateGeo, plateMatR);
  plateR.position.set(0, 0.18, -1.91);
  // face backward (facing negative Z)
  plateR.rotation.y = Math.PI;

  carGroup.add(plateF, plateR);

  // 6. Exhaust Pipe
  const exhaust = new Mesh(new CylinderGeometry(0.04, 0.04, 0.3, 8), rimMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.55, 0.12, -1.82);
  carGroup.add(exhaust);

  // Store references for animation
  carGroup.userData = {
    lfPivot, rfPivot,
    lfTire: lfWheel.userData.tire,
    rfTire: rfWheel.userData.tire,
    lrTire: lrWheel.userData.tire,
    rrTire: rrWheel.userData.tire,
    exhaust
  };

  return carGroup;
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

  const currentPedestrians = pedestrianManager
    ? pedestrianManager.getPedestrians().map((p) => ({
        id: p.id,
        state: p.state,
        crossingId: p.crossingId,
        position: p.position,
        boundingRadius: p.boundingRadius,
      }))
    : [];

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
    pedestrians: currentPedestrians,
  };
}

async function start(): Promise<void> {
  pedestrianManager = new PedestrianAIManager();
  addLights();
  addTrainingRoute();

  const physics = await VehiclePhysics.init();
  physics.addGround({ halfExtents: { x: 45, y: 0.1, z: 55 }, friction: 0.35 });

  const car = new PlayerCar(physics, {
    initialPosition: { x: -1.75, y: 0.7, z: -34 },
    initialYawRadians: 0,
    maxSpeedMph: 45,
  });
  const carMesh = createCarMesh();
  scene.add(carMesh);

  const cockpit = new CockpitView({ mirrorTextureSize: 256 });
  scene.add(cockpit.object3D);

  const tpsCamera = new PerspectiveCamera(60, 1, 0.1, 1000);
  let cameraMode: 'cockpit' | 'thirdperson' = 'cockpit';
  app!.addEventListener('camera-switch', () => {
    cameraMode = cameraMode === 'cockpit' ? 'thirdperson' : 'cockpit';
  });
  app!.addEventListener('indicator-change', (event) => {
    const nextIndicator = (event as CustomEvent<{ indicator?: Indicator }>).detail?.indicator;
    if (
      nextIndicator === 'off' ||
      nextIndicator === 'left' ||
      nextIndicator === 'right' ||
      nextIndicator === 'hazard'
    ) {
      indicator = nextIndicator;
    }
  });

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
    tpsCamera.aspect = width / Math.max(height, 1);
    tpsCamera.updateProjectionMatrix();
  };

  window.addEventListener('resize', resize);
  resize();


  renderer.setAnimationLoop(() => {
    const nowSeconds = performance.now() / 1000;
    const deltaSeconds = Math.min(0.05, nowSeconds - lastFrameSeconds);
    lastFrameSeconds = nowSeconds;
    elapsedSeconds += deltaSeconds;

    const inputGear = keys.handbrake ? 'P' : gear;
    const carInput = createDigitalCarInput({
      forward: keys.forward,
      backward: keys.backward || keys.handbrake,
      left: keys.left,
      right: keys.right,
      gear: inputGear,
      indicator,
    });
    const state = car.update(carInput, deltaSeconds);

    carMesh.position.set(state.position.x, state.position.y, state.position.z);
    carMesh.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);

    // Animate vehicle wheels and components
    const ud = carMesh.userData;
    if (ud && ud.lfTire) {
      const speedMps = state.speedMph * 0.44704;
      const wheelRadius = 0.35;
      const rollDelta = (speedMps * deltaSeconds) / wheelRadius;

      // Spin tires
      ud.lfTire.rotation.x += rollDelta;
      ud.rfTire.rotation.x += rollDelta;
      ud.lrTire.rotation.x += rollDelta;
      ud.rrTire.rotation.x += rollDelta;

      // Turn front wheels
      const steerAngle = state.wheelAngleRadians || 0;
      ud.lfPivot.rotation.y = steerAngle;
      ud.rfPivot.rotation.y = steerAngle;

      // Engine rumble vibration on exhaust pipe
      if (ud.exhaust) {
        ud.exhaust.position.x = 0.55 + Math.sin(performance.now() * 0.08) * 0.003;
      }
    }

    cockpit.updateFromVehiclePose({
      position: state.position,
      yawDegrees: state.yawDegrees,
      wheelAngleRadians: state.wheelAngleRadians,
      throttlePressed: keys.forward,
      brakePressed: keys.backward || keys.handbrake,
      indicatorState: indicator,
      speedMph: state.speedMph,
    });

    // Update and animate pedestrian
    if (pedestrianManager) {
      pedestrianManager.update(deltaSeconds);
      
      const ped = pedestrianManager.getPedestrians()[0];
      if (ped) {
        // Trigger crossing if player car is approaching the crossing (e.g. z between -20.0 and -10.0)
        if (ped.state === 'waiting' && state.position.z > -20.0 && state.position.z < -10.0) {
          pedestrianManager.triggerCrossing('ped-zebra-1');
        }

        pedestrianMesh.position.set(ped.position.x, ped.position.y, ped.position.z);
        const yaw = Math.atan2(ped.heading.x, ped.heading.z);
        pedestrianMesh.rotation.y = yaw;

        const ud = pedestrianMesh.userData;
        if (ud) {
          if (ped.state === 'crossing') {
            const time = performance.now() * 0.008;
            const swingAngle = Math.sin(time) * 0.6;
            ud.leftLeg.rotation.x = swingAngle;
            ud.rightLeg.rotation.x = -swingAngle;
            ud.leftArm.rotation.x = -swingAngle;
            ud.rightArm.rotation.x = swingAngle;
          } else {
            ud.leftLeg.rotation.x = 0;
            ud.rightLeg.rotation.x = 0;
            ud.leftArm.rotation.x = 0;
            ud.rightArm.rotation.x = 0;
          }
        }
      }
    }

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

    if (cameraMode === 'thirdperson') {
      const yawRadians = (state.yawDegrees * Math.PI) / 180;
      const offsetX = -6 * Math.sin(yawRadians);
      const offsetZ = -6 * Math.cos(yawRadians);
      tpsCamera.position.set(
        state.position.x + offsetX,
        state.position.y + 2.8,
        state.position.z + offsetZ
      );
      tpsCamera.lookAt(state.position.x, state.position.y + 0.6, state.position.z);
    }

    const activeCamera = cameraMode === 'cockpit' ? cockpit.activeCamera : tpsCamera;

    if (cameraMode === 'cockpit') {
      cockpit.object3D.visible = true;
      cockpit.renderMirrors(scene, renderer);
    } else {
      cockpit.object3D.visible = false;
    }

    renderer.render(scene, activeCamera);
  });
}

start().catch((error) => {
  app.textContent = 'Failed to start UK Driving Trainer. Please check the console.';
  console.error(error);
});
