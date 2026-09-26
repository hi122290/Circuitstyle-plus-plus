// place_runtime.js — shared place engine for Circuitstyle Studio.
// Loads a published place manifest (parts, materials, scripts, tools) into a
// THREE scene, runs the scripting layer (game API, per-part hooks, inventory /
// tools) and does collision/touch events. Consumed by studio.html (edit+play
// test) and main.js (game mode, index.html?place=<id>). No build step.

import * as THREE from 'three';

export const PLACES_KEY = 'cs_places';
export const PLACE_SCHEMA = 'circuitstyle-place@1';

// ─── Part base sizes (world units, before scale) ───────────────────────────
export const PART_BASE_SIZES = {
    box:      { w: 4,   h: 2,   d: 4 },
    sphere:   { w: 3,   h: 3,   d: 3 },
    cylinder: { w: 3,   h: 4,   d: 3 },
    wedge:    { w: 4,   h: 2,   d: 4 },
    ground:   { w: 64,  h: 1,   d: 64 }
};

export const PART_TYPE_NAMES = {
    box: 'Box', sphere: 'Sphere', cylinder: 'Cylinder', wedge: 'Wedge', ground: 'Terrain'
};

// ─── Geometry ──────────────────────────────────────────────────────────────
export function createWedgeGeometry(w, h, d) {
    const geo = new THREE.BufferGeometry();
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const verts = new Float32Array([
        -hw, -hh, -hd,   hw, -hh, -hd,   hw, -hh,  hd,
        -hw, -hh, -hd,   hw, -hh,  hd,  -hw, -hh,  hd,
        -hw,  hh, -hd,   hw,  hh, -hd,   hw, -hh,  hd,
        -hw,  hh, -hd,   hw, -hh,  hd,  -hw, -hh,  hd,
        -hw, -hh, -hd,  -hw,  hh, -hd,  -hw, -hh,  hd,
         hw, -hh, -hd,   hw,  hh, -hd,   hw, -hh,  hd,
        -hw, -hh, -hd,   hw, -hh, -hd,   hw,  hh, -hd,
        -hw, -hh, -hd,   hw,  hh, -hd,  -hw,  hh, -hd
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    // simple planar UVs so textured materials have something to sample
    const uvs = new Float32Array((verts.length / 3) * 2);
    for (let i = 0; i < verts.length / 3; i++) {
        uvs[i * 2] = (verts[i * 3] + hw) / (w || 1);
        uvs[i * 2 + 1] = (verts[i * 3 + 1] + hh) / (h || 1);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
}

export function createPartGeometry(type) {
    const s = PART_BASE_SIZES[type] || PART_BASE_SIZES.box;
    switch (type) {
        case 'sphere':   return new THREE.SphereGeometry(s.w / 2, 24, 16);
        case 'cylinder': return new THREE.CylinderGeometry(s.w / 2, s.w / 2, s.h, 24);
        case 'wedge':    return createWedgeGeometry(s.w, s.h, s.d);
        default:         return new THREE.BoxGeometry(s.w, s.h, s.d);
    }
}

// ─── Procedural texture atlas (canvas, grayscale so tint colors show) ─────
const ATLAS_DEFS = {
    none:    null,
    studs:   drawStuds,
    brick:   drawBrick,
    grass:   drawGrass,
    wood:    drawWood,
    metal:   drawMetal,
    checker: drawChecker
};

export const ATLAS_KEYS = Object.keys(ATLAS_DEFS);
const _atlasCache = {};

function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
}

function drawStuds(g, S) {
    g.fillStyle = '#cfcfcf';
    g.fillRect(0, 0, S, S);
    const n = 4, cell = S / n, r = cell * 0.32;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const cx = cell * (x + 0.5), cy = cell * (y + 0.5);
        g.fillStyle = '#9a9a9a';
        g.beginPath(); g.arc(cx, cy + cell * 0.06, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#efefef';
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2); g.fill();
    }
}

function drawBrick(g, S) {
    g.fillStyle = '#b8b8b8';
    g.fillRect(0, 0, S, S);
    const rows = 6, bh = S / rows, bw = S / 3;
    g.fillStyle = '#dcdcdc';
    for (let r = 0; r < rows; r++) {
        const off = (r % 2) * bw * 0.5;
        for (let cX = -1; cX < 4; cX++) {
            g.fillRect(cX * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
        }
    }
}

function drawGrass(g, S) {
    g.fillStyle = '#c6c6c6';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
        const v = 140 + Math.floor(Math.random() * 100);
        g.fillStyle = `rgb(${v},${v},${v})`;
        const x = Math.random() * S, y = Math.random() * S;
        g.fillRect(x, y, 2, 3 + Math.random() * 4);
    }
}

function drawWood(g, S) {
    g.fillStyle = '#c9b79c';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
        g.strokeStyle = i % 2 ? 'rgba(90,60,30,0.35)' : 'rgba(150,110,70,0.3)';
        g.lineWidth = 1 + Math.random() * 3;
        g.beginPath();
        const x = Math.random() * S;
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 10, S * 0.3, x - 10, S * 0.7, x + 5, S);
        g.stroke();
    }
}

function drawMetal(g, S) {
    g.fillStyle = '#bdbdbd';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
        const v = 150 + Math.floor(Math.random() * 90);
        g.strokeStyle = `rgba(${v},${v},${v},0.5)`;
        g.lineWidth = 1;
        const y = Math.random() * S;
        g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
    }
    g.strokeStyle = 'rgba(80,80,80,0.55)';
    g.lineWidth = 3;
    g.strokeRect(4, 4, S - 8, S - 8);
    [[10, 10], [S - 10, 10], [10, S - 10], [S - 10, S - 10]].forEach(([x, y]) => {
        g.fillStyle = '#8a8a8a';
        g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    });
}

function drawChecker(g, S) {
    const n = 8, cell = S / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#8f8f8f' : '#e6e6e6';
        g.fillRect(x * cell, y * cell, cell, cell);
    }
}

