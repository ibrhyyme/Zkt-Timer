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

    // Timer çalışıyorken veya inceleme esnasındayken gizle ama yer kapla (timer kaymasin)
    if (timeStartedAt || solving || (context.inInspection && inspectionTimer > 0)) {
        return <div className={b()} style={{ visibility: 'hidden' }}>&nbsp;</div>;
    }

    const solves = fetchSolves({ session_id: sessionId }, { limit: 20 });

    const placeholder = <div className={b()} style={{ visibility: 'hidden' }}>&nbsp;</div>;

    if (!solves || solves.length < 2) {
        return placeholder;
    }

    const current = solves[0];

    // If current solve is DNF, no valid time to compare
    if (current.dnf) {
        return placeholder;
    }

    // Find the most recent non-DNF solve before current for comparison
    const previous = solves.find((s, idx) => idx > 0 && !s.dnf);
    if (!previous) {
        return null;
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
