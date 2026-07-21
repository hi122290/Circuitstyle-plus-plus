const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
export { isTouchDevice as isMobile };

const MOVE_SPEED = 0.018;
let _playerRef = null;
let _attackCallback = null;
let _zoomCallback = null;
let _moveIntent = { x: 0, y: 0 };
let _keys = {};

export function setupMobileControls(playerRef, attackCallback, zoomCallback) {
    _playerRef = playerRef;
    _attackCallback = attackCallback;
    _zoomCallback = zoomCallback;

    injectStyles();
    createJoystick();
    createActionButtons();
    injectCameraDrag();
    setupTapToPickup();
}

function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #mobile-controls-layer {
            position: fixed;
            inset: 0;
            z-index: 9998;
            pointer-events: none;
        }
        #mobile-controls-layer * { box-sizing: border-box; }
        #joystick-zone {
            position: absolute;
            bottom: 30px;
            left: 30px;
            width: 130px;
            height: 130px;
            border-radius: 50%;
            background: rgba(255,255,255,0.12);
            border: 2px solid rgba(255,255,255,0.25);
            pointer-events: auto;
            touch-action: none;
        }
        #joystick-stick {
            position: absolute;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(255,255,255,0.4);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            transition: none;
        }
        .mobile-btn {
            position: absolute;
            pointer-events: auto;
            touch-action: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: "Comic Sans MS", cursive;
            font-size: 14px;
            color: rgba(255,255,255,0.85);
            background: rgba(255,255,255,0.15);
            border: 2px solid rgba(255,255,255,0.3);
            user-select: none;
            -webkit-user-select: none;
        }
        .mobile-btn:active {
            background: rgba(255,255,255,0.35);
        }
        #btn-jump {
            bottom: 30px;
            right: 30px;
            width: 70px;
            height: 70px;
        }
        #btn-attack {
            bottom: 120px;
            right: 30px;
            width: 55px;
            height: 55px;
            font-size: 12px;
        }
        #btn-zoom-in, #btn-zoom-out {
            width: 44px;
            height: 44px;
            font-size: 18px;
            font-weight: bold;
        }
        #btn-zoom-in {
            bottom: 120px;
            right: 95px;
        }
        #btn-zoom-out {
            bottom: 66px;
            right: 95px;
        }
        #camera-drag-zone {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 70%;
            pointer-events: auto;
            touch-action: none;
        }
    `;
    document.head.appendChild(style);
}

function createJoystick() {
    const zone = document.createElement('div');
    zone.id = 'joystick-zone';
    zone.innerHTML = '<div id="joystick-stick"></div>';

    const stick = zone.querySelector('#joystick-stick');
    const radius = 65;
    let touchId = null;
    let centerX = 0, centerY = 0;

    zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        touchId = t.identifier;
        const rect = zone.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier !== touchId) continue;
            let dx = t.clientX - centerX;
            let dy = t.clientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius) {
                dx = (dx / dist) * radius;
                dy = (dy / dist) * radius;
            }
            stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            _moveIntent.x = dx / radius;
            _moveIntent.y = -dy / radius;
            injectMoveKeys(_moveIntent.x, _moveIntent.y);
        }
    }, { passive: false });

    const resetJoystick = () => {
        touchId = null;
        stick.style.transform = 'translate(-50%, -50%)';
        _moveIntent.x = 0;
        _moveIntent.y = 0;
        injectMoveKeys(0, 0);
    };
    zone.addEventListener('touchend', resetJoystick, { passive: true });
    zone.addEventListener('touchcancel', resetJoystick, { passive: true });

    document.body.appendChild(zone);
}

function injectMoveKeys(fx, fy) {
    const threshold = 0.25;
    const keysToSet = {};
    keysToSet['w'] = fy > threshold;
    keysToSet['s'] = fy < -threshold;
    keysToSet['d'] = fx > threshold;
    keysToSet['a'] = fx < -threshold;

    for (const [key, pressed] of Object.entries(keysToSet)) {
        if (pressed && !_keys[key]) {
            window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        } else if (!pressed && _keys[key]) {
            window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        }
    }
    _keys = { ...keysToSet };
}

function createActionButtons() {
    const layer = document.createElement('div');
    layer.id = 'mobile-controls-layer';

    const jumpBtn = document.createElement('div');
    jumpBtn.id = 'btn-jump';
    jumpBtn.className = 'mobile-btn';
    jumpBtn.textContent = 'Jump';
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    }, { passive: false });
    jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    }, { passive: false });

    const attackBtn = document.createElement('div');
    attackBtn.id = 'btn-attack';
    attackBtn.className = 'mobile-btn';
    attackBtn.textContent = 'Use';
    attackBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (_attackCallback) _attackCallback();
    }, { passive: false });

    const zoomInBtn = document.createElement('div');
    zoomInBtn.id = 'btn-zoom-in';
    zoomInBtn.className = 'mobile-btn';
    zoomInBtn.textContent = '+';
    zoomInBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (_zoomCallback) _zoomCallback(-0.75);
    }, { passive: false });

    const zoomOutBtn = document.createElement('div');
    zoomOutBtn.id = 'btn-zoom-out';
    zoomOutBtn.className = 'mobile-btn';
    zoomOutBtn.textContent = '-';
    zoomOutBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (_zoomCallback) _zoomCallback(0.75);
    }, { passive: false });

    layer.appendChild(jumpBtn);
    layer.appendChild(attackBtn);
    layer.appendChild(zoomInBtn);
    layer.appendChild(zoomOutBtn);
    document.body.appendChild(layer);
}

function injectCameraDrag() {
    const zone = document.createElement('div');
    zone.id = 'camera-drag-zone';
    let activeTouch = null;
    let lastX = 0, lastY = 0;

    zone.addEventListener('touchstart', (e) => {
        if (activeTouch !== null) return;
        const t = e.changedTouches[0];
        activeTouch = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
    }, { passive: true });

    zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier !== activeTouch) continue;
            const dx = t.clientX - lastX;
            const dy = t.clientY - lastY;
            lastX = t.clientX;
            lastY = t.clientY;
            if (_playerRef && _playerRef.cameraState) {
                _playerRef.cameraState.angle -= dx * 0.006;
                _playerRef.cameraState.pitch += dy * 0.005;
                _playerRef.cameraState.pitch = Math.max(
                    _playerRef.cameraState.MIN_PITCH,
                    Math.min(_playerRef.cameraState.MAX_PITCH, _playerRef.cameraState.pitch)
                );
            }
        }
    }, { passive: false });

    const resetTouch = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === activeTouch) {
                activeTouch = null;
            }
        }
    };
    zone.addEventListener('touchend', resetTouch, { passive: true });
    zone.addEventListener('touchcancel', resetTouch, { passive: true });

    document.body.appendChild(zone);
}

function setupTapToPickup() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    let tapTouchId = null;
    let tapStartTime = 0;
    let tapStartX = 0, tapStartY = 0;

    canvas.addEventListener('touchstart', (e) => {
        if (e.changedTouches.length === 1) {
            tapTouchId = e.changedTouches[0].identifier;
            tapStartTime = Date.now();
            tapStartX = e.changedTouches[0].clientX;
            tapStartY = e.changedTouches[0].clientY;
        }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === tapTouchId) {
                const dt = Date.now() - tapStartTime;
                const dist = Math.sqrt(
                    Math.pow(t.clientX - tapStartX, 2) +
                    Math.pow(t.clientY - tapStartY, 2)
                );
                if (dt < 300 && dist < 20) {
                    handleTapPickup(t.clientX, t.clientY);
                }
                tapTouchId = null;
            }
        }
    }, { passive: true });
}

function handleTapPickup(clientX, clientY) {
    if (!_playerRef || !_playerRef.model) return;
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    const THREE = window.THREE_REF || (typeof THREE !== 'undefined' ? THREE : null);
    const camera = window.camera;
    if (!camera || !window.renderer) return;

    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    try {
        if (window._itemMeshes) {
            for (const obj of window._itemMeshes) {
                if (obj.userData.isCollected) continue;
                const screenPos = obj.position.clone().project(camera);
                const sx = (screenPos.x + 1) / 2 * rect.width + rect.left;
                const sy = (-screenPos.y + 1) / 2 * rect.height + rect.top;
                const tapDist = Math.sqrt(Math.pow(clientX - sx, 2) + Math.pow(clientY - sy, 2));
                if (tapDist < 50) {
                    const pPos = _playerRef.model.position;
                    const worldDist = pPos.distanceTo(obj.position);
                    if (worldDist < 5) {
                        if (window.backpack && window.backpack.addItem(obj.userData.itemType)) {
                            obj.userData.isCollected = true;
                            obj.visible = false;
                        }
                    }
                    break;
                }
            }
        }
    } catch (e) {}
}


