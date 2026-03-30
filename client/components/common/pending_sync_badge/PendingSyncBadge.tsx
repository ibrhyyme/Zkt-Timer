import React, { useEffect, useState } from 'react';
import { getPendingCount } from '../../../util/offline-queue';
import { processQueue, isOnline } from '../../../util/offline-sync';
import { useEventListener } from '../../../util/event_handler';
import './PendingSyncBadge.scss';
import block from '../../../styles/bem';
import { useMe } from '../../../util/hooks/useMe';
import { isPro, isProEnabled } from '../../../lib/pro';

const b = block('pending-sync-badge');

/**
 * Offline pending solve sayısını gösteren ve sync tetikleyen badge
 */
export default function PendingSyncBadge() {
    const me = useMe();
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    // İlk yükleme
    useEffect(() => {
        updateCount();
    }, []);

    // Offline sync tamamlandığında count'u güncelle
    useEventListener('offlineSyncCompleted', () => {
        updateCount();
        setSyncing(false);
    });

    // Solve kaydedildiğinde/silindiğinde count'u güncelle
    useEventListener('solveDbUpdatedEvent', () => {
        // 500ms debounce ile count'u güncelle
        setTimeout(updateCount, 500);
    });

    async function updateCount() {
        const count = await getPendingCount();
        setPendingCount(count);
    }

    async function handleClick() {
        if (syncing || pendingCount === 0) return;

        if (!isOnline()) {
            return;
        }

        setSyncing(true);
        try {
            await processQueue();
            await updateCount();
        } catch (error) {
            console.error('Sync hatası:', error);
        } finally {
            setSyncing(false);
        }
    }

    // Pro degilse sync yok, badge anlamsiz
    if (isProEnabled() && !isPro(me)) {
        return null;
    }

    // Pending yoksa gösterme
    if (pendingCount === 0) {
        return null;
    }

    return (
        <div className={b({ syncing })} onClick={handleClick} title="Senkronize edilmeyi bekleyen çözümler">
            <span className={b('icon')}>🔄</span>
            <span className={b('count')}>{pendingCount}</span>
            {syncing && <span className={b('spinner')}>⏳</span>}
        </div>
    );
}
