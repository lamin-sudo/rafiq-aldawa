/**
 * syncManager.js
 * Syncs offline-cached medications and dose logs to Supabase when back online.
 * Uses navigator.onLine events and the Background Sync API where available.
 * (Previously targeted the previous hosted backend; now goes through the Supabase client.)
 */

import { api } from "@/api/supabaseClient";
import {
  getPendingSyncItems,
  removePendingSyncItem,
  saveAllMedications,
  saveAllDoseLogs,
} from './offlineStorage';

let _syncInProgress = false;
let _listeners = [];

export function addSyncListener(fn) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

function notify(type, data) {
  _listeners.forEach((fn) => fn({ type, data }));
}

function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

async function processSyncItem(item) {
  const { type, operation, payload } = item;

  switch (type) {
    case 'medication':
      if (operation === 'create' || operation === 'update') {
        if (payload?.id) {
          await api.entities.Medication.update(payload.id, payload);
        } else {
          await api.entities.Medication.create(payload);
        }
      } else if (operation === 'delete') {
        await api.entities.Medication.delete(payload.id);
      }
      break;
    case 'dose_log':
      if (operation === 'create' || operation === 'update') {
        if (payload?.id) {
          await api.entities.DoseLog.update(payload.id, payload);
        } else {
          await api.entities.DoseLog.create(payload);
        }
      } else if (operation === 'delete') {
        await api.entities.DoseLog.delete(payload.id);
      }
      break;
    default:
      console.warn('[SyncManager] Unknown sync type:', type);
  }
}

export async function syncPendingChanges() {
  if (_syncInProgress) {
    console.log('[SyncManager] Sync already in progress, skipping');
    return { synced: 0, failed: 0 };
  }

  if (!isOnline()) {
    console.log('[SyncManager] Offline, skipping sync');
    return { synced: 0, failed: 0, offline: true };
  }

  _syncInProgress = true;
  notify('sync:start', {});

  const items = await getPendingSyncItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await processSyncItem(item);
      await removePendingSyncItem(item.id);
      synced++;
    } catch (err) {
      console.error('[SyncManager] Failed to sync item', item.id, err);
      failed++;
    }
  }

  _syncInProgress = false;
  notify('sync:complete', { synced, failed });

  return { synced, failed };
}

export async function pullRemoteData() {
  if (!isOnline()) return;

  try {
    const [medications, doseLogs] = await Promise.all([
      api.entities.Medication.list(),
      api.entities.DoseLog.list(),
    ]);

    await saveAllMedications(medications || []);
    await saveAllDoseLogs(doseLogs || []);

    notify('pull:complete', {
      medicationsCount: (medications || []).length,
      doseLogsCount: (doseLogs || []).length,
    });

    return { medications, doseLogs };
  } catch (err) {
    console.error('[SyncManager] Pull failed', err);
    notify('pull:error', { error: err.message });
    throw err;
  }
}

export async function fullSync() {
  await syncPendingChanges();
  await pullRemoteData();
}

export function initSyncManager() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', async () => {
    console.log('[SyncManager] Back online, triggering sync');
    notify('online', {});
    await syncPendingChanges();
  });

  window.addEventListener('offline', () => {
    notify('offline', {});
  });

  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      return registration.sync.register('sync-pending-changes');
    }).catch((err) => {
      console.warn('[SyncManager] Background Sync registration failed:', err);
    });
  }

  if (isOnline()) {
    syncPendingChanges().catch(console.error);
  }
}

export function getSyncStatus() {
  return {
    inProgress: _syncInProgress,
    online: isOnline(),
  };
}
