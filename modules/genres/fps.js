import { registerGenre, makeParts } from './core.js?v=1';

const P = makeParts('f');

const ROUND_TIME = 90;
const TARGET = 1200;
const KILL_PTS = 100;
const COMBO_MS = 4000;
const MIN_HOSTILES = 6;
const SPAWNS = [
    [-16, 1.4, -14], [16, 1.4, -14], [-16, 1.4, 6],
    [16, 1.4, 6], [0, 1.4, -6], [0, 1.4, -18]
];

function layout() {
    const parts = [];
    parts.push(P('ground', [0, -0.5, 0], [1, 1, 1], '#77804f', { texture: 'grass' }));
    parts.push(P('box', [0, 0.3, 0], [48, 0.6, 48], '#c8b183', { texture: 'none', name: 'FpsGround' }));

    parts.push(P('box', [0, 2.3, -24], [48, 3.4, 0.5], '#555c42', { name: 'FpsWallN' }));
    parts.push(P('box', [0, 2.3, 24], [48, 3.4, 0.5], '#555c42', { name: 'FpsWallS' }));
    parts.push(P('box', [24, 2.3, 0], [0.5, 3.4, 48], '#555c42', { name: 'FpsWallE' }));
    parts.push(P('box', [-24, 2.3, 0], [0.5, 3.4, 48], '#555c42', { name: 'FpsWallW' }));

    const stripes = [[-12, -23.6, 11.5, 0.5], [12, -23.6, 11.5, 0.5], [-12, 23.6, 11.5, 0.5], [12, 23.6, 11.5, 0.5]];
    for (const s of stripes) parts.push(P('box', [s[0], 0.7, s[1]], [s[2], 0.4, s[3]], '#e8c520', { texture: 'none', collidable: false }));

    parts.push(P('box', [-18, 4.15, -18], [4.5, 0.3, 4.5], '#6b7355', { name: 'FpsTower' }));
    for (const dx of [-1.8, 1.8]) for (const dz of [-1.8, 1.8]) {
        parts.push(P('box', [-18 + dx, 2.1, -18 + dz], [0.35, 4, 0.35], '#4a5140'));
    }
    parts.push(P('box', [-18, 4.95, -20.1], [4.5, 1.1, 0.15], '#4a5140'));
    parts.push(P('box', [-20.1, 4.95, -18], [0.15, 1.1, 4.5], '#4a5140'));
    parts.push(P('box', [-18, 5.4, -18], [0.3, 2.4, 0.3], '#4a5140'));
    parts.push(P('box', [-18, 6.7, -18], [5.2, 0.3, 5.2], '#3c4234'));

    const bags = [
        [0, -10, 10, 0], [-9, 2, 6, 1], [9, 2, 6, 1], [0, 12, 10, 0], [-14, -4, 6, 1]
    ];
    for (const b of bags) {
        const vert = b[3] === 1;
        const sc = vert ? [1.6, 0.55, b[2]] : [b[2], 0.55, 1.6];
        parts.push(P('box', [b[0], 0.9, b[1]], sc, '#b09a6a'));
        const sc2 = vert ? [1.4, 0.5, b[2] - 1] : [b[2] - 1, 0.5, 1.4];
        const off = vert ? [0.3, 0, 0.5] : [0.5, 0, 0.3];
        parts.push(P('box', [b[0] + off[0], 1.42, b[1] + off[1] + off[2]], sc2, '#9c875c'));
        const sc3 = vert ? [1.2, 0.5, b[2] - 2] : [b[2] - 2, 0.5, 1.2];
        parts.push(P('box', [b[0] - off[0], 1.94, b[1] - off[1] + off[2]], sc3, '#b09a6a'));
    }

    parts.push(P('box', [-18, 1.5, 8], [3.4, 3, 9], '#9c4a3a', { name: 'FpsCan1' }));
    parts.push(P('box', [18, 1.5, 8], [3.4, 3, 9], '#3a5f8c', { name: 'FpsCan2' }));
    parts.push(P('box', [14, 1.5, -16], [9, 3, 3.4], '#6d7a4a', { name: 'FpsCan3' }));

    for (const x of [-6, 0, 6]) parts.push(P('box', [x, 1.05, 17.5], [5, 0.9, 2.2], '#6b7355'));

    for (const t of [[-11, -4], [11, 14], [-6, -17]]) {
        parts.push(P('cylinder', [t[0], 1.1, t[1]], [1.7, 2.2, 1.7], '#2a2a2a', { texture: 'none' }));
    }

    parts.push(P('box', [0, 4.6, -23.5], [10, 3.6, 0.4], '#23271e', { name: 'FpsBoard' }));
    parts.push(P('box', [0, 4.6, -23.2], [9.4, 3, 0.15], '#0f2a17', { material: 'Neon', texture: 'none', collidable: false }));
    parts.push(P('box', [4.5, 2.3, -23.5], [0.3, 4.6, 0.3], '#4a5140'));
    parts.push(P('box', [-4.5, 2.3, -23.5], [0.3, 4.6, 0.3], '#4a5140'));

    parts.push(P('box', [-8, 2, 21], [0.2, 4, 0.2], '#8a8f78'));
    parts.push(P('box', [-7.3, 3.6, 21], [1.4, 0.9, 0.06], '#d9534f', { name: 'FpsFlag1', collidable: false, texture: 'none' }));
    parts.push(P('box', [8, 2, 21], [0.2, 4, 0.2], '#8a8f78'));
    parts.push(P('box', [7.3, 3.6, 21], [1.4, 0.9, 0.06], '#3a6fbf', { name: 'FpsFlag2', collidable: false, texture: 'none' }));

    parts.push(P('cylinder', [20, 3, -6], [0.3, 6, 0.3], '#6d7360', { texture: 'none' }));
    parts.push(P('box', [19.4, 6, -6], [1.4, 0.6, 0.9], '#e8e8c0', { material: 'Neon', texture: 'none' }));
    parts.push(P('cylinder', [-20, 3, -6], [0.3, 6, 0.3], '#6d7360', { texture: 'none' }));
    parts.push(P('box', [-19.4, 6, -6], [1.4, 0.6, 0.9], '#e8e8c0', { material: 'Neon', texture: 'none' }));

    const crates = [[-4, -2], [6, 13], [-14, 16], [12, 16]];
    for (const c of crates) parts.push(P('box', [c[0], 1.1, c[1]], [2, 2, 2], '#8a6a3f'));
    parts.push(P('box', [-4, 2.7, -2], [1.4, 1.2, 1.4], '#97744a'));
    parts.push(P('box', [6, 2.7, 13], [1.4, 1.2, 1.4], '#97744a'));

    parts.push(P('box', [0, 0.62, 20.5], [3, 0.25, 3], '#79c56a', { name: 'FpsSpawn', spawn: true, material: 'Neon', texture: 'none' }));

    for (const z of [16, 6, -4, -14]) {
        parts.push(P('box', [0, 0.62, z], [46, 0.05, 0.35], '#e8c520',
            { material: 'Neon', texture: 'none', collidable: false }));
    }

    parts.push(P('cylinder', [-14, 1.0, -8], [5, 1.4, 5], '#c8b183', { texture: 'none' }));
    parts.push(P('cylinder', [14, 1.0, -8], [5, 1.4, 5], '#c8b183', { texture: 'none' }));

    return parts;
}

