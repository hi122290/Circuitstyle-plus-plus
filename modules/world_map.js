import * as THREE from 'three';
import Global from './Global.js';

export function setupWorld(scene) {
    const textureLoader = new THREE.TextureLoader();
    const wcfg = Global.world;
    const sky = wcfg.skybox;

    const texPx = textureLoader.load('/' + sky.faces.px);
    const texNx = textureLoader.load('/' + sky.faces.nx);
    const texPy = textureLoader.load('/' + sky.faces.py);
    const texNy = textureLoader.load('/' + sky.faces.ny, (t) => {
        try { t.center.set(0.5, 0.5); t.rotation = sky.bottomRotation; t.needsUpdate = true; } catch (e) {}
    });
    const texPz = textureLoader.load('/' + sky.faces.pz);
    const texNz = textureLoader.load('/' + sky.faces.nz);

    function softenSkyTexture(t) {
        try { t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; } catch (e) {}
    }
    function makeSkyMaterial(tex) {
        softenSkyTexture(tex);
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
        try { mat.color.multiplyScalar(sky.tint); } catch (e) {}
        return mat;
    }

    const materials = [
        makeSkyMaterial(texPx), makeSkyMaterial(texNx),
        makeSkyMaterial(texPy), makeSkyMaterial(texNy),
        makeSkyMaterial(texPz), makeSkyMaterial(texNz)
    ];
    const skyGeo = new THREE.BoxGeometry(4000, 4000, 4000);
    const skyMesh = new THREE.Mesh(skyGeo, materials);
    scene.add(skyMesh);

    const groundCfg = wcfg.ground;
    const groundTexture = textureLoader.load(groundCfg.texture, (tex) => {
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.repeat.set(groundCfg.repeat.x, groundCfg.repeat.y);
    });
    const baseMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: groundCfg.roughness, metalness: groundCfg.metalness, envMapIntensity: groundCfg.envMapIntensity, aoMap: null, aoMapIntensity: 0 });
    const gdims = groundCfg.dimensions;
    const baseGeometry = new THREE.BoxGeometry(gdims.width, gdims.thickness, gdims.depth);
    const ground = new THREE.Mesh(baseGeometry, baseMaterial);
    ground.position.y = -gdims.thickness / 2;
    ground.name = 'ground';
    try { ground.receiveShadow = true; } catch (e) {}
    scene.add(ground);

    function createSpawnPoint(position) {
        const scfg = wcfg.spawn;
        const spawnTexture = textureLoader.load(scfg.texture);
        const topMaterial = new THREE.MeshStandardMaterial({ map: spawnTexture, roughness: scfg.topRoughness, metalness: scfg.topMetalness, aoMap: null, aoMapIntensity: 0 });
        const sideMaterial = new THREE.MeshStandardMaterial({ color: scfg.sideColor, roughness: scfg.topRoughness, metalness: scfg.topMetalness, aoMap: null, aoMapIntensity: 0 });
        const mats = [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
        const geometry = new THREE.BoxGeometry(scfg.dimensions.width, scfg.dimensions.height, scfg.dimensions.depth);
        const spawnPoint = new THREE.Mesh(geometry, mats);
        spawnPoint.position.copy(position);
        spawnPoint.position.y += 0.1;
        scene.add(spawnPoint);
        try { spawnPoint.castShadow = true; spawnPoint.receiveShadow = true; } catch (e) {}
        return spawnPoint;
    }

    const collidables = [];

    const firstSpawn = createSpawnPoint(new THREE.Vector3(0, 0, 0));
    collidables.push(firstSpawn);

    try {
        if (ground) { ground.userData = ground.userData || {}; ground.userData.isCollidable = true; collidables.push(ground); }
    } catch (e) {}

    const killFloor = new THREE.Mesh(new THREE.BoxGeometry(2000, 2, 2000), new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0 }));
    killFloor.position.y = -22;
    killFloor.name = 'KillFloor';
    killFloor.userData.isKillBrick = true;
    killFloor.userData.damage = 100;
    killFloor.visible = false;
    scene.add(killFloor);

    // ── Shared material helpers ────────────────────────────────────────────
    const studTex = textureLoader.load('/Studs_Texture.png', t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
    });
    function brickMat(color, repeatX = 1, repeatY = 1) {
        const t = studTex.clone(); t.needsUpdate = true;
        t.repeat.set(repeatX, repeatY);
        return new THREE.MeshStandardMaterial({ color, map: t, roughness: 0.55, metalness: 0.04 });
    }
    function plainMat(color) {
        return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.04 });
    }
    function addBox(w, h, d, x, y, z, mat, opts = {}) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        if (opts.name) mesh.name = opts.name;
        if (opts.kill) { mesh.userData.isKillBrick = true; mesh.userData.damage = opts.kill; }
        scene.add(mesh);
        if (opts.collidable !== false) collidables.push(mesh);
        return mesh;
    }

    // ── Spawn pads ────────────────────────────────────────────────────────
    [[-110,-110],[110,-110],[-110,110],[110,110]].forEach(([sx,sz]) => {
        collidables.push(createSpawnPoint(new THREE.Vector3(sx, 0, sz)));
    });

    // ── Central PvP Arena (56×56) ─────────────────────────────────────────
    const A = 28;
    addBox(A*2, 0.6, A*2, 0, 0.3, 0, brickMat(0xc8a060, 28, 28));
    const WH = 2.4, WT = 0.6;
    addBox(A*2-10, WH, WT,  0,  0.6+WH/2,  A,  brickMat(0x8b6914, 14, 2));
    addBox(A*2-10, WH, WT,  0,  0.6+WH/2, -A,  brickMat(0x8b6914, 14, 2));
    addBox(WT, WH, A*2-10,  A,  0.6+WH/2,  0,  brickMat(0x8b6914, 2, 14));
    addBox(WT, WH, A*2-10, -A,  0.6+WH/2,  0,  brickMat(0x8b6914, 2, 14));
    [[-A,A],[A,A],[-A,-A],[A,-A]].forEach(([px,pz]) =>
        addBox(1.8, 4.5, 1.8, px, 2.25, pz, brickMat(0x5a4010, 1, 3)));
    addBox(16, 1.8, 16, 0, 0.6+0.9, 0, brickMat(0xd4aa55, 8, 8));
    [[0,10],[0,-10],[10,0],[-10,0]].forEach(([sx,sz]) =>
        addBox(5, 0.6, 5, sx, 0.6+0.3, sz, brickMat(0xc8a060, 3, 3)));
    [[-12,12],[12,12],[-12,-12],[12,-12]].forEach(([cx,cz]) =>
        addBox(3, 2.4, 3, cx, 0.6+1.2, cz, brickMat(0x7a5c2a, 2, 2)));

    // ── Enterable buildings ───────────────────────────────────────────────
    function addBuilding(cx, cz, w, d, wallH, floorColor, wallColor, roofColor, rotation = 0) {
        const hw = w/2, hd = d/2;
        const group = new THREE.Group();
        group.rotation.y = rotation;
        group.position.set(cx, 0, cz);
        scene.add(group);
        const addPart = (pw, ph, pd, px, py, pz, mat) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mat);
            m.position.set(px, py, pz);
            m.castShadow = true; m.receiveShadow = true;
            group.add(m); collidables.push(m);
        };
        addPart(w, 0.5, d, 0, 0.25, 0, brickMat(floorColor, Math.ceil(w/2), Math.ceil(d/2)));
        addPart(w, wallH, 0.6, 0, 0.5+wallH/2, -hd, brickMat(wallColor, Math.ceil(w/2), Math.ceil(wallH/2)));
        addPart(0.6, wallH, d, -hw, 0.5+wallH/2, 0, brickMat(wallColor, Math.ceil(d/2), Math.ceil(wallH/2)));
        addPart(0.6, wallH, d,  hw, 0.5+wallH/2, 0, brickMat(wallColor, Math.ceil(d/2), Math.ceil(wallH/2)));
        const doorW = 3.0, doorH = 3.5, sideW = (w - doorW) / 2;
        addPart(sideW, wallH, 0.6, -(doorW/2+sideW/2), 0.5+wallH/2, hd, brickMat(wallColor, Math.ceil(sideW/2), Math.ceil(wallH/2)));
        addPart(sideW, wallH, 0.6,  (doorW/2+sideW/2), 0.5+wallH/2, hd, brickMat(wallColor, Math.ceil(sideW/2), Math.ceil(wallH/2)));
        if (wallH > doorH) addPart(doorW, wallH-doorH, 0.6, 0, 0.5+doorH+(wallH-doorH)/2, hd, brickMat(wallColor, 1, 1));
        addPart(w+0.6, 0.5, d+0.6, 0, 0.5+wallH+0.25, 0, brickMat(roofColor, Math.ceil(w/2), Math.ceil(d/2)));
    }

    addBuilding(-110, -110, 28, 22, 6, 0x7a9e7e, 0x4a7a50, 0x2d5c33, -Math.PI/2);
    addBuilding( 110, -110, 28, 22, 6, 0x9e7a7a, 0x7a4a4a, 0x5c2d2d,  Math.PI/2);
    addBuilding( 110,  110, 26, 26, 9, 0x7a7a9e, 0x4a4a7a, 0x2d2d5c,  Math.PI);
    addBuilding(-110,  110, 24, 24, 12, 0x9e9e7a, 0x7a7a4a, 0x5c5c2d, 0);

    // ── Bridges ───────────────────────────────────────────────────────────
    function addBridge(x1, z1, x2, z2, deckY, deckW = 5) {
        const dx = x2-x1, dz = z2-z1;
        const len = Math.sqrt(dx*dx+dz*dz);
        const angle = Math.atan2(dx, dz);
        const cx = (x1+x2)/2, cz = (z1+z2)/2;
        const deck = addBox(deckW, 0.5, len, cx, deckY, cz, brickMat(0xb8860b, Math.ceil(deckW/2), Math.ceil(len/4)));
        deck.rotation.y = angle;
        const railH = 1.2, railT = 0.3;
        const rL = addBox(railT, railH, len, cx, deckY+railH/2+0.25, cz, plainMat(0x8b6914));
        rL.rotation.y = angle;
        rL.position.x += Math.cos(angle)*(deckW/2-railT/2);
        rL.position.z -= Math.sin(angle)*(deckW/2-railT/2);
        const rR = addBox(railT, railH, len, cx, deckY+railH/2+0.25, cz, plainMat(0x8b6914));
        rR.rotation.y = angle;
        rR.position.x -= Math.cos(angle)*(deckW/2-railT/2);
        rR.position.z += Math.sin(angle)*(deckW/2-railT/2);
    }

    addBridge(-A, -A, -90, -90, 0.25);
    addBridge( A, -A,  90, -90, 0.25);
    addBridge( A,  A,  90,  90, 0.25);
    addBridge(-A,  A, -90,  90, 0.25);
    addBridge(-110, -88, -110, 88, 0.25, 6);
    addBridge( 110, -88,  110, 88, 0.25, 6);
    addBridge(0, -A, 0, -110, 0.25, 5);
    addBridge(0,  A, 0,  110, 0.25, 5);
    addBridge(-A, 0, -110, 0, 0.25, 5);
    addBridge( A, 0,  110, 0, 0.25, 5);

    // ── Ring platforms ────────────────────────────────────────────────────
    [[0,-44],[0,44],[-44,0],[44,0]].forEach(([px,pz]) =>
        addBox(10, 0.5, 10, px, 0.25, pz, brickMat(0xaaaaaa, 5, 5)));
    addBridge(-44, 0,  0, -44, 0.25, 4);
    addBridge(  0,-44, 44,  0, 0.25, 4);
    addBridge( 44,  0,  0,  44, 0.25, 4);
    addBridge(  0, 44,-44,   0, 0.25, 4);

    // ── Mid-field cover blocks ────────────────────────────────────────────
    [
        [-60,  0, 0xcc4444], [ 60,  0, 0x44aacc],
        [  0,-60, 0x88cc44], [  0, 60, 0xcc8844],
        [-60,-60, 0xaa44cc], [ 60,-60, 0xcc44aa],
        [-60, 60, 0x44ccaa], [ 60, 60, 0xaacc44],
    ].forEach(([x,z,c]) => addBox(5, 3.0, 5, x, 1.5, z, brickMat(c, 3, 3)));

    return {
        ground,
        baseWidth: gdims.width,
        baseDepth: gdims.depth,
        skyMesh,
        skyMaterials: materials,
        createSpawnPoint: (pos) => { const sp = createSpawnPoint(pos); collidables.push(sp); return sp; },
        collidables
    };
}
