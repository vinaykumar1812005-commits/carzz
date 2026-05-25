// 3D City Racing Engine using Three.js
class CarzzGame3D {
  constructor() {
    this.scene = null; this.camera = null; this.renderer = null;
    this.gridCount = 10; this.blockSize = 55; this.roadW = 14; this.spacing = 69;
    this.carGroup = null; this.carSpeed = 0; this.carAngle = Math.PI;
    this.maxSpeed = 45; this.accel = 18; this.brakeForce = 35; this.friction = 3; this.steerSpeed = 2.2;
    this.isEngineStarted = false; this.activeCarKey = 'mercedes';
    this.keys = {}; this.steerOffset = 0;
    this.uiControls = { accelerating:false, braking:false, steeringLeft:false, steeringRight:false };
    this.lastTime = 0; this.animationFrameId = null; this.elapsedTime = 0;
    this.buildingData = []; this.handlingFactor = 1;
    this.npcCars = []; this.cartoonPeople = [];

    // Stunt / physics
    this.ramps = []; // {x,z,width,direction}
    this.airborne = false; this.carVert = 0; this.carVertVel = 0; this.gravity = 24;

    // Landing effects
    this.landEffect = null; this.landEffectTimer = 0;

    // Police chase
    this.policeCar = null; this.policeActive = false; this.policeTimer = 0; this.policeChaseDuration = 120; this.policeSpeed = 28;

    // Extra scenery
    this.extraHouses = []; this.forestAnimals = [];
  }

