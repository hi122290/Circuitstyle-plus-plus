/**
 * Calculates the screen coordinates of the rendered THREE.js canvas content area.
 * @param {HTMLCanvasElement} canvas
 * @returns {{left: number, top: number, width: number, height: number, baseWidth: number, baseHeight: number}}
 */
export function getCanvasDrawAreaBounds(canvas) {
    const internalW = 720;
    const internalH = 540;

    if (!canvas) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, baseWidth: internalW, baseHeight: internalH };

    const rect = canvas.getBoundingClientRect();
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        baseWidth: internalW,
        baseHeight: internalH
    };
}

/**
 * Utility to make a window draggable by its title bar.
 */
export function makePopupDraggable(winEl) {
    if (!winEl) return;
    const title = winEl.querySelector('.title-bar');
    if (!title) return;
    let dragging = false;
    let startX = 0, startY = 0, origLeft = 0, origTop = 0;
    title.style.cursor = 'move';
    title.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        dragging = true;
        startX = ev.clientX; startY = ev.clientY;
        const rect = winEl.getBoundingClientRect();
        origLeft = rect.left; origTop = rect.top;
        winEl.style.zIndex = 150000;
        winEl.style.position = 'fixed'; 
        winEl.style.left = origLeft + 'px';
        winEl.style.top = origTop + 'px';
        winEl.style.transform = 'none'; 
    });
    window.addEventListener('mousemove', (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        // Clamp within game canvas draw area
        try {
            const canvas = document.getElementById('game-canvas');
            const bounds = canvas ? getCanvasDrawAreaBounds(canvas) : null;
            const winW = winEl.offsetWidth;
            const winH = winEl.offsetHeight;
            let newLeft = origLeft + dx;
            let newTop = origTop + dy;
            if (bounds) {
                const minLeft = bounds.left;
                const maxLeft = bounds.left + bounds.width - winW;
                const minTop = bounds.top;
                const maxTop = bounds.top + bounds.height - winH;
                newLeft = Math.min(Math.max(newLeft, minLeft), Math.max(minLeft, maxLeft));
                newTop  = Math.min(Math.max(newTop, minTop), Math.max(minTop, maxTop));
            }
            winEl.style.left = newLeft + 'px';
            winEl.style.top = newTop + 'px';
        } catch (e) {
            winEl.style.left = (origLeft + dx) + 'px';
            winEl.style.top = (origTop + dy) + 'px';
        }
    });
    window.addEventListener('mouseup', () => { dragging = false; });
}

