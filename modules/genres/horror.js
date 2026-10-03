import * as THREE from 'three';
import { registerGenre, makeParts } from './core.js?v=1';
import { playSound, stopBackground, startBackground } from '../audio.js';

const P = makeParts('h');

const NOTE_LORE = [
    'Day 12 — the doors stopped opening on their own.',
    'Day 19 — it fears the light. Keep it moving.',
    'Day 21 — the key is in the library. God help us.'
];

function layout() {
    const parts = [];
    parts.push(P('ground', [0, -0.5, 0], [1, 1, 1], '#2c332a', { texture: 'grass' }));
    parts.push(P('box', [0, 0.15, 0], [44, 0.3, 36], '#3a3128', { texture: 'none' }));

    parts.push(P('box', [0, 1.6, -18], [44, 3.2, 0.4], '#4a3f35'));
    parts.push(P('box', [-11.6, 1.6, 18], [20.8, 3.2, 0.4], '#4a3f35'));
    parts.push(P('box', [11.6, 1.6, 18], [20.8, 3.2, 0.4], '#4a3f35'));
    parts.push(P('box', [-22, 1.6, 0], [0.4, 3.2, 36], '#4a3f35'));
    parts.push(P('box', [22, 1.6, 0], [0.4, 3.2, 36], '#4a3f35'));
    parts.push(P('box', [0, 1.5, 18], [2.4, 3, 0.5], '#6a1f1f', { name: 'HorrorExitDoor' }));

    const nseg = [[-19.6, 4.8], [-11, 7.6], [-1, 7.6], [9, 7.6], [18.6, 6.8]];
    for (const s of nseg) parts.push(P('box', [s[0], 1.6, -1.5], [s[1], 3.2, 0.4], '#4a3f35'));
    const sseg = [[-17.1, 9.8], [-5.9, 7.8], [5.4, 6.8], [16.6, 10.8]];
    for (const s of sseg) parts.push(P('box', [s[0], 1.6, 1.5], [s[1], 3.2, 0.4], '#4a3f35'));

    for (const x of [-11, 0, 11]) parts.push(P('box', [x, 1.6, -9.75], [0.4, 3.2, 16.5], '#4a3f35'));
    for (const x of [-6, 6]) parts.push(P('box', [x, 1.6, 9.75], [0.4, 3.2, 16.5], '#4a3f35'));

    const tables = [[-5.5, -6, '#5a4632'], [-16, 12, '#5a4632'], [17.5, -5, '#5a4632'], [0, 12, '#6a2a2a']];
    for (const t of tables) {
        parts.push(P('box', [t[0], 0.95, t[1]], [2.6, 0.18, 1.6], t[2]));
        parts.push(P('box', [t[0] - 1, 0.5, t[1] - 0.5], [0.18, 1, 0.18], '#4a3826'));
        parts.push(P('box', [t[0] + 1, 0.5, t[1] + 0.5], [0.18, 1, 0.18], '#4a3826'));
    }

    parts.push(P('box', [-5.5, 1.12, -6], [0.5, 0.06, 0.7], '#f5f0d8',
        { material: 'Neon', collidable: false, name: 'HorrorNote1', rotation: [0, 0.4, 0], texture: 'none' }));
    parts.push(P('box', [-16, 1.12, 12], [0.5, 0.06, 0.7], '#f5f0d8',
        { material: 'Neon', collidable: false, name: 'HorrorNote2', rotation: [0, -0.6, 0], texture: 'none' }));
    parts.push(P('box', [17.5, 1.12, -5], [0.5, 0.06, 0.7], '#f5f0d8',
        { material: 'Neon', collidable: false, name: 'HorrorNote3', rotation: [0, 1.1, 0], texture: 'none' }));

    const hides = [[-19.5, -16], [-8, -16], [-19.5, 16.2], [19, 16.2]];
    for (let i = 0; i < hides.length; i++) {
        parts.push(P('box', [hides[i][0], 1.4, hides[i][1]], [1.7, 2.8, 1.1], '#5a3a2a',
            { name: 'HorrorHide' + (i + 1) }));
        parts.push(P('box', [hides[i][0], 1.4, hides[i][1] + (hides[i][1] > 0 ? -0.57 : 0.57)],
            [1.4, 2.4, 0.1], '#43291c', { texture: 'none' }));
    }

    const shelves = [[-20.5, -9.75, 1], [8.6, -14, 0], [14, -9.4, 1]];
    for (const s of shelves) {
        parts.push(P('box', [s[0], 1.3, s[1]], s[2] ? [0.7, 2.6, 3] : [3, 2.6, 0.7], '#4a3826'));
    }

    const paints = [[-10, 2.3, -17.7, 0], [6, 2.3, -17.7, 0], [-21.7, 2.3, 8, 1], [21.7, 2.3, -6, 1]];
    for (const pt of paints) {
        parts.push(P('box', [pt[0], pt[1], pt[2]], pt[3] ? [0.08, 1.2, 1.7] : [1.7, 1.2, 0.08], '#2a3a4a',
            { texture: 'none' }));
    }

    parts.push(P('box', [0, 0.33, 11], [7, 0.05, 4.5], '#6a2a2a', { texture: 'none' }));
    parts.push(P('box', [0, 0.4, 14.5], [2.6, 0.3, 2.6], '#5577d9', { spawn: true, name: 'HorrorSpawn' }));

    for (const fl of [[0, 0], [-16, -9.75], [16, -9.75], [0, 11]]) {
        parts.push(P('box', [fl[0], 3.05, fl[1]], [1, 0.16, 1], '#e8dcb8',
            { material: 'Neon', name: 'HorrorLight', texture: 'none', collidable: false }));
    }

    parts.push(P('box', [-18, 0.6, 11], [1.4, 1.2, 1.4], '#6b6b64', { texture: 'none' }));
    parts.push(P('box', [19, 0.5, -6], [1, 1, 1], '#ff00ff',
        { visible: false, collidable: false, name: 'HorrorMonster', texture: 'none' }));
    parts.push(P('box', [-15, 1, 14], [1.6, 2, 0.4], '#6b6b64', { rotation: [-0.12, 0.3, 0] }));
    for (const cr of [[20, 6], [-20, -14], [3, -16], [12, 15]]) {
        parts.push(P('box', [cr[0], 0.6, cr[1]], [1.1, 1.2, 1.1], '#4a4038', { rotation: [0, cr[0], 0] }));
    }

    for (const dt of [[-30, -22], [30, -24], [-32, 24], [28, 26], [0, 30]]) {
        parts.push(P('cylinder', [dt[0], 1.6, dt[1]], [0.35, 1.6, 0.35], '#3a2f28'));
        parts.push(P('box', [dt[0], 3.6, dt[1]], [3, 2, 3], '#2a3a2a'));
    }
    for (const gs of [[-8, 24], [-3, 27], [5, 25], [12, 23], [-14, 26]]) {
        parts.push(P('box', [gs[0], 0.8, gs[1]], [1.1, 1.6, 0.3], '#7a7a74',
            { rotation: [-0.08, gs[0] * 0.1, 0], texture: 'none' }));
    }
    parts.push(P('box', [0, 0.06, 24], [5, 0.1, 14], '#585850', { texture: 'none' }));
    return parts;
}

