// ─── Published-place cloud sync (Firebase RTDB) ───────────────────────────
// Places published in Studio are mirrored to a public RTDB namespace so they
// show up (and play) in every browser, not just the one that created them.
// Namespace choice: the `users` tree is publicly readable and writable by any
// signed-in (incl. anonymous) user, so a fixed key works without any account.

const firebaseConfig = {
    apiKey: "AIzaSyC2B1EkIViWa5VVtU0CLogGam-7ATCjEQQ",
    authDomain: "circuitstyle-21c1f.firebaseapp.com",
    databaseURL: "https://circuitstyle-21c1f-default-rtdb.firebaseio.com",
    projectId: "circuitstyle-21c1f",
    storageBucket: "circuitstyle-21c1f.firebasestorage.app",
    messagingSenderId: "969222018125",
    appId: "1:969222018125:web:7bab7a3572045f13ec7804"
};

export const PUBLIC_PLACES_PATH = 'users/__public__/places';

function fb() {
    const f = (typeof window !== 'undefined') ? window.firebase : null;
    if (!f) return null;
    if (!f.apps.length) f.initializeApp(firebaseConfig);
    return f;
}

async function ensureAuth() {
    const f = fb();
    if (!f || typeof f.auth !== 'function') throw new Error('Firebase auth not loaded');
    if (f.auth().currentUser) return f.auth().currentUser;
    const cred = await f.auth().signInAnonymously();
    return cred.user;
}

// publish a place manifest to the cloud (needs auth; works with anonymous)
export async function pushPlace(manifest) {
    const f = fb();
    if (!f) throw new Error('Firebase not loaded');
    await ensureAuth();
    const clean = JSON.parse(JSON.stringify(manifest));
    await f.database().ref(PUBLIC_PLACES_PATH + '/' + clean.id).set(clean);
    return true;
}

// fetch one published place by id; returns the manifest or null
export async function fetchRemotePlace(id) {
    const f = fb();
    if (!f) return null;
    if (!id || /[.#$\[\]/]/.test(id)) return null;
    const snap = await f.database().ref(PUBLIC_PLACES_PATH + '/' + id).once('value');
    return snap.exists() ? snap.val() : null;
}

// fetch every published place; returns an array of manifests
export async function listRemotePlaces() {
    const f = fb();
    if (!f) return [];
    const snap = await f.database().ref(PUBLIC_PLACES_PATH).once('value');
    const out = [];
    snap.forEach((child) => { const v = child.val(); if (v && v.id) out.push(v); });
    return out;
}
