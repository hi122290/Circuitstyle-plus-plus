/**
 * Studio Mode — in-game level editor with freecam, part placement,
 * selection/manipulation, snap grid, color picker, and save/publish.
 *
 * Modes: 'freecam' (studio editing) and 'play' (normal gameplay).
 * Toggle with 1 (freecam) / 2 (play).
 */

import * as THREE from 'three';

const GRID_SIZE = 1.6;
const SNAP_ENABLED_DEFAULT = true;
const FREECAM_SPEED = 0.6;
const FREECAM_FAST_SPEED = 1.4;
const ROTATION_STEP = Math.PI / 12; // 15 degrees

const PART_TYPES = {
    block:   { name: 'Block',   geo: () => new THREE.BoxGeometry(3.2, 0.8, 1.6) },
    cube:    { name: 'Cube',    geo: () => new THREE.BoxGeometry(1.6, 1.6, 1.6) },
    sphere:  { name: 'Sphere',  geo: () => new THREE.SphereGeometry(0.8, 16, 12) },
    wedge:   { name: 'Wedge',   geo: () => createWedgeGeometry(1.6, 1.6, 1.6) },
    pyramid: { name: 'Pyramid', geo: () => new THREE.ConeGeometry(0.8, 1.6, 4) },
    bevel:   { name: 'Beveled', geo: () => createBeveledGeometry(1.6) }
};

