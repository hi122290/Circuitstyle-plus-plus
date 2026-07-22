import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupAudio, playSound, stopBackground, startBackground } from './modules/audio.js';
import { setupWorld } from './modules/world.js';
import { setupPlayer } from './modules/player.js';
import { setupUI, renderPlayerList, updateUIElementPositions, renderHealthBar } from './modules/ui.js';
import { setupGame } from './modules/game.js';
import PlayerModule from './modules/PlayerModule.js';
import { backpack, ITEM_DATA } from './modules/backpack.js';
import Global from './modules/Global.js';
import { registerStencilHelper } from './modules/stencil_shadows_adapter.js';
import { setupMobileControls, isMobile } from './modules/mobile_controls.js';
import { appendChatMessage } from './modules/safechat.js';
import { initBuildUI, showBuildUI, hideBuildUI, spawnRemoteBuild, updateBuildGhost, showGhost, hideGhost, deleteBlockByMesh, deleteBlockById, findBlockAtPoint, stampBuild, toggleSaveMenu, closeSaveMenu } from './modules/build.js';

window.THREE_REF = THREE;

if (typeof WebsimSocket === 'undefined') {
    const PEERJS_HOST_ID = 'circuitstyle-global';
    class LocalSocket {
        constructor() {
            this.clientId = null;
            this.peers = {};
            this.presence = {};
            this.onmessage = null;
            this._presenceSubscribers = [];
            this._collections = {};
            this._chatSubscribers = {};
            this._peer = null;
            this._isHost = false;
            this._hostConn = null;
            this._clientConns = {};
            this._lastPresence = {};
            this._intentionalClose = false;
            this._reconnectDelay = 2000;
            this._maxReconnectDelay = 15000;
            this._pingInterval = null;
            this._statusEl = null;
            this._initializing = false;
            this._reconnectTimer = null;
            this._buildHistory = [];
            this._createStatusIndicator();
        }

        _createStatusIndicator() {
            const el = document.createElement('div');
            el.id = 'connection-status';
            el.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;padding:4px 14px;border-radius:4px;font-family:"Comic Sans MS",cursive;font-size:12px;color:#fff;background:rgba(0,0,0,0.7);pointer-events:none;opacity:0;transition:opacity 0.3s;display:none;';
            document.body.appendChild(el);
            this._statusEl = el;
        }

        _showStatus(text, color, duration) {
            if (!this._statusEl) return;
            this._statusEl.textContent = text;
            this._statusEl.style.background = color;
            this._statusEl.style.display = 'block';
            this._statusEl.style.opacity = '1';
            if (this._hideTimer) clearTimeout(this._hideTimer);
            if (duration) {
                this._hideTimer = setTimeout(() => {
                    this._statusEl.style.opacity = '0';
                    setTimeout(() => { this._statusEl.style.display = 'none'; }, 300);
                }, duration);
            }
        }

        _notifyPresence() {
            this._presenceSubscribers.forEach(cb => { try { cb(); } catch(e) {} });
        }

        _handleMessage(msg) {
            switch (msg.type) {
                case 'welcome':
                    this.clientId = msg.id;
                    this.peers[msg.id] = { username: msg.username };
                    this.presence[msg.id] = {};
                    (msg.players || []).forEach(p => {
                        if (p.id !== msg.id) {
                            this.peers[p.id] = { username: p.username };
                            this.presence[p.id] = p.presence || {};
                        }
                    });
                    if (msg.buildHistory && msg.buildHistory.length > 0) {
                        this._pendingBuildHistory = msg.buildHistory;
                    }
                    if (this._lastPresence && Object.keys(this._lastPresence).length > 0) {
                        this.send({ type: 'presence', data: this._lastPresence });
                        this.presence[this.clientId] = this._lastPresence;
                    }
                    this._notifyPresence();
                    break;
                case 'player_join':
                    this.peers[msg.id] = { username: msg.username };
                    if (msg.onlineCount) this._showStatus(`${msg.onlineCount} player${msg.onlineCount > 1 ? 's' : ''} online`, 'rgba(0,0,0,0.6)', 2500);
                    this._notifyPresence();
                    break;
                case 'player_leave':
                    delete this.peers[msg.id];
                    delete this.presence[msg.id];
                    this._notifyPresence();
                    break;
                case 'presence':
                    if (msg.id !== this.clientId) {
                        this.presence[msg.id] = msg.data || {};
                        this._notifyPresence();
                    }
                    break;
                case 'chat':
                    (this._chatSubscribers['chat_v3'] || []).forEach(cb => {
                        try { cb({ id: msg.id, username: msg.username, message: msg.message, color: msg.color }); } catch(e) {}
                    });
                    break;
            }
            if (this.onmessage) {
                try { this.onmessage({ data: msg }); } catch(e) {}
            }
        }

        _broadcastToClients(msg, excludeId) {
            const data = JSON.stringify(msg);
            Object.entries(this._clientConns).forEach(([id, conn]) => {
                if (id !== excludeId && conn.open) {
                    try { conn.send(data); } catch(e) {}
                }
            });
        }

        _getOnlineCount() {
            return Object.keys(this._clientConns).length + 1;
        }

        _scheduleReconnect() {
            if (this._intentionalClose || this._initializing) return;
            if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
            console.log(`[Peer] Reconnecting in ${this._reconnectDelay / 1000}s...`);
            this._showStatus('Reconnecting...', 'rgba(200,100,0,0.85)');
            this._reconnectTimer = setTimeout(() => {
                this._reconnectTimer = null;
                this.initialize().catch(() => {});
            }, this._reconnectDelay);
            this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, this._maxReconnectDelay);
        }

        _cleanup() {
            this._stopPing();
            if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
            if (this._peer) {
                try { this._peer.removeAllListeners(); this._peer.destroy(); } catch(e) {}
                this._peer = null;
            }
            this._hostConn = null;
            this._clientConns = {};
        }

        async initialize() {
            if (this._initializing) return;
            this._initializing = true;
            this._intentionalClose = false;
            this._showStatus('Connecting...', 'rgba(0,100,200,0.85)');

            try {
                await this._doConnect();
            } catch(e) {
                console.error('[Peer] Initialize error:', e);
            } finally {
                this._initializing = false;
            }
        }

        _doConnect() {
            this._cleanup();
            return new Promise((resolve) => {
                if (typeof Peer === 'undefined') {
                    console.error('[Peer] PeerJS library not loaded');
                    this._showStatus('Multiplayer unavailable', 'rgba(200,0,0,0.85)', 5000);
                    resolve();
                    return;
                }
                this._tryPeerJS(resolve);
            });
        }

        _tryPeerJS(resolve) {
            const peerConfig = {
                host: '0.peerjs.com',
                port: 443,
                path: '/',
                secure: true,
                config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
            };

            const connectTimeout = setTimeout(() => {
                if (!this.clientId) {
                    console.log('[Peer] Connection timeout');
                    this._showStatus('Connection timeout', 'rgba(200,0,0,0.85)');
                    this._scheduleReconnect();
                    resolve();
                }
            }, 10000);

            try {
                const peer = new Peer(PEERJS_HOST_ID, peerConfig);
                this._peer = peer;

                peer.on('open', (id) => {
                    clearTimeout(connectTimeout);
                    this._reconnectDelay = 2000;
                    console.log('[Peer] Became host with ID:', id);
                    this._isHost = true;
                    this.clientId = id;
                    this.peers[id] = { username: window.currentPlayerName || 'Player' };
                    this.presence[id] = {};
                    this._showStatus('Connected (host)', 'rgba(0,150,0,0.85)', 2500);
                    this._notifyPresence();
                    this._startPing();
                    resolve();
                });

                peer.on('error', (err) => {
                    clearTimeout(connectTimeout);
                    if (err.type === 'unavailable-id') {
                        console.log('[Peer] Host exists, joining as client');
                        this._cleanup();
                        this._joinAsClient(peerConfig, resolve);
                    } else {
                        console.warn('[Peer] Error:', err.type);
                        this._showStatus('Connection error: ' + err.type, 'rgba(200,0,0,0.85)', 4000);
                        this._scheduleReconnect();
                        resolve();
                    }
                });

                peer.on('connection', (conn) => {
                    this._handleIncomingConnection(conn);
                });

                peer.on('disconnected', () => {
                    if (!this._intentionalClose) {
                        console.log('[Peer] Disconnected from signaling');
                        this._showStatus('Reconnecting to signaling...', 'rgba(200,100,0,0.85)');
                        if (this._peer && !this._peer.destroyed) this._peer.reconnect();
                    }
                });

                peer.on('close', () => {
                    if (!this._intentionalClose && this.clientId) {
                        console.log('[Peer] Connection lost');
                        this._showStatus('Connection lost', 'rgba(200,0,0,0.85)');
                        this.clientId = null;
                        this._isHost = false;
                        this._peer = null;
                        this._scheduleReconnect();
                        resolve();
                    }
                });
            } catch(e) {
                clearTimeout(connectTimeout);
                console.error('[Peer] Init error:', e);
                this._scheduleReconnect();
                resolve();
            }
        }

        _joinAsClient(peerConfig, resolve) {
            console.log('[Peer] Joining as client, connecting to host:', PEERJS_HOST_ID);

            const peer = new Peer(undefined, peerConfig);
            this._peer = peer;

            const connectTimeout = setTimeout(() => {
                if (!this.clientId) {
                    console.log('[Peer] Client timeout');
                    this._showStatus('Connection timeout', 'rgba(200,0,0,0.85)');
                    this._scheduleReconnect();
                    resolve();
                }
            }, 10000);

            peer.on('open', (id) => {
                console.log('[Peer] Got client peer ID:', id);
                this._reconnectDelay = 2000;
                const conn = peer.connect(PEERJS_HOST_ID, { reliable: true });
                this._hostConn = conn;

                conn.on('open', () => {
                    console.log('[Peer] Data channel to host opened');
                    this._showStatus('Connected', 'rgba(0,150,0,0.85)', 2000);
                    this._startPing();
                });

                conn.on('data', (data) => {
                    let msg;
                    try { msg = typeof data === 'string' ? JSON.parse(data) : data; } catch(e) { return; }

                    if (msg.type === 'welcome') {
                        clearTimeout(connectTimeout);
                        this.clientId = msg.id;
                        this.peers[msg.id] = { username: window.currentPlayerName || msg.username || 'Player' };
                        this.presence[msg.id] = {};
                        (msg.players || []).forEach(p => {
                            if (p.id !== msg.id) {
                                this.peers[p.id] = { username: p.username };
                                this.presence[p.id] = p.presence || {};
                            }
                        });
                        if (msg.buildHistory && msg.buildHistory.length > 0) {
                            this._pendingBuildHistory = msg.buildHistory;
                        }
                        if (this._lastPresence && Object.keys(this._lastPresence).length > 0) {
                            this.send({ type: 'presence', data: this._lastPresence });
                            this.presence[this.clientId] = this._lastPresence;
                        }
                        this._notifyPresence();
                        resolve();
                    } else {
                        this._handleMessage(msg);
                    }
                });

                conn.on('close', () => {
                    clearTimeout(connectTimeout);
                    console.log('[Peer] Lost connection to host');
                    this._showStatus('Host disconnected', 'rgba(200,0,0,0.85)');
                    this.peers = {};
                    this.presence = {};
                    this._clientConns = {};
                    this._hostConn = null;
                    this.clientId = null;
                    this._isHost = false;
                    this._notifyPresence();
                    this._scheduleReconnect();
                    resolve();
                });

                conn.on('error', (err) => {
                    console.warn('[Peer] Data channel error:', err);
                });
            });

            peer.on('error', (err) => {
                clearTimeout(connectTimeout);
                console.warn('[Peer] Client peer error:', err.type);
                this._showStatus('Connection error: ' + err.type, 'rgba(200,0,0,0.85)', 4000);
                this._scheduleReconnect();
                resolve();
            });

            peer.on('disconnected', () => {
                if (!this._intentionalClose && this._peer && !this._peer.destroyed) {
                    this._peer.reconnect();
                }
            });

            peer.on('close', () => {
                clearTimeout(connectTimeout);
                if (!this._intentionalClose && this.clientId) {
                    this.clientId = null;
                    this._isHost = false;
                    this._peer = null;
                    this._scheduleReconnect();
                    resolve();
                }
            });
        }

        _handleIncomingConnection(conn) {
            conn.on('open', () => {
                const newId = conn.peer;
                console.log('[Peer] New client connected:', newId);
                this._clientConns[newId] = conn;

                const welcomePlayers = Object.entries(this._clientConns).map(([id, c]) => ({
                    id,
                    username: this.peers[id]?.username || 'Player',
                    presence: this.presence[id] || {}
                }));
                welcomePlayers.push({
                    id: this.clientId,
                    username: this.peers[this.clientId]?.username || 'Player',
                    presence: this.presence[this.clientId] || {}
                });

                conn.send(JSON.stringify({
                    type: 'welcome',
                    id: newId,
                    username: 'Player',
                    onlineCount: this._getOnlineCount(),
                    players: welcomePlayers,
                    buildHistory: this._buildHistory
                }));

                this.peers[newId] = { username: 'Player' };
                this.presence[newId] = {};

                this._broadcastToClients({
                    type: 'player_join',
                    id: newId,
                    username: 'Player',
                    onlineCount: this._getOnlineCount()
                }, newId);

                this._showStatus(`${this._getOnlineCount()} player${this._getOnlineCount() > 1 ? 's' : ''} online`, 'rgba(0,0,0,0.6)', 2500);
                this._notifyPresence();
            });

            conn.on('data', (data) => {
                let msg;
                try { msg = typeof data === 'string' ? JSON.parse(data) : data; } catch(e) { return; }
                const senderId = conn.peer;

                switch (msg.type) {
                    case 'set_username':
                        if (this.peers[senderId]) {
                            this.peers[senderId].username = (msg.username || '').slice(0, 20) || this.peers[senderId].username;
                            this._broadcastToClients({
                                type: 'player_join',
                                id: senderId,
                                username: this.peers[senderId].username,
                                onlineCount: this._getOnlineCount()
                            });
                        }
                        break;

                    case 'presence':
                        if (this.peers[senderId]) {
                            this.presence[senderId] = msg.data || {};
                            if (msg.data && msg.data.lastBuild) {
                                this._buildHistory.push(msg.data.lastBuild);
                            }
                            this._broadcastToClients({
                                type: 'presence',
                                id: senderId,
                                data: msg.data
                            }, senderId);
                            this._notifyPresence();
                        }
                        break;

                    case 'chat':
                        if (this.peers[senderId] && msg.message) {
                            this._broadcastToClients({
                                type: 'chat',
                                id: senderId,
                                username: this.peers[senderId].username,
                                message: String(msg.message).slice(0, 200),
                                color: (msg.color || '#ffffff').slice(0, 7)
                            });
                            this._handleMessage({
                                type: 'chat',
                                id: senderId,
                                username: this.peers[senderId].username,
                                message: String(msg.message).slice(0, 200),
                                color: (msg.color || '#ffffff').slice(0, 7)
                            });
                        }
                        break;
                }
            });

            conn.on('close', () => {
                const leftId = conn.peer;
                console.log('[Peer] Client disconnected:', leftId);
                delete this._clientConns[leftId];
                delete this.peers[leftId];
                delete this.presence[leftId];
                this._broadcastToClients({
                    type: 'player_leave',
                    id: leftId,
                    onlineCount: Math.max(0, this._getOnlineCount())
                });
                this._showStatus(`${this._getOnlineCount()} player${this._getOnlineCount() > 1 ? 's' : ''} online`, 'rgba(0,0,0,0.6)', 2500);
                this._notifyPresence();
            });

            conn.on('error', (err) => {
                console.warn('[Peer] Host connection error for', conn.peer, ':', err);
            });
        }

        _startPing() {
            this._stopPing();
            this._pingInterval = setInterval(() => {
                this.send({ type: 'ping' });
            }, 15000);
        }

        _stopPing() {
            if (this._pingInterval) {
                clearInterval(this._pingInterval);
                this._pingInterval = null;
            }
        }

        send(data) {
            if (this._isHost) {
                this._broadcastToClients(data);
            } else if (this._hostConn && this._hostConn.open) {
                try { this._hostConn.send(JSON.stringify(data)); } catch(e) {}
            }
        }

        updatePresence(data) {
            if (!this.clientId) return;
            const username = (typeof window !== 'undefined' && window.currentPlayerName) || this.peers[this.clientId]?.username || 'Player';
            if (this.peers[this.clientId]) this.peers[this.clientId].username = username;
            this.presence[this.clientId] = data;
            this._lastPresence = { ...data };
            if (data && data.lastBuild) {
                this._buildHistory.push(data.lastBuild);
            }
            this.send({ type: 'presence', data });
            this._notifyPresence();
        }

        subscribePresence(cb) {
            this._presenceSubscribers.push(cb);
        }

        collection(name) {
            if (!this._collections[name]) {
                const self = this;
                this._collections[name] = {
                    _subscribers: [],
                    create(data) {
                        self.send({ type: 'chat', message: data.message, username: data.username, color: data.color });
                    },
                    subscribe(cb) {
                        this._subscribers.push(cb);
                        if (!self._chatSubscribers[name]) self._chatSubscribers[name] = [];
                        self._chatSubscribers[name].push(cb);
                    }
                };
            }
            return this._collections[name];
        }
    }
    window.WebsimSocket = LocalSocket;
}

