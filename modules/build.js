import * as THREE from 'three';

const BUILD_COLORS = [
    { name: 'White',  hex: '#ffffff' },
    { name: 'Grey',   hex: '#808080' },
    { name: 'Black',  hex: '#222222' },
    { name: 'Red',    hex: '#cc3333' },
    { name: 'Orange', hex: '#dd7722' },
    { name: 'Yellow', hex: '#dddd33' },
    { name: 'Green',  hex: '#33aa33' },
    { name: 'Cyan',   hex: '#33cccc' },
    { name: 'Blue',   hex: '#3366cc' },
    { name: 'Purple', hex: '#8833cc' },
    { name: 'Pink',   hex: '#ee66aa' },
    { name: 'Brown',  hex: '#8b5a2b' }
];

const SIZES = {
    small:  { block: [0.8, 0.8, 0.8],           wall: [2.4, 0.8, 0.4] },
    medium: { block: [1.6, 1.6, 1.6],           wall: [3.2, 1.6, 0.4] },
    large:  { block: [3.2, 3.2, 3.2],           wall: [4.8, 3.2, 0.4] }
};

const settings = {
    color: '#8b5a2b',
    size: 'medium',
    shape: 'block'
};

let panel = null;
let ghostMesh = null;
let ghostScene = null;
let _blockIdCounter = 0;
const blockRegistry = [];
const SAVES_KEY = 'circuitstyle_saves';
let saveMenuOpen = false;

function snapToGrid(val, gridSize) {
    return Math.round(val / gridSize) * gridSize;
}

function initBuildUI() {
    panel = document.getElementById('build-controls');
    if (!panel) return;
    buildPanelDOM();
    panel.classList.add('hidden');
}

function buildPanelDOM() {
    panel.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'build-row';

    const palette = document.createElement('div');
    palette.className = 'build-palette';
    BUILD_COLORS.forEach(c => {
        const swatch = document.createElement('div');
        swatch.className = 'build-swatch';
        if (c.hex === settings.color) swatch.classList.add('selected');
        swatch.style.backgroundColor = c.hex;
        swatch.title = c.name;
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            settings.color = c.hex;
            palette.querySelectorAll('.build-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
            updateGhostColor();
        });
        palette.appendChild(swatch);
    });
    row.appendChild(palette);

    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'build-group';
    ['small', 'medium', 'large'].forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'build-btn build-size-btn';
        if (s === settings.size) btn.classList.add('selected');
        btn.textContent = s.charAt(0).toUpperCase();
        btn.title = s.charAt(0).toUpperCase() + s.slice(1);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            settings.size = s;
            sizeGroup.querySelectorAll('.build-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateGhostSize();
        });
        sizeGroup.appendChild(btn);
    });
    row.appendChild(sizeGroup);

    const shapeGroup = document.createElement('div');
    shapeGroup.className = 'build-group';
    [['block', 'Block'], ['wall', 'Wall']].forEach(([key, label]) => {
        const btn = document.createElement('button');
        btn.className = 'build-btn build-shape-btn';
        if (key === settings.shape) btn.classList.add('selected');
        btn.textContent = label;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            settings.shape = key;
            shapeGroup.querySelectorAll('.build-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateGhostSize();
        });
        shapeGroup.appendChild(btn);
    });
    row.appendChild(shapeGroup);

    panel.appendChild(row);

    const actionRow = document.createElement('div');
    actionRow.className = 'build-row';
    actionRow.style.marginTop = '4px';
    actionRow.style.gap = '4px';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'build-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptSaveBuild();
    });
    actionRow.appendChild(saveBtn);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'build-btn';
    loadBtn.textContent = 'Saves';
    loadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSaveMenu();
    });
    actionRow.appendChild(loadBtn);

    panel.appendChild(actionRow);
}

function showBuildUI() { if (panel) { panel.classList.remove('hidden'); buildPanelDOM(); } }
function hideBuildUI() { if (panel) panel.classList.add('hidden'); hideGhost(); closeSaveMenu(); }

function getBuildSettings() {
    return { ...settings };
}

function getBuildDimensions() {
    const dims = SIZES[settings.size] || SIZES.medium;
    const d = dims[settings.shape] || dims.block;
    return { w: d[0], h: d[1], d: d[2] };
}

function getGridSize() {
    const { h } = getBuildDimensions();
    return h;
}