function createWedgeGeometry(w, h, d) {
    const geo = new THREE.BufferGeometry();
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const verts = new Float32Array([
        // bottom face
        -hw, -hh, -hd,   hw, -hh, -hd,   hw, -hh,  hd,
        -hw, -hh, -hd,   hw, -hh,  hd,  -hw, -hh,  hd,
        // top back edge (ridge along -z)
        -hw,  hh, -hd,   hw,  hh, -hd,   hw, -hh,  hd,
        -hw,  hh, -hd,   hw, -hh,  hd,  -hw, -hh,  hd,
        // left face
        -hw, -hh, -hd,  -hw,  hh, -hd,  -hw, -hh,  hd,
        // right face
         hw, -hh, -hd,   hw,  hh, -hd,   hw, -hh,  hd,
        // back face
        -hw, -hh, -hd,   hw, -hh, -hd,   hw,  hh, -hd,
        -hw, -hh, -hd,   hw,  hh, -hd,  -hw,  hh, -hd,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
}

function createBeveledGeometry(size) {
    const r = size * 0.12;
    const hw = size / 2;
    const segments = 3;
    const shape = new THREE.Shape();
    const pts = [
        [-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]
    ];
    for (let i = 0; i < pts.length; i++) {
        const prev = pts[(i + 3) % 4];
        const cur = pts[i];
        const next = pts[(i + 1) % 4];
        const dx1 = cur[0] - prev[0], dy1 = cur[1] - prev[1];
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const dx2 = next[0] - cur[0], dy2 = next[1] - cur[1];
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const sx = dx1 / len1, sy = dy1 / len1;
        const ex = dx2 / len2, ey = dy2 / len2;
        shape.lineTo(cur[0] - sx * r, cur[1] - sy * r);
        shape.quadraticCurveTo(cur[0], cur[1], cur[0] - ex * r, cur[1] - ey * r);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: size, bevelEnabled: false });
}

const PART_COLORS = [
    { name: 'Brick yellow',  hex: '#cbc4a4' },
    { name: 'Light stone',   hex: '#b8a88a' },
    { name: 'Dark stone',    hex: '#6c6e68' },
    { name: 'Red',           hex: '#c04040' },
    { name: 'Blue',          hex: '#2060c0' },
    { name: 'Green',         hex: '#3ca040' },
    { name: 'Yellow',        hex: '#d8c030' },
    { name: 'Orange',        hex: '#d08030' },
    { name: 'Black',         hex: '#202020' },
    { name: 'White',         hex: '#e8e8e8' },
    { name: 'Pink',          hex: '#e070a0' },
    { name: 'Purple',        hex: '#8040c0' },
    { name: 'Cyan',          hex: '#40c0c0' },
    { name: 'Brown',         hex: '#6b4226' },
    { name: 'Sand',          hex: '#c8b888' },
    { name: 'Nougat',        hex: '#cc9e72' },
];

const MATERIAL_PRESETS = [
    { name: 'Plastic',   roughness: 0.5,  metalness: 0.0 },
    { name: 'Metal',     roughness: 0.3,  metalness: 0.8 },
    { name: 'Wood',      roughness: 0.85, metalness: 0.0 },
    { name: 'Glass',     roughness: 0.1,  metalness: 0.1, opacity: 0.4 },
    { name: 'Neon',      roughness: 0.3,  metalness: 0.0, emissive: 0.4 },
    { name: 'Diamond',   roughness: 0.05, metalness: 0.2, clearcoat: 1.0 },
    { name: 'Slate',     roughness: 0.9,  metalness: 0.0 },
    { name: 'Ice',       roughness: 0.15, metalness: 0.0, opacity: 0.7 },
];

let _scene = null;
let _camera = null;
let _renderer = null;
let _world = null;
let _container = null;

let _mode = 'freecam';
let _snapEnabled = SNAP_ENABLED_DEFAULT;
let _activeTool = 'select'; // 'select', 'move', 'rotate', 'scale'
let _activePartType = 'cube';
let _selectedColor = PART_COLORS[0].hex;
let _selectedMaterial = 0;
let _placedParts = [];
let _selectedPart = null;
let _hoveredPart = null;

// Freecam state
let _freecamPos = new THREE.Vector3(0, 20, 30);
let _freecamYaw = 0;
let _freecamPitch = -0.3;
let _freecamKeys = {};
let _freecamDragging = false;
let _freecamLastMouse = { x: 0, y: 0 };

// Selection highlight
let _selectionBox = null;
let _ghostPreview = null;

// Transform gizmo arrows
let _gizmoArrows = [];
let _draggingAxis = null;
let _dragStart = new THREE.Vector3();

// Move step
const MOVE_STEP = 0.8;
const SCALE_STEP = 0.2;
const MIN_SCALE = 0.2;
const MAX_SCALE = 20;

// Part registry
let _partIdCounter = 0;

function snapValue(v) {
    if (!_snapEnabled) return v;
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function snapVec3(vec) {
    return new THREE.Vector3(snapValue(vec.x), snapValue(vec.y), snapValue(vec.z));
}

function createPartMesh(type, color, position) {
    const def = PART_TYPES[type];
    if (!def) return null;

    const geo = def.geo();
    const matPreset = MATERIAL_PRESETS[_selectedMaterial];
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: matPreset.roughness,
        metalness: matPreset.metalness,
        transparent: (matPreset.opacity || 1) < 1,
        opacity: matPreset.opacity || 1,
    });
    if (matPreset.clearcoat) {
        mat.clearcoat = matPreset.clearcoat;
    }
    if (matPreset.emissive) {
        mat.emissive = new THREE.Color(color).multiplyScalar(matPreset.emissive);
    }
    mat.flatShading = false;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(snapVec3(position || new THREE.Vector3(0, GRID_SIZE / 2, 0)));
    mesh.userData.studioPart = true;
    mesh.userData.partId = ++_partIdCounter;
    mesh.userData.partType = type;
    mesh.userData.partColor = color;
    mesh.userData.partMaterial = _selectedMaterial;
    _scene.add(mesh);
    _placedParts.push(mesh);
    return mesh;
}

function updateSelectionHighlight() {
    if (_selectionBox) {
        _scene.remove(_selectionBox);
        _selectionBox.geometry.dispose();
        _selectionBox.material.dispose();
        _selectionBox = null;
    }
    if (!_selectedPart) return;
    const bb = new THREE.Box3().setFromObject(_selectedPart);
    const size = bb.getSize(new THREE.Vector3());
    const geo = new THREE.BoxGeometry(size.x + 0.1, size.y + 0.1, size.z + 0.1);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        depthTest: true,
    });
    _selectionBox = new THREE.Mesh(geo, mat);
    _selectionBox.position.copy(_selectedPart.position);
    _selectionBox.rotation.copy(_selectedPart.rotation);
    _selectionBox.renderOrder = 998;
    _scene.add(_selectionBox);
}

