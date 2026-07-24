/**
 * studio_home.js — Boots the Studio editor on place_select.html.
 * Creates a Three.js scene with ground, lighting, and the full Studio toolset.
 */

import * as THREE from 'three';
import { initStudio, updateStudio, setMode, mode as studioMode } from './studio.js';
import { initStudioUI } from './studio_ui.js';

const canvas = document.getElementById('studio-canvas');
if (!canvas) { console.warn('No #studio-canvas found'); throw new Error('no canvas'); }

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.setClearColor(0x1a1a2e, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a1a2e, 80, 250);

const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
camera.position.set(0, 18, 28);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(8, 20, 10);
sun.castShadow = true;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362a28, 0.4);
scene.add(hemiLight);

// Ground — classic Roblox baseplate look
const groundGeo = new THREE.BoxGeometry(80, 0.4, 80);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7a2e, roughness: 0.85, metalness: 0.0 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

// Stud texture overlay on top of baseplate
const studGeo = new THREE.PlaneGeometry(80, 80);
const studTex = new THREE.TextureLoader().load('./Studs_Texture.png', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(50, 50);
});
const studMat = new THREE.MeshStandardMaterial({ map: studTex, transparent: true, opacity: 0.5, depthWrite: false });
const studPlane = new THREE.Mesh(studGeo, studMat);
studPlane.rotation.x = -Math.PI / 2;
studPlane.position.y = 0.01;
scene.add(studPlane);

// Grid helper (subtle)
const grid = new THREE.GridHelper(80, 50, 0x333333, 0x222222);
grid.position.y = 0.02;
grid.material.transparent = true;
grid.material.opacity = 0.3;
scene.add(grid);

// Minimal world object for studio.js collidable checks
const world = {
    ground,
    collidables: [ground],
    baseWidth: 80,
    baseDepth: 80,
};

// Initialize studio
initStudio(scene, camera, renderer, world);
initStudioUI();

// Start in play mode so the user can look around before entering studio
setMode('play');

// Resize handler
function onResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);
onResize();

// Simple orbit when in play mode (right-click drag)
let orbiting = false;
let orbitX = 0, orbitY = 0, orbitDist = 28;
let orbitTarget = new THREE.Vector3(0, 0, 0);
let lastMX = 0, lastMY = 0;

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        orbiting = true;
        lastMX = e.clientX;
        lastMY = e.clientY;
    }
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 2) orbiting = false;
});
canvas.addEventListener('mousemove', (e) => {
    if (!orbiting) return;
    orbitX -= (e.clientX - lastMX) * 0.005;
    orbitY = Math.max(-1.2, Math.min(1.2, orbitY - (e.clientY - lastMY) * 0.005));
    lastMX = e.clientX;
    lastMY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
    orbitDist = Math.max(5, Math.min(80, orbitDist + e.deltaY * 0.02));
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function updatePlayCamera() {
    const x = orbitTarget.x + Math.sin(orbitX) * Math.cos(orbitY) * orbitDist;
    const y = orbitTarget.y + Math.sin(orbitY) * orbitDist;
    const z = orbitTarget.z + Math.cos(orbitX) * Math.cos(orbitY) * orbitDist;
    camera.position.set(x, y, z);
    camera.lookAt(orbitTarget);
}

// Animation loop
let lastTime = 0;
function animate(now) {
    requestAnimationFrame(animate);
    if (!now) now = performance.now();
    const dt = Math.min(now - (lastTime || now), 50);
    lastTime = now;

    try { updateStudio(dt); } catch(e) {}

    // Only use orbit camera when NOT in studio freecam
    if (studioMode !== 'freecam') updatePlayCamera();

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);
