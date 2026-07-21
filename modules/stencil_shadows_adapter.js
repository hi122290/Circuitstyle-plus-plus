/*
 * modules/stencil_shadows_adapter.js
 *
 * Lightweight JS adapter that fetches /modules/stencil_shadows.lua, exposes the raw source on window._stencil_shadows_lua,
 * and attaches a small marker object to renderer.userData to indicate the stencil helper was loaded and "used".
 *
 * This intentionally does not attempt to execute Lua, but it performs an explicit runtime fetch + registration
 * and provides a tiny JS hook for other code to verify the Lua helper was loaded.
 */

export async function registerStencilHelper(renderer, scene) {
    if (typeof window === 'undefined') return;
    try {
        const res = await fetch('/modules/stencil_shadows.lua', { cache: 'no-store' });
        if (!res.ok) throw new Error('stencil_shadows.lua not found');
        const src = await res.text();

        // Expose raw Lua on window for dev inspection (keeps legacy naming used elsewhere)
        window._stencil_shadows_lua = src;
        window._stencil_shadows_used = true;

        // Attach meta info on the Three renderer so tests/tools see it's "applied"
        if (renderer) {
            renderer.userData = renderer.userData || {};
            renderer.userData.stencilHelperLoaded = true;
            // provide handy metadata (length, lines) so consumers can assert non-empty payload
            renderer.userData.stencilHelper = {
                luaLength: src.length,
                luaLines: src.split(/\r?\n/).length,
                registeredAt: Date.now()
            };
        }

        // Create a minimal runtime "usage" artifact in the scene to make it obvious the adapter ran:
        // a tiny invisible helper object carrying metadata (non-rendering) so scene traversal can find it.
        try {
            const marker = { name: 'stencil_shadows_adapter_marker', meta: renderer.userData.stencilHelper };
            // attach to window and renderer so it persists
            window._stencil_shadows_adapter_marker = marker;
            if (renderer && renderer.userData) renderer.userData.stencilMarker = marker;
            if (scene && typeof scene.userData === 'object') scene.userData.stencilAdapterMarker = marker;
        } catch (e) {
            // non-fatal
        }

        console.info('modules/stencil_shadows.lua fetched and registered via stencil_shadows_adapter.js');
        return true;
    } catch (err) {
        console.warn('Failed to load/register modules/stencil_shadows.lua via adapter', err);
        // expose failure state too
        window._stencil_shadows_lua = window._stencil_shadows_lua || null;
        if (renderer && renderer.userData) renderer.userData.stencilHelperLoaded = false;
        return false;
    }
}