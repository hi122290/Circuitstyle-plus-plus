// ─── NPCs: simulated players that populate each game ────────────────────────
// How many show up scales with how good the map looks (parts, scripts,
// tools, description) — with a random "overrated" roll so even weak games
// sometimes draw a crowd anyway. Every NPC rolls a disposition toward the
// local player when it spawns:
//     51% teams with you (friend) · 45% hostile · 4% neutral wanderer
// Hostiles gang up on you AND on your NPC friends; friends fight back.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ITEM_DATA } from './backpack.js';
import { ACCESSORIES } from './accessories.js?v=3';
import { getGenrePlay } from './game_catalog.js?v=6';

const WEAPONS = ['sword', 'sword', 'sword', 'missile', 'missile', 'slingshot', 'bomb'];

const HUMAN_NAMES = [
    'builderman42', 'xX_Sniper_Xx', 'DarkKnight99', 'coolguy123', 'SuperBuilder07',
    'ShadowNinja07', 'EpicFace420', 'SonicFan99', 'NoobSlayer64', 'PizzaDude11',
    'Sk8r_Tyler', 'GoldenArm07', 'TurboRacer', 'MagicSparkles', 'RadicalDave',
    'FuzzyMonkey88', 'CaptainZap', 'LittleTimmy2007', 'Ana_Blox1999', 'Sk8rGirl_Mia',
    'MLG_Pro360', 'RegularDude', 'Skybuilder', 'BrickMaster99', 'Zephyr_07',
    'maxpower2000', 'sadie_sadface', 'dude_with_hair', 'ColonelMustard', 'not_jake_the_bot',
    'ShadowGirl_X', 'HamsterBoy22', 'VHS_Vibes', 'ComfyClub', 'RetroRina',
    'blocky_ben', 'xX_DarkBlade_Xx', 'CheeseWizard', 'GamerGirl123', 'I_Love_Pizza99',
    'WaffleHouseHero', 'SilentBob42', 'PinkPrincess07', 'Sk8erDude101', 'mr_potato_head',
    'FloweryField', 'DiscoDan1985', 'N00b_Master', 'SunnyDay44', 'LavaLamp_Lou'
];

const FACTION_COLOR = { friend: '#66dd66', hostile: '#ff5555', neutral: '#dddddd' };
const NPC_SPEED = 4.4;          // studs/sec — a touch slower than the player
const ATTACK_RANGE = 2.1;
const ATTACK_DMG = 10;
const ATTACK_COOLDOWN = 950;
const SWORD_RANGE = 2.4;
const SWORD_DMG = 40;
const MAX_NPCS = 10;

let npcs = [];
let targetPop = 0;
let nameQueue = [];
let opts = null;
let inited = false;
let respawns = [];
let prevSwordSwing = false;
let play = null;

function playOf() {
    return play;
}

// ── NPC kinds: themed, colored NPCs UGC maps can spawn from marker parts ────
// colors override the player-config palette (head base follows limbs too)
export const NPC_KINDS = {
    villager: { label: 'Villager', hat: true, names: null },
    zombie: {
        label: 'Zombie', hat: false,
        colors: { torso: '#4c7a3f', limbs: '#6f9c5a', legs: '#3c5a33' },
        names: ['Rot', 'Gnaw', 'Moldy', 'Gore', 'Munch', 'Braineater']
    },
    ghost: {
        label: 'Ghost', hat: false, opacity: 0.55, float: true,
        colors: { torso: '#e8f4ff', limbs: '#dfeefc', legs: '#cfe4f7' },
        names: ['Wisp', 'Haunt', 'Banshee', 'Shade', 'Moan', 'Phantom']
    },
    skeleton: {
        label: 'Skeleton', hat: false,
        colors: { torso: '#dcd8cf', limbs: '#e8e4dc', legs: '#c9c5bd' },
        names: ['Bones', 'Rattle', 'Skully', 'Ribbs', 'Clatter', 'Marrow']
    },
    knight: {
        label: 'Knight', hat: false,
        colors: { torso: '#8b93a5', limbs: '#aab2c4', legs: '#5d6474' },
        names: ['Sir Aldric', 'Boldrin', 'Lance', 'Gallant', 'Rowan', 'Kael']
    },
    cowboy: {
        label: 'Cowboy', hat: false,
        colors: { torso: '#a5673f', limbs: '#c98d5f', legs: '#6f4a2f' },
        names: ['Dusty', 'Wyatt', 'Buck', 'Rustler', 'Clay', 'Ranger']
    },
    soldier: {
        label: 'Soldier', hat: false,
        colors: { torso: '#5f6f4f', limbs: '#7d8d6a', legs: '#4a5540' },
        names: ['Sgt Rourke', 'Pvt Weller', 'Cpl Diaz', 'Rook', 'Scout', 'Tango']
    },
    robot: {
        label: 'Robot', hat: false,
        colors: { torso: '#7d8794', limbs: '#9aa5b3', legs: '#5c6673' },
        names: ['R0-7', 'Unit 40', 'Bolt', 'Gearbox', 'Servo', 'Chip']
    }
};

