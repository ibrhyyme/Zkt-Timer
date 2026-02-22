import React, { useContext } from 'react';
import { useSettings } from '../../../util/hooks/useSettings';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { fetchSolves } from '../../../db/solves/query';
import { TimerContext } from '../Timer';
import block from '../../../styles/bem';
import './SolveDiff.scss';

const b = block('solve-diff');

function SolveDiff() {
    const context = useContext(TimerContext);
    const { timeStartedAt, solving, inspectionTimer } = context;
    const sessionId = useSettings('session_id');

    // Subscribe to DB updates
    useSolveDb();

    // Timer çalışıyorken veya inceleme esnasındayken gösterme
    if (timeStartedAt || solving || (context.inInspection && inspectionTimer > 0)) {
        return null;
    }

    const solves = fetchSolves({ session_id: sessionId }, { limit: 20 });

    if (!solves || solves.length < 2) {
        return null;
    }

    const current = solves[0];

    // If current solve is DNF, no valid time to compare
    if (current.dnf) {
        return <div className={b()} style={{ fontSize: '1rem', opacity: 0.7 }}>(N/A)</div>;
    }

    // Find the most recent non-DNF solve before current for comparison
    const previous = solves.find((s, idx) => idx > 0 && !s.dnf);
    if (!previous) {
        return <div className={b()} style={{ fontSize: '1rem', opacity: 0.7 }}>(N/A)</div>;
    }

    const currTime = Number(current.time) || 0;
    const prevTime = Number(previous.time) || 0;

    const diff = currTime - prevTime;
    const absDiff = Math.abs(diff);

    // time zaten saniye cinsinden
    const diffStr = (diff >= 0 ? '+' : '-') + absDiff.toFixed(2);

    // Renk: Negatif (hızlanma) -> Yeşil, Pozitif (yavaşlama) -> Kırmızı
    const isBetter = diff < 0;

    return (
        <div className={b({ better: isBetter, worse: !isBetter })}>
            ({diffStr})
        </div>
    );
}

export default React.memo(SolveDiff);
