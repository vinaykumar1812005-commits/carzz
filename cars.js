// 3D Car mesh builders using Three.js primitives
window.CAR_CONFIGS = {
  mercedes: {
    name: 'Mercedes-Benz', bodyColor: 0xc0c0c0, cabinColor: 0x1a1d20,
    accentColor: 0x00e1ff, stats: { speed: 8, acceleration: 7, handling: 9 },
    emblem: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 12 L12 3 M12 12 L4.2 16.5 M12 12 L19.8 16.5"/></svg>`,
    bodyWidth: 1.9, bodyLength: 4.6, bodyHeight: 0.55, cabinHeight: 0.55, cabinLength: 2.4, cabinOffset: -0.2
  },
  bmw: {
    name: 'BMW', bodyColor: 0x0a2f90, cabinColor: 0x1c1c1f,
    accentColor: 0xff003c, stats: { speed: 8, acceleration: 8, handling: 8 },
    emblem: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2 L12 22 M2 12 L22 12"/></svg>`,
    bodyWidth: 1.85, bodyLength: 4.7, bodyHeight: 0.5, cabinHeight: 0.5, cabinLength: 2.3, cabinOffset: -0.15
  },
  bugatti: {
    name: 'Bugatti', bodyColor: 0xf03a00, cabinColor: 0x111215,
    accentColor: 0xffffff, stats: { speed: 10, acceleration: 10, handling: 7 },
    emblem: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.5" fill="none"><ellipse cx="12" cy="12" rx="9" ry="5"/><path d="M9 12h6 M12 10v4"/></svg>`,
    bodyWidth: 2.05, bodyLength: 4.5, bodyHeight: 0.45, cabinHeight: 0.42, cabinLength: 2.0, cabinOffset: -0.3
  },
  rollsroyce: {
    name: 'Rolls-Royce', bodyColor: 0x210228, cabinColor: 0x1c171e,
    accentColor: 0xffd700, stats: { speed: 7, acceleration: 6, handling: 10 },
    emblem: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.5" fill="none"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h4v4h-4z M11 11l3 6 M9 17h6"/></svg>`,
    bodyWidth: 1.95, bodyLength: 5.2, bodyHeight: 0.6, cabinHeight: 0.65, cabinLength: 2.8, cabinOffset: -0.1
  }
};

window.buildCar3D = function(carKey) {
  const cfg = window.CAR_CONFIGS[carKey];
  if (!cfg) return null;
  const T = THREE;
  const group = new T.Group();
  group.userData = { wheels: [], headlightMats: [], taillightMats: [], braking: false };

  const bodyMat = new T.MeshStandardMaterial({ color: cfg.bodyColor, metalness: 0.7, roughness: 0.3 });
  const cabinMat = new T.MeshStandardMaterial({ color: cfg.cabinColor, metalness: 0.1, roughness: 0.5, transparent: true, opacity: 0.85 });
  const chromeMat = new T.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });
  const tireMat = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const rimMat = new T.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });

  // Main body
  const bodyGeo = new T.BoxGeometry(cfg.bodyWidth, cfg.bodyHeight, cfg.bodyLength);
  const body = new T.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.35 + cfg.bodyHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Cabin
  const cabGeo = new T.BoxGeometry(cfg.bodyWidth * 0.88, cfg.cabinHeight, cfg.cabinLength);
  const cabin = new T.Mesh(cabGeo, cabinMat);
  cabin.position.set(0, 0.35 + cfg.bodyHeight + cfg.cabinHeight / 2, cfg.cabinOffset);
  cabin.castShadow = true;
  group.add(cabin);

  // Front bumper
  const bmpGeo = new T.BoxGeometry(cfg.bodyWidth + 0.05, 0.2, 0.2);
  const frontBmp = new T.Mesh(bmpGeo, chromeMat);
  frontBmp.position.set(0, 0.35, cfg.bodyLength / 2 + 0.1);
  group.add(frontBmp);

  // Rear bumper
  const rearBmp = new T.Mesh(bmpGeo, chromeMat);
  rearBmp.position.set(0, 0.35, -cfg.bodyLength / 2 - 0.1);
  group.add(rearBmp);

  // Grille
  const grillGeo = new T.BoxGeometry(cfg.bodyWidth * 0.6, 0.25, 0.05);
  const grillMat = new T.MeshStandardMaterial({ color: 0x222222, metalness: 0.5 });
  const grill = new T.Mesh(grillGeo, grillMat);
  grill.position.set(0, 0.45, cfg.bodyLength / 2 + 0.15);
  group.add(grill);

  // Wheels
  const wheelRadius = 0.35, wheelWidth = 0.22;
  const wheelGeo = new T.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
  const rimGeo = new T.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelWidth + 0.02, 8);
  const wheelPositions = [
    [-cfg.bodyWidth / 2 - 0.05, wheelRadius, cfg.bodyLength * 0.32],
    [cfg.bodyWidth / 2 + 0.05, wheelRadius, cfg.bodyLength * 0.32],
    [-cfg.bodyWidth / 2 - 0.05, wheelRadius, -cfg.bodyLength * 0.32],
    [cfg.bodyWidth / 2 + 0.05, wheelRadius, -cfg.bodyLength * 0.32]
  ];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelGroup = new T.Group();
    const tire = new T.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);
    const rim = new T.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);
    wheelGroup.position.set(wx, wy, wz);
    wheelGroup.castShadow = true;
    group.add(wheelGroup);
    group.userData.wheels.push(wheelGroup);
  });

  // Headlights
  const hlMat = new T.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.8 });
  const hlGeo = new T.SphereGeometry(0.1, 8, 8);
  [-0.65, 0.65].forEach(xOff => {
    const hl = new T.Mesh(hlGeo, hlMat.clone());
    hl.position.set(xOff, 0.5, cfg.bodyLength / 2 + 0.15);
    group.add(hl);
    group.userData.headlightMats.push(hl.material);
  });

  // Taillights
  const tlMat = new T.MeshStandardMaterial({ color: 0x880000, emissive: 0x440000, emissiveIntensity: 0.3 });
  const tlGeo = new T.BoxGeometry(0.2, 0.1, 0.05);
  [-0.65, 0.65].forEach(xOff => {
    const tl = new T.Mesh(tlGeo, tlMat.clone());
    tl.position.set(xOff, 0.5, -cfg.bodyLength / 2 - 0.15);
    group.add(tl);
    group.userData.taillightMats.push(tl.material);
  });

  // Spoiler for Bugatti
  if (carKey === 'bugatti') {
    const spGeo = new T.BoxGeometry(1.8, 0.06, 0.3);
    const sp = new T.Mesh(spGeo, new T.MeshStandardMaterial({ color: 0x111111 }));
    sp.position.set(0, 1.15, -cfg.bodyLength / 2 + 0.4);
    group.add(sp);
    const stGeo = new T.BoxGeometry(0.06, 0.25, 0.06);
    [-0.6, 0.6].forEach(xo => {
      const st = new T.Mesh(stGeo, new T.MeshStandardMaterial({ color: 0x111111 }));
      st.position.set(xo, 1.0, -cfg.bodyLength / 2 + 0.4);
      group.add(st);
    });
  }

  return group;
};