function pickKindName(KIND) {
    if (!KIND.names) return pickName();
    for (let i = 0; i < 12; i++) {
        const base = KIND.names[Math.floor(Math.random() * KIND.names.length)];
        const name = base + (base.indexOf(' ') === -1 ? ' ' + (10 + Math.floor(Math.random() * 89)) : '');
        if (!npcs.some((n) => n.name === name)) return name;
    }
    return pickName();
}
const ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

// ── scoring: better-looking games get a bigger crowd ───────────────────────
function scoreGame(m) {
    if (!m) return 2.5;
    const parts = (m.parts || []).length;
    const scripts = (m.scripts || []).length;
    const tools = (m.tools || []).length;
    const nice = (m.description || '').trim().length > 4 ? 0.75 : 0;
    return 1 + parts / 10 + scripts * 0.7 + tools * 0.5 + nice;
}

function popFor(score) {
    // ~30% of games are "overrated" — they pull a crowd no matter what
    const overrate = Math.random() < 0.3 ? 1.6 + Math.random() * 0.9 : 0.7 + Math.random() * 0.7;
    return Math.max(1, Math.min(MAX_NPCS, Math.round(score * overrate)));
}

// ── names ───────────────────────────────────────────────────────────────────
function pickName() {
    for (let i = 0; i < 12; i++) {
        const name = Math.random() < 0.3
            ? 'Guest ' + (100 + Math.floor(Math.random() * 900))
            : (nameQueue.length
                ? nameQueue.shift()
                : HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)]);
        if (!npcs.some((n) => n.name === name)) return name;
    }
    return 'Guest ' + Math.floor(Math.random() * 9999);
}

function fillNameQueue() {
    nameQueue = HUMAN_NAMES.slice();
    for (let i = nameQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nameQueue[i], nameQueue[j]] = [nameQueue[j], nameQueue[i]];
    }
}

// ── name tag sprite ─────────────────────────────────────────────────────────
function makeTag(name, faction, color) {
    const c = document.createElement('canvas');
    const font = 'bold 34px Arial, sans-serif';
    let ctx = c.getContext('2d');
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(name).width) + 26;
    const h = 60;
    c.width = w;
    c.height = h;
    ctx = c.getContext('2d');
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(name, w / 2, h / 2);
    ctx.fillStyle = color || FACTION_COLOR[faction];
    ctx.fillText(name, w / 2, h / 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true,
        depthWrite: false
    }));
    sp.scale.set((w / h) * 0.62, 0.62, 1);
    sp.userData.isNpcTag = true;
    return sp;
}

// ── ground probing (keeps NPCs on floors, out of the void ───────────────────
function floorAt(x, z, fromY) {
    if (!opts.world || !opts.world.collidables) return 0;
    ray.set(_v.set(x, fromY + 0.7, z), new THREE.Vector3(0, -1, 0));
    ray.far = 8;
    const hits = ray.intersectObjects(opts.world.collidables, true);
    return hits.length ? hits[0].point.y : null;
}

function wallAhead(npc) {
    if (!opts.world || !opts.world.collidables) return false;
    const dir = _v.set(Math.sin(npc.group.rotation.y), 0, Math.cos(npc.group.rotation.y)).clone();
    ray.set(new THREE.Vector3(
        npc.group.position.x, npc.group.position.y + 1.0, npc.group.position.z
    ), dir);
    ray.far = 0.7;
    return ray.intersectObjects(opts.world.collidables, true).length > 0;
}

