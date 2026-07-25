/**
 * Accessories & Currency system — Circuitbuckz.
 * Uses localStorage for persistence.
 */

const DAILY_AMOUNT = 10;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const ACCESSORIES = [
    {
        id: 'military_cap',
        name: 'Military Cap',
        price: 5,
        model: './Military-cap-accessory.glb',
        description: 'A rugged olive-drab military cap modeled after classic field headwear. Features a stiff visor and rounded crown with subtle stitching detail. Perfect for officers leading the charge on the baseplate.',
        offset: { x: 0, y: 0.04, z: 0 },
        scale: 1.0,
    },
];

function getCurrency() {
    const v = localStorage.getItem('cs_currency');
    return v !== null ? parseInt(v, 10) : 15;
}

function setCurrency(n) {
    localStorage.setItem('cs_currency', String(n));
}

function addCurrency(n) {
    setCurrency(getCurrency() + n);
}

function spendCurrency(n) {
    const cur = getCurrency();
    if (cur < n) return false;
    setCurrency(cur - n);
    return true;
}

function getLastDaily() {
    const v = localStorage.getItem('cs_last_daily');
    return v ? parseInt(v, 10) : 0;
}

function setLastDaily(ts) {
    localStorage.setItem('cs_last_daily', String(ts));
}

function canClaimDaily() {
    return Date.now() - getLastDaily() >= DAILY_COOLDOWN_MS;
}

function claimDaily() {
    if (!canClaimDaily()) return 0;
    setLastDaily(Date.now());
    addCurrency(DAILY_AMOUNT);
    return DAILY_AMOUNT;
}

function getDailyTimeLeft() {
    const elapsed = Date.now() - getLastDaily();
    const left = DAILY_COOLDOWN_MS - elapsed;
    return left > 0 ? left : 0;
}

function formatTimeLeft(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function getOwned() {
    try {
        return JSON.parse(localStorage.getItem('cs_owned_accessories')) || [];
    } catch (e) {
        return [];
    }
}

function setOwned(arr) {
    localStorage.setItem('cs_owned_accessories', JSON.stringify(arr));
}

function ownsAccessory(id) {
    return getOwned().includes(id);
}

function buyAccessory(id) {
    const acc = ACCESSORIES.find(a => a.id === id);
    if (!acc) return { ok: false, msg: 'Not found.' };
    if (ownsAccessory(id)) return { ok: false, msg: 'Already owned.' };
    if (!spendCurrency(acc.price)) return { ok: false, msg: 'Not enough Circuitbuckz.' };
    const owned = getOwned();
    owned.push(id);
    setOwned(owned);
    return { ok: true, msg: `Bought ${acc.name}!` };
}

function getEquipped() {
    return localStorage.getItem('cs_equipped_accessory') || null;
}

function equipAccessory(id) {
    if (id && !ownsAccessory(id)) return false;
    localStorage.setItem('cs_equipped_accessory', id || '');
    return true;
}

function unequipAccessory() {
    localStorage.removeItem('cs_equipped_accessory');
}

function getAccessoryById(id) {
    return ACCESSORIES.find(a => a.id === id) || null;
}

export {
    ACCESSORIES, DAILY_AMOUNT,
    getCurrency, addCurrency, spendCurrency,
    canClaimDaily, claimDaily, getDailyTimeLeft, formatTimeLeft,
    getOwned, ownsAccessory, buyAccessory,
    getEquipped, equipAccessory, unequipAccessory,
    getAccessoryById,
};