function buildMonster() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.92 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 0.6), mat);
    body.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.62, 0.7), mat);
    head.position.y = 2.2;
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 2.2 });
    for (const ex of [-0.17, 0.17]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.06), eyeMat);
        eye.position.set(ex, 2.26, -0.37);
        g.add(eye);
    }
    for (const ax of [-0.62, 0.62]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), mat);
        arm.position.set(ax, 1.15, 0);
        g.add(arm);
    }
    g.add(body, head);
    return g;
}

function init(ctx, api) {
    const scene = ctx.scene;
    const camera = ctx.camera;
    const player = ctx.player;
    api.setBaseHud({ health: false, backpack: false, hotbar: false });

    const state = {
        flashlight: false,
        battery: 100,
        notes: 0,
        haveKey: false,
        hidden: false,
        sanity: 100,
        won: false,
        monsterMode: 'patrol'
    };

    const h = (tag, cls, parent, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        if (parent) parent.appendChild(node);
        return node;
    };

    const cluster = h('div', null, api.root);
    cluster.id = 'hz-cluster';
    const lightRow = h('div', 'hz-row', cluster);
    h('span', 'hz-key', lightRow, 'LIGHT');
    const lightBar = h('div', 'hz-bar', lightRow);
    const lightFill = h('i', null, lightBar);
    const hpRow = h('div', 'hz-row', cluster);
    h('span', 'hz-key', hpRow, 'HEALTH');
    const hpBar = h('div', 'hz-bar hz-hp', hpRow);
    const hpFill = h('i', null, hpBar);
    const noteRow = h('div', 'hz-row', cluster);
    h('span', 'hz-key', noteRow, 'NOTES');
    const noteVal = h('span', 'hz-val', noteRow, '0 / 3');
    const keyRow = h('div', 'hz-row', cluster);
    h('span', 'hz-key', keyRow, 'KEY');
    const keyVal = h('span', 'hz-val', keyRow, 'no');

    const objBox = h('div', null, api.root);
    objBox.id = 'hz-obj';
    const objText = h('div', 'hz-obj-text', objBox, 'Search the mansion for 3 notes');

    const nerve = h('div', null, api.root);
    nerve.id = 'hz-nerve';
    h('span', 'hz-key', nerve, 'NERVE');
    const nerveBar = h('div', 'hz-bar hz-nervebar', nerve);
    const nerveFill = h('i', null, nerveBar);

    const vig = h('div', null, api.root);
    vig.id = 'hz-vig';
    const veil = h('div', null, api.root);
    veil.id = 'hz-veil';
    const flash = h('div', null, api.root);
    flash.id = 'hz-flash';
    const hiddenTag = h('div', 'hz-hidden', api.root, 'HIDDEN - E to step out');
    hiddenTag.id = 'hz-hiddentag';

    const win = h('div', null, api.root);
    win.id = 'hz-win';
    win.classList.add('hz-hidden');
    h('div', 'hz-win-title', win, 'YOU ESCAPED');
    const winSub = h('div', 'hz-win-sub', win, '');
    const winBtn = h('button', 'hz-win-btn', win, 'PLAY AGAIN');
    winBtn.type = 'button';
    winBtn.addEventListener('click', () => window.location.reload());

    api.style(`
#hz-cluster{position:fixed;left:16px;top:74px;z-index:44;width:172px;background:rgba(8,8,10,.82);
border:2px solid #000;border-radius:8px;padding:8px 9px;font-family:Tahoma,sans-serif}
#hz-cluster .hz-row{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:5px 0}
#hz-cluster .hz-key{font:bold 11px Tahoma;color:#9aa0aa;letter-spacing:1px}
#hz-cluster .hz-val{font:bold 13px Tahoma;color:#e8e8e8}
.hz-bar{flex:1;height:11px;background:#1c1c22;border:1px solid #000;border-radius:4px;overflow:hidden}
.hz-bar i{display:block;height:100%;width:100%;background:#f0e070;transition:width .2s linear}
.hz-bar.hz-hp i{background:#e04545}
.hz-bar.hz-nervebar i{background:#8fd0ff}
#hz-obj{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:44;background:rgba(8,8,10,.85);
border:2px solid #000;border-radius:6px;padding:7px 18px;max-width:56vw;text-align:center}
#hz-obj .hz-obj-text{font:bold 15px Tahoma;color:#e8e0c8;text-shadow:1px 1px 0 #000}
#hz-nerve{position:fixed;bottom:16px;left:50%;margin-left:-110px;width:200px;z-index:44;display:flex;
align-items:center;gap:7px;background:rgba(8,8,10,.82);border:2px solid #000;border-radius:6px;padding:6px 9px}
#hz-nerve .hz-key{font:bold 11px Tahoma;color:#9aa0aa;letter-spacing:1px}
#hz-vig{position:fixed;inset:0;z-index:42;pointer-events:none;
background:radial-gradient(ellipse at center,rgba(0,0,0,0) 34%,rgba(0,0,0,.92) 100%);opacity:.5}
#hz-veil{position:fixed;inset:0;z-index:41;pointer-events:none;background:rgba(5,7,12,.34)}
#hz-flash{position:fixed;inset:0;z-index:48;pointer-events:none;opacity:0;background:#fff}
#hz-flash.hz-go{animation:hz-scare .34s steps(2,end)}
@keyframes hz-scare{0%{opacity:.95;background:#fff}40%{opacity:.85;background:#b00c0c}100%{opacity:0}}
#hz-hiddentag{position:fixed;bottom:74px;left:50%;transform:translateX(-50%);z-index:45;display:none;
font:bold 15px Tahoma;color:#8fd0ff;background:rgba(8,8,10,.85);border:2px solid #000;
border-radius:6px;padding:6px 16px}
#hz-hiddentag.hz-show{display:block}
#cs-genre-hud.hz-low #hz-veil{background:rgba(34,4,4,.42)}
#cs-genre-hud.hz-low #hz-obj{border-color:#5a1010}
#hz-win{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:47;width:330px;text-align:center;
background:rgba(6,8,6,.96);border:3px solid #0c0c0c;border-radius:10px;padding:22px 20px;font-family:Tahoma,sans-serif}
#hz-win.hz-hidden{display:none}
.hz-win-title{font:bold 27px Tahoma;color:#5ef07a;text-shadow:2px 2px 0 #000;letter-spacing:2px}
.hz-win-sub{font:bold 14px Tahoma;color:#cfd4dc;margin-top:8px}
.hz-win-btn{margin-top:14px;width:100%;font:bold 15px Tahoma;padding:9px;border:2px solid #000;
border-radius:6px;background:#3ec46d;color:#08240f;cursor:pointer}`, 'ui');
    const rootHud = api.root;

    const lights = ctx.getLights ? ctx.getLights() : null;
    const savedLight = { ambient: null, directional: null, fog: scene.fog };
    if (lights && lights.ambient) {
        savedLight.ambient = { intensity: lights.ambient.intensity, color: lights.ambient.color.getHex() };
        lights.ambient.intensity = 0.17;
        lights.ambient.color.setHex(0x2a3344);
    }
    if (lights && lights.directional) {
        savedLight.directional = { intensity: lights.directional.intensity, color: lights.directional.color.getHex() };
        lights.directional.intensity = 0.13;
        lights.directional.color.setHex(0x6f86b8);
    }
    scene.fog = new THREE.FogExp2(0x070a10, 0.052);

    const genreLights = [];
    const lightSpots = [[0, 0], [-16, -9.75], [16, -9.75], [0, 11]];
    for (let i = 0; i < lightSpots.length; i++) {
        const pl = new THREE.PointLight(0xffc880, 1.15, 14, 1.6);
        pl.position.set(lightSpots[i][0], 2.8, lightSpots[i][1]);
        scene.add(pl);
        genreLights.push({ light: pl, phase: i * 1.7, base: 1.15 });
    }

    const flashSpot = new THREE.SpotLight(0xfff2cc, 0, 32, 0.42, 0.45, 1.2);
    const flashTarget = new THREE.Object3D();
    scene.add(flashSpot, flashTarget);
    flashSpot.target = flashTarget;

    const rt = ctx.placeRuntime ? ctx.placeRuntime() : null;
    const rayMeshes = [];
    if (rt && rt.parts) {
        for (const [, entry] of rt.parts) {
            if (entry.def.collidable !== false && entry.def.type !== 'ground') rayMeshes.push(entry.mesh);
        }
    }

    const noteMeshes = [];
    if (rt && rt.parts) {
        for (const [, entry] of rt.parts) {
            if (/^HorrorNote\d$/.test(entry.def.name || '')) noteMeshes.push(entry);
        }
    }

    let exitPos = [0, 1, 16.6];
    let monsterSpawn = [19, 0.5, -6];
    const hideSpots = [];
    if (rt && rt.parts) {
        for (const [, entry] of rt.parts) {
            const nm = entry.def.name || '';
            if (nm === 'HorrorExitDoor') exitPos = entry.def.position.slice();
            if (nm === 'HorrorMonster') monsterSpawn = entry.def.position.slice();
            if (/^HorrorHide\d$/.test(nm)) hideSpots.push(entry.def.position.slice());
        }
    }

    const monster = buildMonster();
    monster.position.set(monsterSpawn[0], 0, monsterSpawn[2]);
    scene.add(monster);
    state.monster = monster.position;
    const patrol = [
        [-16, -9.75], [-5.5, -9.75], [5.5, -9.75], [16.5, -9.75],
        [-14, 9.75], [0, 9.75], [14, 9.75], [-16, 0], [0, 0], [16, 0]
    ];
    const m = {
        mode: 'patrol', target: 0, dir: new THREE.Vector3(1, 0, 0),
        lastSeen: -99, seenPos: new THREE.Vector3(), scareCd: 0, huntT: 0
    };

    const keyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x8a6a00, emissiveIntensity: 1.4, metalness: 0.7, roughness: 0.3 }));
    keyMesh.position.set(17.5, 1.5, -9.4);
    keyMesh.visible = false;
    scene.add(keyMesh);

    const ray = new THREE.Raycaster();
    ray.far = 1.7;
    const tmpDir = new THREE.Vector3();

    function blockedAt(px, pz, angle) {
        tmpDir.set(Math.sin(angle), 0, Math.cos(angle));
        ray.set(new THREE.Vector3(px, 1.4, pz), tmpDir);
        const hits = ray.intersectObjects(rayMeshes, false);
        return hits.length > 0 && hits[0].distance < 1.7;
    }

    let t = 0;
    let elapsed = 0;
    let hiddenSince = -1;
    let lockedHint = 0;
    let disposed = false;

    function setObjective(text) {
        objText.textContent = text;
    }

    function toggleFlash() {
        if (state.battery <= 0 && !state.flashlight) {
            api.popup('Battery is dead');
            return;
        }
        state.flashlight = !state.flashlight;
        playSound('click');
    }

    function onKeyDown(e) {
        const tgt = e.target;
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
        if (e.code === 'KeyF') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!state.won) toggleFlash();
            return;
        }
        if (e.code === 'KeyE') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (state.won) return;
            if (state.hidden) {
                state.hidden = false;
                hiddenSince = -1;
                try { player.lockInput(false); } catch (err) {}
                hiddenTag.classList.remove('hz-show');
            } else {
                const p = player.model;
                if (!p) return;
                for (const hs of hideSpots) {
                    const dx = p.position.x - hs[0], dz = p.position.z - hs[2];
                    if (dx * dx + dz * dz < 8.5) {
                        state.hidden = true;
                        hiddenSince = t;
                        try { player.lockInput(true); } catch (err) {}
                        hiddenTag.classList.add('hz-show');
                        m.mode = 'patrol';
                        m.lastSeen = -99;
                        break;
                    }
                }
            }
        }
    }

    const placeRt = ctx.placeRuntime ? ctx.placeRuntime() : null;
    if (placeRt && typeof placeRt._gameKeyDispose === 'function' && typeof placeRt._bindGameInput === 'function') {
        try { placeRt._gameKeyDispose(); } catch (e) {}
        window.addEventListener('keydown', onKeyDown, true);
        try { placeRt._bindGameInput(); } catch (e) {}
    } else {
        window.addEventListener('keydown', onKeyDown, true);
    }

    try { stopBackground(); } catch (e) {}

    function scare() {
        m.scareCd = 4.5;
        flash.classList.remove('hz-go');
        void flash.offsetWidth;
        flash.classList.add('hz-go');
        playSound('oof');
        if (ctx.damage) ctx.damage(35);
        state.sanity = Math.max(0, state.sanity - 22);
        let far = 0, fd = -1;
        for (let i = 0; i < patrol.length; i++) {
            const wp2 = patrol[i];
            const ad = Math.abs(wp2[0] - player.model.position.x) + Math.abs(wp2[1] - player.model.position.z);
            if (ad > fd) { fd = ad; far = i; }
        }
        m.target = far;
        monster.position.set(patrol[far][0], 0, patrol[far][1]);
        m.mode = 'patrol';
        api.popup('IT FOUND YOU');
    }

    function winGame() {
        state.won = true;
        state.flashlight = false;
        try { player.lockInput(false); } catch (e) {}
        state.hidden = false;
        hiddenTag.classList.remove('hz-show');
        win.classList.remove('hz-hidden');
        const mins = Math.floor(elapsed / 60);
        const secs = Math.round(elapsed % 60);
        winSub.textContent = 'Escaped in ' + mins + ':' + (secs < 10 ? '0' : '') + secs +
            '  -  notes ' + state.notes + '/3';
        playSound('spawn');
    }

    function updateMonster(dt) {
        const p = player.model;
        if (!p) return;
        const mx = monster.position.x, mz = monster.position.z;
        const dx = p.position.x - mx, dz = p.position.z - mz;
        const dist = Math.hypot(dx, dz);
        const dead = ctx.isDead && ctx.isDead();
        const canSee = !state.hidden && !dead && !state.won &&
            dist < (state.flashlight ? 17 : 11);

        if (canSee) {
            m.mode = 'chase';
            m.lastSeen = t;
            m.seenPos.copy(p.position);
            state.monsterMode = 'chase';
        } else if (m.mode === 'chase' && t - m.lastSeen > 4) {
            m.mode = 'patrol';
            m.huntT = 6;
            state.monsterMode = 'patrol';
        }

        let aimX, aimZ, speed;
        if (m.mode === 'chase') {
            aimX = p.position.x;
            aimZ = p.position.z;
            speed = 5.1 + (state.sanity <= 0 ? 1.7 : 0);
        } else if (m.huntT > 0) {
            aimX = m.seenPos.x;
            aimZ = m.seenPos.z;
            speed = 2.6;
        } else {
            const tgt = patrol[m.target];
            aimX = tgt[0];
            aimZ = tgt[1];
            speed = 2.1;
            if (Math.hypot(aimX - mx, aimZ - mz) < 2.2) {
                m.target = (m.target + 1 + Math.floor(Math.random() * 3)) % patrol.length;
            }
        }
        m.huntT = Math.max(0, m.huntT - dt);

        const baseA = Math.atan2(aimX - mx, aimZ - mz);
        let chosen = baseA;
        const offsets = [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2];
        for (const off of offsets) {
            if (!blockedAt(mx, mz, baseA + off)) {
                chosen = baseA + off;
                break;
            }
        }
        const vx = Math.sin(chosen), vz = Math.cos(chosen);
        monster.position.x += vx * speed * dt;
        monster.position.z += vz * speed * dt;
        monster.position.y = 0.05 + Math.sin(t * 2.6) * 0.06;
        monster.rotation.y = Math.atan2(-vx, -vz);

        if (!state.won && !dead && dist < 1.3 && t > m.scareCd) scare();
    }

    function update(dtMs) {
        if (disposed) return;
        let dt = Math.min(dtMs / 1000, 0.05);
        if (dt <= 0) return;
        t += dt;
        if (!state.won) elapsed += dt;

        if (state.flashlight) {
            state.battery = Math.max(0, state.battery - dt * (100 / 145));
            if (state.battery <= 0) {
                state.flashlight = false;
                api.popup('The light died');
            }
        } else {
            state.battery = Math.min(100, state.battery + dt * 3.4);
        }

        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        flashSpot.position.copy(camera.position);
        flashTarget.position.copy(camera.position).addScaledVector(camDir, 14);
        flashSpot.intensity = state.flashlight ? (state.battery < 15 ? 2.2 : 3.4) : 0;

        for (const gl of genreLights) {
            let v = gl.base * (0.74 + 0.26 * Math.sin(t * 31 + gl.phase));
            if (Math.sin(t * 3.3 + gl.phase * 2) > 0.985) v *= 0.22;
            gl.light.intensity = v;
        }

        const p = player.model;
        if (p && !state.won) {
            for (const entry of noteMeshes) {
                if (entry.mesh.visible === false) continue;
                entry.mesh.rotation.y += dt * 1.6;
                const dx = p.position.x - entry.def.position[0];
                const dz = p.position.z - entry.def.position[2];
                if (dx * dx + dz * dz < 3.2) {
                    entry.mesh.visible = false;
                    state.notes++;
                    playSound('click');
                    api.popup('Note ' + state.notes + '/3 - "' + NOTE_LORE[Math.min(state.notes - 1, 2)] + '"');
                    if (state.notes >= 3) {
                        keyMesh.visible = true;
                        setObjective('3 notes found - the LIBRARY key appeared');
                    }
                    noteVal.textContent = state.notes + ' / 3';
                }
            }
            if (keyMesh.visible) {
                keyMesh.rotation.y += dt * 2.2;
                const dx = p.position.x - keyMesh.position.x;
                const dz = p.position.z - keyMesh.position.z;
                if (dx * dx + dz * dz < 3.2) {
                    keyMesh.visible = false;
                    state.haveKey = true;
                    keyVal.textContent = 'yes';
                    playSound('roblox_click');
                    api.popup('Found the key - ESCAPE through the front door');
                    setObjective('Front door - get out');
                }
            }
            if (!state.haveKey) {
                const dx = p.position.x - exitPos[0];
                const dz = p.position.z - exitPos[2];
                if (dx * dx + dz * dz < 7 && lockedHint <= 0) {
                    api.popup('Locked - find the key');
                    lockedHint = 4;
                }
            } else {
                const dx = p.position.x - exitPos[0];
                const dz = p.position.z - exitPos[2];
                if (dx * dx + dz * dz < 7) winGame();
            }
        }
        lockedHint -= dt;

        if (state.hidden && hiddenSince >= 0 && t - hiddenSince > 12) {
            state.hidden = false;
            hiddenSince = -1;
            try { player.lockInput(false); } catch (e) {}
            hiddenTag.classList.remove('hz-show');
        }

        updateMonster(dt);

        const nearMonster = player.model &&
            Math.hypot(player.model.position.x - monster.position.x,
                player.model.position.z - monster.position.z) < 11;
        if (!state.won) {
            if (nearMonster && !state.hidden) state.sanity -= 7 * dt;
            if (state.flashlight) state.sanity = Math.min(100, state.sanity + 1.5 * dt);
            else state.sanity -= 0.9 * dt;
            state.sanity = Math.max(0, Math.min(100, state.sanity));
        }

        const hp = ctx.getHealth ? ctx.getHealth() : 100;
        hpFill.style.width = Math.max(0, Math.min(100, hp)) + '%';
        lightFill.style.width = state.battery + '%';
        lightFill.style.background = state.battery < 20 ? '#e04545' : (state.flashlight ? '#f0e070' : '#8a8f98');
        nerveFill.style.width = state.sanity + '%';
        vig.style.opacity = String(0.42 + (1 - state.sanity / 100) * 0.5);
        rootHud.classList.toggle('hz-low', state.sanity <= 35);
    }

    update(0);

    function dispose() {
        if (disposed) return;
        disposed = true;
        window.removeEventListener('keydown', onKeyDown, true);
        try { player.lockInput(false); } catch (e) {}
        if (lights && lights.ambient && savedLight.ambient) {
            lights.ambient.intensity = savedLight.ambient.intensity;
            lights.ambient.color.setHex(savedLight.ambient.color);
        }
        if (lights && lights.directional && savedLight.directional) {
            lights.directional.intensity = savedLight.directional.intensity;
            lights.directional.color.setHex(savedLight.directional.color);
        }
        scene.fog = savedLight.fog;
        for (const gl of genreLights) scene.remove(gl.light);
        scene.remove(flashSpot, flashTarget);
        scene.remove(monster);
        monster.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) o.material.dispose();
        });
        scene.remove(keyMesh);
        keyMesh.geometry.dispose();
        keyMesh.material.dispose();
        try { startBackground(); } catch (e) {}
    }

    return { state, actions: { toggleFlash, winGame }, update, dispose };
}

registerGenre({ id: 'horror', layout, init });