// ── spawn points ────────────────────────────────────────────────────────────
function spawnPoint() {
    const playerPos = opts.player && opts.player.model ? opts.player.model.position : null;
    const rt = window._placeRuntime;
    if (rt && rt.parts && rt.parts.size > 0) {
        const tops = [];
        for (const entry of rt.parts.values()) {
            if (!entry || !entry.mesh || !entry.mesh.visible) continue;
            if (entry.def && entry.def.collidable === false) continue;
            const box = new THREE.Box3().setFromObject(entry.mesh);
            const sx = box.max.x - box.min.x;
            const sz = box.max.z - box.min.z;
            if (sx < 1.6 || sz < 1.6) continue;
            tops.push({ box, sx, sz });
        }
        if (tops.length) {
            for (let tries = 0; tries < 8; tries++) {
                const t = tops[Math.floor(Math.random() * tops.length)];
                const x = t.box.min.x + 0.7 + Math.random() * Math.max(0.1, t.sx - 1.4);
                const z = t.box.min.z + 0.7 + Math.random() * Math.max(0.1, t.sz - 1.4);
                const y = t.box.max.y + 0.02;
                if (playerPos && Math.hypot(x - playerPos.x, z - playerPos.z) < 4) continue;
                if (npcs.some((n) => n.group.position.distanceTo(_v.set(x, y, z)) < 1.6)) continue;
                return new THREE.Vector3(x, y, z);
            }
            const t = tops[0];
            return new THREE.Vector3(
                (t.box.min.x + t.box.max.x) / 2, t.box.max.y + 0.02, (t.box.min.z + t.box.max.z) / 2
            );
        }
    }
    // default world / fallback: ring around the middle
    for (let tries = 0; tries < 10; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * 8;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = floorAt(x, z, 5);
        if (y === null) continue;
        if (playerPos && Math.hypot(x - playerPos.x, z - playerPos.z) < 4) continue;
        return new THREE.Vector3(x, y + 0.02, z);
    }
    return new THREE.Vector3(6, 0.05, 0);
}

// ── spawn one NPC ───────────────────────────────────────────────────────────
function spawnNpc(forcedFaction, forcedPos, forcedKind) {
    if (!inited || !opts.player) return null;
    const profile = playOf();
    const kindKey = forcedKind || (profile && profile.npcKind) || 'villager';
    const KIND = NPC_KINDS[kindKey] || NPC_KINDS.villager;
    const kind = NPC_KINDS[kindKey] ? kindKey : 'villager';
    const name = pickKindName(KIND);
    const mood = profile ? profile.npc : 'normal';
    let faction = forcedFaction;
    if (!faction) {
        const roll = Math.random() * 100;
        if (mood === 'calm') faction = roll < 75 ? 'friend' : 'neutral';
        else if (mood === 'attack') faction = roll < 30 ? 'friend' : roll < 90 ? 'hostile' : 'neutral';
        else faction = roll < 51 ? 'friend' : roll < 96 ? 'hostile' : 'neutral';
    }
    if (mood === 'calm' && faction === 'hostile') faction = 'friend';
    let team = null;
    if (profile && profile.teams) {
        const reds = npcs.filter((x) => x.team === 'red').length;
        team = reds * 2 <= npcs.length ? 'red' : 'blue';
    }
    const pool = profile && profile.items
        ? profile.items.filter((id) => ITEM_DATA[id] && ITEM_DATA[id].model)
        : WEAPONS;
    const heldItem = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    const group = new THREE.Group();
    group.name = 'npc_' + name;
    opts.scene.add(group);

    const hatId = KIND.hat !== false && Math.random() < 0.25 && ACCESSORIES.length
        ? ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)].id
        : null;
    const model = opts.player.createModel({
        accessoryId: hatId,
        colors: KIND.colors || undefined,
        opacity: KIND.opacity || undefined
    });
    opts.scene.remove(model);
    group.add(model);

    const tag = makeTag(name, faction, team === 'red' ? '#ff6666' : team === 'blue' ? '#6699ff' : null);
    group.add(tag);

    const pos = forcedPos ? forcedPos.clone() : spawnPoint();
    group.position.copy(pos);

    const npc = {
        group, model, tag, name, faction, team,
        kind,
        floats: !!KIND.float,
        lastFy: pos.y,
        respawnPos: forcedPos ? forcedPos.clone() : null,
        heldItem,
        heldItemModel: null,
        hp: 100, kills: 0, deaths: 0,
        target: null, targetIsPlayer: false, retargetAt: 0,
        wanderPoint: null, wanderAt: 0, blockUntil: 0,
        animTime: Math.random() * 10,
        atkCd: 0, swingUntil: 0,
        stuckSince: 0, lastPos: group.position.clone(),
        anchor: pos.clone(),
        noWander: !!forcedPos   // debug spawns hold their ground
    };
    npcs.push(npc);
    attachNpcHeldItem(npc);
    measureTag(npc);
    setTimeout(() => { if (npcs.includes(npc)) measureTag(npc); }, 900);
    if (opts.onChanged) opts.onChanged();
    return npc;
}

