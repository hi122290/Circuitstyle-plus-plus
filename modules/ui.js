import { playSound } from './audio.js';
import { setupSafeChat } from './safechat.js';
import { updateUIElementPositions } from './ui_positioner.js';
import { renderHealthBar, renderPlayerList } from './canvas_renderer.js';

export function setupUI(renderer, cameraState, onZoomDelta, onPanDelta) {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const panUpBtn = document.getElementById('pan-up');
    const panDownBtn = document.getElementById('pan-down');

    if (zoomInBtn) { zoomInBtn.addEventListener('mousedown', () => { playSound('roblox_click'); onZoomDelta(-0.75); }); zoomInBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playSound('roblox_click'); onZoomDelta(-0.75); }, { passive: false }); }
    if (zoomOutBtn) { zoomOutBtn.addEventListener('mousedown', () => { playSound('roblox_click'); onZoomDelta(+0.75); }); zoomOutBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playSound('roblox_click'); onZoomDelta(+0.75); }, { passive: false }); }
    if (panUpBtn) { panUpBtn.addEventListener('mousedown', () => { playSound('roblox_click'); onPanDelta(+0.5); }); panUpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playSound('roblox_click'); onPanDelta(+0.5); }, { passive: false }); }
    if (panDownBtn) { panDownBtn.addEventListener('mousedown', () => { playSound('roblox_click'); onPanDelta(-0.5); }); panDownBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playSound('roblox_click'); onPanDelta(-0.5); }, { passive: false }); }

    setupSafeChat(renderer);
    updateUIElementPositions(renderer);

    // Add pressed-state image swapping for camera control buttons:
    function attachPressBehavior(btn, normalUrl, hoverUrl, pressUrl) {
        if (!btn) return;
        // store urls so CSS overrides don't matter
        btn.dataset.normal = `url('${normalUrl}')`;
        btn.dataset.hover = `url('${hoverUrl}')`;
        btn.dataset.press = `url('${pressUrl}')`;

        const applyNormal = () => { btn.style.backgroundImage = btn.dataset.normal; };
        const applyHover = () => { btn.style.backgroundImage = btn.dataset.hover; };
        const applyPress = () => { btn.style.backgroundImage = btn.dataset.press; };

        // initialize to CSS value if available, otherwise normal
        applyNormal();

        // mouse interactions
        btn.addEventListener('mousedown', (e) => {
            // left button only
            if (e.button !== 0) return;
            applyPress();
        });
        // restore state on mouseup anywhere on window
        window.addEventListener('mouseup', () => {
            // prefer hover if pointer is over button
            try {
                if (btn.matches(':hover')) applyHover(); else applyNormal();
            } catch (e) { applyNormal(); }
        });
        btn.addEventListener('mouseleave', () => {
            try {
                // if leaving while pressed, ensure normal is restored
                applyNormal();
            } catch (e) {}
        });
        btn.addEventListener('mouseenter', () => {
            // when entering, show hover variant
            try { applyHover(); } catch (e) {}
        });

        // Touch support: treat touchstart like mousedown and touchend like mouseup
        btn.addEventListener('touchstart', (e) => { applyPress(); }, { passive: true });
        btn.addEventListener('touchend', () => {
            try {
                if (btn.matches(':hover')) applyHover(); else applyNormal();
            } catch (e) { applyNormal(); }
        });
    }

    // wire each camera control to its images (press variants exist in project assets)
    attachPressBehavior(zoomInBtn, './CameraZoomIn.png', './CameraZoomIn_hover.png', './CameraZoomIn_press.png');
    attachPressBehavior(zoomOutBtn, './CameraZoomOut.png', './CameraZoomOut_hover.png', './CameraZoomOut_press.png');
    attachPressBehavior(panUpBtn, './CameraTiltUp.png', './CameraTiltUp_hover.png', './CameraTiltUp_press.png');
    attachPressBehavior(panDownBtn, './CameraTiltDown.png', './CameraTiltDown_hover.png', './CameraTiltDown_press.png');



    // Chat icon: swap src on hover and press (pointer + touch friendly)
    (function wireChatIcon() {
        const img = document.getElementById('chat-icon');
        if (!img) return;
    const NORMAL = './Chat icon.png';
    const HOVER = './Chat_ovr.png';
    const CLICK = './Chat_dn.png';

        const setSrc = (url) => { try { img.src = url; } catch (e) {} };

        // initialize to normal
        setSrc(NORMAL);

        img.addEventListener('pointerenter', () => {
            // only change to hover if not currently in pressed/open state
            const wrapper = document.getElementById('safechat-menu-wrapper');
            if (wrapper && !wrapper.classList.contains('hidden')) return;
            setSrc(HOVER);
        }, { passive: true });
        img.addEventListener('pointerleave', () => {
            // only restore to normal if safechat not open
            const wrapper = document.getElementById('safechat-menu-wrapper');
            if (wrapper && !wrapper.classList.contains('hidden')) return;
            setSrc(NORMAL);
        }, { passive: true });

        img.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            setSrc(CLICK);
        });

        // Restore on pointerup: if safechat menu is open keep the pressed image; otherwise prefer hover (if hovered) or normal
        window.addEventListener('pointerup', () => {
            try {
                const wrapper = document.getElementById('safechat-menu-wrapper');
                const menuOpen = wrapper && !wrapper.classList.contains('hidden');
                if (menuOpen) {
                    setSrc(CLICK);
                } else {
                    if (img.matches(':hover')) setSrc(HOVER); else setSrc(NORMAL);
                }
            } catch (e) { setSrc(NORMAL); }
        }, { passive: true });

        // Touch fallbacks (pointer events often cover these, but keep for robustness)
        img.addEventListener('touchstart', (e) => { setSrc(CLICK); }, { passive: true });
        img.addEventListener('touchend', () => {
            try {
                const wrapper = document.getElementById('safechat-menu-wrapper');
                if (wrapper && !wrapper.classList.contains('hidden')) setSrc(CLICK);
                else setSrc(HOVER);
            } catch (e) { setSrc(NORMAL); }
        }, { passive: true });
    })();
}

// Re-export core UI functions used by main.js or other modules
export { updateUIElementPositions, renderHealthBar, renderPlayerList };