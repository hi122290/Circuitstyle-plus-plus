import * as THREE from 'three';
import { playSound } from './audio.js';
import PlayerModule from './PlayerModule.js';

const POWER_USERS = {
    crab1001: {
        powers: [
            {
                id: 'pinch',
                name: 'Pinch',
                description: 'Grapple a player and pinch them for 25 damage.',
                damage: 25,
                range: 3.5,
                type: 'grapple',
                grappleTime: 1200,
                cooldown: 3000,
                icon: 'Fist'
            }
        ]
    },
    dubstep1001: {
        powers: [
            {
                id: 'soundwave',
                name: 'Sound Wave',
                description: 'Blast a powerful sound wave at a selected player for 30 damage.',
                damage: 30,
                range: 50,
                type: 'targeted',
                cooldown: 4000,
                icon: 'Revolution'
            }
        ]
    },
    luke81072: {
        powers: [
            {
                id: 'advanced_grapple',
                name: 'Ancient Grapple',
                description: 'Grapple a player for 1.5s — reduces them to 1 HP.',
                damage: 99,
                range: 4,
                type: 'grapple',
                grappleTime: 1500,
                cooldown: 8000,
                icon: 'Combat'
            },
            {
                id: 'barrage',
                name: 'Barrage',
                description: 'Unleash a barrage of punches — 8 hits, 8 damage each.',
                damage: 8,
                hitCount: 8,
                hitInterval: 150,
                range: 3,
                type: 'melee',
                cooldown: 5000,
                icon: 'Fist'
            },
            {
                id: 'side_kick',
                name: 'Side Kick',
                description: 'A powerful side kick — 35 damage.',
                damage: 35,
                range: 3.5,
                type: 'melee',
                cooldown: 2500,
                icon: 'Kick'
            },
            {
                id: 'shin_kick',
                name: 'Shin Kick',
                description: 'A brutal shin kick — 20 damage, slows target.',
                damage: 20,
                range: 3,
                type: 'melee',
                cooldown: 2000,
                icon: 'Kick'
            },
            {
                id: 'head_punch',
                name: 'Head Punch',
                description: 'Punch a player\'s head clean off — instant kill.',
                damage: 100,
                range: 3,
                type: 'melee',
                cooldown: 12000,
                icon: 'Fist'
            }
        ]
    },
    dddemonitized__: {
        powers: [
            {
                id: 'force_choke',
                name: 'Force Choke',
                description: 'Select a player — they collapse and suffocate for 4.2s, taking 20 damage.',
                damage: 20,
                range: 50,
                type: 'targeted',
                duration: 4200,
                cooldown: 10000,
                icon: 'Choke'
            }
        ]
    }
};

let _lastPowerUseTime = {};
let _activeGrapple = null;
let _chokeTargets = {};

function _canUse(username, powerId, now) {
    const key = `${username}_${powerId}`;
    const last = _lastPowerUseTime[key] || 0;
    const powers = POWER_USERS[username]?.powers || [];
    const power = powers.find(p => p.id === powerId);
    if (!power) return false;
    return (now - last) >= power.cooldown;
}

function _markUsed(username, powerId) {
    const key = `${username}_${powerId}`;
    _lastPowerUseTime[key] = performance.now();
}

function getCooldownRemaining(username, powerId) {
    const key = `${username}_${powerId}`;
    const last = _lastPowerUseTime[key] || 0;
    const powers = POWER_USERS[username]?.powers || [];
    const power = powers.find(p => p.id === powerId);
    if (!power) return 0;
    const remaining = power.cooldown - (performance.now() - last);
    return remaining > 0 ? remaining : 0;
}

function getPowersForUser(username) {
    return POWER_USERS[username]?.powers || [];
}

function hasPowers(username) {
    return !!POWER_USERS[username];
}

function findTargetPlayer(player, remotePlayers, camera, maxRange) {
    if (!player || !player.model || !remotePlayers || !camera) return null;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(mouse, camera);

    let closest = null;
    let closestDist = maxRange;

    for (const [id, remote] of remotePlayers) {
        if (!remote || !remote.model) continue;
        const remotePos = new THREE.Vector3();
        remote.model.getWorldPosition(remotePos);
        const dir = remotePos.clone().sub(player.model.position);
        const dist = dir.length();
        if (dist > maxRange) continue;

        const toTarget = remotePos.clone().sub(player.model.position).normalize();
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        const dot = camForward.dot(toTarget);
        if (dot < 0.85) continue;

        if (dist < closestDist) {
            closestDist = dist;
            closest = { id, remote, dist };
        }
    }

    return closest;
}

