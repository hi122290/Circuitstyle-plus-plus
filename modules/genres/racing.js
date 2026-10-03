import * as THREE from 'three';
import { registerGenre, makeParts } from './core.js?v=1';
import { playSound } from '../audio.js';

const P = makeParts('r');
const GOAL_LAPS = 3;
const FIELD = 4;

const TRACKS = [
    { name: 'Sunset Speedway', control: [[-30, -18], [0, -22], [30, -18], [36, 0], [30, 18], [0, 22], [-30, 18], [-36, 0]] },
    { name: 'Peanut Loop', control: [[-32, -16], [-10, -20], [10, -14], [30, -20], [36, 0], [30, 20], [8, 14], [-12, 20], [-32, 16], [-36, 0]] },
    { name: 'Harbor Circuit', control: [[-34, -14], [-14, -20], [6, -16], [26, -22], [36, -6], [30, 10], [12, 8], [2, 20], [-16, 16], [-26, 6], [-36, 4]] }
];

function layout(rng) {
    const idx = Math.floor(rng() * TRACKS.length) % TRACKS.length;
    const tr = TRACKS[idx];
    const parts = [];
    parts.push(P('ground', [0, -0.5, 0], [1, 1, 1], '#4f9f43', { texture: 'grass' }));

    const ctrl = tr.control;
    const curve = new THREE.CatmullRomCurve3(
        ctrl.map((c) => new THREE.Vector3(c[0], 0, c[1])), true, 'catmullrom', 0.6);
    const N = 40;
    const raw = curve.getSpacedPoints(N);
    const wp = [];
    for (let i = 0; i < N; i++) {
        wp.push([Math.round(raw[i].x * 100) / 100, Math.round(raw[i].z * 100) / 100]);
    }

    for (let i = 0; i < N; i++) {
        const a = wp[i], b = wp[(i + 1) % N];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const len = Math.hypot(dx, dz) || 1;
        const yaw = Math.atan2(-dz, dx);
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        parts.push(P('box', [mx, 0.1, mz], [len + 0.9, 0.2, 12], '#3d3d44',
            { rotation: [0, yaw, 0], texture: 'none', name: 'TrackSeg' + i }));
        if (i % 3 === 0) {
            parts.push(P('box', [mx, 0.215, mz], [len * 0.45, 0.03, 0.4], '#e8e8e0',
                { rotation: [0, yaw, 0], texture: 'none' }));
        }
    }

    for (const c of ctrl) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < N; i++) {
            const d = (wp[i][0] - c[0]) * (wp[i][0] - c[0]) + (wp[i][1] - c[1]) * (wp[i][1] - c[1]);
            if (d < bd) { bd = d; best = i; }
        }
        const a = wp[(best - 1 + N) % N], b = wp[(best + 1) % N];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const L = Math.hypot(dx, dz) || 1;
        const px = -dz / L, pz = dx / L;
        const yaw = Math.atan2(-dz, dx);
        for (const s of [1, -1]) {
            parts.push(P('box', [wp[best][0] + px * 6.7 * s, 0.3, wp[best][1] + pz * 6.7 * s],
                [2.4, 0.3, 1.1], s > 0 ? '#d94a3a' : '#e8e8e0',
                { rotation: [0, yaw, 0], texture: 'none' }));
        }
    }

    const s0 = wp[0], s1 = wp[1];
    const sdx = s1[0] - s0[0], sdz = s1[1] - s0[1];
    const sL = Math.hypot(sdx, sdz) || 1;
    const spx = -sdz / sL, spz = sdx / sL;
    const syaw = Math.atan2(-sdz, sdx);
    for (let k = 0; k < 8; k++) {
        const off = -5.25 + k * 1.5;
        parts.push(P('box', [s0[0] + spx * off, 0.225, s0[1] + spz * off], [1.5, 0.03, 1.5],
            k % 2 ? '#1c1c1c' : '#f2f2f2', { rotation: [0, syaw, 0], texture: 'none' }));
    }
    parts.push(P('box', [s0[0] + spx * 7.2, 1.9, s0[1] + spz * 7.2], [0.35, 3.4, 0.35], '#d9d9d9'));
    parts.push(P('box', [s0[0] - spx * 7.2, 1.9, s0[1] - spz * 7.2], [0.35, 3.4, 0.35], '#d9d9d9'));
    parts.push(P('box', [s0[0], 3.75, s0[1]], [0.35, 0.5, 14.8], '#d94a3a',
        { rotation: [0, syaw, 0], texture: 'none' }));
    parts.push(P('box', [s0[0], 3.75, s0[1]], [0.35, 0.5, 6], '#f2f2f2',
        { rotation: [0, syaw, 0], texture: 'none', position: [s0[0] + 0.01, 3.75, s0[1] + 0.01] }));

    parts.push(P('box', [0, 0.5, 0], [1, 1, 1], '#ff00ff', {
        visible: false, collidable: false, name: 'TrackMarker',
        trackIndex: idx, trackName: tr.name, width: 12, waypoints: wp, texture: 'none'
    }));

    parts.push(P('box', [44, 0.45, -6], [1.6, 0.9, 13], '#8a7f6a', { texture: 'none' }));
    parts.push(P('box', [45.8, 1.35, -6], [1.6, 0.9, 13], '#7a6f5a', { texture: 'none' }));
    parts.push(P('box', [46.4, 2.9, -6], [4.4, 0.3, 14], '#d94a3a', { texture: 'none' }));

    for (const fp of [[-44, -30], [44, -30], [-44, 30], [44, 30]]) {
        parts.push(P('cylinder', [fp[0], 3, fp[1]], [0.3, 6, 0.3], '#9a9aa2'));
        parts.push(P('box', [fp[0], 6.3, fp[1]], [1.8, 0.7, 0.8], '#f0e8b0', { material: 'Neon' }));
    }

    parts.push(P('box', [0, 0.9, -8], [6, 0.3, 7.5], '#d9a040',
        { rotation: [-0.28, 0, 0], texture: 'none', name: 'RaceRamp' }));
    for (const tp of [[-6, 2], [-4, 5], [6, 3], [4, -2], [0, 7]]) {
        parts.push(P('cylinder', [tp[0], 0.5, tp[1]], [1, 1, 1], '#1e1e22'));
    }
    parts.push(P('box', [8, 1.2, -4], [4.5, 2.4, 3], '#c9c2b0'));
    parts.push(P('box', [8, 2.6, -4], [5.2, 0.4, 3.6], '#4a5a6a', { texture: 'none' }));

    for (const tt of [[-16, -40], [16, -42], [-20, 40], [22, 38]]) {
        parts.push(P('cylinder', [tt[0], 1.4, tt[1]], [0.4, 1.4, 0.4], '#7a5230'));
        parts.push(P('box', [tt[0], 3.6, tt[1]], [2.8, 2.4, 2.8], '#3f8f3f'));
    }
    parts.push(P('box', [0, 0.4, 4], [2.6, 0.3, 2.6], '#5577d9', { spawn: true }));
    return parts;
}

