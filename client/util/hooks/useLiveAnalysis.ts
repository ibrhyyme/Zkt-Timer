import { useMemo } from 'react';
import { SmartTurn } from '../smart_scramble';
import { analyzeCurrentState, LiveAnalysisResult } from '../solve/live_analysis_core';

export function useLiveAnalysis(smartTurns: SmartTurn[], startState?: string): LiveAnalysisResult {
    const analysis = useMemo(() => {
        if (!smartTurns || smartTurns.length === 0) {
            return {
                steps: {},
                currentPhase: 'Scramble/Inspection',
                crossSolved: false,
                f2lCount: 0,
                isSolved: false
            } as LiveAnalysisResult;
        }

        try {
            return analyzeCurrentState(smartTurns, startState);
        } catch (e) {
            console.error("Live Analysis Error:", e);
            return {
                steps: {},
                currentPhase: 'Scramble/Inspection',
                crossSolved: false,
                f2lCount: 0,
                isSolved: false
            } as LiveAnalysisResult;
        }
    }, [smartTurns, startState]);

    return analysis;
}
