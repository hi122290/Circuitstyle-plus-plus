// ─── Game catalog: genre data + thousands of generated games ────────────────
// Every game entry is deterministic from its seed so cards, thumbnails and
// the generated place all stay stable between page loads.

import { getGenreLayout } from './genres/index.js?v=4';

export const GENRES = [
    'roleplay', 'fps', 'wild-west', 'obby', 'tycoon', 'horror', 'racing',
    'fighting', 'adventure', 'sandbox', 'tower-defense', 'medieval', 'scifi',
    'survival', 'military', 'escape', 'comedy', 'sports', 'music', 'building'
];

export const GENRE_LABELS = {
    'roleplay': 'Roleplay',
    'fps': 'FPS',
    'wild-west': 'Wild West',
    'obby': 'Obby',
    'tycoon': 'Tycoon',
    'horror': 'Horror',
    'racing': 'Racing',
    'fighting': 'Fighting',
    'adventure': 'Adventure',
    'sandbox': 'Sandbox',
    'tower-defense': 'Tower Defense',
    'medieval': 'Medieval',
    'scifi': 'Sci-Fi',
    'survival': 'Survival',
    'military': 'Military',
    'escape': 'Escape',
    'comedy': 'Comedy',
    'sports': 'Sports',
    'music': 'Music',
    'building': 'Building'
};

export const GENRE_TOOLS = {
    'fps': 'missile',
    'wild-west': 'missile',
    'military': 'missile',
    'fighting': 'sword',
    'medieval': 'sword',
    'roleplay': 'brick',
    'building': 'brick',
    'sandbox': 'brick',
    'comedy': 'brick',
    'adventure': 'slingshot',
    'survival': 'slingshot',
    'horror': 'slingshot',
    'escape': 'slingshot'
};

// npc: calm = nobody fights (friends + neutrals only), attack = combat heavy
// items: the ONLY backpack items granted in that genre ('' = nothing)
// teams/ball/money: sports teams + ball physics, tycoon cash pads
// npcKind: what the place's NPCs look like (see NPC_KINDS in npcs.js)
export const GENRE_PLAY = {
    'roleplay': { npc: 'calm', items: ['brick'], npcKind: 'villager' },
    'fps': { npc: 'attack', items: ['missile', 'marbles', 'bomb', 'sword', 'slingshot'], npcKind: 'soldier' },
    'wild-west': { npc: 'attack', items: ['missile', 'slingshot', 'sword'], npcKind: 'cowboy' },
    'obby': { npc: 'calm', items: [], npcKind: 'villager' },
    'tycoon': { npc: 'calm', items: ['brick'], money: true, npcKind: 'villager' },
    'horror': { npc: 'attack', items: ['slingshot', 'bomb'], npcKind: 'ghost' },
    'racing': { npc: 'calm', items: [], npcKind: 'villager' },
    'fighting': { npc: 'attack', items: ['sword'], npcKind: 'villager' },
    'adventure': { npc: 'calm', items: ['slingshot', 'sword'], npcKind: 'villager' },
    'sandbox': { npc: 'calm', items: ['brick', 'sword', 'slingshot', 'marbles'], npcKind: 'villager' },
    'tower-defense': { npc: 'attack', items: ['missile', 'slingshot'], npcKind: 'zombie' },
    'medieval': { npc: 'attack', items: ['sword'], npcKind: 'knight' },
    'scifi': { npc: 'attack', items: ['missile', 'marbles', 'bomb'], npcKind: 'robot' },
    'survival': { npc: 'attack', items: ['sword', 'slingshot'], npcKind: 'zombie' },
    'military': { npc: 'attack', items: ['missile', 'bomb', 'marbles', 'sword'], npcKind: 'soldier' },
    'escape': { npc: 'attack', items: [], npcKind: 'zombie' },
    'comedy': { npc: 'calm', items: ['brick', 'marbles'], npcKind: 'villager' },
    'sports': { npc: 'calm', items: [], teams: true, ball: true, npcKind: 'villager' },
    'music': { npc: 'calm', items: [], npcKind: 'villager' },
    'building': { npc: 'calm', items: ['brick'], npcKind: 'villager' }
};

export function getGenrePlay(genre) {
    return GENRE_PLAY[genre] || null;
}

// ── signature custom weapons UGC games ship with ────────────────────────────
const UCG_DEFS = {
    bazooka: {
        name: 'Bazooka', description: 'Fires a rocket that explodes downrange.',
        color: '#ff6a2a',
        equipCode: `game.toast(tool.name + ' ready — F to fire');`,
        activateCode: `const p = game.localPlayer;
const b = game.spawnPart({ type: 'box', name: 'Rocket', color: tool.color || '#ff6a2a',
  position: [p.position.x, p.position.y + 1.2, p.position.z - 1.5],
  scale: [0.25, 0.25, 0.6], collidable: false });
game.toast(tool.name + ' — FIRE!');
const iv = game.every(0.07, () => { b.translate(0, 0, -2.2); });
game.after(0.55, () => {
  game.cancel(iv);
  b.color = '#ffd24a';
  game.toast('BOOM!');
  game.after(0.18, () => b.destroy());
});`
    },
    medkit: {
        name: 'Medkit', description: 'Patches you up for 25 health.',
        color: '#3fd06a',
        equipCode: `game.toast('Grabbed the ' + tool.name);`,
        activateCode: `game.localPlayer.heal(25);
game.toast(tool.name + ': +25 health');`
    },
    hammer: {
        name: 'Golden Hammer', description: 'Drops a block in front of you.',
        color: '#e8c547',
        equipCode: `game.toast(tool.name + ' equipped');`,
        activateCode: `const p = game.localPlayer;
const b = game.spawnPart({ type: 'box', name: 'Block', color: tool.color || '#e8c547',
  position: [p.position.x, p.position.y + 0.5, p.position.z - 2.5],
  scale: [1, 0.5, 1] });
game.toast('Placed a block!');
game.after(3, () => b.destroy());`
    },
    swoosh: {
        name: 'Iron Blade', description: 'A mighty swing.',
        color: '#c9d2e0',
        equipCode: `game.toast(tool.name + ' drawn');`,
        activateCode: `game.text('SWOOSH!', { size: 44, color: '#ffffe1', y: 150 });
game.toast(tool.name + ' swings!');
game.after(0.7, () => game.clearTexts());`
    },
    snack: {
        name: 'Snack', description: 'A quick bite: +15 health.',
        color: '#ffb84d',
        equipCode: `game.toast('Mmm, ' + tool.name);`,
        activateCode: `game.localPlayer.heal(15);
game.toast(tool.name + ': +15 health');`
    }
};

