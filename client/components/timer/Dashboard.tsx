import React, { useContext } from 'react';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useSettings } from '../../util/hooks/useSettings';
import { TimerModuleType } from './@types/enums';
import MobileModuleSlot from './MobileModuleSlot';
import block from '../../styles/bem';
import './Dashboard.scss';

const b = block('timer-dashboard');

export default function Dashboard() {
    const context = useContext(TimerContext);
    const mobileMode = useGeneral('mobile_mode');
    const mobileModules = useSettings('mobile_timer_modules');

    const slot0 = mobileModules[0] || TimerModuleType.HISTORY;
    const slot1 = mobileModules[1] || TimerModuleType.SCRAMBLE;

    return (
        <div className={b({ mobile: mobileMode })}>
            <MobileModuleSlot moduleType={slot0} />
            <MobileModuleSlot moduleType={slot1} />
        </div>
    );
}