function init(ctx, api) {
    api.setBaseHud({ backpack: false });

    const state = {
        phase: 'count',
        score: 0,
        time: ROUND_TIME,
        target: TARGET,
        combo: 0,
        kills: 0,
        hostiles: 0,
        best: 0,
        wins: 0
    };
    const rec = api.load() || {};
    state.best = rec.best || 0;
    state.wins = rec.wins || 0;

    const cross = api.el('div', null);
    cross.id = 'fx-cross';

    const top = api.el('div', null);
    top.id = 'fx-top';
    const scoreEl = document.createElement('div');
    scoreEl.id = 'fx-score';
    scoreEl.textContent = '0';
    top.appendChild(scoreEl);
    const goalEl = document.createElement('div');
    goalEl.id = 'fx-goal';
    goalEl.textContent = '/ ' + TARGET;
    top.appendChild(goalEl);
    const chips = document.createElement('div');
    chips.id = 'fx-chips';
    top.appendChild(chips);
    const timeEl = document.createElement('span');
    timeEl.id = 'fx-time';
    timeEl.textContent = '1:30';
    chips.appendChild(timeEl);
    const comboEl = document.createElement('span');
    comboEl.id = 'fx-combo';
    comboEl.textContent = 'STREAK x2';
    chips.appendChild(comboEl);

    const feed = api.el('div', null);
    feed.id = 'fx-feed';
    const host = api.el('div', null);
    host.id = 'fx-host';
    host.textContent = 'HOSTILES 0';
    const cd = api.el('div', null);
    cd.id = 'fx-cd';
    cd.textContent = '3';
    cd.style.display = 'block';

    const over = api.el('div', null);
    over.id = 'fx-over';
    over.style.display = 'none';
    const title = document.createElement('div');
    title.className = 'fx-title';
    over.appendChild(title);
    const stats = document.createElement('div');
    stats.className = 'fx-stats';
    over.appendChild(stats);
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'fx-again';
    again.textContent = 'PLAY AGAIN';
    again.addEventListener('click', () => location.reload());
    over.appendChild(again);

    api.style(`
#fx-cross{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;z-index:43;pointer-events:none}
#fx-cross::before{content:'';position:absolute;left:50%;top:0;width:2px;height:100%;background:#eaffd8;
transform:translateX(-50%);box-shadow:0 0 2px #000}
#fx-cross::after{content:'';position:absolute;top:50%;left:0;height:2px;width:100%;background:#eaffd8;
transform:translateY(-50%);box-shadow:0 0 2px #000}
#fx-top{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:43;text-align:center;pointer-events:none}
#fx-score{font:bold 40px Tahoma;letter-spacing:3px;color:#d9ff5a;text-shadow:2px 2px 0 #000;line-height:1}
#fx-goal{font:bold 14px Tahoma;color:#aebf96;text-shadow:1px 1px 0 #000;letter-spacing:2px}
#fx-chips{display:flex;gap:6px;justify-content:center;align-items:center;margin-top:5px}
#fx-time{font:bold 16px Tahoma;color:#ffe9a8;background:rgba(20,24,16,.88);border:2px solid #000;
border-radius:5px;padding:2px 11px;letter-spacing:2px}
#fx-time.fx-low{color:#ff6a5a}
#fx-combo{font:bold 14px Tahoma;color:#241605;background:#ff9b3d;border:2px solid #000;
border-radius:5px;padding:2px 9px;letter-spacing:1px;display:none}
#fx-combo.fx-on{display:block}
#fx-feed{position:fixed;right:16px;top:54%;z-index:43;display:flex;flex-direction:column;gap:4px;
align-items:flex-end;pointer-events:none}
.fx-kill{font:bold 13px Tahoma;color:#eaffd8;background:rgba(18,22,14,.85);border:1px solid #3c4430;
border-radius:4px;padding:3px 9px;text-shadow:1px 1px 0 #000;animation:fx-kill 3.4s ease forwards}
.fx-kill b{color:#d9ff5a;margin-left:8px}
@keyframes fx-kill{0%{opacity:0;transform:translateX(16px)}8%{opacity:1;transform:none}
80%{opacity:1}100%{opacity:0}}
#fx-host{position:fixed;right:16px;bottom:16px;z-index:43;font:bold 14px Tahoma;color:#cfe0b8;
background:rgba(20,24,16,.88);border:2px solid #000;border-radius:5px;padding:4px 11px;
text-shadow:1px 1px 0 #000;letter-spacing:1px}
#fx-cd{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:44;font:bold 88px Tahoma;
color:#eaffd8;text-shadow:3px 3px 0 #000;pointer-events:none;display:none}
#fx-over{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:47;width:300px;
background:rgba(16,20,12,.96);border:3px solid #000;border-radius:10px;padding:18px 16px 16px;
text-align:center;font-family:Tahoma,sans-serif}
#fx-over .fx-title{font:bold 24px Tahoma;letter-spacing:2px;color:#d9ff5a;text-shadow:2px 2px 0 #000}
#fx-over.fx-lose .fx-title{color:#ff7a5a}
#fx-over .fx-stats{font:bold 13px Tahoma;color:#aebf96;margin:10px 0 2px;line-height:1.6}
#fx-over .fx-again{margin-top:12px;width:100%;font:bold 15px Tahoma;padding:9px;border:2px solid #000;
border-radius:6px;background:#79c56a;color:#0c2410;cursor:pointer;letter-spacing:1px}
`, 'main');

    let countT = 3;
    let lastKillAt = 0;
    let pollAcc = 0;
    let fillAcc = 0;
    let spawnIdx = 0;
    let seen = new Map();
    let lastShownSec = -1;

    function fmtTime(t) {
        const total = Math.max(0, Math.ceil(t));
        return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
    }

    function feedAdd(name, pts) {
        const row = document.createElement('div');
        row.className = 'fx-kill';
        const who = document.createElement('span');
        who.textContent = name;
        const val = document.createElement('b');
        val.textContent = '+' + pts;
        row.appendChild(who);
        row.appendChild(val);
        feed.appendChild(row);
        while (feed.children.length > 4) feed.firstChild.remove();
        setTimeout(() => row.remove(), 3500);
    }

    function showOverlay(won) {
        cross.style.display = 'none';
        over.style.display = 'block';
        if (won) {
            over.classList.remove('fx-lose');
            title.textContent = 'RANGE CLEARED';
            stats.textContent = 'KILLS ' + state.kills + '  •  ' + Math.ceil(state.time) +
                's LEFT  •  BEST ' + state.best;
        } else {
            over.classList.add('fx-lose');
            title.textContent = "TIME'S UP";
            stats.textContent = 'SCORE ' + state.score + '/' + state.target +
                '  •  KILLS ' + state.kills + '  •  BEST ' + state.best;
        }
    }

    function endRound(won) {
        if (state.phase === 'won' || state.phase === 'lost') return;
        state.phase = won ? 'won' : 'lost';
        if (state.score > state.best) state.best = state.score;
        if (won) state.wins += 1;
        api.save({ best: state.best, wins: state.wins });
        showOverlay(won);
    }

    function onKill(name) {
        if (state.phase !== 'run') return;
        const now = performance.now();
        state.combo = (lastKillAt && now - lastKillAt < COMBO_MS) ? state.combo + 1 : 1;
        lastKillAt = now;
        state.kills += 1;
        state.score += KILL_PTS;
        scoreEl.textContent = String(state.score);
        feedAdd(name, KILL_PTS);
        if (state.combo >= 2) {
            comboEl.textContent = 'STREAK x' + state.combo;
            comboEl.classList.add('fx-on');
        }
        if (state.score >= state.target) endRound(true);
    }

    function poll() {
        if (!window._npcs || typeof window._npcs.list !== 'function') return;
        const rows = window._npcs.list();
        const now = new Map();
        let alive = 0;
        for (const r of rows) {
            now.set(r.name, r.faction);
            if (r.faction === 'hostile') alive++;
        }
        if (seen.size) {
            for (const [name, fac] of seen) {
                if (!now.has(name) && fac === 'hostile') onKill(name);
            }
        }
        seen = now;
        state.hostiles = alive;
        host.textContent = 'HOSTILES ' + alive;
    }

    function fill() {
        if (state.phase === 'won' || state.phase === 'lost') return;
        if (state.hostiles >= MIN_HOSTILES) return;
        if (!window._npcs || typeof window._npcs.spawnAt !== 'function') return;
        let n = 0;
        while (state.hostiles < MIN_HOSTILES && n < 3) {
            const s = SPAWNS[spawnIdx % SPAWNS.length];
            spawnIdx++;
            const name = window._npcs.spawnAt(
                s[0] + (Math.random() - 0.5) * 3, s[1], s[2] + (Math.random() - 0.5) * 3,
                'hostile', 'soldier');
            if (name) {
                state.hostiles++;
                n++;
            } else break;
        }
    }

    function update(dtMs) {
        const dt = Math.min(0.1, dtMs / 1000);

        if (state.phase === 'count') {
            countT -= dt;
            cd.textContent = String(Math.max(1, Math.ceil(countT)));
            if (countT <= 0) {
                state.phase = 'run';
                cd.style.display = 'none';
                api.popup('GO!');
            }
        } else if (state.phase === 'run') {
            state.time -= dt;
            const sec = Math.ceil(state.time);
            if (sec !== lastShownSec) {
                lastShownSec = sec;
                timeEl.textContent = fmtTime(state.time);
                timeEl.classList.toggle('fx-low', state.time < 15);
            }
            if (state.time <= 0) {
                state.time = 0;
                endRound(state.score >= state.target);
            }
        }

        if (lastKillAt && performance.now() - lastKillAt >= COMBO_MS) {
            state.combo = 0;
            lastKillAt = 0;
            comboEl.classList.remove('fx-on');
        }

        pollAcc += dtMs;
        if (pollAcc >= 150) {
            pollAcc = 0;
            poll();
        }
        fillAcc += dtMs;
        if (fillAcc >= 1000) {
            fillAcc = 0;
            fill();
        }
    }

    function dispose() {
        seen = new Map();
    }

    return { state, actions: { restart: () => location.reload() }, update, dispose };
}

registerGenre({ id: 'fps', layout, init });
