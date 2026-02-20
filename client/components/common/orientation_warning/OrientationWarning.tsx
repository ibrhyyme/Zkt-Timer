import React from 'react';
import {useTranslation} from 'react-i18next';
import { DeviceMobile } from 'phosphor-react';
import './OrientationWarning.scss';
import block from '../../../styles/bem';
import { useGeneral } from '../../../util/hooks/useGeneral';

const b = block('orientation-warning');

export default function OrientationWarning() {
    const {t} = useTranslation();
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
                {t('orientation_warning.title')}
            </h2>
            <p className={b('text')}>
                {t('orientation_warning.text')}
            </p>
        </div>
    );
}