let scene, camera, renderer;
let ambientLight, directionalLight;
let world, player, game;
let isDead = false;
const playerStats = { kills: 0, wipeouts: 0 };
let _hiddenTicker = null;
// Combat events that need to survive exactly one presence broadcast before being cleared
const _pendingPresence = {};
window._pendingPresence = _pendingPresence;

 const room = new WebsimSocket();
 window.room = room;

// tiny retry helper so bad internet connections doen’t insta-fail init. fn = async, attempts = tries, delayMs = pause between, hope it helps
async function retryAsync(fn, attempts = 3, delayMs = 500) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            // small chill-time before we try again
            await new Promise(res => setTimeout(res, delayMs * (1 + i)));
        }
    }
    throw lastErr;
}

// 1 random color per session soh you don’t look exactly the sameh every rejoin! :P
window.currentPlayerColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
const remotePlayers = new Map();

// Restore username from place_select.html login
try {
    const savedUser = localStorage.getItem('cs_username');
    if (savedUser) window.currentPlayerName = savedUser;
} catch(e) {}

PlayerModule.init();
try { window.playerHealth = PlayerModule.getHealth(); } catch (e) { window.playerHealth = 100; }

const TARGET_DT = Global.render.targetDt;
let lastFrameTime = 0;

// grab the lighting numbers straight out of thy (yes i love using "thy" it's a very cool word) Lua file (no full Lua VM, jst regex magic!)
async function loadLightingFromLua(path = './modules/lighting.lua') {
    try {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) throw new Error('failed to fetch lua lighting');
        const src = await res.text();

        // basic numeric scraping, nothing too fancy
        const ambientMatch = src.match(/ambient\s*=\s*\{\s*r\s*=\s*([0-9]*\.?[0-9]+)\s*,\s*g\s*=\s*([0-9]*\.?[0-9]+)\s*,\s*b\s*=\s*([0-9]*\.?[0-9]+)\s*,\s*intensity\s*=\s*([0-9]*\.?[0-9]+)\s*\}/m);
        const dirMatch = src.match(/directional\s*=\s*\{\s*r\s*=\s*([0-9]*\.?[0-9]+)\s*,\s*g\s*=\s*([0-9]*\.?[0-9]+)\s*,\s*b\s*=\s*([0-9]*\.?[0-9]+)\s*,\s*intensity\s*=\s*([0-9]*\.?[0-9]+)\s*,\s*position\s*=\s*\{\s*x\s*=\s*([0-9\-]*\.?[0-9]+)\s*,\s*y\s*=\s*([0-9\-]*\.?[0-9]+)\s*,\s*z\s*=\s*([0-9\-]*\.?[0-9]+)\s*\}\s*\}/m);
        const shadowsMatch = src.match(/shadows\s*=\s*(true|false)/m);

        // a some lil' extra fields we also read out of that lua blob so you know...
        const toneMapMatch = src.match(/tone_mapping\s*=\s*"([^"]+)"/m);
        const exposureMatch = src.match(/exposure\s*=\s*([0-9]*\.?[0-9]+)/m);
        const outputSRGBMatch = src.match(/output_srgb\s*=\s*(true|false)/m);
        const textureFilterMatch = src.match(/texture_filter\s*=\s*"([^"]+)"/m);

        const lighting = {
            ambient: { r: 0.9, g: 0.9, b: 0.9, intensity: 1.0 },
            directional: { r: 1, g: 1, b: 1, intensity: 2.0, position: { x: 5, y: 10, z: 7.5 } },
            shadows: false,
            // defaults if Lua doesn’t say anything special (aka fails)
            tone_mapping: 'ACES',
            exposure: 1.0,
            output_srgb: true,
            texture_filter: 'Linear'
        };

        if (ambientMatch) {
            lighting.ambient.r = parseFloat(ambientMatch[1]);
            lighting.ambient.g = parseFloat(ambientMatch[2]);
            lighting.ambient.b = parseFloat(ambientMatch[3]);
            lighting.ambient.intensity = parseFloat(ambientMatch[4]);
        }
        if (dirMatch) {
            lighting.directional.r = parseFloat(dirMatch[1]);
            lighting.directional.g = parseFloat(dirMatch[2]);
            lighting.directional.b = parseFloat(dirMatch[3]);
            lighting.directional.intensity = parseFloat(dirMatch[4]);
            lighting.directional.position.x = parseFloat(dirMatch[5]);
            lighting.directional.position.y = parseFloat(dirMatch[6]);
            lighting.directional.position.z = parseFloat(dirMatch[7]);
        }
        if (shadowsMatch) {
            lighting.shadows = shadowsMatch[1] === 'true';
        }

        if (toneMapMatch) lighting.tone_mapping = toneMapMatch[1];
        if (exposureMatch) lighting.exposure = parseFloat(exposureMatch[1]);
        if (outputSRGBMatch) lighting.output_srgb = outputSRGBMatch[1] === 'true';
        if (textureFilterMatch) lighting.texture_filter = textureFilterMatch[1];

        return lighting;
    } catch (e) {
        console.warn('Failed to load/parse Lua lighting, falling back to defaults', e);
        return {
            ambient: { r: 0.9, g: 0.9, b: 0.9, intensity: 1.0 },
            directional: { r: 1, g: 1, b: 1, intensity: 2.0, position: { x: 5, y: 10, z: 7.5 } },
            shadows: false,
            tone_mapping: 'ACES',
            exposure: 1.0,
            output_srgb: true,
            texture_filter: 'Linear'
        };
    }
}

