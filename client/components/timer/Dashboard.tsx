import React, { useContext } from 'react';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { fetchSolves } from '../../db/solves/query';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import { useSettings } from '../../util/hooks/useSettings';
import Scramble from '../modules/scramble/ScrambleVisual';
import HistorySolveRow from '../modules/history/solve_row/HistorySolveRow';
import Empty from '../common/empty/Empty';
import block from '../../styles/bem';
import './Dashboard.scss';

const b = block('timer-dashboard');

export default function Dashboard() {
    const context = useContext(TimerContext);
    const { scramble, cubeType, solvesFilter, timeStartedAt, focusMode } = context;
    const mobileMode = useGeneral('mobile_mode');
    const sessionId = useSettings('session_id');

    useSolveDb();

    // Son çözümleri al (Mobilde scroll edilebilsin diye 50 tane)
    const solves = fetchSolves(solvesFilter);
    const recentSolves = solves.slice(0, 50);

    // Focus modunda gizle
    if (focusMode) {
        return null;
    }

    const historyContent = recentSolves.length > 0 ? (
        <div className={b('history-list')}>
            {recentSolves.map((solve, index) => (
                <HistorySolveRow
                    key={solve.id}
                    solve={solve}
                    index={solves.length - index - 1}
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
                <Scramble cubeType={cubeType} scramble={scramble} />
            </div>
        </div>
    );
}
