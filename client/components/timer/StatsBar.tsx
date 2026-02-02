import React, { useContext, useMemo } from 'react';
import { RootStateOrAny, useSelector } from 'react-redux';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useSettings } from '../../util/hooks/useSettings';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import { getStatsBlockValueFromFilter } from '../modules/quick_stats/util';
import { getTimeString } from '../../util/time';
import { StatsModuleBlock } from '../../../server/schemas/StatsModule.schema';
import block from '../../styles/bem';
import './StatsBar.scss';

const b = block('stats-bar');

// Varsayılan istatistik blokları - şablona uygun: PB, AO5, AO12, Mean
const DEFAULT_STATS: StatsModuleBlock[] = [
    { statType: 'single', sortBy: 'best', averageCount: undefined, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: 5, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: 12, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: null, session: true, colorName: 'primary' },
];

export default function StatsBar() {
    const context = useContext(TimerContext);
    const { solvesFilter, timeStartedAt, focusMode } = context;

    const mobileMode = useGeneral('mobile_mode');
    const sessionId = useSettings('session_id');
    const stats = useSelector((state: RootStateOrAny) => state?.stats);

    useSolveDb();

    // Focus modunda gizle
    if (focusMode) {
        return null;
    }

    // User'ın özelleştirilmiş bloklarını veya varsayılanları kullan
    let statsBlocks = (stats?.blocks as StatsModuleBlock[]) || DEFAULT_STATS;

    // Mobilde sadece ilk 4'ünü göster
    if (mobileMode && statsBlocks.length > 4) {
        statsBlocks = statsBlocks.slice(0, 4);
    }

    const statItems = statsBlocks.map((statBlock, index) => {
        const statValue = getStatsBlockValueFromFilter(statBlock, solvesFilter, sessionId);
        const timeStr = getTimeString(statValue?.time);
        const label = getStatLabel(statBlock);

        return (
            <div key={index} className={b('item')}>
                <span className={b('label')}>{label}</span>
                <span className={b('value')}>{timeStr}</span>
            </div>
        );
    });

    return (
        <div className={b({ mobile: mobileMode })}>
            {statItems}
        </div>
    );
}

// İstatistik etiketini oluştur
function getStatLabel(statOptions: StatsModuleBlock): string {
    const parts: string[] = [];

    if (statOptions.statType === 'average') {
        if (statOptions.averageCount) {
            parts.push(`AO${statOptions.averageCount}`);
        } else {
            parts.push('Mean');
        }
    } else {
        if (statOptions.sortBy === 'best') {
            parts.push('PB');
        } else if (statOptions.sortBy === 'worst') {
            parts.push('Worst');
        } else {
            parts.push('Single');
        }
    }

    return parts.join(' ');
}