function updateGhostPreview(targetPoint) {
    if (!_ghostPreview) {
        const geo = PART_TYPES[_activePartType].geo();
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(_selectedColor),
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
        });
        _ghostPreview = new THREE.Mesh(geo, mat);
        _ghostPreview.renderOrder = 997;
        _scene.add(_ghostPreview);
    }
    const pos = snapVec3(targetPoint || new THREE.Vector3(0, GRID_SIZE / 2, 0));
    _ghostPreview.position.copy(pos);
    _ghostPreview.visible = true;
}

function hideGhostPreview() {
    if (_ghostPreview) _ghostPreview.visible = false;
}

function destroyGhostPreview() {
    if (_ghostPreview) {
        _scene.remove(_ghostPreview);
        _ghostPreview.geometry.dispose();
        _ghostPreview.material.dispose();
        _ghostPreview = null;
    }
}

function rebuildGhostForType() {
    destroyGhostPreview();
}

// Freecam controls
function setupFreecamInput(canvas) {
    window.addEventListener('keydown', (e) => {
        if (_mode !== 'freecam') return;
        _freecamKeys[e.key.toLowerCase()] = true;
        // Mode switch
        if (e.key === '2') setMode('play');
        // Snap toggle
        if (e.key.toLowerCase() === 'm') {
            _snapEnabled = !_snapEnabled;
            updateSnapUI();
        }
        // Tool shortcuts
        if (e.key === '1') setTool('select');
        if (e.key === '3') setTool('move');
        if (e.key === '4') setTool('rotate');
        if (e.key === '5') setTool('scale');
        // Delete selected
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedPart();
        }
        // Move tool keys
        if (_selectedPart) {
            movePartByKey(e.key);
        }
    });
    window.addEventListener('keyup', (e) => {
        _freecamKeys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousedown', (e) => {
        if (_mode !== 'freecam') return;
        if (e.button === 2) {
            _freecamDragging = true;
            _freecamLastMouse = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }
        if (e.button === 0) {
            handleStudioClick(e);
        }
    });
    canvas.addEventListener('contextmenu', (e) => {
        if (_mode === 'freecam') e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (_mode !== 'freecam') return;
        if (_freecamDragging) {
            const dx = e.clientX - _freecamLastMouse.x;
            const dy = e.clientY - _freecamLastMouse.y;
            _freecamYaw -= dx * 0.004;
            _freecamPitch -= dy * 0.004;
            _freecamPitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, _freecamPitch));
            _freecamLastMouse = { x: e.clientX, y: e.clientY };
        }
        updateFreecamHover(e);
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 2) _freecamDragging = false;
    });
}

function updateFreecam(dt) {
    if (_mode !== 'freecam') return;
    const speed = _freecamKeys['shift'] ? FREECAM_FAST_SPEED : FREECAM_SPEED;
    const forward = new THREE.Vector3(
        -Math.sin(_freecamYaw),
        0,
        -Math.cos(_freecamYaw)
    );
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const dir = new THREE.Vector3();
    if (_freecamKeys['w']) dir.add(forward);
    if (_freecamKeys['s']) dir.sub(forward);
    if (_freecamKeys['d']) dir.add(right);
    if (_freecamKeys['a']) dir.sub(right);
    if (_freecamKeys['q']) dir.y -= 1;
    if (_freecamKeys['e'] || _freecamKeys[' ']) dir.y += 1;
    if (dir.lengthSq() > 0) {
        dir.normalize().multiplyScalar(speed);
        _freecamPos.add(dir);
    }
    _camera.position.copy(_freecamPos);
    const lookTarget = new THREE.Vector3(
        _freecamPos.x + Math.sin(_freecamYaw) * -Math.cos(_freecamPitch),
        _freecamPos.y + Math.sin(_freecamPitch),
        _freecamPos.z + Math.cos(_freecamYaw) * -Math.cos(_freecamPitch)
    );
    _camera.lookAt(lookTarget);
}

