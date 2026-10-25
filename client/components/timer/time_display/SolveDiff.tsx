import React, { useContext } from 'react';
import { RootStateOrAny, useSelector } from 'react-redux';
import { useActiveSessionId } from '../../../util/hooks/useActiveSessionId';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { fetchSolves } from '../../../db/solves/query';
import { TimerContext } from '../Timer';
import { smartCubeSelected } from '../helpers/util';
import block from '../../../styles/bem';
import './SolveDiff.scss';

const b = block('solve-diff');

function SolveDiff() {
    const context = useContext(TimerContext);
    const { timeStartedAt, solving } = context;
    // The countdown itself ticks every 100 ms and is not in TimerContext (see
    // FAST_TIMER_FIELDS); only whether any of it is left matters here.
    const inspectionLeft = useSelector((state: RootStateOrAny) => state.timer.inspectionTimer > 0);
    const sessionId = useActiveSessionId();

    // Subscribe to DB updates
    useSolveDb();

    // Timer çalışıyorken veya inceleme esnasındayken gizle ama yer kapla (timer kaymasin)
    // Same while a smart cube waits to be solved again after an abandoned attempt: the
    // display reads 0.00 then, and the difference between the last two saved solves
    // under it described neither (feedback 2.3-c, "0.00 (+4.58)").
    if (timeStartedAt || solving || (context.inInspection && inspectionLeft) || (smartCubeSelected(context) && context.smartNeedsCubeReset)) {
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
        // Placeholder, not null: dropping the line moved the time up by its height.
        return placeholder;
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
