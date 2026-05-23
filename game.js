// 3D City Racing Engine using Three.js
class CarzzGame3D {
  constructor() {
    this.scene = null; this.camera = null; this.renderer = null;
    this.gridCount = 6; this.blockSize = 55; this.roadW = 14; this.spacing = 69;
    this.carGroup = null; this.carSpeed = 0; this.carAngle = Math.PI;
    this.maxSpeed = 45; this.accel = 18; this.brakeForce = 35; this.friction = 3; this.steerSpeed = 2.2;
    this.isEngineStarted = false; this.activeCarKey = 'mercedes';
    this.keys = {}; this.steerOffset = 0;
    this.uiControls = { accelerating:false, braking:false, steeringLeft:false, steeringRight:false };
    this.lastTime = 0; this.animationFrameId = null; this.elapsedTime = 0;
    this.buildingData = []; this.handlingFactor = 1;
    this.npcCars = []; this.cartoonPeople = [];
  }

  init(canvasId) {
    const canvas = document.getElementById(canvasId);
    const w = canvas.parentElement.clientWidth || 1024, h = canvas.parentElement.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(w, h); this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6db3f2);
    this.scene.fog = new THREE.Fog(0x6db3f2, 150, 600);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.5, 800);
    this.camera.position.set(0, 6, -12);

    this._setupLights();
    this._buildGround();
    this._buildRoads();
    this._buildBuildings();
    this._buildProps();
    this._buildCartoonPeople();
    this._buildNPCTraffic();
    this._createCar(this.activeCarKey);
    this._setupInput();
    this.resetCarStats();

    window.addEventListener('resize', () => {
      const pw = canvas.parentElement.clientWidth, ph = canvas.parentElement.clientHeight;
      this.camera.aspect = pw / ph; this.camera.updateProjectionMatrix();
      this.renderer.setSize(pw, ph);
    });

    this.lastTime = performance.now(); this._loop();
  }

  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a6b35, 0.5));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
    sun.position.set(80, 160, 60); sun.castShadow = true;
    const s = sun.shadow; s.mapSize.set(2048,2048);
    s.camera.left = -120; s.camera.right = 120; s.camera.top = 120; s.camera.bottom = -120;
    s.camera.near = 1; s.camera.far = 400; s.bias = -0.001;
    this.scene.add(sun); this.sun = sun;
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
        const tz = -half + (Math.random() * this.gridCount) * this.spacing + this.spacing / 2;
        [-1, 1].forEach(side => {
          const treeG = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3), trunkMat);
          trunk.position.y = 1.5; treeG.add(trunk);
          const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 6), leafMat);
          leaves.position.y = 5; leaves.castShadow = true; treeG.add(leaves);
          treeG.position.set(pos + side * (this.roadW / 2 + 3.5), 0, tz);
          this.scene.add(treeG);
        });
      }
    }
    // Park area (center)
    for (let p = 0; p < 20; p++) {
      const tx = (Math.random() - 0.5) * 40, tz = (Math.random() - 0.5) * 40;
      const treeG = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4), trunkMat);
      trunk.position.y = 2; treeG.add(trunk);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.5 + Math.random(), 6, 6), leafMat);
      leaves.position.y = 5.5; leaves.castShadow = true; treeG.add(leaves);
      treeG.position.set(tx, 0, tz); this.scene.add(treeG);
    }
  }

  _buildCartoonPeople() {
    const half = (this.gridCount * this.spacing) / 2;
    const skinColors = [0xf5c5a3, 0xd4a373, 0x8d5524, 0xffe0bd, 0xc68642];
    const shirtColors = [0xff3b5c, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0xec4899, 0x06b6d4, 0xff6b35];
    const pantColors = [0x1e3a5f, 0x333333, 0x4a2c2a, 0x1a1a2e];

    for (let i = 0; i < 60; i++) {
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
    const npcColors = [0xffcc00, 0x2255cc, 0xcc3333, 0x33aa33, 0xffffff, 0xff8800];
    const npcMat = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.4, roughness: 0.4 });

    for (let n = 0; n < 18; n++) {
      const npc = new THREE.Group();
      const col = npcColors[Math.floor(Math.random() * npcColors.length)];
      // Simple box car
      const carBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 3.5), npcMat(col));
      carBody.position.y = 0.5; carBody.castShadow = true; npc.add(carBody);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.8 }));
      cabin.position.y = 0.95; npc.add(cabin);
      // Wheels
      const wMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      [[-0.75,0.3,1.0],[0.75,0.3,1.0],[-0.75,0.3,-1.0],[0.75,0.3,-1.0]].forEach(([wx,wy,wz]) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 8), wMat);
        w.rotation.z = Math.PI / 2; w.position.set(wx, wy, wz); npc.add(w);
      });

      // Place on a road
      const roadIdx = Math.floor(Math.random() * (this.gridCount + 1));
      const roadPos = -half + roadIdx * this.spacing;
      const along = -half + Math.random() * (this.gridCount * this.spacing);
      const lane = (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 2);
      const isNS = Math.random() > 0.5;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const speed = 5 + Math.random() * 10;

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

    if (this.carGroup) {
      const nx = this.carGroup.position.x + Math.sin(this.carAngle) * this.carSpeed * dt;
      const nz = this.carGroup.position.z + Math.cos(this.carAngle) * this.carSpeed * dt;
      if (!this._checkCollision(nx, nz)) {
        this.carGroup.position.x = nx; this.carGroup.position.z = nz;
      } else { this.carSpeed *= -0.3; }
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

    // Animate cartoon people walking
    this.cartoonPeople.forEach(p => {
      const swing = Math.sin(this.elapsedTime * p.walkSpeed + p.phase) * 0.3;
      p.leftLeg.rotation.x = swing;
      p.rightLeg.rotation.x = -swing;
      p.leftArm.rotation.x = -swing * 0.7;
      p.rightArm.rotation.x = swing * 0.7;
      p.group.position.y = Math.abs(Math.sin(this.elapsedTime * p.walkSpeed * 2 + p.phase)) * 0.05;
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
