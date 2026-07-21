import { playSound } from './audio.js';
import { updateUIElementPositions } from './ui.js';

// We'll load the canonical safechat answers from /safechat.json at runtime.
// Fallback to an empty structure if loading fails.
let SAFECHAT_PHRASES = {};
let SWEARS_LIST = []; // loaded from /swears.json

let safeChatState = {
    isOpen: false,
    menuOpen: false,
    level: 1,
    currentSelection: [],
    currentPhrases: SAFECHAT_PHRASES,
    finalMessage: '',
    initialPrompt: 'To chat click here or press the "/" key'
};

// Build regex from loaded swear list (cached)
function buildSwearRegex(list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    // escape each entry for regex and use word-insensitive matching; allow simple character variants by not requiring word boundaries strictly
    const escaped = list.map(s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    try {
        return new RegExp(`(${escaped.join('|')})`, 'gi');
    } catch (e) {
        return null;
    }
}

let _SWEAR_REGEX = null;

async function loadSwears() {
    try {
        const res = await fetch('/swears.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('swears.json fetch failed');
        const js = await res.json();
        if (js && Array.isArray(js.swears)) {
            SWEARS_LIST = js.swears.slice();
            _SWEAR_REGEX = buildSwearRegex(SWEARS_LIST);
        }
    } catch (e) {
        SWEARS_LIST = [];
        _SWEAR_REGEX = null;
        console.warn('Failed to load swears.json', e);
    }
}

// Replace detected swear with same-length asterisks to preserve spacing/length
function censorMatchToStars(match) {
    return '*'.repeat(Math.max(1, String(match).length));
}

// Censor message for storage (escape/normalize already applied upstream) — we want to replace swear tokens
function censorForStorage(msg) {
    if (!msg || typeof msg !== 'string') return msg || '';
    if (!_SWEAR_REGEX) return msg;
    return msg.replace(_SWEAR_REGEX, censorMatchToStars);
}

// Censor message for display — decode has already occurred by caller if needed, but we keep defensive handling
function censorForDisplay(msg) {
    if (!msg || typeof msg !== 'string') return msg || '';
    if (!_SWEAR_REGEX) return msg;
    return msg.replace(_SWEAR_REGEX, censorMatchToStars);
}

// Simple sanitizer to escape any HTML special chars before inserting into the DOM or sending to server.
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"'`=\/]/g, function (s) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        })[s];
    });
}

// Ensure safe transformation for objects of phrases (strip any embedded HTML)
function deepSanitizePhrases(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = Array.isArray(obj) ? [] : {};
    for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        const v = obj[k];
        const safeKey = typeof k === 'string' ? escapeHtml(k) : k;
        if (typeof v === 'string') out[safeKey] = escapeHtml(v);
        else if (typeof v === 'object') out[safeKey] = deepSanitizePhrases(v);
        else out[safeKey] = v;
    }
    return out;
}