function computeSnappedPosition(targetPoint, targetNormal) {
    if (!targetPoint) return null;
    const normal = targetNormal ? targetNormal.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const { w, h, d } = getBuildDimensions();
    const gridSize = getGridSize();

    let offset = h / 2 + 0.01;
    if (settings.shape === 'wall' && Math.abs(normal.y) < 0.5) {
        offset = d / 2 + 0.01;
    }

    const rawPos = targetPoint.clone().add(normal.clone().multiplyScalar(offset));
    return new THREE.Vector3(
        snapToGrid(rawPos.x, gridSize),
        snapToGrid(rawPos.y, gridSize),
        snapToGrid(rawPos.z, gridSize)
    );
}

function computeWallRotation(targetNormal) {
    if (!targetNormal) return { rx: 0, ry: 0, rz: 0, rw: 1 };
    const n = targetNormal.clone().normalize();
    const quat = new THREE.Quaternion();

    if (Math.abs(n.y) > 0.9) {
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    } else if (Math.abs(n.x) > Math.abs(n.z)) {
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    } else {
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    }

    return { rx: quat.x, ry: quat.y, rz: quat.z, rw: quat.w };
}

function ensureGhost(scene) {
    if (ghostMesh && ghostScene === scene) return;
    ghostScene = scene;
    const { w, h, d } = getBuildDimensions();
    ghostMesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color: settings.color, transparent: true, opacity: 0.35, depthWrite: false })
    );
    ghostMesh.visible = false;
    ghostMesh.renderOrder = 999;
    scene.add(ghostMesh);
}

function updateGhostColor() {
    if (ghostMesh) ghostMesh.material.color.set(settings.color);
}

function updateGhostSize() {
    if (!ghostScene) return;
    if (ghostMesh) { ghostScene.remove(ghostMesh); ghostMesh.geometry.dispose(); ghostMesh.material.dispose(); ghostMesh = null; }
    ensureGhost(ghostScene);
}

function showGhost(scene) { ensureGhost(scene); if (ghostMesh) ghostMesh.visible = true; }
function hideGhost() { if (ghostMesh) ghostMesh.visible = false; }

function updateBuildGhost(scene, targetPoint, targetNormal) {
    if (!ghostMesh) return;
    const snapped = computeSnappedPosition(targetPoint, targetNormal);
    if (snapped) {
        ghostMesh.position.copy(snapped);
        if (settings.shape === 'wall' && targetNormal) {
            const rot = computeWallRotation(targetNormal);
            ghostMesh.quaternion.set(rot.rx, rot.ry, rot.rz, rot.rw);
        } else {
            ghostMesh.quaternion.identity();
        }
        ghostMesh.visible = true;
    } else {
        ghostMesh.visible = false;
    }
}

function registerBlock(mesh, data) {
    const id = ++_blockIdCounter;
    mesh.userData.blockId = id;
    blockRegistry.push({ id, mesh, data });
    return id;
}

function placeBuild(scene, targetPoint, targetNormal, world) {
    if (!targetPoint) return null;
    const snapped = computeSnappedPosition(targetPoint, targetNormal);
    if (!snapped) return null;
    const { w, h, d } = getBuildDimensions();
    const color = new THREE.Color(settings.color);

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 })
    );
    mesh.position.copy(snapped);

    let rotData = { rx: 0, ry: 0, rz: 0, rw: 1 };
    if (settings.shape === 'wall' && targetNormal) {
        rotData = computeWallRotation(targetNormal);
        mesh.quaternion.set(rotData.rx, rotData.ry, rotData.rz, rotData.rw);
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isCollidable = true;
    try { world && world.collidables && world.collidables.push(mesh); } catch(e) {}
    scene.add(mesh);

    const buildData = {
        px: mesh.position.x, py: mesh.position.y, pz: mesh.position.z,
        sx: w, sy: h, sz: d,
        rx: rotData.rx, ry: rotData.ry, rz: rotData.rz, rw: rotData.rw,
        shape: settings.shape,
        color: settings.color,
        t: Date.now()
    };
    registerBlock(mesh, buildData);
    return buildData;
}

function spawnRemoteBuild(scene, data, world) {
    if (!data || !scene) return;
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(data.sx, data.sy, data.sz),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(data.color), roughness: 0.8, metalness: 0.05 })
    );
    mesh.position.set(data.px, data.py, data.pz);
    if (data.rw !== undefined) {
        mesh.quaternion.set(data.rx || 0, data.ry || 0, data.rz || 0, data.rw);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isCollidable = true;
    try { world && world.collidables && world.collidables.push(mesh); } catch(e) {}
    scene.add(mesh);
    registerBlock(mesh, data);
}

