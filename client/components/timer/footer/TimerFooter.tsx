import React, { useContext, useEffect } from 'react';
import { CaretUp, CaretDown } from 'phosphor-react';
import { setSetting } from '../../../db/settings/update';
import { TimerContext } from '../Timer';
import './TimerFooter.scss';
import block from '../../../styles/bem';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import Button from '../../common/button/Button';
import TimerModule from './TimerModule';
import { TimerModuleType } from '../@types/enums';

const b = block('timer-footer');

export default function TimerFooter() {
	const context = useContext(TimerContext);
	const { timerLayout, cubeType, scramble } = context;

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
		// Mobil için özel 3 bölümlü layout
		// Sol: Çözümler (History)
		modules.push(
			<div key="mobile-history" className="cd-timer-footer__mobile-history">
				<TimerModule
					index={0}
					moduleType={TimerModuleType.HISTORY}
					customOptions={{
						hideAllOptions: true,
						moduleType: TimerModuleType.HISTORY
					}}
				/>
			</div>
		);
		// Sağ üst: İstatistikler (4 blok)
		modules.push(
			<div key="mobile-stats" className="cd-timer-footer__mobile-stats">
				<TimerModule
					index={1}
					moduleType={TimerModuleType.STATS}
					customOptions={{
						hideAllOptions: true,
						moduleType: TimerModuleType.STATS
					}}
				/>
			</div>
		);
		// Sağ alt: Scramble görseli
		modules.push(
			<div key="mobile-scramble" className="cd-timer-footer__mobile-scramble">
				<TimerModule
					index={2}
					moduleType={TimerModuleType.SCRAMBLE}
					customOptions={{
						hideAllOptions: true,
						moduleType: TimerModuleType.SCRAMBLE
					}}
				/>
			</div>
		);
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

	// Footer always visible in mobile mode
	const body = <div className={b('body', { mobile: mobileMode, layout: timerLayout })}>{modules}</div>;


	return (
		<div className={b({ layout: timerLayout })}>
			{body}
		</div>
	);
}