function measureTag(npc) {
    try {
        const bb = new THREE.Box3().setFromObject(npc.model);
        const h = Math.max(1.6, bb.max.y - npc.group.position.y);
        npc.tag.position.y = h + 0.45;
    } catch (e) {}
}

// load the item GLB and force it into the NPC's right arm (same attach
// logic the multiplayer remote-player tools use)
function attachNpcHeldItem(npc) {
    try {
        const itemId = npc.heldItem;
        if (!itemId || !ITEM_DATA[itemId] || !ITEM_DATA[itemId].model) return;
        new GLTFLoader().load(ITEM_DATA[itemId].model, (gltf) => {
            try {
                if (!npcs.includes(npc) || npc.hp <= 0) return;
                const itemMesh = gltf.scene;
                itemMesh.userData = itemMesh.userData || {};
                itemMesh.userData._npcTool = true;

                const parts = npc.model.userData && npc.model.userData.animationParts;
                const rightArmPivot = parts && parts.rightArmPivot;
                const rightArmMesh = rightArmPivot ? rightArmPivot.getObjectByName('RightArmMesh') : null;

                const pdims = opts.pcfg().visuals.dimensions;
                const bbox = new THREE.Box3().setFromObject(itemMesh);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
                itemMesh.scale.setScalar((pdims.armW * 0.85) / maxDim);

                if (rightArmMesh) {
                    itemMesh.position.set(0, -pdims.armH / 2, 0);
                    itemMesh.rotation.set(Math.PI / 2, 0, 0);
                    rightArmMesh.add(itemMesh);
                } else {
                    npc.group.add(itemMesh);
                }
                itemMesh.traverse((n) => {
                    if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
                });
                npc.heldItemModel = itemMesh;
            } catch (e) {}
        }, undefined, () => {});
    } catch (e) {}
}

function killNpc(npc, killer) {
    const i = npcs.indexOf(npc);
    if (i === -1) return;
    npcs.splice(i, 1);
    if (killer === opts.player) {
        if (opts.onPlayerKill) opts.onPlayerKill();
    } else if (killer && typeof killer.kills === 'number') {
        killer.kills += 1;
    }
    npc.deaths += 1;
    try {
        if (npc.tag.material.map) npc.tag.material.map.dispose();
        npc.tag.material.dispose();
        opts.scene.remove(npc.group);
    } catch (e) {}
    if (aliveCount() + respawns.length < targetPop) {
        respawns.push({
            t: Date.now() + 7000 + Math.random() * 6000,
            pos: npc.respawnPos || null,
            kind: npc.kind || null
        });
    }
    if (opts.onChanged) opts.onChanged();
}

function aliveCount() {
    return npcs.length;
}

function hurt(npc, dmg, killer) {
    if (!npc || npc.hp <= 0) return;
    npc.hp -= dmg;
    if (npc.hp <= 0) {
        if (killer === opts.player) { try { opts.playHit && opts.playHit(); } catch (e) {} }
        killNpc(npc, killer);
    }
}

