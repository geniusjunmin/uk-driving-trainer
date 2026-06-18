import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

import { CameraManager } from './core/CameraManager';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App mount node was not found.');
}

app.textContent = '';
app.style.position = 'fixed';
app.style.inset = '0';
app.style.overflow = 'hidden';

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

const cameraManager = new CameraManager(renderer.domElement, {
  distance: 12,
  target: new Vector3(0, 0.7, 0),
});

const ambientLight = new AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const sunLight = new DirectionalLight(0xffffff, 2.1);
sunLight.position.set(7, 12, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 45;
sunLight.shadow.camera.left = -18;
sunLight.shadow.camera.right = 18;
sunLight.shadow.camera.top = 18;
sunLight.shadow.camera.bottom = -18;
scene.add(sunLight);

const ground = new Mesh(
  new PlaneGeometry(80, 80),
  new MeshStandardMaterial({ color: 0x566a55, roughness: 0.92 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new GridHelper(80, 80, 0xd6e0dc, 0x7e8b85);
grid.position.y = 0.01;
scene.add(grid);

const axes = new AxesHelper(2);
axes.position.set(-3, 0.02, -3);
scene.add(axes);

const debugMarker = new Mesh(
  new BoxGeometry(1.2, 0.45, 2.4),
  new MeshStandardMaterial({ color: 0xc93d2b, roughness: 0.65 }),
);
debugMarker.position.set(0, 0.25, 0);
debugMarker.castShadow = true;
debugMarker.receiveShadow = true;
scene.add(debugMarker);

const resize = (): void => {
  const width = app.clientWidth || window.innerWidth;
  const height = app.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  cameraManager.resize(width, height);
};

window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  renderer.render(scene, cameraManager.activeCamera);
});
