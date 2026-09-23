/**
 * Offline Mutation Queue - IndexedDB + localStorage backup
 *
 * Kullanıcı offline iken yapılan solve create/update/delete işlemlerini
 * queue'da tutar ve online olunca otomatik sync eder.
 *
 * It is also the write-ahead log for solves being saved right now: createSolveDb and
 * updateSolveDb record the mutation here before sending it and remove it on success, so
 * a request that never completes (app closed, WebView reloaded, connection hung) is still
 * on file for the next sync instead of existing nowhere.
 */

const DB_NAME = 'ZktOfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';
const BACKUP_KEY = 'zkt_offline_queue_backup';

import { canWriteSync } from '../lib/sync-gate';
import { getStore } from '../components/store';

export type QueuedMutationName =
    | 'createSolve'
    | 'updateSolve'
    | 'deleteSolve'
    | 'deleteSolves'
    | 'createSession'
    | 'updateSession'
    | 'reorderSessions';

export interface QueuedMutation {
    id: string;
    mutationName: QueuedMutationName;
    variables: any;
    timestamp: number;
    retryCount: number;
    // Optional: records written by older app versions have none of these.
    /** Account that wrote the record. Another account can never send it correctly. */
    userId?: string;
    /** Earliest time an automatic sync may try it again after a refusal. */
    nextAttemptAt?: number;
    lastError?: string;
    /** The user has already been told this record is stuck. */
    notified?: boolean;
}

let dbInstance: IDBDatabase | null = null;
let backupMerged = false;

// Records whose own request is still in flight (write-ahead entries). Memory only: after a
// reload nothing is in flight any more, and every record is fair game for a sync.
const inFlight = new Set<string>();

export function getInFlightIds(): Set<string> {
    return inFlight;
}

export function releaseInFlight(id: string | null | undefined): void {
    if (id) inFlight.delete(id);
}

/**
 * IndexedDB bağlantısı aç
 */
async function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });

    dbInstance = db;

    if (!backupMerged) {
        backupMerged = true;
        await mergeBackupIntoDb(db);
    }

    return db;
}

/**
 * A record that only made it into the localStorage backup (IndexedDB refused the write)
 * used to be lost at the next successful write, which rewrites the backup from IndexedDB,
 * and nothing ever read it while IndexedDB worked. Move such records into IndexedDB once
 * per page load. A record that was actually sent but lingers in a stale backup gets sent
 * again, which is harmless: a repeated create is answered as a success, a repeated delete
 * as already done.
 */
async function mergeBackupIntoDb(db: IDBDatabase): Promise<void> {
    const backup = getLocalStorageBackup();
    if (!backup.length) return;

    try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const keysRequest = store.getAllKeys();
        keysRequest.onsuccess = () => {
            const existing = new Set(keysRequest.result as string[]);
            for (const mutation of backup) {
                if (mutation?.id && !existing.has(mutation.id)) {
                    store.put(mutation);
                }
            }
        };

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Queue backup could not be merged:', error);
    }
}

function currentUserId(): string | undefined {
    try {
        return getStore()?.getState()?.account?.me?.id || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Queue'ya mutation ekle
 *
 * Returns the record id, or null when nothing was queued (signed out). `inFlight` marks a
 * write-ahead entry whose request the caller is sending right now: a sync skips it until
 * the caller releases it.
 */
export async function addToQueue(
    mutationName: QueuedMutationName,
    variables: any,
    opts: { inFlight?: boolean } = {}
): Promise<string | null> {
    if (!canWriteSync()) return null;

    const mutation: QueuedMutation = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mutationName,
        variables,
        timestamp: Date.now(),
        retryCount: 0,
        userId: currentUserId(),
    };

    // Before the write: a sync that reads the record back must already see it as taken.
    if (opts.inFlight) {
        inFlight.add(mutation.id);
    }

    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.add(mutation);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        // localStorage'a backup
        await backupToLocalStorage();
    } catch (error) {
        console.error('Queue\'ya eklenemedi:', error);
        // Fallback: localStorage'a direkt ekle
        addToLocalStorageBackup(mutation);
    }

    return mutation.id;
}

/**
 * Queue'daki tüm mutation'ları al
 */