export function getAtlasTexture(key) {
    if (!key || key === 'none') return null;
    if (key.startsWith('data:')) return getDataTexture(key);
    const fn = ATLAS_DEFS[key];
    if (!fn) return null;
    if (_atlasCache[key]) return _atlasCache[key];
    const S = 128;
    const c = makeCanvas(S);
    fn(c.getContext('2d'), S);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    _atlasCache[key] = tex;
    return tex;
}

const _dataTexCache = {};
function getDataTexture(url) {
    if (_dataTexCache[url]) return _dataTexCache[url];
    const tex = new THREE.TextureLoader().load(url, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.magFilter = THREE.LinearFilter;
        t.minFilter = THREE.LinearFilter;
        t.needsUpdate = true;
    });
    _dataTexCache[url] = tex;
    return tex;
}

// Downscale an uploaded image to a <=256px JPEG data URL (keeps manifests small)
export function fileToTextureDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('could not read file'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('not an image'));
            img.onload = () => {
                const MAX = 256;
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    const k = Math.min(MAX / w, MAX / h);
                    w = Math.round(w * k); h = Math.round(h * k);
                }
                const c = makeCanvas(Math.max(1, w));
                c.height = Math.max(1, h);
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0, c.width, c.height);
                resolve(c.toDataURL('image/jpeg', 0.82));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// ─── Materials ─────────────────────────────────────────────────────────────
export const MATERIAL_PRESETS = {
    Plastic: { roughness: 0.5,  metalness: 0.0 },
    Metal:   { roughness: 0.3,  metalness: 0.8 },
    Wood:    { roughness: 0.85, metalness: 0.0 },
    Glass:   { roughness: 0.1,  metalness: 0.1, opacity: 0.4, transparent: true },
    Neon:    { roughness: 0.3,  metalness: 0.0, emissiveIntensity: 0.6 },
    Slate:   { roughness: 0.9,  metalness: 0.0 }
};

export const PART_COLOR_PRESETS = [
    { name: 'Brick yellow', hex: '#cbc4a4' },
    { name: 'Light stone',  hex: '#b8a88a' },
    { name: 'Dark stone',   hex: '#6c6e68' },
    { name: 'Red',          hex: '#c04040' },
    { name: 'Blue',         hex: '#2060c0' },
    { name: 'Green',        hex: '#3ca040' },
    { name: 'Yellow',       hex: '#d8c030' },
    { name: 'Orange',       hex: '#d08030' },
    { name: 'Black',        hex: '#202020' },
    { name: 'White',        hex: '#e8e8e8' },
    { name: 'Pink',         hex: '#e070a0' },
    { name: 'Purple',       hex: '#8040c0' },
    { name: 'Cyan',         hex: '#40c0c0' },
    { name: 'Brown',        hex: '#6b4226' },
    { name: 'Sand',         hex: '#c8b888' },
    { name: 'Nougat',       hex: '#cc9e72' }
];

export function buildPartMaterial(def) {
    const preset = MATERIAL_PRESETS[def.material] || MATERIAL_PRESETS.Plastic;
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(def.color || '#a3a3a3'),
        roughness: preset.roughness,
        metalness: preset.metalness
    });
    if (preset.transparent) {
        mat.transparent = true;
        mat.opacity = preset.opacity;
    }
    if (preset.emissiveIntensity) {
        mat.emissive = new THREE.Color(def.color || '#a3a3a3');
        mat.emissiveIntensity = preset.emissiveIntensity;
    }
    let tex = getAtlasTexture(def.texture);
    if (tex) {
        tex = tex.clone();
        tex.needsUpdate = true;
        const size = PART_BASE_SIZES[def.type] || PART_BASE_SIZES.box;
        const maxDim = Math.max(size.w, size.h, size.d) * Math.max(def.scale ? def.scale[0] : 1, def.scale ? def.scale[1] : 1, def.scale ? def.scale[2] : 1);
        const rep = Math.min(64, Math.max(1, Math.round(maxDim / 4)));
        tex.repeat.set(rep, rep);
        mat.map = tex;
    }
    return mat;
}