function raycastFromMouse(e) {
    const canvas = _renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, _camera);
    return raycaster;
}

function handleStudioClick(e) {
    const raycaster = raycastFromMouse(e);
    // Check if clicking on a placed part
    const hits = raycaster.intersectObjects(_placedParts, false);
    if (hits.length > 0) {
        selectPart(hits[0].object);
        return;
    }
    // Place a new part at intersection with ground or existing parts
    const allTargets = [..._placedParts];
    if (_world && _world.ground) allTargets.push(_world.ground);
    const groundHits = raycaster.intersectObjects(allTargets, false);
    const targetPoint = groundHits.length > 0
        ? groundHits[0].point.clone()
        : new THREE.Vector3(0, GRID_SIZE / 2, 0);
    if (groundHits.length > 0 && groundHits[0].face) {
        targetPoint.add(groundHits[0].face.normal.multiplyScalar(GRID_SIZE / 2));
    }
    const part = createPartMesh(_activePartType, _selectedColor, targetPoint);
    if (part) {
        selectPart(part);
    }
}

function updateFreecamHover(e) {
    if (_mode !== 'freecam') return;
    const raycaster = raycastFromMouse(e);
    const hits = raycaster.intersectObjects(_placedParts, false);
    _hoveredPart = hits.length > 0 ? hits[0].object : null;
}

function selectPart(mesh) {
    _selectedPart = mesh;
    updateSelectionHighlight();
    updatePropertiesUI();
}

function deleteSelectedPart() {
    if (!_selectedPart) return;
    _scene.remove(_selectedPart);
    if (_selectedPart.geometry) _selectedPart.geometry.dispose();
    if (_selectedPart.material) _selectedPart.material.dispose();
    const idx = _placedParts.indexOf(_selectedPart);
    if (idx >= 0) _placedParts.splice(idx, 1);
    _selectedPart = null;
    updateSelectionHighlight();
    updatePropertiesUI();
}

function movePartByKey(key) {
    if (!_selectedPart) return;
    const step = _snapEnabled ? GRID_SIZE : MOVE_STEP;
    const p = _selectedPart.position;
    if (key === 'arrowright') p.x += step;
    if (key === 'arrowleft')  p.x -= step;
    if (key === 'arrowup')    p.z -= step;
    if (key === 'arrowdown')  p.z += step;
    if (key === 'pageup')     p.y += step;
    if (key === 'pagedown')   p.y -= step;
    // Rotation
    if (key === 'q') _selectedPart.rotation.y += ROTATION_STEP;
    if (key === 'r') _selectedPart.rotation.y -= ROTATION_STEP;
    // Scale
    if (key === 'f') {
        const s = Math.min(MAX_SCALE, _selectedPart.scale.x + SCALE_STEP);
        _selectedPart.scale.setScalar(s);
    }
    if (key === 'g') {
        const s = Math.max(MIN_SCALE, _selectedPart.scale.x - SCALE_STEP);
        _selectedPart.scale.setScalar(s);
    }
    updateSelectionHighlight();
    updatePropertiesUI();
}

function setMode(mode) {
    _mode = mode;
    if (mode === 'play') {
        hideGhostPreview();
        document.exitPointerLock && document.exitPointerLock();
    }
    updateModeUI();
}

function setTool(tool) {
    _activeTool = tool;
    updateToolUI();
}

function setPartType(type) {
    _activePartType = type;
    rebuildGhostForType();
}

function setColor(hex) {
    _selectedColor = hex;
    if (_selectedPart) {
        _selectedPart.material.color.set(hex);
        _selectedPart.userData.partColor = hex;
    }
    if (_ghostPreview) {
        _ghostPreview.material.color.set(hex);
    }
}

