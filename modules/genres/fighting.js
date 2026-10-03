import { registerGenre, makeParts } from './core.js?v=1';

const P = makeParts('g');

const ROUND_TIME = 120;
const TARGET_KOS = 8;
const START_LIVES = 3;
const COMBO_MS = 8000;
const MIN_HOSTILES = 3;
const RING_SPAWNS = [
    [0, 1.4, 8], [8, 1.4, 0], [0, 1.4, -8], [-8, 1.4, 0]
];

function layout() {
    const parts = [];
    parts.push(P('ground', [0, -0.5, 0], [1, 1, 1], '#6faf57', { texture: 'grass' }));
    parts.push(P('cylinder', [0, 0.4, 0], [24, 0.8, 24], '#c9b078', { texture: 'none', name: 'FgtFloor' }));
    parts.push(P('cylinder', [0, 0.83, 0], [10, 0.06, 10], '#ff4a3a',
        { material: 'Neon', texture: 'none', collidable: false, name: 'FgtRing' }));

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        parts.push(P('box',
            [Math.sin(a) * 11.6, 1.1, Math.cos(a) * 11.6],
            [3.6, 0.6, 0.6],
            i % 2 ? '#3a6fbf' : '#d94444',
            { rotation: [0, a + Math.PI / 2, 0], name: 'FgtRim' + (i + 1), texture: 'none' }));
    }

    const stands = [
        [0, 0.6, -14.5, 14, 1.2, 3, 'FgtStandN'],
        [0, 1.6, -16.5, 14, 1.2, 2, null],
        [0, 3.4, -18, 14, 3.6, 0.5, null],
        [0, 1.25, -14.5, 13.6, 0.15, 2.6, null],
        [0, 0.6, 14.5, 14, 1.2, 3, 'FgtStandS'],
        [0, 1.6, 16.5, 14, 1.2, 2, null],
        [0, 3.4, 18, 14, 3.6, 0.5, null],
        [0, 1.25, 14.5, 13.6, 0.15, 2.6, null],
        [14.5, 0.6, 0, 3, 1.2, 14, 'FgtStandE'],
        [16.5, 1.6, 0, 2, 1.2, 14, null],
        [18, 3.4, 0, 0.5, 3.6, 14, null],
        [14.5, 1.25, 0, 2.6, 0.15, 13.6, null],
        [-14.5, 0.6, 0, 3, 1.2, 14, 'FgtStandW'],
        [-16.5, 1.6, 0, 2, 1.2, 14, null],
        [-18, 3.4, 0, 0.5, 3.6, 14, null],
        [-14.5, 1.25, 0, 2.6, 0.15, 13.6, null]
    ];
    for (const s of stands) {
        const seat = s[4] < 0.5;
        parts.push(P('box', [s[0], s[1], s[2]], [s[3], s[4], s[5]],
            seat ? '#d94444' : (s[4] > 3 ? '#6f6f68' : '#9a9a92'),
            seat ? { collidable: false, texture: 'none' }
                : (s[6] ? { name: s[6] } : {})));
    }

    const torches = [[7, 7], [-7, 7], [7, -7], [-7, -7]];
    for (let i = 0; i < torches.length; i++) {
        parts.push(P('cylinder', [torches[i][0], 2.1, torches[i][1]], [0.5, 2.6, 0.5], '#5a4a3a', { texture: 'none' }));
        parts.push(P('cylinder', [torches[i][0], 3.7, torches[i][1]], [1, 1.2, 1], '#ff9b3d',
            { material: 'Neon', texture: 'none', collidable: false, name: 'FgtTorch' + (i + 1) }));
    }

    parts.push(P('box', [-3, 2, 12.5], [0.5, 4, 0.5], '#e8e8e8'));
    parts.push(P('box', [3, 2, 12.5], [0.5, 4, 0.5], '#e8e8e8'));
    parts.push(P('box', [0, 4.3, 12.5], [6.5, 0.7, 0.6], '#d94444', { name: 'FgtGate' }));

    parts.push(P('box', [0, 7, -18.4], [8, 3, 0.4], '#23271e', { name: 'FgtBoard' }));
    parts.push(P('box', [0, 7, -18.15], [7.4, 2.4, 0.12], '#2a0f14',
        { material: 'Neon', texture: 'none', collidable: false }));
    parts.push(P('box', [3.5, 3, -18.4], [0.3, 6, 0.3], '#4a4a44'));
    parts.push(P('box', [-3.5, 3, -18.4], [0.3, 6, 0.3], '#4a4a44'));

    parts.push(P('box', [0, 0.92, 8], [3, 0.25, 3], '#79c56a',
        { material: 'Neon', texture: 'none', spawn: true, name: 'FgtSpawn' }));

    const pillars = [[10.5, 10.5], [-10.5, 10.5], [10.5, -10.5], [-10.5, -10.5]];
    for (const p of pillars) {
        parts.push(P('cylinder', [p[0], 1.8, p[1]], [0.9, 3.6, 0.9], '#e8e4d8', { texture: 'none' }));
        parts.push(P('box', [p[0], 3.9, p[1]], [1.3, 0.6, 1.3], '#d94444', { name: 'FgtCap' + (pillars.indexOf(p) + 1) }));
    }

    const banners = [[0, 3.8, -17.65, 10, 1.8, 0.12], [0, 3.8, 17.65, 10, 1.8, 0.12],
        [17.65, 3.8, 0, 0.12, 1.8, 10], [-17.65, 3.8, 0, 0.12, 1.8, 10]];
    for (const b of banners) {
        parts.push(P('box', [b[0], b[1], b[2]], [b[3], b[4], b[5]],
            '#d94444', { collidable: false, texture: 'none', name: 'FgtBanner' }));
    }

    return parts;
}

