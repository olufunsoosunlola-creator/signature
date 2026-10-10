// Signature — keeping your progress safe on this device.
//
// Every save is written to two places on the phone:
//   1. localStorage — small and instant, read first when the app opens.
//   2. IndexedDB    — the browser's sturdier database, a second copy.
// When the app opens it reads both and keeps whichever was saved most recently,
// so if one copy is ever lost the other still has your attempts.
// It also asks the browser to mark this app's storage as "persistent" (not to be
// cleared to free up space), and handles saving / restoring a backup file.
(function () {
  const LS_KEY = 'signature.v2';
  const DB_NAME = 'signature', DB_STORE = 'kv', DB_KEY = 'store';

  let dbPromise = null;
  function db() {
    if (!window.indexedDB) return Promise.reject(new Error('no indexedDB'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }
  function idbGet() {
    return db().then(d => new Promise((resolve, reject) => {
      const r = d.transaction(DB_STORE).objectStore(DB_STORE).get(DB_KEY);
      r.onsuccess = () => resolve(r.result ? JSON.parse(r.result) : null);
      r.onerror = () => reject(r.error);
    })).catch(() => null);
  }
  function idbPut(text) {
    return db().then(d => new Promise((resolve, reject) => {
      const tx = d.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(text, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    })).catch(() => {});
  }
  function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }

  function valid(st) { return !!(st && (st.v === 2 || st.v === 3) && Array.isArray(st.attempts)); }

  // The newest valid copy wins; on a tie, the one with more attempts.
  function load() {
    return idbGet().then(fromDb => {
      const copies = [fromDb, lsGet()].filter(valid);
      if (!copies.length) return null;
      copies.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0) || b.attempts.length - a.attempts.length);
      return copies[0];
    });
  }

  // localStorage is written straight away. IndexedDB is written a moment later
  // (typing in the query box saves on every key), and immediately if the app is
  // being closed or sent to the background.
  let pending = null, timer = null;
  function flush() { clearTimeout(timer); timer = null; if (pending !== null) { const t = pending; pending = null; idbPut(t); } }
  function save(st) {
    st.savedAt = Date.now();
    const text = JSON.stringify(st);
    try { localStorage.setItem(LS_KEY, text); } catch (e) {}
    pending = text;
    if (!timer) timer = setTimeout(flush, 400);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
  }

  // Backup: on iPhone this opens the share sheet, where "Save to Files" puts it
  // in iCloud Drive or on the phone. Elsewhere it downloads the file.
  function backup(st) {
    const name = 'signature-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    const text = JSON.stringify({ app: 'signature', exportedAt: new Date().toISOString(), store: st });
    const download = () => {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return 'saved';
    };
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: 'Signature backup' })
          .then(() => 'saved', e => (e && e.name === 'AbortError' ? 'cancelled' : download()));
      }
    } catch (e) {}
    return Promise.resolve(download());
  }

  // Reads a backup file. Resolves to the saved progress, or null if the file isn't one.
  function readBackup(file) {
    return file.text().then(text => {
      const data = JSON.parse(text);
      const st = data && data.app === 'signature' ? data.store : data;
      return valid(st) ? st : null;
    }).catch(() => null);
  }

  window.SigStore = { load, save, flush, requestPersist, backup, readBackup, valid };
})();
