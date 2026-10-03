# Circuitstyle

Roblox-style sandbox game with a 3000-game genre catalog. Play at
`https://hi122290.github.io/Circuitstyle-plus-plus/`.

## Genre systems

Every genre gets its own map generator, core systems, HUD and win/lose loop.
Dedicated genre modules live in `modules/genres/` — one file per genre plus a
shared core (`core.js`: registry, lifecycle, HUD/save helpers, base-HUD
toggling). Adding a genre means adding one module file and one import line in
`modules/genres/index.js`; no other genre has to change.

| Genre | Map | Core systems | HUD |
| --- | --- | --- | --- |
| Tycoon | Business plot: conveyor line, dropper tower, collector bin, buy pads, rebirth pad, office, fenced yard, road | Cash/IPS economy, 4 upgrades bought with pads or shop buttons, dropping cash cubes on the belt, rebirth (resets upgrades, x1.5 income each), offline earnings up to 8 h, per-place save | Top-center cash + income/s + rebirth counter, right-side upgrade shop with greyed-out buttons, floating price labels over pads |
| Racing | One of 3 seeded closed circuits (Sunset Speedway, Peanut Loop, Harbor Circuit) with asphalt segments, start/finish checker + gantry, curbs, grandstand, floodlights, jump ramp, infield props | Arcade car physics, W/S/A/D + Shift nitro, off-track grass slowdown, ramp jumps, 4-car field with AI drivers, rubber-banding, quarter checkpoints, 3 laps, 3-2-1-GO countdown, live rank, results screen, best-time save | Top-center lap/position/time/best chips, canvas speedometer with needle, canvas minimap, nitro bar, center countdown, results panel |
| Horror | Tight single-floor mansion: front-door foyer, spine corridor, 7 rooms, wardrobe hideouts, glowing notes, graveyard yard, dead trees | Flashlight on F with battery drain/recharge, monster patrol/chase AI with wall sliding, contact jumpscare + damage + teleport, hide in wardrobes on E, 3 notes then key then escape win, sanity meter (decays in the dark, restored by light), dimmed lights + exponential fog + flickering lamps | Top-left status cluster (light battery, health, notes, key), top-center objective line, bottom-center nerve bar, sanity vignette, hiding indicator, flash overlay, escape results panel |
| FPS | Walled training range: sand floor, hazard lane stripes, sandbag cover, shipping containers, watchtower, tire stacks, shooting stalls, floodlights, scoreboard, flag pair | 90-second score-attack round (3-2-1-GO), +100 per hostile soldier kill, 4-second streak multiplier (STREAK x2+), 1200-point clear target, killfeed, hostile replenishment at 6 via NPC spawn points, win on target / lose on timer, best-score + clears save | Center crosshair, top-center score + goal + timer + streak pill, right-side killfeed, hostiles counter, big countdown numerals, clear/time-up results panel (keeps base hotbar — weapon slots are the shooter HUD) |
| Sports | Field with goals | Ball physics, teams, goals, `special:'cash'` Circuitbuckz pads | Base HUD + score chip |
| Roleplay, Wild West, Obby, Adventure, Sandbox, Tower Defense, Medieval, Sci-Fi, Survival, Military, Escape, Comedy, Music, Building | Legacy per-genre catalog map (fallback generator in `game_catalog.js`) | Shared genre profile: NPC mood (calm/attack), themed NPC kind, restricted item loadout, signature UGC weapon, power/keyboard systems | Base HUD (health, backpack, chat, player list) |
| All | Filter only — no map or system of its own | | |

`modules/genres/core.js` exposes the registry (`registerGenre`),
`getGenreLayout` (used by `game_catalog.layoutFor` before its legacy switch),
and the lifecycle (`initGenre` / `updateGenre` / `disposeGenre`) driven from
`main.js`. Runtime hook for tests/debug: `window._genreRuntime`
(`{ id, state, actions }`).