function deleteBlockById(blockId, scene, world) {
    const idx = blockRegistry.findIndex(b => b.id === blockId);
    if (idx === -1) return false;
    const entry = blockRegistry[idx];
    blockRegistry.splice(idx, 1);
    if (entry.mesh) {
        if (scene) scene.remove(entry.mesh);
        if (world && world.collidables) {
            const ci = world.collidables.indexOf(entry.mesh);
            if (ci !== -1) world.collidables.splice(ci, 1);
        }
        if (entry.mesh.geometry) entry.mesh.geometry.dispose();
        if (entry.mesh.material) entry.mesh.material.dispose();
    }
    return true;
}

function deleteBlockByMesh(mesh, scene, world) {
    if (!mesh || !mesh.userData || !mesh.userData.blockId) return false;
    return deleteBlockById(mesh.userData.blockId, scene, world);
}

function findBlockAtPoint(intersects) {
    for (const hit of intersects) {
        let obj = hit.object;
        while (obj) {
            if (obj.userData && obj.userData.blockId) return obj;
            obj = obj.parent;
        }
    }
    return null;
}

function getAllBlocks() {
    return blockRegistry.map(e => ({ ...e.data, id: e.id }));
}

function getAllBlockMeshes() {
    return blockRegistry.map(e => e.mesh);
}

function clearAllBlocks(scene, world) {
    for (let i = blockRegistry.length - 1; i >= 0; i--) {
        deleteBlockById(blockRegistry[i].id, scene, world);
    }
}

function stampBuild(scene, world, saveData, origin) {
    if (!saveData || !saveData.blocks || !scene) return [];
    if (!saveData.blocks.length) return [];
    const center = saveData.center || { x: 0, y: 0, z: 0 };
    const placed = [];
    for (const b of saveData.blocks) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(b.sx, b.sy, b.sz),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color), roughness: 0.8, metalness: 0.05 })
        );
        mesh.position.set(
            snapToGrid(origin.x + b.dx, 1.6),
            snapToGrid(origin.y + b.dy, 1.6),
            snapToGrid(origin.z + b.dz, 1.6)
        );
        if (b.rw !== undefined) {
            mesh.quaternion.set(b.rx || 0, b.ry || 0, b.rz || 0, b.rw);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCollidable = true;
        try { world && world.collidables && world.collidables.push(mesh); } catch(e) {}
        scene.add(mesh);
        const buildData = {
            px: mesh.position.x, py: mesh.position.y, pz: mesh.position.z,
            sx: b.sx, sy: b.sy, sz: b.sz,
            rx: b.rx || 0, ry: b.ry || 0, rz: b.rz || 0, rw: b.rw || 1,
            shape: b.shape || 'block',
            color: b.color,
            t: Date.now() + placed.length
        };
        const blockId = registerBlock(mesh, buildData);
        placed.push({ blockId, buildData });
    }
    return placed;
}

function promptSaveBuild() {
    const blocks = getAllBlocks();
    if (blocks.length === 0) return;
    const name = prompt('Name your save:', 'Build ' + (getSaves().length + 1));
    if (!name) return;
    saveBuild(name.trim(), blocks);
}

function saveBuild(name, blocks) {
    if (!blocks.length) return;
    let cx = 0, cy = 0, cz = 0;
    for (const b of blocks) { cx += b.px; cy += b.py; cz += b.pz; }
    cx /= blocks.length; cy /= blocks.length; cz /= blocks.length;
    const saveData = {
        name,
        timestamp: Date.now(),
        blockCount: blocks.length,
        center: { x: cx, y: cy, z: cz },
        blocks: blocks.map(b => ({
            dx: b.px - cx, dy: b.py - cy, dz: b.pz - cz,
            sx: b.sx, sy: b.sy, sz: b.sz,
            rx: b.rx || 0, ry: b.ry || 0, rz: b.rz || 0, rw: b.rw || 1,
            shape: b.shape || 'block',
            color: b.color
        }))
    };
    const saves = getSaves();
    saves.push(saveData);
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    renderSaveMenu();
}

function getSaves() {
    try { return JSON.parse(localStorage.getItem(SAVES_KEY)) || []; } catch(e) { return []; }
}

function deleteSave(index) {
    const saves = getSaves();
    saves.splice(index, 1);
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    renderSaveMenu();
}

function toggleSaveMenu() {
    if (saveMenuOpen) { closeSaveMenu(); return; }
    saveMenuOpen = true;
    renderSaveMenu();
}