function activatePower(username, powerId, player, remotePlayers, camera, scene, pendingPresence) {
    const now = performance.now();
    if (!_canUse(username, powerId, now)) return false;

    const powers = POWER_USERS[username]?.powers || [];
    const power = powers.find(p => p.id === powerId);
    if (!power) return false;
    if (!player || !player.model) return false;

    const origin = player.model.position.clone();
    origin.y += 1.25;

    switch (power.id) {
        case 'pinch': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _startGrapple(power, target, origin, pendingPresence, 'pinch');
            playSound('click');
            return true;
        }

        case 'soundwave': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _fireSoundwave(power, target, origin, player, scene, pendingPresence);
            playSound('click');
            return true;
        }

        case 'advanced_grapple': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _startGrapple(power, target, origin, pendingPresence, 'advanced_grapple');
            playSound('click');
            return true;
        }

        case 'barrage': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _startBarrage(power, target, origin, player, scene, pendingPresence);
            playSound('click');
            return true;
        }

        case 'side_kick': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _meleeAttack(power, target, origin, player, scene, pendingPresence, 'side_kick');
            playSound('click');
            return true;
        }

        case 'shin_kick': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _meleeAttack(power, target, origin, player, scene, pendingPresence, 'shin_kick');
            playSound('click');
            return true;
        }

        case 'head_punch': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _headPunch(power, target, origin, player, scene, pendingPresence);
            playSound('click');
            return true;
        }

        case 'force_choke': {
            const target = findTargetPlayer(player, remotePlayers, camera, power.range);
            if (!target) return false;
            _markUsed(username, powerId);
            _startForceChoke(power, target, origin, player, scene, pendingPresence);
            playSound('click');
            return true;
        }
    }
    return false;
}

function _startGrapple(power, target, origin, pendingPresence, powerId) {
    if (!pendingPresence) return;

    const targetPos = new THREE.Vector3();
    target.remote.model.getWorldPosition(targetPos);

    pendingPresence.lastPowerEvent = {
        type: 'grapple_start',
        powerId: powerId,
        targetId: target.id,
        damage: power.damage,
        grappleTime: power.grappleTime,
        x: origin.x, y: origin.y, z: origin.z,
        tx: targetPos.x, ty: targetPos.y, tz: targetPos.z,
        t: Date.now()
    };

    const startTime = performance.now();
    _activeGrapple = {
        targetId: target.id,
        damage: power.damage,
        startTime,
        duration: power.grappleTime,
        powerId,
        origin: origin.clone(),
        targetPos: targetPos.clone()
    };
}

function _fireSoundwave(power, target, origin, player, scene, pendingPresence) {
    if (!pendingPresence) return;

    const targetPos = new THREE.Vector3();
    target.remote.model.getWorldPosition(targetPos);

    pendingPresence.lastPowerEvent = {
        type: 'soundwave',
        powerId: 'soundwave',
        targetId: target.id,
        damage: power.damage,
        x: origin.x, y: origin.y, z: origin.z,
        tx: targetPos.x, ty: targetPos.y, tz: targetPos.z,
        t: Date.now()
    };

    _spawnSoundwaveVFX(origin, targetPos, scene);
}

function _startBarrage(power, target, origin, player, scene, pendingPresence) {
    if (!pendingPresence) return;

    const targetPos = new THREE.Vector3();
    target.remote.model.getWorldPosition(targetPos);

    pendingPresence.lastPowerEvent = {
        type: 'barrage',
        powerId: 'barrage',
        targetId: target.id,
        damage: power.damage,
        hitCount: power.hitCount,
        x: origin.x, y: origin.y, z: origin.z,
        tx: targetPos.x, ty: targetPos.y, tz: targetPos.z,
        t: Date.now()
    };

    let hits = 0;
    const interval = setInterval(() => {
        hits++;
        if (hits >= power.hitCount || !target.remote.model) {
            clearInterval(interval);
            return;
        }
        _spawnPunchImpactVFX(targetPos, scene);
    }, power.hitInterval);

    _spawnPunchImpactVFX(targetPos, scene);
}

