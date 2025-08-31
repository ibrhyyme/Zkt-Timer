import React, {useContext, useEffect} from 'react';
import {CaretUp, CaretDown} from 'phosphor-react';
import {setSetting} from '../../../db/settings/update';
import {TimerContext} from '../Timer';
import './TimerFooter.scss';
import block from '../../../styles/bem';
import {useSettings} from '../../../util/hooks/useSettings';
import {useGeneral} from '../../../util/hooks/useGeneral';
import Button from '../../common/button/Button';
import TimerModule from './TimerModule';
import {TimerModuleType} from '../@types/enums';

const b = block('timer-footer');

export default function TimerFooter() {
	const context = useContext(TimerContext);
	const {timerLayout} = context;

	// Fetch modules from settings or set defaults (if not set)
	const mobileMode = useGeneral('mobile_mode');
	const hideMobileTimerFooter = useSettings('hide_mobile_timer_footer');

	const customModules = context.timerCustomFooterModules;
	const timerModules = useSettings('timer_modules');
	const timerModuleCount = useSettings('timer_module_count');

	// Mobil footer'ın varsayılan olarak gizli olmasını sağla
	useEffect(() => {
		if (mobileMode && hideMobileTimerFooter === undefined) {
			setSetting('hide_mobile_timer_footer', true);
		}
	}, [mobileMode, hideMobileTimerFooter]);

	// Mobile hide button removed from here - moved to Timer component

	const modules = [];
	if (mobileMode) {
		// Mobil versiyonda sadece History modülünü göster
		modules.push(<TimerModule key="mobile-history" index={0} moduleType={TimerModuleType.HISTORY} />);
	} else {
		// Desktop versiyonda normal modülleri göster
		if (customModules && customModules?.length) {
			for (let i = 0; i < customModules.length; i++) {
				const customModule = customModules[i];
				const moduleType = customModule.moduleType;

				modules.push(<TimerModule key={`${i}-${moduleType}`} index={i} customOptions={customModule} />);
			}
		} else {
			for (let i = 0; i < timerModuleCount; i++) {
				const moduleType = timerModules[i % timerModules.length];
				modules.push(<TimerModule key={`${i}-${moduleType}`} index={i} moduleType={moduleType} />);
			}
		}
	}

	let body = <div className={b('body', {mobile: mobileMode, layout: timerLayout})}>{modules}</div>;
	if (mobileMode && hideMobileTimerFooter) {
		body = null;
	}

	return (
		<div className={b({layout: timerLayout})}>
			{body}
		</div>
	);
}