async function init() {
    await room.initialize();

    // figure out who we are
    const myId = room.clientId;
    const myPeer = room.peers[myId];
    window.currentPlayerName = myPeer ? myPeer.username : 'Guest';

    // Tell the host our real username (from place_select.html login)
    if (window.currentPlayerName && window.currentPlayerName !== 'Player' && window.currentPlayerName !== 'Guest') {
        room.send({ type: 'set_username', username: window.currentPlayerName });
    }

    // le scene boot
    scene = new THREE.Scene();

    // connect thy special 3D magik
    const canvas = document.getElementById('game-canvas');
    // WebGL2 if we can get it, otherwise say nu uh and use whatever
    let gl = null;
    try {
        gl = canvas.getContext('webgl2', { antialias: true });
    } catch (e) { gl = null; }
    if (gl) {
        renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
    } else {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    }
    // respect DPR but don’t go absolutley totally wild!
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // basic hard shadows, no soft blur fanciness, just stencil shadows, juuuusstttt like 2007 ROBLOX clients, init!
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    window.renderer = renderer;
    window.camera = camera;

    // nuke any SSAO / post stuff, we want raw old-school stuff heck yea!
    try {
        renderer.userData = renderer.userData || {};
        renderer.userData.SSAOEnabled = false;
        renderer.userData.AOEnabled = false;
        renderer.userData.postProcess = renderer.userData.postProcess || {};
        renderer.userData.postProcess.SSAO = false;

        if (window.composer) {
            try {
                if (typeof window.composer.dispose === 'function') window.composer.dispose();
            } catch (e) {}
            try { delete window.composer; } catch (e) {}
        }
        try { if (window.SSAOPass) delete window.SSAOPass; } catch (e) {}
        try { if (window.ssaoPass) delete window.ssaoPass; } catch (e) {}
    } catch (e) {
        console.warn('SSAO disable pass blew up a bit, but meh, renderer is still fine', e);
    }

    // camera (tiny stubby aspect)
    camera = new THREE.PerspectiveCamera(70, 360 / 270, 0.1, 10000);
    camera.position.set(0, 4, 7);

    // pull the lighting knobs out of lua so we match the 2007 lighting or whatever as much as possible.
    let luaLighting;
    try {
        luaLighting = await retryAsync(() => loadLightingFromLua('./modules/lighting.lua'), 3, 700);
    } catch (e) {
        console.warn('Failed to load lighting.lua after retries, using fallback defaults:', e);
        luaLighting = await loadLightingFromLua('./modules/lighting.lua').catch(() => ({
            ambient: { r: 0.9, g: 0.9, b: 0.9, intensity: 1.0 },
            directional: { r: 1, g: 1, b: 1, intensity: 2.0, position: { x: 5, y: 10, z: 7.5 } },
            shadows: false,
            tone_mapping: 'ACES',
            exposure: 1.0,
            output_srgb: true,
            texture_filter: 'Linear'
        }));
    }

    // apply tone mapping / exposure / texture filter from that lua config. think it's easier that way...
    try {
        const tm = (luaLighting.tone_mapping || '').toLowerCase();
        if (tm === 'none' || tm === 'off') renderer.toneMapping = THREE.NoToneMapping;
        else if (tm === 'linear') renderer.toneMapping = THREE.LinearToneMapping || THREE.NoToneMapping;
        else if (tm === 'reinhard') renderer.toneMapping = THREE.ReinhardToneMapping || THREE.NoToneMapping;
        else renderer.toneMapping = THREE.ACESFilmicToneMapping || THREE.NoToneMapping;

        renderer.toneMappingExposure = typeof luaLighting.exposure === 'number' ? luaLighting.exposure : 1.0;

        renderer.outputEncoding = luaLighting.output_srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;

        // stash the the this so so texture loaders can see what we want!
        renderer._preferredTextureFilter = (luaLighting.texture_filter || 'Linear').toLowerCase();
    } catch (e) {
        console.warn('Lua-driven tone mapping/filter settings didn’t fully apply, but we go on...', e);
    }

    // ambient light straight from the lua becuase why not :D
    try {
        const amb = luaLighting.ambient || { r: 1, g: 1, b: 1, intensity: 1.0 };
        ambientLight = new THREE.AmbientLight(new THREE.Color(amb.r, amb.g, amb.b), amb.intensity);
        scene.add(ambientLight);
    } catch (e) {
        console.warn('Failed to create ambient light from Lua, skipping it this time', e);
    }

    // the BIG sun directional, again... from thy lua!!
    try {
        // Use the Lua intensity/position but force the light color to pure white so highlights never tint.
        // We deliberately ignore any RGB color values parsed from the Lua file and always use (1,1,1).
        const d = luaLighting.directional || { intensity: 2.0, position: { x: 5, y: 10, z: 7.5 } };

        // Create a directional "sun" whose color is explicitly locked to pure white.
        directionalLight = new THREE.DirectionalLight(new THREE.Color(1, 1, 1), d.intensity);
        if (d && d.position) directionalLight.position.set(d.position.x, d.position.y, d.position.z);

        // Make the white highlight consistent and robust:
        // - ensure the light's color stays white even if external code tries to tint it later
        // - mark a userData flag for debugging/inspection
        try { directionalLight.color.setRGB(1, 1, 1); } catch (e) {}
        directionalLight.userData = directionalLight.userData || {};
        directionalLight.userData.forceWhiteHighlight = true;

        // always cast shadows (prefer explicit boolean from Lua when provided, otherwise default true)
        directionalLight.castShadow = (typeof luaLighting.shadows === 'boolean') ? luaLighting.shadows : true;

        // configure shadow map resolution (preserve existing tuning)
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;

        const cam = directionalLight.shadow.camera;
        try {
            const halfW = (typeof window !== 'undefined' && window.world && window.world.baseWidth) ? (window.world.baseWidth / 2) : 16;
            const halfD = (typeof window !== 'undefined' && window.world && window.world.baseDepth) ? (window.world.baseDepth / 2) : 16;
            const maxHalf = Math.max(halfW, halfD) + 6.0;
            cam.left = -maxHalf;
            cam.right = maxHalf;
            cam.top = maxHalf;
            cam.bottom = -maxHalf;
        } catch (e) {
            cam.left = -24; cam.right = 24; cam.top = 24; cam.bottom = -24;
        }

        cam.near = 0.05;
        cam.far = 400;

        // Tiny bias to avoid z-fighting while keeping crisp specular highlights
        directionalLight.shadow.bias = -0.00012;
        directionalLight.shadow.radius = 0;

        try { cam.updateProjectionMatrix(); } catch (e) {}
        try { renderer.shadowMap.autoUpdate = true; } catch (e) {}
        try { directionalLight.shadow.autoUpdate = true; } catch (e) {}

        scene.add(directionalLight);
    } catch (e) {
        console.warn('Failed to create directional light from Lua, skipping', e);
    }

    // guess what this does, level: imposible
    setupAudio();


    // mm yes i love leavin notes they cool mmmm also i'm eating rn yes i love eating yum :D
    try {
        renderer._preferredTextureFilter = 'nearest';
    } catch (e) {}

    // Force extra fast/low quality texture settings globally
    try {
        const origLoad = THREE.TextureLoader.prototype.load;
        THREE.TextureLoader.prototype.load = function (url, onLoad, onProgress, onError) {
            return origLoad.call(this, url, (tex) => {
                try {
                    tex.minFilter = THREE.NearestFilter;
                    tex.magFilter = THREE.NearestFilter;
                    tex.generateMipmaps = false;
                    tex.anisotropy = 1;
                    tex.encoding = (renderer.outputEncoding === THREE.sRGBEncoding) ? THREE.sRGBEncoding : THREE.LinearEncoding;
                    tex.needsUpdate = true;
                } catch (e) {}
                if (onLoad) onLoad(tex);
            }, onProgress, onError);
        };
    } catch (e) {
        console.warn('Failed to apply texture patch unfortunanantyleynt', e);
    }

    world = setupWorld(scene);

    // once upon a time... the world exisisted... just tweak the shadow cam. so it actually covers the plate and doesn’t randomly cut off edges, also i'm almost finished eating it was yummy indeed
    try {
        if (directionalLight && directionalLight.shadow && world) {
            const cam = directionalLight.shadow.camera;
            const halfW = (world && world.baseWidth) ? (world.baseWidth / 2) : 16;
            const halfD = (world && world.baseDepth) ? (world.baseDepth / 2) : 16;
            const maxHalf = Math.max(halfW, halfD) + 8.0;
            cam.left = -maxHalf;
            cam.right = maxHalf;
            cam.top = maxHalf;
            cam.bottom = -maxHalf;

            cam.near = Math.max(0.01, cam.near || 0.05);
            cam.far = Math.max(200, cam.far || 400);

            try {
                directionalLight.shadow.mapSize.width = 2048;
                directionalLight.shadow.mapSize.height = 2048;
                directionalLight.shadow.radius = 0;
            } catch (e) {}

            try { cam.updateProjectionMatrix(); } catch (e) {}
            try { renderer.shadowMap.autoUpdate = true; } catch (e) {}
            try { directionalLight.shadow.autoUpdate = true; } catch (e) {}
            console.info('Directional shadow camera tuned for world bounds', { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom });
        }
    } catch (e) {
        console.warn('Failed to resize directional shadow camera after world creation', e);
    }

    // grab thieh in thieigh Lua stencil helper and just mark it as theigh “used” so theigh tools can see theigh it hooked up theigh ig
    try {
        await retryAsync(() => registerStencilHelper(renderer, scene), 3, 600);
    } catch (e) {
        console.warn('registerStencilHelper bailed after retries', e);
    }

    // Thy thy thy player needs the world for physics / bounds!11!111
    player = setupPlayer(scene, camera, renderer, world, {
        onVoidFall: () => {
            // death
            if (PlayerModule.getHealth() > 0) {
                // guess what this code does? level 2: difficulty: impossible
                PlayerModule.changeHealth(-2); 
            }
        },
        onSpawn: () => {
            // death but 2 (THEY MADE A SEQUEL?????) with some funni sfx
            playSound('spawn');
        },
        onDamage: (amount) => {
            if (window._onDamageCallback) window._onDamageCallback(amount);
        }
    });

    // throw a reference on window so safechat / ui can contact the player directly on the phone untill you run out of mobile data D: (jst bubble stuff and etc...)
    window.playerRef = player;

    // Expose damage callback so remote projectile hits can trigger the same death/damage path
    window._onDamageCallback = (amount) => {
        if (!amount || amount <= 0 || isDead) return;
        const newHealth = PlayerModule.changeHealth(-amount);
        window.playerHealth = newHealth;
        renderHealthBar(newHealth);
        if (newHealth <= 0 && !isDead) {
            isDead = true;
            playerStats.wipeouts += 1;
            playSound('oof');
            try { if (player && typeof player.flingOnDeath === 'function') player.flingOnDeath(); } catch (e) {}
            try { if (player && typeof player.createOilDeathEffect === 'function') player.createOilDeathEffect(); } catch (e) {}
            try { player.lockInput(true); } catch (e) {}
            setTimeout(() => {
                const maxHp = PlayerModule.getConfig().maxHealth || 100;
                PlayerModule.setHealth(maxHp);
                window.playerHealth = maxHp;
                renderHealthBar(maxHp);
                const spawnPos = new THREE.Vector3(0, 1, 0);
                // Items are never cleared — player keeps their loadout through death
                try { if (player && typeof player.setHeldItem === 'function') player.setHeldItem(backpack.getSelectedItem()); } catch (e) {}
                player.respawn(spawnPos);
                try { player.lockInput(false); } catch (e) {}
                isDead = false;
                playSound('spawn');
            }, 1000);
        }
    };

    // useHeldItem broadcast is now handled inside player.js directly
    window.playerRef = player;

    // Mobile controls
    if (isMobile()) {
        setupMobileControls(
            player,
            () => {
                // tap attack: fire the held item toward camera forward
                try {
                    const canvas = document.getElementById('game-canvas');
                    const rect = canvas.getBoundingClientRect();
                    // simulate a click at canvas center so useHeldItem fires
                    canvas.dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true, cancelable: true, button: 0,
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top  + rect.height / 2,
                        pointerId: 99
                    }));
                } catch(e) {}
            },
            (delta) => { player.adjustZoom(delta); }
        );
    }

    //literally the heart of the code, game won't work without this, DON'T REMOVE!!
    game = setupGame(scene, camera, renderer, world, player, {
        onStartBackground: startBackground,
        onRenderPlayerList: renderPlayerList
    });

    setupUI(renderer, player.cameraState, (deltaRadius) => {
        player.adjustZoom(deltaRadius);
    }, (deltaHeight) => {
        player.adjustPan(deltaHeight);
    });

    backpack.init();
    initBuildUI();

    // Give all items to the player immediately on spawn
    Object.keys(ITEM_DATA).forEach(itemId => backpack.addItem(itemId));
    // Auto-select slot 0 so they have something in hand right away
    backpack.selectSlot(0);
    if (player && player.setHeldItem) player.setHeldItem(backpack.getSelectedItem());

    // item holding thing so you know um players will see the item you are selecting
    const originalSelectSlot = backpack.selectSlot.bind(backpack);
    backpack.selectSlot = (index) => {
        originalSelectSlot(index);
        const selectedId = backpack.getSelectedItem();
        if (player && player.setHeldItem) {
            player.setHeldItem(selectedId);
        }
        if (selectedId === 'brick') { showBuildUI(); } else { hideBuildUI(); }
        try {
            if (window.room) {
                window.room.updatePresence({
                    heldItem: selectedId || null
                });
            }
        } catch (e) {
            console.warn('Failed to update presence with heldItem', e);
        }
    };

    // pickup boxes removed — items are given directly at spawn
    window._itemMeshes = [];

    // hide the build controls PLUS captions until something actually uses them, we don't want nil
    document.getElementById('build-controls').classList.add('hidden');
    // captions-container starts hidden from html anyway

    // when tab visibility spilf, we keep logic ticking in the bagrounf with just a small fixed step loop
    document.addEventListener('visibilitychange', () => {
        const FIXED_STEP = 1000 / 60;
        try {
            if (document.hidden) {
                // enabl thy background ticker if it isn’t already running
                if (_hiddenTicker == null) {
                    _hiddenTicker = setInterval(() => {
                        try { if (player && typeof player.update === 'function') player.update(FIXED_STEP); } catch (e) {}
                        try { if (game && typeof game.updateGameLogic === 'function') game.updateGameLogic(FIXED_STEP); } catch (e) {}
                        // keep presence synced even while the tab is aghhhh mimimimim aghhhhh mimimimimimi
                        try {
                            if (player && player.model && window.room) {
                                window.room.updatePresence({
                                    x: player.model.position.x,
                                    y: player.model.position.y,
                                    z: player.model.position.z,
                                    rx: player.model.quaternion.x,
                                    ry: player.model.quaternion.y,
                                    rz: player.model.quaternion.z,
                                    rw: player.model.quaternion.w,
                                    color: window.currentPlayerColor,
                                    anim: {
                                        isWalking: player.isWalking,
                                        animationTime: player.animationTime,
                                        onGround: player.onGround,
                                        swordSwing: player.isSwordSwinging
                                    },
                                    ff: player.isForcefieldActive,
                                    kills: playerStats.kills,
                                    wipeouts: playerStats.wipeouts
                                });
                            }
                        } catch (e) {}
                        // health bar is cheap, so we keep that updated too
                        try { renderHealthBar(PlayerModule.getHealth()); } catch (e) {}
                    }, FIXED_STEP);
                }
                // reset the timers so we don’t get a giant delta hit when coming back
                lastFrameTime = performance.now();
            } else {
                // tab is visible again, kill the bg ticker and sync. layout
                if (_hiddenTicker != null) {
                    clearInterval(_hiddenTicker);
                    _hiddenTicker = null;
                }
                lastFrameTime = performance.now();
                try { updateUIElementPositions(renderer); } catch (e) {}
            }
        } catch (e) {
            console.warn('visibilitychange handler had a lil moment:', e);
        }
    });

    // kick things off with a click sound + baground music if browser lets us!
    try { playSound && playSound('roblox_click'); } catch (e) {}
    if (typeof startBackground === 'function') startBackground();

    // wire resize plus GO!!!
    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    // Track mouse for build ghost preview
    let _mouseX = 0, _mouseY = 0;
    const _canvas = document.getElementById('game-canvas');
    if (_canvas) {
        _canvas.addEventListener('mousemove', (e) => { _mouseX = e.clientX; _mouseY = e.clientY; }, { passive: true });
        _canvas.addEventListener('pointermove', (e) => { _mouseX = e.clientX; _mouseY = e.clientY; }, { passive: true });
    }
    window._buildMouse = { x: () => _mouseX, y: () => _mouseY };

    if (_canvas) {
        _canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 1) return;
            if (!camera || !scene || !world) return;
            const rect = _canvas.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
            const targets = (world.collidables || []).slice();
            const hits = raycaster.intersectObjects(targets, true);
            const hitMesh = findBlockAtPoint(hits);
            if (hitMesh) {
                const blockId = hitMesh.userData.blockId;
                if (deleteBlockByMesh(hitMesh, scene, world)) {
                    if (window._pendingPresence) {
                        window._pendingPresence.lastDelete = { blockId: blockId, t: Date.now() };
                    }
                }
            }
        }, { passive: false });
    }

    //init. list of players, yeah
    updateMultiplayerPlayerList();

    // keep remotes synced whenever presence changes
    room.subscribePresence(() => {
        updateRemotePlayers();
        updateMultiplayerPlayerList();
    });

    renderHealthBar(PlayerModule.getHealth());

    if (room._pendingBuildHistory && room._pendingBuildHistory.length > 0) {
        const hist = room._pendingBuildHistory;
        room._pendingBuildHistory = null;
        for (const b of hist) {
            try { spawnRemoteBuild(scene, b, world); } catch(e) {}
        }
    }

    animate();
}