export function updateUIElementPositions(renderer) {
    const canvas = renderer.domElement;
    if (!canvas) return;

    const bounds = getCanvasDrawAreaBounds(canvas);
    const rect = canvas.getBoundingClientRect();

    const drawWidth = bounds.width;
    const drawHeight = bounds.height;
    const offsetX = bounds.left - rect.left;
    const offsetY = bounds.top - rect.top;

    const padding = 18;
    const CHAT_BAR_HEIGHT = 20; // 20 pixels high
    const CHAT_ICON_VERTICAL_OFFSET = 140; 

    const chatBarContainer = document.getElementById('chat-bar-container');
    const isChatVisible = chatBarContainer && !chatBarContainer.classList.contains('hidden');
    const effectiveChatHeight = isChatVisible ? CHAT_BAR_HEIGHT : 0;

    const controlsContainer = document.getElementById('controls-container');
    if (controlsContainer) {
        // compute distance from canvas edge to window edge so "right" and "bottom" place the controls flush to the canvas draw area
        // offsetX/offsetY are relative to the canvas rect, so derive the visible canvas bounds in window coords
        const canvasRight = rect.left + offsetX + drawWidth;
        const canvasBottom = rect.top + offsetY + drawHeight;
        // pixels between canvas right edge and window right edge
        const rightGap = Math.max(0, window.innerWidth - canvasRight);
        // pixels between canvas bottom edge and window bottom edge
        const bottomGap = Math.max(0, window.innerHeight - canvasBottom);

        // small nudges so the 2x2 block sits tightly against the canvas corner and above the chat bar
        // negative nudges pull the control block inward closer to the canvas draw area
        // Keep the control block offset stable (no inward nudge) so buttons get closer to each other,
        // not closer to the canvas edge.
        // Tiny inward nudge to pull the controls a little closer to the canvas corner
        const NUDGE_X = -10;
        const NUDGE_Y = -10;

        controlsContainer.style.right = `${rightGap + NUDGE_X}px`;
        controlsContainer.style.bottom = `${bottomGap + effectiveChatHeight + NUDGE_Y}px`;
        // ensure absolute positioning mode
        controlsContainer.style.position = 'absolute';
    }

    // Position the Report/Abuse overlay centered above the zoom-controls block and scale it to match one control button height.
    const reportOverlay = document.getElementById('report-abuse-overlay');
    if (reportOverlay) {
        try {
            // Find the controls container and compute its on-screen rectangle.
            const controlsEl = document.getElementById('zoom-controls') || document.getElementById('controls-container');
            if (!controlsEl) {
                reportOverlay.classList.add('hidden');
            } else {
                const controlsRect = controlsEl.getBoundingClientRect();
                // Determine visible control block rectangle (account for canvas draw area offset)
                // Use the controlsRect directly (they are positioned absolute relative to window)
                const controlCenterX = controlsRect.left + controlsRect.width / 2;
                const controlTopY = controlsRect.top;
                // Desired overlay width should be exactly 64px; preserve aspect ratio (height auto).
                const DESIRED_OVERLAY_W = 64;
                reportOverlay.style.objectFit = 'contain';
                reportOverlay.style.pointerEvents = 'auto';

                // Preserve the image aspect ratio by reading the natural image dimensions.
                const img = reportOverlay;
                const naturalW = img.naturalWidth || img.width || 1;
                const naturalH = img.naturalHeight || img.height || 1;
                const aspect = naturalW / naturalH;

                // Compute height from the fixed desired width, but clamp so it never exceeds the controls block height.
                let desiredWidth = DESIRED_OVERLAY_W;
                let desiredHeight = Math.max(1, Math.round(desiredWidth / Math.max(0.0001, aspect)));

                // Ensure overlay doesn't exceed controls block width (leave 2px inset) or controls block height (leave small gap)
                const maxWidth = Math.max(4, controlsRect.width - 2);
                const maxHeight = Math.max(4, controlsRect.height - 4);

                if (desiredWidth > maxWidth) {
                    // scale down proportionally to fit width
                    desiredWidth = Math.round(maxWidth);
                    desiredHeight = Math.max(1, Math.round(desiredWidth / Math.max(0.0001, aspect)));
                }
                if (desiredHeight > maxHeight) {
                    // scale down proportionally to fit height
                    desiredHeight = Math.round(maxHeight);
                    desiredWidth = Math.max(1, Math.round(desiredHeight * aspect));
                }

                reportOverlay.style.width = `${desiredWidth}px`;
                reportOverlay.style.height = `${desiredHeight}px`;

                // Use transform translateX(-50%) for precise centering; set left in window coords.
                const leftPos = Math.min(Math.max(4, controlCenterX), window.innerWidth - 4);
                reportOverlay.style.left = `${leftPos}px`;
                reportOverlay.style.transform = 'translateX(-50%)';

                // Place the overlay just above the controls block (use small gap so it doesn't touch)
                const GAP = 6;
                // extra downward nudge so the overlay sits a little lower relative to the controls
                const EXTRA_DOWN = 6; // pixels
                // controlsRect.top is distance from top of viewport to control; compute top = controlTopY - overlayHeight - GAP + EXTRA_DOWN
                const topPos = Math.max(2, controlTopY - desiredHeight - GAP + EXTRA_DOWN);
                reportOverlay.style.top = `${Math.round(topPos)}px`;
                // Explicitly unset right/bottom that might conflict
                reportOverlay.style.right = 'auto';
                reportOverlay.style.bottom = 'auto';

                reportOverlay.classList.remove('hidden');
            }
        } catch (e) {
            // fallback: hide overlay if positioning fails
            reportOverlay.classList.add('hidden');
        }
    }

    const playerListContainer = document.getElementById('player-list-container');
    if (playerListContainer) {
        playerListContainer.style.top = `${offsetY + padding}px`;
        playerListContainer.style.right = `${offsetX + padding}px`;
    }

    const healthBarContainer = document.getElementById('health-bar-container');
    if (healthBarContainer) {
        const HB_INTERNAL_WIDTH = 12;
        const HB_INTERNAL_HEIGHT = 106;
        const HEALTHBAR_RIGHT_OFFSET = 64;

        const healthBarCanvas = document.getElementById('health-bar-canvas');
        if (healthBarCanvas) {
            healthBarCanvas.width = 24;
            healthBarCanvas.height = HB_INTERNAL_HEIGHT;
            healthBarContainer.style.width = `${HB_INTERNAL_WIDTH}px`;
            healthBarContainer.style.height = `${HB_INTERNAL_HEIGHT}px`;
        }

        const hbDisplayHeight = healthBarContainer.clientHeight; 
        const hbTop = rect.top + offsetY + (drawHeight / 2) - (hbDisplayHeight / 2);

        // Nudge the health bar slightly upward so it sits a bit higher relative to the canvas center.
        const NUDGE_UP_PX = 12;
        healthBarContainer.style.top = `${Math.max(2, Math.round(hbTop - NUDGE_UP_PX))}px`;
        healthBarContainer.style.right = `${offsetX + HEALTHBAR_RIGHT_OFFSET}px`;
    }

    // CHAT ICON positioning calculation
    let iconLeft = 0;
    let iconTop = 0;
    const CHAT_ICON_WIDTH = 36; 
    const iconHeight = 36; 

    iconTop = rect.top + offsetY + (drawHeight / 2) - (iconHeight / 2) + CHAT_ICON_VERTICAL_OFFSET;
    iconLeft = rect.left + offsetX + padding;

    const chatIconContainer = document.getElementById('chat-icon-container');
    if (chatIconContainer) {
        chatIconContainer.style.top = `${iconTop}px`;
        chatIconContainer.style.left = `${iconLeft}px`;
    }

    // Position the new group of canvas-top-left buttons inside the canvas draw area (top-left corner + padding)
    const canvasButtons = document.getElementById('canvas-top-left-buttons');
    if (canvasButtons) {
        // place them relative to the visible canvas draw area with zero inset (flush to border)
        const INSET = 0;
        // use the computed bounds (already rect.left + offsetX) so it's exactly at the draw area's top-left
        canvasButtons.style.left = `${bounds.left + INSET}px`;
        canvasButtons.style.top  = `${bounds.top + INSET}px`;
    }

    // Position the 2007-style chat logs panel directly under the top-row buttons (inside canvas area)
    const chatLogs = document.getElementById('chat-logs');
    if (chatLogs) {
        // Top-row buttons height defined in CSS as 24px; include small gap of 4px
        const TOP_ROW_HEIGHT = 24;
        // increased gap so chat logs sit a bit lower
        const GAP = 12;
        // Slight horizontal offset so the chat log sits a bit right of the canvas-left edge
        const HORIZONTAL_NUDGE = 28; // pixels to nudge right (moved further right per request)
        // Place below the top-row buttons and nudge right a bit from the draw area's left edge
        chatLogs.style.left = `${bounds.left + HORIZONTAL_NUDGE}px`;
        chatLogs.style.top = `${bounds.top + TOP_ROW_HEIGHT + GAP}px`;
    }

    // SAFE CHAT MENU positioning (Beside the chat icon)
    const safeChatMenuWrapper = document.getElementById('safechat-menu-wrapper');
    if (safeChatMenuWrapper) {
        const MENU_HORIZONTAL_MARGIN = 4; 

        safeChatMenuWrapper.style.left = `${iconLeft + CHAT_ICON_WIDTH + MENU_HORIZONTAL_MARGIN}px`;

        const iconCenterY = iconTop + (iconHeight / 2); 
        safeChatMenuWrapper.style.top = `${iconCenterY}px`;
        safeChatMenuWrapper.style.bottom = 'auto'; 
    }

    // BACKPACK positioning
    const backpackContainer = document.getElementById('backpack-container');
    if (backpackContainer) {
        // Align the LEFT edge of the backpack exactly to the visible canvas draw area's left edge
        // (use bounds.left which already accounts for canvas draw area offsets)
        backpackContainer.style.left = `${bounds.left}px`;
        backpackContainer.style.top = 'auto';

        // Align the BOTTOM of the backpack to match the BOTTOM edge of the camera controls.
        // Compute the controls element's distance from the bottom of the viewport (bottomGap)
        // and use that value for the backpack bottom so their bottoms line up exactly.
        try {
            const controlsEl = document.getElementById('controls-container');
            if (controlsEl) {
                const controlsRect = controlsEl.getBoundingClientRect();
                const controlsBottomGap = Math.max(0, window.innerHeight - controlsRect.bottom);
                // Nudge the backpack up a bit so its bottom sits higher than the controls by default
                const BACKPACK_NUDGE_UP = 12; // px
                backpackContainer.style.bottom = `${Math.round(controlsBottomGap + BACKPACK_NUDGE_UP)}px`;
            } else {
                // Fallback: preserve previous behavior (above chat bar) if controls not found
                const FALLBACK_NUDGE_UP = 12;
                backpackContainer.style.bottom = `${(window.innerHeight - (rect.top + offsetY + drawHeight)) + effectiveChatHeight + 24 + FALLBACK_NUDGE_UP}px`;
            }
        } catch (e) {
            // On error, fallback to the previous chat-bar-based placement (with the same nudge)
            const CATCH_NUDGE_UP = 12;
            backpackContainer.style.bottom = `${(window.innerHeight - (rect.top + offsetY + drawHeight)) + effectiveChatHeight + 24 + CATCH_NUDGE_UP}px`;
        }
    }

    // BUILD CONTROLS positioning (above backpack when brick tool is equipped)
    const buildControls = document.getElementById('build-controls');
    if (buildControls) {
        const backpackEl = document.getElementById('backpack-container');
        if (backpackEl && !backpackEl.classList.contains('hidden')) {
            const bpRect = backpackEl.getBoundingClientRect();
            buildControls.style.left = `${bpRect.left}px`;
            buildControls.style.bottom = 'auto';
            buildControls.style.top = `${bpRect.top - 36}px`;
        }
    }

    // CHAT BAR positioning (used for SafeChat display/send button)
    const chatBarEl = document.getElementById('chat-bar-container');
    if (chatBarEl) {
        chatBarEl.style.width = `${drawWidth}px`;
        chatBarEl.style.left = `${rect.left + offsetX}px`;
        const chatBarTopPosition = rect.top + offsetY + drawHeight - CHAT_BAR_HEIGHT;
        chatBarEl.style.top = `${chatBarTopPosition}px`;
    }


}