// ── targeting: hostiles gang on you AND on your friends ─────────────────────
function retarget(npc, playerPos, now) {
    npc.target = null;
    npc.targetIsPlayer = false;
    if (playOf() && playOf().npc === 'calm') return;
    if (npc.faction === 'neutral') return;

    const enemies = [];
    if (npc.faction === 'hostile') {
        if (!opts.isPlayerDead()) {
            enemies.push({ kind: 'player', d: npc.group.position.distanceTo(playerPos) });
        }
        for (const o of npcs) {
            if (o !== npc && o.faction === 'friend' && o.hp > 0) {
                enemies.push({ kind: 'npc', ref: o, d: npc.group.position.distanceTo(o.group.position) });
            }
        }
    } else {
        for (const o of npcs) {
            if (o !== npc && o.faction === 'hostile' && o.hp > 0) {
                enemies.push({ kind: 'npc', ref: o, d: npc.group.position.distanceTo(o.group.position) });
            }
        }
    }
    if (!enemies.length) return;
    enemies.sort((a, b) => a.d - b.d);
    let pick = enemies[0];
    // gang up on the player whenever you're roughly as close as the nearest friend
    if (npc.faction === 'hostile') {
        const p = enemies.find((e) => e.kind === 'player');
        if (p && p.d <= enemies[0].d + 3.5) pick = p;
    }
    npc.targetIsPlayer = pick.kind === 'player';
    npc.target = pick.ref || null;
}

function goalOf(npc, playerPos, now) {
    if (npc.blockUntil > now) return null;
    if (window._sports && window._sports.ballPos) {
        const bp = window._sports.ballPos();
        if (bp) return bp;
    }
    if (npc.targetIsPlayer) return playerPos;
    if (npc.target && npcs.includes(npc.target) && npc.target.hp > 0) return npc.target.group.position;
    return null;
}

function newWanderPoint(npc, now) {
    for (let tries = 0; tries < 6; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 7;
        const x = npc.anchor.x + Math.cos(a) * r;
        const z = npc.anchor.z + Math.sin(a) * r;
        const y = floorAt(x, z, npc.anchor.y + 1.5);
        if (y === null) continue;
        npc.wanderPoint = new THREE.Vector3(x, y, z);
        npc.wanderAt = now + 4000 + Math.random() * 4000;
        return;
    }
    npc.wanderPoint = null;
    npc.wanderAt = now + 2000;
}

// ── player weapons vs NPCs ──────────────────────────────────────────────────
function playerWeaponHits() {
    const playerPos = opts.player.model ? opts.player.model.position : null;
    if (!playerPos) return;

    // sword: one AOE pulse per swing
    const swinging = !!opts.player.isSwordSwinging;
    if (swinging && !prevSwordSwing) {
        for (const n of npcs.slice()) {
            if (n.group.position.distanceTo(playerPos) <= SWORD_RANGE) hurt(n, SWORD_DMG, opts.player);
        }
    }
    prevSwordSwing = swinging;

    // projectiles: local shots + remote ghost shots
    const local = opts.player.getItemProjectiles ? opts.player.getItemProjectiles() : [];
    checkProjectileList(local);
    if (window._remoteProjectiles && window._remoteProjectiles.length) {
        checkProjectileList(window._remoteProjectiles);
    }
}

function checkProjectileList(list) {
    const SIZES = {
        bullet: { s: 0.3, dmg: 30 },
        marble: { s: 0.3, dmg: 15 },
        marbles: { s: 0.6, dmg: 25 },
        superball: { s: 0.7, dmg: 25 }
    };
    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        const info = SIZES[p.type];
        if (!info || !p.mesh || !p.mesh.parent) continue;
        const box = new THREE.Box3().setFromCenterAndSize(
            p.mesh.position, new THREE.Vector3(info.s, info.s, info.s)
        );
        for (const n of npcs.slice()) {
            // body-only hitbox: center of the character, not arms/weapons
            const body = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(n.group.position.x, n.group.position.y + 1.05, n.group.position.z),
                new THREE.Vector3(0.9, 2.1, 0.9)
            );
            if (body.intersectsBox(box)) {
                hurt(n, info.dmg, opts.player);
                try { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); } catch (e) {}
                list.splice(i, 1);
                break;
            }
        }
    }
}

