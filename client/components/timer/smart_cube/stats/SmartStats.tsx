import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { TimerContext } from '../../Timer';
import block from '../../../../styles/bem';
import './SmartStats.scss';

const b = block('smart-stats');

interface Props {
    mobile?: boolean;
    stats?: {
        turns: number;
        tps: number | string;
    };
}

function SmartStats({ mobile, stats: propStats }: Props) {
    const { t } = useTranslation();
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
                <span>{turns}</span> <span className='text-blue-400'>{t('smart_cube.turns_label')}</span>
            </h4>
            <h4 className={b('text')}>
                <span>{tps}</span> <span className='text-blue-400'>{t('smart_cube.tps_label')}</span>
            </h4>
        </div>
    );
}

export default React.memo(SmartStats);
