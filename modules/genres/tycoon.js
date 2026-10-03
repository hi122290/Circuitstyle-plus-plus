import * as THREE from 'three';
import { registerGenre, makeParts } from './core.js?v=1';
import { playSound } from '../audio.js';

const P = makeParts('t');

const UPGRADES = [
    { key: 'dropper', name: 'Dropper', price: 25 },
    { key: 'conveyor', name: 'Conveyor', price: 60 },
    { key: 'collector', name: 'Collector', price: 100 },
    { key: 'super', name: 'Super Dropper', price: 250 }
];

function layout() {
    const parts = [];
    parts.push(P('ground', [0, -0.5, 0], [1, 1, 1], '#6b8f4f', { texture: 'grass' }));
    parts.push(P('box', [0, 0.3, 0], [18, 0.6, 18], '#d8d8d0'));
    parts.push(P('box', [0, 0.75, 7], [2.4, 0.3, 2.4], '#5577d9', { spawn: true, name: 'TycoonSpawn' }));

    for (let i = 0; i < 9; i++) {
        parts.push(P('box', [-6 + i * 1.5, 0.95, -3], [1.44, 0.3, 2.4], '#3c3c46',
            { texture: 'none', name: 'TycoonBelt' + i }));
    }
    parts.push(P('box', [0, 0.85, -4.4], [14, 0.3, 0.3], '#777780'));
    parts.push(P('box', [0, 0.85, -1.6], [14, 0.3, 0.3], '#777780'));

    for (const lx of [-8.5, -6.5]) {
        for (const lz of [-4, -2]) {
            parts.push(P('box', [lx, 1.15, lz], [0.3, 2.3, 0.3], '#6d6d78'));
        }
    }
    parts.push(P('box', [-7.5, 2.8, -3], [2.6, 1.4, 2.6], '#3a6fd8', { name: 'TycoonDropper' }));
    parts.push(P('box', [-7.5, 2.0, -3], [0.9, 0.5, 0.9], '#2c50a0', { name: 'TycoonNozzle' }));
    parts.push(P('box', [-7.5, 3.7, -3], [2.9, 0.4, 2.9], '#2c50a0'));

    parts.push(P('box', [7.5, 1.1, -3], [2.2, 2.2, 2.2], '#f0c020', { name: 'TycoonCollector' }));
    parts.push(P('box', [6.3, 1.5, -3], [0.35, 0.9, 1.3], '#b8860a', { texture: 'none' }));
    parts.push(P('box', [7.5, 3.3, -3], [0.2, 1.1, 0.2], '#777780'));
    parts.push(P('box', [7.5, 4.1, -3], [2.6, 1.0, 0.16], '#e8d040', { texture: 'none' }));

    const padX = [-6, -2, 2, 6];
    for (let i = 0; i < 4; i++) {
        parts.push(P('box', [padX[i], 0.75, 5], [2.6, 0.3, 2.6], '#8a8a8a',
            { name: 'TycoonPad' + (i + 1), texture: 'none' }));
    }
    parts.push(P('box', [0, 0.75, -7], [3.6, 0.3, 3.6], '#a04848',
        { name: 'TycoonRebirth', texture: 'none' }));
    parts.push(P('box', [11.5, 0.15, 6], [3, 0.3, 3], '#55d970',
        { material: 'Neon', special: 'cash', texture: 'none' }));

    parts.push(P('box', [-5, 1.7, -8.4], [6.4, 2.2, 0.3], '#c9b078'));
    parts.push(P('box', [-8.3, 1.7, -6.4], [0.3, 2.2, 4.3], '#c9b078'));
    parts.push(P('box', [-1.7, 1.7, -6.4], [0.3, 2.2, 4.3], '#c9b078'));
    parts.push(P('box', [-6.6, 1.7, -4.4], [3.6, 2.2, 0.3], '#c9b078'));
    parts.push(P('box', [-3.4, 1.7, -4.4], [3.6, 2.2, 0.3], '#c9b078'));
    parts.push(P('box', [-5, 3.1, -6.4], [7.2, 0.5, 5.4], '#8a5a40'));

    const post = [];
    for (let x = -9; x <= 9; x += 4.5) {
        post.push([x, -9.6], [x, 9.6]);
    }
    for (let z = -5; z <= 5; z += 5) {
        post.push([-9.6, z], [9.6, z]);
    }
    for (const pp of post) {
        if (pp[1] > 9 && Math.abs(pp[0]) < 3) continue;
        parts.push(P('cylinder', [pp[0], 0.6, pp[1]], [0.24, 1.2, 0.24], '#8a6a40'));
    }

    parts.push(P('box', [0, 0.06, 14], [30, 0.12, 4.4], '#4a4a52', { texture: 'none' }));
    for (let i = -3; i <= 3; i++) {
        parts.push(P('box', [i * 4, 0.13, 14], [1.6, 0.03, 0.3], '#e8e8e8', { texture: 'none' }));
    }

    const trees = [[-14, -12], [15, -10], [-16, 8]];
    for (const tt of trees) {
        parts.push(P('cylinder', [tt[0], 1.3, tt[1]], [0.4, 1.3, 0.4], '#7a5230'));
        parts.push(P('box', [tt[0], 3.4, tt[1]], [2.6, 2.2, 2.6], '#4f9f4f'));
    }
    for (const cc of [[8.4, 8.4], [9.2, 7], [-8.6, 8.2]]) {
        parts.push(P('box', [cc[0], 1.0, cc[1]], [1.1, 1.1, 1.1], '#b08850', { rotation: [0, cc[0], 0] }));
    }

    parts.push(P('box', [5, 2.2, 8.6], [0.2, 1.6, 0.2], '#777780'));
    parts.push(P('box', [5, 3.4, 8.6], [3.4, 1.2, 0.16], '#e0b040', { texture: 'none' }));
    parts.push(P('box', [5, 3.4, 8.5], [3.0, 0.7, 0.06], '#2c50a0', { texture: 'none' }));
    return parts;
}