// bomb blast (called from main via player hooks.onExplosion)
export function damageNpcsInBlast(pos, radius, maxDmg) {
    for (const n of npcs.slice()) {
        const d = n.group.position.distanceTo(pos);
        if (d > radius) continue;
        const dmg = d <= radius * 0.7 ? maxDmg : Math.round(maxDmg * (1 - d / radius));
        if (dmg > 0) hurt(n, dmg, opts.player);
    }
}

// ── per-frame ───────────────────────────────────────────────────────────────
export function updateNpcs(dtMs) {
    if (!inited || !opts.player || !opts.player.model) return;
    const dt = Math.min(0.1, dtMs / 1000);
    const now = Date.now();
    const pcfg = opts.pcfg();
    const anim = pcfg.animation || {};
    const playerPos = opts.player.model.position;

    // staggered respawns keep the crowd topped up (spawner NPCs come back on their marker)
    if (respawns.length) {
        for (let i = respawns.length - 1; i >= 0; i--) {
            if (respawns[i].t <= now) {
                const r = respawns.splice(i, 1)[0];
                const back = spawnNpc(null, r.pos || null, r.kind || null);
                if (back && r.pos) back.noWander = false;
            }
        }
    }

    for (const npc of npcs.slice()) {
        if (now >= npc.retargetAt) {
            retarget(npc, playerPos, now);
            npc.retargetAt = now + 700 + Math.random() * 500;
        }

        let goal = goalOf(npc, playerPos, now);
        if (!goal && !npc.noWander) {
            if (!npc.wanderPoint || now > npc.wanderAt ||
                npc.group.position.distanceTo(npc.wanderPoint) < 0.6) {
                newWanderPoint(npc, now);
            }
            goal = npc.wanderPoint;
        }

        let moving = false;
        if (goal) {
            const dx = goal.x - npc.group.position.x;
            const dz = goal.z - npc.group.position.z;
            const dist = Math.hypot(dx, dz);
            const isCombatGoal = goal === playerPos || goal === (npc.target && npc.target.group.position);
            const inRange = isCombatGoal && dist <= ATTACK_RANGE;

            // model's visual front is -Z (matches the local player's lookAt movement convention)
            const desiredAngle = Math.atan2(-dx, -dz);
            let da = desiredAngle - npc.group.rotation.y;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            npc.group.rotation.y += da * Math.min(1, dt * 8);

            if (!inRange && dist > 0.4) {
                if (!wallAhead(npc)) {
                    const step = Math.min(dist, NPC_SPEED * dt);
                    const nx = npc.group.position.x + (dx / dist) * step;
                    const nz = npc.group.position.z + (dz / dist) * step;
                    const fy = floorAt(nx, nz, npc.group.position.y);
                    if (fy !== null) {
                        npc.group.position.x = nx;
                        npc.group.position.z = nz;
                        npc.lastFy = fy;
                        npc.group.position.y += (fy - npc.group.position.y) * Math.min(1, dt * 10);
                        moving = true;
                    } else {
                        npc.blockUntil = now + 900;
                        npc.wanderPoint = null;
                    }
                } else {
                    npc.blockUntil = now + 900;
                    npc.wanderPoint = null;
                }
            }

            // attack
            npc.atkCd -= dtMs;
            if (inRange && npc.atkCd <= 0 && (npc.targetIsPlayer || npc.target)) {
                npc.atkCd = ATTACK_COOLDOWN + Math.random() * 350;
                npc.swingUntil = now + 460;
                if (npc.targetIsPlayer) {
                    if (!opts.isPlayerDead() && !opts.player.isForcefieldActive) {
                        opts.damagePlayer(ATTACK_DMG);
                    }
                } else if (npc.target && npcs.includes(npc.target)) {
                    hurt(npc.target, ATTACK_DMG, npc);
                }
            }
        }

        // stuck detection — bump into a wall forever? pick a new plan
        if (moving) {
            if (npc.stuckSince && now - npc.stuckSince > 1400) {
                if (npc.group.position.distanceTo(npc.lastPos) < 0.35) {
                    npc.blockUntil = now + 1200;
                    npc.wanderPoint = null;
                }
                npc.stuckSince = 0;
            }
            if (!npc.stuckSince) {
                npc.stuckSince = now;
                npc.lastPos.copy(npc.group.position);
            }
        } else {
            npc.stuckSince = 0;
        }

        // anim (phase advances per fixed step, matching presence-driven remotes)
        npc.animTime += moving ? (anim.walkSpeed || 0.18) : (anim.idleSpeed || 0.015);
        // ghosts hover above the floor instead of walking on it
        if (npc.floats) {
            npc.group.position.y = npc.lastFy + 0.55 + Math.sin(npc.animTime * 2.2) * 0.16;
        }
        try {
            opts.player.updateModelAnimations(npc.model, {
                isWalking: moving,
                animationTime: npc.animTime,
                onGround: true,
                heldItem: npc.heldItem || null,
                swordSwing: now < npc.swingUntil
            }, pcfg);
        } catch (e) {}
    }

    try { playerWeaponHits(); } catch (e) {}
}