function _meleeAttack(power, target, origin, player, scene, pendingPresence, attackType) {
    if (!pendingPresence) return;

    const targetPos = new THREE.Vector3();
    target.remote.model.getWorldPosition(targetPos);

    pendingPresence.lastPowerEvent = {
        type: attackType,
        powerId: power.id,
        targetId: target.id,
        damage: power.damage,
        x: origin.x, y: origin.y, z: origin.z,
        tx: targetPos.x, ty: targetPos.y, tz: targetPos.z,
        t: Date.now()
    };

    _spawnKickImpactVFX(targetPos, scene);
}

function _headPunch(power, target, origin, player, scene, pendingPresence) {
    if (!pendingPresence) return;

    const targetPos = new THREE.Vector3();
    target.remote.model.getWorldPosition(targetPos);

    pendingPresence.lastPowerEvent = {
        type: 'head_punch',
        powerId: 'head_punch',
        targetId: target.id,
        damage: power.damage,
        x: origin.x, y: origin.y, z: origin.z,
        tx: targetPos.x, ty: targetPos.y, tz: targetPos.z,
        t: Date.now()
    };

    _spawnHeadFlingVFX(targetPos, scene);
}

function _startForceChoke(power, target, origin, player, scene, pendingPresence) {
    if (!pendingPresence) return;

    const targetPos = new THREE.Vector3();
    target.remote.model.getWorldPosition(targetPos);

    pendingPresence.lastPowerEvent = {
        type: 'force_choke',
        powerId: 'force_choke',
        targetId: target.id,
        damage: power.damage,
        duration: power.duration,
        x: origin.x, y: origin.y, z: origin.z,
        tx: targetPos.x, ty: targetPos.y, tz: targetPos.z,
        t: Date.now()
    };

    _spawnChokeAuraVFX(targetPos, scene);
}

function tickGrapple(myId, pendingPresence) {
    if (!_activeGrapple) return;
    const now = performance.now();
    const elapsed = now - _activeGrapple.startTime;
    if (elapsed >= _activeGrapple.duration) {
        if (pendingPresence) {
            pendingPresence.lastPowerEvent = {
                type: 'grapple_end',
                powerId: _activeGrapple.powerId,
                targetId: _activeGrapple.targetId,
                damage: _activeGrapple.damage,
                x: _activeGrapple.origin.x, y: _activeGrapple.origin.y, z: _activeGrapple.origin.z,
                tx: _activeGrapple.targetPos.x, ty: _activeGrapple.targetPos.y, tz: _activeGrapple.targetPos.z,
                t: Date.now()
            };
        }
        _activeGrapple = null;
    }
}

function isGrappling() {
    return !!_activeGrapple;
}

function handleRemotePowerEvent(event, remotePlayers, playerModel, myId, scene, onDamage) {
    if (!event || !event.type) return;

    switch (event.type) {
        case 'grapple_start': {
            if (scene) {
                const evPos = new THREE.Vector3(event.x, event.y, event.z);
                _spawnGrappleVFX(evPos, scene, event.t);
            }
            break;
        }

        case 'grapple_end': {
            if (event.targetId === myId && playerModel) {
                const dist = playerModel.position.distanceTo(new THREE.Vector3(event.x, event.y, event.z));
                if (dist <= 6) {
                    if (onDamage) onDamage(event.damage);
                }
            }
            if (scene) {
                const evPos = new THREE.Vector3(event.x, event.y, event.z);
                _spawnGrappleImpactVFX(evPos, scene);
            }
            break;
        }

        case 'soundwave': {
            if (event.targetId === myId && playerModel) {
                if (onDamage) onDamage(event.damage);
            }
            if (scene && event.tx !== undefined) {
                _spawnSoundwaveVFX(
                    new THREE.Vector3(event.x, event.y, event.z),
                    new THREE.Vector3(event.tx, event.ty, event.tz),
                    scene
                );
            }
            break;
        }

        case 'barrage': {
            if (event.targetId === myId && playerModel) {
                const totalDmg = (event.damage || 8) * (event.hitCount || 8);
                if (onDamage) onDamage(totalDmg);
            }
            if (scene && event.tx !== undefined) {
                const targetPos = new THREE.Vector3(event.tx, event.ty, event.tz);
                let hits = 0;
                const interval = setInterval(() => {
                    hits++;
                    if (hits >= (event.hitCount || 8)) { clearInterval(interval); return; }
                    _spawnPunchImpactVFX(targetPos, scene);
                }, 150);
                _spawnPunchImpactVFX(targetPos, scene);
            }
            break;
        }

        case 'side_kick':
        case 'shin_kick': {
            if (event.targetId === myId && playerModel) {
                if (onDamage) onDamage(event.damage);
            }
            if (scene && event.tx !== undefined) {
                _spawnKickImpactVFX(new THREE.Vector3(event.tx, event.ty, event.tz), scene);
            }
            break;
        }

        case 'head_punch': {
            if (event.targetId === myId && playerModel) {
                if (onDamage) onDamage(event.damage);
            }
            if (scene && event.tx !== undefined) {
                _spawnHeadFlingVFX(new THREE.Vector3(event.tx, event.ty, event.tz), scene);
            }
            break;
        }

        case 'force_choke': {
            if (event.targetId === myId && playerModel) {
                _chokeTargets[myId] = {
                    startTime: performance.now(),
                    duration: event.duration || 4200,
                    damage: event.damage || 20,
                    originX: event.x, originY: event.y, originZ: event.z,
                    damageApplied: false
                };
            }
            if (scene && event.tx !== undefined) {
                _spawnChokeAuraVFX(new THREE.Vector3(event.tx, event.ty, event.tz), scene);
            }
            break;
        }
    }
}