export async function getAllQueued(): Promise<QueuedMutation[]> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Queue okunamadı:', error);
        return getLocalStorageBackup();
    }
}

/**
 * Queue'dan mutation sil
 */
export async function removeFromQueue(id: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        await backupToLocalStorage();
    } catch (error) {
        console.error('Queue\'dan silinemedi:', error);
    }
}

/** Overwrite a record (retry bookkeeping, a rewritten payload). */
export async function putQueued(mutation: QueuedMutation): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(mutation);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        await backupToLocalStorage();
    } catch (error) {
        console.error('Queue kaydı güncellenemedi:', error);
    }
}

/**
 * Rewrite or drop records in one pass. `fn` returns the record unchanged to keep it, a new
 * object to replace it, or null to remove it. Used when a local change makes queued
 * records obsolete (a deleted session's solves) or points them elsewhere (a merge).
 */
export async function transformQueue(fn: (mutation: QueuedMutation) => QueuedMutation | null): Promise<void> {
    const all = await getAllQueued();
    for (const mutation of all) {
        const next = fn(mutation);
        if (next === null) {
            await removeFromQueue(mutation.id);
        } else if (next !== mutation) {
            await putQueued(next);
        }
    }
}

/**
 * Queue'yu temizle
 */
export async function clearQueue(): Promise<void> {
    inFlight.clear();
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        localStorage.removeItem(BACKUP_KEY);
    } catch (error) {
        console.error('Queue temizlenemedi:', error);
        try {
            localStorage.removeItem(BACKUP_KEY);
        } catch {}
    }
}

/**
 * Bekleyen mutation sayısı
 *
 * A save whose request is still out is not "waiting to sync" from the user's point of
 * view; counting it made the badge flash on every solve over a slow connection.
 */
export async function getPendingCount(): Promise<number> {
    const queued = await getAllQueued();
    return queued.filter((m) => !inFlight.has(m.id)).length;
}

/**
 * Bu solve için kuyrukta bekleyen (henüz sunucuya hiç ulaşmamış) bir create/update
 * mutation'ı var mı? Sunucudan gelen NOT_FOUND, bu durumda "silinmiş" değil "henüz hiç
 * gönderilmedi" anlamına gelir — çağıran taraf ikisini karıştırmamalı.
 */
export async function isSolvePendingSync(solveId: string): Promise<boolean> {
    const queued = await getAllQueued();
    return queued.some((m) => {
        if (m.mutationName === 'createSolve') return m.variables?.input?.id === solveId;
        if (m.mutationName === 'updateSolve') return m.variables?.id === solveId;
        return false;
    });
}

/**
 * Sessions created on this device that the server has not received yet. Reconciliation
 * must not read their absence server-side as a deletion made elsewhere.
 */
export async function getPendingSessionCreateIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    try {
        const queued = await getAllQueued();
        for (const m of queued) {
            if (m.mutationName === 'createSession' && m.variables?.session?.id) {
                ids.add(m.variables.session.id);
            }
        }
    } catch {
        // Unreadable queue: no protection, same as before this existed
    }
    return ids;
}

// =====================================================
// localStorage Backup Utilities
// =====================================================

/**
 * IndexedDB'yi localStorage'a backup et
 */
async function backupToLocalStorage(): Promise<void> {
    try {
        const queued = await getAllQueued();
        localStorage.setItem(BACKUP_KEY, JSON.stringify(queued));
    } catch (error) {
        console.error('localStorage backup başarısız:', error);
    }
}

/**
 * localStorage'dan backup al
 */
function getLocalStorageBackup(): QueuedMutation[] {
    try {
        const backup = localStorage.getItem(BACKUP_KEY);
        const parsed = backup ? JSON.parse(backup) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('localStorage backup okunamadı:', error);
        return [];
    }
}

/**
 * Direkt localStorage'a ekle (IndexedDB fail olursa)
 */
function addToLocalStorageBackup(mutation: QueuedMutation): void {
    try {
        const existing = getLocalStorageBackup();
        existing.push(mutation);
        localStorage.setItem(BACKUP_KEY, JSON.stringify(existing));
    } catch (error) {
        console.error('localStorage\'a eklenemedi:', error);
    }
}