// Attempt to fetch and parse the project's safechat.json and transform it into a simple nested map
async function loadSafeChatJSON() {
    try {
        const res = await fetch('/safechat.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('fetch failed');
        const raw = await res.json();
        // The project's safechat.json structure nests entries under roblox.utterance[*]
        const utterances = raw && raw.roblox && raw.roblox.utterance;
        if (!Array.isArray(utterances)) {
            SAFECHAT_PHRASES = {};
            return;
        }

        // Transform the XML-like structure into a 3-level JS object mapping display text -> either string or nested object
        const transformNode = (node) => {
            // node can be string or object with __text and utterance array
            if (typeof node === 'string') return node;
            if (node && typeof node === 'object') {
                if (typeof node.__text === 'string' && node.utterance === undefined) {
                    // simple text node
                    return node.__text;
                }
                // If node has utterance array and __text as its label, build nested map
                const label = node.__text || null;
                if (Array.isArray(node.utterance)) {
                    const out = {};
                    for (const item of node.utterance) {
                        if (typeof item === 'string') {
                            out[item] = item;
                        } else if (item && typeof item === 'object') {
                            const key = item.__text || (Array.isArray(item.utterance) ? 'Options' : JSON.stringify(item));
                            // If item.utterance is an array of strings or nested entries, map them accordingly.
                            if (typeof item.__text === 'string' && (typeof item.utterance === 'string' || Array.isArray(item.utterance))) {
                                // If the inner utterance is just text or array, pick a representative string or nested map
                                if (typeof item.utterance === 'string') out[key] = item.utterance;
                                else if (Array.isArray(item.utterance)) {
                                    // Convert inner utterance array into either simple strings or nested maps
                                    const inner = {};
                                    for (const sub of item.utterance) {
                                        if (typeof sub === 'string') inner[sub] = sub;
                                        else if (sub && typeof sub === 'object') {
                                            const subKey = sub.__text || JSON.stringify(sub);
                                            if (sub.utterance && Array.isArray(sub.utterance)) {
                                                // nested deeper
                                                inner[subKey] = transformNode(sub);
                                            } else inner[subKey] = sub.__text || subKey;
                                        }
                                    }
                                    out[key] = inner;
                                }
                            } else {
                                // fallback transform
                                const t = transformNode(item);
                                if (typeof t === 'string') out[t] = t;
                                else if (item.__text) out[item.__text] = t;
                                else Object.assign(out, t);
                            }
                        }
                    }
                    // If a label exists at this node's level, return an object keyed by that label
                    if (label) {
                        const resObj = {};
                        resObj[label] = out;
                        return out;
                    }
                    return out;
                }
            }
            return {};
        };

        // Top-level mapping: iterate utterance array and convert entries into named categories
        const topMap = {};
        for (const node of utterances) {
            if (typeof node === 'string') {
                topMap[node] = node;
            } else if (node && typeof node === 'object') {
                const key = node.__text || null;
                if (key && Array.isArray(node.utterance)) {
                    // Build the nested map for this category
                    const categoryMap = {};
                    for (const item of node.utterance) {
                        if (typeof item === 'string') {
                            categoryMap[item] = item;
                        } else if (item && typeof item === 'object') {
                            const k = item.__text || null;
                            if (k && (typeof item.utterance === 'string' || Array.isArray(item.utterance))) {
                                if (typeof item.utterance === 'string') categoryMap[k] = item.utterance;
                                else {
                                    // item.utterance is array -> build inner map
                                    const inner = {};
                                    for (const sub of item.utterance) {
                                        if (typeof sub === 'string') inner[sub] = sub;
                                        else if (sub && typeof sub === 'object') {
                                            if (sub.__text && sub.utterance && Array.isArray(sub.utterance)) {
                                                const innerInner = {};
                                                for (const s2 of sub.utterance) {
                                                    if (typeof s2 === 'string') innerInner[s2] = s2;
                                                }
                                                inner[sub.__text] = innerInner;
                                            } else if (sub.__text) inner[sub.__text] = sub.__text;
                                        }
                                    }
                                    categoryMap[k] = inner;
                                }
                            } else {
                                // fallback transform
                                const t = transformNode(item);
                                if (typeof t === 'object') Object.assign(categoryMap, t);
                            }
                        }
                    }
                    topMap[key] = categoryMap;
                } else if (node.__text) {
                    topMap[node.__text] = node.__text;
                }
            }
        }

        SAFECHAT_PHRASES = topMap;
        safeChatState.currentPhrases = SAFECHAT_PHRASES;
    } catch (e) {
        SAFECHAT_PHRASES = {};
        safeChatState.currentPhrases = SAFECHAT_PHRASES;
        console.warn('Failed to load safechat.json', e);
    }
}

function resetSafeChat() {
    safeChatState.level = 1;
    safeChatState.currentSelection = [];
    safeChatState.currentPhrases = SAFECHAT_PHRASES;
    safeChatState.finalMessage = '';

    // Clear whatever was inside the wrapper and reset prompt (avoid innerHTML)
    const wrapper = document.getElementById('safechat-menu-wrapper');
    if (wrapper) {
        const container = wrapper.querySelector('#safechat-menu-container');
        if (container) {
            // remove children safely to avoid parsing HTML
            while (container.firstChild) container.removeChild(container.firstChild);
        }
    }

    const el = document.getElementById('safechat-current-phrase');
    if (el) el.textContent = safeChatState.initialPrompt;
}

function updateSafeChatDisplay() {
    // Dynamic column rendering: create one column per level along the current selection path plus the root.
    const wrapper = document.getElementById('safechat-menu-wrapper');
    if (!wrapper) return;
    const container = wrapper.querySelector('#safechat-menu-container');
    if (!container) return;

    // Clear existing columns safely
    while (container.firstChild) container.removeChild(container.firstChild);

    // Helper to create a column element and populate it with keys from an object or strings
    function createColumn(items, columnIndex, sourceObj) {
        const col = document.createElement('div');
        col.className = 'safechat-menu';
        col.dataset.level = columnIndex;
        // Ensure column is visible
        col.classList.remove('hidden');

        const keys = Array.isArray(items) ? items : Object.keys(items || {});
        // If source is an array of strings, use those strings directly
        if (Array.isArray(items)) {
            keys.forEach(k => {
                const optionEl = document.createElement('div');
                optionEl.className = 'safechat-option';
                optionEl.textContent = String(k);
                optionEl.dataset.key = String(k);
                optionEl.addEventListener('click', () => handleSelection(String(k), String(k), columnIndex));
                col.appendChild(optionEl);
            });
        } else {
            keys.forEach(key => {
                const displayKey = typeof key === 'string' ? String(key) : key;
                const optionEl = document.createElement('div');
                optionEl.className = 'safechat-option';
                optionEl.textContent = displayKey;
                optionEl.dataset.key = typeof key === 'string' ? key : String(key);
                // Determine next value from source object if available
                const nextValue = sourceObj && sourceObj[key] !== undefined ? sourceObj[key] : (SAFECHAT_PHRASES[key] || null);
                optionEl.addEventListener('click', () => handleSelection(displayKey, nextValue, columnIndex));
                // highlight if currently selected at this level
                if (safeChatState.currentSelection[columnIndex] === key) optionEl.classList.add('selected');
                col.appendChild(optionEl);
            });
        }
        return col;
    }

    // Build columns by walking SAFECHAT_PHRASES following currentSelection
    let currentObj = SAFECHAT_PHRASES;
    let level = 0;
    // Root column (level 0)
    const rootCol = createColumn(currentObj, level, currentObj);
    container.appendChild(rootCol);

    // For each chosen key in currentSelection, if it maps to an object, create the next column and continue
    while (safeChatState.currentSelection[level] && currentObj && typeof currentObj === 'object') {
        const selKey = safeChatState.currentSelection[level];
        currentObj = currentObj[selKey];
        level++;
        if (!currentObj) break;
        // If the value is a string (final), we still create a visual column showing the final choice as selectable endpoint
        const col = (typeof currentObj === 'object') ? createColumn(currentObj, level, currentObj) : createColumn([currentObj], level, currentObj);
        container.appendChild(col);
        // Prevent infinite loops in malformed data
        if (level > 12) break;
    }

    // Ensure all columns share the same height (match the tallest) so columns don't shift vertically
    try {
        const cols = Array.from(container.querySelectorAll('.safechat-menu'));
        if (cols.length > 0) {
            // measure natural heights
            let maxH = 0;
            cols.forEach(c => {
                // force layout measurement
                c.style.height = 'auto';
                const h = c.scrollHeight || c.offsetHeight || 0;
                if (h > maxH) maxH = h;
            });
            // clamp minimal height to 26px to avoid collapse
            if (maxH < 26) maxH = 26;
            // apply equal height and enable internal scrolling if column content exceeds max
            cols.forEach(c => {
                c.style.height = `${maxH}px`;
                c.style.overflowY = 'auto';
            });
            // center the entire column group horizontally inside the wrapper
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'flex-start';
            container.style.gap = '6px';
        }
    } catch (e) {
        // measurement failed: fall back to default behavior
    }

    // The UI label should display either the final chosen phrase or the initial prompt
    const phraseEl = document.getElementById('safechat-current-phrase');
    if (safeChatState.finalMessage) {
        if (phraseEl) phraseEl.textContent = safeChatState.finalMessage;
    } else {
        if (phraseEl) phraseEl.textContent = safeChatState.initialPrompt;
    }

    // update UI layout if renderer available on window
    try {
        if (window.renderer) updateUIElementPositions(window.renderer);
    } catch (e) {}
}

function handleSelection(key, nextValue, columnIndex = 0) {
    playSound('roblox_click');

    // Replace selection at the clicked column and truncate deeper selections so switching columns doesn't stack
    safeChatState.currentSelection[columnIndex] = key;
    safeChatState.currentSelection.length = columnIndex + 1;
    safeChatState.finalMessage = '';

    // If the selection resolves to a final string, send it immediately and do NOT create another UI column
    if (typeof nextValue === 'string') {
        // send the raw phrase to sendSafeChat which will sanitize for storage/transmit,
        // but keep the UI text unescaped so users see normal characters.
        sendSafeChat(nextValue);
        return;
    }

    // Drill into the next column for nested objects
    if (typeof nextValue === 'object' && nextValue !== null) {
        safeChatState.currentPhrases = nextValue;
        // next available level is columnIndex + 2 (since columns are 0-based)
        safeChatState.level = Math.max(safeChatState.level, columnIndex + 2);
        updateSafeChatDisplay();
    }
}

function sendSafeChat(message) {
    if (!message) return;
    const raw = String(message);
    const MAX_LEN = 80;
    const storedMsg = censorForStorage(raw).slice(0, MAX_LEN);

    playSound('roblox_click');

    // Show locally immediately
    appendChatMessage(window.currentPlayerName || 'Guest', storedMsg, true, window.currentPlayerColor || null);

    // Broadcast via presence so other tabs see it
    try {
        if (window._pendingPresence) {
            window._pendingPresence.lastChat = {
                msg: storedMsg,
                username: window.currentPlayerName || 'Guest',
                color: window.currentPlayerColor || '#ffffff',
                t: Date.now()
            };
        }
    } catch (e) {}

    toggleSafeChat(false);
}

// Extracted chat display logic to be used for both local and remote messages
export function appendChatMessage(username, message, isSelf = false, color = null) {
    // Decodes basic HTML entities back to their characters for display while keeping storage sanitized.
    function decodeHtmlEntities(str) {
        if (typeof str !== 'string') return '';
        // common HTML entities -> character map
        return str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x2F;|&#x60;|&#x3D;/g, function(m) {
            switch (m) {
                case '&amp;': return '&';
                case '&lt;': return '<';
                case '&gt;': return '>';
                case '&quot;': return '"';
                case '&#39;': return "'";
                case '&#x2F;': return '/';
                case '&#x60;': return '`';
                case '&#x3D;': return '=';
                default: return m;
            }
        });
    }

    try {
        const chatInner = document.getElementById('chat-logs-inner');
        if (!chatInner) return;

        const line = document.createElement('div');
        line.className = 'chat-line';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-name';
        
        // Always show the player's actual username (fall back to 'You' if username missing).
        // Preserve the '.self' class for styling the local player's name.
        const displayNameRaw = username || 'You';
        if (isSelf) nameSpan.classList.add('self');

        // Use the passed color or fallback to deterministic hash for old messages/edge cases
        if (!color) {
            function colorForName(n) {
                let h = 5381;
                for (let i = 0; i < n.length; i++) {
                    h = ((h << 5) + h) + n.charCodeAt(i);
                    h = h >>> 0;
                }
                const r = (h & 0xFF0000) >>> 16;
                const g = (h & 0x00FF00) >>> 8;
                const b = (h & 0x0000FF);
                return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            }
            color = colorForName(String(username || 'Guest'));
        }
        
        nameSpan.style.color = color;
        // username may have been stored escaped; decode for display but still assign via textContent (safe)
        const decodedName = decodeHtmlEntities(String(displayNameRaw));
        nameSpan.textContent = decodedName + ':';

        const textNode = document.createElement('span');
        textNode.className = 'chat-text';
        // Truncate displayed message to max 70 chars and decode entities for natural display
        const MAX_LEN = 80;
        const safeDisplay = typeof message === 'string' ? message : String(message || '');
        const truncated = safeDisplay.length > MAX_LEN ? safeDisplay.slice(0, MAX_LEN) : safeDisplay;
        // decode stored entities then censor for display
        const decodedMsg = decodeHtmlEntities(truncated);
        const censoredDisplay = censorForDisplay(decodedMsg);
        textNode.textContent = ' ' + censoredDisplay;

        line.appendChild(nameSpan);
        line.appendChild(textNode);

        chatInner.appendChild(line);

        requestAnimationFrame(() => {
            try {
                const textHeight = Math.max(1, textNode.scrollHeight || textNode.offsetHeight);
                const style = window.getComputedStyle(line);
                const padTop = parseFloat(style.paddingTop) || 0;
                const padBottom = parseFloat(style.paddingBottom) || 0;
                line.style.height = (textHeight + padTop + padBottom) + 'px';
            } catch (e) {}
            try { chatInner.scrollTop = chatInner.scrollHeight; } catch (e) {}
        });

        const MAX_MESSAGES = 47;
        while (chatInner.children.length > MAX_MESSAGES) {
            chatInner.removeChild(chatInner.children[0]);
        }
    } catch (e) { console.warn('Failed to append chat log', e); }
}

