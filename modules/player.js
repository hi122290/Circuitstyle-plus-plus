import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clientToNDC } from './utils.js';
import { playSound, sounds } from './audio.js';
import PlayerModule from './PlayerModule.js';
import Global from './Global.js';
import { ITEM_DATA } from './backpack.js';
import { getBuildSettings, placeBuild } from './build.js';


export function setupPlayer(scene, camera, renderer, world, hooks = {}) {
    const keyboard = {};
    let model = null;
    let velocityY = 0;
    // gravity will be sourced from PlayerModule configuration (allows live tuning)
    // Use PlayerModule.getConfig().gravity where needed so changes propagate
    let onGround = true;

    const player = {
        // dynamic getters so config changes take effect without reloading the module
        get speed() { return PlayerModule.getConfig().walkSpeed; },
        get rotationSpeed() { return PlayerModule.getConfig().rotationSpeed; }
    };



    const cameraState = {
        angle: 0,
        radius: 7,
        heightBase: 4,
        heightOffset: 0,
        MIN_RADIUS: 3,
        MAX_RADIUS: 12,
        MIN_HEIGHT: 1,
        MAX_HEIGHT: 10,
        HEIGHT_RATIO: 0.55,
        // new pitch state for vertical camera rotation (radians)
        pitch: 0,
        MIN_PITCH: -Math.PI / 6, // look slightly down limit (~-30deg)
        MAX_PITCH: Math.PI / 3,  // look up limit (~60deg)
        // When true the next camera update will snap to the target (used by on-screen controls)
        skipLerp: false
    };

    let isWalking = false;
    let walkingNode = null;

    let animationTime = 0; // Animation accumulator
    const ANIMATION_SPEED = 0.165; // Speed multiplier for swing animation (adjusted to match speed 0.11)
    const SWING_MAX = Math.PI * 0.22; // Maximum swing angle (approx 40 degrees)

    // Constants for continuous slow idle animation
    const IDLE_ANIMATION_SPEED = 0.015; // Very slow speed for idle sway
    const IDLE_SWING_MAX = Math.PI * 0.025; // Short swing (~4.5 degrees)
    
    // Constant for animation smoothing (0.0 to 1.0, higher is faster transition)
    const ANIMATION_SMOOTHING = 0.3;
    // Independent smoothing for arm rotations so each arm transitions separately
    const ANIMATION_SMOOTHING_ARM = 0.42;

    let targetIndicator = null;
    let playerTarget = null;
    // store original arm pivot Y and Z so hold pivot can be cleared during jump and restored after landing
    let originalRightArmPivotY = null;
    let originalRightArmPivotZ = null;
    let originalLeftArmPivotY = null;
    let originalLeftArmPivotZ = null;

    let spawnPoints = [];
    let activeSpawnIndex = 0;

    let voidMode = false;
    let voidIntensified = false;

    // First-person mode state
    let firstPersonActive = false;
    let fpYaw = 0;   // horizontal look angle (radians)
    let fpPitch = 0; // vertical look angle (radians)
    const FP_PITCH_MIN = -Math.PI / 2.2;
    const FP_PITCH_MAX = Math.PI / 2.2;
    
    

    // State for scripted movement/input locking
    let inputLocked = false;
    let forcefieldGroup = null;
    const RESPAWN_AURA_DURATION = 5000;
    let forcefieldStartTime = 0;
    let forcefieldEndTime = 0;
    let heldItemModel = null;
    let currentHeldItemId = null;
    const deathFlingVelocity = new THREE.Vector3();
    const deathFlingSpin = new THREE.Vector3();
    let deathFlingActive = false;
    // token to guard against out-of-order async loads for held items
    let heldItemLoadToken = 0;
    const activeItemProjectiles = [];
    let lastItemUseTime = 0;
    const SWORD_SWING_DURATION = 460;
    let swordSwingStartTime = 0;
    let externalMovement = new THREE.Vector3(0, 0, 0);
    let externalRotation = 0;

    // New: landing/ jump timing state to prevent animation flicker when holding jump
    let previousOnGround = true;
    let landedHoldUntil = 0; // timestamp (ms) (no landing hold delay)

    // Landing-slow: when true for a short window after touching ground, animations lerp more slowly
    let landingSlowUntil = 0; // timestamp (ms) when the "slow landing" period ends

    // Customization
    let playerMaterials = [];
    let hatMesh; // Not used in this module, but kept for context if needed later.

    // Store texture/material reference for parts
    let studTexture;
    // Bottom-face stud texture (different image) to apply to the arm bottom face
    let studBottomTexture;

    // Local refs to config for easier access
    const getPConfig = () => PlayerModule.getConfig();
    
    /**
     * Helper to update forcefield visuals on any player model (local or remote)
     */
    const _ffColor = new THREE.Color();
    function updateModelForcefield(modelNode, isActive, nowMs) {
        if (!modelNode) return;

        // The old body-hugging rainbow cage is no longer used for respawns.
        // Keep it hidden so older models/remotes cannot show the outdated effect.
        modelNode.traverse(n => {
            if (n.userData && n.userData.isForcefieldPart) {
                n.visible = false;
            }
        });

        const aura = modelNode.getObjectByName('RespawnAura');
        if (!aura) return;

        if (!isActive) {
            aura.visible = false;
            delete modelNode.userData.respawnAuraStartTime;
            return;
        }

        if (!modelNode.userData.respawnAuraStartTime) {
            modelNode.userData.respawnAuraStartTime = nowMs;
        }
        const elapsed = nowMs - modelNode.userData.respawnAuraStartTime;
        const remaining = Math.max(0, RESPAWN_AURA_DURATION - elapsed);
        const inFlickerWindow = remaining <= 2000;
        const fade = inFlickerWindow ? Math.max(0, remaining / 2000) : 1;
        // Layer two waves so the final two seconds flicker irregularly.
        const flickerOn = !inFlickerWindow || (Math.sin(nowMs * 0.045) + Math.sin(nowMs * 0.097) * 0.45 > 0);

        aura.visible = remaining > 0 && flickerOn && fade > 0.01;
        aura.rotation.y += 0.012;
        if (aura.material) {
            aura.material.opacity = 0.24 * fade;
        }
    }

    /**
     * Helper to update animations on any player model (local or remote)
     */
    function updateModelAnimations(modelNode, animState, pcfg) {
        if (!modelNode) return;
        const parts = modelNode.userData.animationParts;
        if (!parts) return;
        const panim = pcfg.animation || {};

        let targetLA = 0, targetRA = 0, targetLL = 0, targetRL = 0;

        // Allow callers to signal a held item so remote models can show the hold pose
        const holdingItem = !!(animState && animState.heldItem);

        if (!animState || !animState.onGround) {
            const jumpRotation = panim.jumpRotation || Math.PI;
            // Jump pose: both arms raised/rotated to jumpRotation
            targetLA = jumpRotation;
            targetRA = jumpRotation;
            targetLL = 0;
            targetRL = 0;
        } else {
            let currentSpeed = panim.walkSpeed || 0.165;
            let amplitude = panim.walkSwingMax || (Math.PI * 0.22);

            if (!animState.isWalking) {
                currentSpeed = panim.idleSpeed || 0.015;
                amplitude = panim.idleSwingMax || (Math.PI * 0.025);
            }
            
            // Use the animationTime supplied by presence; fall back to 0 if missing
            const animTime = (animState && typeof animState.animationTime === 'number') ? animState.animationTime : 0;
            const swing = Math.sin(animTime) * amplitude;
            
            targetLL = swing;
            targetRL = -swing;
            targetLA = -swing;
            // If the remote player is holding an item, hold the right arm in a pointing/hold pose
            targetRA = holdingItem ? (Math.PI / 2) : swing;
        }

        // Remote sword swings are timestamped locally when the presence flag
        // changes, keeping the slash readable without sending per-frame angles.
        if (animState && animState.swordSwing) {
            if (!modelNode.userData.swordSwingStartTime) modelNode.userData.swordSwingStartTime = performance.now();
            const swordProgress = Math.min(1, (performance.now() - modelNode.userData.swordSwingStartTime) / SWORD_SWING_DURATION);
            const swordArc = Math.sin(swordProgress * Math.PI);
            targetRA = Math.PI / 2 - swordArc * 2.35;
            targetLA = swordArc * 0.55;
        } else {
            delete modelNode.userData.swordSwingStartTime;
        }
        
        // Smoothly lerp toward targets using provided smoothing values (fallbacks applied)
        const armSmooth = panim.armSmoothing || 0.42;
        const bodySmooth = panim.smoothing || 0.3;

        // Adjust arm pivot positions for remote models to match hold/jump/idle poses
        try {
            const pdims = pcfg && pcfg.visuals && pcfg.visuals.dimensions;
            const torsoH = (pdims && pdims.torsoH) ? pdims.torsoH : 0;
            const origRY = (modelNode.userData.originalRightArmPivotY != null) ? modelNode.userData.originalRightArmPivotY : parts.rightArmPivot.position.y;
            const origRZ = (modelNode.userData.originalRightArmPivotZ != null) ? modelNode.userData.originalRightArmPivotZ : parts.rightArmPivot.position.z;
            const origLY = (modelNode.userData.originalLeftArmPivotY != null) ? modelNode.userData.originalLeftArmPivotY : parts.leftArmPivot.position.y;
            const origLZ = (modelNode.userData.originalLeftArmPivotZ != null) ? modelNode.userData.originalLeftArmPivotZ : parts.leftArmPivot.position.z;
            // Store originals on first encounter
            if (modelNode.userData.originalRightArmPivotY == null) { modelNode.userData.originalRightArmPivotY = origRY; modelNode.userData.originalRightArmPivotZ = origRZ; }
            if (modelNode.userData.originalLeftArmPivotY == null) { modelNode.userData.originalLeftArmPivotY = origLY; modelNode.userData.originalLeftArmPivotZ = origLZ; }

            if (!animState || !animState.onGround) {
                // Airborne: lower both arm pivots halfway toward torso
                parts.rightArmPivot.position.y = origRY - (torsoH * 0.5);
                parts.rightArmPivot.position.z = origRZ;
                parts.leftArmPivot.position.y = origLY - (torsoH * 0.5);
                parts.leftArmPivot.position.z = origLZ;
            } else if (holdingItem && pdims) {
                // Holding item on ground: lower right arm pivot to match local hold pose
                const itemOffset = pdims.armD / 2;
                const shoulderY = pdims.legH + pdims.torsoH;
                parts.rightArmPivot.position.y = THREE.MathUtils.lerp(parts.rightArmPivot.position.y, shoulderY - itemOffset, armSmooth);
                parts.rightArmPivot.position.z = THREE.MathUtils.lerp(parts.rightArmPivot.position.z, itemOffset, armSmooth);
                parts.leftArmPivot.position.y = THREE.MathUtils.lerp(parts.leftArmPivot.position.y, origLY, armSmooth);
                parts.leftArmPivot.position.z = THREE.MathUtils.lerp(parts.leftArmPivot.position.z, origLZ, armSmooth);
            } else {
                // Normal ground: restore both arm pivots
                parts.rightArmPivot.position.y = THREE.MathUtils.lerp(parts.rightArmPivot.position.y, origRY, armSmooth);
                parts.rightArmPivot.position.z = THREE.MathUtils.lerp(parts.rightArmPivot.position.z, origRZ, armSmooth);
                parts.leftArmPivot.position.y = THREE.MathUtils.lerp(parts.leftArmPivot.position.y, origLY, armSmooth);
                parts.leftArmPivot.position.z = THREE.MathUtils.lerp(parts.leftArmPivot.position.z, origLZ, armSmooth);
            }
        } catch (e) {
            // defensive: ignore if any values missing
        }

        // Compute dynamic per-arm lerp that slows movement when the arm's remaining rotation is small.
        // Smaller angle differences => smaller lerp alpha => slower motion; larger differences => faster response.
        // Added `isAirborne` flag to speed up arm response while jumping (only airborne).
        const computeDynamicArmSmooth = (current, target, baseSmooth, isAirborne = false) => {
            try {
                const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
                const landingFactor = (now < (landingSlowUntil || 0)) ? 0.4 : 1.0; // landing window reduces responsiveness
                const delta = Math.abs(target - current);
                // Use the jumpRotation as a heuristic for the maximum meaningful rotation; fallback to PI.
                const maxDelta = (panim && panim.jumpRotation) ? Math.abs(panim.jumpRotation) : Math.PI;
                const normalized = Math.min(1, delta / Math.max(1e-6, maxDelta)); // 0..1 (small delta => 0)
                // Map normalized delta so small deltas produce a fraction near 0.25 (very slow) and large deltas approach 1.0
                const dynamicFactor = 0.25 + 0.75 * normalized;
                // When airborne, scale baseSmooth up so arm rotations happen faster during jump (does NOT affect landing)
                const AIRBORNE_SPEED_MULT = isAirborne ? 1.6 : 1.0;
                return baseSmooth * AIRBORNE_SPEED_MULT * dynamicFactor * landingFactor;
            } catch (e) {
                return baseSmooth;
            }
        };

        parts.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
            parts.leftArmPivot.rotation.x,
            targetLA,
            // dynamic smoothing makes small remaining rotations move slower during jump/landing
            computeDynamicArmSmooth(parts.leftArmPivot.rotation.x, targetLA, armSmooth)
        );

        // Apply dynamic smoothing for right arm as well (respects landing window)
        parts.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
            parts.rightArmPivot.rotation.x,
            targetRA,
            computeDynamicArmSmooth(parts.rightArmPivot.rotation.x, targetRA, armSmooth)
        );
        parts.leftLegPivot.rotation.x = THREE.MathUtils.lerp(parts.leftLegPivot.rotation.x, targetLL, bodySmooth);
        parts.rightLegPivot.rotation.x = THREE.MathUtils.lerp(parts.rightLegPivot.rotation.x, targetRL, bodySmooth);
    }

    // Utility to modify BoxGeometry UVs to show only 1/4 of the texture (1 stud)
    function adjustBoxUVs(geometry) {
        // We are scaling the UV coordinates so the entire face spans only 0.5 units in U and V,
        // effectively mapping only 1/4 of the texture (one stud) onto the entire face.
        const uvs = geometry.attributes.uv.array;
        const scale = 0.5;
        const offsetX = 0; // Selects the 0-0.5 U range
        const offsetY = 0; // Selects the 0-0.5 V range
        
        for (let i = 0; i < uvs.length; i += 2) {
            uvs[i] = uvs[i] * scale + offsetX;
            uvs[i + 1] = uvs[i + 1] * scale + offsetY;
        }

        geometry.attributes.uv.needsUpdate = true;
    }

    // Adjust the torso's TOP (+Y) face UVs so it maps to the top-half of the studs image
    // resulting in two studs across the torso instead of a single stretched stud.
    function adjustTorsoTopUVs(geometry) {
        const uvs = geometry.attributes.uv.array;
        // BoxGeometry layout: 6 faces, 4 verts per face, 2 components per vert => 48 entries (6*4*2)
        // Face order: +X(0), -X(1), +Y(2), -Y(3), +Z(4), -Z(5)
        // Each face block = 4 verts * 2 = 8 entries. +Y face starts at index 2*8 = 16.
        const faceStart = 2 * 8;
        const FACE_ENTRIES = 8;
        const scaleU = 1.0;   // use full width so two studs appear horizontally
        const scaleV = 0.5;   // use half height (top half of texture) to select the top row of studs
        const offsetU = 0.0;  // left-most start
        const offsetV = 0.5;  // shift into top-half (0.5..1.0)

        for (let i = 0; i < FACE_ENTRIES; i += 2) {
            const idx = faceStart + i;
            const origU = uvs[idx];
            const origV = uvs[idx + 1];
            uvs[idx] = origU * scaleU + offsetU;
            uvs[idx + 1] = origV * scaleV + offsetV;
        }
        geometry.attributes.uv.needsUpdate = true;
    }

    function createTargetIndicator() {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
        // Use a depth-tested, slightly transparent material so the indicator occludes correctly
        // Make the indicator fully opaque and respect scene depth so it cannot be seen through geometry.
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            metalness: 0.0,
            roughness: 0.8,
            transparent: false,
            opacity: 1.0,
            depthTest: true,
            depthWrite: true
        });
        targetIndicator = new THREE.Mesh(geometry, material);
        targetIndicator.visible = false;
        // Keep renderOrder default (0) so depth testing behaves naturally with other objects
        targetIndicator.renderOrder = 0;
        scene.add(targetIndicator);
    }

    function createModel() {
        const pcfg = getPConfig();
        const pvisuals = pcfg.visuals;
        const pdims = pvisuals.dimensions;
        // expose convenient local names for dimensions to avoid ReferenceError (legH, torsoH, etc.)
        const { legW, legH, legD, torsoW, torsoH, torsoD, armW, armH, armD, headScale, modelScale } = pdims;
        const pcolors = pvisuals.colors;
        const pmat = pvisuals.material;

        // Load Stud texture once for all parts
        const textureLoader = new THREE.TextureLoader();
        const studTex = textureLoader.load(Global.assets.studs);
        const studBottomTex = textureLoader.load(Global.assets.studsBottom);

        // Use nearest filtering and disable mipmaps so the studs and limb edges appear jagged and banded
        try {
            studTex.wrapS = THREE.ClampToEdgeWrapping;
            studTex.wrapT = THREE.ClampToEdgeWrapping;
            studTex.minFilter = THREE.NearestFilter;
            studTex.magFilter = THREE.NearestFilter;
            studTex.generateMipmaps = false;
        } catch (e) {}
        try {
            studBottomTex.wrapS = THREE.ClampToEdgeWrapping;
            studBottomTex.wrapT = THREE.ClampToEdgeWrapping;
            studBottomTex.minFilter = THREE.NearestFilter;
            studBottomTex.magFilter = THREE.NearestFilter;
            studBottomTex.generateMipmaps = false;
        } catch (e) {}
        
        const charModel = new THREE.Group();
        charModel.name = 'player_root';
        charModel.position.y = 0;

        // Create per-part glossy materials using configuration
        const torsoColor = new THREE.Color(pcolors.torso);
        const armsHeadColor = new THREE.Color(pcolors.limbs);
        const legsColor = new THREE.Color(pcolors.legs);

        const commonMatProps = {
            metalness: pmat.metalness,
            roughness: pmat.roughness,
            clearcoat: pmat.clearcoat,
            clearcoatRoughness: pmat.clearcoatRoughness,
            reflectivity: pmat.reflectivity,
            envMapIntensity: pmat.envMapIntensity,
            // disable any ambient occlusion influence on player materials
            aoMap: null,
            aoMapIntensity: 0
        };

        const torsoMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: torsoColor }, commonMatProps));
        const legMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: legsColor }, commonMatProps));

        const armSideMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: armsHeadColor }, commonMatProps));
        const armTopMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: armsHeadColor, map: studTex }, commonMatProps));
        const armBottomMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: armsHeadColor, map: studBottomTex }, commonMatProps));
        
        const ARM_GAP = -0.001;

        // --- Geometries ---
        const legGeo = new THREE.BoxGeometry(pdims.legW, pdims.legH, pdims.legD);
        adjustBoxUVs(legGeo); // Apply 1-stud UV mapping
        const torsoGeo = new RoundedBoxGeometry(pdims.torsoW, pdims.torsoH, pdims.torsoD, 4, Math.max(1.2, pdims.torsoD * 0.12));
        const armGeo = new RoundedBoxGeometry(pdims.armW, pdims.armH, pdims.armD, 4, Math.max(0.8, pdims.armD * 0.10));

        const surfacesTexture = textureLoader.load(Global.assets.glueStuds, (t) => {
            try {
                t.wrapS = THREE.ClampToEdgeWrapping;
                t.wrapT = THREE.ClampToEdgeWrapping;
                // Keep sampling consistent with model parts: linear sampling for this overlay region
                t.minFilter = THREE.LinearMipMapLinearFilter;
                t.magFilter = THREE.LinearFilter;
                // Select the right half (repeat.x = 0.5) and keep upright orientation (no rotation)
                t.repeat.set(0.5, 1.0);
                t.offset.set(0.5, 0.0);
                t.needsUpdate = true;
            } catch (e) {}
        });

        const torso = new THREE.Mesh(torsoGeo, torsoMat.clone());
        torso.name = 'Torso';
        torso.castShadow = true;
        torso.receiveShadow = true;
        const hipY = legH; // Hip pivot height above ground
        torso.position.y = hipY + (torsoH / 2);

        // Flip torso 180° around the Y axis so the front face is rotated (torso flipped about Y)
        torso.rotation.y = Math.PI;

        // Create an efficient overlay decal using a single mesh (plane) that uses the decal texture,
        // rendered after the torso and with depthWrite disabled to avoid z-fighting and heavy material cost.
        // Load decal texture asynchronously to avoid marking textures 'needsUpdate' before image is available.
        textureLoader.load('./Roblox Decal.png', (decalTex) => {
            try {
                if (!decalTex || !decalTex.image) {
                    // If no image data, skip creating the decal
                    console.warn('Roblox decal overlay skipped: no image data');
                    return;
                }
                decalTex.encoding = THREE.sRGBEncoding;
                decalTex.flipY = true;
                decalTex.wrapS = THREE.ClampToEdgeWrapping;
                decalTex.wrapT = THREE.ClampToEdgeWrapping;
                // no explicit needsUpdate call required here because loader's callback ensures the image is ready

                // Plane sized to cover the front face (slightly inset to avoid z-fighting)
                const planeW = torsoW * 0.90;
                const planeH = torsoH * 0.90;
                const decalGeo = new THREE.PlaneGeometry(planeW, planeH);
                // Use a lighting-aware material so the decal receives scene lighting while remaining efficient.
                // Keep transparency/depth write settings to avoid z-fighting and preserve the overlay behavior.
                const decalMat = new THREE.MeshStandardMaterial({
                    map: decalTex,
                    transparent: true,
                    depthTest: true,
                    depthWrite: false,
                    toneMapped: false,
                    alphaTest: 0.01,
                    // make decal blend more with the plastic base by softening specular response
                    metalness: 0.04,
                    roughness: 0.45,
                    emissive: new THREE.Color(0x000000),
                    envMapIntensity: 0.5
                });
                const decalMesh = new THREE.Mesh(decalGeo, decalMat);
                decalMesh.name = 'Torso_Front_Decal';
                // Position the decal slightly in front of the torso's front (+Z local) so it always appears on the front face.
                decalMesh.position.set(0, 0, (torsoRadius * 1.15) + 0.001);
                // The torso itself was rotated around Y (torso.rotation.y = Math.PI).
                // Rotating the decal around X caused it to face away; keep decal upright in local space
                // so it correctly appears on the flipped torso front. If a horizontal mirror is needed,
                // flip around Y instead (uncomment the next line).
                // decalMesh.rotation.y = Math.PI;
                decalMesh.rotation.x = 0;
                // Ensure decal faces outward regardless of parent rotation; we attach as child so it inherits torso transform
                decalMesh.renderOrder = 999;
                // Add decal as child so it follows torso transforms and scales with model.scale
                torso.add(decalMesh);
            } catch (err) {
                console.warn('Roblox decal overlay failed during setup', err);
            }
        }, undefined, (err) => {
            console.warn('Roblox decal overlay failed to load', err);
        });
        
        // --- Legs (Pivoted from the Hip) ---
        const legOffsetX = (torsoW / 2) - (legW / 2) - (0.01);

        // Left Leg Setup
        const leftLegPivot = new THREE.Group();
        leftLegPivot.name = 'LeftLegPivot';
        leftLegPivot.position.set(-legOffsetX, hipY, 0); 

        // Create per-face materials for legs so the bottom (-Y) face can use the same indented stud texture as arms' bottoms
        const legSideMat = legMat.clone();
        const legBottomMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: legsColor, map: studBottomTex }, commonMatProps));
        // BoxGeometry material order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
        const leftLegMaterials = [
            legSideMat.clone(), // +X
            legSideMat.clone(), // -X
            legSideMat.clone(), // +Y (top)
            legBottomMat.clone(), // -Y (bottom) -> use bottom stud texture
            legSideMat.clone(), // +Z
            legSideMat.clone()  // -Z
        ];
        const leftLeg = new THREE.Mesh(legGeo, leftLegMaterials);
        leftLeg.name = 'LeftLegMesh';
        // Position mesh so its top (hip) is at the pivot's origin
        leftLeg.position.y = -legH / 2;
        leftLeg.castShadow = true;
        leftLeg.receiveShadow = false;
        leftLegPivot.add(leftLeg);

        // Right Leg Setup
        const rightLegPivot = new THREE.Group();
        rightLegPivot.name = 'RightLegPivot';
        rightLegPivot.position.set(legOffsetX, hipY, 0); 
        // right leg uses same per-face materials as left leg
        const rightLegMaterials = leftLegMaterials.map(m => m.clone ? m.clone() : m);
        const rightLeg = new THREE.Mesh(legGeo, rightLegMaterials);
        rightLeg.name = 'RightLegMesh';
        rightLeg.position.y = -legH / 2;
        rightLeg.castShadow = true;
        rightLeg.receiveShadow = false;
        rightLegPivot.add(rightLeg);


        // --- Arms (Pivoted from the Shoulder) ---
        // Add a small outward gap so arms sit snugly against the torso without intersecting it.
        // Positive ARM_GAP moves arms slightly outward from exact touching position.
        const armOffsetX = (torsoW / 2) + (armW / 2) + ARM_GAP;
        const shoulderY = hipY + torsoH; 

        // Left Arm Setup
        const leftArmPivot = new THREE.Group();
        leftArmPivot.name = 'LeftArmPivot';
        leftArmPivot.position.set(-armOffsetX, shoulderY, 0);

        // For BoxGeometry materials the index order is +X, -X, +Y, -Y, +Z, -Z
        // We want the +Y (top) face to show the studs texture, other faces plain -> build an array of 6 materials
        const leftArmMaterials = [
            armSideMat.clone(), // +X
            armSideMat.clone(), // -X
            armTopMat.clone(),  // +Y (top face)
            armBottomMat.clone(), // -Y (bottom) -> use bottom stud texture
            armSideMat.clone(), // +Z
            armSideMat.clone()  // -Z
        ];
        const leftArm = new THREE.Mesh(armGeo, leftArmMaterials);
        leftArm.name = 'LeftArmMesh';
        // Position mesh so its top (shoulder) is at the pivot's origin
        leftArm.position.y = -armH / 2;
        leftArm.castShadow = true;
        leftArm.receiveShadow = false;
        leftArmPivot.add(leftArm);

        // Right Arm Setup
        const rightArmPivot = new THREE.Group();
        rightArmPivot.name = 'RightArmPivot';
        rightArmPivot.position.set(armOffsetX, shoulderY, 0);
        
        const rightArmMaterials = [
            armSideMat.clone(), // +X
            armSideMat.clone(), // -X
            armTopMat.clone(),  // +Y (top face)
            armBottomMat.clone(), // -Y (bottom) -> use bottom stud texture
            armSideMat.clone(), // +Z
            armSideMat.clone()  // -Z
        ];
        const rightArm = new THREE.Mesh(armGeo, rightArmMaterials);
        rightArm.name = 'RightArmMesh';
        rightArm.position.y = -armH / 2;
        rightArm.castShadow = true;
        rightArm.receiveShadow = false;
        rightArmPivot.add(rightArm);

        // Assemble model:
        charModel.add(leftLegPivot);
        charModel.add(rightLegPivot);
        charModel.add(torso);
        charModel.add(leftArmPivot);
        charModel.add(rightArmPivot);

        // --- Forcefield Effect ---
        // Create a thin outline "cage" forcefield that hugs each body part closely.
        // Compute thickness proportionally to the part's smallest dimension so it scales sensibly,
        // and only expand the frame slightly so it pokes out a little bit.
        // Reduced outward expansion so the outline fits tighter around the player while preserving beam thickness.
        const SCALE_OUT = 1.02; // small outward expansion so beams barely clear the mesh (tighter)
        // Increased thickness parameters so the overall outline is thicker while still scaling with part size.
        // Slightly raised both the proportional and absolute fallbacks so the beams read thicker by a small margin.
        const MIN_THICKNESS_RATIO = 0.16; // larger fraction of smallest dimension -> thicker relative beams
        const MIN_ABSOLUTE_THICKNESS = 2.9; // larger fallback thickness so beams are clearly thicker visually

        const ffParts = [
            { geo: torsoGeo, parent: torso, offset: new THREE.Vector3(0,0,0) },
            { geo: legGeo, parent: leftLegPivot, offset: new THREE.Vector3(0, -legH/2, 0) },
            { geo: legGeo, parent: rightLegPivot, offset: new THREE.Vector3(0, -legH/2, 0) },
            { geo: armGeo, parent: leftArmPivot, offset: new THREE.Vector3(0, -armH/2, 0) },
            { geo: armGeo, parent: rightArmPivot, offset: new THREE.Vector3(0, -armH/2, 0) }
        ];

        ffParts.forEach(p => {
            try {
                p.geo.computeBoundingBox();
                const sz = new THREE.Vector3();
                p.geo.boundingBox.getSize(sz);

                // compute a thickness relative to the smallest axis so thin parts stay thin
                const smallest = Math.max(0.0001, Math.min(sz.x, sz.y, sz.z));
                const t = Math.max(MIN_ABSOLUTE_THICKNESS, smallest * MIN_THICKNESS_RATIO);

                // Slightly expand extents so beams sit just outside the mesh surface
                const w = sz.x * SCALE_OUT;
                const h = sz.y * SCALE_OUT;
                const d = sz.z * SCALE_OUT;

                // Material: keep crisp solid outline with good visibility but avoid heavy occlusion
                const ffMat = new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    transparent: false,
                    depthTest: true,
                    // prevent forcefield beams from writing depth so they can't participate in stencil/occlusion passes
                    depthWrite: false,
                    toneMapped: false,
                    side: THREE.FrontSide
                });

                const frameGroup = new THREE.Group();
                frameGroup.position.copy(p.offset);

                const addBeam = (bw, bh, bd, x, y, z) => {
                    // Use small geometries for beams; align centers exactly so frames hug the mesh
                    const geom = new THREE.BoxGeometry(bw, bh, bd);
                    const mat = ffMat.clone();
                    // force the forcefield beams to not write depth so they won't occlude decals via depth buffer,
                    // but still participate in depth testing so they hide correctly behind occluding geometry.
                    try { mat.depthWrite = false; } catch (e) {}
                    const b = new THREE.Mesh(geom, mat);
                    b.position.set(x, y, z);
                    // mark as forcefield part for runtime checks
                    b.userData.isForcefieldPart = true;
                    // ensure beams never cast or receive shadows (prevents stencil + shadow contributions)
                    b.castShadow = false;
                    b.receiveShadow = false;
                    // add explicit exclusion flag for any external helpers
                    b.userData.excludeFromShadows = true;
                    // prefer rendering forcefield after most decal/overlay content so it visually sits on top
                    b.renderOrder = 2000;
                    frameGroup.add(b);
                };

                const hw = w / 2; const hh = h / 2; const hd = d / 2;

                // Vertical edge beams (thin, run full height)
                addBeam(t, h, t, -hw, 0, -hd);
                addBeam(t, h, t,  hw, 0, -hd);
                addBeam(t, h, t, -hw, 0,  hd);
                addBeam(t, h, t,  hw, 0,  hd);

                // Width-wise horizontal beams (thin)
                addBeam(w, t, t, 0, -hh, -hd);
                addBeam(w, t, t, 0,  hh, -hd);
                addBeam(w, t, t, 0, -hh,  hd);
                addBeam(w, t, t, 0,  hh,  hd);

                // Depth-wise horizontal beams (thin)
                addBeam(t, t, d, -hw, -hh, 0);
                addBeam(t, t, d,  hw, -hh, 0);
                addBeam(t, t, d, -hw,  hh, 0);
                addBeam(t, t, d,  hw,  hh, 0);

                // Add small corner-fill cubes so beams meet cleanly at corners (fills gaps left by separate beam boxes)
                // cornerSize slightly larger than thickness to ensure seamless join without visible seam
                const cornerSize = Math.max(t * 1.05, t + 0.0001);
                const cornerGeom = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
                const createCorner = (x, y, z) => {
                    const mat = ffMat.clone();
                    try { mat.depthWrite = false; } catch (e) {}
                    const corner = new THREE.Mesh(cornerGeom, mat);
                    corner.position.set(x, y, z);
                    corner.userData.isForcefieldPart = true;
                    corner.castShadow = false;
                    corner.receiveShadow = false;
                    corner.userData.excludeFromShadows = true;
                    corner.renderOrder = 2000;
                    frameGroup.add(corner);
                };

                // 8 corners: combine +/- hw, +/- hh, +/- hd
                const xs = [-hw, hw];
                const ys = [-hh, hh];
                const zs = [-hd, hd];
                for (let xi = 0; xi < xs.length; xi++) {
                    for (let yi = 0; yi < ys.length; yi++) {
                        for (let zi = 0; zi < zs.length; zi++) {
                            createCorner(xs[xi], ys[yi], zs[zi]);
                        }
                    }
                }

                p.parent.add(frameGroup);

                // Defensive: re-assert no shadow participation on any nested mesh
                try {
                    frameGroup.traverse((n) => {
                        if (n && n.isMesh) {
                            try { n.castShadow = false; } catch (e) {}
                            try { n.receiveShadow = false; } catch (e) {}
                            n.userData.isForcefieldPart = true;
                            n.userData.excludeFromShadows = true;
                            if (n.material) {
                                try { n.material.depthWrite = false; } catch (e) {}
                                try { n.material.stencilWrite = false; } catch (e) {}
                            }
                        }
                    });
                } catch (e) {}

            } catch (e) {
                // non-fatal: if anything goes wrong with a single part, skip it
                console.warn('forcefield part build failed', e);
            }
        });

        // Translucent light-blue respawn sphere. Its source dimensions are kept
        // in the same pre-model-scale units as the character parts below.
        const aura = new THREE.Mesh(
            new THREE.SphereGeometry(70, 32, 20),
            new THREE.MeshBasicMaterial({
                color: 0x8edfff,
                transparent: true,
                opacity: 0.24,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        aura.name = 'RespawnAura';
        aura.position.y = (legH + torsoH + 30) / 2;
        aura.userData.isRespawnAura = true;
        aura.visible = false;
        charModel.add(aura);

        // Store references needed for animation
        charModel.userData.animationParts = { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot };
        // Store the torso for decal access
        charModel.userData.torso = torso;
        // capture the original arm pivot Y and Z for restoring after airborne/jump states (both left + right)
        try { 
            originalRightArmPivotY = rightArmPivot.position.y; 
            originalRightArmPivotZ = rightArmPivot.position.z;
        } catch (e) { 
            originalRightArmPivotY = null; 
            originalRightArmPivotZ = null;
        }
        try {
            originalLeftArmPivotY = leftArmPivot.position.y;
            originalLeftArmPivotZ = leftArmPivot.position.z;
        } catch (e) {
            originalLeftArmPivotY = null;
            originalLeftArmPivotZ = null;
        }

        // Apply the configured uniform world-scale so parts keep their original numeric measurements
        // while the full character height can be tuned cleanly from PlayerModule config.
        charModel.scale.set(modelScale, modelScale, modelScale);

        // Ensure model parts cast shadows but do NOT receive shadows from the player itself
        try {
            charModel.traverse((n) => {
                if (n.isMesh) {
                    // Skip any forcefield parts so they never cast or receive shadows.
                    if (n.userData && n.userData.isForcefieldPart) {
                        try { n.castShadow = false; } catch (e) {}
                        try { n.receiveShadow = false; } catch (e) {}
                        return;
                    }
                    // allow the player to cast shadows into the world for regular meshes
                    n.castShadow = true;
                    // disable receiving shadows on the player's own meshes so parts don't shade each other
                    n.receiveShadow = false;
                }
            });
        } catch (e) {}

        try {
            const loader = new GLTFLoader();
            loader.load(Global.assets.head, (gltf) => {
                const headNode = gltf.scene;
                // Compute bounding box of the imported head to size it relative to the torso
                const bbox = new THREE.Box3().setFromObject(headNode);
                const size = new THREE.Vector3();
                bbox.getSize(size);

                // If size.x is zero for some reason, avoid division by zero
                const currentWidth = size.x > 0 ? size.x : 1.0;

                // Target head width should be a fraction of torso width so proportions look correct.
                const TARGET_HEAD_WIDTH = pdims.torsoW * pdims.headScale;
                const scaleFactor = TARGET_HEAD_WIDTH / currentWidth;

                headNode.scale.setScalar(scaleFactor);

                // Recompute bbox/size after scaling
                const bbox2 = new THREE.Box3().setFromObject(headNode);
                const size2 = new THREE.Vector3();
                bbox2.getSize(size2);

                // Position head: sit on top of torso with a tiny inward overlap to avoid visible gap
                // lowered further to tuck the head slightly down into the torso
                // Account for parent model scale so the small downward tuck (0.050 world units)
                // actually moves the head by the expected world-space amount after model scaling.
                const scaleY = (charModel && charModel.scale && charModel.scale.y) ? charModel.scale.y : 1;
                const headY = torso.position.y + (torsoH / 2) + (size2.y / 2) - (0.050 / scaleY);
                headNode.position.set(0, headY, 0);
                
                // --- Head Forcefield Logic ---
                try {
                    // Calculate bounds of the raw head (inside headNode) so the forcefield scales with it
                    // Reuse the unscaled 'size' measured before the head was reoriented/scaled.
                    const sz = size.clone(); // width/height/depth of unscaled head

                    // Slight outward scale so beams clear the head surface just enough
                    const SCALE_OUT = 1.02;
                    // Thickness base: proportional to smallest head axis, but clamped to a reasonable minimum
                    const smallest = Math.min(sz.x, sz.y, sz.z);
                    const t = Math.max(smallest * 0.11, 0.028);

                    const w = sz.x * SCALE_OUT;
                    const h = sz.y * SCALE_OUT;
                    const d = sz.z * SCALE_OUT;

                    // Reduce vertical extent so the top appears slightly smaller than the mid-section
                    const HEAD_VERTICAL_SCALE = 0.86;
                    const hScaled = h * HEAD_VERTICAL_SCALE;

                    // Reduce extrusion a bit so side beams no longer stick out excessively
                    const EXTRUDE = Math.max(0.015, w * 0.10);

                    const ffMat = new THREE.MeshBasicMaterial({
                        color: 0x00ffff,
                        transparent: false,
                        depthTest: true,
                        // Do NOT write depth for head forcefield so it doesn't carve holes in other overlays/decals.
                        depthWrite: false,
                        toneMapped: false,
                        side: THREE.FrontSide
                    });

                    const frameGroup = new THREE.Group();
                    frameGroup.renderOrder = 2000;

                    // Center frame on head bbox center and nudge slightly down from previous offset so beams don't poke up
                    const center = new THREE.Vector3();
                    bbox.getCenter(center);
                    frameGroup.position.copy(center);
                    frameGroup.position.y += 0.08; // smaller upward offset to reduce poking

                    // beam helper that creates invisible-by-default beams
                    const addBeam = (bw, bh, bd, x, y, z) => {
                        const geom = new THREE.BoxGeometry(bw, bh, bd);
                        const mat = ffMat.clone();
                        try { mat.depthWrite = false; } catch (e) {}
                        const b = new THREE.Mesh(geom, mat);
                        b.position.set(x, y, z);
                        b.userData.isForcefieldPart = true;
                        b.castShadow = false;
                        b.receiveShadow = false;
                        b.visible = false;
                        b.renderOrder = 2000;
                        frameGroup.add(b);
                    };

                    const hw = w / 2;
                    const hh = hScaled / 2;
                    const hd = d / 2;

                    // Vertical edge beams (use full scaled height so top aligns with narrowed vertical scale)
                    addBeam(t, hScaled, t, -(hw + EXTRUDE), 0, -hd);
                    addBeam(t, hScaled, t, -(hw + EXTRUDE), 0,  hd);
                    addBeam(t, hScaled, t,  (hw + EXTRUDE), 0, -hd);
                    addBeam(t, hScaled, t,  (hw + EXTRUDE), 0,  hd);

                    // Top/bottom small horizontal plates near left/right faces (use scaled hh)
                    addBeam(t, t, d, -(hw + EXTRUDE), -hh, 0);
                    addBeam(t, t, d, -(hw + EXTRUDE),  hh, 0);
                    addBeam(t, t, d,  (hw + EXTRUDE), -hh, 0);
                    addBeam(t, t, d,  (hw + EXTRUDE),  hh, 0);

                    // Width-wise horizontal beams run across width — enlarge width slightly so extrusion shows on both sides
                    addBeam(w + (EXTRUDE * 2), t, t, 0, -hh, -hd);
                    addBeam(w + (EXTRUDE * 2), t, t, 0,  hh, -hd);
                    addBeam(w + (EXTRUDE * 2), t, t, 0, -hh,  hd);
                    addBeam(w + (EXTRUDE * 2), t, t, 0,  hh,  hd);

                    // Corners: create corner boxes sized to match the top-beam thickness/scale so they don't poke up.
                    // Use non-uniform corner geometry so the Y dimension matches the scaled top/bottom beam thickness.
                    const cornerSizeX = Math.max(t * 1.05, t + 0.0001);
                    const cornerSizeY = Math.max(t, t * HEAD_VERTICAL_SCALE); // ensure vertical size matches top scaling
                    const cornerSizeZ = Math.max(t * 1.05, t + 0.0001);

                    const createCorner = (x, y, z) => {
                        const geom = new THREE.BoxGeometry(cornerSizeX, cornerSizeY, cornerSizeZ);
                        const mat = ffMat.clone();
                        try { mat.depthWrite = false; } catch (e) {}
                        const corner = new THREE.Mesh(geom, mat);
                        corner.position.set(x, y, z);
                        corner.userData.isForcefieldPart = true;
                        corner.castShadow = false;
                        corner.receiveShadow = false;
                        corner.userData.excludeFromShadows = true;
                        corner.renderOrder = 2000;
                        corner.visible = false;
                        frameGroup.add(corner);
                    };

                    // Place corners at the scaled extents (use hh so corners align with top/bottom beams)
                    const xs = [-(hw + EXTRUDE), (hw + EXTRUDE)];
                    const ys = [-hh, hh];
                    const zs = [-hd, hd];
                    for (let xi = 0; xi < xs.length; xi++) {
                        for (let yi = 0; yi < ys.length; yi++) {
                            for (let zi = 0; zi < zs.length; zi++) {
                                createCorner(xs[xi], ys[yi], zs[zi]);
                            }
                        }
                    }

                    headNode.add(frameGroup);
                } catch (e) {
                    console.warn('Head forcefield generation failed', e);
                }


                // Keep the imported head orientation as authored (do not flip it).
                // headNode.rotation.x += Math.PI; // flipped previously — intentionally disabled

                // Prepare face overlay that uses the head geometry UVs so the face texture warps with the head
                try {
                    const textureLoader = new THREE.TextureLoader();
                    textureLoader.load(Global.assets.face, (faceTex) => {
                        faceTex.encoding = THREE.sRGBEncoding;
                        // Keep the texture orientation as the image was authored (do not flip vertically)
                        faceTex.flipY = true;
                        // Ensure UV sampling clamps at edges and allow texture transform so we can center it on the head front
                        faceTex.wrapS = THREE.ClampToEdgeWrapping;
                        faceTex.wrapT = THREE.ClampToEdgeWrapping;
                        // Disable smoothing on the face texture to remove anti-aliasing
                        try {
                            faceTex.minFilter = THREE.NearestFilter;
                            faceTex.magFilter = THREE.NearestFilter;
                            faceTex.generateMipmaps = false;
                        } catch (e) {}
                        faceTex.center.set(0.5, 0.5); // rotate/offset transforms pivot around texture center
                        faceTex.rotation = 0; // ensure no rotation is applied
                        // Slight vertical stretch only (no offset) — reduce repeat.y so the texture is sampled
                        // over a smaller V range which visually stretches it taller on the mesh.
                        faceTex.repeat.set(1, 0.92);
                        faceTex.needsUpdate = true;

                        // Traverse meshes and for each mesh create a second mesh that uses the same geometry (shared) but a transparent material with the face texture.
                        // This preserves the original head material while overlaying the face image warped by the mesh UVs.
                        // Create a glossy PBR material for the head so it matches torso/arms highlights
                const headMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: armsHeadColor }, commonMatProps));
                headMat.clearcoat = commonMatProps.clearcoat !== undefined ? commonMatProps.clearcoat : 1.0;
                headMat.clearcoatRoughness = commonMatProps.clearcoatRoughness !== undefined ? commonMatProps.clearcoatRoughness : 0.03;

                headNode.traverse((node) => {
                    if (!node.isMesh) return;
                    // Do not apply the face texture to the forcefield outline beams!
                    if (node.userData.isForcefieldPart) return;

                    // Ensure original mesh keeps its shadow settings and replace its material with shiny PBR
                    node.castShadow = true;
                    node.receiveShadow = true;
                    try {
                        // Replace existing material with the new physical head material.
                        // If geometry had multiple groups, clone headMat per-slot to avoid shared state issues.
                        if (Array.isArray(node.material) && node.material.length > 1) {
                            node.material = node.material.map(() => headMat.clone());
                        } else {
                            node.material = headMat.clone();
                        }
                    } catch (e) {
                        // Fallback: attempt to tint existing material if replacement fails
                        try {
                            if (node.material && node.material.color) node.material.color.copy(armsHeadColor);
                        } catch (ex) {}
                    }

                    // Create overlay material using face texture; keep alpha so transparent BG doesn't hide head.
                    // To make the face sit exactly flush with the underlying head geometry we let the overlay participate
                    // in depth writing (so it occupies the same z as the head surface) and avoid polygonOffset nudging.
                    const overlayMat = new THREE.MeshBasicMaterial({
                        map: faceTex,
                        transparent: true,
                        // Respect scene occlusion and write into the depth buffer so the overlay aligns flush with the mesh
                        depthTest: true,
                        depthWrite: true,
                        blending: THREE.NormalBlending,
                        // Lowering alphaTest slightly to make the face lines appear a tiny bit thicker/bolder
                        alphaTest: 0.45,
                        toneMapped: false,
                        side: THREE.DoubleSide // ensure consistent appearance regardless of small normal flips
                    });

                    // Do not use polygonOffset here — that pushed the face slightly forward and made it visible from the side.
                    overlayMat.polygonOffset = false;

                    // Use the same geometry (shared) so UVs align and the face warps with head mesh
                    const overlayMesh = new THREE.Mesh(node.geometry, overlayMat);
                    overlayMesh.name = (node.name || 'head_overlay') + '_face_overlay';
                    // Keep default renderOrder (inherit typical scene ordering) so the overlay does not appear lifted.
                    // Render overlays before the forcefield (so forcefield can visually sit on top).
                    overlayMesh.renderOrder = 1000;
                    // copy transform from source mesh (position/rotation/scale will be relative to headNode)
                    overlayMesh.position.copy(node.position);
                    overlayMesh.rotation.copy(node.rotation);
                    overlayMesh.scale.copy(node.scale);
                    // Do NOT change any mesh scale here (preserve original geometry proportions)
                    overlayMesh.matrixAutoUpdate = false;
                    overlayMesh.matrix.copy(node.matrix);

                    // Add overlay as a sibling to the node under the same parent so it follows head transforms
                    if (node.parent) node.parent.add(overlayMesh);
                });
                    }, undefined, (err) => {
                        console.warn('face.png load failed', err);
                    });
                } catch (e) {
                    console.warn('face overlay creation failed', e);
                }

                // Ensure cast/receive shadows if scene supports them for original head meshes
                headNode.traverse((n) => {
                    if (!n.isMesh) return;
                    // Ensure any forcefield parts remain excluded from shadow casting/receiving.
                    if (n.userData && n.userData.isForcefieldPart) {
                        try { n.castShadow = false; } catch (e) {}
                        try { n.receiveShadow = false; } catch (e) {}
                        return;
                    }
                    // Regular head meshes cast shadows but do not receive them from the player itself.
                    try { n.castShadow = true; } catch (e) {}
                    try { n.receiveShadow = false; } catch (e) {}
                });

                headNode.name = 'Head';
                charModel.add(headNode);
            }, undefined, (err) => {
                // swallow load errors so missing asset doesn't break runtime
                console.warn('head.glb load failed', err);
            });
        } catch (e) {
            console.warn('head loader error', e);
        }
        return charModel;
    }

    function tryJump() {
        const pcfg = getPConfig();
        if (!model || !onGround || inputLocked) return;
        velocityY = pcfg.jumpVelocity;
        onGround = false;
        landedHoldUntil = 0;
        playSound('jump');
    }

    /**
     * Physics resolver that implements the AABB logic defined in collisions.lua
     * Extended: allows stepping up onto short obstacles whose top is within STEP_HEIGHT.
     *
     * Improvements:
     * - use inclusive overlap checks for robustness at boundaries
     * - apply a small separation epsilon when resolving X/Z penetrations to avoid jitter-through edges
     * - clearer variable names and defensive guards when Box3 size is degenerate
     */
    function resolvePhysics() {
        if (!model || !world.collidables) return;

        // Assume airborne until a supporting collision is found this frame
        onGround = false;

        const pcfg = getPConfig();
        const pdims = pcfg.visuals.dimensions;
        const scale = 0.028; // model scale constant

        // Configurable maximum step height (world units). Tuneable if needed.
        const STEP_HEIGHT = 0.28; // ~28cm in world units (works well with current model scale)
        const SEPARATION_EPS = 0.0015; // small margin to push objects fully apart to avoid re-penetration

        // Define Player AABB (center + half extents)
        // model.position is bottom center.
        const totalH = (pdims.legH + pdims.torsoH) * scale;
        const playerBox = {
            x: model.position.x,
            y: model.position.y + totalH / 2,
            z: model.position.z,
            hw: Math.max(0.0001, (pdims.torsoW * scale) / 2),
            hh: Math.max(0.0001, totalH / 2),
            hd: Math.max(0.0001, (pdims.torsoD * scale) / 2)
        };

        // Player bottom (world y coordinate of player's feet)
        const playerBottomY = model.position.y;

        for (const obj of world.collidables) {
            // Defensive: skip nulls
            if (!obj) continue;

            // Get world-space box for the obstacle (account for object transforms)
            const boxWorld = new THREE.Box3().setFromObject(obj);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            boxWorld.getCenter(center);
            boxWorld.getSize(size);

            // If size is zero (degenerate object), skip
            if (size.x <= 0 || size.y <= 0 || size.z <= 0) continue;

            // Obstacle AABB in world coordinates
            const obstacleBox = {
                x: center.x,
                y: center.y,
                z: center.z,
                hw: size.x / 2,
                hh: size.y / 2,
                hd: size.z / 2
            };

            // Check overlap in X/Z first (horizontal overlap) using inclusive comparison
            const overlapX = Math.abs(playerBox.x - obstacleBox.x) <= (playerBox.hw + obstacleBox.hw);
            const overlapZ = Math.abs(playerBox.z - obstacleBox.z) <= (playerBox.hd + obstacleBox.hd);

            // Compute obstacle top and player foot/top positions
            const obstacleTopY = obstacleBox.y + obstacleBox.hh;
            const obstacleBottomY = obstacleBox.y - obstacleBox.hh;

            // If horizontally overlapping and obstacle is short enough to step onto, prefer stepping up
            if (overlapX && overlapZ) {
                // Amount obstacle would raise player's bottom if stepped onto it
                const stepNeeded = obstacleTopY - playerBottomY;
                // Only consider stepping up when obstacle top is above player's feet but within STEP_HEIGHT
                if (stepNeeded > 0 && stepNeeded <= STEP_HEIGHT) {
                    // Raise player to sit on top of obstacle
                    model.position.y = obstacleTopY;
                    // reset vertical velocity and mark onGround
                    velocityY = 0;
                    onGround = true;
                    // Update playerBox to new center Y for remaining checks
                    playerBox.y = model.position.y + totalH / 2;
                    continue;
                }
            }

            // If no early step resolved, perform normal AABB overlap checks including Y (inclusive)
            const overlapY = Math.abs(playerBox.y - obstacleBox.y) <= (playerBox.hh + obstacleBox.hh);

            if (overlapX && overlapY && overlapZ) {
                // Compute penetrations on each axis
                const penX = (playerBox.hw + obstacleBox.hw) - Math.abs(playerBox.x - obstacleBox.x);
                const penY = (playerBox.hh + obstacleBox.hh) - Math.abs(playerBox.y - obstacleBox.y);
                const penZ = (playerBox.hd + obstacleBox.hd) - Math.abs(playerBox.z - obstacleBox.z);

                // Choose the axis with the smallest penetration to resolve
                if (penX <= penY && penX <= penZ) {
                    // push horizontally on X with a tiny extra separation so we don't immediately re-intersect due to FP/step
                    const sign = (playerBox.x >= obstacleBox.x) ? 1 : -1;
                    const move = penX + SEPARATION_EPS;
                    model.position.x += move * sign;
                    playerBox.x += move * sign;
                } else if (penY <= penX && penY <= penZ) {
                    const sign = (playerBox.y >= obstacleBox.y) ? 1 : -1;
                    const move = penY + SEPARATION_EPS;
                    model.position.y += move * sign;
                    playerBox.y += move * sign;
                    // If resolving upwards, consider player on ground of this object
                    if (sign > 0) {
                        velocityY = 0;
                        onGround = true;
                    }
                } else {
                    const sign = (playerBox.z >= obstacleBox.z) ? 1 : -1;
                    const move = penZ + SEPARATION_EPS;
                    model.position.z += move * sign;
                    playerBox.z += move * sign;
                }
            }
        }
    }

    function update() {
        if (!model) return;
        const pcfg = getPConfig();

        // Update Forcefield color and visibility
        updateModelForcefield(model, performance.now() < forcefieldEndTime, performance.now());
        const panim = pcfg.animation;
        const pdims = pcfg.visuals.dimensions;

        const prevVelocityY = velocityY;
        velocityY += (pcfg.gravity !== undefined ? pcfg.gravity : -0.02);
        // NOTE: tryJump is now only invoked on the keydown event (edge-trigger) to avoid retriggering while holding space.
        // if (!inputLocked && (keyboard['space'] || keyboard[' '])) tryJump();

        model.position.y += velocityY;

        // Death fling continues briefly even after input is locked, giving the
        // character a physical launch and a playful tumble before respawning.
        if (deathFlingActive) {
            model.position.x += deathFlingVelocity.x;
            model.position.z += deathFlingVelocity.z;
            deathFlingVelocity.x *= 0.94;
            deathFlingVelocity.z *= 0.94;
            model.rotation.x += deathFlingSpin.x;
            model.rotation.z += deathFlingSpin.z;
            deathFlingSpin.x *= 0.985;
            deathFlingSpin.z *= 0.985;
            if (Math.abs(deathFlingVelocity.x) + Math.abs(deathFlingVelocity.z) < 0.002 && onGround) {
                deathFlingActive = false;
            }
        }

        // Rely on resolvePhysics() and the collidables list for real ground collision.
        // We will handle landing detection and fall damage based on changes to onGround
        // after resolvePhysics() runs (see below).

        // Update previousOnGround for next frame
        previousOnGround = onGround;

        // if they fall way way down (missed the lava?? how lol) just safety teleport 'em
        if (model.position.y < -100) {
            respawn(new THREE.Vector3(0, 5, 0));
            if (hooks.onVoidFall) hooks.onVoidFall();
        }

        const moveDirection = new THREE.Vector3(0, 0, 0);
        const cameraForward = new THREE.Vector3();
        if (firstPersonActive) {
            // in first-person, forward is the direction the player is facing
            cameraForward.set(Math.sin(fpYaw), 0, Math.cos(fpYaw)).normalize();
        } else {
            camera.getWorldDirection(cameraForward);
            cameraForward.y = 0; cameraForward.normalize();
        }
        const cameraRight = new THREE.Vector3().crossVectors(camera.up, cameraForward).normalize();

        let moved = false;
        let rotationApplied = false;

        if (playerTarget) {
            // Calculate horizontal distance only for target check (ignore vertical difference)
            const horizontalPos = model.position.clone();
            horizontalPos.y = 0;
            // Project target onto horizontal plane for a fair distance comparison
            const projectedTarget = playerTarget.clone();
            projectedTarget.y = 0;
            const distanceToTarget = horizontalPos.distanceTo(projectedTarget);

            if (distanceToTarget > 0.1) {
                // Move toward the horizontal position of the target while preserving proper stepping/physics
                const moveTo = playerTarget.clone();
                moveTo.y = model.position.y; // keep movement horizontal (no vertical component)
                moveDirection.subVectors(moveTo, model.position).normalize();
                moveDirection.y = 0;
                moved = true;
            } else {
                playerTarget = null;
                if (targetIndicator) targetIndicator.visible = false;
            }
        } else if (!inputLocked) { // Regular keyboard input block (axis-intent based: opposing keys cancel)
            // Determine axis intents instead of naively summing keys so opposing inputs cancel each other.
            const forwardPressed = !!(keyboard['w'] || keyboard['arrowup']);
            const backPressed = !!(keyboard['s'] || keyboard['arrowdown']);
            const leftPressed = !!(keyboard['a'] || keyboard['arrowleft']);
            const rightPressed = !!(keyboard['d'] || keyboard['arrowright']);

            // Vertical (forward/back) net intent: only apply if exactly one of the pair is pressed.
            if (forwardPressed !== backPressed) {
                if (forwardPressed) {
                    moveDirection.add(cameraForward);
                } else {
                    moveDirection.sub(cameraForward);
                }
                moved = true;
            }

            // Horizontal (left/right) net intent: only apply if exactly one of the pair is pressed.
            if (leftPressed !== rightPressed) {
                if (leftPressed) {
                    moveDirection.add(cameraRight);
                } else {
                    moveDirection.sub(cameraRight);
                }
                moved = true;
            }
        } else if (inputLocked && (externalMovement.lengthSq() > 0 || externalRotation !== 0)) {
            // Apply external movement if input is locked
            moveDirection.copy(externalMovement);
            moved = true;
        }

        // Update any active projectile effects used by held items.
        for (let i = activeItemProjectiles.length - 1; i >= 0; i--) {
            const projectile = activeItemProjectiles[i];
            if (!projectile || !projectile.mesh) {
                activeItemProjectiles.splice(i, 1);
                continue;
            }

            projectile.life -= (typeof dt === 'number' ? dt : 16.6667) / 1000;
            if (projectile.velocity && projectile.velocity.lengthSq() > 0) {
                projectile.mesh.position.addScaledVector(projectile.velocity, (typeof dt === 'number' ? dt : 16.6667) / 1000 * 2.4);
            }

            if (projectile.type === 'oil') {
                projectile.velocity.y -= 0.035;
                projectile.mesh.rotation.x += 0.12;
                projectile.mesh.rotation.z += 0.09;
                if (projectile.life < 0.65 && projectile.mesh.material) {
                    projectile.mesh.material.opacity = Math.max(0, projectile.life / 0.65);
                }
            }

            if (projectile.type === 'oilPuddle') {
                const fadeStart = 2.3;
                if (projectile.life < fadeStart && projectile.mesh.material) {
                    projectile.mesh.material.opacity = Math.max(0, projectile.life / fadeStart) * 0.82;
                }
                projectile.mesh.scale.x += 0.002;
                projectile.mesh.scale.z += 0.002;
            }

            if (projectile.type === 'effect') {
                try {
                    const mat = projectile.mesh.material;
                    if (mat && typeof mat.opacity === 'number') mat.opacity = Math.max(0, mat.opacity - 0.025);
                } catch (e) {}
            }

            // Superball: gravity + bounce off ground and collidables
            if (projectile.type === 'superball') {
                const dt_s = 16.6667 / 1000;
                projectile.velocity.y -= 0.014; // gravity
                projectile.mesh.rotation.x += projectile.velocity.z * 0.4;
                projectile.mesh.rotation.z -= projectile.velocity.x * 0.4;

                // ground bounce
                if (projectile.mesh.position.y - projectile.radius <= 0) {
                    projectile.mesh.position.y = projectile.radius;
                    projectile.velocity.y = Math.abs(projectile.velocity.y) * 0.82;
                    projectile.velocity.x *= 0.94;
                    projectile.velocity.z *= 0.94;
                    projectile.bounces++;
                }

                // stop bouncing after too many bounces or very low energy
                if (projectile.bounces > 10 || (projectile.bounces > 3 && Math.abs(projectile.velocity.y) < 0.012)) {
                    projectile.life = 0;
                }
            }

            // Cartoon explosion: grow the puff/rings quickly, then fade them out.
            if (projectile.type === 'explosion') {
                const progress = 1 - Math.max(0, projectile.life) / projectile.maxLife;
                const scale = 0.35 + progress * 1.35;
                projectile.mesh.scale.setScalar(scale);
                projectile.mesh.rotation.y += 0.08;
                projectile.mesh.traverse((part) => {
                    if (part.material && typeof part.material.opacity === 'number') {
                        part.material.opacity = Math.max(0, 1 - progress);
                    }
                });
            }

            if (projectile.type === 'bomb' && projectile.life <= 0) {
                const explosionPosition = projectile.mesh.position.clone();
                const boom = new THREE.Group();
                const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a16, transparent: true, opacity: 1 });
                const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffe04b, transparent: true, opacity: 1 });
                const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0x46352f, transparent: true, opacity: 1 });

                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.11, 10, 24), ringMaterial);
                ring.rotation.x = Math.PI / 2;
                boom.add(ring);
                boom.add(new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), flashMaterial));
                // Uneven smoke puffs keep the explosion playful and visibly cartoon-like.
                for (let puffIndex = 0; puffIndex < 5; puffIndex++) {
                    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), smokeMaterial);
                    const angle = (puffIndex / 5) * Math.PI * 2;
                    puff.position.set(Math.cos(angle) * 0.42, 0.12 + (puffIndex % 2) * 0.18, Math.sin(angle) * 0.42);
                    puff.scale.set(1.1, 0.8, 1.1);
                    boom.add(puff);
                }
                boom.position.copy(explosionPosition);
                scene.add(boom);
                const explosionLife = 0.7;
                activeItemProjectiles.push({
                    mesh: boom,
                    velocity: new THREE.Vector3(0, 0, 0),
                    life: explosionLife,
                    maxLife: explosionLife,
                    type: 'explosion'
                });

                // The bomb is dangerous to its owner too. A close blast is lethal,
                // with a softer falloff at the edge of the three-stud blast radius.
                const distance = model.position.distanceTo(explosionPosition);
                const blastRadius = 3;
                if (distance <= blastRadius && hooks.onDamage) {
                    const damage = distance <= 2.1 ? 100 : Math.round(100 * (1 - distance / blastRadius));
                    hooks.onDamage(Math.max(1, damage));
                }
                // Broadcast explosion position via presence so other players receive blast damage
                try {
                    if (window._pendingPresence) {
                        window._pendingPresence.lastExplosion = { x: explosionPosition.x, y: explosionPosition.y, z: explosionPosition.z, t: Date.now() };
                    }
                } catch (e) {}
                try { if (projectile.mesh.parent) projectile.mesh.parent.remove(projectile.mesh); } catch (e) {}
                activeItemProjectiles.splice(i, 1);
                continue;
            }

            if (projectile.life <= 0) {
                try { if (projectile.mesh.parent) projectile.mesh.parent.remove(projectile.mesh); } catch (e) {}
                activeItemProjectiles.splice(i, 1);
            }
        }

        // Apply AABB Object Physics (STRICT Lua 5.1 Logic adaptation)
        resolvePhysics();

        // After physics resolved, detect landing events (transition from airborne -> grounded)
        // and compute fall damage from the pre-resolution vertical velocity.
        if (onGround && !previousOnGround) {
            const impactSpeed = Math.abs(prevVelocityY);
            const DAMAGE_THRESHOLD = pcfg.fallDamageThreshold;
            if (impactSpeed > DAMAGE_THRESHOLD && hooks.onDamage) {
                const extra = impactSpeed - DAMAGE_THRESHOLD;
                const damage = Math.min(100, Math.round(extra * 100));
                hooks.onDamage(damage);
            }
            // No landing hold: end jump pose immediately on landing
            landedHoldUntil = 0;

            // Begin a brief "landing slow" window so landing animations interpolate more slowly (smooth landing)
            // Use a modest duration (ms); tuned to be longer so landing feels slower (no artificial delay).
            landingSlowUntil = performance.now() + 700; // 700ms slower interpolation on landing
        }

        // CHECK FOR KILLBRICKS!1!!11! 
        // We check if our feet/body are touching any dangerous blocks...
        if (model && world.collidables) {
            const scale = 0.028;
            const pdims = pcfg.visuals.dimensions;
            const totalH = (pdims.legH + pdims.torsoH) * scale;
            const pBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(model.position.x, model.position.y + totalH/2, model.position.z),
                new THREE.Vector3(pdims.torsoW * scale, totalH, pdims.torsoD * scale)
            );

            // check the lava floor too
            const kf = scene.getObjectByName('KillFloor');
            const objectsToCheck = kf ? [...world.collidables, kf] : world.collidables;

            for (const obj of objectsToCheck) {
                if (obj.userData && obj.userData.isKillBrick) {
                    const objBox = new THREE.Box3().setFromObject(obj);
                    if (pBox.intersectsBox(objBox)) {
                        // Ouch!! Send a damage hook to main.js...
                        if (hooks.onDamage) hooks.onDamage(obj.userData.damage || 10);
                    }
                }
            }
        }

        // Determine "animation ground state": true only when physically on the ground AND the landing hold has expired.
        // This keeps jump pose for LANDING_HOLD_MS after landing.
        const now = performance.now();
        const animOnGround = onGround && now >= landedHoldUntil;

        if (moveDirection.lengthSq() > 0 || moved) { // Check moved flag for rotational requirement
            let targetQ = model.quaternion.clone();
            
            if (moveDirection.lengthSq() > 0) {
                moveDirection.normalize();
                // compute rotation using horizontal direction only (ignore Y) to avoid pitch/tilt when nudged upward
                const horizDir = moveDirection.clone();
                horizDir.y = 0;
                if (horizDir.lengthSq() > 1e-6) {
                    const m4 = new THREE.Matrix4();
                    m4.lookAt(model.position, model.position.clone().add(horizDir), model.up);
                    targetQ.setFromRotationMatrix(m4);
                    // If input is locked, rotation should be fast to align with script movement
                    const rotationFactor = player.rotationSpeed * 2;
                    model.quaternion.slerp(targetQ, rotationFactor);
                }
                model.position.add(moveDirection.multiplyScalar(player.speed));
            }
            
            // External rotation (turn left/right)
            if (inputLocked && externalRotation !== 0) {
                 // Adjust the rotation incrementally based on externalRotation value
                 model.rotation.y += externalRotation;
                 rotationApplied = true;
                 // Don't set moved=true if externalMovement is zero, unless rotation alone is sufficient for walking sound. 
                 // Since the scripted sequence involves actual movement/turning, moved=true is fine here if external movement is nonzero.
            }
        }
        
        



        // Use animation ground state to decide airborne vs ground animations.
        isWalking = moved;
        
        // --- Animation Logic ---
        
        const parts = model.userData.animationParts;
        if (parts) {
            let targetLA = 0, targetRA = 0, targetLL = 0, targetRL = 0;

            if (!animOnGround) {
                const jumpRotation = panim.jumpRotation;

                // Compute an independent jump rotation for each arm based on the nearest forward path.
                // Use the explicit playerTarget if set (click-to-walk), otherwise fall back to camera forward.
                // This ensures each arm computes its own rotation path from its pivot to the reference
                // and does NOT reuse a shared rotation value.
                const computeArmJumpRotation = (armPivot) => {
                    try {
                        // world position of the arm pivot
                        const pivotWorldPos = new THREE.Vector3();
                        armPivot.getWorldPosition(pivotWorldPos);

                        // reference direction: prefer playerTarget (point in world), otherwise camera forward
                        let refVec = new THREE.Vector3();
                        if (playerTarget) {
                            refVec.subVectors(playerTarget, pivotWorldPos);
                        } else {
                            camera.getWorldDirection(refVec);
                        }
                        refVec.y = 0; // only horizontal direction matters
                        if (refVec.lengthSq() === 0) return jumpRotation;
                        refVec.normalize();

                        // Determine sign based on forward/back component (z). We want arms to raise
                        // "forward" relative to the path they will follow. Use the sign of -refVec.z
                        // so positive value means rotate forward (towards -X local arm orientation).
                        const forwardSign = Math.sign(-refVec.z) || 1;

                        // Return an arm-specific jump rotation (preserves magnitude but allows direction)
                        return jumpRotation * forwardSign;
                    } catch (e) {
                        return jumpRotation;
                    }
                };

                // Independent per-arm targets — always apply jump pose to the arm pivots while airborne,
                // including the arm that is holding a tool (so jump overrides hold pose).
                targetLA = computeArmJumpRotation(parts.leftArmPivot);
                targetRA = computeArmJumpRotation(parts.rightArmPivot);

                targetLL = 0;
                targetRL = 0;

                // Stop walk animation time calculation while airborne
                animationTime = 0;
            } else {
                let currentSpeed = panim.walkSpeed;
                let amplitude = panim.walkSwingMax;

                if (!isWalking) {
                    currentSpeed = panim.idleSpeed;
                    amplitude = panim.idleSwingMax;
                }
                
                animationTime += currentSpeed;
                if (animationTime > 2 * Math.PI) {
                    animationTime -= 2 * Math.PI;
                }

                const swing = Math.sin(animationTime) * amplitude;
                
                targetLL = swing;
                targetRL = -swing;
                targetLA = -swing;
                
                // If holding a tool, right arm stays in pointing pose during walk/idle
                if (currentHeldItemId) {
                    targetRA = Math.PI / 2;
                } else {
                    targetRA = swing; 
                }
            }

            // A sword attack sweeps the arm through a full, fast arc and uses
            // the off-hand as a counterbalance for a more convincing slice.
            if (currentHeldItemId === 'sword' && swordSwingStartTime) {
                const swordProgress = Math.min(1, (performance.now() - swordSwingStartTime) / SWORD_SWING_DURATION);
                if (swordProgress < 1) {
                    const swordArc = Math.sin(swordProgress * Math.PI);
                    targetRA = Math.PI / 2 - swordArc * 2.35;
                    targetLA = swordArc * 0.55;
                } else {
                    swordSwingStartTime = 0;
                }
            }
            
            // enhanced arm smoothing: dynamic smoothing that slows small remaining rotations during landing/jump
            const computeDynamicArmSmooth = (current, target, baseSmooth, isAirborne = false) => {
                try {
                    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
                    const landingFactor = (now < (landingSlowUntil || 0)) ? 0.4 : 1.0;
                    const delta = Math.abs(target - current);
                    const maxDelta = (panim && panim.jumpRotation) ? Math.abs(panim.jumpRotation) : Math.PI;
                    const normalized = Math.min(1, delta / Math.max(1e-6, maxDelta));
                    const dynamicFactor = 0.25 + 0.75 * normalized;
                    // Speed up airborne arm movement only (jump) by scaling the base smoothing factor.
                    const AIRBORNE_SPEED_MULT = isAirborne ? 1.6 : 1.0;
                    return baseSmooth * AIRBORNE_SPEED_MULT * dynamicFactor * landingFactor;
                } catch (e) {
                    return baseSmooth;
                }
            };

            parts.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
                parts.leftArmPivot.rotation.x,
                targetLA,
                // dynamic smoothing makes small remaining rotations move slower during jump/landing
                computeDynamicArmSmooth(parts.leftArmPivot.rotation.x, targetLA, panim.armSmoothing)
            );
            // Apply the same dynamic smoothing to the right arm
            parts.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
                parts.rightArmPivot.rotation.x,
                targetRA,
                computeDynamicArmSmooth(parts.rightArmPivot.rotation.x, targetRA, panim.armSmoothing)
            );
            
            // Alignment fix: Lower the right arm pivot when holding an item so it doesn't exceed torso height
            const shoulderY = pdims.legH + pdims.torsoH;
            const itemOffset = pdims.armD / 2;
            const targetY = currentHeldItemId ? (shoulderY - itemOffset) : shoulderY;
            const targetZ = currentHeldItemId ? itemOffset : (originalRightArmPivotZ || 0);

            // If airborne (jump animation active) clear the hold pivot by using the original pivot Y/Z so hold pose doesn't persist.
            // When landing (animOnGround true) we lerp back toward the hold pivot target.
            if (!animOnGround) {
                // Lower both arm pivots in-air so the arms reach halfway toward the torso.
                try {
                    const torsoH = (pdims && pdims.torsoH) ? pdims.torsoH : 0;
                    if (originalRightArmPivotY !== null) {
                        parts.rightArmPivot.position.y = originalRightArmPivotY - (torsoH * 0.5);
                    }
                    if (originalRightArmPivotZ !== null) {
                        parts.rightArmPivot.position.z = originalRightArmPivotZ;
                    }
                    if (originalLeftArmPivotY !== null) {
                        parts.leftArmPivot.position.y = originalLeftArmPivotY - (torsoH * 0.5);
                    }
                    if (originalLeftArmPivotZ !== null) {
                        parts.leftArmPivot.position.z = originalLeftArmPivotZ;
                    }
                } catch (e) {
                    // fallback: restore originals if something went wrong
                    if (originalRightArmPivotY !== null) parts.rightArmPivot.position.y = originalRightArmPivotY;
                    if (originalLeftArmPivotY !== null) parts.leftArmPivot.position.y = originalLeftArmPivotY;
                }
            } else {
                // Use linear smoothing for pivot position (avoid instant snap on equip) but respect landing slow window
                const posSmoothBase = panim.armSmoothing || 0.42;
                const posLandingFactor = (now < (landingSlowUntil || 0)) ? 0.5 : 1.0;
                const posSmooth = posSmoothBase * posLandingFactor;
                parts.rightArmPivot.position.y = THREE.MathUtils.lerp(parts.rightArmPivot.position.y, targetY, posSmooth);
                parts.rightArmPivot.position.z = THREE.MathUtils.lerp(parts.rightArmPivot.position.z, targetZ, posSmooth);

                // Restore/lerp left arm pivot toward its original when landing
                try {
                    const leftTargetY = originalLeftArmPivotY !== null ? originalLeftArmPivotY : parts.leftArmPivot.position.y;
                    const leftTargetZ = originalLeftArmPivotZ !== null ? originalLeftArmPivotZ : parts.leftArmPivot.position.z;
                    parts.leftArmPivot.position.y = THREE.MathUtils.lerp(parts.leftArmPivot.position.y, leftTargetY, posSmooth);
                    parts.leftArmPivot.position.z = THREE.MathUtils.lerp(parts.leftArmPivot.position.z, leftTargetZ, posSmooth);
                } catch (e) {}
            }

            // Legs should also interpolate a bit slower during the landing window for a smoother touchdown feel
            const legSmoothingBase = panim.smoothing || 0.3;
            const legLandingFactor = (now < (landingSlowUntil || 0)) ? 0.4 : 1.0;
            const legSmooth = legSmoothingBase * legLandingFactor;
            parts.leftLegPivot.rotation.x = THREE.MathUtils.lerp(parts.leftLegPivot.rotation.x, targetLL, legSmooth);
            parts.rightLegPivot.rotation.x = THREE.MathUtils.lerp(parts.rightLegPivot.rotation.x, targetRL, legSmooth);
        }

        // walking sound
        if (isWalking && !walkingNode) {
            walkingNode = playSound('walk', true);
        } else if (!isWalking && walkingNode) {
            try { walkingNode.stop(0); } catch(e) {}
            try { walkingNode.disconnect(); } catch(e){}
            walkingNode = null;
        }
    }

    

    // Add smoothed look-at target to avoid abrupt camera snaps when head position changes (jump/teleport)
    let _smoothedLookAt = new THREE.Vector3();

    function updateCamera() {
        if (!model) return;

        // First-person: camera sits at head, looks along fpYaw/fpPitch
        if (firstPersonActive) {
            let headPos = new THREE.Vector3();
            try {
                const head = model.getObjectByName('Head');
                if (head) head.getWorldPosition(headPos);
                else { headPos.copy(model.position); headPos.y += 0.14; }
            } catch (e) {
                headPos.copy(model.position); headPos.y += 0.14;
            }
            camera.position.copy(headPos);
            // build look direction from yaw + pitch
            const lookDir = new THREE.Vector3(
                Math.sin(fpYaw) * Math.cos(fpPitch),
                Math.sin(fpPitch),
                Math.cos(fpYaw) * Math.cos(fpPitch)
            );
            camera.lookAt(headPos.clone().add(lookDir));
            // also keep player body facing the look direction
            if (model) model.rotation.y = fpYaw;
            cameraState.skipLerp = false;
            return;
        }

        // Determine head position (preferred) or fall back to a fixed offset above the model
        let headPos = new THREE.Vector3();
        try {
            const head = model.getObjectByName('Head');
            if (head) head.getWorldPosition(headPos);
            else { headPos.copy(model.position); headPos.y += 1.6; }
        } catch (e) {
            headPos.copy(model.position);
            headPos.y += 1.6;
        }

        // compute spherical offset from head using radius, angle (azimuth) and pitch (elevation)
        const r = cameraState.radius;
        const pitch = cameraState.pitch;
        const horizRadius = r * Math.cos(pitch);
        const desiredPos = new THREE.Vector3();
        desiredPos.x = headPos.x + horizRadius * Math.sin(cameraState.angle);
        desiredPos.z = headPos.z + horizRadius * Math.cos(cameraState.angle);

        // vertical position uses both base height and pitch vertical offset anchored to head
        const h = Math.min(cameraState.MAX_HEIGHT, Math.max(cameraState.MIN_HEIGHT, cameraState.heightBase + cameraState.heightOffset));
        const desiredY = headPos.y + h + r * Math.sin(pitch);
        desiredPos.y = desiredY;

        // Immediately set camera to desired transform (remove spring/lerp behavior entirely)
        camera.position.copy(desiredPos);
        camera.lookAt(headPos);

        // Clear skipLerp so other code may still toggle it without side-effects
        cameraState.skipLerp = false;
    }

    // input
    const canvas = document.getElementById('game-canvas');

    // Cursor constants & helper to ensure consistent cursor switching across handlers
    const CURSOR_WALK = "url('./ArrowCursor.png'), auto";
    const CURSOR_FAR = "url('./ArrowFarCursor.png'), auto";
    function setCanvasCursor(cursorStr) {
        try { canvas.style.cursor = cursorStr; } catch (e) {}
    }

    function updateCanvasCursor() {
        if (shiftLockActive) {
            setCanvasCursor('none');
            return;
        }
        // click-to-walk is available when there's a ground, input is not locked, and the player is NOT holding a tool
        const clickToWalkAvailable = !!world.ground && !inputLocked && !currentHeldItemId;
        setCanvasCursor(clickToWalkAvailable ? CURSOR_WALK : CURSOR_FAR);
    }

    function toggleShiftLock() {
        if (inputLocked || !canvas) return;
        if (document.pointerLockElement === canvas || shiftLockActive) {
            try { document.exitPointerLock(); } catch (e) {}
            shiftLockActive = false;
            updateCanvasCursor();
            return;
        }
        try {
            const lockRequest = canvas.requestPointerLock();
            if (lockRequest && typeof lockRequest.catch === 'function') lockRequest.catch(() => {});
        } catch (e) {}
    }

    document.addEventListener('pointerlockchange', () => {
        shiftLockActive = document.pointerLockElement === canvas;
        updateCanvasCursor();
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Control') {
            if (!e.repeat) {
                e.preventDefault();
                toggleShiftLock();
            }
            return;
        }
        if (inputLocked) return; // Ignore input when locked
        const k = e.key.toLowerCase();
        keyboard[k] = true;
        if (e.code === 'Space') keyboard['space'] = true;
        if (playerTarget && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
            playerTarget = null;
            if (targetIndicator) targetIndicator.visible = false;
        }
    });
    window.addEventListener('keyup', (e) => {
        if (inputLocked) return; // Ignore input when locked
        keyboard[e.key.toLowerCase()] = false;
        if (e.code === 'Space') keyboard['space'] = false;
    });
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') tryJump();
        if (e.code === 'KeyI' && !firstPersonActive) {
            firstPersonActive = true;
            fpYaw = cameraState.angle + Math.PI;
            fpPitch = 0;
            if (model) model.traverse(n => { if (n.isMesh) n.layers.set(1); });
            // request pointer lock so mouse moves freely without leaving window
            try {
                const lockReq = canvas.requestPointerLock();
                if (lockReq && typeof lockReq.catch === 'function') lockReq.catch(() => {});
            } catch (e) {}
        }
        if (e.code === 'KeyO' && firstPersonActive) {
            firstPersonActive = false;
            if (model) model.traverse(n => { if (n.isMesh) n.layers.set(0); });
            try { document.exitPointerLock(); } catch (e) {}
        }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Use Pointer Events with pointer capture so fast drags never lose tracking.
    let isRightPointerDown = false;
    let shiftLockActive = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    canvas.addEventListener('pointerdown', (e) => {
        // Only handle primary/secondary button when input allowed.
        // Allow right-button pointer (camera orbit) even when input is locked so camera can move while dead.
        if (inputLocked && e.button !== 2) return;
        updateCanvasCursor();

        // Right button drag for camera orbit (button === 2)
        if (e.button === 2) {
            // capture the pointer so we continue receiving pointermove even if cursor leaves the canvas
            try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
            isRightPointerDown = true;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            return;
        }

        // Left button: click-to-walk behavior
        if (e.button === 0) {
            // If holding a tool, disable click-to-walk entirely (left-click should not set a walk target)
            if (currentHeldItemId) {
                const { ndcX, ndcY } = clientToNDC(canvas, e.clientX, e.clientY);
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
                const targets = (world.collidables || []).slice();
                if (world.ground) targets.push(world.ground);
                const intersects = targets.length > 0 ? raycaster.intersectObjects(targets, true) : [];
                const hit = intersects && intersects.length > 0 ? intersects[0] : null;
                let hitNormal = null;
                if (hit && hit.face) {
                    try {
                        hitNormal = hit.face.normal.clone()
                            .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
                            .normalize();
                    } catch (err) {}
                }
                useHeldItem(hit ? hit.point.clone() : null, hitNormal);
                setCanvasCursor(CURSOR_FAR);
                return;
            }

            playSound('click');
            const { ndcX, ndcY } = clientToNDC(canvas, e.clientX, e.clientY);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
            const targets = (world.collidables || []).slice();
            if (world.ground) targets.push(world.ground);
            const intersects = targets.length > 0 ? raycaster.intersectObjects(targets, true) : [];
            if (intersects && intersects.length > 0) {
                const hit = intersects[0];
                let worldNormalY = 0;
                try {
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                    const worldNormal = hit.face && hit.face.normal ? hit.face.normal.clone().applyMatrix3(normalMatrix).normalize() : new THREE.Vector3(0, 1, 0);
                    worldNormalY = worldNormal.y;
                } catch (err) {
                    worldNormalY = 0;
                }

                const MIN_UP_Y = 0.2;
                if (worldNormalY >= MIN_UP_Y) {
                    const p = hit.point.clone();
                    playerTarget = p;
                    if (targetIndicator) {
                        targetIndicator.position.copy(playerTarget);
                        targetIndicator.position.y = playerTarget.y + 0.05;
                        targetIndicator.visible = true;
                    }
                    Object.keys(keyboard).forEach(k => keyboard[k] = false);
                    setCanvasCursor(CURSOR_WALK);
                } else {
                    if (targetIndicator) targetIndicator.visible = false;
                    setCanvasCursor(CURSOR_FAR);
                }
            } else {
                setCanvasCursor(CURSOR_FAR);
            }
        }
    }, { passive: true });

    // Pointer move handler on the canvas so pointer capture delivers moves even when moving fast.
    canvas.addEventListener('pointermove', (e) => {
        // Allow pointermove camera orbit to continue when input is locked (right-button drag),
        // but block other pointer interactions when input is locked.
        if (inputLocked && !isRightPointerDown) return;
        if (!isRightPointerDown) return;

        const deltaX = (e.clientX - lastPointerX);
        const deltaY = (e.clientY - lastPointerY);

        // Classic 2007-like sensitivities (tuned)
        const HORIZ_SENS = 0.009;
        const VERT_SENS = 0.007;

        // Horizontal orbit
        const horizDelta = deltaX * HORIZ_SENS;
        cameraState.angle -= horizDelta;

        // Vertical pitch: drag up -> look up (adjust sign as original)
        cameraState.pitch += deltaY * VERT_SENS;
        cameraState.pitch = Math.max(cameraState.MIN_PITCH, Math.min(cameraState.MAX_PITCH, cameraState.pitch));

        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
    }, { passive: true });

    // Release pointer capture and clear state on pointerup.
    canvas.addEventListener('pointerup', (e) => {
        if (e.button === 2) {
            try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
            isRightPointerDown = false;
        }
    }, { passive: true });

    // Fallback: listen for window pointerup so we definitely clear state if capture wasn't supported.
    window.addEventListener('pointerup', (e) => {
        if (e.button === 2) isRightPointerDown = false;
    }, { passive: true });

    canvas.addEventListener('mousemove', (e) => {
        if (shiftLockActive) return;
        if (inputLocked) return; // Ignore input when locked

        // If holding a tool, disable click-to-walk hover behavior and always show the far cursor
        if (currentHeldItemId) {
            if (targetIndicator) targetIndicator.visible = false;
            setCanvasCursor(CURSOR_FAR);
            return;
        }

        if (!model || playerTarget) {
            if (targetIndicator && !playerTarget) targetIndicator.visible = false;
            return;
        }
        const { ndcX, ndcY } = clientToNDC(canvas, e.clientX, e.clientY);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
        // Raycast against all collidable objects (so hovering over boxes/spawn pads registers)
        const targets = (world.collidables || []).slice();
        if (world.ground) targets.push(world.ground);
        const hits = targets.length > 0 ? raycaster.intersectObjects(targets, true) : [];
        if (hits && hits.length > 0) {
            const hit = hits[0];
            // compute world-space normal to ignore vertical faces (walls)
            let worldNormalY = 0;
            try {
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                const worldNormal = hit.face && hit.face.normal ? hit.face.normal.clone().applyMatrix3(normalMatrix).normalize() : new THREE.Vector3(0, 1, 0);
                worldNormalY = worldNormal.y;
            } catch (err) {
                worldNormalY = 0;
            }

            const MIN_UP_Y = 0.2; // allow slopes while blocking near-vertical walls
            if (worldNormalY >= MIN_UP_Y) {
                const point = hit.point;
                targetIndicator.position.copy(point);
                // Place indicator just above the surface we hit
                targetIndicator.position.y = point.y + 0.05;
                targetIndicator.visible = true;
                // show walk cursor when hovering a valid (mostly horizontal) target
                setCanvasCursor(CURSOR_WALK);
            } else {
                // vertical/steep surface - hide indicator and show far cursor
                if (targetIndicator) targetIndicator.visible = false;
                setCanvasCursor(CURSOR_FAR);
            }
        } else {
            if (targetIndicator) targetIndicator.visible = false;
            // show empty/far cursor when there's nothing selectable under pointer
            setCanvasCursor(CURSOR_FAR);
        }
    });

    // Pointer lock sends relative mouse movement while the cursor is hidden.
    document.addEventListener('mousemove', (e) => {
        if (firstPersonActive) {
            const SENS = 0.0025;
            fpYaw   -= (e.movementX || 0) * SENS;
            fpPitch -= (e.movementY || 0) * SENS;
            fpPitch  = Math.max(FP_PITCH_MIN, Math.min(FP_PITCH_MAX, fpPitch));
            // rotate player body to match yaw
            if (model) model.rotation.y = fpYaw;
            return;
        }
        if (!shiftLockActive || inputLocked) return;
        const HORIZ_SENS = 0.009;
        const VERT_SENS = 0.007;
        cameraState.angle -= (e.movementX || 0) * HORIZ_SENS;
        cameraState.pitch += (e.movementY || 0) * VERT_SENS;
        cameraState.pitch = Math.max(cameraState.MIN_PITCH, Math.min(cameraState.MAX_PITCH, cameraState.pitch));
    }, { passive: true });

    canvas.addEventListener('wheel', (e) => {
        if (inputLocked) return; // Ignore input when locked
        e.preventDefault();
        playSound('roblox_click');

        // Snap wheel-based zoom to 10 discrete steps between MIN_RADIUS and MAX_RADIUS.
        const MIN = cameraState.MIN_RADIUS;
        const MAX = cameraState.MAX_RADIUS;
        const STEPS = 10; // total discrete positions
        const stepSize = (MAX - MIN) / (STEPS - 1); // difference per step

        // Compute current closest step index
        const currentIndex = Math.round((cameraState.radius - MIN) / stepSize);

        // Wheel direction: positive deltaY => zoom out (increase radius), negative => zoom in
        const direction = e.deltaY > 0 ? 1 : -1;
        const nextIndex = Math.min(STEPS - 1, Math.max(0, currentIndex + direction));

        // Only update if changed
        if (nextIndex !== currentIndex) {
            cameraState.radius = MIN + nextIndex * stepSize;
            // keep height base tied to radius
            cameraState.heightBase = cameraState.radius * cameraState.HEIGHT_RATIO;
            // immediate visual response requested for wheel input: skip smoothing for the next camera update
            cameraState.skipLerp = true;
        }
    }, { passive: false });

    // build initial target indicator and model
    createTargetIndicator();
    model = createModel();
    model.position.y = 0.3;
    scene.add(model);
    // Activate the 5 second translucent respawn aura on initial spawn.
    forcefieldStartTime = performance.now();
    forcefieldEndTime = forcefieldStartTime + RESPAWN_AURA_DURATION;
    camera.lookAt(model.position);
    // ensure cursor state reflects current availability
    updateCanvasCursor();

    // expose helpers for UI
    function adjustZoom(delta) {
        // Only change radius (zoom) and do NOT mutate camera height limits or heightBase.
        cameraState.radius = Math.min(cameraState.MAX_RADIUS, Math.max(cameraState.MIN_RADIUS, cameraState.radius + delta));
        // Do not alter cameraState.heightBase so UI controls don't shift camera limits.
        cameraState.skipLerp = true;
    }
    function adjustPan(delta) {
        // Map the on-screen pan buttons to 10 discrete pitch steps between MIN_PITCH and MAX_PITCH.
        // delta is expected to be positive for "pan up" and negative for "pan down" (as provided by UI).
        const STEPS = 10;
        const minP = cameraState.MIN_PITCH;
        const maxP = cameraState.MAX_PITCH;
        const stepSize = (maxP - minP) / Math.max(1, (STEPS - 1));

        // Determine current nearest step index
        const currentIndex = Math.round((cameraState.pitch - minP) / stepSize);

        // Determine direction: +1 for positive delta, -1 for negative delta, 0 otherwise
        const dir = delta === 0 ? 0 : (delta > 0 ? 1 : -1);

        const nextIndex = Math.min(STEPS - 1, Math.max(0, currentIndex + dir));
        cameraState.pitch = minP + nextIndex * stepSize;

        // Ensure immediate visual response for button press
        cameraState.skipLerp = true;
    }
    
    function getPosition() {
        return model ? model.position.clone() : new THREE.Vector3(0, 0, 0);
    }
    
    function getCameraAngle() {
        return cameraState.angle;
    }

    // Use the currently selected held item in a visible, world-interactive way.
    function useHeldItem(targetPoint = null, targetNormal = null) {
        if (!model || !currentHeldItemId || !scene) return false;
        const now = performance.now();
        if (now - lastItemUseTime < 180) return false;
        lastItemUseTime = now;

        const itemId = currentHeldItemId;
        const origin = model.position.clone();
        origin.y += 1.25;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() === 0) forward.set(0, 0, -1);
        forward.normalize();

        const spawnProjectile = (type, color, size, speed, life, localOffset = new THREE.Vector3(0, 0, 0)) => {
            const proj = new THREE.Mesh(
                new THREE.SphereGeometry(size, 12, 12),
                new THREE.MeshStandardMaterial({
                    color,
                    emissive: color,
                    emissiveIntensity: 0.45,
                    roughness: 0.35,
                    metalness: 0.15
                })
            );
            proj.castShadow = true;
            proj.receiveShadow = true;
            proj.position.copy(origin).add(localOffset);
            scene.add(proj);
            activeItemProjectiles.push({
                mesh: proj,
                velocity: forward.clone().multiplyScalar(speed),
                life,
                type,
                color
            });
            return proj;
        };

        // Broadcast combat events to other players via presence
        const _broadcastCombat = (itemId, origin, forward) => {
            try {
                if (!window._pendingPresence) return;
                if (itemId === 'sword') {
                    const SWORD_RANGE = 1.8;
                    const swingPos = origin.clone().add(forward.clone().multiplyScalar(SWORD_RANGE * 0.5));
                    window._pendingPresence.lastSwordHit = { x: swingPos.x, y: swingPos.y, z: swingPos.z, t: Date.now(), dmg: 40 };
                } else if (itemId === 'missile') {
                    window._pendingPresence.lastProjectile = { px: origin.x, py: origin.y, pz: origin.z, vx: forward.x * 2.6, vy: 0, vz: forward.z * 2.6, projType: 'bullet', t: Date.now() };
                } else if (itemId === 'bomb') {
                    window._pendingPresence.lastProjectile = { px: origin.x, py: origin.y, pz: origin.z, vx: forward.x * 0.24, vy: 0, vz: forward.z * 0.24, projType: 'bomb', t: Date.now() };
                } else if (itemId === 'slingshot') {
                    window._pendingPresence.lastProjectile = { px: origin.x, py: origin.y, pz: origin.z, vx: forward.x * 0.42, vy: 0, vz: forward.z * 0.42, projType: 'marble', t: Date.now() };
                } else if (itemId === 'marbles') {
                    window._pendingPresence.lastProjectile = { px: origin.x, py: origin.y, pz: origin.z, vx: forward.x * 0.85, vy: 0.22, vz: forward.z * 0.85, projType: 'superball', t: Date.now() };
                }
            } catch (e) {}
        };
        _broadcastCombat(itemId, origin, forward);

        switch (itemId) {
            case 'sword': {
                swordSwingStartTime = now;
                const slash = new THREE.Mesh(
                    new THREE.TorusGeometry(0.8, 0.06, 8, 24),
                    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
                );
                slash.position.copy(origin).add(forward.clone().multiplyScalar(0.8));
                slash.rotation.x = Math.PI / 2;
                slash.rotation.z = Math.PI / 2;
                scene.add(slash);
                activeItemProjectiles.push({ mesh: slash, velocity: new THREE.Vector3(0, 0, 0), life: 0.18, type: 'effect' });
                playSound('click');
                return true;
            }
            case 'slingshot': {
                spawnProjectile('marble', 0xffffff, 0.12, 0.42, 1.3, new THREE.Vector3(0, 0.05, 0));
                playSound('roblox_click');
                return true;
            }
            case 'missile': {
                // Gun bullets are bright yellow streaks: fast, simple, and easy
                // to read against the world instead of slow rocket cones.
                const bulletGeometry = new THREE.BoxGeometry(0.055, 0.055, 0.78);
                const bullet = new THREE.Mesh(
                    bulletGeometry,
                    new THREE.MeshBasicMaterial({ color: 0xffff22 })
                );
                const launcherOrigin = new THREE.Vector3();
                if (heldItemModel) {
                    try {
                        // Use the launcher bounds so the bullet visibly leaves
                        // the gun instead of spawning from the character center.
                        new THREE.Box3().setFromObject(heldItemModel).getCenter(launcherOrigin);
                    } catch (e) {
                        launcherOrigin.copy(origin);
                    }
                } else {
                    launcherOrigin.copy(origin);
                }
                bullet.position.copy(launcherOrigin).add(forward.clone().multiplyScalar(0.28));
                bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
                scene.add(bullet);
                activeItemProjectiles.push({ mesh: bullet, velocity: forward.clone().multiplyScalar(2.6), life: 0.7, type: 'bullet' });
                playSound('roblox_click');
                return true;
            }
            case 'brick': {
                const buildData = placeBuild(scene, targetPoint, targetNormal, world);
                if (!buildData) return false;
                if (window._pendingPresence) {
                    window._pendingPresence.lastBuild = buildData;
                }
                playSound('click');
                return true;
            }
            case 'bomb': {
                const bomb = new THREE.Mesh(
                    new THREE.SphereGeometry(0.28, 12, 12),
                    new THREE.MeshStandardMaterial({ color: 0x121212, emissive: 0x330000, roughness: 0.5 })
                );
                bomb.position.copy(origin).add(new THREE.Vector3(0, 0.06, 0));
                bomb.castShadow = true;
                bomb.receiveShadow = true;
                scene.add(bomb);
                activeItemProjectiles.push({ mesh: bomb, velocity: forward.clone().multiplyScalar(0.24), life: 1.15, type: 'bomb' });
                return true;
            }
            case 'marbles': {
                // Big bouncy studded ball — spawns from right arm, physics-based bounce
                const MARBLE_COLORS = [0xff3333, 0x33aaff, 0xffdd00, 0x44ee44, 0xff88ff, 0xff8800, 0x00ffee];
                const ballColor = MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)];
                const ballRadius = 0.32;

                // Spawn from right arm world position
                let ballOrigin = origin.clone();
                try {
                    const parts = model.userData.animationParts;
                    if (parts && parts.rightArmPivot) {
                        parts.rightArmPivot.getWorldPosition(ballOrigin);
                        ballOrigin.y -= 0.05; // hand position (bottom of arm)
                    }
                } catch (e) {}

                // Stud texture on the ball
                const textureLoader = new THREE.TextureLoader();
                const ballGeo = new THREE.SphereGeometry(ballRadius, 16, 16);
                const ballMat = new THREE.MeshStandardMaterial({
                    color: ballColor,
                    emissive: ballColor,
                    emissiveIntensity: 0.12,
                    roughness: 0.45,
                    metalness: 0.08
                });
                // overlay stud pattern
                try {
                    const studTex = textureLoader.load('./Studs_Texture.png', (t) => {
                        t.wrapS = THREE.RepeatWrapping;
                        t.wrapT = THREE.RepeatWrapping;
                        t.repeat.set(3, 3);
                        t.needsUpdate = true;
                    });
                    ballMat.map = studTex;
                } catch (e) {}

                const ball = new THREE.Mesh(ballGeo, ballMat);
                ball.castShadow = true;
                ball.receiveShadow = true;
                ball.position.copy(ballOrigin);
                scene.add(ball);

                // launch toward camera forward with slight upward arc
                const launchVel = forward.clone().multiplyScalar(0.85);
                launchVel.y += 0.22;

                activeItemProjectiles.push({
                    mesh: ball,
                    velocity: launchVel,
                    life: 6.0,
                    maxLife: 6.0,
                    type: 'superball',
                    bounces: 0,
                    radius: ballRadius
                });
                playSound('roblox_click');
                return true;
            }
            default:
                return false;
        }
    }

    // New functions for scripted sequence control
    function lockInput(lock) {
        if (lock && shiftLockActive) {
            try { document.exitPointerLock(); } catch (e) {}
            shiftLockActive = false;
        }
        inputLocked = lock;
        // Clear keyboard state and external movement/rotation when locking input to ensure a clean start/stop
        externalMovement.set(0, 0, 0);
        externalRotation = 0;
        if (lock) Object.keys(keyboard).forEach(k => keyboard[k] = false);
        updateCanvasCursor();
    }
    
    function applyExternalMovement(moveVector, rotationDelta) {
        externalMovement.copy(moveVector);
        externalRotation = rotationDelta || 0;
    }

    /**
     * Equips a tool by loading its GLB model and attaching it to the player's hand.
     */
    async function setHeldItem(itemId) {
        // increment token so any in-flight loads started earlier become stale
        heldItemLoadToken++;
        const myToken = heldItemLoadToken;

        // If the selection is identical to current and no pending load, do nothing
        if (currentHeldItemId === itemId && !heldItemModel) {
            currentHeldItemId = itemId;
            return;
        }

        currentHeldItemId = itemId;

        // Immediately remove any existing held model so UI updates fast and we avoid duplicates
        if (heldItemModel) {
            try { if (heldItemModel.parent) heldItemModel.parent.remove(heldItemModel); } catch (e) {}
            heldItemModel = null;
        }

        // If unequipping or item has no model, clear state and return
        if (!itemId || !ITEM_DATA[itemId] || !ITEM_DATA[itemId].model) {
            // ensure presence/others see null held item; caller handles presence update
            return;
        }

        const itemInfo = ITEM_DATA[itemId];
        const loader = new GLTFLoader();

        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load(itemInfo.model, resolve, undefined, reject);
            });

            // If another setHeldItem call happened while we were loading, abort attaching this load
            if (myToken !== heldItemLoadToken) {
                // stale load: dispose/cleanup loaded scene if possible and bail
                try {
                    if (gltf && gltf.scene && gltf.scene.parent) gltf.scene.parent.remove(gltf.scene);
                } catch (e) {}
                return;
            }

            const itemMesh = gltf.scene;
            
            // Roblox tools are typically held in the Right Arm.
            const parts = model && model.userData && model.userData.animationParts;
            if (!parts || !parts.rightArmPivot) return;

            const rightArmMesh = parts.rightArmPivot.getObjectByName('RightArmMesh');
            // If right arm mesh is not present, abort (no attachment point)
            if (!rightArmMesh) return;

            // Dimensions and scaling heuristics
            const pdims = PlayerModule.getConfig().visuals.dimensions;
            const armH = pdims.armH || 31.9328;
            
            // Compute model size and scale it uniformly to match the arm width (no stretching)
            try {
                const bbox = new THREE.Box3().setFromObject(itemMesh);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
                // Scale tool so its largest dimension is proportional to the arm width (approx 85%)
                const heldItemScale = itemId === 'sword' ? 1.45 : 1;
                const targetScale = ((pdims.armW * 0.85) / (maxDim || 1)) * heldItemScale;
                itemMesh.scale.setScalar(targetScale);
            } catch (e) {
                // If sizing fails, continue with default scale
                try { itemMesh.scale.setScalar(1); } catch (ex) {}
            }
            
            // Position at the bottom center of the arm mesh (the "hand" location)
            itemMesh.position.set(0, -armH / 2, 0);
            
            // Correction for tool orientation: align to expected pose
            itemMesh.rotation.set(Math.PI / 2, 0, 0);

            // Attach and keep reference
            rightArmMesh.add(itemMesh);
            heldItemModel = itemMesh;

            // Ensure tool casts/receives shadows where applicable
            itemMesh.traverse(n => {
                if (n.isMesh) {
                    n.castShadow = true;
                    n.receiveShadow = true;
                }
            });

            // Double-check token again after attaching in case a newer equip happened synchronously
            if (myToken !== heldItemLoadToken) {
                // A newer setHeldItem ran; remove this model to avoid stale visual
                try { if (heldItemModel && heldItemModel.parent) heldItemModel.parent.remove(heldItemModel); } catch (e) {}
                heldItemModel = null;
            }
        } catch (err) {
            // Only warn if this load is still the most recent request
            if (myToken === heldItemLoadToken) console.warn('Failed to load tool model:', itemInfo.model, err);
        }
    }

    // Reset player for respawn!1!1!
    function respawn(pos) {
        if (!model) return;
        model.position.copy(pos);
        velocityY = 0;
        onGround = true;
        deathFlingActive = false;
        deathFlingVelocity.set(0, 0, 0);
        deathFlingSpin.set(0, 0, 0);
        model.rotation.x = 0;
        model.rotation.z = 0;
        playerTarget = null;
        if (targetIndicator) targetIndicator.visible = false;
        // kill the landing delay so they dont stand weirdly
        landedHoldUntil = 0;
        


        // Trigger the 5 second translucent respawn aura.
        forcefieldStartTime = performance.now();
        forcefieldEndTime = forcefieldStartTime + RESPAWN_AURA_DURATION;
        if (model.userData) model.userData.respawnAuraStartTime = forcefieldStartTime;

        // Snap the camera immediately to the new player position on respawn.
        // Setting skipLerp causes updateCamera to snap springs; call updateCamera() now to apply instantly.
        try {
            cameraState.skipLerp = true;
            updateCamera();
        } catch (e) {}
    }

    // Add a proper external jump method that uses the player's physics
    function externalJump() {
        if (!model || !onGround) return;
        velocityY = 0.42;
        onGround = false;
        playSound('jump');
    }

    function createOilDeathEffect() {
        if (!model || !scene) return;
        const deathPosition = model.position.clone();
        const oilColor = 0x171b1d;

        const puddle = new THREE.Mesh(
            new THREE.SphereGeometry(0.72, 20, 8),
            new THREE.MeshBasicMaterial({ color: oilColor, transparent: true, opacity: 0.82 })
        );
        puddle.name = 'RobotOilDeathPuddle';
        puddle.position.set(deathPosition.x, deathPosition.y + 0.06, deathPosition.z);
        puddle.scale.set(1.4, 0.06, 1.15);
        scene.add(puddle);
        activeItemProjectiles.push({
            mesh: puddle,
            velocity: new THREE.Vector3(0, 0, 0),
            life: 3.2,
            type: 'oilPuddle'
        });

        for (let i = 0; i < 12; i++) {
            const droplet = new THREE.Mesh(
                new THREE.SphereGeometry(0.07 + Math.random() * 0.08, 8, 6),
                new THREE.MeshBasicMaterial({
                    color: i % 3 === 0 ? 0x30383a : oilColor,
                    transparent: true,
                    opacity: 0.95
                })
            );
            droplet.position.set(
                deathPosition.x + (Math.random() - 0.5) * 0.45,
                deathPosition.y + 0.35 + Math.random() * 0.35,
                deathPosition.z + (Math.random() - 0.5) * 0.45
            );
            scene.add(droplet);
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.12 + Math.random() * 0.2;
            activeItemProjectiles.push({
                mesh: droplet,
                velocity: new THREE.Vector3(Math.cos(angle) * speed, 0.22 + Math.random() * 0.22, Math.sin(angle) * speed),
                life: 1.2 + Math.random() * 0.8,
                type: 'oil'
            });
        }
    }

    function flingOnDeath() {
        if (!model) return;
        const launchedFromSurface = onGround;
        const flingBoost = launchedFromSurface ? 1.85 : 1;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() === 0) forward.set(0, 0, -1);
        forward.normalize();

        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        const side = (Math.random() - 0.5) * 0.32 * flingBoost;
        deathFlingVelocity.copy(forward).multiplyScalar(0.22 * flingBoost).add(right.multiplyScalar(side));
        deathFlingSpin.set(
            (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.08) * flingBoost,
            0,
            (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.08) * flingBoost
        );
        velocityY = 0.62 * flingBoost;
        onGround = false;
        deathFlingActive = true;
    }

    return {
        update, updateCamera,
        cameraState,
        adjustZoom, adjustPan,
        getPosition, getCameraAngle,
        setHeldItem, // New tool setter
        useHeldItem,
        lockInput, // New setter
        applyExternalMovement, // New setter
        externalJump, // exported new jump method
        flingOnDeath,
        createOilDeathEffect,
        respawn, // Exported respawn helper
        
        // Exported for multiplayer use
        createModel, 
        updateModelAnimations,
        updateModelForcefield,
        
        get model() { return model; },
        get isWalking() { return isWalking; },
        get isForcefieldActive() { return performance.now() < forcefieldEndTime; },
        get isSwordSwinging() { return currentHeldItemId === 'sword' && swordSwingStartTime > 0 && performance.now() - swordSwingStartTime < SWORD_SWING_DURATION; },
        get animationTime() { return animationTime; },
        get onGround() { return onGround; },

        get voidMode() { return voidMode; },
        set voidMode(v) { voidMode = v; },
        get voidIntensified() { return voidIntensified; },
        set voidIntensified(v) { voidIntensified = v; }
    };
}
