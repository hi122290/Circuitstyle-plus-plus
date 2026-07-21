import * as THREE from 'three';
import Global from './Global.js';

export function setupWorld(scene) {
    const textureLoader = new THREE.TextureLoader();
    const wcfg = Global.world;
    const sky = wcfg.skybox;

    const texPx = textureLoader.load('./' + sky.faces.px);
    const texNx = textureLoader.load('./' + sky.faces.nx);
    const texPy = textureLoader.load('./' + sky.faces.py);
    const texNy = textureLoader.load('./' + sky.faces.ny, (t) => {
        try {
            t.center.set(0.5, 0.5);
            t.rotation = sky.bottomRotation;
            t.needsUpdate = true;
        } catch (e) {}
    });
    const texPz = textureLoader.load('./' + sky.faces.pz);
    const texNz = textureLoader.load('./' + sky.faces.nz);

    function softenSkyTexture(t) {
        try {
            // Disable anisotropic sampling and trilinear filtering: use nearest sampling and no mipmaps for consistent, non-filtered look.
            t.minFilter = THREE.NearestFilter;
            t.magFilter = THREE.NearestFilter;
            t.generateMipmaps = false;
            t.needsUpdate = true;
        } catch (e) {}
    }

    function makeSkyMaterial(tex) {
        softenSkyTexture(tex);
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
        try { mat.color.multiplyScalar(sky.tint); } catch (e) {}
        return mat;
    }

    const materials = [
        makeSkyMaterial(texPx),
        makeSkyMaterial(texNx),
        makeSkyMaterial(texPy),
        makeSkyMaterial(texNy),
        makeSkyMaterial(texPz),
        makeSkyMaterial(texNz)
    ];

    const skyGeo = new THREE.BoxGeometry(4000, 4000, 4000);
    const skyMesh = new THREE.Mesh(skyGeo, materials);
    scene.add(skyMesh);

    const groundCfg = wcfg.ground;
    const groundTexture = textureLoader.load(groundCfg.texture, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.repeat.set(groundCfg.repeat.x, groundCfg.repeat.y);
    });

    const baseMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        roughness: groundCfg.roughness,
        metalness: groundCfg.metalness,
        envMapIntensity: groundCfg.envMapIntensity,
        // Ensure no ambient occlusion influence
        aoMap: null,
        aoMapIntensity: 0
    });

    const gdims = groundCfg.dimensions;
    const baseGeometry = new THREE.BoxGeometry(gdims.width, gdims.thickness, gdims.depth);
    const ground = new THREE.Mesh(baseGeometry, baseMaterial);
    // use the configured ground thickness from gdims (was referencing undefined baseThickness)
    ground.position.y = -gdims.thickness / 2;
    ground.name = 'ground';
    // receive shadows so characters and objects cast onto the baseplate
    try { ground.receiveShadow = true; } catch (e) {}
    scene.add(ground);

    function createSpawnPoint(position) {
        const scfg = wcfg.spawn;
        const spawnTexture = textureLoader.load(scfg.texture);
        const topMaterial = new THREE.MeshStandardMaterial({ map: spawnTexture, roughness: scfg.topRoughness, metalness: scfg.topMetalness, aoMap: null, aoMapIntensity: 0 });
        const sideMaterial = new THREE.MeshStandardMaterial({ color: scfg.sideColor, roughness: scfg.topRoughness, metalness: scfg.topMetalness, aoMap: null, aoMapIntensity: 0 });
        const materials = [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
        const geometry = new THREE.BoxGeometry(scfg.dimensions.width, scfg.dimensions.height, scfg.dimensions.depth);
        const spawnPoint = new THREE.Mesh(geometry, materials);
        spawnPoint.position.copy(position);
        spawnPoint.position.y += 0.1;
        scene.add(spawnPoint);
        // spawn pads should both cast and receive shadows so they integrate with the scene lighting
        try { spawnPoint.castShadow = true; spawnPoint.receiveShadow = true; } catch (e) {}
        return spawnPoint;
    }

    // Track collidable meshes for the physics system
    const collidables = [];

    // initial spawn
    const firstSpawn = createSpawnPoint(new THREE.Vector3(0, 0, 0));
    collidables.push(firstSpawn);

    // Make the ground behave like a normal block — include it in collidables so physics uses it
    try {
        // ensure the ground is marked as a collidable object for physics checks
        if (typeof ground !== 'undefined' && ground) {
            ground.userData = ground.userData || {};
            ground.userData.isCollidable = true;
            // push ground into the collidables array so player AABB checks treat it as any other block
            collidables.push(ground);
        }
    } catch (e) {
        // non-fatal; if something goes wrong, leave collidables as-is
    }

    // DYNAMIC KILLBRICK: A massive red lava floor deep below the map!
    const killGeo = new THREE.BoxGeometry(2000, 2, 2000);
    const killMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.45,
        emissive: 0xff0000,
        emissiveIntensity: 0.8,
        metalness: 0.2,
        roughness: 0.1
    });
    const killFloor = new THREE.Mesh(killGeo, killMat);
    killFloor.position.y = -22; // Way down tehre...
    killFloor.name = 'KillFloor';
    // tag it so the player module knows this thing is DANGEROUS!1!!11!
    killFloor.userData.isKillBrick = true;
    killFloor.userData.damage = 100; // instant oof...

    // Make the kill floor invisible while leaving it present for collision/damage checks.
    // Use fully transparent material and hide the mesh from rendering but keep it in the scene.
    try {
        // ensure material respects transparency and is fully transparent
        if (killFloor.material) {
            killFloor.material.transparent = true;
            killFloor.material.opacity = 0;
            // prevent any accidental emissive/visible glow still rendering
            try { killFloor.material.emissive = killFloor.material.emissive || new THREE.Color(0x000000); } catch (e) {}
        }
        // also mark the mesh as not visible to skip drawing altogether (still available to physics checks)
        killFloor.visible = false;
    } catch (e) {
        // non-fatal; if this fails the object will still be present
    }

    scene.add(killFloor);

    // ── Shared material helpers ────────────────────────────────────────────
    const studTex = textureLoader.load('./Studs_Texture.png', t => {
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

    // ── Spawn pads — one per quadrant, well separated ────────────────────────
    [[-110,-110],[110,-110],[-110,110],[110,110]].forEach(([sx,sz]) => {
        const sp = createSpawnPoint(new THREE.Vector3(sx, 0, sz));
        collidables.push(sp);
    });

    // return world object with explicit dimension values from gdims
    return { 
        ground, 
        baseWidth: gdims.width, 
        baseDepth: gdims.depth, 
        skyMesh, 
        skyMaterials: materials, 
        createSpawnPoint: (pos) => {
            const sp = createSpawnPoint(pos);
            collidables.push(sp);
            return sp;
        },
        collidables 
    };
}