const GENRE_UCG = {
    'fps': 'bazooka', 'wild-west': 'bazooka', 'military': 'bazooka', 'scifi': 'bazooka',
    'horror': 'medkit', 'survival': 'medkit', 'escape': 'medkit', 'tower-defense': 'medkit',
    'medieval': 'swoosh', 'fighting': 'swoosh',
    'tycoon': 'hammer'
};

export function genreUcgTool(genre) {
    const key = GENRE_UCG[genre] || 'snack';
    const def = UCG_DEFS[key];
    return Object.assign({ id: 'ut_' + key }, def);
}

export const CATALOG_SIZE = 3000;

function mulberry32(a) {
    return function () {
        a |= 0;
        a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const CREATORS = [
    'builderman123', 'xX_Sniper_Xx', 'PizzaDude11', 'Guest404', 'NoobSlayer64',
    'SuperBuilder07', 'darklord99', 'qwerty123gamer', 'ilikepie33', 'ShadowNinja07',
    'cooldude111', 'EpicFace420', 'xX_DarkSlayer_Xx', 'bobtheguy12', 'MasterOFGames',
    'legofan2007', 'YourWorstNoob', 'SonicFan99', 'CoolKid124', 'TheRealNinja77',
    'mrpotatohead77', 'F4ST_C4R', 'ImNotABoT', 'RetroRina', 'WindowsVistaKid',
    'soldier121212', 'PrincessSparkle', 'n00bgamer09', 'BlockHeadSam', 'some_random_guy44'
];

const ADJ = [
    'Epic', 'Super', 'Mega', 'Ultimate', 'Awesome', 'Crazy', 'Insane', 'Best',
    'Cool', 'Extreme', 'Legendary', 'Ninja', 'Shadow', 'Dark', 'Rainbow',
    'Frozen', 'Fire', 'Golden', 'Mystery', 'Ultra', 'Turbo', 'Robo'
];

const PLACES = [
    'Castle', 'Island', 'City', 'Mountain', 'Fort', 'Village', 'Base',
    'Arena', 'Town', 'Baseplate', 'Lava Land', 'Ocean', 'Desert', 'Factory',
    'School', 'House', 'Kingdom', 'Valley', 'Harbor', 'Mine'
];

const TYPOS = {
    'fight': 'figt', 'battle': 'battel', 'roleplay': 'rolplay', 'adventure': 'adventrue',
    'the': 'teh', 'your': 'ur', 'awesome': 'awsum', 'legendary': 'legandary',
    'defence': 'deffense', 'defense': 'defnce', 'castle': 'castel', 'ninja': 'ninjia',
    'survival': 'survial', 'explorer': 'exploreor', 'tower': 'towr', 'racing': 'racin'
};

const TITLE_BANKS = {
    'roleplay': [
        '{A} Roleplay', 'Roleplay Town {N}', '{A} Life Roleplay', 'Roleplay: {P}',
        'Town of {P}', 'My Roleplay World {N}', '{P} Roleplay!!', 'Live in {P} {N}'
    ],
    'fps': [
        '{A} FPS', 'Gun Game {N}', 'FPS Battle {N}', 'Shootout at {P}',
        '{A} Shooter', 'Team Deathmatch {N}', 'NoScope Arena {N}', 'FPS {N}v{N}'
    ],
    'wild-west': [
        'Wild West {N}', '{A} Outlaw Showdown', 'Gunfight at {P}', 'Wild West Roleplay',
        'Cowboy Showdown {N}', 'Saloon Brawl {N}', 'Desperado Town {N}', 'Duel in {P}'
    ],
    'obby': [
        '{A} Obby', 'Jump Over {N} Levels!!', 'Hardest Obby Ever {N}', 'Tower of {P}',
        'Obby {N} stages', '{A} Parkour {N}', 'Dont Fall! {N}', 'Mega Obby {N}'
    ],
    'tycoon': [
        '{A} Tycoon', 'Make Money Tycoon {N}', '{P} Tycoon', 'Free Money Tycoon!!',
        'Mega Tycoon {N}', 'Build a Business {N}', 'Cash Tycoon {N}', '{A} Factory Tycoon'
    ],
    'horror': [
        'Scary Maze {N}', 'Do NOT Play This {N}', '{P} Horror', 'Escape the {A} Ghost',
        'Horror House {N}', 'The {A} Room', 'Dont Turn Around {N}', 'Creepy {P} {N}'
    ],
    'racing': [
        '{A} Race {N}', 'Speed Racer {N}', 'Nascar-style Race', 'Race to {P}',
        'Mega Raceway {N}', 'Drag Race {N}', '{A} Kart Race', 'Fastest Car Race {N}'
    ],
    'fighting': [
        'Fight Club {N}', '{A} Fighting Game', '1v1 Me {N}', 'Sword Fight at {P}',
        'Ultimate Fight {N}', 'Boxing Match {N}', 'Battle Arena {N}', '{A} Brawl'
    ],
    'adventure': [
        'Explore {P} {N}', '{A} Adventure', 'Quest for {P}', 'Lost City of {N}',
        '{A} Journey {N}', 'Find the Treasure {N}', 'Adventure Map {N}', 'Secret of {P}'
    ],
    'sandbox': [
        '{A} Sandbox', 'Build Anything {N}', 'Free Build Sandbox', 'Sandbox of {P}',
        'Mega Sandbox {N}', 'Creative World {N}', 'Build and Fight {N}', 'Sandbox {N}'
    ],
    'tower-defense': [
        'Tower Defense {N}', 'Defend the {P}', '{A} TD', 'Zombie Tower Defense {N}',
        'Epic TD {N}', 'Defense Line {N}', 'Tower Defense vs {A} Enemy', 'TD Map {N}'
    ],
    'medieval': [
        'Castle Siege {N}', '{A} Kingdom', 'Medieval War {N}', 'Knights of {P}',
        'Siege the Castle {N}', 'Dragon Attack {N}', '{A} Knight Fight', 'Medieval Town {N}'
    ],
    'scifi': [
        'Space Base {N}', '{A} Space Battle', 'Alien World {N}', 'Laser Fight {N}',
        'Robot Wars {N}', 'Galaxy Tycoon {N}', '{A} Sci-Fi Arena', 'Planet {P} {N}'
    ],
    'survival': [
        'Survive {P} {N}', 'Last One Alive {N}', 'Zombie Survival {N}', 'Survival Island {N}',
        '{A} Survival', 'Survive the Night {N}', 'Cave Survival {N}', 'Wild {P} Survival'
    ],
    'military': [
        'Army Base {N}', '{A} War Game', 'Boot Camp {N}', 'Special Ops {N}',
        'War at {P}', 'Military Training {N}', '{A} Battle {N}', 'Sniper Zone {N}'
    ],
    'escape': [
        'Escape Room {N}', 'Escape from {P}', 'Jail Break {N}', 'Prison Escape {N}',
        'Impossible Escape {N}', 'Escape the {A} Maze', 'Break Out {N}', 'Cell Block {N}'
    ],
    'comedy': [
        'Silly Obby {N}', 'Trolling Game {N}', 'Funny Moments {N}', 'The Dumbest Game {N}',
        'Random Chaos {N}', 'Joke House {N}', 'Epic Fail Simulator {N}', 'Goofy World {N}'
    ],
    'sports': [
        'Soccer {N}v{N}', 'Basketball Hoops {N}', 'Football Match {N}', 'Sports Arena {N}',
        'Hockey Game {N}', 'Volleyball {N}', 'Mini Golf {N}', 'Race Day Sports {N}'
    ],
    'music': [
        'Dance Party {N}', 'Music Studio {N}', 'Beat Battle {N}', 'Concert at {P}',
        'DJ Arena {N}', 'Sing Off {N}', 'Rhythm Game {N}', 'Club {N}'
    ],
    'building': [
        'Build Battle {N}', 'Best Build Contest {N}', 'Building Competition {N}',
        'Build Your House {N}', 'Mega Build {N}', 'Showcase Build {N}', 'Build Off {N}', 'House Contest {N}'
    ]
};

const GENERIC_DESCS = [
    'rate 5 stars please!!!', 'made this in like 2 hours lol', 'PLZ RATE AND SUBCRIBE',
    'my first game please be nice', 'its pretty good i think', 'UPDATED: added new stuff!!',
    'DONT BULLY', 'comment what u want next', 'this took me all day', 'have fun!!! :D',
    'please play i worked hard', '10/10 game trust me', 'tell ur friends about this game',
    'i got bored so i made this', 'working on part 2 soon!!', 'noobs not allowed lol',
    'best game on circuitstyle',     'sorry for lag my pc is bad',
    'LIKE AND FAVORITE PLS', 'i spent 3 hours on this, worth it?'
];

const GENRE_DESCS = {
    'roleplay': ['become a cop or robber!!', 'u can be anything u want', 'bring ur friends', 'houses are ready!!'],
    'fps': ['1v1 me no quickscoping', 'guns are in the shop', 'no lag i promise', 'best aim wins'],
    'wild-west': ['its like a western but blocky', 'draw ur gun partner', 'saloon is open', 'outlaws vs sheriffs'],
    'obby': ['jump and dont fall!!!', 'stage 20 is impossible', 'obby but harder', 'checkponts are saved'],
    'tycoon': ['free cash button', 'dont steal my money lol', 'upgrade everything', 'tycoon but its fast'],
    'horror': ['dont play alone at night', 'it chases you...', 'headphones on = scarier', 'find the exit'],
    'racing': ['fastest car wins', 'dont crash on turn 3', 'lap times are saved', 'nitro is OP'],
    'fighting': ['sword or fists ur choice', 'no spawn killing pls', 'last man standing', '1v1 me bro'],
    'adventure': ['find all the gems', 'secrets everywhere', 'follow the path', 'treasure is hidden'],
    'sandbox': ['build whatever u want', 'no rules just bricks', 'purple bricks are rare', 'free build forever'],
    'tower-defense': ['place towers wisely', 'waves get hard at 10', 'money per kill', 'dont let them through'],
    'medieval': ['knights vs dragons', 'storm the gates', 'swords only', 'the king needs u'],
    'scifi': ['laser guns only', 'aliens invade at wave 5', 'space suits provided', 'zero gravity zone'],
    'survival': ['eat or be eaten', 'night is dangerous', 'craft a shelter', 'zombies spawn at dark'],
    'military': ['mission: take the base', 'snipers on the roof', 'team play only', 'ammo is limited'],
    'escape': ['solve the puzzles', 'keys are hidden', 'doors open with codes', 'time limit1 min'],
    'comedy': ['its dumb on purpose', 'trolling allowed', 'nothing makes sense', 'lol'],
    'sports': ['score to win', 'no hacking scores', 'pick ur team', 'halftime at 2 mins'],
    'music': ['drop the beat', 'dance off in the middle', 'laser lights!!', 'song requests in chat'],
    'building': ['theme is announced in chat', '10 mins to build', 'vote for best build', 'bricks provided']
};

const TITLE_SUFFIX = ['', '', '', '', '!!', '!!!', ' v{N}', ' (UPDATED)', ' - NEW MAP', '!!', ' ({N})'];

let _catalog = null;
let _byId = null;

function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function applyTypos(str, rng) {
    if (rng() > 0.35) return str;
    return str.split(' ').map((w) => {
        const low = w.toLowerCase().replace(/[^a-z]/g, '');
        return TYPOS[low] && rng() < 0.7 ? w.replace(new RegExp(low, 'i'), TYPOS[low]) : w;
    }).join(' ');
}

function buildTitle(genre, rng) {
    const bank = TITLE_BANKS[genre] || TITLE_BANKS.sandbox;
    let t = pick(rng, bank)
        .replace(/\{A\}/g, () => pick(rng, ADJ))
        .replace(/\{P\}/g, () => pick(rng, PLACES))
        .replace(/\{N\}/g, () => String(1 + Math.floor(rng() * 999)));
    const prefix = rng() < 0.08 ? pick(rng, ['PLZ RATE5 ', 'EPIC ', 'THE ', 'MY ']) : '';
    t = prefix + t + pick(rng, TITLE_SUFFIX).replace('{N}', () => String(2 + Math.floor(rng() * 9)));
    return applyTypos(t, rng);
}

function buildDescription(genre, rng) {
    const parts = [pick(rng, GENRE_DESCS[genre] || GENERIC_DESCS)];
    if (rng() < 0.6) parts.push(pick(rng, GENERIC_DESCS));
    if (rng() < 0.25) parts.push('sub for part2');
    return parts.join(' ');
}

function buildPlayers(rng) {
    const roll = rng();
    if (roll < 0.75) return 1 + Math.floor(rng() * 40);
    if (roll < 0.94) return 40 + Math.floor(rng() * 220);
    return 260 + Math.floor(rng() * 740);
}

export function getCatalog() {
    if (_catalog) return _catalog;
    _catalog = [];
    _byId = {};
    for (let seed = 1; seed <= CATALOG_SIZE; seed++) {
        const rng = mulberry32(seed * 2654435761);
        const genre = GENRES[Math.floor(rng() * GENRES.length)];
        const entry = {
            seed,
            id: 'cat_' + seed.toString(36),
            genre,
            title: buildTitle(genre, rng),
            creator: pick(rng, CREATORS) + (rng() < 0.6 ? String(Math.floor(rng() * 99)) : ''),
            description: buildDescription(genre, rng),
            players: buildPlayers(rng),
            rating: Math.round(42 + rng() * 57),
            thumb: {
                sky: pick(rng, ['#78b9ef', '#9fd4ff', '#f9d9a0', '#b9e0ff', '#ffd9a0', '#a8e6a0']),
                ground: pick(rng, ['#4f9f43', '#3ca040', '#c2a55a', '#8a8a8a', '#5c7d3a', '#d0b070']),
                blocks: [pick(rng, ['#d95555', '#5577d9', '#e0b040', '#55b06a', '#b055c9', '#e8e8e8'])]
            }
        };
        entry.thumb.blocks.push(pick(rng, ['#d95555', '#5577d9', '#e0b040', '#55b06a', '#b055c9', '#e8e8e8']));
        if (rng() < 0.7) entry.thumb.blocks.push(pick(rng, ['#d95555', '#5577d9', '#e0b040', '#55b06a', '#b055c9', '#e8e8e8']));
        _catalog.push(entry);
        _byId[entry.id] = entry;
    }
    return _catalog;
}

export function getCatalogEntry(id) {
    getCatalog();
    if (_byId[id]) return _byId[id];
    const m = /^cat_([0-9a-z]+)$/i.exec(id || '');
    if (m) {
        const seed = parseInt(m[1], 36);
        if (seed >= 1 && seed <= CATALOG_SIZE) return getCatalog()[seed - 1];
    }
    return null;
}

export function thumbDataUri(entry) {
    const t = entry.thumb;
    const rng = mulberry32(entry.seed * 97);
    const bx = [];
    for (let i = 0; i < t.blocks.length; i++) {
        const w = 14 + Math.floor(rng() * 26);
        const h = 10 + Math.floor(rng() * 30);
        const x = 8 + Math.floor(rng() * (160 - w - 16));
        const y = 84 - h;
        bx.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + t.blocks[i] + '"/>');
    }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">' +
        '<rect width="160" height="120" fill="' + t.sky + '"/>' +
        '<circle cx="' + (24 + Math.floor(rng() * 110)) + '" cy="18" r="9" fill="#fff8c0"/>' +
        '<rect y="84" width="160" height="36" fill="' + t.ground + '"/>' +
        bx.join('') +
        '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ─── place generation ───────────────────────────────────────────────────────

function makeHelpers(rng) {
    let n = 0;
    const P = (type, position, scale, color, extra) => {
        n++;
        const def = {
            id: 'p' + n,
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
    return { P, rng };
}

function baseGround(P, color, texture) {
    return P('ground', [0, -0.5, 0], [1, 1, 1], color, { texture });
}

function spawnPad(P) {
    return P('box', [0, 0.3, 0], [1.4, 0.3, 1.4], '#d95555', { spawn: true });
}

function scatter(P, rng, colors, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push(P('box',
            [-14 + rng() * 28, 0.6 + rng() * 1.4, -14 + rng() * 28],
            [0.5 + rng() * 1.2, 0.5 + rng() * 1.4, 0.5 + rng() * 1.2],
            colors[Math.floor(rng() * colors.length)],
            { rotation: [0, rng() * 0.8 - 0.4, 0] }));
    }
    return out;
}

function tree(P, x, z, leafColor) {
    return [
        P('cylinder', [x, 1.4, z], [0.3, 0.7, 0.3], '#7a5230'),
        P('box', [x, 3.6, z], [1.5, 1.2, 1.5], leafColor || '#3f8f3f')
    ];
}

function layoutFor(genre, rng) {
    // genre modules own their map generator (see modules/genres/README list
    // in the main README) — the switch below is only the fallback map
    const custom = getGenreLayout(genre, rng);
    if (custom) {
        if (!custom.some((p) => p.spawn)) custom.push(spawnPad(makeHelpers(rng).P));
        return custom;
    }
    const { P } = makeHelpers(rng);
    const parts = [];
    const GROUND = {
        'wild-west': ['#c2a55a', 'grass'], 'horror': ['#4a4a4a', 'studs'],
        'racing': ['#4f9f43', 'grass'], 'sports': ['#43904a', 'grass'],
        'military': ['#7d8757', 'grass'], 'survival': ['#c9b078', 'grass']
    };
    const g = GROUND[genre] || ['#4f9f43', 'grass'];

    switch (genre) {
        case 'roleplay': {
            parts.push(baseGround(P, g[0], g[1]));
            const wx = -6, wz = -4;
            parts.push(P('box', [wx, 1.5, wz - 5], [6, 1.5, 0.2], '#e8d9b0'));
            parts.push(P('box', [wx - 5, 1.5, wz], [0.2, 1.5, 5], '#e8d9b0'));
            parts.push(P('box', [wx + 5, 1.5, wz], [0.2, 1.5, 5], '#e8d9b0'));
            parts.push(P('box', [wx - 3.5, 1.5, wz + 5], [1.6, 1.5, 0.2], '#e8d9b0'));
            parts.push(P('box', [wx + 3.5, 1.5, wz + 5], [1.6, 1.5, 0.2], '#e8d9b0'));
            parts.push(P('box', [wx, 3.4, wz + 5], [2.4, 0.4, 0.2], '#e8d9b0'));
            parts.push(P('box', [wx, 4.4, wz], [6.4, 0.6, 6.4], '#c05050'));
            parts.push(P('box', [8, 0.06, 0], [1.6, 0.1, 9], '#5a5a5a', { texture: 'studs' }));
            for (let i = -3; i <= 3; i++) parts.push(P('box', [8, 0.1, i * 2.6], [0.16, 0.1, 1], '#f0f0e0'));
            parts.push(...tree(P, -13, 6), ...tree(P, 13, -8), ...tree(P, 12, 9, '#4f9f3f'));
            parts.push(P('box', [0, 0.6, 8], [1, 1, 1], '#55a0d9'));
            break;
        }
        case 'fps': {
            parts.push(baseGround(P, '#7d8757', 'grass'));
            parts.push(P('box', [0, 3, -18], [14, 3, 0.3], '#8a8a7a'));
            parts.push(P('box', [-14, 2, -4], [0.3, 2, 14], '#8a8a7a'));
            parts.push(P('box', [14, 2, -4], [0.3, 2, 14], '#8a8a7a'));
            for (let i = 0; i < 5; i++) {
                const x = -10 + i * 5;
                parts.push(P('box', [x, 1.2, -14], [0.2, 1.2, 0.2], '#666666'));
                parts.push(P('box', [x, 2.8, -14], [1, 1, 0.2], '#d94444'));
            }
            for (let i = 0; i < 7; i++) {
                parts.push(P('box', [-11 + rng() * 22, 0.8 + rng() * 0.8, -8 + rng() * 16],
                    [1.2, 1.2, 1.2], '#9a7b4f', { rotation: [0, rng(), 0] }));
            }
            parts.push(P('box', [0, 0.7, 10], [10, 0.7, 1], '#5d6b3f'));
            parts.push(...scatter(P, rng, ['#9a7b4f', '#6b6b5a'], 3));
            break;
        }
        case 'wild-west': {
            parts.push(baseGround(P, g[0], g[1]));
            parts.push(P('box', [0, 2.5, -9], [7, 2.5, 0.3], '#8a5a30'));
            parts.push(P('box', [-6, 1.8, -5], [0.3, 1.8, 4], '#8a5a30'));
            parts.push(P('box', [6, 1.8, -5], [0.3, 1.8, 4], '#8a5a30'));
            parts.push(P('box', [0, 5.4, -6.5], [7.4, 0.5, 6], '#6e4526'));
            parts.push(P('box', [0, 4, -9], [3, 1, 0.2], '#d9b060'));
            for (let i = -1; i <= 1; i++) parts.push(P('cylinder', [i * 4.4, 1.6, -3.6], [0.22, 0.8, 0.22], '#6e4526'));
            for (let i = 0; i < 5; i++) {
                parts.push(P('cylinder', [-13 + rng() * 26, 1.3, -2 + rng() * 14], [0.4, 1.3, 0.4], '#3f8f3f'));
            }
            parts.push(P('box', [9, 0.7, 4], [2.4, 0.7, 1], '#7a5230'));
            parts.push(P('box', [9, 1.05, 4], [2, 0.1, 0.8], '#5580c9', { material: 'Glass' }));
            parts.push(...scatter(P, rng, ['#c8a868', '#8a5a30'], 4));
            break;
        }
        case 'obby': {
            parts.push(baseGround(P, '#4a4a4a', 'studs'));
            parts.push(P('box', [0, 0.15, 0], [13, 0.3, 13], '#d94444', { material: 'Neon' }));
            parts.push(P('box', [0, 1, 0], [3.4, 0.4, 3.4], '#5577d9', { spawn: true }));
            for (let i = 0; i < 9; i++) {
                const step = i + 1;
                parts.push(P('box',
                    [Math.sin(step * 1.1) * (4 + step * 1.3), 1.4 + step * 1.15, Math.cos(step * 1.1) * (4 + step * 1.1)],
                    [1.7, 0.4, 1.7],
                    ['#55b06a', '#e0b040', '#5577d9', '#b055c9'][i % 4]));
            }
            parts.push(P('box', [Math.sin(10 * 1.1) * 17, 13.4, Math.cos(10 * 1.1) * 15], [2.6, 0.5, 2.6], '#e8d040'));
            parts.push(P('box', [0, 4, -16], [0.4, 4, 0.4], '#f0f0e0'));
            break;
        }
        case 'tycoon': {
            parts.push(baseGround(P, '#6b8f4f', 'grass'));
            parts.push(P('box', [0, 0.3, 0], [9, 0.3, 9], '#9a9a9a'));
            parts.push(P('box', [0, 0.6, 0], [3, 0.3, 3], '#55b06a', { spawn: true }));
            for (let i = -1; i <= 1; i++) {
                parts.push(P('box', [i * 5, 1.4, -7], [0.5, 1.4, 0.5], '#777777'));
                parts.push(P('box', [i * 5, 3.1, -7], [2, 0.9, 2], '#5577d9'));
                parts.push(P('box', [i * 5, 0.5, -2], [2, 0.4, 4.4], '#444444'));
            }
            parts.push(P('box', [7, 0.35, 5], [3, 0.35, 3], '#55d970', { material: 'Neon', special: 'cash' }));
            parts.push(P('box', [-7, 2, 6], [2.6, 2, 1.6], '#d9b060'));
            parts.push(...scatter(P, rng, ['#9a9a9a', '#d9b060'], 4));
            break;
        }
        case 'horror': {
            parts.push(baseGround(P, g[0], g[1]));
            const walls = [[-6, -6, 4, 0], [0, -9, 6, 0], [6, -4, 4, 1], [-8, 2, 3, 1], [4, 6, 5, 0], [-2, 9, 4, 0]];
            for (const w of walls) {
                parts.push(P('box', [w[0], 1.6, w[1]], [w[2], 1.6, 0.3], '#5a5a5a',
                    { rotation: [0, w[3] ? 1.2 : 0, 0] }));
            }
            parts.push(P('box', [0, 1.8, -13], [5, 1.8, 0.3], '#3f3f3f'));
            parts.push(P('box', [-1.6, 1, -13], [1.4, 1, 0.3], '#3f3f3f'));
            parts.push(P('cylinder', [10, 1.8, -8], [0.3, 1.4, 0.3], '#333333'));
            parts.push(P('cylinder', [-11, 1.6, 7], [0.3, 1.2, 0.3], '#333333'));
            parts.push(P('box', [10, 3.6, -8], [1.4, 1, 1.4], '#2e2e2e'));
            parts.push(P('box', [11, 0.5, 10], [1.4, 0.5, 1.4], '#d94444', { material: 'Neon' }));
            parts.push(...scatter(P, rng, ['#5a5a5a', '#3f3f3f'], 5));
            break;
        }
        case 'racing': {
            parts.push(baseGround(P, g[0], g[1]));
            const seg = (x, z, ry) => P('box', [x, 0.1, z], [16, 0.2, 3.4], '#3f3f45', { rotation: [0, ry, 0] });
            parts.push(seg(0, -13, 0), seg(0, 13, 0), seg(-15, 0, Math.PI / 2), seg(15, 0, Math.PI / 2));
            for (const gate of [[0, -13], [0, 13]]) {
                parts.push(P('box', [gate[0] - 2.2, 1.6, gate[1]], [0.3, 1.6, 0.3], '#e8e8e8'));
                parts.push(P('box', [gate[0] + 2.2, 1.6, gate[1]], [0.3, 1.6, 0.3], '#e8e8e8'));
                parts.push(P('box', [gate[0], 3.3, gate[1]], [2.4, 0.3, 0.3], '#d95555'));
            }
            for (let i = 0; i < 6; i++) {
                parts.push(P('box', [-17 + i * 6.6, 0.5, -16.6], [1.4, 0.5, 0.6], '#222222'));
            }
            parts.push(P('box', [0, 0.3, 0], [3.2, 0.3, 3.2], '#5577d9', { spawn: true }));
            break;
        }
        case 'fighting': {
            parts.push(baseGround(P, '#c9b078', 'grass'));
            parts.push(P('cylinder', [0, 0.7, 0], [4.4, 0.35, 4.4], '#9a8f7a'));
            parts.push(P('cylinder', [0, 1.1, 0], [3.4, 0.15, 3.4], '#8a7f6a'));
            for (const c of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
                parts.push(P('cylinder', [c[0], 1.5, c[1]], [0.3, 1.5, 0.3], '#d95555'));
            }
            parts.push(P('box', [-10, 0.4, 8], [1.2, 0.4, 1.2], '#d94444', { material: 'Neon' }));
            parts.push(P('box', [10, 0.4, 8], [1.2, 0.4, 1.2], '#5577d9', { material: 'Neon' }));
            parts.push(P('box', [0, 1.7, 0], [0.9, 0.5, 0.9], '#e8d040', { spawn: true }));
            parts.push(...scatter(P, rng, ['#9a8f7a', '#7a5230'], 5));
            break;
        }
        case 'adventure': {
            parts.push(baseGround(P, '#6b8f4f', 'grass'));
            for (let i = 0; i < 6; i++) {
                const x = -10 + i * 4;
                parts.push(P('cylinder', [x, 1.7, -6 + (i % 2) * 3], [0.55, 1.7, 0.55], '#b0b0a8',
                    { rotation: [0, 0, (i % 3 === 0) ? 0.18 : 0] }));
            }
            parts.push(P('box', [-3, 0.5, -3], [4, 0.5, 0.5], '#b0b0a8', { rotation: [0, 0.5, 0] }));
            parts.push(P('box', [10, 0.4, 7], [2.2, 0.1, 2.2], '#4d90d9', { material: 'Glass' }));
            parts.push(P('box', [-9, 0.7, 9], [1.4, 0.6, 0.9], '#7a5230'));
            parts.push(P('box', [-9, 1.15, 9], [1.2, 0.3, 0.7], '#e8d040'));
            parts.push(...tree(P, 6, 11), ...tree(P, -13, -10));
            parts.push(...scatter(P, rng, ['#b0b0a8', '#7a5230'], 5));
            break;
        }
        case 'sandbox': {
            parts.push(baseGround(P, '#46a046', 'grass'));
            const colors = ['#d95555', '#5577d9', '#e0b040', '#55b06a', '#b055c9', '#e8e8e8'];
            for (let i = 0; i < 16; i++) {
                parts.push(P('box',
                    [-9 + rng() * 18, 0.6 + i * 0.45, -9 + rng() * 18],
                    [1.6, 0.5, 1.6],
                    colors[i % colors.length],
                    { rotation: [0, rng() * 1.5, 0] }));
            }
            parts.push(P('box', [10, 1, 8], [0.3, 1, 0.3], '#7a5230'));
            parts.push(P('box', [10, 2.4, 8], [3, 1, 0.2], '#f0f0e0'));
            parts.push(...scatter(P, rng, colors, 6));
            break;
        }
        case 'tower-defense': {
            parts.push(baseGround(P, '#6b8f4f', 'grass'));
            const path = [[-14, -8], [-4, -8], [-4, 4], [6, 4], [6, -6], [14, -6]];
            for (let i = 0; i < path.length - 1; i++) {
                const a = path[i], b = path[i + 1];
                const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
                const w = Math.abs(b[0] - a[0]) + 3, d = Math.abs(b[1] - a[1]) + 3;
                parts.push(P('box', [cx, 0.1, cz], [Math.max(w, 3), 0.2, Math.max(d, 3)], '#c2a55a'));
            }
            for (const t of [[-8, -14], [2, -2], [-8, 10], [11, 2]]) {
                parts.push(P('box', [t[0], 0.5, t[1]], [3, 1, 3], '#8a8a8a'));
            }
            parts.push(P('box', [-14, 1.6, -14], [0.3, 1.6, 0.3], '#d95555'));
            parts.push(P('box', [-11, 1.6, -14], [0.3, 1.6, 0.3], '#d95555'));
            parts.push(P('box', [-12.5, 3.3, -14], [1.8, 0.3, 0.3], '#d95555'));
            parts.push(P('box', [15, 1.4, -6], [1, 2.4, 1], '#55d9e0', { material: 'Neon' }));
            parts.push(P('box', [0, 0.4, 13], [2.6, 0.4, 2.6], '#5577d9', { spawn: true }));
            break;
        }
        case 'medieval': {
            parts.push(baseGround(P, '#6b8f4f', 'grass'));
            parts.push(P('box', [0, 2, -11], [11, 2, 0.5], '#9a9a90'));
            parts.push(P('box', [-4, 2, -11], [3, 2, 0.5], '#9a9a90', { color: '#8a8a80' }));
            parts.push(P('box', [8, 2, -11], [3, 2, 0.5], '#9a9a90', { color: '#8a8a80' }));
            parts.push(P('box', [0, 4.4, -11], [11, 0.5, 0.7], '#7a7a70'));
            parts.push(P('box', [0, 2, 11], [11, 2, 0.5], '#9a9a90'));
            parts.push(P('box', [-11, 2, 0], [0.5, 2, 11], '#9a9a90'));
            parts.push(P('box', [11, 2, 0], [0.5, 2, 11], '#9a9a90'));
            for (const c of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
                parts.push(P('cylinder', [c[0], 3, c[1]], [1.3, 3, 1.3], '#8a8a80'));
            }
            parts.push(P('box', [0, 6.5, -11], [0.2, 1.6, 0.2], '#7a5230'));
            parts.push(P('box', [1.2, 7.4, -11], [1.6, 0.8, 0.1], '#d94444'));
            parts.push(P('box', [0, 1.4, 0], [4, 1.4, 4], '#b0b0a8'));
            parts.push(P('box', [0, 3.2, 0], [4.6, 0.5, 4.6], '#5577d9', { spawn: true }));
            break;
        }
        case 'scifi': {
            parts.push(baseGround(P, '#3a3f52', 'studs'));
            parts.push(P('box', [0, 0.3, 0], [8, 0.3, 8], '#5a6478'));
            for (let i = -1; i <= 1; i += 2) {
                parts.push(P('box', [i * 6, 0.35, 0], [1.2, 0.3, 14], '#55d9e0', { material: 'Neon' }));
            }
            for (const p of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
                parts.push(P('cylinder', [p[0], 2.4, p[1]], [0.7, 2.4, 0.7], '#8899bb', { material: 'Glass' }));
            }
            parts.push(P('box', [0, 1.8, -10], [3.4, 1.4, 1], '#2e3448'));
            parts.push(P('box', [0, 2, -9.4], [2.6, 0.7, 0.2], '#55e06a', { material: 'Neon' }));
            parts.push(P('box', [7, 2.4, 7], [2.4, 0.5, 2.4], '#c955d9', { material: 'Neon' }));
            parts.push(P('box', [0, 1, 0], [2.6, 0.4, 2.6], '#5577d9', { spawn: true }));
            parts.push(...scatter(P, rng, ['#5a6478', '#8899bb'], 4));
            break;
        }
        case 'survival': {
            parts.push(baseGround(P, g[0], g[1]));
            parts.push(P('cylinder', [-5, 0.5, 4], [1.1, 0.2, 1.1], '#7a5230'));
            parts.push(P('cylinder', [-5, 0.9, 4], [0.5, 0.2, 0.5], '#e07830', { material: 'Neon' }));
            for (let i = 0; i < 5; i++) {
                parts.push(P('box', [-12 + rng() * 24, 0.7, -12 + rng() * 24],
                    [1 + rng() * 1.4, 0.8, 1 + rng() * 1.2], '#8a8a8a', { rotation: [0, rng(), 0] }));
            }
            parts.push(P('box', [7, 1.4, -6], [3.4, 1.4, 0.2], '#7a5230', { rotation: [0, 0.4, 0] }));
            parts.push(P('box', [9.5, 1.1, -4], [0.2, 1.1, 3], '#7a5230', { rotation: [0, 0.4, 0] }));
            parts.push(...tree(P, -10, -8), ...tree(P, 11, 8, '#4f8f3f'));
            parts.push(...scatter(P, rng, ['#7a5230', '#8a8a8a'], 4));
            break;
        }
        case 'military': {
            parts.push(baseGround(P, g[0], g[1]));
            for (let i = 0; i < 3; i++) {
                parts.push(P('box', [-9 + i * 9, 0.6, -7], [5, 0.6, 1], '#6e7a4a'));
                parts.push(P('box', [-9 + i * 9, 1.4, -7.4], [5, 0.4, 0.9], '#5d6b3f'));
            }
            parts.push(P('box', [7, 1.4, 6], [4, 1.4, 3], '#8a8a7a'));
            parts.push(P('box', [7, 1.2, 7.6], [1.4, 0.9, 0.2], '#3f3f3f'));
            for (const t of [[-10, 10], [11, -2]]) {
                parts.push(P('box', [t[0], 2.2, t[1]], [0.3, 2.2, 0.3], '#7a5230'));
                parts.push(P('box', [t[0], 4.7, t[1]], [2.2, 0.3, 2.2], '#7a5230'));
            }
            for (let i = 0; i < 3; i++) {
                parts.push(P('box', [-4 + i * 5, 0.7, 8], [2.6, 0.3, 0.3], '#5d6b3f', { rotation: [0, 0.8, 0] }));
            }
            parts.push(...scatter(P, rng, ['#6e7a4a', '#8a8a7a'], 4));
            break;
        }
        case 'escape': {
            parts.push(baseGround(P, '#8a8a8a', 'studs'));
            const wall = (x, z, w, d, ry) => parts.push(P('box', [x, 1.6, z], [w, 1.6, d], '#b0b0b8',
                { rotation: [0, ry || 0, 0] }));
            wall(0, -12, 24, 0.4); wall(0, 12, 24, 0.4); wall(-12, 0, 0.4, 24); wall(12, 0, 0.4, 24);
            wall(-6, -6, 0.4, 12); wall(-6, 4, 6, 0.4); wall(0, 0, 12, 0.4); wall(6, -4, 0.4, 8); wall(6, 6, 6, 0.4);
            parts.push(P('box', [-6, 1, 10], [1, 1, 0.2], '#e8d040', { material: 'Neon' }));
            parts.push(P('box', [6, 1, -10], [1, 1, 0.2], '#e8d040', { material: 'Neon' }));
            parts.push(P('box', [11.4, 1.6, 6], [0.4, 3, 3], '#55d96a', { material: 'Neon' }));
            parts.push(P('box', [0, 0.3, 10], [2.6, 0.4, 2.6], '#5577d9', { spawn: true }));
            break;
        }
        case 'comedy': {
            parts.push(baseGround(P, '#55b0c9', 'grass'));
            parts.push(P('cylinder', [-7, 4, -5], [1.6, 4, 1.6], '#e8d040', { rotation: [0, 0, 0.5] }));
            parts.push(P('box', [6, 2.6, -7], [4, 2.6, 4], '#b055c9'));
            parts.push(P('box', [6, 5.6, -7], [4.6, 0.6, 4.6], '#e0b040'));
            for (let i = 0; i < 7; i++) {
                parts.push(P('box', [-12 + rng() * 24, 1 + rng() * 3, -12 + rng() * 24],
                    [1.4, 1 + rng() * 5, 1.4],
                    ['#d95555', '#5577d9', '#e0b040', '#55b06a', '#b055c9'][i % 5],
                    { rotation: [rng() * 0.4, rng(), rng() * 0.4] }));
            }
            parts.push(P('box', [0, 1.2, 7], [3, 1.2, 3], '#e8a0d0'));
            parts.push(P('box', [0, 2.7, 7], [2, 0.3, 2], '#ffffff'));
            parts.push(...scatter(P, rng, ['#d95555', '#e0b040', '#55b0c9'], 5));
            break;
        }
        case 'sports': {
            parts.push(baseGround(P, g[0], g[1]));
            parts.push(P('box', [0, 0.06, 0], [0.25, 0.1, 22], '#f0f0e0'));
            parts.push(P('box', [0, 0.06, 0], [18, 0.1, 0.25], '#f0f0e0'));
            for (const side of [-1, 1]) {
                const z = side * 14;
                parts.push(P('box', [-3, 1.6, z], [0.3, 1.6, 0.3], '#f0f0e0'));
                parts.push(P('box', [3, 1.6, z], [0.3, 1.6, 0.3], '#f0f0e0'));
                parts.push(P('box', [0, 3.2, z], [3.2, 0.3, 0.3], '#f0f0e0'));
            }
            parts.push(P('box', [-9, 0.8, -18], [8, 0.6, 2], '#8a7f6a'));
            parts.push(P('box', [-9, 1.6, -19], [8, 0.4, 1.4], '#7a6f5a'));
            parts.push(P('box', [14, 0.3, 14], [2.6, 0.3, 2.6], '#5577d9', { spawn: true }));
            parts.push(P('sphere', [0, 0.75, 0], [0.5, 0.5, 0.5], '#f0f0f0', { special: 'ball', collidable: false }));
            parts.push(P('box', [0, 2, -14.3], [1.75, 2, 0.4], '#ff00ff',
                { special: 'goal-red', collidable: false, visible: false }));
            parts.push(P('box', [0, 2, 14.3], [1.75, 2, 0.4], '#00ffff',
                { special: 'goal-blue', collidable: false, visible: false }));
            break;
        }
        case 'music': {
            parts.push(baseGround(P, '#3f3f5a', 'studs'));
            parts.push(P('box', [0, 1, -8], [8, 1, 4], '#2e2e3f'));
            for (const s of [[-6, -8], [6, -8], [-9, 6], [9, 6]]) {
                parts.push(P('box', [s[0], 1.6, s[1]], [1.8, 3.2, 1.4], '#222233'));
                parts.push(P('cylinder', [s[0], 2, s[1] + 0.75], [0.6, 0.6, 0.2], '#44445a', { rotation: [Math.PI / 2, 0, 0] }));
            }
            const dance = ['#d95555', '#5577d9', '#e0b040', '#55b06a', '#b055c9', '#55d9e0'];
            for (let i = 0; i < 6; i++) {
                parts.push(P('box', [-4 + (i % 3) * 4, 0.2, 4 + Math.floor(i / 3) * 4],
                    [1.8, 0.3, 1.8], dance[i], { material: 'Neon' }));
            }
            for (const l of [[-8, -14], [8, -14]]) {
                parts.push(P('cylinder', [l[0], 3, l[1]], [0.3, 3, 0.3], '#55556a'));
                parts.push(P('box', [l[0], 6.2, l[1]], [1.4, 0.4, 0.4], '#c955d9', { material: 'Neon' }));
            }
            parts.push(P('box', [0, 2.3, -8], [2.6, 0.4, 2.6], '#e8d040', { spawn: true }));
            break;
        }
        case 'building': {
            parts.push(baseGround(P, '#46a046', 'grass'));
            parts.push(P('box', [0, 0.1, 0], [14, 0.2, 14], '#d9d9d9'));
            const colors = ['#d95555', '#5577d9', '#e0b040', '#55b06a', '#b055c9', '#e8e8e8', '#e08040'];
            for (let i = 0; i < 22; i++) {
                parts.push(P('box',
                    [-11 + rng() * 22, 0.6 + rng() * (i * 0.28), -11 + rng() * 22],
                    [1.2 + rng() * 2, 0.5, 1.2 + rng() * 2],
                    colors[i % colors.length],
                    { rotation: [0, rng() * Math.PI, 0] }));
            }
            parts.push(P('box', [10, 1.5, 10], [0.3, 1.5, 0.3], '#7a5230'));
            parts.push(P('box', [10, 3.4, 10], [4, 1.4, 0.2], '#f0f0e0'));
            parts.push(...scatter(P, rng, colors, 6));
            break;
        }
        default: {
            parts.push(baseGround(P, g[0], g[1]));
            parts.push(...scatter(P, rng, ['#d95555', '#5577d9', '#e0b040'], 8));
            break;
        }
    }

    const hasSpawn = parts.some((p) => p.spawn);
    if (!hasSpawn) parts.push(spawnPad(P));
    return parts;
}

export function buildCatalogPlace(entry) {
    const rng = mulberry32(entry.seed * 1000003);
    const parts = layoutFor(entry.genre, rng);
    const play = GENRE_PLAY[entry.genre];
    // haunted/survival/etc maps spawn their themed NPCs from marker parts
    const kind = (play && play.npcKind) || 'villager';
    if (kind !== 'villager') {
        const n = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
            const x = Math.round((rng() * 2 - 1) * 10);
            const z = Math.round((rng() * 2 - 1) * 10);
            parts.push({
                id: 'npcsp' + i,
                name: 'NPC: ' + kind.charAt(0).toUpperCase() + kind.slice(1),
                type: 'box',
                parent: null,
                position: [x, 1, z],
                rotation: [0, 0, 0],
                scale: [0.4, 1, 0.4],
                color: '#7ae582',
                texture: 'none',
                material: 'Neon',
                collidable: false,
                visible: true,
                damage: 0,
                spawn: false,
                special: 'npc',
                npcKind: kind,
                npcCount: 3,
                scripts: []
            });
        }
    }
    // every catalog game ships one signature weapon so playing feels complete
    const tool = genreUcgTool(entry.genre);
    return {
        schema: 'circuitstyle-place@1',
        id: entry.id,
        name: entry.title,
        description: entry.description,
        genre: entry.genre,
        creator: entry.creator,
        catalog: true,
        mainMenu: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnail: null,
        parts,
        scripts: [],
        tools: [tool],
        startTools: [tool.id]
    };
}