function init(ctx, api) {
    const scene = ctx.scene;
    const player = ctx.player;
    api.setBaseHud({ hotbar: false });

    const state = {
        cash: 0,
        rebirth: 0,
        ups: { dropper: 0, conveyor: 0, collector: 0, super: 0 },
        totalEarned: 0,
        cubesCollected: 0,
        lastSeen: 0
    };
    const saved = api.load();
    if (saved) {
        state.cash = Math.max(0, Number(saved.cash) || 0);
        state.rebirth = Math.max(0, Number(saved.rebirth) || 0);
        state.totalEarned = Math.max(0, Number(saved.totalEarned) || 0);
        state.cubesCollected = Math.max(0, Number(saved.cubesCollected) || 0);
        state.lastSeen = Number(saved.lastSeen) || 0;
        for (const u of UPGRADES) {
            state.ups[u.key] = saved.ups && saved.ups[u.key] ? 1 : 0;
        }
    }

    const mult = () => 1 + state.rebirth * 0.5;
    const cubeInterval = () => Math.max(0.5, 1.5 - state.ups.conveyor * 0.25 - state.ups.super * 0.2);
    const cubeValue = () => (2 + state.ups.collector + state.ups.super * 3) * mult();
    function ips() {
        let v = 1 * mult();
        if (state.ups.dropper) v += (1 + state.ups.super) * cubeValue() / cubeInterval();
        return v;
    }

    let awayGain = 0;
    if (state.lastSeen) {
        const gap = Math.min((Date.now() - state.lastSeen) / 1000, 8 * 3600);
        if (gap > 10) awayGain = Math.floor(gap * ips() * 0.5);
        state.cash += awayGain;
    }
    state.lastSeen = Date.now();

    const h = (tag, cls, parent, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        if (parent) parent.appendChild(node);
        return node;
    };

    const cashBox = h('div', null, api.root);
    cashBox.id = 'ty-cash';
    const cashAmt = h('div', 'ty-amt', cashBox, '$0');
    const cashIps = h('div', 'ty-ips', cashBox, '+$0/s');
    const rebTag = h('div', 'ty-reb', cashBox, 'Rebirth 0 - x1 income');

    const shop = h('div', null, api.root);
    shop.id = 'ty-shop';
    h('div', 'ty-title', shop, 'TYCOON SHOP');
    h('div', 'ty-hint', shop, 'Walk onto a pad or press BUY');
    const rows = [];
    for (const up of UPGRADES) {
        const row = h('div', 'ty-row', shop);
        const info = h('div', 'ty-info', row);
        h('div', 'ty-name', info, up.name);
        h('div', 'ty-price', info, '$' + up.price);
        const btn = h('button', 'ty-buy', row, '$' + up.price);
        btn.type = 'button';
        rows.push({ up, row, btn });
    }
    const rebBtn = h('button', 'ty-rebbtn', shop, 'REBIRTH (need $500)');
    rebBtn.type = 'button';
    rebBtn.id = 'ty-rebbtn';

    api.style(`
#ty-cash{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:44;text-align:center;
background:rgba(12,16,12,.9);border:2px solid #000;border-radius:8px;padding:6px 22px 8px;min-width:210px}
#ty-cash .ty-amt{font:bold 34px Tahoma,sans-serif;color:#ffe14d;text-shadow:2px 2px 0 #000;letter-spacing:1px}
#ty-cash .ty-ips{font:bold 15px Tahoma,sans-serif;color:#5ef07a;text-shadow:1px 1px 0 #000;margin-top:1px}
#ty-cash .ty-reb{font:bold 12px Tahoma,sans-serif;color:#ffb04d;text-shadow:1px 1px 0 #000;margin-top:3px}
#ty-shop{position:fixed;right:16px;bottom:14px;width:206px;z-index:44;background:rgba(16,18,24,.92);
border:2px solid #000;border-radius:8px;padding:8px 8px 10px;font-family:Tahoma,sans-serif}
#ty-shop .ty-title{font:bold 15px Tahoma;color:#ffe14d;text-align:center;letter-spacing:2px;
border-bottom:1px solid #444;padding-bottom:5px;margin-bottom:4px}
#ty-shop .ty-hint{font:bold 11px Tahoma;color:#9aa0aa;text-align:center;margin-bottom:5px}
#ty-shop .ty-row{display:flex;align-items:center;justify-content:space-between;gap:6px;
padding:5px 2px;border-bottom:1px solid #2a2d34}
#ty-shop .ty-name{font:bold 13px Tahoma;color:#e8e8e8}
#ty-shop .ty-price{font:bold 11px Tahoma;color:#9aa0aa}
#ty-shop .ty-buy{font:bold 13px Tahoma;padding:5px 10px;border:2px solid #000;border-radius:5px;
background:#3ec46d;color:#08240f;cursor:pointer}
#ty-shop .ty-buy:disabled{background:#4a4f57;color:#8b9098;cursor:default}
#ty-shop .ty-row.ty-owned .ty-buy{background:#2b3d33;color:#5ef07a}
#ty-shop .ty-rebbtn{width:100%;margin-top:8px;font:bold 13px Tahoma;padding:7px 4px;border:2px solid #000;
border-radius:5px;background:#e08a2c;color:#241000;cursor:pointer;letter-spacing:1px}
#ty-shop .ty-rebbtn:disabled{background:#4a4f57;color:#8b9098;cursor:default}`, 'ui');

    const rt = ctx.placeRuntime ? ctx.placeRuntime() : null;
    const padRecs = [];
    const originalPadLooks = new Map();
    if (rt && rt.parts) {
        for (const [pid, entry] of rt.parts) {
            const nm = entry.def.name || '';
            const m = /^TycoonPad([1-4])$/.exec(nm);
            if (m) {
                const idx = parseInt(m[1], 10) - 1;
                padRecs[idx] = { def: entry.def, mesh: entry.mesh, up: UPGRADES[idx] };
                originalPadLooks.set(pid, { color: entry.mesh.material.color.getHexString(), visible: entry.mesh.visible });
            } else if (nm === 'TycoonRebirth') {
                padRecs[4] = { def: entry.def, mesh: entry.mesh, up: null, rebirth: true };
                originalPadLooks.set(pid, { color: entry.mesh.material.color.getHexString(), visible: entry.mesh.visible });
            }
        }
    }

    function findPart(nm) {
        if (!rt || !rt.parts) return null;
        for (const [, entry] of rt.parts) {
            if ((entry.def.name || '') === nm) return entry;
        }
        return null;
    }

    const nozzleEntry = findPart('TycoonNozzle');
    const nozzlePos = nozzleEntry ? nozzleEntry.def.position : [-7.5, 2, -3];
    const collectorEntry = findPart('TycoonCollector');
    const collectorX = collectorEntry ? collectorEntry.def.position[0] : 7.5;

    function makeLabel(text, bg, fg) {
        const cv = document.createElement('canvas');
        cv.width = 256;
        cv.height = 72;
        const g = cv.getContext('2d');
        const tex = new THREE.CanvasTexture(cv);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        spr.scale.set(4.2, 1.18, 1);
        spr.userData = { cv, g, tex };
        drawLabel(spr, text, bg, fg);
        return spr;
    }

    function drawLabel(spr, text, bg, fg) {
        const { g, cv, tex } = spr.userData;
        g.clearRect(0, 0, cv.width, cv.height);
        g.fillStyle = bg;
        g.fillRect(4, 8, cv.width - 8, cv.height - 16);
        g.strokeStyle = '#000';
        g.lineWidth = 5;
        g.strokeRect(4, 8, cv.width - 8, cv.height - 16);
        g.fillStyle = fg;
        g.font = 'bold 34px Tahoma';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, cv.width / 2, cv.height / 2 + 1);
        tex.needsUpdate = true;
    }

    for (let i = 0; i < 4; i++) {
        const rec = padRecs[i];
        if (!rec) continue;
        const spr = makeLabel(UPGRADES[i].name + '  $' + UPGRADES[i].price, '#3a3f48', '#ffe97a');
        spr.position.set(rec.def.position[0], 2.3, rec.def.position[2]);
        scene.add(spr);
        rec.label = spr;
    }
    let rebLabel = null;
    if (padRecs[4]) {
        rebLabel = makeLabel('REBIRTH', '#5a2020', '#ffd0d0');
        rebLabel.position.set(padRecs[4].def.position[0], 2.3, padRecs[4].def.position[2]);
        scene.add(rebLabel);
    }

    const dropperEntry = findPart('TycoonDropper');
    const hopperPos = dropperEntry ? dropperEntry.def.position : [-7.5, 2.8, -3];

    const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const cubeMat = new THREE.MeshStandardMaterial({
        color: 0xffd23e, metalness: 0.35, roughness: 0.35,
        emissive: 0x6b4a00, emissiveIntensity: 0.55
    });
    const cubes = [];
    let cubeTimer = 0;

    function spawnCube(x2) {
        const mesh = new THREE.Mesh(cubeGeo, cubeMat);
        mesh.position.set(nozzlePos[0] + (x2 ? 0.5 : -0.2), nozzlePos[1] - 0.6, nozzlePos[2] + (x2 ? 0.3 : -0.2));
        scene.add(mesh);
        cubes.push({ mesh, phase: 'fall', spin: Math.random() * Math.PI });
    }

    function killCube(rec) {
        scene.remove(rec.mesh);
        const i = cubes.indexOf(rec);
        if (i >= 0) cubes.splice(i, 1);
    }

    function collectCube() {
        state.cash += cubeValue();
        state.totalEarned += cubeValue();
        state.cubesCollected++;
    }

    function buy(i) {
        const up = UPGRADES[i];
        if (!up || state.ups[up.key]) return false;
        if (state.cash < up.price) {
            api.popup('Need $' + Math.ceil(up.price - state.cash) + ' more for ' + up.name);
            return false;
        }
        state.cash -= up.price;
        state.ups[up.key] = 1;
        playSound('click');
        api.popup(up.name + ' installed!');
        refresh(true);
        persist();
        return true;
    }

    function rebirth() {
        if (state.rebirth >= 9) return false;
        if (state.cash < 500) {
            api.popup('Rebirth needs $500 (have $' + Math.floor(state.cash) + ')');
            return false;
        }
        state.cash = 0;
        state.rebirth++;
        state.ups = { dropper: 0, conveyor: 0, collector: 0, super: 0 };
        while (cubes.length) killCube(cubes[0]);
        cubeTimer = 0;
        playSound('roblox_click');
        api.popup('REBIRTH ' + state.rebirth + ' - income x' + mult().toFixed(1));
        refresh(true);
        persist();
        return true;
    }

    for (let i = 0; i < rows.length; i++) {
        rows[i].btn.addEventListener('click', () => buy(i));
    }
    rebBtn.addEventListener('click', () => rebirth());

    function persist() {
        state.lastSeen = Date.now();
        api.save({
            cash: state.cash,
            rebirth: state.rebirth,
            ups: state.ups,
            totalEarned: state.totalEarned,
            cubesCollected: state.cubesCollected,
            lastSeen: state.lastSeen
        });
    }

    function refresh(force) {
        cashAmt.textContent = '$' + Math.floor(state.cash).toLocaleString('en-US');
        cashIps.textContent = '+$' + ips().toFixed(1) + '/s';
        rebTag.textContent = 'Rebirth ' + state.rebirth + ' - x' + mult().toFixed(1) + ' income';
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const owned = !!state.ups[r.up.key];
            const afford = state.cash >= r.up.price;
            r.row.classList.toggle('ty-owned', owned);
            r.btn.disabled = owned || !afford;
            r.btn.textContent = owned ? 'OWNED' : '$' + r.up.price;
            const rec = padRecs[i];
            if (rec && rec.mesh) {
                rec.mesh.visible = !owned;
                if (!owned && rec.mesh.material && rec.mesh.material.color) {
                    rec.mesh.material.color.set(afford ? '#4fe06a' : '#8a8a8a');
                }
                if (rec.label) {
                    rec.label.visible = !owned;
                    if (force || rec._lastAfford !== afford) {
                        drawLabel(rec.label, r.up.name + '  $' + r.up.price,
                            afford ? '#1f6b35' : '#3a3f48', afford ? '#eaffe8' : '#ffe97a');
                        rec._lastAfford = afford;
                    }
                }
            }
        }
        const rebReady = state.cash >= 500 && state.rebirth < 9;
        rebBtn.disabled = !rebReady;
        rebBtn.textContent = state.rebirth >= 9 ? 'MAX REBIRTH' :
            (rebReady ? 'REBIRTH NOW (x' + (1 + (state.rebirth + 1) * 0.5).toFixed(1) + ')' : 'REBIRTH (need $500)');
        if (rebLabel) {
            drawLabel(rebLabel, rebReady ? 'REBIRTH READY' : 'REBIRTH',
                rebReady ? '#1f6b35' : '#5a2020', rebReady ? '#eaffe8' : '#ffd0d0');
        }
    }

    if (awayGain >= 1) {
        api.popup('+$' + awayGain.toLocaleString('en-US') + ' while you were away');
    }

    const beltSpeed = () => 3 + state.ups.conveyor * 1.6;
    let hudTick = 0;
    let saveTick = 0;
    let padCd = 0;
    let disposed = false;

    function update(dtMs) {
        if (disposed) return;
        let dt = Math.min(dtMs / 1000, 0.05);
        if (dt <= 0) return;

        state.cash += 1 * mult() * dt;

        if (state.ups.dropper) {
            cubeTimer += dt;
            const interval = cubeInterval();
            while (cubeTimer >= interval) {
                cubeTimer -= interval;
                spawnCube(false);
                if (state.ups.super) spawnCube(true);
            }
        }

        for (let i = cubes.length - 1; i >= 0; i--) {
            const rec = cubes[i];
            const m = rec.mesh;
            if (rec.phase === 'fall') {
                m.position.y -= 5.5 * dt;
                m.rotation.x += 3 * dt;
                if (m.position.y <= 1.35) {
                    m.position.y = 1.35;
                    rec.phase = 'slide';
                }
            } else {
                m.position.x += beltSpeed() * dt;
                m.rotation.z -= 4 * dt;
                if (m.position.x >= collectorX - 0.6) {
                    collectCube();
                    killCube(rec);
                    continue;
                }
            }
        }

        padCd -= dt;
        const pmodel = player && player.model;
        if (pmodel && padCd <= 0) {
            const px = pmodel.position.x;
            const pz = pmodel.position.z;
            for (let i = 0; i < 4; i++) {
                const rec = padRecs[i];
                if (!rec || state.ups[UPGRADES[i].key]) continue;
                const dx = px - rec.def.position[0];
                const dz = pz - rec.def.position[2];
                if (dx * dx + dz * dz < 8.5 && state.cash >= rec.up.price) {
                    buy(i);
                    padCd = 1.4;
                    break;
                }
            }
            const rrec = padRecs[4];
            if (rrec && state.rebirth < 9 && state.cash >= 500) {
                const dx = px - rrec.def.position[0];
                const dz = pz - rrec.def.position[2];
                if (dx * dx + dz * dz < 7 && padCd <= 0) {
                    rebirth();
                    padCd = 1.4;
                }
            }
        }

        hudTick -= dt;
        if (hudTick <= 0) {
            hudTick = 0.22;
            refresh(false);
        }
        saveTick += dt;
        if (saveTick >= 6) {
            saveTick = 0;
            persist();
        }
    }

    refresh(true);

    function dispose() {
        if (disposed) return;
        disposed = true;
        persist();
        while (cubes.length) killCube(cubes[0]);
        cubeGeo.dispose();
        cubeMat.dispose();
        for (let i = 0; i < padRecs.length; i++) {
            const rec = padRecs[i];
            if (!rec) continue;
            if (rec.label) {
                rec.label.material.map.dispose();
                rec.label.material.dispose();
                scene.remove(rec.label);
            }
            const orig = originalPadLooks.get(rec.def.id);
            if (rec.mesh && orig) {
                rec.mesh.material.color.set('#' + orig.color);
                rec.mesh.visible = orig.visible;
            }
        }
        if (rebLabel) {
            rebLabel.material.map.dispose();
            rebLabel.material.dispose();
            scene.remove(rebLabel);
        }
    }

    return { state, actions: { buy, rebirth }, update, dispose };
}

registerGenre({ id: 'tycoon', layout, init });