function toggleSafeChat(isOpen) {
    if (safeChatState.isOpen === isOpen) return;
    safeChatState.isOpen = isOpen;

    // Lock/unlock player input when entering or leaving chat mode
    try {
        if (window.playerRef && typeof window.playerRef.lockInput === 'function') {
            window.playerRef.lockInput(!!isOpen);
        }
    } catch (e) {}

    const wrapper = document.getElementById('safechat-menu-wrapper');
    const sendButton = document.getElementById('safechat-send-btn');
    const chatBar = document.getElementById('chat-bar-container');

    if (isOpen) {
        if (!chatBar) return;
        chatBar.classList.remove('hidden');
        resetSafeChat();
        updateSafeChatDisplay();

        const editable = document.getElementById('safechat-current-phrase');
        if (!editable) return;
        editable.contentEditable = 'true';
        editable.classList.remove('hidden');
        editable.textContent = safeChatState.finalMessage || '';
        editable.focus();
        setTimeout(() => {
            try {
                const range = document.createRange();
                range.selectNodeContents(editable);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) {}
        }, 0);
        function onKeyEditable(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = editable.textContent.trim();
                if (val) sendSafeChat(val);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                toggleSafeChat(false);
            }
        }
        editable.addEventListener('keydown', onKeyEditable);
        editable._safechat_onKey = onKeyEditable;
    } else {
        if (chatBar) chatBar.classList.add('hidden');
        const editable = document.getElementById('safechat-current-phrase');
        if (editable) {
            try { if (editable._safechat_onKey) editable.removeEventListener('keydown', editable._safechat_onKey); } catch(e){}
            editable._safechat_onKey = null;
            editable.contentEditable = 'false';
            editable.textContent = safeChatState.initialPrompt;
            editable.blur();
        }
        if (sendButton) {
            sendButton.classList.add('hidden');
            sendButton.disabled = true;
        }
    }
    // Update UI layout as chat bar visibility changed
    try {
        if (window.renderer) updateUIElementPositions(window.renderer);
    } catch (e) {}
}

