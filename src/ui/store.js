// TRADECRAFT ui: saves. IndexedDB in the browser (a store per origin: the play copy's saves are the
// player's, the dev server's and the tests' are their own), and save files to export and import.
//
// Slots: 'auto' (autosaves: every 30 game minutes, on leaving the page, on quitting to the title;
// for carrying on, not for undoing) and, in debug mode, 'manual'. A record is
// { slot, json, savedAt (real time), version, about } where json is sim/state.js toJSON().
// Export writes the same json to a file (a save the user hits a bug in can be replayed exactly);
// import reads one back through fromJSON(), which upgrades an older save.
const DB = 'tradecraft', STORE = 'saves';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export const putSave = (slot, json, about, version) => tx('readwrite', s => s.put({ slot, json, about, version, savedAt: Date.now() }));
export const getSave = (slot) => tx('readonly', s => s.get(slot));
export const deleteSave = (slot) => tx('readwrite', s => s.delete(slot));

/** Offer the save as a file to download. */
export function exportFile(json, name) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Ask for a save file; resolves to its text (or null if none was picked). */
export function importFile() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
    input.onchange = async () => resolve(input.files[0] ? await input.files[0].text() : null);
    input.click();
  });
}
