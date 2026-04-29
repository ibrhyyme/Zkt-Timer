import React, { ReactNode, useContext } from 'react';
import { TimerModuleType } from './@types/enums';
import { TimerContext } from './Timer';
import History from '../modules/history/History';
import Scramble from '../modules/scramble/ScrambleVisual';
import TimeChart from '../modules/time_chart/TimeChart';
import TimeDistro from '../modules/time_distro/TimeDistro';
import CrossSolverModule from '../modules/cross_solver/CrossSolverModule';
import PhaseAnalysis from '../modules/phase_analysis/PhaseAnalysis';
import block from '../../styles/bem';
import './MobileModuleSlot.scss';

const b = block('mobile-module-slot');

interface Props {
    moduleType: TimerModuleType;
}

export default function MobileModuleSlot({ moduleType }: Props) {
    const context = useContext(TimerContext);
    const { scramble, originalScramble, cubeType, scrambleSubset, solvesFilter } = context;
    const visualCubeType = (cubeType === 'wca' && scrambleSubset) ? scrambleSubset : cubeType;

    let content: ReactNode = null;
    switch (moduleType) {
        case TimerModuleType.HISTORY:
            content = <History filterOptions={solvesFilter} hotKeysEnabled />;
            break;
        case TimerModuleType.SCRAMBLE:
            content = <Scramble cubeType={visualCubeType} scramble={originalScramble || scramble} />;
            break;
        case TimerModuleType.SOLVE_GRAPH:
            content = <TimeChart filterOptions={solvesFilter} />;
            break;
        case TimerModuleType.TIME_DISTRO:
            content = <TimeDistro filterOptions={solvesFilter} />;
            break;
        case TimerModuleType.CROSS_SOLVER:
            content = <CrossSolverModule />;
            break;
        case TimerModuleType.PHASE_ANALYSIS:
            content = <PhaseAnalysis filterOptions={solvesFilter} />;
            break;
    }

    return (
        <div className={b({ scramble: moduleType === TimerModuleType.SCRAMBLE })}>
            {content}
        </div>
    );
}
