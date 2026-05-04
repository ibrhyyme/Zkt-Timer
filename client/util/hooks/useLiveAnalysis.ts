import { useMemo } from 'react';
import { SmartTurn } from '../smart_scramble';
import { analyzeCurrentState, LiveAnalysisResult } from '../solve/live_analysis_core';

const isDebug = () => typeof window !== 'undefined' && (window as any).__SMART_DEBUG__;

export function useLiveAnalysis(smartTurns: SmartTurn[], startState?: string): LiveAnalysisResult {
    const analysis = useMemo(() => {
        if (!smartTurns || smartTurns.length === 0) {
            return {
                steps: {},
                currentPhase: 'Scramble/Inspection',
                crossSolved: false,
                f2lCount: 0,
                isSolved: false,
                times: {}
            } as LiveAnalysisResult;
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
            return analyzeCurrentState(smartTurns, startState);
        } catch (e: any) {
            console.error("Live Analysis Error:", e);
            if (isDebug()) {
                console.error('%c[USE_LIVE_ANALYSIS] FAIL', 'color:#F44336;font-weight:bold', {
                    message: e?.message,
                    stack: e?.stack?.slice(0, 200),
                    turnsCount: smartTurns.length,
                    last3Turns: smartTurns.slice(-3).map(t => t.turn),
                    startStateLen: startState?.length,
                    startStateHead: startState?.slice(0, 27)
                });
            }
            return {
                steps: {},
                currentPhase: 'Scramble/Inspection',
                crossSolved: false,
                f2lCount: 0,
                isSolved: false,
                times: {}
            } as LiveAnalysisResult;
        }
    }, [smartTurns, startState]);

    return analysis;
}
