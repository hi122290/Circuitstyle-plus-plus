import Global from './Global.js';

let audioContext = null;
const sounds = {};

function loadSound(name, url, cb) {
    if (!audioContext) return;
    const req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = 'arraybuffer';
    req.onload = () => audioContext.decodeAudioData(req.response, (buf) => {
        sounds[name] = buf;
        if (cb) cb();
    });
    req.send();
}

export function playSound(name, loop = false) {
    if (!sounds[name] || !audioContext) return null;
    const src = audioContext.createBufferSource();
    src.buffer = sounds[name];
    src.loop = !!loop;

    // Route through a simple gain node with fixed unity gain to ensure no distance/panner attenuation is applied.
    const gain = audioContext.createGain();
    gain.gain.value = 1.0; // explicit: no attenuation
    src.connect(gain);
    gain.connect(audioContext.destination);

    src.start(0);
    return src;
}

export function stopBackground() {
    try {
        if (sounds.bgNode && sounds.bgNode.source) {
            sounds.bgNode.source.stop(0);
            try { sounds.bgNode.gain.disconnect(); } catch(e){}
            delete sounds.bgNode;
        }
    } catch (e) {}
}

export function setupAudio() {
    function initOnce() {
        if (audioContext) return;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const paths = Global.audio.paths;
        loadSound('click', paths.click);
        loadSound('walk', paths.walk);
        loadSound('spawn', paths.spawn);
        loadSound('jump', paths.jump);
        loadSound('roblox_click', paths.roblox_click);
        loadSound('bg', paths.bg);
        loadSound('oof', paths.oof);
        // Note: also attempt to fetch modules/stencil_shadows.lua so the project explicitly uses the Lua stencil helper
        try {
            (function fetchStencilLua(){
                fetch('/modules/stencil_shadows.lua', {cache: 'no-store'}).then(r => {
                    if (!r.ok) return null;
                    return r.text();
                }).then(txt => {
                    if (txt) {
                        // expose the raw Lua source so external debug tools or dev consoles can confirm it's loaded
                        window._stencil_shadows_lua = txt;
                        console.info('modules/stencil_shadows.lua loaded into window._stencil_shadows_lua');
                    }
                }).catch(()=>{});
            })();
        } catch (e) {}
        window.removeEventListener('pointerdown', initOnce);
        window.removeEventListener('keydown', initOnce);

        // Background music auto-start removed
    }

    // Initialize immediately to attempt autoplay on page join.
    initOnce();

    // Keep original gesture-based init as a fallback for environments that require user interaction.
    window.addEventListener('pointerdown', initOnce, { once: true });
    window.addEventListener('keydown', initOnce, { once: true });
}

export function startBackground() {
    // Background music disabled
}

export { sounds };