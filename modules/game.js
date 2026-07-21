import * as THREE from 'three';

// Minimal game module: removed cutscene, enemy, and sequence logic per request.
// Expose a lightweight update function to be called from main loop.

let SCENE, CAMERA, RENDERER, WORLD, PLAYER, hooks = {};

export function setupGame(scene, camera, renderer, world, player, gameHooks) {
    SCENE = scene;
    CAMERA = camera;
    RENDERER = renderer;
    WORLD = world;
    PLAYER = player;
    hooks = gameHooks || {};
    // No sequence, no enemy; keep API minimal.
    return {
        // no-op startSequence removed
        updateGameLogic: function() {
            // preserve any non-enemy periodic effects if needed later,
            // currently intentionally empty to remove cutscene/enemy behavior.
        },
        spawnEnemy: () => {}, // removed behavior; kept silent no-op for compatibility
        setEnemyTriggered: () => {}
    };
}

