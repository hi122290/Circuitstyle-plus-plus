/**
 * Player configuration and state.
 * Contains all visual, physical, and animation parameters for the player.
 */

const defaultConfig = {
    // Physical & Logic
    maxHealth: 100,
    walkSpeed: 0.11,
    rotationSpeed: 0.065,
    gravity: -0.02,
    jumpVelocity: 0.42,
    fallDamageThreshold: 0.5,

    // Visuals & Parts
    visuals: {
        colors: {
            torso: 0x808080,
            limbs: 0x808080,
            legs: 0x808080,
            head: 0x808080
        },
        dimensions: {
            legW: 15.9664,
            legH: 38.0,
            legD: 15.9664,
            torsoW: 31.9949,
            torsoH: 38.0,
            torsoD: 15.9664,
            armW: 15.9664,
            armH: 38.0,
            armD: 15.9664,
            headScale: 0.68,
            modelScale: 0.032
        },
        material: {
            metalness: 0.03,
            roughness: 0.18,
            clearcoat: 0.3,
            clearcoatRoughness: 0.6,
            reflectivity: 0.6,
            envMapIntensity: 0.6
        },
        decal: {
            scaleX: 0.98,
            scaleY: 0.98,
            offsetZ: 0.001
        }
    },

    // Animation Parameters
    animation: {
        walkSpeed: 0.18,
        walkSwingMax: Math.PI * 0.24,
        idleSpeed: 0.012,
        idleSwingMax: Math.PI * 0.015,
        smoothing: 0.42,
        armSmoothing: 0.55,
        jumpRotation: Math.PI * 0.78,
        landingHoldMs: 120
    }
};

let _config = JSON.parse(JSON.stringify(defaultConfig));
let _health = _config.maxHealth;

const PlayerModule = {
    getConfig() { return _config; },
    setConfig(newCfg = {}) { 
        // Deep merge logic simplified for this structure
        Object.keys(newCfg).forEach(key => {
            if (typeof newCfg[key] === 'object' && _config[key] !== undefined) {
                Object.assign(_config[key], newCfg[key]);
            } else {
                _config[key] = newCfg[key];
            }
        });
        return _config; 
    },

    getHealth() { return _health; },
    setHealth(v) { 
        _health = Math.max(0, Math.min((_config.maxHealth || 100), Number(v) || 0)); 
        return _health; 
    },
    changeHealth(delta) { return this.setHealth((_health || 0) + Number(delta || 0)); },

    reset() {
        _config = JSON.parse(JSON.stringify(defaultConfig));
        _health = _config.maxHealth;
    },

    init(opts = {}) {
        if (opts.config) this.setConfig(opts.config);
        if (typeof opts.health !== 'undefined') this.setHealth(opts.health);
        else this.setHealth(_config.maxHealth);
    }
};

export default PlayerModule;