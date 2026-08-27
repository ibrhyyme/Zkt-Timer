/**
 * Offline Sync Manager
 *
 * Queue'daki mutation'ları işleme ve sync etme
 */

import { gql } from '@apollo/client/core';
import { gqlMutate } from '../components/api';
import { getAllQueued, removeFromQueue, incrementRetryCount, clearQueue } from './offline-queue';
import { toastSuccess, toastError, toastInfo } from './toast';
import { emitEvent } from './event_handler';
import { deleteLocalStorage } from './data/local_storage';
import { getNetworkStatus } from './native-plugins';
import { getApiBase } from './api-base';

const MAX_RETRIES = 3;

/**
 * Sunucuya gerçekten erişilebildiğini doğrula
 */
async function isReallyOnline(): Promise<boolean> {
    try {
        // Absolute base: in the native local bundle a relative /graphql would hit the
        // bundle origin (always "up"), making the probe lie about connectivity.
        const res = await fetch(`${getApiBase()}/graphql`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ __typename }' }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * GraphQL mutation sonucunu kontrol et - errors varsa hata fırlat
 */
/**
 * `ignoreCodes` lets a mutation treat some server rejections as the outcome it wanted. A
 * delete for a solve the server no longer has has already achieved its goal; now that the
 * queue never drops anything, calling that a failure would retry it for ever.
 */
function assertNoGraphQLErrors(result: any, ignoreCodes: string[] = []): void {
    const errors = result?.errors;
    if (!errors || errors.length === 0) return;
    const blocking = errors.filter((e: any) => !ignoreCodes.includes(e?.extensions?.code));
    if (blocking.length > 0) {
        throw new Error(blocking[0].message);
    }
}

/**
 * Queue'yu işle ve tüm pending mutation'ları sync et
 */
export async function processQueue(): Promise<void> {
    const online = await getNetworkStatus();
    if (!online) return;

    // Gerçekten sunucuya erişilebildiğini doğrula
    const reallyOnline = await isReallyOnline();
    if (!reallyOnline) return;

    const queued = await getAllQueued();

    if (queued.length === 0) {
        return;
    }

    toastInfo(`${queued.length} çözüm senkronize ediliyor...`);

    let successCount = 0;
    let failCount = 0;

    for (const mutation of queued) {
        try {
            await executeMutation(mutation);
            await removeFromQueue(mutation.id);
            successCount++;
        } catch (error) {
            console.error(`Mutation ${mutation.id} başarısız:`, error);
            await incrementRetryCount(mutation.id);

            // The mutation is never dropped. Deleting it after three tries meant a solve
            // that failed to reach the server — because the server was briefly down, a
            // token had expired, a request timed out — lived on that one device for ever
            // and no later sync would ever look at it again. It stays queued instead, and
            // every future sync tries it again.
            //
            // The warning is shown once, on the attempt that crosses the threshold, so a
            // permanently unsendable record cannot nag on every single sync.
            if (mutation.retryCount === MAX_RETRIES) {
                failCount++;
                toastError('Bir çözüm senkronize edilemedi. Daha sonra tekrar denenecek.');
            }
        }
    }

    if (successCount > 0) {
        toastSuccess(`${successCount} çözüm senkronize edildi!`);

        // Sayfa yenilenince sunucudan taze veri çekilsin diye offlineHash'i sil
        deleteLocalStorage('offlineHash');

        emitEvent('offlineSyncCompleted', { successCount, failCount });
    }

    if (failCount > 0) {
        toastError(`${failCount} çözüm senkronize edilemedi, kuyrukta bekliyor.`);
    }
}

/**
 * Tek bir mutation'ı GraphQL'e gönder
 */
async function executeMutation(mutation: any): Promise<void> {
    const { mutationName, variables } = mutation;

    switch (mutationName) {
        case 'createSolve':
            await executeCreateSolve(variables);
            break;
        case 'updateSolve':
            await executeUpdateSolve(variables);
            break;
        case 'deleteSolve':
            await executeDeleteSolve(variables);
            break;
        case 'deleteSolves':
            await executeDeleteSolves(variables);
            break;
        default:
            console.warn(`Bilinmeyen mutation: ${mutationName}`);
    }
}

async function executeCreateSolve(variables: any): Promise<void> {
    const query = gql`
		mutation Mutate($input: SolveInput) {
			createSolve(input: $input) {
				id
			}
		}
	`;

    const result = await gqlMutate(query, variables);
    assertNoGraphQLErrors(result);
}

async function executeUpdateSolve(variables: any): Promise<void> {
    const query = gql`
		mutation Mutate($id: String, $input: SolveInput) {
			updateSolve(id: $id, input: $input) {
				id
			}
		}
	`;

    const result = await gqlMutate(query, variables);
    assertNoGraphQLErrors(result);
}

async function executeDeleteSolve(variables: any): Promise<void> {
    const query = gql`
		mutation Mutate($id: String) {
			deleteSolve(id: $id) {
				id
			}
		}
	`;

    const result = await gqlMutate(query, variables);
    assertNoGraphQLErrors(result, ['NOT_FOUND']);
}

async function executeDeleteSolves(variables: any): Promise<void> {
    const query = gql`
		mutation Mutate($ids: [String!]!) {
			deleteSolves(ids: $ids)
		}
	`;

    const result = await gqlMutate(query, variables);
    assertNoGraphQLErrors(result, ['NOT_FOUND']);
}

/**
 * Online olup olmadığını kontrol et
 */
export function isOnline(): boolean {
    return navigator.onLine;
}

/**
 * Background Sync kaydı (destekleyen tarayıcılarda)
 */
export async function registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            // @ts-ignore - Background Sync API
            if (registration.sync) {
                // @ts-ignore - Background Sync API
                await registration.sync.register('sync-solves');
            }
        } catch (error) {
            console.warn('Background Sync kayıt edilemedi:', error);
        }
    }
}