function setMaterial(index) {
    _selectedMaterial = index;
    const preset = MATERIAL_PRESETS[index];
    if (_selectedPart) {
        _selectedPart.material.roughness = preset.roughness;
        _selectedPart.material.metalness = preset.metalness;
        _selectedPart.material.opacity = preset.opacity || 1;
        _selectedPart.material.transparent = (preset.opacity || 1) < 1;
        _selectedPart.material.clearcoat = preset.clearcoat || 0;
        if (preset.emissive) {
            _selectedPart.material.emissive = new THREE.Color(_selectedPart.userData.partColor).multiplyScalar(preset.emissive);
        } else {
            _selectedPart.material.emissive = new THREE.Color(0);
        }
        _selectedPart.material.needsUpdate = true;
        _selectedPart.userData.partMaterial = index;
    }
}

function setPartScale(s) {
    if (_selectedPart) {
        _selectedPart.scale.setScalar(Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)));
        updateSelectionHighlight();
        updatePropertiesUI();
    }
}

function toggleSnap() {
    _snapEnabled = !_snapEnabled;
    updateSnapUI();
}

// Save / Load
function savePlace(name) {
    const data = {
        name: name || 'Untitled',
        timestamp: Date.now(),
        parts: _placedParts.map(p => ({
            type: p.userData.partType,
            color: p.userData.partColor,
            material: p.userData.partMaterial,
            px: p.position.x, py: p.position.y, pz: p.position.z,
            rx: p.rotation.x, ry: p.rotation.y, rz: p.rotation.z,
            sx: p.scale.x, sy: p.scale.y, sz: p.scale.z,
        })),
    };
    const saves = JSON.parse(localStorage.getItem('studio_saves') || '[]');
    const existing = saves.findIndex(s => s.name === data.name);
    if (existing >= 0) saves[existing] = data;
    else saves.push(data);
    localStorage.setItem('studio_saves', JSON.stringify(saves));
    return data;
}

function loadPlace(name) {
    const saves = JSON.parse(localStorage.getItem('studio_saves') || '[]');
    const data = saves.find(s => s.name === name);
    if (!data) return false;
    clearAllParts();
    data.parts.forEach(p => {
        const mesh = createPartMesh(p.type, p.color, new THREE.Vector3(p.px, p.py, p.pz));
        if (mesh) {
            mesh.rotation.set(p.rx, p.ry, p.rz);
            mesh.scale.set(p.sx, p.sy, p.sz);
            if (typeof p.material === 'number') {
                mesh.userData.partMaterial = p.material;
            }
        }
    });
    return true;
}

function deleteSave(name) {
    const saves = JSON.parse(localStorage.getItem('studio_saves') || '[]');
    const filtered = saves.filter(s => s.name !== name);
    localStorage.setItem('studio_saves', JSON.stringify(filtered));
}

function getSaveList() {
    return JSON.parse(localStorage.getItem('studio_saves') || '[]');
}

function clearAllParts() {
    _placedParts.forEach(p => {
        _scene.remove(p);
        if (p.geometry) p.geometry.dispose();
        if (p.material) p.material.dispose();
    });
    _placedParts = [];
    _selectedPart = null;
    _partIdCounter = 0;
    updateSelectionHighlight();
}

// Export place data for sharing
function exportPlace() {
    return JSON.stringify({
        name: 'Exported Place',
        timestamp: Date.now(),
        parts: _placedParts.map(p => ({
            type: p.userData.partType,
            color: p.userData.partColor,
            material: p.userData.partMaterial,
            px: p.position.x, py: p.position.y, pz: p.position.z,
            rx: p.rotation.x, ry: p.rotation.y, rz: p.rotation.z,
            sx: p.scale.x, sy: p.scale.y, sz: p.scale.z,
        })),
    });
}

