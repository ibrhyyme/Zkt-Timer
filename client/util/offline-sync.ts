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

const MAX_RETRIES = 3;

/**
 * Sunucuya gerçekten erişilebildiğini doğrula
 */
async function isReallyOnline(): Promise<boolean> {
    try {
        const res = await fetch('/graphql', {
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
function assertNoGraphQLErrors(result: any): void {
    if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
    }
}

/**
 * Queue'yu işle ve tüm pending mutation'ları sync et
 */
export async function processQueue(): Promise<void> {
    if (!navigator.onLine) return;

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

            // Retry limit'e ulaştıysa, queue'dan sil
            if (mutation.retryCount >= MAX_RETRIES) {
                await removeFromQueue(mutation.id);
                failCount++;
                toastError(`Bir çözüm ${MAX_RETRIES} denemeden sonra senkronize edilemedi.`);
            } else {
                // Retry count artır
                await incrementRetryCount(mutation.id);
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
        toastError(`${failCount} çözüm senkronize edilemedi.`);
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
    assertNoGraphQLErrors(result);
}

async function executeDeleteSolves(variables: any): Promise<void> {
    const query = gql`
		mutation Mutate($ids: [String!]!) {
			deleteSolves(ids: $ids)
		}
	`;

    const result = await gqlMutate(query, variables);
    assertNoGraphQLErrors(result);
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
