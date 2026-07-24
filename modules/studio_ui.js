/**
 * Studio UI — wires DOM elements to studio.js logic.
 * Builds the toolbox grids, handles clicks, and updates property panel.
 */

import {
    PART_TYPES, PART_COLORS, MATERIAL_PRESETS,
    setTool, setPartType, setColor, setMaterial, setPartScale,
    toggleSnap, deleteSelectedPart, savePlace, loadPlace,
    deleteSave, getSaveList, publishPlace, getPublishedList, loadPublished,
    mode, snapEnabled, activeTool, activePartType, selectedColor, selectedMaterial, selectedPart
} from './studio.js';

function buildToolboxUI() {
    const partGrid = document.getElementById('studio-part-grid');
    const toolGrid = document.getElementById('studio-tool-grid');
    const colorGrid = document.getElementById('studio-color-grid');
    const materialGrid = document.getElementById('studio-material-grid');

    if (partGrid) {
        Object.entries(PART_TYPES).forEach(([key, def]) => {
            const btn = document.createElement('button');
            btn.className = 'toolbox-part-btn' + (key === activePartType ? ' active' : '');
            btn.textContent = def.name;
            btn.dataset.part = key;
            btn.addEventListener('click', () => {
                setPartType(key);
                partGrid.querySelectorAll('.toolbox-part-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            partGrid.appendChild(btn);
        });
    }

    if (toolGrid) {
        const tools = [
            { id: 'select', label: 'Select (1)' },
            { id: 'move', label: 'Move (3)' },
            { id: 'rotate', label: 'Rotate (4)' },
            { id: 'scale', label: 'Scale (5)' },
        ];
        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'toolbox-tool-btn' + (t.id === activeTool ? ' active' : '');
            btn.textContent = t.label;
            btn.dataset.tool = t.id;
            btn.addEventListener('click', () => {
                setTool(t.id);
                toolGrid.querySelectorAll('.toolbox-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            toolGrid.appendChild(btn);
        });
    }

    if (colorGrid) {
        PART_COLORS.forEach(c => {
            const swatch = document.createElement('div');
            swatch.className = 'toolbox-color-swatch' + (c.hex === selectedColor ? ' active' : '');
            swatch.style.backgroundColor = c.hex;
            swatch.title = c.name;
            swatch.addEventListener('click', () => {
                setColor(c.hex);
                colorGrid.querySelectorAll('.toolbox-color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                const propColor = document.getElementById('prop-color');
                if (propColor) propColor.value = c.hex;
            });
            colorGrid.appendChild(swatch);
        });
    }

    if (materialGrid) {
        MATERIAL_PRESETS.forEach((m, i) => {
            const btn = document.createElement('button');
            btn.className = 'toolbox-material-btn' + (i === selectedMaterial ? ' active' : '');
            btn.textContent = m.name;
            btn.dataset.mat = i;
            btn.addEventListener('click', () => {
                setMaterial(i);
                materialGrid.querySelectorAll('.toolbox-material-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            materialGrid.appendChild(btn);
        });
    }
}

function initStudioUI() {
    buildToolboxUI();

    // Snap indicator
    const snapEl = document.getElementById('studio-snap-indicator');
    if (snapEl) {
        const update = (on) => {
            snapEl.textContent = on ? 'SNAP: ON (M)' : 'SNAP: OFF (M)';
            snapEl.className = on ? '' : 'off';
        };
        update(snapEnabled);
        import('./studio.js').then(s => { s.onSnapUI(update); });
    }

    // Mode indicator
    const modeEl = document.getElementById('studio-mode-indicator');
    if (modeEl) {
        const update = (m) => {
            if (m === 'freecam') {
                modeEl.textContent = 'STUDIO - Freecam';
                modeEl.classList.remove('hidden');
                document.getElementById('studio-overlay')?.classList.remove('hidden');
            } else {
                modeEl.classList.add('hidden');
                document.getElementById('studio-overlay')?.classList.add('hidden');
            }
        };
        import('./studio.js').then(s => { s.onModeUI(update); });
    }

    // Tool grid sync
    import('./studio.js').then(s => {
        s.onToolUI((t) => {
            document.querySelectorAll('.toolbox-tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === t);
            });
        };
    });

    // Properties panel
    const propsPanel = document.getElementById('studio-properties');
    const propType = document.getElementById('prop-type');
    const propPos = document.getElementById('prop-pos');
    const propRot = document.getElementById('prop-rot');
    const propScale = document.getElementById('prop-scale');
    const propColor = document.getElementById('prop-color');
    const propDelete = document.getElementById('prop-delete');

    import('./studio.js').then(s => {
        s.onPropsUI((part) => {
            if (!part) {
                propsPanel?.classList.add('hidden');
                return;
            }
            propsPanel?.classList.remove('hidden');
            if (propType) propType.textContent = part.userData.partType || '-';
            if (propPos) propPos.textContent = `${part.position.x.toFixed(1)}, ${part.position.y.toFixed(1)}, ${part.position.z.toFixed(1)}`;
            if (propRot) propRot.textContent = `${(part.rotation.y * 180 / Math.PI).toFixed(0)}°`;
            if (propScale) propScale.value = part.scale.x.toFixed(1);
            if (propColor) propColor.value = '#' + part.material.color.getHexString();
        };
    });

    if (propScale) {
        propScale.addEventListener('change', () => {
            setPartScale(parseFloat(propScale.value) || 1);
        });
    }
    if (propColor) {
        propColor.addEventListener('input', () => {
            setColor(propColor.value);
        });
    }
    if (propDelete) {
        propDelete.addEventListener('click', () => {
            deleteSelectedPart();
        });
    }

    // Saves panel
    const savesToggle = document.getElementById('studio-saves-toggle');
    const savesPanel = document.getElementById('studio-saves');
    if (savesToggle && savesPanel) {
        savesToggle.addEventListener('click', () => {
            savesPanel.classList.toggle('hidden');
            refreshSavesList();
        });
    }

    const saveBtn = document.getElementById('studio-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('studio-save-name');
            const name = nameInput?.value.trim() || 'Untitled';
            savePlace(name);
            refreshSavesList();
        });
    }

    const publishBtn = document.getElementById('studio-publish-btn');
    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('studio-save-name');
            const name = nameInput?.value.trim() || 'Untitled';
            publishPlace(name);
            refreshPublishedList();
        });
    }

    const exportBtn = document.getElementById('studio-exports-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const { exportPlace } = await import('./studio.js');
            const json = exportPlace();
            try {
                await navigator.clipboard.writeText(json);
                alert('Place data copied to clipboard!');
            } catch (e) {
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'place.json'; a.click();
                URL.revokeObjectURL(url);
            }
        });
    }
}

function refreshSavesList() {
    const list = document.getElementById('studio-saves-list');
    if (!list) return;
    const saves = getSaveList();
    list.innerHTML = '';
    if (saves.length === 0) {
        list.innerHTML = '<div style="color:#666;font-size:10px;padding:4px;">No saves yet</div>';
        return;
    }
    saves.forEach(s => {
        const entry = document.createElement('div');
        entry.className = 'save-entry';
        entry.innerHTML = `
            <div>
                <div class="save-name">${s.name}</div>
                <div class="save-meta">${s.parts.length} parts</div>
            </div>
            <span>
                <button class="save-btn" data-action="load">Load</button>
                <button class="save-btn danger" data-action="delete">Del</button>
            </span>
        `;
        entry.querySelector('[data-action="load"]').addEventListener('click', () => loadPlace(s.name));
        entry.querySelector('[data-action="delete"]').addEventListener('click', () => { deleteSave(s.name); refreshSavesList(); });
        list.appendChild(entry);
    });
}

function refreshPublishedList() {
    const list = document.getElementById('studio-published-list');
    if (!list) return;
    const pubs = getPublishedList();
    list.innerHTML = '';
    if (pubs.length === 0) {
        list.innerHTML = '<div style="color:#666;font-size:10px;padding:4px;">No published places</div>';
        return;
    }
    pubs.forEach(p => {
        const entry = document.createElement('div');
        entry.className = 'save-entry';
        entry.innerHTML = `
            <div>
                <div class="save-name">${p.name}</div>
                <div class="save-meta">by ${p.author} - ${p.parts.length} parts</div>
            </div>
            <button class="save-btn" data-action="load">Load</button>
        `;
        entry.querySelector('[data-action="load"]').addEventListener('click', () => loadPublished(p.name, p.author));
        list.appendChild(entry);
    });
}

export { initStudioUI };