function tickChoke(myId, player, onDamage) {
    if (!_chokeTargets[myId]) return;
    const choke = _chokeTargets[myId];
    const elapsed = performance.now() - choke.startTime;
    if (elapsed >= choke.duration) {
        if (!choke.damageApplied && onDamage) {
            choke.damageApplied = true;
            onDamage(choke.damage);
        }
        delete _chokeTargets[myId];
    }
}

function isChoked() {
    return !!_chokeTargets[window.currentPlayerName];
}

function getChokeData() {
    return _chokeTargets[window.currentPlayerName] || null;
}

function _spawnGrappleVFX(pos, scene, time) {
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.04, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 })
    );
    ring.position.copy(pos);
    ring.position.y += 1.2;
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const startTime = performance.now();
    const tick = () => {
        const elapsed = performance.now() - startTime;
        const progress = elapsed / 600;
        if (progress >= 1) {
            if (ring.parent) ring.parent.remove(ring);
            return;
        }
        ring.scale.setScalar(1 + progress * 0.5);
        ring.material.opacity = 0.9 * (1 - progress);
        requestAnimationFrame(tick);
    };
    tick();
}

function _spawnGrappleImpactVFX(pos, scene) {
    const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 1 })
    );
    flash.position.copy(pos);
    flash.position.y += 1.2;
    scene.add(flash);

    for (let i = 0; i < 4; i++) {
        const spark = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 6, 4),
            new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 1 })
        );
        const angle = (i / 4) * Math.PI * 2;
        spark.position.set(
            pos.x + Math.cos(angle) * 0.4,
            pos.y + 1.2 + Math.sin(angle) * 0.4,
            pos.z + Math.sin(angle) * 0.4
        );
        scene.add(spark);
    }

    const startTime = performance.now();
    const tick = () => {
        const p = (performance.now() - startTime) / 400;
        if (p >= 1) {
            flash.parent && flash.parent.remove(flash);
            return;
        }
        flash.scale.setScalar(1 + p);
        flash.material.opacity = 1 - p;
        requestAnimationFrame(tick);
    };
    tick();
}

function _spawnSoundwaveVFX(from, to, scene) {
    const dir = to.clone().sub(from).normalize();
    const dist = from.distanceTo(to);

    for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.4 + i * 0.15, 0.03, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.8 })
        );
        ring.position.copy(from);
        ring.position.y += 1.2;
        ring.lookAt(to.x, to.y + 1.2, to.z);
        ring.rotation.z = Math.PI / 2;
        scene.add(ring);

        const startTime = performance.now();
        const delay = i * 80;
        const ringRef = ring;
        const tick = () => {
            const elapsed = performance.now() - startTime - delay;
            if (elapsed < 0) { requestAnimationFrame(tick); return; }
            const progress = elapsed / 500;
            if (progress >= 1) {
                if (ringRef.parent) ringRef.parent.remove(ringRef);
                return;
            }
            ringRef.position.lerpVectors(from, to, progress);
            ringRef.position.y += 1.2;
            ringRef.scale.setScalar(0.5 + progress);
            ringRef.material.opacity = 0.8 * (1 - progress);
            requestAnimationFrame(tick);
        };
        tick();
    }

    const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x00eeff, transparent: true, opacity: 0.6 })
    );
    flash.position.copy(from);
    flash.position.y += 1.2;
    scene.add(flash);
    const flashStart = performance.now();
    const flashTick = () => {
        const p = (performance.now() - flashStart) / 300;
        if (p >= 1) { if (flash.parent) flash.parent.remove(flash); return; }
        flash.scale.setScalar(1 + p * 2);
        flash.material.opacity = 0.6 * (1 - p);
        requestAnimationFrame(flashTick);
    };
    flashTick();
}

