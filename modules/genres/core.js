const registry = new Map();
let active = null;
let updateErrors = 0;

export function registerGenre(mod) {
    if (mod && mod.id && typeof mod.layout === 'function' && typeof mod.init === 'function') {
        registry.set(mod.id, mod);
    }
}

export function getGenreMod(id) {
    return registry.get(id) || null;
}

export function listGenres() {
    return Array.from(registry.keys());
}

export function getGenreLayout(id, rng) {
    const mod = registry.get(id);
    if (!mod) return null;
    try {
        const parts = mod.layout(rng);
        return Array.isArray(parts) && parts.length ? parts : null;
    } catch (e) {
        console.warn('[Genre] "' + id + '" layout failed, using default map:', e);
        return null;
    }
}

export function makeParts(prefix) {
    let n = 0;
    return (type, position, scale, color, extra) => {
        n++;
        const def = {
            id: prefix + n,
            name: 'Part' + n,
            type,
            parent: null,
            position,
            rotation: [0, 0, 0],
            scale,
            color,
            texture: type === 'ground' ? 'grass' : 'studs',
            material: 'Plastic',
            collidable: true,
            damage: 0,
            spawn: false,
            scripts: []
        };
        return Object.assign(def, extra || {});
    };
}

function injectStyle(id, css) {
    let node = document.getElementById(id);
    if (!node) {
        node = document.createElement('style');
        node.id = id;
        document.head.appendChild(node);
    }
    node.textContent = css;
    return node;
}

const CORE_CSS = `
.cs-genre-popup{position:fixed;left:50%;bottom:19%;transform:translateX(-50%);z-index:46;
background:rgba(14,14,18,.92);color:#ffe97a;font:bold 17px Tahoma,sans-serif;padding:8px 18px;
border:2px solid #000;border-radius:6px;pointer-events:none;animation:cs-genre-pop 2.6s ease forwards}
@keyframes cs-genre-pop{0%{opacity:0;transform:translateX(-50%) translateY(8px)}
12%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1}100%{opacity:0}}`;

export function initGenre(ctx) {
    disposeGenre();
    const id = ctx && ctx.manifest ? ctx.manifest.genre : null;
    const mod = registry.get(id);
    if (!mod) return null;

    const hud = document.createElement('div');
    hud.id = 'cs-genre-hud';
    document.body.appendChild(hud);
    const styleIds = [];
    injectStyle('cs-genre-core-style', CORE_CSS);
    styleIds.push('cs-genre-core-style');
    const saveKey = 'cs_genre_' + id + '_' + ((ctx.manifest && ctx.manifest.id) || 'local');

    const api = {
        root: hud,
        el(tag, cls, text) {
            const node = document.createElement(tag);
            if (cls) node.className = cls;
            if (text != null) node.textContent = text;
            hud.appendChild(node);
            return node;
        },
        style(css, name) {
            const sid = 'cs-genre-style-' + id + '-' + (name || styleIds.length);
            injectStyle(sid, css);
            styleIds.push(sid);
            return sid;
        },
        setBaseHud(opts) {
            const map = {
                health: '#health-bar-container',
                backpack: '#backpack-container',
                hotbar: '#cs-hotbar,#cs-toolhint',
                chat: '#chat-logs',
                playerList: '#player-list-container'
            };
            const rules = [];
            for (const key of Object.keys(map)) {
                if (opts && opts[key] === false) rules.push(map[key] + '{display:none!important}');
            }
            if (!rules.length) return;
            injectStyle('cs-genre-basehide', rules.join('\n'));
            if (styleIds.indexOf('cs-genre-basehide') === -1) styleIds.push('cs-genre-basehide');
        },
        save(data) {
            try { localStorage.setItem(saveKey, JSON.stringify(data)); } catch (e) {}
        },
        load() {
            try { const raw = localStorage.getItem(saveKey); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
        },
        popup(text) {
            const p = document.createElement('div');
            p.className = 'cs-genre-popup';
            p.textContent = text;
            hud.appendChild(p);
            setTimeout(() => p.remove(), 2700);
            return p;
        },
        ctx
    };

    let runtime = null;
    try {
        runtime = mod.init(ctx, api);
    } catch (e) {
        console.warn('[Genre] "' + id + '" failed to start:', e);
        hud.remove();
        for (const sid of styleIds) {
            const node = document.getElementById(sid);
            if (node) node.remove();
        }
        return null;
    }

    active = { id, mod, api, hud, styleIds, runtime: runtime || null };
    updateErrors = 0;
    window._genreRuntime = {
        id,
        state: (runtime && runtime.state) || null,
        actions: (runtime && runtime.actions) || null
    };
    return active;
}

export function updateGenre(dtMs) {
    if (!active || !active.runtime || typeof active.runtime.update !== 'function') return;
    if (updateErrors >= 5) return;
    try {
        active.runtime.update(Number(dtMs) || 0);
    } catch (e) {
        updateErrors++;
        console.warn('[Genre] "' + active.id + '" update error:', e);
    }
}

export function disposeGenre() {
    if (!active) return;
    const cur = active;
    active = null;
    try {
        if (cur.runtime && typeof cur.runtime.dispose === 'function') cur.runtime.dispose();
    } catch (e) {
        console.warn('[Genre] "' + cur.id + '" dispose error:', e);
    }
    for (const sid of cur.styleIds) {
        const node = document.getElementById(sid);
        if (node) node.remove();
    }
    if (cur.hud) cur.hud.remove();
    window._genreRuntime = null;
}

export function activeGenreId() {
    return active ? active.id : null;
}