// Publish to localStorage as a "shared" place
function publishPlace(name) {
    const data = {
        name: name || 'Untitled',
        author: localStorage.getItem('cs_username') || 'Guest',
        timestamp: Date.now(),
        parts: _placedParts.map(p => ({
            type: p.userData.partType,
            color: p.userData.partColor,
            material: p.userData.partMaterial,
            px: p.position.x, py: p.position.y, pz: p.position.z,
            rx: p.rotation.x, ry: p.rotation.y, rz: p.rotation.z,
            sx: p.scale.x, sy: p.scale.y, sz: p.scale.z,
        })),
    };
    const published = JSON.parse(localStorage.getItem('studio_published') || '[]');
    const existing = published.findIndex(s => s.name === data.name && s.author === data.author);
    if (existing >= 0) published[existing] = data;
    else published.push(data);
    localStorage.setItem('studio_published', JSON.stringify(published));
    return data;
}

function getPublishedList() {
    return JSON.parse(localStorage.getItem('studio_published') || '[]');
}

function loadPublished(name, author) {
    const published = JSON.parse(localStorage.getItem('studio_published') || '[]');
    const data = published.find(s => s.name === name && s.author === author);
    if (!data) return false;
    clearAllParts();
    data.parts.forEach(p => {
        const mesh = createPartMesh(p.type, p.color, new THREE.Vector3(p.px, p.py, p.pz));
        if (mesh) {
            mesh.rotation.set(p.rx, p.ry, p.rz);
            mesh.scale.set(p.sx, p.sy, p.sz);
            if (typeof p.material === 'number') {
                mesh.userData.partMaterial = p.material;
            }
        }
    });
    return true;
}

// UI update stubs (wired up by studio_ui.js)
let _snapUIFn = null;
let _modeUIFn = null;
let _toolUIFn = null;
let _propsUIFn = null;

function updateSnapUI()  { if (_snapUIFn) _snapUIFn(_snapEnabled); }
function updateModeUI() { if (_modeUIFn) _modeUIFn(_mode); }
function updateToolUI() { if (_toolUIFn) _toolUIFn(_activeTool); }
function updatePropertiesUI() { if (_propsUIFn) _propsUIFn(_selectedPart); }

function initStudio(scene, camera, renderer, world) {
    _scene = scene;
    _camera = camera;
    _renderer = renderer;
    _world = world;
    _container = _renderer.domElement.parentElement || document.getElementById('container');
    setupFreecamInput(_renderer.domElement);
    return { getMode: () => _mode };
}

function updateStudio(dt) {
    updateFreecam(dt);
    if (_selectionBox && _selectedPart) {
        _selectionBox.position.copy(_selectedPart.position);
        _selectionBox.rotation.copy(_selectedPart.rotation);
    }
}

const _getMode = () => _mode;
const _getSnapEnabled = () => _snapEnabled;
const _getActiveTool = () => _activeTool;
const _getActivePartType = () => _activePartType;
const _getSelectedColor = () => _selectedColor;
const _getSelectedMaterial = () => _selectedMaterial;
const _getSelectedPart = () => _selectedPart;
const _getPlacedParts = () => _placedParts;
function _setOnSnapUI(fn) { _snapUIFn = fn; }
function _setOnModeUI(fn) { _modeUIFn = fn; }
function _setOnToolUI(fn) { _toolUIFn = fn; }
function _setOnPropsUI(fn) { _propsUIFn = fn; }

export {
    initStudio, updateStudio, setMode, setTool, setPartType,
    setColor, setMaterial, setPartScale, toggleSnap, deleteSelectedPart,
    savePlace, loadPlace, deleteSave, getSaveList, clearAllParts,
    exportPlace, publishPlace, getPublishedList, loadPublished,
    PART_TYPES, PART_COLORS, MATERIAL_PRESETS,
    _getMode as mode,
    _getSnapEnabled as snapEnabled,
    _getActiveTool as activeTool,
    _getActivePartType as activePartType,
    _getSelectedColor as selectedColor,
    _getSelectedMaterial as selectedMaterial,
    _getSelectedPart as selectedPart,
    _getPlacedParts as placedParts,
    _setOnSnapUI as onSnapUI,
    _setOnModeUI as onModeUI,
    _setOnToolUI as onToolUI,
    _setOnPropsUI as onPropsUI,
};