// ─── Manifest defaults ─────────────────────────────────────────────────────
let _idCounter = 0;
export function genId(prefix) {
    _idCounter++;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}${_idCounter}`;
}

export function defaultPartDef(type) {
    const size = PART_BASE_SIZES[type] || PART_BASE_SIZES.box;
    return {
        id: genId('part'),
        name: type === 'ground' ? 'Terrain' : `${PART_TYPE_NAMES[type] || 'Part'}`,
        type,
        parent: null,
        position: [0, size.h / 2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: type === 'ground' ? '#3ca040' : '#a3a3a3',
        texture: type === 'ground' ? 'grass' : 'studs',
        material: 'Plastic',
        collidable: true,
        damage: 0,
        spawn: false,
        scripts: []
    };
}

export function emptyManifest(name) {
    return {
        schema: PLACE_SCHEMA,
        id: genId('place'),
        name: name || 'Untitled Place',
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnail: null,
        parts: [],
        scripts: [],
        tools: [],
        startTools: []
    };
}

// ─── Place storage (localStorage) ──────────────────────────────────────────
export function listPlaces() {
    try {
        const raw = localStorage.getItem(PLACES_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

export function getPlace(id) {
    return listPlaces().find((p) => p.id === id) || null;
}

export function savePlace(manifest) {
    manifest.updatedAt = Date.now();
    const places = listPlaces();
    const idx = places.findIndex((p) => p.id === manifest.id);
    if (idx >= 0) places[idx] = manifest;
    else places.push(manifest);
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
    return manifest;
}

export function deletePlace(id) {
    const places = listPlaces().filter((p) => p.id !== id);
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
    return places;
}

// ─── Script compilation ────────────────────────────────────────────────────
// Scripts are plain JS (functions get game/part/other/player/tool/event args)
export function compileScript(code, label) {
    try {
        return new Function('game', 'part', 'other', 'player', 'tool', 'event', '"use strict";\n' + (code || ''));
    } catch (e) {
        console.warn(`[Place] script "${label}" failed to compile:`, e.message);
        return null;
    }
}

function runScript(fn, args, label) {
    if (!fn) return;
    try {
        fn.apply(null, args);
    } catch (e) {
        console.warn(`[Place] script "${label}" errored:`, e);
        if (window._placeRuntimeLog) window._placeRuntimeLog(`ERROR in "${label}": ${e.message}`);
    }
}

// ─── Script-facing part wrapper (Roblox-ish surface) ───────────────────────
function makeVec3Accessors(get, set) {
    return {
        get x() { return get().x; },
        set x(v) { const p = get(); p.x = v; set(); },
        get y() { return get().y; },
        set y(v) { const p = get(); p.y = v; set(); },
        get z() { return get().z; },
        set z(v) { const p = get(); p.z = v; set(); }
    };
}

function makePartWrapper(entry, runtime) {
    const mesh = entry.mesh;
    const def = entry.def;
    const wrapper = {
        id: def.id,
        get name() { return def.name; },
        set name(v) { def.name = String(v); },
        type: def.type,
        get parent() {
            if (!def.parent) return null;
            const pe = runtime.parts.get(def.parent);
            return pe ? pe.wrapper : null;
        },
        set parent(p) { runtime.reparent(def.id, p ? (p.id || p) : null); },
        position: makeVec3Accessors(() => mesh.position, () => { mesh.position.set(mesh.position.x, mesh.position.y, mesh.position.z); entry._moved = true; }),
        rotation: makeVec3Accessors(
            () => mesh.rotation,
            () => { entry._moved = true; }
        ),
        scale: makeVec3Accessors(() => mesh.scale, () => { entry._scaleDirty = true; }),
        get color() { return '#' + mesh.material.color.getHexString(); },
        set color(v) {
            try {
                mesh.material.color.set(v);
                if ((mesh.material.emissiveIntensity || 0) > 0) mesh.material.emissive.set(v);
                def.color = String(v);
            } catch (e) {}
        },
        get texture() { return def.texture; },
        set texture(v) { runtime.applyPartVisual(def.id); },
        get visible() { return mesh.visible; },
        set visible(v) { mesh.visible = !!v; def.visible = v !== false; },
        get collidable() { return def.collidable !== false; },
        set collidable(v) { def.collidable = v !== false; },
        get damage() { return def.damage || 0; },
        set damage(v) { def.damage = Number(v) || 0; },
        onTouch(cb) {
            if (typeof cb === 'function') (entry.listeners.touched || (entry.listeners.touched = [])).push(cb);
        },
        onClick(cb) {
            if (typeof cb === 'function') (entry.listeners.clicked || (entry.listeners.clicked = [])).push(cb);
        },
        destroy() { runtime.destroyPart(def.id); },
        // helpers
        getPosition() { return { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }; },
        setPosition(x, y, z) { mesh.position.set(x, y, z); entry._moved = true; },
        translate(x, y, z) { mesh.position.x += x; mesh.position.y += y; mesh.position.z += z; entry._moved = true; },
        setRotationDeg(dx, dy, dz) {
            mesh.rotation.set(THREE.MathUtils.degToRad(dx), THREE.MathUtils.degToRad(dy), THREE.MathUtils.degToRad(dz));
            entry._moved = true;
        },
        getRotationDeg() {
            return {
                x: THREE.MathUtils.radToDeg(mesh.rotation.x),
                y: THREE.MathUtils.radToDeg(mesh.rotation.y),
                z: THREE.MathUtils.radToDeg(mesh.rotation.z)
            };
        },
        setColor(c) { this.color = c; },
        getSize() { const b = new THREE.Box3().setFromObject(mesh); const s = new THREE.Vector3(); b.getSize(s); return { x: s.x, y: s.y, z: s.z }; }
    };
    return wrapper;
}

// ─── Runtime ───────────────────────────────────────────────────────────────
export class PlaceRuntime {
    constructor(opts) {
        this.scene = opts.scene;
        this.camera = opts.camera || null;
        this.renderer = opts.renderer || null;
        this.manifest = opts.manifest;
        this.mode = opts.mode || 'studio'; // 'studio' | 'game'
        this.adapter = opts.adapter || null;
        this.running = false;
        this.parts = new Map();        // id -> entry {def, mesh, wrapper, listeners, scriptFns}
        this.scripts = [];             // {def, start, update, touched, clicked, partId}
        this.tools = new Map();        // id -> {def, onEquip, onActivate, onUnequip}
        this.owned = [];               // tool ids in inventory order
        this.equippedId = null;
        this._eventHandlers = {};
        this._timers = [];             // {due (ms), every, fn, id}
        this._timerId = 0;
        this._round = null;            // {endsAt, lastTick}
        this._hud = null;
        this._hitPulse = new Set();    // ids touched last tick
        this._studioInput = null;
        this._name = (this.adapter && this.adapter.getName && this.adapter.getName()) || 'Builder';
        this._health = 100;
        this._maxHealth = 100;
        this._playTime = 0;
        window._placeRuntimeLog = (msg) => this.log(msg);
    }

    log(msg) {
        if (this.onLog) this.onLog(msg);
        else console.log('[Place]', msg);
    }

    // ── scene build ────────────────────────────────────────────────────────
    buildPart(def) {
        const geo = createPartGeometry(def.type);
        const mesh = new THREE.Mesh(geo, buildPartMaterial(def));
        mesh.name = def.name || 'Part';
        mesh.position.fromArray(def.position || [0, 1, 0]);
        mesh.rotation.fromArray(def.rotation || [0, 0, 0]);
        mesh.scale.fromArray(def.scale || [1, 1, 1]);
        mesh.visible = def.visible !== false;
        mesh.castShadow = def.type !== 'ground';
        mesh.receiveShadow = true;
        mesh.userData.partId = def.id;
        const entry = {
            def,
            mesh,
            wrapper: null,
            listeners: { touched: [], clicked: [] },
            scriptFns: [],
            _moved: false,
            dynamic: !!def.spawned
        };
        entry.wrapper = makePartWrapper(entry, this);
        mesh.userData._partEntry = entry;
        return entry;
    }

    _resolveParent(mesh, def) {
        if (def.parent && this.parts.has(def.parent)) {
            this.parts.get(def.parent).mesh.add(mesh);
        } else {
            this.scene.add(mesh);
        }
    }

    buildScene() {
        // create all entries first so parent links always resolve
        const defs = (this.manifest.parts || []);
        const created = [];
        for (const def of defs) {
            if (this.parts.has(def.id)) continue;
            const entry = this.buildPart(def);
            this.parts.set(def.id, entry);
            created.push(entry);
        }
        for (const entry of created) this._resolveParent(entry.mesh, entry.def);
        // register with the game's physics so loaded parts are solid
        if (this.mode === 'game' && this.adapter && this.adapter.registerCollider) {
            for (const entry of created) {
                if (entry.def.collidable !== false) this.adapter.registerCollider(entry.mesh);
            }
        }
    }

    refreshScene() {
        // rebuild meshes for any defs not yet instantiated (used by studio reload)
        for (const def of (this.manifest.parts || [])) {
            if (!this.parts.has(def.id)) this.buildScene();
        }
    }

    applyPartVisual(id) {
        const entry = this.parts.get(id);
        if (!entry) return;
        const old = entry.mesh.material;
        entry.mesh.material = buildPartMaterial(entry.def);
        if (old) old.dispose();
    }

    reparent(id, newParentId) {
        const entry = this.parts.get(id);
        if (!entry) return;
        entry.def.parent = newParentId;
        const parentEntry = newParentId ? this.parts.get(newParentId) : null;
        const target = parentEntry ? parentEntry.mesh : this.scene;
        target.attach(entry.mesh); // preserves world transform
        entry.mesh.updateMatrixWorld(true);
    }

    spawnPart(defOverrides) {
        const def = Object.assign(defaultPartDef((defOverrides && defOverrides.type) || 'box'), defOverrides || {});
        if (this.parts.has(def.id)) return this.parts.get(def.id).wrapper;
        def.spawned = true;
        const entry = this.buildPart(def);
        this.parts.set(def.id, entry);
        this._resolveParent(entry.mesh, def);
        if (this.mode === 'game' && def.collidable !== false && this.adapter && this.adapter.registerCollider) this.adapter.registerCollider(entry.mesh);
        // give the manifest a record so serializations see runtime spawns
        if (!this.manifest.parts) this.manifest.parts = [];
        this.manifest.parts.push(def);
        this.log(`spawned part "${def.name}"`);
        this.emit('partSpawned', entry.wrapper);
        return entry.wrapper;
    }

    destroyPart(idOrWrapper) {
        const id = typeof idOrWrapper === 'string' ? idOrWrapper : (idOrWrapper && idOrWrapper.id);
        const entry = this.parts.get(id);
        if (!entry) return false;
        try {
            if (entry.mesh.parent) entry.mesh.parent.remove(entry.mesh);
        } catch (e) {}
        entry.mesh.traverse((n) => {
            if (n.geometry) n.geometry.dispose();
            if (n.material && n.material.dispose) n.material.dispose();
        });
        this.parts.delete(id);
        const pi = (this.manifest.parts || []).findIndex((p) => p.id === id);
        if (pi >= 0) this.manifest.parts.splice(pi, 1);
        if (this.mode === 'game' && this.adapter && this.adapter.unregisterCollider) this.adapter.unregisterCollider(entry.mesh);
        this.emit('partDestroyed', entry.wrapper);
        return true;
    }

    // ── events ─────────────────────────────────────────────────────────────
    on(name, fn) {
        if (typeof fn !== 'function') return;
        (this._eventHandlers[name] || (this._eventHandlers[name] = [])).push(fn);
    }

    off(name, fn) {
        const arr = this._eventHandlers[name];
        if (!arr) return;
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
    }

    emit(name, ...args) {
        const arr = this._eventHandlers[name];
        if (arr) for (const fn of arr.slice()) runScript(fn, args, `on:${name}`);
        return undefined;
    }

    after(sec, fn) {
        const id = ++this._timerId;
        this._timers.push({ id, due: this._playTime + sec * 1000, every: 0, fn });
        return id;
    }

    every(sec, fn) {
        const id = ++this._timerId;
        this._timers.push({ id, due: this._playTime + sec * 1000, every: sec * 1000, fn });
        return id;
    }

    cancel(id) {
        const i = this._timers.findIndex((t) => t.id === id);
        if (i >= 0) this._timers.splice(i, 1);
    }

    startRound(seconds) {
        const dur = Math.max(1, Number(seconds) || 60);
        this._round = { endsAt: this._playTime + dur * 1000, lastTick: dur, duration: dur };
        this.log(`round started (${dur}s)`);
        this.emit('roundStart', dur);
        this.emit('timer', dur);
    }

    // ── game API object ────────────────────────────────────────────────────
    _makeApi() {
        const rt = this;
        const inventory = {
            give(toolId) {
                if (!rt.tools.has(toolId)) {
                    rt.defineTool({ id: toolId, name: toolId, description: '' });
                }
                if (rt.owned.indexOf(toolId) !== -1) return false;
                rt.owned.push(toolId);
                if (rt.owned.length === 1) inventory.equip(toolId);
                rt.log(`inventory.give("${toolId}")`);
                return true;
            },
            remove(toolId) {
                const i = rt.owned.indexOf(toolId);
                if (i === -1) return false;
                rt.owned.splice(i, 1);
                if (rt.equippedId === toolId) rt._equipTool(null);
                rt.log(`inventory.remove("${toolId}")`);
                return true;
            },
            has(toolId) { return rt.owned.indexOf(toolId) !== -1; },
            list() { return rt.owned.slice(); },
            get equipped() { return rt.equippedId ? rt.tools.get(rt.equippedId) : null; },
            equip(toolId) { return rt._equipTool(toolId); },
            use() { return rt._activateTool(); }
        };

        const localPlayer = {
            get name() { return rt._name; },
            get health() { return rt._currentHealth(); },
            set health(v) { rt._setHealth(v); },
            get maxHealth() { return rt._maxHealth; },
            get position() {
                const p = rt._playerPosition();
                return { x: p.x, y: p.y, z: p.z };
            },
            teleport(x, y, z) { rt._teleportPlayer(x, y, z); },
            damage(n) { rt._damage(Math.max(0, Number(n) || 0)); },
            heal(n) { rt._setHealth(rt._currentHealth() + Math.max(0, Number(n) || 0)); },
            inventory,
            get tool() { return inventory.equipped; }
        };

        const api = {
            getPart(nameOrId) {
                for (const [, entry] of rt.parts) {
                    if (entry.def.id === nameOrId || entry.def.name === nameOrId) return entry.wrapper;
                }
                return null;
            },
            get parts() {
                return Array.from(rt.parts.values()).map((e) => e.wrapper);
            },
            spawnPart(defOverrides) { return rt.spawnPart(defOverrides); },
            destroy(ref) { return rt.destroyPart(ref); },
            on(name, fn) { rt.on(name, fn); },
            off(name, fn) { rt.off(name, fn); },
            emit(name, ...args) { rt.emit(name, ...args); },
            startRound(seconds) { rt.startRound(seconds); },
            get round() {
                if (!rt._round) return null;
                const left = Math.max(0, Math.ceil((rt._round.endsAt - rt._playTime) / 1000));
                return { timeLeft: left, duration: rt._round.duration };
            },
            after(sec, fn) { return rt.after(sec, fn); },
            every(sec, fn) { return rt.every(sec, fn); },
            cancel(id) { rt.cancel(id); },
            players: [localPlayer],
            localPlayer,
            player: localPlayer,
            inventory,
            tools: {
                define(def) { return rt.defineTool(def); },
                get(id) { return rt.tools.get(id) || null; },
                all() { return Array.from(rt.tools.values()).map((t) => t.def); }
            },
            toast(msg) { rt._toast(String(msg)); },
            log(...args) { rt.log(args.join(' ')); },
            get mode() { return rt.mode; }
        };
        return api;
    }

    defineTool(def) {
        if (!def || !def.id) return null;
        const rec = {
            def: Object.assign({ id: def.id, name: def.name || def.id, description: '', color: '#4a90d9' }, def),
            onEquip: typeof def.onEquip === 'function' ? def.onEquip : compileScript(def.equipCode, `tool:${def.id}:equip`),
            onActivate: typeof def.onActivate === 'function' ? def.onActivate : compileScript(def.activateCode, `tool:${def.id}:activate`),
            onUnequip: typeof def.onUnequip === 'function' ? def.onUnequip : compileScript(def.unequipCode, `tool:${def.id}:unequip`)
        };
        this.tools.set(def.id, rec);
        return rec;
    }

    // ── health / player adapters ───────────────────────────────────────────
    _currentHealth() {
        if (this.mode === 'game' && this.adapter && this.adapter.getHealth) return this.adapter.getHealth();
        return this._health;
    }

    _setHealth(v) {
        const h = Math.max(0, Math.min(this._maxHealth, Number(v) || 0));
        if (this.mode === 'game' && this.adapter && this.adapter.setHealth) this.adapter.setHealth(h);
        else this._health = h;
        this._renderHealth();
    }

    _damage(n) {
        const h = this._currentHealth() - n;
        if (this.mode === 'game' && this.adapter && this.adapter.damage) {
            this.adapter.damage(n);
        } else {
            this._setHealth(h);
            if (h <= 0 && this.mode === 'studio') {
                this._toast('Oof! Respawning...');
                this.after(1.2, () => {
                    this._setHealth(this._maxHealth);
                    this._teleportPlayer(...this._spawnPos());
                });
            }
        }
        this.emit('playerDamaged', n);
    }

    _playerPosition() {
        if (this.mode === 'studio') return this._studioPlayer ? this._studioPlayer.pos : { x: 0, y: 0, z: 0 };
        if (this.adapter && this.adapter.getPosition) return this.adapter.getPosition();
        return { x: 0, y: 0, z: 0 };
    }

    _teleportPlayer(x, y, z) {
        if (this.mode === 'studio' && this._studioPlayer) {
            this._studioPlayer.pos.set(x, y, z);
            this._studioPlayer.vel.set(0, 0, 0);
            this._syncStudioPlayerMesh();
        } else if (this.adapter && this.adapter.teleport) {
            this.adapter.teleport(x, y, z);
        }
    }

    _spawnPos() {
        const spawnDef = (this.manifest.parts || []).find((p) => p.spawn);
        if (spawnDef) {
            const base = PART_BASE_SIZES[spawnDef.type] || PART_BASE_SIZES.box;
            return [spawnDef.position[0], spawnDef.position[1] + (base.h * (spawnDef.scale ? spawnDef.scale[1] : 1)) / 2 + 0.1, spawnDef.position[2]];
        }
        return [0, 3, 0];
    }

    // ── tools ──────────────────────────────────────────────────────────────
    _equipTool(toolId) {
        if (toolId && this.owned.indexOf(toolId) === -1) return false;
        if (toolId && !this.tools.has(toolId)) return false;
        if (this.equippedId === toolId) return true;
        const prev = this.equippedId ? this.tools.get(this.equippedId) : null;
        if (prev && prev.onUnequip) runScript(prev.onUnequip, [this.gameObject, prev.def, this._playerObject()], `tool:${prev.def.id}:unequip`);
        this.equippedId = toolId;
        const rec = toolId ? this.tools.get(toolId) : null;
        if (rec && rec.onEquip) runScript(rec.onEquip, [this.gameObject, rec.def, this._playerObject()], `tool:${rec.def.id}:equip`);
        if (rec) this.log(`equipped "${rec.def.name}"`);
        return true;
    }

    _activateTool() {
        if (!this.equippedId) return false;
        const rec = this.tools.get(this.equippedId);
        if (!rec) return false;
        if (rec.onActivate) runScript(rec.onActivate, [this.gameObject, rec.def, this._playerObject()], `tool:${rec.def.id}:activate`);
        return true;
    }

    _playerObject() {
        return this.gameObject ? this.gameObject.localPlayer : null;
    }

    // ── scripts ────────────────────────────────────────────────────────────
    compileAll() {
        this.scripts = [];
        const defs = this.manifest.scripts || [];
        for (const sdef of defs) {
            const rec = { def: sdef, fns: {} };
            if (sdef.event && ['start', 'update', 'touched', 'clicked'].indexOf(sdef.event) !== -1) {
                rec.fns[sdef.event] = compileScript(sdef.code, sdef.name || sdef.id);
            }
            this.scripts.push(rec);
        }
        // wire per-part listeners
        for (const [, entry] of this.parts) entry.scriptFns = [];
        for (const rec of this.scripts) {
            if (rec.def.part && this.parts.has(rec.def.part)) {
                const entry = this.parts.get(rec.def.part);
                entry.scriptFns.push(rec);
            }
        }
        // tools from manifest
        for (const tdef of (this.manifest.tools || [])) this.defineTool(tdef);
    }

    runStartScripts() {
        const game = this.gameObject;
        // starting tools first so start scripts can inspect the inventory
        const startTools = this.manifest.startTools || [];
        for (const tid of startTools) game.inventory.give(tid);
        for (const rec of this.scripts) {
            if (rec.def.event !== 'start') continue;
            const part = rec.def.part && this.parts.has(rec.def.part) ? this.parts.get(rec.def.part).wrapper : null;
            runScript(rec.fns.start, [game, part, null, this._playerObject(), null, 'start'], rec.def.name || rec.def.id);
        }
        this.emit('playerSpawn', this._playerObject());
    }

    // ── HUD ────────────────────────────────────────────────────────────────
    _ensureStyle() {
        if (document.getElementById('cs-place-runtime-style')) return;
        const st = document.createElement('style');
        st.id = 'cs-place-runtime-style';
        st.textContent = `
