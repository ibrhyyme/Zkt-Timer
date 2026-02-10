import React, { useContext, useEffect, useState } from 'react';
import { TimerContext } from '../../Timer';
import block from '../../../../styles/bem';
import './SmartStats.scss';

const b = block('smart-stats');

interface Props {
    time?: number; // Optional time override from parent
    mobile?: boolean;
    stats?: {
        turns: number;
        tps: number | string;
    };
}

function SmartStats({ time: propTime, mobile, stats: propStats }: Props) {
    const context = useContext(TimerContext);

    // Use prop stats if available, otherwise try context
    const stats = propStats || context.lastSmartSolveStats;

    if (!stats) {
        return null;
    }

    const { turns, tps } = stats;

    return (
        <div className={b({ mobile })}>
            <h4 className={b('text')}>
                <span>{turns}</span> <span className='text-blue-400'>turns</span>
            </h4>
            <h4 className={b('text')}>
                <span>{tps}</span> <span className='text-blue-400'>tps</span>
            </h4>
        </div>
    );
}

export default React.memo(SmartStats);