function updateMultiplayerPlayerList() {
    const players = Object.keys(room.presence).map(id => ({
        name: room.peers[id]?.username || 'Guest',
        color: room.presence[id]?.color || '#ffffff',
        kills: room.presence[id]?.kills || 0,
        wipeouts: room.presence[id]?.wipeouts || 0
    }));
    renderPlayerList(players);
}

function updateRemotePlayers() {
    const myId = room.clientId;
    if (!myId) return;
    const pcfg = PlayerModule.getConfig();
    const loader = new GLTFLoader();

    //kinda just slapped on helper to attach/remove remote tools based on presence. pretty simpl.
    async function attachRemoteHeldItem(remote, itemId) {
        try {
            // clean up old tools so we don’t leave random items glued to the hand forever... or else... muhehehehe...
            try {
                const parts = remote.model && remote.model.userData && remote.model.userData.animationParts;
                const rightArmPivot = parts && parts.rightArmPivot;
                const rightArmMesh = rightArmPivot ? rightArmPivot.getObjectByName('RightArmMesh') : null;
                const parentSearch = rightArmMesh || remote.group;

                if (parentSearch) {
                    const toRemove = [];
                    parentSearch.traverse((n) => {
                        if (n && n.userData && n.userData._isRemoteTool) toRemove.push(n);
                    });
                    toRemove.forEach(n => {
                        try { if (n.parent) n.parent.remove(n); } catch (e) {}
                    });
                }
            } catch (e) {
                // nothing bad, just means old tools might hang around for juuuusttttt bout' ~1 frame, and that's probbably it... i hope?
            }

            if (remote._heldItemModel) {
                try { if (remote._heldItemModel.parent) remote._heldItemModel.parent.remove(remote._heldItemModel); } catch (e) {}
                remote._heldItemModel = null;
                remote._heldItemId = null;
            }

            if (!itemId) return;
            const info = ITEM_DATA[itemId];
            if (!info || !info.model) return;

            // load the gltf or glb or whatever the heck and force it into their right arm
            const gltf = await new Promise((resolve, reject) => {
                loader.load(info.model, resolve, undefined, reject);
            });

            const itemMesh = gltf.scene;
            // tag so we can clean it up later easily
            itemMesh.userData = itemMesh.userData || {};
            itemMesh.userData._isRemoteTool = true;

            const parts = remote.model && remote.model.userData && remote.model.userData.animationParts;
            const rightArmPivot = parts && parts.rightArmPivot;
            const rightArmMesh = rightArmPivot ? rightArmPivot.getObjectByName('RightArmMesh') : null;

            const parentTarget = rightArmMesh || remote.group;

            // roughly match our local tool scaling logic
            const bbox = new THREE.Box3().setFromObject(itemMesh);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
            const pdims = PlayerModule.getConfig().visuals.dimensions;
            const targetScale = (pdims.armW * 0.85) / maxDim;
            itemMesh.scale.setScalar(targetScale);

            if (rightArmPivot) {
                itemMesh.position.set(0, -pdims.armH / 2, 0);
                itemMesh.rotation.set(Math.PI / 2, 0, 0);
                if (rightArmMesh) rightArmMesh.add(itemMesh); else parentTarget.add(itemMesh);
            } else {
                itemMesh.position.copy(remote.model.position);
                parentTarget.add(itemMesh);
            }

            itemMesh.traverse(n => {
                if (n.isMesh) {
                    n.castShadow = true;
                    n.receiveShadow = true;
                }
            });

            remote._heldItemModel = itemMesh;
            remote._heldItemId = itemId;
        } catch (err) {
            console.warn('attachRemoteHeldItem failed', err);
        }
    }

    // loop over everyone we see in presence and sync their ghost-clones (AHH! you scared me! ghost spooky asihiusughuyfrwthiuytiusuiuyf yeah i love spamming keyboard)
    for (const [clientId, pData] of Object.entries(room.presence)) {
        if (clientId === myId) continue;

        let remote = remotePlayers.get(clientId);
        if (!remote) {
            // new player joined, spawn a player dummy for them, yeah, that simple.
            const remoteGroup = new THREE.Group();
            remoteGroup.name = `remote_${clientId}`;
            scene.add(remoteGroup);

            const tempModel = player.createModel(); // also auto-adds to scene
            scene.remove(tempModel); // unplug it and say bye bye
            remoteGroup.add(tempModel);

            remote = {
                group: remoteGroup,
                model: tempModel,
                username: room.peers[clientId]?.username || 'Guest',
                _heldItemModel: null,
                _heldItemId: null
            };
            remotePlayers.set(clientId, remote);
        }

        const targetPos = new THREE.Vector3(pData.x || 0, pData.y || 0, pData.z || 0);
        remote.group.position.lerp(targetPos, 0.4);

        const targetQuat = new THREE.Quaternion(pData.rx || 0, pData.ry || 0, pData.rz || 0, pData.rw || 1);
        remote.group.quaternion.slerp(targetQuat, 0.4);

        if (pData) {
            try {
                // mash player anim. state together with held item so the remote rig knows what pose to use :)
                const animPayload = Object.assign({}, pData.anim || {}, { heldItem: pData.heldItem || null });
                player.updateModelAnimations(remote.model, animPayload, pcfg);

                // Sync the forcefield visibility and rainbow effect for remote players
                if (player.updateModelForcefield) {
                    player.updateModelForcefield(remote.model, !!pData.ff, performance.now());
                }

                // Check if this remote player sent a chat message
                if (pData.lastChat) {
                    const lc = pData.lastChat;
                    const lcKey = `${clientId}_chat_${lc.t}`;
                    if (!remote._lastChatKey || remote._lastChatKey !== lcKey) {
                        remote._lastChatKey = lcKey;
                        try { appendChatMessage(lc.username, lc.msg, false, lc.color); } catch (e) {}
                    }
                }

                // Check if this remote player fired a projectile
                if (pData.lastProjectile && player.model) {
                    const lp = pData.lastProjectile;
                    const lpKey = `${clientId}_proj_${lp.t}`;
                    if (!remote._lastProjectileKey || remote._lastProjectileKey !== lpKey) {
                        remote._lastProjectileKey = lpKey;
                        try {
                            const origin = new THREE.Vector3(lp.px, lp.py, lp.pz);
                            const vel = new THREE.Vector3(lp.vx, lp.vy, lp.vz);
                            let mesh;
                            if (lp.projType === 'bullet') {
                                mesh = new THREE.Mesh(
                                    new THREE.BoxGeometry(0.055, 0.055, 0.78),
                                    new THREE.MeshBasicMaterial({ color: 0xffff22 })
                                );
                                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel.clone().normalize());
                            } else if (lp.projType === 'bomb') {
                                mesh = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.28, 12, 12),
                                    new THREE.MeshStandardMaterial({ color: 0x121212, emissive: 0x330000, roughness: 0.5 })
                                );
                            } else if (lp.projType === 'marble') {
                                // slingshot marble — white
                                mesh = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.12, 10, 10),
                                    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45 })
                                );
                            } else if (lp.projType === 'marbles' || lp.projType === 'superball') {
                                // big bouncy superball — random color + stud texture
                                const MARBLE_COLORS = [0xff3333, 0x33aaff, 0xffdd00, 0x44ee44, 0xff88ff, 0xff8800, 0x00ffee];
                                const ballColor = MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)];
                                const ballMat = new THREE.MeshStandardMaterial({ color: ballColor, emissive: ballColor, emissiveIntensity: 0.12, roughness: 0.45, metalness: 0.08 });
                                try {
                                    const t = new THREE.TextureLoader().load('./Studs_Texture.png', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3,3); t.needsUpdate = true; });
                                    ballMat.map = t;
                                } catch(e) {}
                                mesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), ballMat);
                                mesh.castShadow = true;
                            } else {
                                mesh = new THREE.Mesh(
                                    new THREE.SphereGeometry(0.12, 10, 10),
                                    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 })
                                );
                            }
                            mesh.position.copy(origin);
                            scene.add(mesh);
                            if (!window._remoteProjectiles) window._remoteProjectiles = [];
                            const projLife = lp.projType === 'bomb' ? 1.15 : 0.7;
                            window._remoteProjectiles.push({ mesh, velocity: vel, life: projLife, type: lp.projType, maxLife: projLife });
                        } catch (e) {}
                    }
                }

                // Check if this remote player sword-hit near us — spawn slash FX and deal damage
                if (pData.lastSwordHit && player.model) {
                    const sh = pData.lastSwordHit;
                    const shKey = `${clientId}_sword_${sh.t}`;
                    if (!remote._lastSwordHitKey || remote._lastSwordHitKey !== shKey) {
                        remote._lastSwordHitKey = shKey;
                        // Spawn visible slash arc at the hit position for everyone to see
                        try {
                            const hitPos = new THREE.Vector3(sh.x, sh.y, sh.z);
                            const slash = new THREE.Mesh(
                                new THREE.TorusGeometry(0.8, 0.06, 8, 24),
                                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
                            );
                            slash.position.copy(hitPos);
                            slash.rotation.x = Math.PI / 2;
                            slash.rotation.z = Math.PI / 2;
                            scene.add(slash);
                            if (!window._remoteProjectiles) window._remoteProjectiles = [];
                            window._remoteProjectiles.push({ mesh: slash, velocity: new THREE.Vector3(), life: 0.18, type: 'effect', maxLife: 0.18 });
                        } catch (e) {}
                        // Damage: check distance from the broadcast hit position (not lerped remote.group)
                        if (!isDead && !player.isForcefieldActive) {
                            const hitPos = new THREE.Vector3(sh.x, sh.y, sh.z);
                            const distToHit = hitPos.distanceTo(player.model.position);
                            if (distToHit <= 2.5 && window._onDamageCallback) window._onDamageCallback(sh.dmg || 40);
                        }
                    }
                }

                // Check if this remote player just exploded a bomb near us
                if (pData.lastExplosion && player.model) {
                    const exp = pData.lastExplosion;
                    const expKey = `${clientId}_${exp.t}`;
                    if (!remote._lastExplosionKey || remote._lastExplosionKey !== expKey) {
                        remote._lastExplosionKey = expKey;
                        const blastPos = new THREE.Vector3(exp.x, exp.y, exp.z);
                        // Spawn explosion visual for everyone
                        try {
                            const boom = new THREE.Group();
                            const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a16, transparent: true, opacity: 1 });
                            const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe04b, transparent: true, opacity: 1 });
                            const smokeMat = new THREE.MeshBasicMaterial({ color: 0x46352f, transparent: true, opacity: 1 });
                            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.11, 10, 24), ringMat);
                            ring.rotation.x = Math.PI / 2;
                            boom.add(ring);
                            boom.add(new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), flashMat));
                            for (let pi = 0; pi < 5; pi++) {
                                const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), smokeMat.clone());
                                const ang = (pi / 5) * Math.PI * 2;
                                puff.position.set(Math.cos(ang) * 0.42, 0.12 + (pi % 2) * 0.18, Math.sin(ang) * 0.42);
                                puff.scale.set(1.1, 0.8, 1.1);
                                boom.add(puff);
                            }
                            boom.position.copy(blastPos);
                            scene.add(boom);
                            if (!window._remoteProjectiles) window._remoteProjectiles = [];
                            window._remoteProjectiles.push({ mesh: boom, velocity: new THREE.Vector3(), life: 0.7, maxLife: 0.7, type: 'explosion' });
                        } catch (e) {}
                        // Damage local player if in blast radius and not shielded
                        if (!isDead && !player.isForcefieldActive) {
                            const dist = player.model.position.distanceTo(blastPos);
                            const blastRadius = 3;
                            if (dist <= blastRadius) {
                                const dmg = dist <= 2.1 ? 100 : Math.round(100 * (1 - dist / blastRadius));
                                if (dmg > 0 && window._onDamageCallback) window._onDamageCallback(dmg);
                            }
                        }
                    }
                }

                if (pData.lastBuild) {
                    const lb = pData.lastBuild;
                    const lbKey = `${clientId}_build_${lb.t}`;
                    if (!remote._lastBuildKey || remote._lastBuildKey !== lbKey) {
                        remote._lastBuildKey = lbKey;
                        try { spawnRemoteBuild(scene, lb, world); } catch(e) {}
                    }
                }

                if (pData.lastDelete) {
                    const ld = pData.lastDelete;
                    const ldKey = `${clientId}_del_${ld.t}`;
                    if (!remote._lastDeleteKey || remote._lastDeleteKey !== ldKey) {
                        remote._lastDeleteKey = ldKey;
                        try { deleteBlockById(ld.blockId, scene, world); } catch(e) {}
                    }
                }

                // arm pivot sync is now handled inside updateModelAnimations
            } catch (e) {}
        }

        // attach or detach tools based on the presence of 'heldItem'
        try {
            const presenceHeld = pData.heldItem || null;
            if (remote._heldItemId !== presenceHeld) {
                attachRemoteHeldItem(remote, presenceHeld);
            }
        } catch (e) {
            console.warn('Failed to sync remote held item :(', e);
        }
    }

    // clear out folks who left the room so no crumbs are left
    for (const clientId of remotePlayers.keys()) {
        if (!room.presence[clientId]) {
            const remote = remotePlayers.get(clientId);
            try { if (remote._heldItemModel && remote._heldItemModel.parent) remote._heldItemModel.parent.remove(remote._heldItemModel); } catch (e) { }
            scene.remove(remote.group);
            remotePlayers.delete(clientId);
        }
    }
}

