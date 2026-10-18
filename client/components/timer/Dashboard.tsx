import React, { useMemo } from 'react';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useSettings } from '../../util/hooks/useSettings';
import { setSetting } from '../../db/settings/update';
import { TimerModuleType } from './@types/enums';
import { sanitizeMobileModules } from './helpers/module_carousel';
import MobileModuleSlot from './MobileModuleSlot';
import block from '../../styles/bem';
import './Dashboard.scss';

const b = block('timer-dashboard');

/**
 * The phone's two module slots. Each one pages through the mobile modules by a swipe on
 * the module (MobileModuleSlot); this component only owns the pair. The choice is the
 * same `mobile_timer_modules` setting the quick settings selectors used to write, so it
 * keeps syncing through mobile_prefs.
 */
export default function Dashboard() {
    const mobileMode = useGeneral('mobile_mode');
    const stored = useSettings('mobile_timer_modules');

    // Valid and never the same module twice (feedback 1.8-i), whatever is stored.
    const [left, right] = useMemo(() => sanitizeMobileModules(stored), [stored]);

    function change(slot: 0 | 1, next: TimerModuleType) {
        setSetting('mobile_timer_modules', slot === 0 ? [next, right] : [left, next]);
    }

    return (
        <div className={b({ mobile: mobileMode })}>
            <MobileModuleSlot slot={0} moduleType={left} otherModule={right} onChange={(next) => change(0, next)} />
            <MobileModuleSlot slot={1} moduleType={right} otherModule={left} onChange={(next) => change(1, next)} />
        </div>
    );
}
