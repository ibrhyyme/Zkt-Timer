import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { TimerContext } from '../Timer';
import { useLiveAnalysis } from '../../../util/hooks/useLiveAnalysis';
import './LiveAnalysisOverlay.scss';
import block from '../../../styles/bem';
import { useSettings } from '../../../util/hooks/useSettings';
import { is3x3CubeType } from '../helpers/util';
import { getTimeString } from '../../../util/time';

const b = block('live-analysis');

// Phase ID -> wrapper steps key. Cf_plus_op gibi composite ID'ler en yakin gercek step'e map'lenir.
function phaseIdToStepKey(id: string): string | null {
    switch (id) {
        case 'Cross': return 'cross';
        case 'F2L': return 'f2l';
        case 'F2L_1': return 'f2l_1';
        case 'F2L_2': return 'f2l_2';
        case 'F2L_3': return 'f2l_3';
        case 'F2L_4': return 'f2l_4';
        case 'OLL':
        case 'OLL_EO':
        case 'OLL_CO':
            return 'oll';
        case 'PLL':
        case 'PLL_CP':
        case 'PLL_EP':
            return 'pll';
        case 'CF': return 'f2l';
        case 'OP': return 'pll';
        default: return null;
    }
}

export default function LiveAnalysisOverlay({ startState, mobile }: { startState?: string, mobile?: boolean }) {
    const { t: tr } = useTranslation();
    const { smartTurns, timeStartedAt, lastSmartSolveStats } = useContext(TimerContext);
    const rawAnalysisMode = useSettings('smart_cube_analysis_mode') || 'cffffop';
    // Mobilde cffffoopp 11 satira cikiyor — sigmaz. cffffop'a (7 satir) fallback yap.
    const analysisMode = (mobile && rawAnalysisMode === 'cffffoopp') ? 'cffffop' : rawAnalysisMode;
    const showRecognition = !!useSettings('smart_cube_show_recognition');
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

    // ── DEBUG: window.__SMART_DEBUG__ = true ile aktif olur ──
    // Solve sirasinda analysis her degistiginde + solve bitince correctedAnalysis geldiginde dump
    const lastDebugLogRef = React.useRef<string>('');
    React.useEffect(() => {
        if (typeof window === 'undefined' || !(window as any).__SMART_DEBUG__) return;
        const target = timeStartedAt && shouldRun
            ? analysis
            : (lastSmartSolveStats?.correctedAnalysis || null);
        if (!target) return;
        const stepsActive = target.steps
            ? Object.keys(target.steps).filter(k => target.steps[k]).reduce((acc: any, k) => {
                const s = target.steps[k];
                acc[k] = { idx: s.index, side: s.side, case: s.case };
                return acc;
            }, {})
            : {};
        const snapshot = {
            src: timeStartedAt && shouldRun ? 'live' : 'corrected',
            phase: target.currentPhase,
            crossSolved: target.crossSolved,
            f2lCount: target.f2lCount,
            oll: target.ollIdentified,
            pll: target.pllIdentified,
            isSolved: target.isSolved,
            steps: stepsActive,
            times: target.times,
            shouldRun,
            is3x3,
            cubeType,
            scrambleSubset,
            turns: smartTurns?.length || 0,
            startState: startState ? startState.slice(0, 20) + '...' : 'NONE'
        };
        // Sadece JSON degisirse logla (gurultu onleme)
        const json = JSON.stringify(snapshot);
        if (json === lastDebugLogRef.current) return;
        lastDebugLogRef.current = json;
        console.log('%c[ANALYSIS]', 'color:#E91E63;font-weight:bold', snapshot);
    }, [analysis, lastSmartSolveStats, shouldRun, is3x3, timeStartedAt]);

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

    // Engine'den skipped + recognition/execution split ek alanlarini her phase'e enjekte et.
    // Wrapper steps[stepKey] = { skipped, recognitionMs, executionMs, ... }
    phases.forEach((p) => {
        const stepKey = phaseIdToStepKey(p.id);
        const step = stepKey ? displayAnalysis.steps?.[stepKey] : null;
        p.skipped = !!step?.skipped;
        p.recognitionTime = step?.recognitionMs != null ? step.recognitionMs / 1000 : undefined;
        p.executionTime = step?.executionMs != null ? step.executionMs / 1000 : undefined;
    });

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

    // Done olan fazlari render et. Skipped phase'ler time=0 ile gelir; gostermek istiyoruz
    // (rozet icin) — ama cumulative'a etki etmez.
    const renderableRows = mergedPhases.filter(p =>
        p.done && (p.skipped || (p.time != null && p.time > 0))
    );
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
                    if (!p.skipped) cumulative += p.time;
                    const showCumulative = idx > 0 && !p.skipped;

                    const timeStr = getTimeString(p.time || 0, 2);
                    const [sec, dec] = timeStr.split('.');

                    const cumStr = getTimeString(cumulative, 2);
                    const [cSec, cDec] = cumStr.split('.');

                    // Recognition/execution split string'i — sadece desktop'ta, toggle aciksa.
                    // Mobile'de yer yok (1.4rem font + dar grid), gizliyoruz.
                    const showSplit = showRecognition && !mobile && !p.skipped &&
                        p.recognitionTime != null && p.executionTime != null;
                    const splitStr = showSplit
                        ? `${tr('solve_info.recognition_short')}:${p.recognitionTime.toFixed(2)} + ${tr('solve_info.execution_short')}:${p.executionTime.toFixed(2)}`
                        : null;

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

                    const splitRowStyle: React.CSSProperties = {
                        fontSize: '0.95rem',
                        opacity: 0.65,
                        fontWeight: 500,
                        lineHeight: '1',
                        alignSelf: 'baseline',
                        marginRight: '4px',
                    };

                    const skipBadge = p.skipped ? (
                        <span className={b('skip-badge')}>{tr('solve_info.skip_badge')}</span>
                    ) : null;

                    // Mobilde 2-sutun grid: sutun 1 split, sutun 2 cumulative
                    if (mobile) {
                        return (
                            <React.Fragment key={p.id}>
                                <div className={b('row', { active: p.active, done: p.done, skipped: p.skipped })} style={rowStyle}>
                                    <span className={b('symbol')} style={{ color: '#fff' }}>{p.label}</span>
                                    {p.skipped ? (
                                        skipBadge
                                    ) : (
                                        <span className={b('time-val')} style={{ color: '#60a5fa' }}>
                                            <span>
                                                {sec}
                                                <span style={{ fontSize: '0.6em', opacity: 0.8 }}>.{dec}</span>
                                            </span>
                                        </span>
                                    )}
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

                    // Desktop: split (T:.. U:..) inline solda + label/zaman + cumulative yan yana.
                    // Toggle kapaliysa split gozukmez, layout daralir.
                    return (
                        <div key={p.id} className={b('row', { active: p.active, done: p.done, skipped: p.skipped })} style={rowStyle}>
                            {splitStr && (
                                <div className={b('split-inline')} style={splitRowStyle}>{splitStr}</div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                <span className={b('symbol')} style={{ color: '#fff' }}>
                                    {p.label}
                                </span>
                                {p.skipped ? (
                                    skipBadge
                                ) : (
                                    <span className={b('time-val')} style={{ color: '#60a5fa' }}>
                                        <span>
                                            {sec}
                                            <span style={{ fontSize: '0.6em', opacity: 0.8 }}>.{dec}</span>
                                        </span>
                                    </span>
                                )}
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