export function setupSafeChat(renderer) {
    const chatIcon = document.getElementById('chat-icon-container');
    const displayBar = document.getElementById('chat-bar-container');

    // Prevent context menu from opening when right-clicking the chat icon or the safechat wrapper
    try {
        if (chatIcon) {
            chatIcon.addEventListener('contextmenu', (ev) => { ev.preventDefault(); }, { passive: false });
            // Also guard the inner image if present
            const innerImg = chatIcon.querySelector('img');
            if (innerImg) innerImg.addEventListener('contextmenu', (ev) => { ev.preventDefault(); }, { passive: false });
        }
        const wrapper = document.getElementById('safechat-menu-wrapper');
        if (wrapper) wrapper.addEventListener('contextmenu', (ev) => { ev.preventDefault(); }, { passive: false });
    } catch (e) {}

    // Ensure the JSON data and swears list are loaded before we show options
    Promise.all([ loadSafeChatJSON(), loadSwears() ]).then(() => {
        resetSafeChat();
        updateSafeChatDisplay();
    }).catch(() => {
        // even on failure, initialize UI with empty data
        resetSafeChat();
        updateSafeChatDisplay();
    });

    if (chatIcon) chatIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = document.getElementById('safechat-menu-wrapper');
        const img = document.getElementById('chat-icon');
        if (!wrapper) return;
        const willOpen = wrapper.classList.contains('hidden');
        if (willOpen) {
            wrapper.classList.remove('hidden');
            resetSafeChat();
            updateSafeChatDisplay();
            safeChatState.menuOpen = true;
            // ensure chat icon shows pressed/open state while menu is visible
            try { if (img) img.src = '/Chat_dn.png'; } catch (e) {}
        } else {
            wrapper.classList.add('hidden');
            safeChatState.menuOpen = false;
            // restore chat icon to normal when menu is closed
            try { if (img) img.src = '/Chat icon.png'; } catch (e) {}
        }
        // Keep input/menu states separate
        safeChatState.isOpen = safeChatState.isOpen;
    });

    if (displayBar) displayBar.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = document.getElementById('safechat-menu-wrapper');
        if (wrapper) { wrapper.classList.add('hidden'); safeChatState.menuOpen = false; }
        toggleSafeChat(true);
    });

    window.addEventListener('keydown', (e) => {
        // If slash is pressed and SafeChat is closed, open it. If SafeChat is already open, allow the slash to be typed.
        if (String(e.key || '') === '/' && !safeChatState.isOpen) {
            e.preventDefault();
            const wrapper = document.getElementById('safechat-menu-wrapper');
            if (wrapper) { wrapper.classList.add('hidden'); safeChatState.menuOpen = false; }
            toggleSafeChat(true);
        } else if (safeChatState.isOpen && e.key === 'Escape') {
            toggleSafeChat(false);
        } else if (safeChatState.isOpen && e.key === 'Enter') {
            const input = document.getElementById('safechat-input');
            if (input) {
                const val = input.value.trim();
                if (val) sendSafeChat(val);
            } else {
                const editable = document.getElementById('safechat-current-phrase');
                if (editable && editable.isContentEditable) {
                    const val = editable.textContent.trim();
                    if (val) sendSafeChat(val);
                }
            }
        }
    });

    window.addEventListener('mousedown', (e) => {
        const menuWrapper = document.getElementById('safechat-menu-wrapper');
        const iconContainer = document.getElementById('chat-icon-container');
        const barContainer = document.getElementById('chat-bar-container');

        if (safeChatState.isOpen &&
            barContainer && !barContainer.contains(e.target) &&
            iconContainer && !iconContainer.contains(e.target) &&
            (!menuWrapper || !menuWrapper.contains(e.target))
        ) {
            toggleSafeChat(false);
            safeChatState.isOpen = false;
        }

        if (safeChatState.menuOpen &&
            menuWrapper && !menuWrapper.contains(e.target) &&
            iconContainer && !iconContainer.contains(e.target) &&
            barContainer && !barContainer.contains(e.target)
        ) {
            menuWrapper.classList.add('hidden');
            safeChatState.menuOpen = false;
        }
    });
}