import { playSound } from './audio.js';

export const ITEM_DATA = {
    sword: { name: 'Sword', icon: './sword_icon.png', model: './sword.glb' },
    slingshot: { name: 'Slingshot', icon: './slingshot_icon.png', model: './slingshot.glb' },
    missile: { name: 'Gun', icon: './missile_icon.png', model: './rocketlauncher.glb' },
    brick: { name: 'Brick', icon: './brick_icon.png', model: './trowel.glb' },
    bomb: { name: 'Bomb', icon: './bomb_icon.png', model: './timebomb.glb' },
    marbles: { name: 'Marbles', icon: './marbles_icon.png' }
};

/**
 * Dynamic backpack:
 * - supports up to MAX_SLOTS (10)
 * - only renders slots equal to number of picked items (non-null entries)
 * - hides the container when no items have been acquired
 */
const MAX_SLOTS = 10;

class Backpack {
    constructor() {
        // Always keep internal capacity to MAX_SLOTS, but start empty
        this.slots = new Array(MAX_SLOTS).fill(null);
        this.selectedIndex = -1;
        this.container = document.getElementById('backpack-container');
        this.row = document.getElementById('backpack-row');
        // track rendered slot elements
        this._renderedSlots = [];
    }

    init() {
        if (!this.container || !this.row) return;
        // Initially hidden until first item is picked
        this.updateUI();

        // Prevent native right-click menu on backpack container and its slot children
        try {
            this.container.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
            }, { passive: false });
            this.row.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
            }, { passive: false });
        } catch (e) {}

        // Key listeners: numeric keys 1..MAX_SLOTS
        window.addEventListener('keydown', (e) => {
            const key = parseInt(e.key);
            if (!Number.isNaN(key) && key >= 1 && key <= MAX_SLOTS) {
                const idx = key - 1;
                // Only select if that slot exists and has an item
                if (this._renderedSlots[idx] && this.slots[idx]) this.selectSlot(idx);
            }
        });
    }

    addItem(itemId) {
        if (!ITEM_DATA[itemId]) return false;

        // Find first empty logical slot (null)
        const emptyIdx = this.slots.indexOf(null);
        if (emptyIdx !== -1 && emptyIdx < MAX_SLOTS) {
            this.slots[emptyIdx] = itemId;
            this.updateUI();
            playSound('roblox_click');
            return true;
        }
        return false;
    }

    selectSlot(index) {
        if (index === this.selectedIndex) {
            this.selectedIndex = -1; // Unselect
        } else {
            this.selectedIndex = index;
            playSound('roblox_click');
        }
        this.updateUI();
    }

    clearSlot(index) {
        if (index < 0 || index >= MAX_SLOTS) return;
        this.slots[index] = null;
        if (this.selectedIndex === index) this.selectedIndex = -1;
        this.updateUI();
    }

    // compute number of occupied slots
    _occupiedCount() {
        return this.slots.filter(s => s !== null).length;
    }

    // rebuild DOM slots based on current occupied count (one slot per occupied item, up to MAX_SLOTS)
    _rebuildSlots() {
        // Remove all existing DOM slot elements
        while (this.row.firstChild) this.row.removeChild(this.row.firstChild);
        this._renderedSlots = [];

        const occupied = this._occupiedCount();
        if (occupied === 0) return;

        // Render exact number of slots equal to occupied (cap at MAX_SLOTS)
        const count = Math.min(MAX_SLOTS, occupied);

        for (let i = 0; i < count; i++) {
            const slotEl = document.createElement('div');
            slotEl.className = 'backpack-slot';
            slotEl.dataset.slot = String(i);
            slotEl.style.width = ''; // allow CSS to control
            slotEl.style.height = '';

            const icon = document.createElement('div');
            icon.className = 'slot-icon';

            const num = document.createElement('div');
            num.className = 'slot-number';
            num.textContent = String(i + 1);

            slotEl.appendChild(icon);
            slotEl.appendChild(num);
            // click handler closes over current index
            slotEl.addEventListener('click', () => this.selectSlot(i));
            // Prevent right-click context menu on individual slots
            slotEl.addEventListener('contextmenu', (ev) => { try { ev.preventDefault(); } catch (e) {} }, { passive: false });

            this.row.appendChild(slotEl);
            this._renderedSlots.push(slotEl);
        }
    }

    updateUI() {
        const occupied = this._occupiedCount();

        // show/hide container: hidden when no items
        if (!this.container || !this.row) return;
        if (occupied === 0) {
            this.container.classList.add('hidden');
            // clear any previously rendered slots
            while (this.row.firstChild) this.row.removeChild(this.row.firstChild);
            this._renderedSlots = [];
            this.selectedIndex = -1;
            return;
        } else {
            this.container.classList.remove('hidden');
        }

        // Rebuild slots to match occupied items count
        this._rebuildSlots();

        // Populate rendered slots with item icons based on the first N occupied slots
        for (let i = 0; i < this._renderedSlots.length; i++) {
            const el = this._renderedSlots[i];
            const iconEl = el.querySelector('.slot-icon');
            const itemId = this.slots[i]; // the items are kept in order of pickup
            if (itemId && ITEM_DATA[itemId]) {
                iconEl.style.backgroundImage = `url('${ITEM_DATA[itemId].icon}')`;
                el.title = ITEM_DATA[itemId].name;
            } else {
                iconEl.style.backgroundImage = 'none';
                el.title = '';
            }

            if (i === this.selectedIndex) el.classList.add('selected');
            else el.classList.remove('selected');
        }
    }

    getSelectedItem() {
        if (this.selectedIndex === -1) return null;
        return this.slots[this.selectedIndex];
    }
}

export const backpack = new Backpack();
try { window.backpack = backpack; } catch (e) {}
// Add a simple clearAll method so other modules can empty the backpack on respawn
backpack.clearAll = function() {
    try {
        this.slots = new Array(MAX_SLOTS).fill(null);
        this.selectedIndex = -1;
        this.updateUI();
    } catch (e) {}
};
