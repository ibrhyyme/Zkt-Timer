import React, { useContext, useState } from 'react';
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
import { useKeyboardOpen } from '../../util/hooks/useKeyboardOpen';
import block from '../../styles/bem';
import './StatsBar.scss';

const b = block('stats-bar');

const MOBILE_STATS_LS_KEY = 'mobile_stats_ao';
const DEFAULT_AO_COUNTS = [5, 12, 100];

function loadMobileAoCounts(): number[] {
    try {
        const stored = localStorage.getItem(MOBILE_STATS_LS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((n: any) => typeof n === 'number' && n >= 3 && n <= 10000)) {
                return parsed;
            }
        }
    } catch {}
    return DEFAULT_AO_COUNTS;
}

function buildMobileStats(aoCounts: number[]): StatsModuleBlock[] {
    return [
        ...aoCounts.map((count) => ({
            statType: 'average' as const,
            sortBy: 'current' as const,
            averageCount: count,
            session: true,
            colorName: 'primary' as const,
        })),
        { statType: 'average' as const, sortBy: 'current' as const, averageCount: null, session: true, colorName: 'primary' as const },
    ];
}

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
    const { solvesFilter, timeStartedAt } = context;

    const mobileMode = useGeneral('mobile_mode');

    const sessionId = useSettings('session_id');
    const timerFontFamily = useSettings('timer_font_family');
    const manualEntry = useSettings('manual_entry');
    const keyboardOpen = useKeyboardOpen();
    const stats = useSelector((state: RootStateOrAny) => state?.stats);

    const [mobileAoCounts, setMobileAoCounts] = useState<number[]>(loadMobileAoCounts);

    useSolveDb();

    // Manuel giriste klavye acikken alt StatsBar'in yukari itilmesini engellemek icin gizle
    // (istatistikler duplike olarak ust panelde zaten gorunur). Klavye kapandiginda geri gelir.
    if (mobileMode && manualEntry && keyboardOpen) {
        return null;
    }

    const mobileStats = buildMobileStats(mobileAoCounts);
    let statsBlocks = mobileMode ? mobileStats : ((stats?.blocks as StatsModuleBlock[]) || DEFAULT_STATS);

    function handleAoCountChange(index: number, newCount: number) {
        const newCounts = [...mobileAoCounts];
        newCounts[index] = newCount;
        setMobileAoCounts(newCounts);
        localStorage.setItem(MOBILE_STATS_LS_KEY, JSON.stringify(newCounts));
    }

    const statItems = statsBlocks.map((statBlock, index) => {
        const statValue = getStatsBlockValueFromFilter(statBlock, solvesFilter, sessionId);
        const timeStr = getTimeString(statValue?.time);
        const label = getStatLabel(statBlock);

        // Mean (tüm çözümler) için modal açmayı engelle - performans sorunu
        const isSessionMean = statBlock.session && !statBlock.averageCount;
        const isEditableAo = mobileMode && !isSessionMean && statBlock.statType === 'average' && index < 3;

        // Modal açma fonksiyonu
        const handleClick = () => {
            if (isSessionMean) return;
            if (statValue && statValue.solves && statValue.solves.length > 0) {
                const description = getStatsBlockDescription(statBlock, solvesFilter);
                dispatch(openModal(
                    <HistoryModal
                        statOptions={statBlock}
                        filterOptions={solvesFilter}
                        time={statValue.time}
                        solves={statValue.solves}
                        description={description}
                        onAoCountChange={isEditableAo ? (newCount) => handleAoCountChange(index, newCount) : undefined}
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