// ── public helpers ──────────────────────────────────────────────────────────
export function getNpcRows() {
    return npcs.map((n) => ({
        name: n.name,
        color: FACTION_COLOR[n.faction],
        kills: n.kills,
        wipeouts: n.deaths
    }));
}

export function initNpcs(o) {
    if (inited) return;
    opts = o;
    inited = true;
    play = o.getManifest ? getGenrePlay((o.getManifest() || {}).genre) : null;
    fillNameQueue();
    targetPop = popFor(scoreGame(opts.getManifest ? opts.getManifest() : null));
    for (let i = 0; i < targetPop; i++) spawnNpc();
    // UGC marker parts (`special:'npc'`) fill their map with themed NPCs
    try {
        const man = opts.getManifest ? opts.getManifest() : null;
        const spawners = ((man && man.parts) || []).filter((p) => p.special === 'npc');
        for (const s of spawners) {
            if (!s.position || !s.position.length) continue;
            const n = Math.max(1, Math.min(8, Number(s.npcCount) || 2));
            const at = new THREE.Vector3(s.position[0], s.position[1], s.position[2]);
            for (let i = 0; i < n; i++) {
                const off = new THREE.Vector3((Math.random() - 0.5) * 2.6, 0, (Math.random() - 0.5) * 2.6);
                const spawned = spawnNpc(null, at.clone().add(off), s.npcKind || null);
                if (spawned) spawned.noWander = false;
            }
        }
    } catch (e) {}
    // debug/test hook (harmless; used by npc_test.js)
    window._npcs = {
        rows: getNpcRows,
        list: () => npcs.map((n) => {
            let opacity = 1;
            try {
                n.model.traverse((m) => {
                    // skip the forcefield cage — it is not part of the body palette
                    if (m.isMesh && m.visible !== false && !(m.userData && m.userData.isForcefieldPart) &&
                        m.material && typeof m.material.opacity === 'number' && m.material.opacity < opacity) {
                        opacity = m.material.opacity;
                    }
                });
            } catch (e) {}
            return {
                name: n.name, faction: n.faction, hp: n.hp,
                kills: n.kills, deaths: n.deaths, pos: n.group.position.toArray(),
                heldItem: n.heldItem || null,
                hasTool: !!n.heldItemModel,
                team: n.team || null,
                kind: n.kind || 'villager',
                opacity: Math.round(opacity * 100) / 100,
                rotY: n.group.rotation.y
            };
        }),
        spawnNear: (faction, kind) => {
            const p = opts.player.model.position;
            const n = spawnNpc(faction || 'hostile', new THREE.Vector3(p.x + 1.9, p.y, p.z), kind || null);
            return n ? n.name : null;
        },
        spawnAt: (x, y, z, faction, kind) => {
            const n = spawnNpc(faction || 'hostile', new THREE.Vector3(x, y, z), kind || null);
            if (n) n.noWander = false;
            return n ? n.name : null;
        },
        send: (name, dx, dz) => {
            const n = npcs.find((x) => x.name === name);
            if (!n) return false;
            n.noWander = false;
            n.target = null;
            n.targetIsPlayer = false;
            n.retargetAt = Date.now() + 10000;
            n.blockUntil = 0;
            n.wanderPoint = n.group.position.clone().add(new THREE.Vector3(dx, 0, dz));
            n.wanderAt = Date.now() + 10000;
            return true;
        },
        blast: (pos, r, d) => damageNpcsInBlast(pos, r, d)
    };
    if (opts.onChanged) opts.onChanged();
}
