import React from 'react';
import { DeviceMobile } from 'phosphor-react';
import './OrientationWarning.scss';
import block from '../../../styles/bem';
import { useGeneral } from '../../../util/hooks/useGeneral';

const b = block('orientation-warning');

export default function OrientationWarning() {
    const mobileMode = useGeneral('mobile_mode');

    if (!mobileMode) {
        return null;
    }

    return (
        <div className={b()}>
            <div className={b('icon')}>
                <DeviceMobile weight="bold" />
            </div>
            <h2 className={b('title')}>
                Lütfen Cihazınızı Döndürün
            </h2>
            <p className={b('text')}>
                ZKT-Timer en iyi deneyim için mobil cihazlarda dikey (portrait) modda kullanılmak üzere tasarlanmıştır.
            </p>
        </div>
    );
}
