import React, { useContext, useMemo } from 'react';
import { RootStateOrAny, useSelector, useDispatch } from 'react-redux';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useSettings } from '../../util/hooks/useSettings';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import { getStatsBlockValueFromFilter, getStatsBlockDescription } from '../modules/quick_stats/util';
import { getTimeString } from '../../util/time';
import { StatsModuleBlock } from '../../../server/schemas/StatsModule.schema';
import { openModal } from '../../actions/general';
import HistoryModal from '../modules/history/history_modal/HistoryModal';
import block from '../../styles/bem';
import './StatsBar.scss';

const b = block('stats-bar');

// İstenen mobil istatistikleri: AO5, AO12, AO100, Mean
const MOBILE_STATS: StatsModuleBlock[] = [
    { statType: 'average', sortBy: 'current', averageCount: 5, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: 12, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: 100, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: null, session: true, colorName: 'primary' },
];

// Varsayılan istatistik blokları
const DEFAULT_STATS: StatsModuleBlock[] = [
    { statType: 'single', sortBy: 'best', averageCount: undefined, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: 5, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: 12, session: true, colorName: 'primary' },
    { statType: 'average', sortBy: 'current', averageCount: null, session: true, colorName: 'primary' },
];

export default function StatsBar() {
    const dispatch = useDispatch();
    const context = useContext(TimerContext);
    const { solvesFilter, timeStartedAt, focusMode } = context;

    const mobileMode = useGeneral('mobile_mode');
    const sessionId = useSettings('session_id');
    const timerFontFamily = useSettings('timer_font_family');
    const stats = useSelector((state: RootStateOrAny) => state?.stats);

    useSolveDb();

    // Focus modunda gizle
    if (focusMode) {
        return null;
    }

    // Mobilde kesinlikle sabit liste kullan
    let statsBlocks = mobileMode ? MOBILE_STATS : ((stats?.blocks as StatsModuleBlock[]) || DEFAULT_STATS);

    const statItems = statsBlocks.map((statBlock, index) => {
        const statValue = getStatsBlockValueFromFilter(statBlock, solvesFilter, sessionId);
        const timeStr = getTimeString(statValue?.time);
        const label = getStatLabel(statBlock);

        // Mean (tüm çözümler) için modal açmayı engelle - performans sorunu
        const isSessionMean = statBlock.session && !statBlock.averageCount;

        // Modal açma fonksiyonu
        const handleClick = () => {
            if (isSessionMean) return;
            if (statValue && statValue.solves && statValue.solves.length > 0) {
                const description = getStatsBlockDescription(statBlock, solvesFilter);
                dispatch(openModal(
                    <HistoryModal
                        // Live update için gerekli parametreler
                        statOptions={statBlock}
                        filterOptions={solvesFilter}
                        // Fallback olarak mevcut değerler
                        time={statValue.time}
                        solves={statValue.solves}
                        description={description}
                    />
                ));
            }
        };

        return (
            <div key={index} className={b('item')} onClick={handleClick} style={{ cursor: isSessionMean ? 'default' : 'pointer' }}>
                <span className={b('label')}>{label}</span>
                <span
                    className={b('value')}
                    style={{ fontFamily: timerFontFamily ? `${timerFontFamily}, monospace` : 'inherit' }}
                >
                    {timeStr}
                </span>
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