function buildCar(color) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, roughness: 0.2, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.55, 4.2), bodyMat);
    body.position.y = 0.68;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.9), glassMat);
    cabin.position.set(0, 1.2, 0.25);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.7), bodyMat);
    nose.position.set(0, 0.5, -2.2);
    g.add(body, cabin, nose);
    const wheels = [];
    for (const wx of [-1.05, 1.05]) {
        for (const wz of [-1.35, 1.35]) {
            const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 14), darkMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(wx, 0.42, wz);
            g.add(w);
            wheels.push(w);
        }
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.55), darkMat);
    wing.position.set(0, 1.25, 2.05);
    g.add(wing);
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), darkMat);
    post1.position.set(-0.8, 0.98, 2.05);
    const post2 = post1.clone();
    post2.position.x = 0.8;
    g.add(post1, post2);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4c0, emissive: 0xfff0a0, emissiveIntensity: 0.9 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff5040, emissive: 0xd02010, emissiveIntensity: 0.8 });
    for (const sx of [-0.6, 0.6]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
        hl.position.set(sx, 0.72, -2.24);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
        tl.position.set(sx, 0.78, 2.14);
        g.add(hl, tl);
    }
    return g;
}

function init(ctx, api) {
    const scene = ctx.scene;
    const player = ctx.player;
    api.setBaseHud({ health: false, backpack: false, hotbar: false });

    let rt = null;
    try { rt = ctx.placeRuntime ? ctx.placeRuntime() : null; } catch (e) {}
    let marker = null;
    if (rt && rt.parts) {
        for (const [, entry] of rt.parts) {
            if ((entry.def.name || '') === 'TrackMarker') marker = entry.def;
        }
    }
    if (!marker || !Array.isArray(marker.waypoints) || marker.waypoints.length < 8) {
        api.popup('This racing place has no track');
        return { update() {}, dispose() {} };
    }

    const wp = marker.waypoints;
    const N = wp.length;
    const width = marker.width || 12;
    const rideTrack = 0.22;
    const rideGrass = 0.05;

    const h = (tag, cls, parent, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        if (parent) parent.appendChild(node);
        return node;
    };

    const top = h('div', null, api.root);
    top.id = 'rc-top';
    const lapChip = h('span', 'rc-chip', top, 'LAP 1/' + GOAL_LAPS);
    const posChip = h('span', 'rc-chip rc-pos', top, '1st');
    const timeChip = h('span', 'rc-chip', top, '0:00.0');
    const bestChip = h('span', 'rc-chip rc-best', top, 'BEST --');
    const trackTag = h('div', 'rc-track', api.root, marker.trackName || 'Circuit');

    const cdEl = h('div', 'rc-cd', api.root, '');

    const speedo = h('div', null, api.root);
    speedo.id = 'rc-speedo';
    const speedCan = document.createElement('canvas');
    speedCan.width = 190;
    speedCan.height = 110;
    speedo.appendChild(speedCan);
    const speedNum = h('div', 'rc-speed-num', speedo, '0');

    const mapBox = h('div', null, api.root);
    mapBox.id = 'rc-map';
    const mapCan = document.createElement('canvas');
    mapCan.width = 150;
    mapCan.height = 150;
    mapBox.appendChild(mapCan);

    const nitroBox = h('div', null, api.root);
    nitroBox.id = 'rc-nitro';
    h('span', 'rc-nitro-label', nitroBox, 'NITRO');
    const nitroFill = h('i', null, nitroBox);

    const results = h('div', null, api.root);
    results.id = 'rc-results';
    results.classList.add('rc-hidden');
    const resTitle = h('div', 'rc-res-title', results, 'RACE COMPLETE');
    const resSub = h('div', 'rc-res-sub', results, '');
    const resRows = h('div', 'rc-res-rows', results);
    const resBest = h('div', 'rc-res-best', results, '');
    const againBtn = h('button', 'rc-again', results, 'START NEW RACE');
    againBtn.type = 'button';

    api.style(`
#rc-top{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:44;display:flex;gap:8px}
#rc-top .rc-chip{background:rgba(14,14,18,.92);border:2px solid #000;border-radius:6px;
padding:5px 12px;font:bold italic 16px Tahoma,sans-serif;color:#fff;text-shadow:1px 1px 0 #000}
#rc-top .rc-pos{color:#ffd24a}
#rc-top .rc-best{color:#7fe0ff}
.rc-track{position:fixed;top:56px;left:16px;z-index:44;font:bold 13px Tahoma;color:#ffb04d;
text-shadow:1px 1px 0 #000;background:rgba(14,14,18,.7);padding:3px 10px;border-radius:5px}
.rc-cd{position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);z-index:45;
font:bold 110px Tahoma,sans-serif;color:#ffd24a;text-shadow:4px 4px 0 #000;pointer-events:none;
opacity:0;transition:opacity .15s}
.rc-cd.rc-on{opacity:1}
#rc-speedo{position:fixed;right:16px;bottom:16px;z-index:44;background:rgba(14,14,18,.92);
border:2px solid #000;border-radius:10px;padding:4px 6px 2px;text-align:center}
#rc-speedo canvas{display:block}
.rc-speed-num{font:bold italic 30px Tahoma,sans-serif;color:#ffd24a;text-shadow:2px 2px 0 #000;
margin-top:-6px}
#rc-map{position:fixed;right:16px;bottom:210px;z-index:44;background:rgba(14,14,18,.9);
border:2px solid #000;border-radius:8px;padding:5px}
#rc-map canvas{display:block}
#rc-nitro{position:fixed;bottom:16px;left:50%;margin-left:-130px;width:220px;height:20px;z-index:44;
background:rgba(14,14,18,.92);border:2px solid #000;border-radius:6px;overflow:hidden}
#rc-nitro .rc-nitro-label{position:absolute;left:6px;top:2px;font:bold 11px Tahoma;color:#0a0a0a;
z-index:2;text-shadow:0 0 2px #9be8ff}
#rc-nitro i{position:absolute;left:0;top:0;bottom:0;width:100%;display:block;
background:linear-gradient(#7fe0ff,#2f9fd0);transition:width .1s linear}
#rc-results{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:46;width:330px;
background:rgba(12,14,20,.96);border:3px solid #000;border-radius:10px;padding:18px 20px;
text-align:center;font-family:Tahoma,sans-serif}
#rc-results.rc-hidden{display:none}
.rc-res-title{font:bold 26px Tahoma;color:#ffd24a;text-shadow:2px 2px 0 #000;letter-spacing:2px}
.rc-res-sub{font:bold 15px Tahoma;color:#fff;margin-top:6px}
.rc-res-rows{margin:12px 0 4px;text-align:left}
.rc-res-row{font:bold 14px Tahoma;color:#cfd4dc;padding:4px 8px;border-bottom:1px solid #2a2d34}
.rc-res-row.rc-you{color:#ffd24a;background:rgba(255,210,74,.08)}
.rc-res-best{font:bold 13px Tahoma;color:#7fe0ff;margin-top:6px}
.rc-again{margin-top:12px;width:100%;font:bold 15px Tahoma;padding:9px;border:2px solid #000;
border-radius:6px;background:#3ec46d;color:#08240f;cursor:pointer;letter-spacing:1px}`, 'ui');

    const cars = [];
    function makeCar(def, slot) {
        const g = buildCar(def.color);
        scene.add(g);
        const car = {
            g, name: def.name, isPlayer: !!def.isPlayer, base: def.base,
            x: 0, z: 0, y: rideTrack, yaw: 0, speed: 0, vy: 0, air: false,
            target: 1, zones: [false, false, false], lap: 1,
            finished: false, finishOrder: 0, score: 0, nitro: 100,
            onTrack: true, color: def.color
        };
        cars.push(car);
        placeAtGrid(car, slot);
        return car;
    }

    function placeAtGrid(car, slot) {
        const s0 = wp[0], s1 = wp[1];
        const dx = s1[0] - s0[0], dz = s1[1] - s0[1];
        const L = Math.hypot(dx, dz) || 1;
        const fx = -dx / L, fz = -dz / L;
        const rx = -fz, rz = fx;
        const back = 4 + slot * 5;
        const lat = slot % 2 === 0 ? -2.6 : 2.6;
        car.x = s0[0] + fx * back + rx * lat;
        car.z = s0[1] + fz * back + rz * lat;
        car.yaw = Math.atan2(-dx / L, -dz / L);
        car.speed = 0;
        car.vy = 0;
        car.air = false;
        car.y = rideTrack;
        car.target = 1;
        car.zones = [false, false, false];
        car.lap = 1;
        car.finished = false;
        car.finishOrder = 0;
        car.g.position.set(car.x, car.y, car.z);
        car.g.rotation.y = car.yaw;
    }

    const playerCar = makeCar({ name: 'You', color: '#d9423a', base: 17, isPlayer: true }, 0);
    makeCar({ name: 'Rival Blue', color: '#3a6fd8', base: 14.2 }, 1);
    makeCar({ name: 'Rival Green', color: '#3fbf5f', base: 15.0 }, 2);
    makeCar({ name: 'Rival Yellow', color: '#e0b040', base: 13.7 }, 3);

    let phase = 'wait';
    let countT = 0;
    let goFlash = 0;
    let elapsed = 0;
    let finishCounter = 0;
    let lastCdLabel = '';
    let disposed = false;

    const saved = api.load();
    let bestTime = saved && Number(saved.best) > 0 ? Number(saved.best) : 0;
    bestChip.textContent = bestTime ? 'BEST ' + fmt(bestTime) : 'BEST --';

    function fmt(sec) {
        const m = Math.floor(sec / 60);
        const s = sec - m * 60;
        return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
    }

    function beginCountdown() {
        if (phase === 'count' || phase === 'race') return;
        phase = 'count';
        countT = 3.4;
        cdEl.classList.add('rc-on');
        playSound('spawn');
    }

    const menu = document.getElementById('place-menu');
    const playBtn = document.getElementById('place-menu-play');
    if (menu && playBtn && !menu.classList.contains('hidden')) {
        playBtn.addEventListener('click', beginCountdown, { once: true });
    } else {
        beginCountdown();
    }

    const keys = {};
    const KEYMAP = {
        KeyW: 'up', ArrowUp: 'up',
        KeyS: 'down', ArrowDown: 'down',
        KeyA: 'left', ArrowLeft: 'left',
        KeyD: 'right', ArrowRight: 'right',
        ShiftLeft: 'nitro', ShiftRight: 'nitro'
    };
    function onKey(e) {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const k = KEYMAP[e.code];
        if (!k) return;
        const down = e.type === 'keydown';
        if (keys[k] !== down) {
            keys[k] = down;
            if (down) e.preventDefault();
        }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    function distToPath(x, z) {
        let best = Infinity;
        for (let i = 0; i < N; i++) {
            const a = wp[i], b = wp[(i + 1) % N];
            const abx = b[0] - a[0], abz = b[1] - a[1];
            const apx = x - a[0], apz = z - a[1];
            const len2 = abx * abx + abz * abz || 1;
            let t = (apx * abx + apz * abz) / len2;
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            const dx = apx - abx * t, dz = apz - abz * t;
            const d = dx * dx + dz * dz;
            if (d < best) best = d;
        }
        return Math.sqrt(best);
    }

    function wrapAngle(a) {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
    }

    function inRampZone(car) {
        return Math.abs(car.x) < 3.4 && car.z < -4 && car.z > -13;
    }

    function advanceTarget(car) {
        for (let hop = 0; hop < 3; hop++) {
            const t = wp[car.target];
            const dx = t[0] - car.x, dz = t[1] - car.z;
            if (dx * dx + dz * dz > 49) break;
            const arrived = car.target;
            car.target = (car.target + 1) % N;
            if (arrived >= 10 && arrived < 20) car.zones[0] = true;
            if (arrived >= 20 && arrived < 30) car.zones[1] = true;
            if (arrived >= 30) car.zones[2] = true;
            if (arrived === 0 && car.zones[0] && car.zones[1] && car.zones[2]) {
                car.lap++;
                car.zones = [false, false, false];
                if (car.isPlayer && car.lap <= GOAL_LAPS) playSound('click');
                if (car.lap > GOAL_LAPS) finishCar(car);
            }
        }
        const t = wp[car.target];
        const dx = t[0] - car.x, dz = t[1] - car.z;
        const rem = Math.sqrt(dx * dx + dz * dz);
        car.score = car.finished
            ? 100000 - car.finishOrder
            : car.lap * 10000 + car.target * 100 + Math.round((1 - Math.min(1, rem / 7)) * 90);
    }

    function finishCar(car) {
        if (car.finished) return;
        car.finished = true;
        finishCounter++;
        car.finishOrder = finishCounter;
        if (car.isPlayer) {
            phase = 'done';
            showResults();
            if (!bestTime || elapsed < bestTime) {
                bestTime = elapsed;
                api.save({ best: bestTime });
                bestChip.textContent = 'BEST ' + fmt(bestTime);
            }
        }
    }

    function showResults() {
        const order = cars.slice().sort((a, b) => b.score - a.score);
        const myPlace = order.findIndex((c) => c.isPlayer) + 1;
        const suffix = ['st', 'nd', 'rd', 'th'][myPlace - 1] || 'th';
        resTitle.textContent = myPlace === 1 ? 'VICTORY' : 'RACE COMPLETE';
        resSub.textContent = 'You finished ' + myPlace + suffix + ' of ' + FIELD + '  -  ' + fmt(elapsed);
        resRows.textContent = '';
        for (let i = 0; i < order.length; i++) {
            const row = h('div', 'rc-res-row' + (order[i].isPlayer ? ' rc-you' : ''), resRows,
                (i + 1) + '. ' + order[i].name + (order[i].finished ? '' : '  (running)'));
        }
        resBest.textContent = bestTime ? 'Best time: ' + fmt(bestTime) : '';
        results.classList.remove('rc-hidden');
    }

    againBtn.addEventListener('click', () => {
        results.classList.add('rc-hidden');
        finishCounter = 0;
        elapsed = 0;
        let slot = 0;
        for (const c of cars) placeAtGrid(c, slot++);
        phase = 'wait';
        beginCountdown();
    });

    const camSaved = { angle: player.cameraState.angle, radius: player.cameraState.radius, pitch: player.cameraState.pitch };
    try { player.lockInput(true); } catch (e) {}
    if (player.model) player.model.visible = false;

    function updateCarPhysics(car, dt) {
        const rampZone = inRampZone(car);
        const near = distToPath(car.x, car.z);
        car.onTrack = near <= width / 2 || rampZone;

        if (car.isPlayer) {
            if (phase === 'race' && !car.finished) {
                const boosting = keys.nitro && keys.up && car.nitro > 0 && car.onTrack;
                let max = car.base * (boosting ? 1.3 : 1);
                if (!car.onTrack) max *= 0.45;
                if (keys.up) car.speed += 12 * dt;
                else if (keys.down) car.speed -= (car.speed > 0.5 ? 24 : 8) * dt;
                else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
                car.speed -= car.speed * (car.onTrack ? 0.3 : 1.6) * dt;
                if (car.speed > max) car.speed += (max - car.speed) * 3.5 * dt;
                if (car.speed < -7) car.speed = -7;
                if (boosting) car.nitro = Math.max(0, car.nitro - 36 * dt);
                else car.nitro = Math.min(100, car.nitro + 11 * dt);
                const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
                const grip = Math.min(1, Math.abs(car.speed) / 7);
                car.yaw += steer * 2.2 * grip * (car.speed >= 0 ? 1 : -1) * dt;
            } else {
                car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
            }
        } else if (phase === 'race' && !car.finished) {
            const t = wp[car.target];
            const dx = t[0] - car.x, dz = t[1] - car.z;
            const want = Math.atan2(-dx, -dz);
            const diff = wrapAngle(want - car.yaw);
            car.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff * 2.2 * dt));
            const corner = 1 - Math.min(0.5, Math.abs(diff) * 0.45);
            let target = car.base * corner;
            const gap = playerCar.score - car.score;
            if (gap > 400) target *= 1.1;
            else if (gap < -400) target *= 0.9;
            if (!car.onTrack) target *= 0.5;
            car.speed += (target - car.speed) * 1.7 * dt;
        } else {
            car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
        }

        car.x += -Math.sin(car.yaw) * car.speed * dt;
        car.z += -Math.cos(car.yaw) * car.speed * dt;

        const rideY = car.onTrack ? rideTrack : rideGrass;
        if (!car.air && rampZone && car.speed > 8.5) {
            car.air = true;
            car.vy = 6.4;
            playSound('jump');
        }
        if (car.air) {
            car.vy -= 16 * dt;
            car.y += car.vy * dt;
            if (car.y <= rideY) {
                car.y = rideY;
                car.vy = 0;
                car.air = false;
            }
        } else {
            car.y += (rideY - car.y) * Math.min(1, 9 * dt);
        }

        advanceTarget(car);
        car.g.position.set(car.x, car.y, car.z);
        car.g.rotation.y = car.yaw;
    }

    const sgCtx = speedCan.getContext('2d');
    function drawSpeedo() {
        const g = sgCtx;
        g.clearRect(0, 0, 190, 110);
        const cx = 95, cy = 100, r = 78;
        g.lineWidth = 14;
        g.strokeStyle = '#26262e';
        g.beginPath();
        g.arc(cx, cy, r, Math.PI, Math.PI * 2);
        g.stroke();
        const frac = Math.min(1, Math.abs(playerCar.speed) / (playerCar.base * 1.3));
        const end = Math.PI + Math.PI * frac;
        g.strokeStyle = frac > 0.8 ? '#ff5a3c' : (frac > 0.55 ? '#ffb02e' : '#3ec46d');
        g.beginPath();
        g.arc(cx, cy, r, Math.PI, end);
        g.stroke();
        g.strokeStyle = '#e8e8e8';
        g.lineWidth = 3;
        for (let i = 0; i <= 8; i++) {
            const a = Math.PI + (Math.PI * i) / 8;
            const x1 = cx + Math.cos(a) * (r - 12), y1 = cy + Math.sin(a) * (r - 12);
            const x2 = cx + Math.cos(a) * (r - 2), y2 = cy + Math.sin(a) * (r - 2);
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke();
        }
        const na = Math.PI + Math.PI * frac;
        g.strokeStyle = '#ffd24a';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(na) * (r - 18), cy + Math.sin(na) * (r - 18));
        g.stroke();
        g.fillStyle = '#ffd24a';
        g.beginPath();
        g.arc(cx, cy, 6, 0, Math.PI * 2);
        g.fill();
    }

    const mapCtx = mapCan.getContext('2d');
    let mmBounds = null;
    function ensureBounds() {
        if (mmBounds) return mmBounds;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of wp) {
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minZ) minZ = p[1];
            if (p[1] > maxZ) maxZ = p[1];
        }
        mmBounds = { minX, maxX, minZ, maxZ };
        return mmBounds;
    }
    function mmPoint(x, z) {
        const b = ensureBounds();
        const spanX = Math.max(1, b.maxX - b.minX);
        const spanZ = Math.max(1, b.maxZ - b.minZ);
        const scale = Math.min(130 / spanX, 130 / spanZ);
        const ox = (150 - spanX * scale) / 2;
        const oz = (150 - spanZ * scale) / 2;
        return [ox + (x - b.minX) * scale, oz + (z - b.minZ) * scale];
    }
    function drawMap() {
        const g = mapCtx;
        g.clearRect(0, 0, 150, 150);
        g.lineJoin = 'round';
        g.beginPath();
        for (let i = 0; i <= N; i++) {
            const p = mmPoint(wp[i % N][0], wp[i % N][1]);
            if (i === 0) g.moveTo(p[0], p[1]);
            else g.lineTo(p[0], p[1]);
        }
        g.strokeStyle = '#000';
        g.lineWidth = 8;
        g.stroke();
        g.strokeStyle = '#ff9f43';
        g.lineWidth = 4;
        g.stroke();
        const sp = mmPoint(wp[0][0], wp[0][1]);
        g.fillStyle = '#fff';
        g.fillRect(sp[0] - 3, sp[1] - 3, 6, 6);
        for (const c of cars) {
            const p = mmPoint(c.x, c.z);
            g.fillStyle = c.isPlayer ? '#ff4d4a' : c.color;
            g.beginPath();
            g.arc(p[0], p[1], c.isPlayer ? 4.5 : 3.2, 0, Math.PI * 2);
            g.fill();
        }
    }

    function rankOf(car) {
        let rank = 1;
        for (const other of cars) {
            if (other !== car && other.score > car.score) rank++;
        }
        return rank;
    }

    let mapTick = 0;
    function update(dtMs) {
        if (disposed) return;
        let dt = Math.min(dtMs / 1000, 0.05);
        if (dt <= 0) return;

        if (phase === 'wait') {
            for (const c of cars) updateCarPhysics(c, dt);
        } else if (phase === 'count') {
            countT -= dt;
            const label = countT > 2.4 ? '3' : (countT > 1.4 ? '2' : (countT > 0.4 ? '1' : 'GO!'));
            if (label !== lastCdLabel) {
                lastCdLabel = label;
                cdEl.textContent = label;
                if (label !== 'GO!') playSound('click');
            }
            if (countT <= 0.4) {
                phase = 'race';
                elapsed = 0;
                goFlash = 0.85;
                playSound('spawn');
            }
            for (const c of cars) updateCarPhysics(c, dt);
        } else if (phase === 'race') {
            elapsed += dt;
            for (const c of cars) updateCarPhysics(c, dt);
        } else if (phase === 'done') {
            for (const c of cars) updateCarPhysics(c, dt);
        }

        if (goFlash > 0) {
            goFlash -= dt;
            if (goFlash <= 0) {
                cdEl.classList.remove('rc-on');
                cdEl.textContent = '';
            }
        }
        if (phase === 'wait') {
            cdEl.classList.add('rc-on');
            cdEl.textContent = 'READY';
        }

        const model = player.model;
        if (model) {
            model.visible = false;
            model.position.set(playerCar.x, playerCar.y - 0.4, playerCar.z);
        }
        const cam = player.cameraState;
        const da = wrapAngle(playerCar.yaw - cam.angle);
        cam.angle += da * Math.min(1, dt * 6);

        lapChip.textContent = 'LAP ' + Math.min(playerCar.lap, GOAL_LAPS) + '/' + GOAL_LAPS;
        const rank = rankOf(playerCar);
        posChip.textContent = rank + (['st', 'nd', 'rd'][rank - 1] || 'th');
        timeChip.textContent = fmt(elapsed);
        speedNum.textContent = String(Math.round(Math.abs(playerCar.speed) * 4.4));
        nitroFill.style.width = playerCar.nitro + '%';
        drawSpeedo();
        mapTick -= dt;
        if (mapTick <= 0) {
            mapTick = 0.1;
            drawMap();
        }
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        try { player.lockInput(false); } catch (e) {}
        if (player.model) player.model.visible = true;
        player.cameraState.angle = camSaved.angle;
        player.cameraState.radius = camSaved.radius;
        player.cameraState.pitch = camSaved.pitch;
        for (const c of cars) {
            c.g.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) o.material.dispose();
            });
            scene.remove(c.g);
        }
        cars.length = 0;
    }

    return { state: { phase: () => phase, cars, elapsed: () => elapsed, laps: GOAL_LAPS, waypoints: wp }, actions: { beginCountdown }, update, dispose };
}

registerGenre({ id: 'racing', layout, init });
