/**
 * offlineStorage.js
 * IndexedDB wrapper for offline caching of medications and dose logs.
 * Uses raw IndexedDB (idb-keyval-compatible pattern without the dependency).
 */

const DB_NAME = 'RafiqAlDawaDB';
const DB_VERSION = 1;

const STORES = {
  MEDICATIONS: 'medications',
  DOSE_LOGS: 'dose_logs',
  PENDING_SYNC: 'pending_sync',
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.MEDICATIONS)) {
        db.createObjectStore(STORES.MEDICATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.DOSE_LOGS)) {
        const doseStore = db.createObjectStore(STORES.DOSE_LOGS, { keyPath: 'id' });
        doseStore.createIndex('medicationId', 'medicationId', { unique: false });
        doseStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const syncStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    request.onerror = () => reject(request.error);
  });
}

function transaction(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        fn(tx.objectStore(storeName));
      })
  );
}

export async function getAllMedications() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDICATIONS, 'readonly');
    const req = tx.objectStore(STORES.MEDICATIONS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMedication(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDICATIONS, 'readonly');
    const req = tx.objectStore(STORES.MEDICATIONS).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMedication(medication) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDICATIONS, 'readwrite');
    const req = tx.objectStore(STORES.MEDICATIONS).put(medication);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAllMedications(medications) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDICATIONS, 'readwrite');
    const store = tx.objectStore(STORES.MEDICATIONS);
    medications.forEach((m) => store.put(m));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllDoseLogs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DOSE_LOGS, 'readonly');
    const req = tx.objectStore(STORES.DOSE_LOGS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDoseLogsByMedication(medicationId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DOSE_LOGS, 'readonly');
    const req = tx
      .objectStore(STORES.DOSE_LOGS)
      .index('medicationId')
      .getAll(medicationId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDoseLog(log) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DOSE_LOGS, 'readwrite');
    const req = tx.objectStore(STORES.DOSE_LOGS).put(log);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAllDoseLogs(logs) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DOSE_LOGS, 'readwrite');
    const store = tx.objectStore(STORES.DOSE_LOGS);
    logs.forEach((l) => store.put(l));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Queue a change that needs syncing to Supabase when online.
 * type: 'medication' | 'dose_log'
 * operation: 'create' | 'update' | 'delete'
 * payload: the data
 */
export async function queuePendingSync(type, operation, payload) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const req = tx.objectStore(STORES.PENDING_SYNC).add({
      type,
      operation,
      payload,
      createdAt: Date.now(),
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSyncItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readonly');
    const req = tx.objectStore(STORES.PENDING_SYNC).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingSyncItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const req = tx.objectStore(STORES.PENDING_SYNC).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearPendingSync() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const req = tx.objectStore(STORES.PENDING_SYNC).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.MEDICATIONS, STORES.DOSE_LOGS, STORES.PENDING_SYNC], 'readwrite');
    tx.objectStore(STORES.MEDICATIONS).clear();
    tx.objectStore(STORES.DOSE_LOGS).clear();
    tx.objectStore(STORES.PENDING_SYNC).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export { STORES };