  init(canvasId) {
    try {
      console.log('CarzzGame3D.init()', { canvasId });
      if (typeof THREE === 'undefined') { console.error('THREE is not available. Ensure three.js is loaded.'); }
      const canvas = document.getElementById(canvasId);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    let w = canvas.parentElement.clientWidth;
    let h = canvas.parentElement.clientHeight;
    if (!w || !h) {
      w = window.innerWidth || 1024;
      h = window.innerHeight || 600;
    }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x6db3f2, 1);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6db3f2);
    this.scene.fog = new THREE.Fog(0x6db3f2, 150, 600);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.5, 800);
    this.camera.position.set(0, 40, -85);
    this.camera.lookAt(new THREE.Vector3(0, 0, -18));

    this._setupLights();
    this._buildGround();
    this._buildRoads();
    this._buildBuildings();
    this._buildLandmarks();
    this._buildProps();
    this._buildCartoonPeople();
    this._buildNPCTraffic();

    // Stunts and extra scenery
    this._spawnRamps();
    this._spawnExtraHouses();
    this._spawnForestAnimals();
    this._createLandingEffect();

    this._createCar(this.activeCarKey);
    this._setupInput();
    this.resetCarStats();

    window.addEventListener('resize', () => {
      const pw = canvas.parentElement.clientWidth, ph = canvas.parentElement.clientHeight;
      this.camera.aspect = pw / ph; this.camera.updateProjectionMatrix();
      this.renderer.setSize(pw, ph);
    });

    this.lastTime = performance.now(); this._loop();
    console.log('CarzzGame3D initialized: scene, camera, renderer created');
    } catch (err) {
      console.error('Error during CarzzGame3D.init:', err);
      throw err;
    }
  }

  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a6b35, 0.5));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
    sun.position.set(80, 160, 60); sun.castShadow = true;
    const s = sun.shadow; s.mapSize.set(2048,2048);
    s.camera.left = -120; s.camera.right = 120; s.camera.top = 120; s.camera.bottom = -120;
    s.camera.near = 1; s.camera.far = 400; s.bias = -0.001;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  _buildGround() {
    const size = this.gridCount * this.spacing + 200;
    const geo = new THREE.PlaneGeometry(size * 2, size * 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.9 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xf5dd42 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xb0a898, roughness: 0.8 });
    const half = (this.gridCount * this.spacing) / 2;
    const roadLen = this.gridCount * this.spacing + 40;

    for (let i = 0; i <= this.gridCount; i++) {
      const pos = -half + i * this.spacing;
      // N-S road
      const rNS = new THREE.Mesh(new THREE.PlaneGeometry(this.roadW, roadLen), roadMat);
      rNS.rotation.x = -Math.PI / 2; rNS.position.set(pos, 0.02, 0); rNS.receiveShadow = true;
      this.scene.add(rNS);
      // Center line NS
      const cNS = new THREE.Mesh(new THREE.PlaneGeometry(0.2, roadLen), lineMat);
      cNS.rotation.x = -Math.PI / 2; cNS.position.set(pos, 0.03, 0); this.scene.add(cNS);
      // Sidewalks NS
      [-1,1].forEach(side => {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, roadLen), sidewalkMat);
        sw.position.set(pos + side * (this.roadW / 2 + 1.25), 0.075, 0);
        sw.receiveShadow = true; this.scene.add(sw);
      });

      // E-W road
      const rEW = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, this.roadW), roadMat);
      rEW.rotation.x = -Math.PI / 2; rEW.position.set(0, 0.02, pos); rEW.receiveShadow = true;
      this.scene.add(rEW);
      const cEW = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 0.2), lineMat);
      cEW.rotation.x = -Math.PI / 2; cEW.position.set(0, 0.03, pos); this.scene.add(cEW);
      [-1,1].forEach(side => {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(roadLen, 0.15, 2.5), sidewalkMat);
        sw.position.set(0, 0.075, pos + side * (this.roadW / 2 + 1.25));
        sw.receiveShadow = true; this.scene.add(sw);
      });

      // Crosswalks at intersections
      for (let j = 0; j <= this.gridCount; j++) {
        const iz = -half + j * this.spacing;
        for (let s = -2; s <= 2; s++) {
          const cw = new THREE.Mesh(new THREE.PlaneGeometry(0.5, this.roadW * 0.8), whiteMat);
          cw.rotation.x = -Math.PI / 2; cw.position.set(pos + s * 1.2, 0.035, iz); this.scene.add(cw);
          const cw2 = new THREE.Mesh(new THREE.PlaneGeometry(this.roadW * 0.8, 0.5), whiteMat);
          cw2.rotation.x = -Math.PI / 2; cw2.position.set(pos, 0.035, iz + s * 1.2); this.scene.add(cw2);
        }
      }
    }
  }

  _createBuildingTexture(baseColor, floors, cols) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
    const c = cv.getContext('2d');
    c.fillStyle = baseColor; c.fillRect(0, 0, 256, 512);
    const ww = 220 / cols, wh = 480 / floors, m = 3;
    for (let r = 0; r < floors; r++) {
      for (let k = 0; k < cols; k++) {
        const lit = Math.random() > 0.35;
        c.fillStyle = lit ? (Math.random()>0.5 ? '#ffe8a0' : '#c8deff') : '#1a1a2e';
        c.fillRect(18 + k * ww + m, 16 + r * wh + m, ww - m * 2, wh - m * 2);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
  }

  _buildBuildings() {
    const half = (this.gridCount * this.spacing) / 2;
    const palette = ['#5c6370','#7a6e60','#8090a0','#606878','#a09080','#556070','#6a7a88'];

    for (let bx = 0; bx < this.gridCount; bx++) {
      for (let bz = 0; bz < this.gridCount; bz++) {
        const cx = -half + this.roadW / 2 + 2.5 + bx * this.spacing + this.blockSize / 2;
        const cz = -half + this.roadW / 2 + 2.5 + bz * this.spacing + this.blockSize / 2;
        const distFromCenter = Math.sqrt(cx * cx + cz * cz);
        const numBuildings = 1 + Math.floor(Math.random() * 3);

        for (let b = 0; b < numBuildings; b++) {
          const maxH = distFromCenter < 100 ? 90 : (distFromCenter < 180 ? 55 : 30);
          const h = 12 + Math.random() * maxH;
          const bw = 8 + Math.random() * (this.blockSize / numBuildings - 10);
          const bd = 8 + Math.random() * (this.blockSize / numBuildings - 10);
          const ox = (b - numBuildings / 2 + 0.5) * (this.blockSize / numBuildings);
          const px = cx + ox * 0.8, pz = cz + (Math.random() - 0.5) * 10;

          const baseCol = palette[Math.floor(Math.random() * palette.length)];
          const floors = Math.max(3, Math.floor(h / 4));
          const cols = Math.max(2, Math.floor(bw / 4));
          const tex = this._createBuildingTexture(baseCol, floors, cols);

          const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
          const geo = new THREE.BoxGeometry(bw, h, bd);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(px, h / 2, pz);
          mesh.castShadow = true; mesh.receiveShadow = true;
          this.scene.add(mesh);

          this.buildingData.push({ x: px, z: pz, hw: bw / 2 + 1.5, hd: bd / 2 + 1.5 });

          // Roof detail for tall buildings
          if (h > 40 && Math.random() > 0.4) {
            const antennaGeo = new THREE.CylinderGeometry(0.15, 0.15, h * 0.15);
            const ant = new THREE.Mesh(antennaGeo, new THREE.MeshStandardMaterial({ color: 0x888888 }));
            ant.position.set(px, h + h * 0.075, pz); this.scene.add(ant);
            const blinkGeo = new THREE.SphereGeometry(0.3);
            const blinkMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
            const blink = new THREE.Mesh(blinkGeo, blinkMat);
            blink.position.set(px, h + h * 0.15, pz); this.scene.add(blink);
          }
        }
      }
    }
  }

  _buildProps() {
    const half = (this.gridCount * this.spacing) / 2;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d7d3a });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffeecc, emissive: 0xffeeaa, emissiveIntensity: 0.6 });
    const tlBodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

    // helper: if a position is too close to a road centerline, push it to the sidewalk
    const roadLines = [];
    for (let i = 0; i <= this.gridCount; i++) roadLines.push(-half + i * this.spacing);
    const pushOffRoad = (x, z) => {
      // check for closeness to any road line in X or Z and push away to sidewalk
      for (const line of roadLines) {
        // too close to N-S road line (x ~= line)
        if (Math.abs(x - line) < this.roadW / 2 + 0.6) {
          const dir = x >= line ? 1 : -1;
          x = line + dir * (this.roadW / 2 + 3.5 + Math.random() * 1.5);
        }
        // too close to E-W road line (z ~= line)
        if (Math.abs(z - line) < this.roadW / 2 + 0.6) {
          const dir2 = z >= line ? 1 : -1;
          z = line + dir2 * (this.roadW / 2 + 3.5 + Math.random() * 1.5);
        }
      }
      return [x, z];
    };

    for (let i = 0; i <= this.gridCount; i++) {
      const pos = -half + i * this.spacing;
      for (let j = 0; j <= this.gridCount; j++) {
        const pos2 = -half + j * this.spacing;
        // Street lights along roads
        if (j % 2 === 0) {
          [-1, 1].forEach(side => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7), poleMat);
            pole.position.set(pos + side * (this.roadW / 2 + 4), 3.5, pos2);
            pole.castShadow = true; this.scene.add(pole);
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4), lampMat);
            lamp.position.set(pos + side * (this.roadW / 2 + 4), 7.2, pos2); this.scene.add(lamp);
          });
        }
        // Traffic lights at intersections
        if (i < this.gridCount && j < this.gridCount && Math.random() > 0.5) {
          const tlGroup = new THREE.Group();
          const tlPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.5), poleMat);
          tlPole.position.y = 2.75; tlGroup.add(tlPole);
          const tlBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.4), tlBodyMat);
          tlBox.position.y = 5.6; tlGroup.add(tlBox);
          [0xff0000, 0xffaa00, 0x00ff00].forEach((c, idx) => {
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12),
              new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: idx === 2 ? 1 : 0.2 }));
            bulb.position.set(0, 6.0 - idx * 0.35, 0.22); tlGroup.add(bulb);
          });
          tlGroup.position.set(pos + this.roadW / 2 + 1, 0, pos2 + this.roadW / 2 + 1);
          this.scene.add(tlGroup);
        }
      }
      // Trees between blocks
      for (let t = 0; t < 3; t++) {
        const tz0 = -half + (Math.random() * this.gridCount) * this.spacing + this.spacing / 2;
        [-1, 1].forEach(side => {
          const treeG = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3), trunkMat);
          trunk.position.y = 1.5; treeG.add(trunk);
          const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 6), leafMat);
          leaves.position.y = 5; leaves.castShadow = true; treeG.add(leaves);
          // ensure tree is at sidewalk offset and not on road
          const baseX = pos + side * (this.roadW / 2 + 3.5);
          const [tx, tz] = pushOffRoad(baseX, tz0);
          treeG.position.set(tx, 0, tz);
          this.scene.add(treeG);
        });
      }
    }
    // Park area (center)
    for (let p = 0; p < 20; p++) {
      let tx = (Math.random() - 0.5) * 40, tz = (Math.random() - 0.5) * 40;
      [tx, tz] = pushOffRoad(tx, tz);
      const treeG = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4), trunkMat);
      trunk.position.y = 2; treeG.add(trunk);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.5 + Math.random(), 6, 6), leafMat);
      leaves.position.y = 5.5; leaves.castShadow = true; treeG.add(leaves);
      treeG.position.set(tx, 0, tz); this.scene.add(treeG);
    }
  }

  _buildLandmarks() {
    const half = (this.gridCount * this.spacing) / 2;
    const landmarkMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f2f0, roughness: 0.4, metalness: 0.05 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6, metalness: 0.2 });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d7d3a });
    const roadLines = [];
    for (let i = 0; i <= this.gridCount; i++) roadLines.push(-half + i * this.spacing);
    const pushOffRoadLocal = (x, z) => {
      for (const line of roadLines) {
        if (Math.abs(x - line) < this.roadW / 2 + 0.6) {
          const dir = x >= line ? 1 : -1;
          x = line + dir * (this.roadW / 2 + 6 + Math.random() * 4);
        }
        if (Math.abs(z - line) < this.roadW / 2 + 0.6) {
          const dir2 = z >= line ? 1 : -1;
          z = line + dir2 * (this.roadW / 2 + 6 + Math.random() * 4);
        }
      }
      return [x, z];
    };

    const makeLandmark = (x, z, w, d, h, color) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.set(x, h / 2, z);
      this.scene.add(mesh);
      this.buildingData.push({ x, z, hw: w / 2 + 1.5, hd: d / 2 + 1.5 });
      return mesh;
    };

    makeLandmark(-130, -130, 32, 48, 18, 0x7c3aed); // mall
    makeLandmark(130, -130, 30, 40, 16, 0xff5b7f); // hospital
    makeLandmark(-130, 130, 36, 44, 20, 0x38bdf8); // college
    makeLandmark(130, 130, 42, 42, 22, 0xfacc15); // stadium
    makeLandmark(0, 130, 24, 28, 14, 0x2563eb); // police station

    const airportX = 140, airportZ = 0;
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(20, 90), runwayMat);
    runway.rotation.x = -Math.PI / 2; runway.position.set(airportX, 0.02, airportZ);
    this.scene.add(runway);
    const runwayLines = new THREE.Mesh(new THREE.PlaneGeometry(2, 90), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    runwayLines.rotation.x = -Math.PI / 2; runwayLines.position.set(airportX, 0.03, airportZ);
    this.scene.add(runwayLines);

    const hangar = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 24), landmarkMaterial);
    hangar.position.set(airportX - 20, 6, airportZ - 6);
    hangar.castShadow = true; hangar.receiveShadow = true;
    this.scene.add(hangar);
    const hangarDoor = new THREE.Mesh(new THREE.BoxGeometry(38, 10, 2), trimMat);
    hangarDoor.position.set(airportX - 40, 5, airportZ - 6);
    this.scene.add(hangarDoor);
    this.buildingData.push({ x: airportX - 20, z: airportZ - 6, hw: 20, hd: 12 });

    const terminal = makeLandmark(airportX + 30, 20, 24, 20, 14, 0xef4444);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 22, 8), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }));
    tower.position.set(airportX + 18, 11, 20); tower.castShadow = true; this.scene.add(tower);
    this.buildingData.push({ x: airportX + 18, z: 20, hw: 6, hd: 6 });

    const addPlane = (x, y, z, scale, yaw) => {
      const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * scale, 0.6 * scale, 6 * scale, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      fuselage.rotation.z = Math.PI / 2; fuselage.position.set(x, y, z);
      fuselage.castShadow = true; this.scene.add(fuselage);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(8 * scale, 0.2 * scale, 1.3 * scale), new THREE.MeshStandardMaterial({ color: 0xebf8ff, roughness: 0.4 }));
      wing.position.set(x, y, z); wing.rotation.y = yaw; wing.castShadow = true; this.scene.add(wing);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 1.2 * scale, 1.8 * scale), new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.4 }));
      tail.position.set(x - 2.5 * scale, y + 0.7 * scale, z); tail.rotation.y = yaw; tail.castShadow = true; this.scene.add(tail);
    };

    addPlane(airportX + 10, 2, airportZ + 12, 0.9, 0);
    addPlane(airportX - 18, 6, airportZ - 20, 0.7, Math.PI / 12);
    addPlane(airportX + 24, 10, airportZ + 28, 0.6, -Math.PI / 8);

    const outerRoad = new THREE.Mesh(new THREE.PlaneGeometry(14, 130), roadMat);
    outerRoad.rotation.x = -Math.PI / 2; outerRoad.position.set(0, 0.02, half + 65);
    this.scene.add(outerRoad);
    const outerLine = new THREE.Mesh(new THREE.PlaneGeometry(2, 130), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    outerLine.rotation.x = -Math.PI / 2; outerLine.position.set(0, 0.03, half + 65);
    this.scene.add(outerLine);
    this.buildingData.push({ x: 0, z: half + 65, hw: 8, hd: 65 });

    for (let i = 0; i < 40; i++) {
      let tx = (Math.random() - 0.5) * 260;
      let tz = half + 90 + Math.random() * 80;
      [tx, tz] = pushOffRoadLocal(tx, tz);
      const tree = new THREE.Group();
      const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.5), trunkMat);
      trunk2.position.y = 1.25; tree.add(trunk2);
      const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4, 5), leafMat);
      leaves2.position.y = 4; leaves2.castShadow = true; tree.add(leaves2);
      tree.position.set(tx, 0, tz); this.scene.add(tree);
    }
  }

  _createLandingEffect() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.03;
    mesh.visible = false;
    this.scene.add(mesh);
    this.landEffect = mesh;
  }

  _buildCartoonPeople() {
    const half = (this.gridCount * this.spacing) / 2;
    const skinColors = [0xf5c5a3, 0xd4a373, 0x8d5524, 0xffe0bd, 0xc68642];
    const shirtColors = [0xff3b5c, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0xec4899, 0x06b6d4, 0xff6b35];
    const pantColors = [0x1e3a5f, 0x333333, 0x4a2c2a, 0x1a1a2e];

    for (let i = 0; i < 140; i++) {
      const person = new THREE.Group();
      const skinC = skinColors[Math.floor(Math.random() * skinColors.length)];
      const shirtC = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      const pantC = pantColors[Math.floor(Math.random() * pantColors.length)];
      const skinMat = new THREE.MeshStandardMaterial({ color: skinC });
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtC });
      const pantMat = new THREE.MeshStandardMaterial({ color: pantC });

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), skinMat);
      head.position.y = 1.65; head.castShadow = true; person.add(head);
      // Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      [-0.08, 0.08].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat);
        eye.position.set(ex, 1.7, 0.22); person.add(eye);
      });
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.25), shirtMat);
      body.position.y = 1.15; body.castShadow = true; person.add(body);
      // Legs
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), pantMat);
      leftLeg.position.set(-0.09, 0.63, 0); person.add(leftLeg);
      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), pantMat);
      rightLeg.position.set(0.09, 0.63, 0); person.add(rightLeg);
      // Arms
      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), skinMat);
      leftArm.position.set(-0.27, 1.1, 0); person.add(leftArm);
      const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), skinMat);
      rightArm.position.set(0.27, 1.1, 0); person.add(rightArm);

      // Place near sidewalks/buildings
      const roadIdx = Math.floor(Math.random() * (this.gridCount + 1));
      const roadPos = -half + roadIdx * this.spacing;
      const side = Math.random() > 0.5 ? 1 : -1;
      const along = -half + Math.random() * (this.gridCount * this.spacing);
      const axis = Math.random() > 0.5 ? 'x' : 'z';
      if (axis === 'x') {
        person.position.set(roadPos + side * (this.roadW / 2 + 1.5), 0, along);
        person.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        person.position.set(along, 0, roadPos + side * (this.roadW / 2 + 1.5));
        person.rotation.y = side > 0 ? Math.PI : 0;
      }

      this.scene.add(person);
      this.cartoonPeople.push({ group: person, leftLeg, rightLeg, leftArm, rightArm, phase: Math.random() * Math.PI * 2, walkSpeed: 1.5 + Math.random() * 2 });
    }
  }

  _buildNPCTraffic() {
    const half = (this.gridCount * this.spacing) / 2;
    const vehicleColors = [0xffcc00, 0x2255cc, 0xcc3333, 0x33aa33, 0xffffff, 0xff8800, 0x8b5cf6, 0x10b981];
    const makeVehicle = (type, color) => {
      const npc = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 });
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.75 });
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      if (type === 'bus') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 6), bodyMat);
        body.position.y = 0.55; npc.add(body);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 3.2), cabinMat);
        cabin.position.set(0, 0.9, -0.5); npc.add(cabin);
      } else if (type === 'truck') {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 3), bodyMat);
        cab.position.set(-1.5, 0.5, 0); npc.add(cab);
        const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.6 }));
        trailer.position.set(1.2, 0.45, 0); npc.add(trailer);
      } else if (type === 'bike') {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 1.0), bodyMat);
        seat.position.y = 0.4; npc.add(seat);
        const front = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 8), bodyMat);
        front.rotation.z = Math.PI/2; front.position.set(0.5, 0.25, 0); npc.add(front);
        const back = front.clone(); back.position.set(-0.5, 0.25, 0); npc.add(back);
      } else {
        const carBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 3.5), bodyMat);
        carBody.position.y = 0.5; carBody.castShadow = true; npc.add(carBody);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.8), cabinMat);
        cabin.position.y = 0.95; npc.add(cabin);
      }
      const wheels = type === 'bike' ? [[0.5,0.2,0],[-0.5,0.2,0]] : [[-0.75,0.3,1.0],[0.75,0.3,1.0],[-0.75,0.3,-1.0],[0.75,0.3,-1.0]];
      wheels.forEach(([wx,wy,wz]) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 8), wheelMat);
        w.rotation.z = Math.PI / 2; w.position.set(wx, wy, wz); npc.add(w);
      });
      return npc;
    };

    for (let n = 0; n < 60; n++) {
      const type = ['car','car','bus','truck','bike'][Math.floor(Math.random() * 5)];
      const color = vehicleColors[Math.floor(Math.random() * vehicleColors.length)];
      const npc = makeVehicle(type, color);
      const roadIdx = Math.floor(Math.random() * (this.gridCount + 1));
      const roadPos = -half + roadIdx * this.spacing;
      const along = -half + Math.random() * (this.gridCount * this.spacing);
      const lane = (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 2);
      const isNS = Math.random() > 0.5;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const speed = 5 + Math.random() * 10 + (type === 'bike' ? -1 : type === 'truck' ? 2 : type === 'bus' ? 1 : 0);

      if (isNS) {
        npc.position.set(roadPos + lane, 0, along);
        npc.rotation.y = dir > 0 ? 0 : Math.PI;
      } else {
        npc.position.set(along, 0, roadPos + lane);
        npc.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      this.scene.add(npc);
      this.npcCars.push({ group: npc, isNS, dir, speed, roadPos, lane, halfExtent: half + 20 });
    }
  }

  _spawnRamps() {
    // Simple ramps placed near roads and open areas (avoid road centerlines)
    const half = (this.gridCount * this.spacing) / 2;
    const roadLines = [];
    for (let i = 0; i <= this.gridCount; i++) roadLines.push(-half + i * this.spacing);
    const pushOffRoadLocal = (x, z) => {
      for (const line of roadLines) {
        if (Math.abs(x - line) < this.roadW / 2 + 0.6) {
          const dir = x >= line ? 1 : -1;
          x = line + dir * (this.roadW / 2 + 6 + Math.random() * 4);
        }
        if (Math.abs(z - line) < this.roadW / 2 + 0.6) {
          const dir2 = z >= line ? 1 : -1;
          z = line + dir2 * (this.roadW / 2 + 6 + Math.random() * 4);
        }
      }
      return [x, z];
    };

    const pts = [ {x: 0, z: -50, w: 6}, {x: 60, z: -10, w: 6}, {x: -80, z: 40, w: 8}, {x: 120, z: 80, w: 10} ];
    pts.forEach(p => {
      let [px, pz] = pushOffRoadLocal(p.x, p.z);
      const rampGeo = new THREE.BoxGeometry(p.w, 0.4, 6);
      const rampMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0.1, roughness: 0.7 });
      const ramp = new THREE.Mesh(rampGeo, rampMat);
      ramp.position.set(px, 0.2, pz);
      ramp.rotation.x = -Math.PI * 0.12;
      ramp.receiveShadow = true; ramp.castShadow = true;
      this.scene.add(ramp);
      this.ramps.push({ x: px, z: pz, width: p.w, mesh: ramp });
    });

    // rooftop / elevated ramp for opportunistic stunts
    const roofRamp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0.1, roughness: 0.7 }));
    let [rrx, rrz] = pushOffRoadLocal(120, -8);
    roofRamp.position.set(rrx, 12.2, rrz);
    roofRamp.rotation.x = -Math.PI * 0.15;
    roofRamp.receiveShadow = true; roofRamp.castShadow = true;
    this.scene.add(roofRamp);
    this.ramps.push({ x: 120, z: -8, width: 6, mesh: roofRamp });

    // Big gap ramps: launcher + landing to jump between buildings/rooftops
    const addGapRamps = (lx, lz, rx, rz, elev = 8, w = 8, len = 12) => {
      [lx, lz] = pushOffRoadLocal(lx, lz);
      [rx, rz] = pushOffRoadLocal(rx, rz);
      const rampMat = new THREE.MeshStandardMaterial({ color: 0x7a4a28, metalness: 0.1, roughness: 0.6 });
      const leftGeo = new THREE.BoxGeometry(w, 0.5, len);
      const rightGeo = new THREE.BoxGeometry(w, 0.5, len);
      const left = new THREE.Mesh(leftGeo, rampMat.clone());
      const right = new THREE.Mesh(rightGeo, rampMat.clone());
      left.position.set(lx, elev, lz);
      right.position.set(rx, elev, rz);
      // tilt up towards the gap
      left.rotation.x = -Math.PI * 0.25; right.rotation.x = Math.PI * 0.25;
      left.receiveShadow = true; left.castShadow = true; right.receiveShadow = true; right.castShadow = true;
      this.scene.add(left); this.scene.add(right);
      this.ramps.push({ x: lx, z: lz, width: w, mesh: left });
      this.ramps.push({ x: rx, z: rz, width: w, mesh: right });
    };

    // center gap pair (perfect for long jumps)
    addGapRamps(-30, 30, 30, 30, 10, 9, 14);
    // airport stunt inside/near hangar
    addGapRamps(132, -6, 160, -6, 6, 8, 12);
    // a dramatic elevated pair connecting small rooftop area
    addGapRamps(50, 100, 90, 100, 12, 10, 16);
  }

  _spawnExtraHouses() {
    // Add simple 3D houses in green park area
    const half = (this.gridCount * this.spacing) / 2;
    const startX = -60, startZ = -60;
    // spread houses across a few clusters: park, small suburb, near airport approach
    const roadLines = [];
    for (let i = 0; i <= this.gridCount; i++) roadLines.push(-half + i * this.spacing);
    const pushOffRoadLocal = (x, z) => {
      for (const line of roadLines) {
        if (Math.abs(x - line) < this.roadW / 2 + 0.6) {
          const dir = x >= line ? 1 : -1;
          x = line + dir * (this.roadW / 2 + 4 + Math.random() * 4);
        }
        if (Math.abs(z - line) < this.roadW / 2 + 0.6) {
          const dir2 = z >= line ? 1 : -1;
          z = line + dir2 * (this.roadW / 2 + 4 + Math.random() * 4);
        }
      }
      return [x, z];
    };

    for (let i = 0; i < 30; i++) {
      const cluster = i % 3;
      const baseX = cluster === 0 ? startX : cluster === 1 ? 20 : -100;
      const baseZ = cluster === 0 ? startZ : cluster === 1 ? 30 : 120;
      let hx = baseX + (i % 6) * 12 + (Math.random() - 0.5) * 8;
      let hz = baseZ + Math.floor(i / 6) * 10 + (Math.random() - 0.5) * 8;
      [hx, hz] = pushOffRoadLocal(hx, hz);
      const h = 3.5 + Math.random() * 3;
      const house = new THREE.Mesh(new THREE.BoxGeometry(6, h, 6), new THREE.MeshStandardMaterial({ color: 0xd9c3a3 }));
      house.position.set(hx, h / 2, hz);
      this.scene.add(house);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 4.5, 2, 4), new THREE.MeshStandardMaterial({ color: 0x7a2b2b }));
      roof.rotation.y = Math.PI / 4; roof.position.set(hx, h + 1, hz); this.scene.add(roof);
      this.extraHouses.push(house);
    }
  }

  _spawnForestAnimals() {
    // More varied animals as moving primitives in outer green space (spawn off main roads)
    const half = (this.gridCount * this.spacing) / 2;
    const roadLines = [];
    for (let i = 0; i <= this.gridCount; i++) roadLines.push(-half + i * this.spacing);
    const pushOffRoadLocal = (x, z) => {
      for (const line of roadLines) {
        if (Math.abs(x - line) < this.roadW / 2 + 0.6) {
          const dir = x >= line ? 1 : -1;
          x = line + dir * (this.roadW / 2 + 8 + Math.random() * 8);
        }
        if (Math.abs(z - line) < this.roadW / 2 + 0.6) {
          const dir2 = z >= line ? 1 : -1;
          z = line + dir2 * (this.roadW / 2 + 8 + Math.random() * 8);
        }
      }
      return [x, z];
    };

    for (let i = 0; i < 30; i++) {
      let ax = (Math.random() - 0.5) * (this.gridCount * this.spacing) * 1.6;
      let az = (Math.random() - 0.5) * (this.gridCount * this.spacing) * 1.6 + (this.gridCount * this.spacing);
      [ax, az] = pushOffRoadLocal(ax, az);
      const kind = Math.random();
      let mesh;
      if (kind < 0.45) {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random() * 0.6, 8, 8), new THREE.MeshStandardMaterial({ color: 0x553311 }));
      } else if (kind < 0.8) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x6b3f26 }));
      } else {
        mesh = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x4b2e1b }));
      }
      mesh.position.set(ax, 0.5 + Math.random() * 0.3, az);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.forestAnimals.push({ mesh, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.8 });
    }
  }

  spawnPolice() {
    if (this.policeActive) return; // only one
    const pc = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 3.6), new THREE.MeshStandardMaterial({ color: 0x222244 }));
    body.position.y = 0.5; pc.add(body);
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 }));
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000ff }));
    lightL.position.set(-0.4, 0.9, 0); lightR.position.set(0.4, 0.9, 0); pc.add(lightL); pc.add(lightR);
    pc.position.set(this.carGroup.position.x + 40, 0, this.carGroup.position.z + 40);
    pc.rotation.y = 0; pc.userData = { speed: this.policeSpeed };
    this.scene.add(pc);
    this.policeCar = pc; this.policeActive = true; this.policeTimer = 0;
  }

  _onCaught() {
    // Reset the game when caught by police
    try { window.location.reload(); } catch (e) { /* fallback */ }
  }

  _createCar(carKey) {
    if (this.carGroup) this.scene.remove(this.carGroup);
    this.carGroup = window.buildCar3D(carKey);
    if (!this.carGroup) return;
    this.carGroup.position.set(0, 0, -30);
    this.carAngle = 0; this.carSpeed = 0;
    this.carGroup.rotation.y = this.carAngle;
    this.scene.add(this.carGroup);
  }

  _setupInput() {
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }

  resetCarStats() {
    const c = window.CAR_CONFIGS[this.activeCarKey];
    if (!c) return;
    this.maxSpeed = 25 + c.stats.speed * 4;
    this.accel = 8 + c.stats.acceleration * 2;
    this.handlingFactor = 1.2 + c.stats.handling * 0.15;
  }

  setCar(carKey) {
    if (!window.CAR_CONFIGS[carKey]) return;
    this.activeCarKey = carKey;
    this._createCar(carKey); this.resetCarStats();
    document.documentElement.style.setProperty('--car-theme-color', '#' + window.CAR_CONFIGS[carKey].bodyColor.toString(16).padStart(6, '0'));
    if (this.isEngineStarted && window.carzzAudio) {
      window.carzzAudio.stopEngine();
      setTimeout(() => { if (this.isEngineStarted) window.carzzAudio.startEngine(); }, 100);
    }
  }

  toggleEngine() {
    this.isEngineStarted = !this.isEngineStarted;
    if (this.isEngineStarted) { if (window.carzzAudio) window.carzzAudio.startEngine(); }
    else { if (window.carzzAudio) window.carzzAudio.stopEngine(); this.carSpeed = 0; }
    return this.isEngineStarted;
  }

  _checkCollision(nx, nz) {
    for (const b of this.buildingData) {
      if (Math.abs(nx - b.x) < b.hw && Math.abs(nz - b.z) < b.hd) return true;
    }
    return false;
  }

  _loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsedTime += dt;
    this._update(dt);
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(() => this._loop());
  }

  _update(dt) {
    const gas = this.keys['ArrowUp'] || this.keys['KeyW'] || this.uiControls.accelerating;
    const brk = this.keys['ArrowDown'] || this.keys['KeyS'] || this.keys['Space'] || this.uiControls.braking;
    const stL = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.uiControls.steeringLeft;
    const stR = this.keys['ArrowRight'] || this.keys['KeyD'] || this.uiControls.steeringRight;

    if (this.isEngineStarted) {
      if (gas && !brk) this.carSpeed += this.accel * dt;
      else if (brk) this.carSpeed -= this.brakeForce * dt;
      else this.carSpeed -= this.friction * dt * (this.carSpeed > 0 ? 1 : -1);
    } else {
      this.carSpeed *= 0.95;
    }
    this.carSpeed = Math.max(-8, Math.min(this.carSpeed, this.maxSpeed));
    if (Math.abs(this.carSpeed) < 0.1 && !gas) this.carSpeed = 0;

    const spdRatio = Math.abs(this.carSpeed) / this.maxSpeed;
    const steerAmt = this.handlingFactor * dt * Math.min(1, spdRatio * 3);
    if (stL) { this.carAngle += steerAmt; this.steerOffset = Math.max(-1, this.steerOffset - 5 * dt); }
    else if (stR) { this.carAngle -= steerAmt; this.steerOffset = Math.min(1, this.steerOffset + 5 * dt); }
    else {
      if (this.steerOffset > 0) this.steerOffset = Math.max(0, this.steerOffset - 4 * dt);
      if (this.steerOffset < 0) this.steerOffset = Math.min(0, this.steerOffset + 4 * dt);
    }

    // Ramps: if on ground and near ramp with enough speed, launch
    if (this.carGroup && !this.airborne) {
      for (const r of this.ramps) {
        const dx = this.carGroup.position.x - r.x; const dz = this.carGroup.position.z - r.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < Math.max(r.width, 3) && Math.abs(this.carSpeed) > 8 && this.carGroup.position.y <= 0.5) {
          this.airborne = true; this.carVertVel = Math.min(18, Math.abs(this.carSpeed) * 0.6);
          // give a small forward boost
          this.carSpeed = Math.min(this.maxSpeed, this.carSpeed + 6);
          break;
        }
      }
    }

    // Update vertical position if airborne
    if (this.airborne && this.carGroup) {
      this.carVertVel -= this.gravity * dt;
      this.carGroup.position.y += this.carVertVel * dt;
      if (this.carGroup.position.y <= 0) {
        // landed
        this.carGroup.position.y = 0; this.airborne = false; this.carVertVel = 0;
        // heavy landing slows the car
        if (Math.abs(this.carVertVel) > 6) this.carSpeed *= 0.7;
        if (this.landEffect) {
          this.landEffect.position.set(this.carGroup.position.x, 0.03, this.carGroup.position.z);
          this.landEffect.visible = true;
          this.landEffect.material.opacity = 0.9;
          this.landEffect.scale.set(1, 1, 1);
          this.landEffectTimer = 0.35;
        }
      }
    }

    if (this.carGroup) {
      const nx = this.carGroup.position.x + Math.sin(this.carAngle) * this.carSpeed * dt;
      const nz = this.carGroup.position.z + Math.cos(this.carAngle) * this.carSpeed * dt;
      if (!this.airborne) {
        if (!this._checkCollision(nx, nz)) {
          this.carGroup.position.x = nx; this.carGroup.position.z = nz;
        } else { this.carSpeed *= -0.3; }
      } else {
        // allow free flight over obstacles
        this.carGroup.position.x = nx; this.carGroup.position.z = nz;
      }
      this.carGroup.rotation.y = this.carAngle;

      // Wheel rotation
      const wheelRot = this.carSpeed * dt * 3;
      this.carGroup.userData.wheels.forEach(w => { w.children[0].rotation.x += wheelRot; w.children[1].rotation.x += wheelRot; });

      // Brake lights
      this.carGroup.userData.taillightMats.forEach(m => {
        m.emissive.setHex(brk ? 0xff0000 : 0x440000);
        m.emissiveIntensity = brk ? 2 : 0.3;
      });

      // Camera follow
      const camDist = 10 + spdRatio * 4;
      const camH = 4 + spdRatio * 2;
      const idealX = this.carGroup.position.x - Math.sin(this.carAngle) * camDist;
      const idealZ = this.carGroup.position.z - Math.cos(this.carAngle) * camDist;
      const idealY = camH;
      this.camera.position.x += (idealX - this.camera.position.x) * 3 * dt;
      this.camera.position.y += (idealY - this.camera.position.y) * 3 * dt;
      this.camera.position.z += (idealZ - this.camera.position.z) * 3 * dt;
      const lookTarget = new THREE.Vector3(
        this.carGroup.position.x + Math.sin(this.carAngle) * 8,
        1.5,
        this.carGroup.position.z + Math.cos(this.carAngle) * 8
      );
      this.camera.lookAt(lookTarget);

      // Shadow follow
      if (this.sun) {
        this.sun.target.position.copy(this.carGroup.position); this.sun.target.updateMatrixWorld();
        this.sun.position.set(this.carGroup.position.x + 80, 160, this.carGroup.position.z + 60);
      }
    }

    // Audio
    if (window.carzzAudio && this.isEngineStarted) {
      window.carzzAudio.update(spdRatio, gas ? 1 : 0, brk ? 1 : 0);
    }

    // HUD
    const speedKmh = Math.floor(Math.abs(this.carSpeed) * 3.6);
    const rpm = Math.floor(1000 + spdRatio * 7000);
    const spEl = document.getElementById('speed-val'), rpEl = document.getElementById('rpm-val');
    if (spEl) spEl.textContent = speedKmh;
    if (rpEl) rpEl.textContent = rpm;
    const wheelEl = document.getElementById('virtual-wheel');
    if (wheelEl) wheelEl.style.transform = `rotate(${this.steerOffset * 80}deg)`;

    // Animate cartoon people walking and handle being hit
    this.cartoonPeople.forEach(p => {
      if (!p.fallen) {
        const swing = Math.sin(this.elapsedTime * p.walkSpeed + p.phase) * 0.3;
        p.leftLeg.rotation.x = swing;
        p.rightLeg.rotation.x = -swing;
        p.leftArm.rotation.x = -swing * 0.7;
        p.rightArm.rotation.x = swing * 0.7;
        p.group.position.y = Math.abs(Math.sin(this.elapsedTime * p.walkSpeed * 2 + p.phase)) * 0.05;
        // collision with car
        if (this.carGroup && !this.airborne) {
          const dx = this.carGroup.position.x - p.group.position.x;
          const dz = this.carGroup.position.z - p.group.position.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          if (dist < 2.2) {
            p.fallen = true; p.fallTimer = 0; // make them fall
            // spawn police when hit
            this.spawnPolice();
            // small knockback
            this.carSpeed *= 0.6;
          }
        }
      } else {
        p.fallTimer += dt;
        const t = Math.min(1, p.fallTimer * 3);
        p.group.rotation.x = Math.min(Math.PI / 2, t * Math.PI / 2 + 0.1);
        p.group.position.y = Math.max(0, 1 - t * 0.9);
        p.leftArm.rotation.x = -1.2 + t * 0.8;
        p.rightArm.rotation.x = 1.2 - t * 0.8;
        p.leftLeg.rotation.x = 0.5 - t * 0.9;
        p.rightLeg.rotation.x = -0.5 + t * 0.9;
      }
    });

    // Animate NPC traffic cars
    this.npcCars.forEach(npc => {
      if (npc.isNS) {
        npc.group.position.z += npc.dir * npc.speed * dt;
        if (npc.group.position.z > npc.halfExtent) npc.group.position.z = -npc.halfExtent;
        if (npc.group.position.z < -npc.halfExtent) npc.group.position.z = npc.halfExtent;
      } else {
        npc.group.position.x += npc.dir * npc.speed * dt;
        if (npc.group.position.x > npc.halfExtent) npc.group.position.x = -npc.halfExtent;
        if (npc.group.position.x < -npc.halfExtent) npc.group.position.x = npc.halfExtent;
      }
    });

    // Police chase logic
    if (this.policeActive && this.policeCar && this.carGroup) {
      this.policeTimer += dt;
      const dx = this.carGroup.position.x - this.policeCar.position.x;
      const dz = this.carGroup.position.z - this.policeCar.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 3) {
        this._onCaught(); return;
      }
      const dirX = dx / dist, dirZ = dz / dist;
      const speedBoost = 1 + Math.min(0.7, Math.abs(this.carSpeed) / this.maxSpeed);
      const ps = (this.policeCar.userData.speed || this.policeSpeed) * speedBoost;
      this.policeCar.position.x += dirX * ps * dt;
      this.policeCar.position.z += dirZ * ps * dt;
      this.policeCar.rotation.y = Math.atan2(-dirZ, dirX);
      this.policeCar.children.forEach((child, idx) => {
        if (child.material && child.material.emissive) {
          child.material.emissiveIntensity = 1.2 + Math.sin(this.elapsedTime * 25 + idx) * 0.7;
        }
      });
      if (this.policeTimer > this.policeChaseDuration) {
        this.policeActive = false;
        if (this.policeCar) { this.scene.remove(this.policeCar); this.policeCar = null; }
      }
    }

    if (this.landEffect && this.landEffectTimer !== undefined) {
      this.landEffectTimer -= dt;
      if (this.landEffectTimer <= 0) {
        this.landEffect.visible = false;
      } else {
        const t = 1 - this.landEffectTimer / 0.35;
        this.landEffect.material.opacity = Math.max(0, this.landEffectTimer / 0.35 * 0.9);
        const scale = 1 + t * 1.8;
        this.landEffect.scale.set(scale, scale, scale);
      }
    }

    // Animate forest animals
    this.forestAnimals.forEach(a => {
      a.phase += dt * 0.5;
      a.mesh.position.x += Math.cos(a.phase) * dt * a.speed * 0.3;
      a.mesh.position.z += Math.sin(a.phase) * dt * a.speed * 0.3;
    });

    // Minimap
    this._drawMinimap();
  }

  _drawMinimap() {
    const mc = document.getElementById('minimapCanvas');
    if (!mc) return;
    const ctx = mc.getContext('2d');
    const s = mc.width, half = (this.gridCount * this.spacing) / 2;
    ctx.clearRect(0, 0, s, s);
    // Background
    ctx.fillStyle = '#1a2a1a'; ctx.fillRect(0, 0, s, s);
    // Roads
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    for (let i = 0; i <= this.gridCount; i++) {
      const p = (i * this.spacing / (half * 2)) * s + s / 2 - (this.spacing * this.gridCount / (half * 4)) * s;
      const mp = ((i * this.spacing) / (this.gridCount * this.spacing)) * (s - 20) + 10;
      ctx.beginPath(); ctx.moveTo(mp, 0); ctx.lineTo(mp, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mp); ctx.lineTo(s, mp); ctx.stroke();
    }
    // Buildings
    ctx.fillStyle = '#444';
    this.buildingData.forEach(b => {
      const bx = ((b.x + half) / (half * 2)) * (s - 20) + 10;
      const bz = ((b.z + half) / (half * 2)) * (s - 20) + 10;
      ctx.fillRect(bx - 2, bz - 2, 4, 4);
    });
    // Car
    if (this.carGroup) {
      const cx = ((this.carGroup.position.x + half) / (half * 2)) * (s - 20) + 10;
      const cz = ((this.carGroup.position.z + half) / (half * 2)) * (s - 20) + 10;
      ctx.fillStyle = '#ff2244';
      ctx.beginPath(); ctx.arc(cx, cz, 4, 0, Math.PI * 2); ctx.fill();
      // Direction indicator
      ctx.strokeStyle = '#ff2244'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cz);
      ctx.lineTo(cx + Math.sin(this.carAngle) * 8, cz + Math.cos(this.carAngle) * 8);
      ctx.stroke();
    }
  }
}

window.carzzGame = new CarzzGame3D();