function closeSaveMenu() {
    saveMenuOpen = false;
    const el = document.getElementById('save-menu');
    if (el) el.classList.add('hidden');
}

function renderSaveMenu() {
    let el = document.getElementById('save-menu');
    if (!el) {
        el = document.createElement('div');
        el.id = 'save-menu';
        document.body.appendChild(el);
    }
    el.innerHTML = '';
    const saves = getSaves();
    if (!saves.length) {
        el.classList.add('hidden');
        saveMenuOpen = false;
        return;
    }
    el.classList.remove('hidden');
    el.style.cssText = `
        position:fixed; bottom:100px; right:18px; z-index:50;
        width:240px; max-height:360px; overflow-y:auto;
        background:linear-gradient(180deg,#e8e8e8 0%,#c8c8c8 45%,#b0b0b0 55%,#c0c0c0 100%);
        border:1px solid #888; border-top-color:#ddd; border-left-color:#ddd;
        border-bottom-color:#666; border-right-color:#666;
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.4);
        padding:6px; border-radius:0;
        font-family:"Comic Sans MS",cursive; font-size:12px; color:#333;
    `;
    el.scrollTop = 0;
    for (let i = saves.length - 1; i >= 0; i--) {
        const s = saves[i];
        const entry = document.createElement('div');
        entry.style.cssText = 'border:1px solid #999; border-top-color:#ccc; border-left-color:#ccc; border-bottom-color:#555; border-right-color:#555; background:linear-gradient(180deg,#ddd 0%,#bbb 100%); padding:4px; margin-bottom:4px; position:relative;';
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = s.name;
        nameSpan.style.cssText = 'font-weight:bold; font-size:12px;';
        header.appendChild(nameSpan);
        const countSpan = document.createElement('span');
        countSpan.textContent = s.blockCount + ' blocks';
        countSpan.style.cssText = 'font-size:10px; color:#666;';
        header.appendChild(countSpan);
        entry.appendChild(header);
        const preview = document.createElement('canvas');
        preview.width = 220;
        preview.height = 80;
        preview.style.cssText = 'width:100%; height:80px; background:#5a7a5a; border:1px solid #888; display:block; margin-bottom:4px;';
        entry.appendChild(preview);
        renderSavePreview(preview, s);
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; gap:4px;';
        const stampBtn = document.createElement('button');
        stampBtn.className = 'build-btn';
        stampBtn.textContent = 'Stamp';
        stampBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window._pendingStampSave = s;
            closeSaveMenu();
        });
        btnRow.appendChild(stampBtn);
        const delBtn = document.createElement('button');
        delBtn.className = 'build-btn';
        delBtn.textContent = 'Delete';
        delBtn.style.cssText = 'background:linear-gradient(180deg,#d44 0%,#a22 100%); color:#fff; border-color:#833;';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete "' + s.name + '"?')) deleteSave(i);
        });
        btnRow.appendChild(delBtn);
        entry.appendChild(btnRow);
        el.appendChild(entry);
    }
}

function renderSavePreview(canvas, saveData) {
    try {
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setClearColor(0x5a7a5a);
        renderer.setSize(canvas.width, canvas.height, false);
        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(5, 10, 7);
        scene.add(dir);
        const group = new THREE.Group();
        for (const b of saveData.blocks) {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(b.sx, b.sy, b.sz),
                new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color), roughness: 0.8, metalness: 0.05 })
            );
            mesh.position.set(b.dx, b.dy, b.dz);
            if (b.rw !== undefined) mesh.quaternion.set(b.rx || 0, b.ry || 0, b.rz || 0, b.rw);
            group.add(mesh);
        }
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        group.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fitDist = maxDim * 1.4;
        const cam = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 100);
        cam.position.set(fitDist * 0.7, fitDist * 0.5, fitDist * 0.7);
        cam.lookAt(0, 0, 0);
        scene.add(group);
        renderer.render(scene, cam);
        renderer.dispose();
    } catch(e) {}
}

export { initBuildUI, showBuildUI, hideBuildUI, getBuildSettings, placeBuild, spawnRemoteBuild, updateBuildGhost, showGhost, hideGhost, BUILD_COLORS, deleteBlockByMesh, deleteBlockById, findBlockAtPoint, stampBuild, getAllBlocks, getAllBlockMeshes, clearAllBlocks, toggleSaveMenu, closeSaveMenu, getSaves, promptSaveBuild, saveBuild };
