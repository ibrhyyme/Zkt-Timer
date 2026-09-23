import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPendingCount } from '../../../util/offline-queue';
import { requestQueueFlush } from '../../../util/offline-sync';
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
    const { t } = useTranslation();
    const me = useMe();
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    // İlk yükleme
    useEffect(() => {
        updateCount();
    }, []);

    // Her sync koşusundan sonra (başarılı olsun olmasın) count'u güncelle
    useEventListener('offlineSyncCompleted', () => {
        updateCount();
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

        // A manual flush retries every record, including ones waiting out a backoff. It
        // checks connectivity itself.
        setSyncing(true);
        try {
            await requestQueueFlush('manual');
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
        <div className={b({ syncing })} onClick={handleClick} title={t('offline.pending_badge_title')}>
            <span className={b('icon')}>🔄</span>
            <span className={b('count')}>{pendingCount}</span>
            {syncing && <span className={b('spinner')}>⏳</span>}
        </div>
    );
}
