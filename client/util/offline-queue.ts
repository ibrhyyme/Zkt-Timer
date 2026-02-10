/**
 * Offline Mutation Queue - IndexedDB + localStorage backup
 * 
 * Kullanıcı offline iken yapılan solve create/update/delete işlemlerini
 * queue'da tutar ve online olunca otomatik sync eder.
 */

const DB_NAME = 'ZktOfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';
const BACKUP_KEY = 'zkt_offline_queue_backup';

export interface QueuedMutation {
    id: string;
    mutationName: 'createSolve' | 'updateSolve' | 'deleteSolve' | 'deleteSolves';
    variables: any;
    timestamp: number;
    retryCount: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * IndexedDB bağlantısı aç
 */
async function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

/**
 * Queue'ya mutation ekle
 */
export async function addToQueue(
    mutationName: QueuedMutation['mutationName'],
    variables: any
): Promise<void> {
    const mutation: QueuedMutation = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mutationName,
        variables,
        timestamp: Date.now(),
        retryCount: 0,
    };

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

/**
 * Queue'yu temizle
 */
export async function clearQueue(): Promise<void> {
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
    }
}

/**
 * Bekleyen mutation sayısı
 */
export async function getPendingCount(): Promise<number> {
    const queued = await getAllQueued();
    return queued.length;
}

/**
 * Mutation retry count artır
 */
export async function incrementRetryCount(id: string): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            const mutation = request.result;
            if (mutation) {
                mutation.retryCount++;

                // 5 denemeden fazla başarısız olduysa sil (Sonsuz döngüyü engelle)
                if (mutation.retryCount > 5) {
                    store.delete(id);
                    console.warn(`Mutation ${id} 5 kez denendi ve başarısız oldu, kuyruktan siliniyor.`);
                } else {
                    store.put(mutation);
                }
            }
        };

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        // Backup güncelle
        await backupToLocalStorage();
    } catch (error) {
        console.error('Retry count güncellenemedi:', error);
    }
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
        return backup ? JSON.parse(backup) : [];
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
