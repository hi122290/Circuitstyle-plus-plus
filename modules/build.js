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
}

function showBuildUI() { if (panel) { panel.classList.remove('hidden'); buildPanelDOM(); } }
function hideBuildUI() { if (panel) panel.classList.add('hidden'); hideGhost(); }

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

    const rawPos = targetPoint.clone().add(normal.clone().multiplyScalar(h / 2 + 0.01));
    return new THREE.Vector3(
        snapToGrid(rawPos.x, gridSize),
        snapToGrid(rawPos.y, gridSize),
        snapToGrid(rawPos.z, gridSize)
    );
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
        ghostMesh.visible = true;
    } else {
        ghostMesh.visible = false;
    }
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isCollidable = true;
    try { world && world.collidables && world.collidables.push(mesh); } catch(e) {}
    scene.add(mesh);
    return {
        px: mesh.position.x, py: mesh.position.y, pz: mesh.position.z,
        sx: w, sy: h, sz: d,
        color: settings.color,
        t: Date.now()
    };
}

function spawnRemoteBuild(scene, data, world) {
    if (!data || !scene) return;
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(data.sx, data.sy, data.sz),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(data.color), roughness: 0.8, metalness: 0.05 })
    );
    mesh.position.set(data.px, data.py, data.pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isCollidable = true;
    try { world && world.collidables && world.collidables.push(mesh); } catch(e) {}
    scene.add(mesh);
}

export { initBuildUI, showBuildUI, hideBuildUI, getBuildSettings, placeBuild, spawnRemoteBuild, updateBuildGhost, showGhost, hideGhost, BUILD_COLORS };