#cs-toast{position:fixed;left:50%;top:64px;transform:translateX(-50%);background:rgba(18,20,24,0.94);border:1px solid #666;color:#fff;font:13px Tahoma,sans-serif;padding:8px 18px;border-radius:3px;z-index:40001;opacity:0;transition:opacity 0.25s;pointer-events:none}
#cs-playhealth{position:fixed;left:12px;top:52px;width:180px;z-index:40000;font:11px Tahoma,sans-serif;color:#eee}
#cs-playhealth .bar{height:14px;background:rgba(0,0,0,0.6);border:1px solid #111;border-radius:2px;overflow:hidden}
#cs-playhealth .fill{height:100%;background:linear-gradient(#5ad36a,#2f9e44);transition:width 0.2s}
#cs-playhealth .lbl{margin-bottom:3px;text-shadow:0 1px 2px #000}
`;
        document.head.appendChild(st);
    }

    _createHud() {
        this._ensureStyle();
        this.removeHud();
        const toast = document.createElement('div');
        toast.id = 'cs-toast';
        document.body.appendChild(toast);
        this._hud = { toast };
        if (this.mode === 'studio') {
            const hp = document.createElement('div');
            hp.id = 'cs-playhealth';
            hp.innerHTML = '<div class="lbl">Health</div><div class="bar"><div class="fill" style="width:100%"></div></div>';
            document.body.appendChild(hp);
            this._hud.hp = hp;
        }
        this._renderHealth();
    }

    removeHud() {
        ['cs-hotbar', 'cs-toast', 'cs-playhealth', 'cs-toolhint'].forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        this._hud = null;
    }

    _renderHealth() {
        if (!this._hud || !this._hud.hp) return;
        const fill = this._hud.hp.querySelector('.fill');
        if (fill) fill.style.width = Math.round(100 * Math.max(0, this._currentHealth()) / this._maxHealth) + '%';
    }

    _toast(msg) {
        if (!this._hud || !this._hud.toast) return;
        const t = this._hud.toast;
        t.textContent = msg;
        t.style.opacity = '1';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
    }

    // ── studio-mode player ─────────────────────────────────────────────────
    _createStudioPlayer() {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.5, metalness: 0.05 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x606060, roughness: 0.6 });
        const headMat = new THREE.MeshStandardMaterial({ color: 0xf0c86a, roughness: 0.5 });
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.06, 0.5), bodyMat);
        torso.position.y = 1.6;
        const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.06, 0.45), legMat);
        legs.position.y = 0.53;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.66), headMat);
        head.position.y = 2.5;
        [torso, legs, head].forEach((m) => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
        const sp = this._spawnPos();
        group.position.set(sp[0], sp[1], sp[2]);
        this.scene.add(group);
        this._studioPlayer = {
            pos: group.position.clone(),
            vel: new THREE.Vector3(),
            group,
            onGround: false
        };
        this._health = this._maxHealth;
    }

    _syncStudioPlayerMesh() {
        if (this._studioPlayer) this._studioPlayer.group.position.copy(this._studioPlayer.pos);
    }

    _bindStudioInput() {
        const canvas = this.renderer ? this.renderer.domElement : document.querySelector('canvas');
        if (!canvas) return;
        const keys = {};
        const cam = { yaw: Math.PI, pitch: 0.25, dist: 10, dragging: false, lastX: 0, lastY: 0 };
        const onKeyDown = (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            keys[e.code] = true;
            if (e.code === 'KeyF') this._activateTool();
            if (/^Digit[1-9]$/.test(e.code)) {
                const idx = parseInt(e.code.slice(5), 10) - 1;
                if (this.owned[idx]) this._equipTool(this.owned[idx]);
            }
        };
        const onKeyUp = (e) => { keys[e.code] = false; };
        const onPointerDown = (e) => {
            if (e.button === 2 || e.button === 1) {
                cam.dragging = true;
                cam.lastX = e.clientX; cam.lastY = e.clientY;
            } else if (e.button === 0) {
                if (this.equippedId) { this._activateTool(); return; }
                this._studioClick(e);
            }
        };
        const onPointerMove = (e) => {
            if (!cam.dragging) return;
            cam.yaw -= (e.clientX - cam.lastX) * 0.008;
            cam.pitch = Math.max(-1.2, Math.min(1.3, cam.pitch + (e.clientY - cam.lastY) * 0.006));
            cam.lastX = e.clientX; cam.lastY = e.clientY;
        };
        const onPointerUp = () => { cam.dragging = false; };
        const onWheel = (e) => {
            cam.dist = Math.max(3, Math.min(40, cam.dist + Math.sign(e.deltaY) * 1.2));
        };
        const onContext = (e) => e.preventDefault();
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        canvas.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: true });
        canvas.addEventListener('contextmenu', onContext);
        this._studioInput = {
            keys, cam,
            dispose: () => {
                window.removeEventListener('keydown', onKeyDown);
                window.removeEventListener('keyup', onKeyUp);
                canvas.removeEventListener('pointerdown', onPointerDown);
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                canvas.removeEventListener('wheel', onWheel);
                canvas.removeEventListener('contextmenu', onContext);
            }
        };
    }

    _studioClick(e) {
        if (!this.camera || !this.renderer) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, this.camera);
        const meshes = [];
        for (const [, entry] of this.parts) entry.mesh.traverse((n) => { if (n.isMesh) meshes.push(n); });
        const hits = ray.intersectObjects(meshes, false);
        if (hits.length) {
            let node = hits[0].object;
            while (node && !node.userData.partId && node.parent) node = node.parent;
            const entry = node && node.userData.partId ? this.parts.get(node.userData.partId) : null;
            if (entry) this._fireClicked(entry, null);
        }
    }

    _fireClicked(entry, other) {
        for (const srec of this.scripts) {
            if (srec.def.event === 'clicked' && srec.def.part === entry.def.id && srec.fns.clicked) {
                runScript(srec.fns.clicked, [this.gameObject, entry.wrapper, other, this._playerObject(), null, 'clicked'], srec.def.name || srec.def.id);
            }
        }
        const localFns = entry.listeners.clicked || [];
        for (const fn of localFns) runScript(fn, [entry.wrapper, other, this.gameObject], `part:${entry.def.name}:clicked`);
        this.emit('clicked', entry.wrapper, other);
    }

    // ── collision / touch ──────────────────────────────────────────────────
    _getPlayerBox() {
        if (this.mode === 'game' && this.adapter && this.adapter.getPlayerBox) return this.adapter.getPlayerBox();
        const p = this._playerPosition();
        // matches the game's player AABB: feet at p.y, total height 2.128
        return {
            min: new THREE.Vector3(p.x - 0.45, p.y, p.z - 0.23),
            max: new THREE.Vector3(p.x + 0.45, p.y + 2.128, p.z + 0.23)
        };
    }

    _partBox(entry) {
        return new THREE.Box3().setFromObject(entry.mesh);
    }

    _checkTouches() {
        const playerBox = this._getPlayerBox();
        const nowTouched = new Set();
        const hasGlobalTouch = !!(this._eventHandlers['touched'] && this._eventHandlers['touched'].length);
        if (!this._touchPairs) this._touchPairs = new Set();
        const dynamic = [];
        for (const [, entry] of this.parts) {
            if (!entry.mesh.visible) continue;
            const wantsTouch = (entry.scriptFns.some((r) => r.def.event === 'touched')) ||
                (entry.listeners.touched && entry.listeners.touched.length > 0) ||
                (entry.def.damage > 0) || hasGlobalTouch;
            if (entry._moved || entry.dynamic) dynamic.push(entry);
            if (!wantsTouch) continue;
            const box = this._partBox(entry);
            const key = entry.def.id;
            if (box.intersectsBox(playerBox)) {
                if (!this._hitPulse.has(key)) {
                    this._hitPulse.add(key);
                    this._fireTouched(entry, this._playerObject());
                }
                nowTouched.add(key);
            }
        }
        // dynamic parts touching static parts (script-moved / spawned) — enter-only per pair
        const livePairs = new Set();
        for (const d of dynamic) {
            const dBox = this._partBox(d);
            for (const [, s] of this.parts) {
                if (s === d) continue;
                const wants = (s.scriptFns.some((r) => r.def.event === 'touched')) ||
                    (s.listeners.touched && s.listeners.touched.length) || hasGlobalTouch;
                if (!wants) continue;
                if (dBox.intersectsBox(this._partBox(s))) {
                    const pairKey = s.def.id + '|' + d.def.id;
                    livePairs.add(pairKey);
                    if (!this._touchPairs.has(pairKey)) this._fireTouched(s, d.wrapper);
                }
            }
        }
        this._touchPairs = livePairs;
        // reset enter-only pulses for parts the player left
        for (const key of Array.from(this._hitPulse)) {
            if (!nowTouched.has(key)) this._hitPulse.delete(key);
        }
        for (const [, entry] of this.parts) {
            if (entry._moved) entry._moved = false;
        }
        return nowTouched;
    }

    _fireTouched(entry, other) {
        // damage parts
        if (entry.def.damage > 0 && other && other === this._playerObject()) {
            this._damage(entry.def.damage);
        }
        for (const srec of this.scripts) {
            if (srec.def.event === 'touched' && srec.def.part === entry.def.id && srec.fns.touched) {
                runScript(srec.fns.touched, [this.gameObject, entry.wrapper, other, this._playerObject(), null, 'touched'], srec.def.name || srec.def.id);
            }
        }
        for (const fn of (entry.listeners.touched || [])) runScript(fn, [entry.wrapper, other, this.gameObject], `part:${entry.def.name}:touched`);
        this.emit('touched', entry.wrapper, other);
    }

    // ── studio player physics ──────────────────────────────────────────────
    _updateStudioPlayer(dt) {
        const sp = this._studioPlayer;
        const input = this._studioInput;
        if (!sp || !input) return;
        const dtS = Math.min(dt, 50) / 1000;
        const speed = 14;
        const jumpV = 11;
        const gravity = 30;
        const yaw = input.cam.yaw;
        const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const move = new THREE.Vector3();
        if (input.keys['KeyW']) move.add(fwd);
        if (input.keys['KeyS']) move.sub(fwd);
        if (input.keys['KeyD']) move.add(right);
        if (input.keys['KeyA']) move.sub(right);
        if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);
        sp.vel.x = move.x;
        sp.vel.z = move.z;
        sp.vel.y -= gravity * dtS;
        if (input.keys['Space'] && sp.onGround) { sp.vel.y = jumpV; sp.onGround = false; }

        // axis-separated AABB resolution against parts (player box: half .45/.23, height 2.128)
        const hw = 0.45, hd = 0.23, pH = 2.128;
        const boxes = [];
        for (const [, entry] of this.parts) {
            if (!entry.mesh.visible || entry.def.collidable === false) continue;
            boxes.push({ entry, box: this._partBox(entry) });
        }
        sp.onGround = false;
        const tryMove = (axis, delta) => {
            if (delta === 0) return;
            sp.pos[axis] += delta;
            const pBox = {
                min: new THREE.Vector3(sp.pos.x - hw, sp.pos.y, sp.pos.z - hd),
                max: new THREE.Vector3(sp.pos.x + hw, sp.pos.y + pH, sp.pos.z + hd)
            };
            const EPS = 0.003;
            for (const { entry, box } of boxes) {
                if (!box.intersectsBox(pBox)) continue;
                if (axis === 'y') {
                    if (delta < 0) {
                        sp.pos.y = box.max.y;
                        sp.vel.y = 0;
                        sp.onGround = true;
                    } else {
                        sp.pos.y = box.min.y - pH - 0.001;
                        sp.vel.y = 0;
                    }
                } else {
                    // a floor you're standing on touches the box, but must not act as a wall:
                    // only resolve horizontally when there is real vertical overlap
                    const feet = sp.pos.y, head = sp.pos.y + pH;
                    if (feet >= box.max.y - EPS || head <= box.min.y + EPS) continue;
                    if (axis === 'x') {
                        sp.pos.x = delta > 0 ? box.min.x - hw - 0.001 : box.max.x + hw + 0.001;
                        sp.vel.x = 0;
                    } else {
                        sp.pos.z = delta > 0 ? box.min.z - hd - 0.001 : box.max.z + hd + 0.001;
                        sp.vel.z = 0;
                    }
                }
                // refresh box after resolution
                pBox.min.set(sp.pos.x - hw, sp.pos.y, sp.pos.z - hd);
                pBox.max.set(sp.pos.x + hw, sp.pos.y + pH, sp.pos.z + hd);
            }
        };
        tryMove('x', sp.vel.x * dtS);
        tryMove('z', sp.vel.z * dtS);
        tryMove('y', sp.vel.y * dtS);

        if (sp.pos.y < -30) {
            if (!sp._fellMsg) {
                this._toast('You fell out of the world!');
                sp._fellMsg = true;
            }
            const s = this._spawnPos();
            sp.pos.set(s[0], s[1], s[2]);
            sp.vel.set(0, 0, 0);
        } else if (sp.onGround) {
            sp._fellMsg = false;
        }
        this._syncStudioPlayerMesh();

        // camera follow
        const cam = input.cam;
        const target = new THREE.Vector3(sp.pos.x, sp.pos.y + 1.6, sp.pos.z);
        const offset = new THREE.Vector3(
            Math.sin(cam.yaw) * Math.cos(cam.pitch),
            Math.sin(cam.pitch),
            Math.cos(cam.yaw) * Math.cos(cam.pitch)
        ).multiplyScalar(cam.dist);
        if (this.camera) {
            this.camera.position.copy(target).add(offset);
            this.camera.lookAt(target);
        }
    }

    // ── main tick ──────────────────────────────────────────────────────────
    _bindGameInput() {
        const onKeyDown = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (e.code === 'KeyF') this._activateTool();
            if (/^Digit[1-9]$/.test(e.code)) {
                const idx = parseInt(e.code.slice(5), 10) - 1;
                if (this.owned[idx]) this._equipTool(this.owned[idx]);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        this._gameKeyDispose = () => window.removeEventListener('keydown', onKeyDown);
    }

    update(dtMs) {
        if (!this.running) return;
        const dt = Number(dtMs) || 16;
        this._playTime += dt;

        // timers
        for (let i = this._timers.length - 1; i >= 0; i--) {
            const t = this._timers[i];
            if (this._playTime >= t.due) {
                runScript(t.fn, [this.gameObject, this._playerObject()], 'timer');
                if (t.every > 0) t.due = this._playTime + t.every;
                else this._timers.splice(i, 1);
            }
        }
        // round tick
        if (this._round) {
            const left = Math.max(0, Math.ceil((this._round.endsAt - this._playTime) / 1000));
            if (left < this._round.lastTick) {
                this._round.lastTick = left;
                this.emit('timer', left);
            }
            if (left <= 0) {
                this.emit('roundEnd', this._round.duration);
                this._round = null;
            }
        }
        // update scripts
        for (const rec of this.scripts) {
            if (rec.def.event !== 'update' || !rec.fns.update) continue;
            const part = rec.def.part && this.parts.has(rec.def.part) ? this.parts.get(rec.def.part).wrapper : null;
            runScript(rec.fns.update, [this.gameObject, part, null, this._playerObject(), null, 'update'], rec.def.name || rec.def.id);
        }
        // touches
        this._checkTouches();
        // studio player
        if (this.mode === 'studio') this._updateStudioPlayer(dt);
        // health hud
        if (this.mode === 'studio') this._renderHealth();
    }

    // ── lifecycle ──────────────────────────────────────────────────────────
    start() {
        if (this.running) return;
        this.buildScene();
        this.gameObject = this._makeApi();
        this.compileAll();
        this._createHud();
        this._hitPulse = new Set();
        this._touchPairs = new Set();
        this.runStartScripts();
        if (this.mode === 'studio') {
            this._createStudioPlayer();
            this._bindStudioInput();
        } else {
            this._bindGameInput();
            if (this.adapter && this.adapter.teleport && (this.manifest.parts || []).some((p) => p.spawn)) {
                const s = this._spawnPos();
                this.adapter.teleport(s[0], s[1], s[2]);
            }
        }
        this.running = true;
        this.log(`place "${this.manifest.name}" running (${this.mode} mode)`);
        return this;
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        if (this._studioInput) { this._studioInput.dispose(); this._studioInput = null; }
        if (this._gameKeyDispose) { this._gameKeyDispose(); this._gameKeyDispose = null; }
        if (this._studioPlayer) {
            if (this._studioPlayer.group.parent) this._studioPlayer.group.parent.remove(this._studioPlayer.group);
            this._studioPlayer = null;
        }
        this.removeHud();
        this._timers = [];
        this._round = null;
        this._eventHandlers = {};
        this._touchPairs = new Set();
        this.log('place stopped');
    }

    dispose() {
        this.stop();
        for (const id of Array.from(this.parts.keys())) this.destroyPart(id);
        this.parts.clear();
        this.scripts = [];
        this.tools.clear();
        this.owned = [];
        this.equippedId = null;
    }
}