function init(ctx, api) {
    api.setBaseHud({ backpack: false });

    const saved = api.load() || {};
    const state = {
        kos: 0,
        target: TARGET_KOS,
        lives: START_LIVES,
        time: ROUND_TIME,
        combo: 0,
        maxCombo: 0,
        hostiles: 0,
        won: false,
        lost: '',
        wins: saved.wins || 0,
        best: saved.best || 0
    };

    const top = api.el('div', null);
    top.id = 'fg-top';
    const koEl = document.createElement('div');
    koEl.id = 'fg-ko';
    koEl.textContent = 'KOs 0/' + TARGET_KOS;
    top.appendChild(koEl);
    const row = document.createElement('div');
    row.id = 'fg-row';
    top.appendChild(row);
    const livesEl = document.createElement('span');
    livesEl.id = 'fg-lives';
    livesEl.textContent = 'LIVES ' + START_LIVES;
    row.appendChild(livesEl);
    const timeEl = document.createElement('span');
    timeEl.id = 'fg-time';
    timeEl.textContent = '2:00';
    row.appendChild(timeEl);
    const comboEl = document.createElement('span');
    comboEl.id = 'fg-combo';
    comboEl.textContent = 'COMBO x2';
    row.appendChild(comboEl);

    const over = api.el('div', null);
    over.id = 'fg-over';
    over.style.display = 'none';
    const title = document.createElement('div');
    title.className = 'fg-title';
    over.appendChild(title);
    const stats = document.createElement('div');
    stats.className = 'fg-stats';
    over.appendChild(stats);
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'fg-again';
    again.textContent = 'PLAY AGAIN';
    again.addEventListener('click', () => location.reload());
    over.appendChild(again);

    api.style(`
#fg-top{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:43;text-align:center;
pointer-events:none}
#fg-ko{font:bold 36px Tahoma;letter-spacing:3px;color:#ff9b3d;text-shadow:2px 2px 0 #000;
background:rgba(24,16,10,.88);border:3px solid #000;border-radius:8px;padding:4px 16px 5px}
#fg-row{display:flex;gap:6px;justify-content:center;margin-top:5px}
#fg-lives,#fg-time,#fg-combo{font:bold 15px Tahoma;background:rgba(24,16,10,.88);border:2px solid #000;
border-radius:5px;padding:2px 10px;text-shadow:1px 1px 0 #000;letter-spacing:1px}
#fg-lives{color:#ff6a5a}
#fg-time{color:#ffe9a8}
#fg-time.fx-low{color:#ff6a5a}
#fg-combo{color:#241605;background:#ff9b3d;display:none}
#fg-combo.fx-on{display:block}
#fg-over{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:47;width:300px;
background:rgba(22,14,10,.96);border:3px solid #000;border-radius:10px;padding:18px 16px 16px;
text-align:center;font-family:Tahoma,sans-serif}
#fg-over .fg-title{font:bold 26px Tahoma;letter-spacing:2px;color:#ff9b3d;text-shadow:2px 2px 0 #000}
#fg-over.fx-won .fg-title{color:#ffe14d}
#fg-over .fg-stats{font:bold 13px Tahoma;color:#d8c4b0;margin:10px 0 2px;line-height:1.6}
#fg-over .fg-again{margin-top:12px;width:100%;font:bold 15px Tahoma;padding:9px;border:2px solid #000;
border-radius:6px;background:#e08a2c;color:#241000;cursor:pointer;letter-spacing:1px}
`, 'main');

    let seen = new Map();
    let pollAcc = 0;
    let fillAcc = 0;
    let spawnIdx = 0;
    let prevDead = false;
    let lastKillAt = 0;
    let lastShownSec = -1;

    function fmt(sec) {
        const s = Math.max(0, Math.ceil(sec));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    function refreshHud() {
        koEl.textContent = 'KOs ' + state.kos + '/' + state.target;
        livesEl.textContent = 'LIVES ' + Math.max(0, state.lives);
    }

    function endRound(kind) {
        if (state.won || state.lost) return;
        state.lost = kind;
        if (state.maxCombo > state.best) state.best = state.maxCombo;
        api.save({ wins: state.wins, best: state.best });
        over.style.display = 'block';
        over.classList.remove('fx-won');
        title.textContent = kind === 'time' ? 'TIME UP' : 'KNOCKED OUT';
        stats.textContent = 'KOs ' + state.kos + '/' + state.target +
            '  •  BEST COMBO x' + state.best;
    }

    function win() {
        if (state.won || state.lost) return;
        state.won = true;
        state.wins += 1;
        if (state.maxCombo > state.best) state.best = state.maxCombo;
        api.save({ wins: state.wins, best: state.best });
        over.style.display = 'block';
        over.classList.add('fx-won');
        title.textContent = 'CHAMPION!';
        stats.textContent = 'KOs ' + state.kos + '/' + state.target + '  •  ' +
            Math.ceil(state.time) + 's LEFT  •  BEST COMBO x' + state.best;
    }

    function onKo() {
        if (state.won || state.lost) return;
        const now = performance.now();
        state.combo = (lastKillAt && now - lastKillAt < COMBO_MS) ? state.combo + 1 : 1;
        lastKillAt = now;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        state.kos += 1;
        refreshHud();
        if (state.combo >= 2) {
            comboEl.textContent = 'COMBO x' + state.combo;
            comboEl.classList.add('fx-on');
        }
        if (state.kos >= state.target) win();
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
                if (!now.has(name) && fac === 'hostile') onKo();
            }
        }
        seen = now;
        state.hostiles = alive;
    }

    function fill() {
        if (state.won || state.lost) return;
        if (state.hostiles >= MIN_HOSTILES) return;
        if (!window._npcs || typeof window._npcs.spawnAt !== 'function') return;
        let n = 0;
        while (state.hostiles < MIN_HOSTILES && n < 2) {
            const s = RING_SPAWNS[spawnIdx % RING_SPAWNS.length];
            spawnIdx++;
            const name = window._npcs.spawnAt(
                s[0] + (Math.random() - 0.5) * 2, s[1], s[2] + (Math.random() - 0.5) * 2,
                'hostile', 'villager');
            if (name) {
                state.hostiles++;
                n++;
            } else break;
        }
    }

    function update(dtMs) {
        const dt = Math.min(0.1, dtMs / 1000);

        if (!state.won && !state.lost) {
            state.time -= dt;
            const sec = Math.ceil(state.time);
            if (sec !== lastShownSec) {
                lastShownSec = sec;
                timeEl.textContent = fmt(state.time);
                timeEl.classList.toggle('fx-low', state.time < 15);
            }
            if (state.time <= 0) {
                state.time = 0;
                endRound('time');
            }
        }

        if (lastKillAt && performance.now() - lastKillAt >= COMBO_MS) {
            state.combo = 0;
            lastKillAt = 0;
            comboEl.classList.remove('fx-on');
        }

        const dead = ctx.isDead();
        if (dead && !prevDead && !state.won && !state.lost) {
            state.lives -= 1;
            state.combo = 0;
            comboEl.classList.remove('fx-on');
            refreshHud();
            if (state.lives <= 0) endRound('ko');
        }
        prevDead = dead;

        pollAcc += dtMs;
        if (pollAcc >= 200) {
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

    return { state, actions: {}, update, dispose };
}

registerGenre({ id: 'fighting', layout, init });
