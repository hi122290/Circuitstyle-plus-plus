import { registerGenre, makeParts } from './core.js?v=1';

const P = makeParts('o');

const CHECKS = [
    { x: 0, y: 1.2, z: 6, r: 12 },
    { x: 0, y: 3.5, z: 23, r: 3.6 },
    { x: 0, y: 4.9, z: 36, r: 3.6 },
    { x: 0, y: 6.3, z: 41, r: 3.6 },
    { x: 0, y: 8.8, z: 65.5, r: 3.6 },
    { x: 0, y: 13.0, z: 79, r: 3.4 }
];
const TOTAL_STAGES = 6;
const FALL_Y = -4;

function layout() {
    const parts = [];
    const pillar = (x, top, z) => parts.push(P('box', [x, (top - 6) / 2, z],
        [0.5, top + 6, 0.5], '#7a7a6a', { texture: 'none' }));

    parts.push(P('box', [0, 0, 0], [20, 1, 20], '#5fbf4f', { texture: 'grass', name: 'ObbyLobby' }));
    parts.push(P('box', [0, 0.62, 6], [3, 0.25, 3], '#79c56a',
        { material: 'Neon', texture: 'none', spawn: true, name: 'ObbySpawn' }));

    parts.push(P('box', [-3.5, 2.2, 8], [0.4, 4.4, 0.4], '#e8e8e8'));
    parts.push(P('box', [3.5, 2.2, 8], [0.4, 4.4, 0.4], '#e8e8e8'));
    parts.push(P('box', [0, 4.6, 8], [7.4, 0.8, 0.5], '#d94444', { name: 'ObbyArch' }));

    const stones = [[0, 0.9, 14, '#55b06a'], [1.2, 1.6, 18.5, '#e0b040'], [-1.2, 2.2, 21, '#5577d9']];
    for (const s of stones) parts.push(P('box', [s[0], s[1], s[2]], [1.5, 0.7, 1.5], s[3]));

    const island = (x, y, z, name) => {
        parts.push(P('box', [x, y, z], [5, 0.9, 1.5], '#d94444', { name }));
        parts.push(P('box', [x + 2, y + 1.5, z], [0.18, 2.4, 0.18], '#f0f0e0'));
        parts.push(P('box', [x + 2.7, y + 2.4, z], [1.3, 0.8, 0.06], '#ffe14d',
            { name: name + 'Flag', collidable: false, texture: 'none' }));
        pillar(x - 1.6, y - 0.45, z);
    };
    island(0, 2.6, 23, 'ObbyCP1');
    island(0, 4.0, 36, 'ObbyCP2');
    island(0, 5.4, 41, 'ObbyCP3');
    island(0, 7.9, 65.5, 'ObbyCP4');

    parts.push(P('box', [0, 3.4, 29.5], [1.4, 0.7, 9], '#9a9a9a', { name: 'ObbyBeam' }));
    parts.push(P('box', [0, 4.6, 29.5], [1.7, 1.6, 0.7], '#ff3b3b',
        { material: 'Neon', texture: 'none', collidable: false, name: 'ObbyBar' }));
    pillar(0, 3.05, 29.5);

    const zig = [[1.6, 5.7, 45.5], [-1.6, 6.05, 49.5], [1.6, 6.4, 53.5], [-1.6, 6.75, 57.5], [0, 7.1, 61.5]];
    const zigc = ['#55b06a', '#e0b040', '#5577d9', '#b055c9', '#e86a5a'];
    for (let i = 0; i < zig.length; i++) {
        parts.push(P('box', [zig[i][0], zig[i][1], zig[i][2]], [1.5, 0.7, 1.5], zigc[i]));
    }

    const ladder = [[1.4, 9.1, 68.5], [-1.4, 10.0, 71], [1.4, 10.9, 73.5]];
    for (let i = 0; i < ladder.length; i++) {
        parts.push(P('box', [ladder[i][0], ladder[i][1], ladder[i][2]], [1.5, 0.7, 1.5], zigc[i]));
    }

    parts.push(P('box', [0, 11.9, 79], [6, 1, 6], '#e0b040', { name: 'ObbySummit' }));
    parts.push(P('box', [0, 12.7, 79], [2.2, 0.6, 2.2], '#ffe14d',
        { material: 'Neon', texture: 'none', name: 'ObbyGoal' }));
    parts.push(P('box', [2.4, 13.9, 79], [0.18, 2.6, 0.18], '#f0f0e0'));
    parts.push(P('box', [3.1, 14.8, 79], [1.3, 0.8, 0.06], '#79c56a',
        { name: 'ObbyGoalFlag', collidable: false, texture: 'none' }));
    pillar(0, 11.4, 79);

    pillar(-8, -0.5, -8);
    pillar(8, -0.5, -8);
    pillar(-8, -0.5, 8);
    pillar(8, -0.5, 8);

    const clouds = [[-11, 6, 16], [11, 9, 30], [-12, 12, 48], [12, 8, 60], [-10, 15, 74], [10, 17, 84]];
    for (const c of clouds) {
        parts.push(P('box', [c[0], c[1], c[2]], [5, 1, 3], '#f4f8ff',
            { collidable: false, texture: 'none' }));
    }

    parts.push(P('box', [0, -6.5, 35], [40, 1, 112], '#ff7b1f',
        { material: 'Neon', texture: 'none', collidable: false, name: 'ObbyLava' }));
    parts.push(P('box', [0, -7.8, 35], [40, 1.4, 112], '#8c3a12',
        { texture: 'none', collidable: false }));

    return parts;
}

