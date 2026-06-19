import {
  Group,
  Mesh,
  MeshStandardMaterial,
  BoxGeometry,
  PlaneGeometry,
  CylinderGeometry,
  ConeGeometry,
  SphereGeometry,
  CircleGeometry,
  Object3D,
} from 'three';

/**
 * Procedural 3D town for UK driving training.
 * Builds roads, buildings, street furniture, and environment using Three.js primitives.
 */
export class TownScene {
  readonly root: Group;
  private readonly zoneGroups = new Map<string, Group>();

  constructor() {
    this.root = new Group();
    this.root.name = 'TownScene';

    this.buildRoads();
    this.buildRoadMarkings();
    this.buildBuildings();
    this.buildStreetFurniture();
    this.buildEnvironment();
  }

  getZoneGroup(name: string): Object3D | undefined {
    return this.zoneGroups.get(name);
  }

  dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.root.clear();
    this.zoneGroups.clear();
  }

  // ── Helpers ───────────────────────────────────────────────

  private getOrCreateZone(name: string): Group {
    let group = this.zoneGroups.get(name);
    if (!group) {
      group = new Group();
      group.name = name;
      this.root.add(group);
      this.zoneGroups.set(name, group);
    }
    return group;
  }

  private mat(color: number, roughness = 0.85): MeshStandardMaterial {
    return new MeshStandardMaterial({ color, roughness });
  }

  private roadPlane(w: number, h: number, x: number, z: number, parent: Group): Mesh {
    const m = new Mesh(new PlaneGeometry(w, h), this.mat(0x3a3a3a));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.01, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ── Roads ─────────────────────────────────────────────────

  private buildRoads(): void {
    const junctionZone = this.getOrCreateZone('zone-junction');
    const roundaboutZone = this.getOrCreateZone('zone-roundabout');
    const tescoZone = this.getOrCreateZone('zone-tesco');
    const residentialZone = this.getOrCreateZone('zone-residential');
    const zebraZone = this.getOrCreateZone('zone-zebra');

    // Main east-west road
    this.roadPlane(600, 7, 0, 0, junctionZone);

    // Residential north-south road
    this.roadPlane(6, 300, -80, 0, residentialZone);

    // Kerb stones for the main road
    const kerbMat = this.mat(0xc7c4b8, 0.78);
    for (const zOffset of [-3.65, 3.65]) {
      const kerb = new Mesh(new BoxGeometry(600, 0.12, 0.18), kerbMat);
      kerb.position.set(0, 0.07, zOffset);
      kerb.receiveShadow = true;
      junctionZone.add(kerb);
    }

    // Residential road kerbs
    for (const xOffset of [-83.1, -76.9]) {
      const kerb = new Mesh(new BoxGeometry(0.18, 0.12, 300), kerbMat);
      kerb.position.set(xOffset, 0.07, 0);
      kerb.receiveShadow = true;
      residentialZone.add(kerb);
    }

    // Roundabout center island
    const islandGeo = new CylinderGeometry(3, 3, 0.15, 24);
    const island = new Mesh(islandGeo, this.mat(0xeeeeee, 0.7));
    island.position.set(50, 0.08, 0);
    island.receiveShadow = true;
    roundaboutZone.add(island);

    // Roundabout approach roads (4 arms)
    const armLength = 20;
    const armWidth = 7;
    for (const [ax, az, rot] of [
      [50, -13.5, 0],
      [50, 13.5, 0],
      [36.5, 0, Math.PI / 2],
      [63.5, 0, Math.PI / 2],
    ] as [number, number, number][]) {
      const arm = new Mesh(new PlaneGeometry(armWidth, armLength), this.mat(0x3a3a3a));
      arm.rotation.x = -Math.PI / 2;
      arm.rotation.z = rot;
      arm.position.set(ax, 0.012, az);
      arm.receiveShadow = true;
      roundaboutZone.add(arm);
    }

    // Tesco car park
    this.roadPlane(40, 30, 200, -40, tescoZone);

    // Zebra crossing approach area
    const zebraRoad = new Mesh(new PlaneGeometry(7, 6), this.mat(0x383838));
    zebraRoad.rotation.x = -Math.PI / 2;
    zebraRoad.position.set(-20, 0.015, 0);
    zebraRoad.receiveShadow = true;
    zebraZone.add(zebraRoad);
  }

  // ── Road Markings ─────────────────────────────────────────

  private buildRoadMarkings(): void {
    const junctionZone = this.getOrCreateZone('zone-junction');
    const zebraZone = this.getOrCreateZone('zone-zebra');
    const tescoZone = this.getOrCreateZone('zone-tesco');

    const white = this.mat(0xf2f0db, 0.65);

    // Center dashed lines on main road
    for (let x = -290; x <= 290; x += 6) {
      // Skip the roundabout and zebra areas
      if (x > 35 && x < 65) continue;
      if (x > -25 && x < -15) continue;
      const dash = new Mesh(new BoxGeometry(2, 0.018, 0.12), white);
      dash.position.set(x, 0.025, 0);
      junctionZone.add(dash);
    }

    // Give Way triangle at T-junction
    const triangleBase = new Mesh(new BoxGeometry(3, 0.02, 0.15), white);
    triangleBase.position.set(-80, 0.025, -3.65);
    junctionZone.add(triangleBase);
    // Triangle dashes
    for (let i = 0; i < 5; i++) {
      const dashW = 0.5 - i * 0.08;
      const triDash = new Mesh(new BoxGeometry(dashW, 0.02, 0.12), white);
      triDash.position.set(-80, 0.025, -3.65 - 0.3 * (i + 1));
      junctionZone.add(triDash);
    }

    // Zebra crossing stripes
    for (let z = -2.8; z <= 2.8; z += 0.65) {
      const stripe = new Mesh(new BoxGeometry(7, 0.02, 0.28), white);
      stripe.position.set(-20, 0.025, z);
      zebraZone.add(stripe);
    }

    // Parking bay lines (6 bays)
    const bayLineMat = this.mat(0xffffff, 0.6);
    for (let i = 0; i < 6; i++) {
      const bx = 185 + i * 2.5;
      // Side lines
      for (const dz of [-48, -43]) {
        const sideLine = new Mesh(new BoxGeometry(0.08, 0.02, 5), bayLineMat);
        sideLine.position.set(bx, 0.025, dz + 2.5);
        tescoZone.add(sideLine);
      }
      // Front line
      const frontLine = new Mesh(new BoxGeometry(2.5, 0.02, 0.08), bayLineMat);
      frontLine.position.set(bx + 1.25, 0.025, -48);
      tescoZone.add(frontLine);
    }
  }

  // ── Buildings ─────────────────────────────────────────────

  private buildBuildings(): void {
    const residentialZone = this.getOrCreateZone('zone-residential');
    const schoolZone = this.getOrCreateZone('zone-school');
    const tescoZone = this.getOrCreateZone('zone-tesco');

    const brickColors = [0xc4764f, 0xb86b44, 0xd49568, 0xc87f55, 0xba7040, 0xcd9060, 0xc07050, 0xd0885a];
    const roofMat = this.mat(0x4a4a4a, 0.75);

    // Residential houses along the residential road
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const zPos = -120 + i * 30;
      const xPos = -80 + side * 10;

      // House body
      const house = new Mesh(new BoxGeometry(5, 3, 4), this.mat(brickColors[i], 0.82));
      house.position.set(xPos, 1.5, zPos);
      house.castShadow = true;
      house.receiveShadow = true;
      residentialZone.add(house);

      // Roof (triangular prism approximated with a rotated box)
      const roof = new Mesh(new ConeGeometry(3.5, 1.8, 4), roofMat);
      roof.position.set(xPos, 3.9, zPos);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      residentialZone.add(roof);

      // Door
      const door = new Mesh(new BoxGeometry(0.8, 1.6, 0.06), this.mat(0x4a2a15, 0.7));
      door.position.set(xPos, 0.8, zPos + side * 2.03);
      residentialZone.add(door);

      // Windows
      const windowMat = this.mat(0x8ec8e8, 0.4);
      for (const wx of [-1.2, 1.2]) {
        const win = new Mesh(new BoxGeometry(0.7, 0.7, 0.06), windowMat);
        win.position.set(xPos + wx, 1.8, zPos + side * 2.03);
        residentialZone.add(win);
      }
    }

    // School building
    const school = new Mesh(new BoxGeometry(15, 4, 10), this.mat(0xa8564a, 0.8));
    school.position.set(-80, 2, 80);
    school.castShadow = true;
    school.receiveShadow = true;
    schoolZone.add(school);

    // School roof
    const schoolRoof = new Mesh(new BoxGeometry(16, 0.3, 11), roofMat);
    schoolRoof.position.set(-80, 4.15, 80);
    schoolRoof.castShadow = true;
    schoolZone.add(schoolRoof);

    // School sign placeholder
    const schoolSign = new Mesh(new BoxGeometry(4, 1, 0.1), this.mat(0x1a5276, 0.5));
    schoolSign.position.set(-80, 3.2, 74.95);
    schoolZone.add(schoolSign);

    // School fence
    const fenceMat = this.mat(0x2c3e50, 0.7);
    for (let x = -87; x <= -73; x += 1.5) {
      if (x > -82 && x < -78) continue; // gate opening
      const post = new Mesh(new BoxGeometry(0.08, 1.2, 0.08), fenceMat);
      post.position.set(x, 0.6, 74);
      schoolZone.add(post);
    }
    // Fence rails
    for (const h of [0.3, 0.8]) {
      for (const [start, end] of [[-87, -82], [-78, -73]]) {
        const rail = new Mesh(new BoxGeometry(end - start, 0.06, 0.06), fenceMat);
        rail.position.set((start + end) / 2, h, 74);
        schoolZone.add(rail);
      }
    }

    // Tesco supermarket
    const tesco = new Mesh(new BoxGeometry(25, 5, 15), this.mat(0x3a3a3a, 0.75));
    tesco.position.set(200, 2.5, -20);
    tesco.castShadow = true;
    tesco.receiveShadow = true;
    tescoZone.add(tesco);

    // Tesco front face (blue)
    const tescoFront = new Mesh(new BoxGeometry(25.1, 5.1, 0.1), this.mat(0x00539f, 0.6));
    tescoFront.position.set(200, 2.5, -12.45);
    tescoZone.add(tescoFront);

    // Tesco sign
    const tescoSign = new Mesh(new BoxGeometry(8, 1.5, 0.15), this.mat(0xe63946, 0.5));
    tescoSign.position.set(200, 4.5, -12.35);
    tescoZone.add(tescoSign);
  }

  // ── Street Furniture ──────────────────────────────────────

  private buildStreetFurniture(): void {
    const junctionZone = this.getOrCreateZone('zone-junction');
    const zebraZone = this.getOrCreateZone('zone-zebra');
    const schoolZone = this.getOrCreateZone('zone-school');

    const poleMat = this.mat(0x888888, 0.55);

    // Speed limit signs
    const signPositions: [number, number, number, number][] = [
      [-150, 5, 20, 0],   // 20 mph zone start
      [-50, 5, 30, 0],    // 30 mph transition
      [100, -5, 30, Math.PI],  // 30 mph other direction
    ];

    for (const [x, z, _limit, rotY] of signPositions) {
      const signGroup = new Group();

      // Pole
      const pole = new Mesh(new CylinderGeometry(0.04, 0.04, 2.5, 8), poleMat);
      pole.position.y = 1.25;
      signGroup.add(pole);

      // Sign face (circular)
      const signFace = new Mesh(new CircleGeometry(0.3, 16), this.mat(0xffffff, 0.5));
      signFace.position.set(0, 2.6, 0.05);
      signGroup.add(signFace);

      // Red border ring
      const ring = new Mesh(
        new CylinderGeometry(0.32, 0.32, 0.02, 16),
        this.mat(0xcc0000, 0.5),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 2.6, 0.04);
      signGroup.add(ring);

      signGroup.position.set(x, 0, z);
      signGroup.rotation.y = rotY;
      junctionZone.add(signGroup);
    }

    // Give Way sign at T-junction
    const giveWayGroup = new Group();
    const gwPole = new Mesh(new CylinderGeometry(0.04, 0.04, 2.2, 8), poleMat);
    gwPole.position.y = 1.1;
    giveWayGroup.add(gwPole);

    // Triangle sign (inverted triangle approximated by a cone)
    const gwSign = new Mesh(new ConeGeometry(0.35, 0.4, 3), this.mat(0xffffff, 0.5));
    gwSign.rotation.z = Math.PI;
    gwSign.position.set(0, 2.4, 0);
    giveWayGroup.add(gwSign);
    // Red border
    const gwBorder = new Mesh(new ConeGeometry(0.38, 0.44, 3), this.mat(0xcc0000, 0.5));
    gwBorder.rotation.z = Math.PI;
    gwBorder.position.set(0, 2.4, -0.02);
    giveWayGroup.add(gwBorder);

    giveWayGroup.position.set(-83.5, 0, -5);
    junctionZone.add(giveWayGroup);

    // Streetlights along main road
    for (let x = -280; x <= 280; x += 40) {
      const light = new Group();
      const lightPole = new Mesh(new CylinderGeometry(0.05, 0.06, 4, 8), poleMat);
      lightPole.position.y = 2;
      light.add(lightPole);

      const lantern = new Mesh(new BoxGeometry(0.3, 0.2, 0.3), this.mat(0xf5e6c8, 0.4));
      lantern.position.set(0, 4.1, 0);
      light.add(lantern);

      light.position.set(x, 0, -5.5);
      junctionZone.add(light);
    }

    // Bollards at zebra crossing ends
    const bollardMat = this.mat(0x222222, 0.6);
    for (const z of [-3.8, 3.8]) {
      const bollard = new Mesh(new CylinderGeometry(0.08, 0.08, 0.6, 8), bollardMat);
      bollard.position.set(-20, 0.3, z);
      zebraZone.add(bollard);

      // Belisha beacon on top (yellow sphere)
      const beacon = new Mesh(new SphereGeometry(0.12, 8, 6), this.mat(0xffc107, 0.4));
      beacon.position.set(-20, 0.7, z);
      zebraZone.add(beacon);
    }

    // School zone 20 mph signs
    for (const z of [65, 95]) {
      const schoolSignGroup = new Group();
      const ssPole = new Mesh(new CylinderGeometry(0.04, 0.04, 2.5, 8), poleMat);
      ssPole.position.y = 1.25;
      schoolSignGroup.add(ssPole);

      const ssFace = new Mesh(new CircleGeometry(0.3, 16), this.mat(0xffffff, 0.5));
      ssFace.position.set(0, 2.6, 0.05);
      schoolSignGroup.add(ssFace);

      const ssRing = new Mesh(new CylinderGeometry(0.32, 0.32, 0.02, 16), this.mat(0xcc0000, 0.5));
      ssRing.rotation.x = Math.PI / 2;
      ssRing.position.set(0, 2.6, 0.04);
      schoolSignGroup.add(ssRing);

      schoolSignGroup.position.set(-73, 0, z);
      schoolZone.add(schoolSignGroup);
    }
  }

  // ── Environment ───────────────────────────────────────────

  private buildEnvironment(): void {
    const residentialZone = this.getOrCreateZone('zone-residential');
    const junctionZone = this.getOrCreateZone('zone-junction');

    // Grass areas flanking roads
    const grassMat = this.mat(0x4a8a3a, 0.92);
    for (const [x, z, w, h] of [
      [0, 30, 600, 50],
      [0, -30, 600, 50],
      [-80, 160, 30, 20],
      [-80, -160, 30, 20],
    ] as [number, number, number, number][]) {
      const grassPlane = new Mesh(new PlaneGeometry(w, h), grassMat);
      grassPlane.rotation.x = -Math.PI / 2;
      grassPlane.position.set(x, 0.005, z);
      grassPlane.receiveShadow = true;
      junctionZone.add(grassPlane);
    }

    // Trees
    const trunkMat = this.mat(0x5a3a1a, 0.85);
    const canopyColors = [0x2d5a27, 0x3a7033, 0x347a2e, 0x2a6624, 0x408836];

    const treePositions: [number, number][] = [
      [-100, 20], [-60, 22], [-30, 18], [10, 21], [40, 19],
      [80, 23], [120, 17], [160, 22], [-200, 20], [-160, 18],
      [240, 21], [260, 19], [-100, -20], [-60, -22], [-30, -18],
      [10, -21], [80, -23], [120, -17], [160, -22], [240, -20],
      [-85, 30], [-75, 50], [-85, 70], [-75, 110], [-85, 130],
      [-75, -30], [-85, -60], [-75, -90], [-85, -120], [-75, -140],
    ];

    for (let i = 0; i < treePositions.length; i++) {
      const [tx, tz] = treePositions[i];
      const treeGroup = new Group();

      // Trunk
      const trunk = new Mesh(new CylinderGeometry(0.12, 0.18, 2, 6), trunkMat);
      trunk.position.y = 1;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Canopy (alternate between spheres and cones)
      const canopyColor = canopyColors[i % canopyColors.length];
      if (i % 3 === 0) {
        const canopy = new Mesh(new ConeGeometry(1.1, 2.4, 6), this.mat(canopyColor, 0.88));
        canopy.position.y = 3.2;
        canopy.castShadow = true;
        treeGroup.add(canopy);
      } else {
        const canopy = new Mesh(new SphereGeometry(1.2, 8, 6), this.mat(canopyColor, 0.88));
        canopy.position.y = 3.0;
        canopy.castShadow = true;
        treeGroup.add(canopy);
      }

      treeGroup.position.set(tx, 0, tz);
      residentialZone.add(treeGroup);
    }

    // Hedges along residential properties
    const hedgeMat = this.mat(0x2a5020, 0.9);
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const zPos = -120 + i * 30;
      const xPos = -80 + side * 7;

      const hedge = new Mesh(new BoxGeometry(0.5, 0.9, 6), hedgeMat);
      hedge.position.set(xPos, 0.45, zPos);
      hedge.castShadow = true;
      residentialZone.add(hedge);
    }
  }
}
