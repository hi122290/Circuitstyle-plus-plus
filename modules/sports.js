import * as THREE from 'three';
import { getGenrePlay } from './game_catalog.js?v=7';

let opts = null;
let profile = null;
let resolved = false;
let ball = null;
let goals = [];
let cashPads = [];
let scoreLabel = null;
let state = { red: 0, blue: 0, goals: 0 };
let lastGoalAt = -99999;
let lastKickAt = 0;
let padReadyAt = new Map();

const BALL_R = 0.75;
const BOUND_X = 15;
const BOUND_Z = 16.5;

function tick() {
    return performance.now();
}

function safeText(str, o) {
    if (!opts || !opts.text) return null;
    try { return opts.text(str, o); } catch (e) { return null; }
}

function removeLater(h, ms) {
    if (h) setTimeout(() => { try { h.remove(); } catch (e) {} }, ms);
}

function installHook() {
    window._sports = {
        ballPos: () => (ball ? ball.mesh.position : null),
        kick: (x, z) => {
            if (ball) {
                ball.vel.x = x || 0;
                ball.vel.z = z || 0;
            }
        },
        state: () => ({
            red: state.red,
            blue: state.blue,
            goals: state.goals,
            pads: cashPads.length,
            ball: ball
                ? [ball.mesh.position.x, ball.mesh.position.y, ball.mesh.position.z]
                : null
        })
    };
}

function resolveParts() {
    const rt = window._placeRuntime;
    if (!rt || !rt.parts || !rt.parts.size) return;
    for (const [, entry] of rt.parts) {
        const def = entry.def || {};
        const special = def.special;
        if (special === 'ball') {
            ball = { mesh: entry.mesh, vel: new THREE.Vector3(), r: BALL_R };
        } else if (typeof special === 'string' && special.indexOf('goal-') === 0) {
            goals.push({ def, team: special.slice(5) });
        } else if (special === 'cash') {
            cashPads.push({ def, mesh: entry.mesh });
        }
    }
    resolved = true;
    if (profile && profile.ball && ball) {
        scoreLabel = safeText('0 - 0  GOALS', {
            y: 46, size: 20, bold: true,
            color: '#ffffff', bg: 'rgba(0,0,0,0.55)', padding: '3px 12px'
        });
    }
}

function ensureResolved() {
    if (!resolved) resolveParts();
}

export function initSports(o) {
    opts = o || null;
    profile = (o && o.manifest) ? getGenrePlay(o.manifest.genre) : null;
    resolved = false;
    ball = null;
    goals = [];
    cashPads = [];
    if (scoreLabel) { try { scoreLabel.remove(); } catch (e) {} scoreLabel = null; }
    state = { red: 0, blue: 0, goals: 0 };
    lastGoalAt = -99999;
    lastKickAt = 0;
    padReadyAt = new Map();
    delete window._sports;
    if (!profile) return;
    installHook();
    ensureResolved();
}

function updateCashPads(t, playerPos) {
    if (!profile.money || !cashPads.length || !playerPos) return;
    for (const pad of cashPads) {
        if ((padReadyAt.get(pad) || 0) > t) continue;
        const p = pad.mesh.position;
        if (Math.abs(playerPos.x - p.x) < 2.3 &&
            Math.abs(playerPos.z - p.z) < 2.3 &&
            playerPos.y < p.y + 3) {
            padReadyAt.set(pad, t + 4000);
            if (opts.addCurrency) {
                try { opts.addCurrency(5); } catch (e) {}
            }
            removeLater(safeText('+5 Circuitbuckz', {
                y: 132, size: 18, bold: true, color: '#ffe14d'
            }), 1300);
        }
    }
}

function tryKick(t, px, pz, reach, speed) {
    const m = ball.mesh.position;
    const dx = m.x - px;
    const dz = m.z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= reach || d < 0.001 || t - lastKickAt < 120) return;
    lastKickAt = t;
    ball.vel.x = (dx / d) * speed;
    ball.vel.z = (dz / d) * speed;
}

function checkGoals(t) {
    if (t - lastGoalAt < 2500) return;
    const m = ball.mesh.position;
    for (const g of goals) {
        const def = g.def;
        const scale = def.scale || [1, 1, 1];
        const pos = def.position || [0, 0, 0];
        const halfX = scale[0] * 2;
        const halfZ = scale[2] * 2;
        if (Math.abs(m.x - pos[0]) < halfX &&
            Math.abs(m.z - pos[2]) < halfZ &&
            m.y < pos[1] + scale[1] + 1) {
            lastGoalAt = t;
            state.goals++;
            if (g.team === 'red') state.blue++;
            else state.red++;
            if (scoreLabel) {
                try { scoreLabel.setText(state.red + ' - ' + state.blue + '  GOALS'); } catch (e) {}
            }
            removeLater(safeText('GOAL!!!', {
                y: 92, size: 34, bold: true,
                color: '#ffe14d', bg: 'rgba(0,0,0,0.6)', padding: '6px 18px'
            }), 1800);
            m.set(0, ball.r, 0);
            ball.vel.set(0, 0, 0);
            return;
        }
    }
}

export function updateSports(dt) {
    if (!opts || !profile) return;
    ensureResolved();
    const t = tick();
    const playerPos = opts.getPlayerPos ? opts.getPlayerPos() : null;

    updateCashPads(t, playerPos);
    if (!ball) return;

    if (playerPos) tryKick(t, playerPos.x, playerPos.z, 1.15, 8);

    if (opts.getNpcPositions) {
        let nps = [];
        try { nps = opts.getNpcPositions() || []; } catch (e) { nps = []; }
        for (const n of nps) {
            tryKick(t, n.x, n.z, 1.0, 7);
        }
    }

    const s = Math.min(dt, 50) / 1000;
    const m = ball.mesh.position;
    m.x += ball.vel.x * s;
    m.z += ball.vel.z * s;
    const drag = Math.pow(0.6, s);
    ball.vel.x *= drag;
    ball.vel.z *= drag;
    if (Math.abs(ball.vel.x) < 0.05) ball.vel.x = 0;
    if (Math.abs(ball.vel.z) < 0.05) ball.vel.z = 0;
    m.y = ball.r;

    if (m.x < -BOUND_X) { m.x = -BOUND_X; ball.vel.x = Math.abs(ball.vel.x) * 0.6; }
    if (m.x > BOUND_X) { m.x = BOUND_X; ball.vel.x = -Math.abs(ball.vel.x) * 0.6; }
    if (m.z < -BOUND_Z) { m.z = -BOUND_Z; ball.vel.z = Math.abs(ball.vel.z) * 0.6; }
    if (m.z > BOUND_Z) { m.z = BOUND_Z; ball.vel.z = -Math.abs(ball.vel.z) * 0.6; }

    checkGoals(t);
}