function init(ctx, api) {
    api.setBaseHud({ health: false, backpack: false, hotbar: false });

    const player = ctx.player;
    const saved = api.load() || {};
    const state = {
        stage: Math.min(TOTAL_STAGES, Math.max(1, Number(saved.stage) || 1)),
        falls: 0,
        time: 0,
        won: false,
        best: saved.best || 0
    };

    const top = api.el('div', null);
    top.id = 'ob-top';
    const stageEl = document.createElement('div');
    stageEl.id = 'ob-stage';
    stageEl.textContent = 'STAGE ' + state.stage + '/' + TOTAL_STAGES;
    top.appendChild(stageEl);
    const row = document.createElement('div');
    row.id = 'ob-row';
    top.appendChild(row);
    const timeEl = document.createElement('span');
    timeEl.id = 'ob-time';
    timeEl.textContent = '0:00';
    row.appendChild(timeEl);
    const fallsEl = document.createElement('span');
    fallsEl.id = 'ob-falls';
    fallsEl.textContent = 'FALLS 0';
    row.appendChild(fallsEl);

    const over = api.el('div', null);
    over.id = 'ob-over';
    over.style.display = 'none';
    const title = document.createElement('div');
    title.className = 'ob-title';
    title.textContent = 'OBBY COMPLETE!';
    over.appendChild(title);
    const stats = document.createElement('div');
    stats.className = 'ob-stats';
    over.appendChild(stats);
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'ob-again';
    again.textContent = 'PLAY AGAIN';
    again.addEventListener('click', () => {
        api.save({ stage: 1, best: state.best });
        location.reload();
    });
    over.appendChild(again);

    api.style(`
#ob-top{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:43;text-align:center;
pointer-events:none}
#ob-stage{font:bold 34px Tahoma;letter-spacing:3px;color:#ffe14d;text-shadow:2px 2px 0 #000;
background:rgba(18,20,26,.85);border:3px solid #000;border-radius:8px;padding:4px 16px 5px}
#ob-row{display:flex;gap:6px;justify-content:center;margin-top:5px}
#ob-time,#ob-falls{font:bold 15px Tahoma;color:#e8f0d8;background:rgba(18,20,26,.85);
border:2px solid #000;border-radius:5px;padding:2px 10px;text-shadow:1px 1px 0 #000;letter-spacing:1px}
#ob-falls{color:#ff9b8a}
#ob-over{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:47;width:300px;
background:rgba(20,18,12,.96);border:3px solid #000;border-radius:10px;padding:18px 16px 16px;
text-align:center;font-family:Tahoma,sans-serif}
#ob-over .ob-title{font:bold 23px Tahoma;letter-spacing:1px;color:#79c56a;text-shadow:2px 2px 0 #000}
#ob-over .ob-stats{font:bold 13px Tahoma;color:#cfc8a8;margin:10px 0 2px;line-height:1.6}
#ob-over .ob-again{margin-top:12px;width:100%;font:bold 15px Tahoma;padding:9px;border:2px solid #000;
border-radius:6px;background:#79c56a;color:#0c2410;cursor:pointer;letter-spacing:1px}
`, 'main');

    let bar = null;
    try {
        const rt = ctx.placeRuntime ? ctx.placeRuntime() : null;
        if (rt && rt.parts) {
            for (const [, e] of rt.parts) {
                if (e.def.name === 'ObbyBar') { bar = e.mesh; break; }
            }
        }
    } catch (e) {}

    let prevDead = false;
    let loaded = false;
    let lastShownSec = -1;
    let t = 0;

    function pos() {
        return player && player.model ? player.model.position : null;
    }

    function respawnTo(stage) {
        const c = CHECKS[stage - 1] || CHECKS[0];
        ctx.respawn(c.x, c.y, c.z);
    }

    function fmt(sec) {
        const s = Math.max(0, Math.ceil(sec));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    function setStage(n) {
        if (n <= state.stage) return;
        state.stage = n;
        stageEl.textContent = 'STAGE ' + n + '/' + TOTAL_STAGES;
        api.save({ stage: state.stage, best: state.best });
        api.popup('STAGE ' + n + '!');
    }

    function win() {
        if (state.won) return;
        state.won = true;
        setStage(TOTAL_STAGES);
        state.stage = TOTAL_STAGES;
        if (!state.best || state.time < state.best) state.best = state.time;
        api.save({ stage: 1, best: state.best });
        over.style.display = 'block';
        stats.textContent = 'TIME ' + fmt(state.time) + '  •  FALLS ' + state.falls +
            '  •  BEST ' + fmt(state.best);
    }

    function update(dtMs) {
        const dt = Math.min(0.1, dtMs / 1000);
        const p = pos();
        if (!p) return;

        if (!loaded) {
            loaded = true;
            if (state.stage > 1) respawnTo(state.stage);
        }

        t += dt;
        if (bar && !state.won) bar.position.z = 29.5 + Math.sin(t * 1.6) * 4;

        const dead = ctx.isDead();
        if (dead && !prevDead && !state.won) state.falls++;
        if (!dead && prevDead && !state.won) respawnTo(state.stage);
        prevDead = dead;

        if (p.y < FALL_Y) {
            if (state.won) respawnTo(TOTAL_STAGES);
            else if (!dead) ctx.damage(100);
        } else if (!state.won && !dead && bar) {
            const dx = p.x - bar.position.x;
            const dz = p.z - bar.position.z;
            if (Math.abs(dx) < 1.5 && Math.abs(dz) < 1.0 && p.y > 3.2 && p.y < 6.4) {
                ctx.damage(100);
            }
        }

        if (!state.won) {
            state.time += dt;
            const sec = Math.ceil(state.time);
            if (sec !== lastShownSec) {
                lastShownSec = sec;
                timeEl.textContent = fmt(state.time);
                fallsEl.textContent = 'FALLS ' + state.falls;
            }
            for (let i = 1; i < CHECKS.length - 1; i++) {
                const c = CHECKS[i];
                const dx = p.x - c.x;
                const dz = p.z - c.z;
                if (dx * dx + dz * dz < c.r * c.r && Math.abs(p.y - c.y) < 3) {
                    setStage(i + 1);
                    break;
                }
            }
            const g = CHECKS[CHECKS.length - 1];
            const gx = p.x - g.x;
            const gz = p.z - g.z;
            if (gx * gx + gz * gz < g.r * g.r && Math.abs(p.y - g.y) < 3) win();
        } else {
            fallsEl.textContent = 'FALLS ' + state.falls;
        }
    }

    function dispose() {
        bar = null;
    }

    return { state, actions: { win }, update, dispose };
}

registerGenre({ id: 'obby', layout, init });