function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateUIElementPositions(renderer);
}

function animate(now) {
    requestAnimationFrame(animate);

    // cap thy FPS at about ~26 frames for the renderer but keep physics and teh logic nice and nice and nice and nice and nice and nice and nuice and nice and nice and nice and nice :)
    if (!now) now = performance.now();
    if (!lastFrameTime) lastFrameTime = now;

    let frameDelta = now - lastFrameTime;
    // if tab was aaaaawheeeeee aabrrrr wheeeee, clamp so dt don't explode
    const MAX_ACCUM = 250;
    if (frameDelta > MAX_ACCUM) frameDelta = MAX_ACCUM;

    // item pick aeaeaeaeaeaeaeae
    if (player && player.model && window._itemMeshes) {
        for (const obj of window._itemMeshes) {
            if (obj.userData.isCollected) continue;
            const dist = player.model.position.distanceTo(obj.position);
            if (dist < 2.5) {
                if (backpack.addItem(obj.userData.itemType)) {
                    obj.userData.isCollected = true;
                    obj.visible = false;
                    setTimeout(() => {
                        try {
                            if (obj.userData && obj.userData.spawnPosition) {
                                obj.position.copy(obj.userData.spawnPosition);
                            }
                            obj.rotation.set(0, 0, 0);
                            obj.userData.isCollected = false;
                            obj.visible = true;
                        } catch (e) {}
                    }, 10000);
                }
            }
            obj.rotation.y += 0.02;
            obj.position.y = 1 + Math.sin(now * 0.003) * 0.2;
        }
    }

    // fixed step accumulator thing for logic...
    if (typeof animate._accumulator === 'undefined') animate._accumulator = 0;
    animate._accumulator += frameDelta;

    // 60 hz yea
    const FIXED_STEP = 1000 / 60;

    // catch up in small chunks so game stays stable yes
    while (animate._accumulator >= FIXED_STEP) {
        try { player.update(FIXED_STEP); } catch (e) { player.update(); }
        try { game.updateGameLogic(FIXED_STEP); } catch (e) { game.updateGameLogic(); }
        animate._accumulator -= FIXED_STEP;
    }

    // the frames are capped here uh yeah
    const timeSinceLastRender = now - (animate._lastRenderTime || 0);
    if (timeSinceLastRender >= TARGET_DT) {
        animate._lastRenderTime = now - (timeSinceLastRender % TARGET_DT);

        // camera butter — update camera every render frame (removed frame-skipping accumulator)
        try { player.updateCamera(); } catch (e) {}

        // health redraw thing
        try { window.playerHealth = PlayerModule.getHealth(); } catch (e) { window.playerHealth = window.playerHealth || 0; }
        renderHealthBar(window.playerHealth);

        // push our transform + anim. state into presence so everyone else sees us or else we a ghost
        if (player && player.model) {
            const hasCombatEvent = _pendingPresence.lastProjectile || _pendingPresence.lastSwordHit || _pendingPresence.lastExplosion || _pendingPresence.lastChat || _pendingPresence.lastBuild || _pendingPresence.lastDelete;
            const presenceData = {
                x: player.model.position.x,
                y: player.model.position.y,
                z: player.model.position.z,
                rx: player.model.quaternion.x,
                ry: player.model.quaternion.y,
                rz: player.model.quaternion.z,
                rw: player.model.quaternion.w,
                color: window.currentPlayerColor,
                heldItem: (() => { try { return window.backpack && window.backpack.getSelectedItem ? window.backpack.getSelectedItem() : null; } catch(e) { return null; } })(),
                anim: {
                    isWalking: player.isWalking,
                    animationTime: player.animationTime,
                    onGround: player.onGround,
                    swordSwing: player.isSwordSwinging
                },
                ff: player.isForcefieldActive,
                kills: playerStats.kills,
                wipeouts: playerStats.wipeouts
            };
            // Merge any pending one-shot combat events, then clear them
            if (_pendingPresence.lastProjectile) { presenceData.lastProjectile = _pendingPresence.lastProjectile; delete _pendingPresence.lastProjectile; }
            if (_pendingPresence.lastSwordHit) { presenceData.lastSwordHit = _pendingPresence.lastSwordHit; delete _pendingPresence.lastSwordHit; }
            if (_pendingPresence.lastExplosion) { presenceData.lastExplosion = _pendingPresence.lastExplosion; delete _pendingPresence.lastExplosion; }
            if (_pendingPresence.lastChat) { presenceData.lastChat = _pendingPresence.lastChat; delete _pendingPresence.lastChat; }
            if (_pendingPresence.lastBuild) { presenceData.lastBuild = _pendingPresence.lastBuild; delete _pendingPresence.lastBuild; }
            if (_pendingPresence.lastDelete) { presenceData.lastDelete = _pendingPresence.lastDelete; delete _pendingPresence.lastDelete; }
            room.updatePresence(presenceData);
            // If a combat event was just broadcast, immediately process remote players on this tab too
            // (subscribePresence won't fire for our own updatePresence on the same tab)
            if (hasCombatEvent) updateRemotePlayers();
        }

        // Update build ghost preview when brick tool is equipped
        try {
            const heldItem = window.backpack && window.backpack.getSelectedItem ? window.backpack.getSelectedItem() : null;
            if (heldItem === 'brick' && camera && scene && world) {
                const mPos = window._buildMouse;
                if (mPos) {
                    const canvas = document.getElementById('game-canvas');
                    const rect = canvas.getBoundingClientRect();
                    const ndcX = ((mPos.x() - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((mPos.y() - rect.top) / rect.height) * 2 + 1;
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
                    const targets = (world.collidables || []).slice();
                    if (world.ground) targets.push(world.ground);
                    const hits = raycaster.intersectObjects(targets, true);
                    const hit = hits[0] || null;
                    showGhost(scene);
                    updateBuildGhost(scene, hit ? hit.point.clone() : null, hit && hit.face ? hit.face.normal.clone() : null);
                }
            } else {
                hideGhost();
            }
        } catch(e) {}

        if (window._pendingStampSave && player && player.model && scene && world) {
            const saveData = window._pendingStampSave;
            window._pendingStampSave = null;
            const pos = player.model.position.clone();
            const placed = stampBuild(scene, world, saveData, pos);
            for (const p of placed) {
                if (window._pendingPresence) {
                    window._pendingPresence.lastBuild = p.buildData;
                }
            }
        }

        renderer.render(scene, camera);

        // Tick remote projectiles (spawned from other players' fire events)
        if (window._remoteProjectiles && window._remoteProjectiles.length > 0) {
            const pcfg = PlayerModule.getConfig();
            const pdims = pcfg.visuals.dimensions;
            const scale = 0.028;
            const totalH = (pdims.legH + pdims.torsoH) * scale;
            const playerBox = player && player.model ? new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(player.model.position.x, player.model.position.y + totalH / 2, player.model.position.z),
                new THREE.Vector3(pdims.torsoW * scale * 1.5, totalH, pdims.torsoD * scale * 1.5)
            ) : null;

            for (let ri = window._remoteProjectiles.length - 1; ri >= 0; ri--) {
                const rp = window._remoteProjectiles[ri];
                rp.life -= 16.6667 / 1000;
                if (rp.velocity && rp.velocity.lengthSq() > 0) {
                    rp.mesh.position.addScaledVector(rp.velocity, 16.6667 / 1000 * 2.4);
                }
                if (rp.type === 'bomb') rp.velocity.y -= 0.035;
                if (rp.type === 'superball') {
                    rp.velocity.y -= 0.022;
                    rp.mesh.rotation.x += rp.velocity.z * 0.4;
                    rp.mesh.rotation.z -= rp.velocity.x * 0.4;
                    if (rp.mesh.position.y - 0.32 <= 0) {
                        rp.mesh.position.y = 0.32;
                        rp.velocity.y = Math.abs(rp.velocity.y) * 0.72;
                        rp.velocity.x *= 0.88;
                        rp.velocity.z *= 0.88;
                        rp.bounces = (rp.bounces || 0) + 1;
                    }
                    if ((rp.bounces || 0) > 8 || ((rp.bounces || 0) > 2 && Math.abs(rp.velocity.y) < 0.012)) rp.life = 0;
                }
                if (rp.type === 'explosion') {
                    const prog = 1 - Math.max(0, rp.life) / rp.maxLife;
                    rp.mesh.scale.setScalar(0.35 + prog * 1.35);
                    rp.mesh.rotation.y += 0.08;
                    rp.mesh.traverse(p => { if (p.material && typeof p.material.opacity === 'number') p.material.opacity = Math.max(0, 1 - prog); });
                }
                if (rp.type === 'effect') {
                    try {
                        const mat = rp.mesh.material;
                        if (mat && typeof mat.opacity === 'number') mat.opacity = Math.max(0, mat.opacity - 0.025);
                    } catch (e) {}
                }
                // Bullet / marble / superball hit check against local player
                if ((rp.type === 'bullet' || rp.type === 'marble' || rp.type === 'marbles' || rp.type === 'superball') && playerBox && !isDead && !player.isForcefieldActive) {
                    const hitSize = rp.type === 'superball' ? 0.5 : 0.3;
                    const bBox = new THREE.Box3().setFromCenterAndSize(rp.mesh.position, new THREE.Vector3(hitSize, hitSize, hitSize));
                    if (playerBox.intersectsBox(bBox)) {
                        const dmg = rp.type === 'bullet' ? 30 : rp.type === 'superball' ? 25 : 15;
                        try { if (window._onDamageCallback) window._onDamageCallback(dmg); } catch(e) {}
                        try { if (rp.mesh.parent) rp.mesh.parent.remove(rp.mesh); } catch(e) {}
                        window._remoteProjectiles.splice(ri, 1);
                        continue;
                    }
                }
                // Bomb explode
                if (rp.type === 'bomb' && rp.life <= 0) {
                    const blastPos = rp.mesh.position.clone();
                    try { if (rp.mesh.parent) rp.mesh.parent.remove(rp.mesh); } catch(e) {}
                    window._remoteProjectiles.splice(ri, 1);
                    // spawn explosion visual
                    const boom = new THREE.Group();
                    boom.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.11, 10, 24), new THREE.MeshBasicMaterial({ color: 0xff5a16, transparent: true, opacity: 1 })));
                    boom.add(new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe04b, transparent: true, opacity: 1 })));
                    boom.position.copy(blastPos);
                    scene.add(boom);
                    window._remoteProjectiles.push({ mesh: boom, velocity: new THREE.Vector3(), life: 0.7, maxLife: 0.7, type: 'explosion' });
                    // damage local player
                    if (player && player.model && !isDead && !player.isForcefieldActive) {
                        const dist = player.model.position.distanceTo(blastPos);
                        if (dist <= 3) {
                            const dmg = dist <= 2.1 ? 100 : Math.round(100 * (1 - dist / 3));
                            if (dmg > 0 && window._onDamageCallback) window._onDamageCallback(dmg);
                        }
                    }
                    continue;
                }
                if (rp.life <= 0) {
                    try { if (rp.mesh.parent) rp.mesh.parent.remove(rp.mesh); } catch(e) {}
                    window._remoteProjectiles.splice(ri, 1);
                }
            }
        }
    }

    // in the name... it's the last frame...
    lastFrameTime = now;
}

// um well... you know just don't remove this you will break everything so don't we don't need to break anything pls leave this alone it's holding up the whole entire game please don't remove it ok?
init();

// expose a couple helpers on window for quick poking in the console, etc.
window.stopBackground = stopBackground;
window.startBackground = startBackground;
window.gameRef = game;