function _spawnPunchImpactVFX(pos, scene) {
    const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1 })
    );
    spark.position.set(
        pos.x + (Math.random() - 0.5) * 0.5,
        pos.y + 1.2 + (Math.random() - 0.5) * 0.5,
        pos.z + (Math.random() - 0.5) * 0.5
    );
    scene.add(spark);

    const startTime = performance.now();
    const tick = () => {
        const p = (performance.now() - startTime) / 200;
        if (p >= 1) { if (spark.parent) spark.parent.remove(spark); return; }
        spark.scale.setScalar(1 - p * 0.5);
        spark.material.opacity = 1 - p;
        requestAnimationFrame(tick);
    };
    tick();
}

function _spawnKickImpactVFX(pos, scene) {
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.6, 16),
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.position.set(pos.x, pos.y + 0.6, pos.z);
    ring.lookAt(pos.x, pos.y + 0.6, pos.z - 1);
    scene.add(ring);

    const startTime = performance.now();
    const tick = () => {
        const p = (performance.now() - startTime) / 350;
        if (p >= 1) { if (ring.parent) ring.parent.remove(ring); return; }
        ring.scale.setScalar(1 + p * 1.5);
        ring.material.opacity = 0.9 * (1 - p);
        requestAnimationFrame(tick);
    };
    tick();
}

function _spawnHeadFlingVFX(pos, scene) {
    const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 1 })
    );
    flash.position.set(pos.x, pos.y + 2, pos.z);
    scene.add(flash);

    const headPart = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 1 })
    );
    headPart.position.set(pos.x, pos.y + 2, pos.z);
    scene.add(headPart);

    const startTime = performance.now();
    const velY = 0.15;
    const velX = (Math.random() - 0.5) * 0.1;
    const velZ = (Math.random() - 0.5) * 0.1;
    const tick = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed > 1.5) {
            if (flash.parent) flash.parent.remove(flash);
            if (headPart.parent) headPart.parent.remove(headPart);
            return;
        }
        flash.material.opacity = Math.max(0, 1 - elapsed * 2);
        flash.scale.setScalar(1 + elapsed);
        headPart.position.y += velY * (1 - elapsed);
        headPart.position.x += velX;
        headPart.position.z += velZ;
        headPart.rotation.x += 0.2;
        headPart.rotation.z += 0.15;
        requestAnimationFrame(tick);
    };
    tick();
}

function _spawnChokeAuraVFX(pos, scene) {
    const aura = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.05, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x6600cc, transparent: true, opacity: 0.8 })
    );
    aura.position.set(pos.x, pos.y + 1.2, pos.z);
    scene.add(aura);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x8800ff, transparent: true, opacity: 0.25 })
    );
    glow.position.set(pos.x, pos.y + 1.2, pos.z);
    scene.add(glow);

    const startTime = performance.now();
    const tick = () => {
        const p = (performance.now() - startTime) / 2000;
        if (p >= 1) {
            if (aura.parent) aura.parent.remove(aura);
            if (glow.parent) glow.parent.remove(glow);
            return;
        }
        aura.rotation.z += 0.05;
        aura.rotation.x = Math.PI / 2 + Math.sin(p * Math.PI * 4) * 0.3;
        aura.material.opacity = 0.8 * (1 - p * 0.5);
        glow.scale.setScalar(1 + Math.sin(p * Math.PI * 6) * 0.15);
        glow.material.opacity = 0.25 * (1 - p * 0.5);
        requestAnimationFrame(tick);
    };
    tick();
}

export {
    POWER_USERS,
    hasPowers,
    getPowersForUser,
    getCooldownRemaining,
    activatePower,
    tickGrapple,
    isGrappling,
    handleRemotePowerEvent,
    tickChoke,
    isChoked,
    getChokeData
};
