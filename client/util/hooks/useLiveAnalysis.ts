import { useMemo, useRef } from 'react';
import { SmartTurn } from '../smart_scramble';
import { buildLiveAnalysisResult, toEngineTurns, LiveAnalysisResult } from '../solve/live_analysis_core';
import { SolveMethod } from '../../../shared/util/solve/types';
import { getMethod } from '../../../shared/util/solve/methods';
import { PhaseAnalyzer } from '../../../shared/util/solve/phase_engine';

const isDebug = () => typeof window !== 'undefined' && (window as any).__SMART_DEBUG__;

const emptyResult = (method: SolveMethod): LiveAnalysisResult => ({
    steps: {},
    method,
    stepOrder: getMethod(method).steps,
    stepTimes: {},
    stepSplits: {},
    stepCases: {},
    currentStep: null,
    currentPhase: 'Scramble/Inspection',
    crossSolved: false,
    f2lCount: 0,
    isSolved: false,
    times: {},
});

interface AnalyzerHandle {
    analyzer: PhaseAnalyzer;
    startState?: string;
    method: SolveMethod;
}

/**
 * Re-deriving the whole solve from move 0 on every new turn made analyzePhases
 * do O(n^2 * axisCount) work over a solve (worse for Roux/ZZ's 24-orientation
 * scan than CFOP's 6) — the growing main-thread stall behind "everything gets
 * choppier as the solve goes on". PhaseAnalyzer carries its cube/counter state
 * across renders in this ref, so each new turn is simulated exactly once.
 */
export function useLiveAnalysis(
    smartTurns: SmartTurn[],
    startState?: string,
    method: SolveMethod = 'cfop'
): LiveAnalysisResult {
    const handleRef = useRef<AnalyzerHandle | null>(null);

    const analysis = useMemo(() => {
        if (!smartTurns || smartTurns.length === 0) {
            handleRef.current = null;
            return emptyResult(method);
        }

        if (isDebug()) {
            const ssLen = startState?.length;
            const ssOk = ssLen === 54;
            if (!ssOk) {
                console.warn('%c[USE_LIVE_ANALYSIS]', 'color:#FF9800;font-weight:bold',
                    'startState invalid', { length: ssLen, head: startState?.slice(0, 27), turnsCount: smartTurns.length });
            } else {
                console.log('%c[USE_LIVE_ANALYSIS]', 'color:#9E9E9E',
                    'input', { turnsCount: smartTurns.length, ssHead: startState!.slice(0, 27) });
            }
        }

        try {
            let handle = handleRef.current;
            // New solve (fresh scramble, method switch, or the stream got shorter —
            // reconnect/reset): start a fresh analyzer instead of feeding it turns
            // from a different solve than the one it was built on.
            const needsReset =
                !handle ||
                handle.startState !== startState ||
                handle.method !== method ||
                smartTurns.length < handle.analyzer.processed;

            if (needsReset) {
                handle = { analyzer: new PhaseAnalyzer(startState, { method }), startState, method };
                handleRef.current = handle;
            }

            const engineTurns = toEngineTurns(smartTurns);
            handle!.analyzer.feed(engineTurns);

            const result = handle!.analyzer.getResult({ method });
            return buildLiveAnalysisResult(result, method, smartTurns);
        } catch (e: any) {
            handleRef.current = null;
            console.error("Live Analysis Error:", e);
            if (isDebug()) {
                console.error('%c[USE_LIVE_ANALYSIS] FAIL', 'color:#F44336;font-weight:bold', {
                    message: e?.message,
                    stack: e?.stack?.slice(0, 200),
                    method,
                    turnsCount: smartTurns.length,
                    last3Turns: smartTurns.slice(-3).map(t => t.turn),
                    startStateLen: startState?.length,
                    startStateHead: startState?.slice(0, 27)
                });
            }
            return emptyResult(method);
        }
    }, [smartTurns, startState, method]);

    return analysis;
}
