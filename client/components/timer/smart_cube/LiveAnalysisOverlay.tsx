import React, { useContext } from 'react';
import { TimerContext } from '../Timer';
import { useLiveAnalysis } from '../../../util/hooks/useLiveAnalysis';
import './LiveAnalysisOverlay.scss';
import block from '../../../styles/bem';
import { useSettings } from '../../../util/hooks/useSettings';
import { is3x3CubeType } from '../helpers/util';
import { getTimeString } from '../../../util/time';

const b = block('live-analysis');

export default function LiveAnalysisOverlay({ startState, mobile }: { startState?: string, mobile?: boolean }) {
    const { smartTurns, timeStartedAt, lastSmartSolveStats } = useContext(TimerContext);
    const rawAnalysisMode = useSettings('smart_cube_analysis_mode') || 'cffffop';
    // Mobilde cffffoopp 11 satira cikiyor — sigmaz. cffffop'a (7 satir) fallback yap.
    const analysisMode = (mobile && rawAnalysisMode === 'cffffoopp') ? 'cffffop' : rawAnalysisMode;
    const cubeType = useSettings('cube_type');
    const scrambleSubset = useSettings('scramble_subset');

    // Tum 3x3 varyantlarinda (333, 333cfop, 333roux, 333zz, 333mehta, 333sub ve wca+333) calisir.
    // Subset'lerde de aktif (OLL, PLL, ZBLL) — kullanici tercihi: tum 3x3 cozumlerinde analiz olsun.
    const is3x3 = is3x3CubeType(cubeType, scrambleSubset);
    const shouldRun = (!!timeStartedAt || (smartTurns && smartTurns.length > 0)) && is3x3;

    const [cachedAnalysis, setCachedAnalysis] = React.useState<any>(null);
    const prevStartState = React.useRef(startState);

    // STICKY HISTORY: Keep completed phases visible even if user breaks them temporarily.
    // Moved to top-level to avoid "Rendered more hooks" error.
    const phaseHistory = React.useRef<Record<string, any>>({});

    // Map smartTurns to include time property (from completedAt)
    const processedTurns = React.useMemo(() => (smartTurns || []).map(t => ({
        ...t,
        time: t.completedAt ? new Date(t.completedAt).getTime() : 0
    })), [smartTurns]);

    const analysis = useLiveAnalysis(shouldRun ? processedTurns : [], startState);

    // Clear cache on new start
    React.useEffect(() => {
        if (timeStartedAt) {
            setCachedAnalysis(null);
            phaseHistory.current = {}; // Clear history on start
        }
    }, [timeStartedAt]);



    // Persist logic
    React.useEffect(() => {
        // Only update cache if we have turns and it's different from current cache
        // CRITICAL: Only update while timer is RUNNING (timeStartedAt). 
        // If we update during scrambling (timeStartedAt is null), we overwrite the previous result with empty scramble data.
        if (timeStartedAt && analysis.steps) {
            setCachedAnalysis(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(analysis)) {
                    return analysis;
                }
                return prev;
            });
        }
    }, [analysis, timeStartedAt]);

    // Display Logic:
    // If Timer is RUNNING, show live 'analysis'.
    // Otherwise (Scramble/Inspection/Finished), show corrected analysis (linear fit) or cached.
    // correctedAnalysis = linear fit ile düzeltilmiş evre süreleri (doğru)
    // cachedAnalysis = ham BLE timestamp'lerinden hesaplanmış (yaklaşık)
    const displayAnalysis = timeStartedAt && shouldRun
        ? analysis
        : (lastSmartSolveStats?.correctedAnalysis || cachedAnalysis);

    if (!displayAnalysis || analysisMode === 'none' || !is3x3) return null;

    const formatTime = (t?: number) => t ? t.toFixed(2) : '-';

    // Calculate splits
    const t = displayAnalysis.times || {};
    const f2lPairs = t.f2l_pairs || [];

    // Logic for different modes
    let phases: any[] = [];
    const currentPhase = displayAnalysis.currentPhase;

    if (analysisMode === 'cf_plus_op') {
        // CF + OP (2 Steps)
        // CF = Cross + F2L
        const cfTime = t.f2l;
        const cfDone = ['OLL', 'PLL', 'Solved'].includes(currentPhase);
        const cfActive = ['Cross', 'F2L'].some(p => currentPhase.startsWith(p));

        // OP = OLL + PLL (LL)
        const opTime = t.pll && t.f2l ? t.pll - t.f2l : undefined;
        const opDone = currentPhase === 'Solved';
        const opActive = ['OLL', 'PLL'].includes(currentPhase);

        phases = [
            { id: 'CF', label: 'F2L (CF)', done: cfDone, active: cfActive, time: cfTime },
            { id: 'OP', label: 'Last Layer', done: opDone, active: opActive, time: opTime },
        ];

    } else if (analysisMode === 'cfop') {
        // Standard CFOP
        const splits = {
            cross: t.cross,
            f2l: t.f2l && t.cross ? t.f2l - t.cross : undefined,
            oll: t.oll && t.f2l ? t.oll - t.f2l : undefined,
            pll: t.pll && t.oll ? t.pll - t.oll : undefined
        };
        phases = [
            { id: 'Cross', label: 'Cross', done: displayAnalysis.crossSolved, active: currentPhase === 'Cross' || (!displayAnalysis.crossSolved && currentPhase === 'Scramble/Inspection'), time: splits.cross },
            { id: 'F2L', label: 'F2L', done: ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: currentPhase.startsWith('F2L'), time: splits.f2l },
            { id: 'OLL', label: 'OLL', done: ['PLL', 'Solved'].includes(currentPhase), active: currentPhase === 'OLL', info: displayAnalysis.ollIdentified, time: splits.oll },
            { id: 'PLL', label: 'PLL', done: currentPhase === 'Solved', active: currentPhase === 'PLL', info: displayAnalysis.pllIdentified, time: splits.pll },
        ];

    } else if (analysisMode === 'cffffop') {
        // Granular F2L (Standard CFFFFOP)
        const splits = {
            cross: t.cross,
            f2l_1: f2lPairs[0] && t.cross ? f2lPairs[0] - t.cross : undefined,
            f2l_2: f2lPairs[1] && f2lPairs[0] ? f2lPairs[1] - f2lPairs[0] : undefined,
            f2l_3: f2lPairs[2] && f2lPairs[1] ? f2lPairs[2] - f2lPairs[1] : undefined,
            f2l_4: f2lPairs[3] && f2lPairs[2] ? f2lPairs[3] - f2lPairs[2] : (t.f2l && f2lPairs[2] ? t.f2l - f2lPairs[2] : undefined),
            oll: t.oll && t.f2l ? t.oll - t.f2l : undefined,
            pll: t.pll && t.oll ? t.pll - t.oll : undefined
        };

        const isF2LActive = (pairIndex: number) => {
            if (!currentPhase.startsWith('F2L')) return false;
            // Map F2L phases to index
            if (currentPhase === 'F2L') return pairIndex === 0;
            if (currentPhase === 'F2L (1)') return pairIndex === 0;
            if (currentPhase === 'F2L (2)') return pairIndex === 1;
            if (currentPhase === 'F2L (3)') return pairIndex === 2;
            if (currentPhase === 'F2L (4)') return pairIndex === 3;
            return false;
        };

        phases = [
            { id: 'Cross', label: 'Cross', done: displayAnalysis.crossSolved, active: currentPhase === 'Cross' || (!displayAnalysis.crossSolved && currentPhase === 'Scramble/Inspection'), time: splits.cross },

            { id: 'F2L_1', label: '1. Pair', done: !!f2lPairs[0] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(0), time: splits.f2l_1 },
            { id: 'F2L_2', label: '2. Pair', done: !!f2lPairs[1] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(1), time: splits.f2l_2 },
            { id: 'F2L_3', label: '3. Pair', done: !!f2lPairs[2] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(2), time: splits.f2l_3 },
            { id: 'F2L_4', label: '4. Pair', done: !!f2lPairs[3] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(3), time: splits.f2l_4 },

            { id: 'OLL', label: 'OLL', done: ['PLL', 'Solved'].includes(currentPhase), active: currentPhase === 'OLL', info: displayAnalysis.ollIdentified, time: splits.oll },
            { id: 'PLL', label: 'PLL', done: currentPhase === 'Solved', active: currentPhase === 'PLL', info: displayAnalysis.pllIdentified, time: splits.pll },
        ];
    } else if (analysisMode === 'cffffoopp') {
        // Full Detail (2-Look OLL/PLL)
        // Need EO/CP times
        const eoAbs = t.oll_eo; // Absolute time when EO finished
        const ollAbs = t.oll;
        const cpAbs = t.pll_cp;
        const pllAbs = t.pll;
        const f2lAbs = t.f2l;

        // Split calc
        // EO Split = EO - F2L
        const eoSplit = eoAbs && f2lAbs ? eoAbs - f2lAbs : undefined;
        // OLL (CO) Split = OLL - EO
        const coSplit = ollAbs && eoAbs ? ollAbs - eoAbs : (ollAbs && f2lAbs ? ollAbs - f2lAbs : undefined);

        // CP Split = CP - OLL
        const cpSplit = cpAbs && ollAbs ? cpAbs - ollAbs : undefined;
        // EP Split = PLL - CP
        const epSplit = pllAbs && cpAbs ? pllAbs - cpAbs : (pllAbs && ollAbs ? pllAbs - ollAbs : undefined);

        // F2L Logic identical to CFFFFOP
        const splits = {
            cross: t.cross,
            f2l_1: f2lPairs[0] && t.cross ? f2lPairs[0] - t.cross : undefined,
            f2l_2: f2lPairs[1] && f2lPairs[0] ? f2lPairs[1] - f2lPairs[0] : undefined,
            f2l_3: f2lPairs[2] && f2lPairs[1] ? f2lPairs[2] - f2lPairs[1] : undefined,
            f2l_4: f2lPairs[3] && f2lPairs[2] ? f2lPairs[3] - f2lPairs[2] : (t.f2l && f2lPairs[2] ? t.f2l - f2lPairs[2] : undefined),
        };
        const isF2LActive = (pairIndex: number) => {
            if (!currentPhase.startsWith('F2L')) return false;
            // Map F2L phases to index
            if (currentPhase === 'F2L') return pairIndex === 0;
            if (currentPhase === 'F2L (1)') return pairIndex === 0;
            if (currentPhase === 'F2L (2)') return pairIndex === 1;
            if (currentPhase === 'F2L (3)') return pairIndex === 2;
            if (currentPhase === 'F2L (4)') return pairIndex === 3;
            return false;
        };

        const eoDone = !!eoAbs || ['PLL', 'Solved'].includes(currentPhase);
        const coDone = !!ollAbs || ['PLL', 'Solved'].includes(currentPhase);
        const cpDone = !!cpAbs || currentPhase === 'Solved';
        const epDone = !!pllAbs || currentPhase === 'Solved';

        phases = [
            { id: 'Cross', label: 'Cross', done: displayAnalysis.crossSolved, active: currentPhase === 'Cross' || (!displayAnalysis.crossSolved && currentPhase === 'Scramble/Inspection'), time: splits.cross },

            { id: 'F2L_1', label: '1. Pair', done: !!f2lPairs[0] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(0), time: splits.f2l_1 },
            { id: 'F2L_2', label: '2. Pair', done: !!f2lPairs[1] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(1), time: splits.f2l_2 },
            { id: 'F2L_3', label: '3. Pair', done: !!f2lPairs[2] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(2), time: splits.f2l_3 },
            { id: 'F2L_4', label: '4. Pair', done: !!f2lPairs[3] || ['OLL', 'PLL', 'Solved'].includes(currentPhase), active: isF2LActive(3), time: splits.f2l_4 },

            { id: 'OLL_EO', label: 'OLL (EO)', done: eoDone, active: currentPhase === 'OLL' && !eoDone, time: eoSplit },
            { id: 'OLL_CO', label: 'OLL (CO)', done: coDone, active: currentPhase === 'OLL' && eoDone, info: displayAnalysis.ollIdentified, time: coSplit },

            { id: 'PLL_CP', label: 'PLL (CP)', done: cpDone, active: currentPhase === 'PLL' && !cpDone, time: cpSplit },
            { id: 'PLL_EP', label: 'PLL (EP)', done: epDone, active: currentPhase === 'PLL' && cpDone, info: displayAnalysis.pllIdentified, time: epSplit },
        ];
    }

    // Re-mapping labels for all modes to numeric style
    phases.forEach((p, i) => {
        p.label = i === 0 ? '=' : '+';
    });

    // Update history with currently DONE phases (Using ref from top scope)
    phases.forEach(p => {
        if (p.done && p.time) {
            phaseHistory.current[p.id] = { ...p };
        }
    });

    // Merge history: If live phase is NOT done, but we have it in history, use history.
    const mergedPhases = phases.map(p => {
        if (p.done) return p; // Live data is best
        if (phaseHistory.current[p.id]) {
            return {
                ...phaseHistory.current[p.id],
                active: false // It was done, so it's not active anymore (fallback)
            };
        }
        return p;
    });

    // Visibility Guard: ONLY show if timer is running OR solved.
    // Also explicitly block Scramble/Inspection phase to catch edge cases.
    if (
        (!timeStartedAt && !displayAnalysis.isSolved) ||
        currentPhase === 'Scramble/Inspection'
    ) return null;

    // Sadece zamani olan ve done olan fazlari render et — cumulative hesabi icin
    const renderableRows = mergedPhases.filter(p => p.done && p.time != null && p.time > 0);
    let cumulative = 0;

    return (
        <div className={b()}>
            <div className={b('table')} style={mobile ? {
                display: 'grid',
                gridTemplateColumns: 'max-content max-content',
                columnGap: '8px',
                rowGap: '0px',
                width: '100%',
                justifyContent: 'start',
                paddingLeft: '2px',
                justifyItems: 'start'
            } : {}}>
                {renderableRows.map((p, idx) => {
                    cumulative += p.time;
                    const showCumulative = idx > 0;

                    const timeStr = getTimeString(p.time, 2);
                    const [sec, dec] = timeStr.split('.');

                    const cumStr = getTimeString(cumulative, 2);
                    const [cSec, cDec] = cumStr.split('.');

                    const rowStyle: React.CSSProperties = {
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        gap: mobile ? '10px' : '16px',
                        marginBottom: mobile ? '4px' : '12px',
                        whiteSpace: 'nowrap',
                        fontSize: mobile ? '1.4rem' : '2.5rem',
                        lineHeight: '1.1',
                        fontWeight: '700',
                    };

                    // Mobilde 2-sutun grid: sutun 1 split, sutun 2 cumulative
                    if (mobile) {
                        return (
                            <React.Fragment key={p.id}>
                                <div className={b('row', { active: p.active, done: p.done })} style={rowStyle}>
                                    <span className={b('symbol')} style={{ color: '#fff' }}>{p.label}</span>
                                    <span className={b('time-val')} style={{ color: '#60a5fa' }}>
                                        <span>
                                            {sec}
                                            <span style={{ fontSize: '0.6em', opacity: 0.8 }}>.{dec}</span>
                                        </span>
                                    </span>
                                </div>
                                <div className={b('row', { done: p.done })} style={rowStyle}>
                                    {showCumulative && (
                                        <>
                                            <span className={b('symbol')} style={{ color: '#fff' }}>=</span>
                                            <span className={b('time-val')} style={{ color: '#60a5fa' }}>
                                                <span>
                                                    {cSec}
                                                    <span style={{ fontSize: '0.6em', opacity: 0.8 }}>.{cDec}</span>
                                                </span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                    }

                    // Desktop: tek satir icinde split + cumulative yan yana
                    return (
                        <div key={p.id} className={b('row', { active: p.active, done: p.done })} style={rowStyle}>
                            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                <span className={b('symbol')} style={{ color: '#fff' }}>
                                    {p.label}
                                </span>
                                <span className={b('time-val')} style={{ color: '#60a5fa' }}>
                                    <span>
                                        {sec}
                                        <span style={{ fontSize: '0.6em', opacity: 0.8 }}>.{dec}</span>
                                    </span>
                                </span>
                            </div>
                            {showCumulative && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                }}>
                                    <span className={b('symbol')} style={{ color: '#fff' }}>=</span>
                                    <span className={b('time-val')} style={{ color: '#60a5fa' }}>
                                        <span>
                                            {cSec}
                                            <span style={{ fontSize: '0.6em', opacity: 0.8 }}>.{cDec}</span>
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
