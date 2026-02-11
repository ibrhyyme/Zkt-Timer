import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { fetchSolves, fetchSolveCount } from '../../db/solves/query';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import { useSettings } from '../../util/hooks/useSettings';
import Scramble from '../modules/scramble/ScrambleVisual';
import HistorySolveRow from '../modules/history/solve_row/HistorySolveRow';
import Empty from '../common/empty/Empty';
import block from '../../styles/bem';
import './Dashboard.scss';

const b = block('timer-dashboard');
const PAGE_SIZE = 50;

export default function Dashboard() {
    const context = useContext(TimerContext);
    const { scramble, originalScramble, cubeType, solvesFilter, timeStartedAt, focusMode } = context;
    const mobileMode = useGeneral('mobile_mode');
    const sessionId = useSettings('session_id');

    const dbVersion = useSolveDb();
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const listRef = useRef<HTMLDivElement>(null);

    const totalSolveCount = useMemo(() => fetchSolveCount(solvesFilter), [solvesFilter, dbVersion]);
    const solves = useMemo(() => fetchSolves(solvesFilter, { limit: visibleCount }), [solvesFilter, dbVersion, visibleCount]);
    const hasMore = visibleCount < totalSolveCount;

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;

        if (nearBottom && hasMore) {
            setVisibleCount((prev) => prev + PAGE_SIZE);
        }
    }, [hasMore]);

    // Focus modunda gizle
    if (focusMode) {
        return null;
    }

    const historyContent = solves.length > 0 ? (
        <div className={b('history-list')} ref={listRef} onScroll={handleScroll}>
            {solves.map((solve, index) => (
                <HistorySolveRow
                    key={solve.id}
                    solve={solve}
                    index={totalSolveCount - index - 1}
                    disabled={false}
                />
            ))}
        </div>
    ) : (
        <Empty text="Henüz çözüm yok" />
    );

    return (
        <div className={b({ mobile: mobileMode })}>
            {/* Sol: Son Çözümler */}
            <div className={b('section', { history: true })}>
                <div className={b('section-content')}>
                    {historyContent}
                </div>
            </div>

            {/* Sağ: Scramble Görseli (2D Küp Haritası) */}
            <div className={b('section', { scramble: true })}>
                <Scramble cubeType={cubeType} scramble={originalScramble || scramble} />
            </div>
        </div>
    );
}
