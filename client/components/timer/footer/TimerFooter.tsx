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
	const { timerLayout, cubeType, scramble, matchMode } = context;

	// Fetch modules from settings or set defaults (if not set)
	const mobileMode = useGeneral('mobile_mode');
	const hideMobileTimerFooter = useSettings('hide_mobile_timer_footer');

	const customModules = context.timerCustomFooterModules;
	const timerModules = useSettings('timer_modules');
	const timerModuleCount = useSettings('timer_module_count');

	// Ensure mobile footer is hidden by default
	useEffect(() => {
		if (mobileMode && hideMobileTimerFooter === undefined) {
			setSetting('hide_mobile_timer_footer', true);
		}
	}, [mobileMode, hideMobileTimerFooter]);

	// Mobile hide button removed from here - moved to Timer component

	const modules = [];
	if (mobileMode) {
		// Custom modules (Match etc.) for mobile

		if (customModules && customModules.length) {

			// In match mode, special layout: show only first module (Round List) fullscreen
			if (matchMode && customModules.length > 0) {
				const mod = customModules[0];
				modules.push(
					<div key="mobile-match-history" className="cd-timer-footer__mobile-match-history">
						<TimerModule index={0} customOptions={mod} />
					</div>
				);
			} else {
				// Normal, non-match custom modules layout (old logic)
				customModules.forEach((mod, i) => {
					let className = '';
					let style = {};

					// Map modules to grid
					// Index 0: History -> Left Column
					// Index 1: Points/Stats -> Right Column (Full Height now)
					// Index 2: Chat/Scramble -> HIDDEN on mobile as per request
					if (i === 0) {
						className = 'cd-timer-footer__mobile-history';
					} else if (i === 1) {
						className = 'cd-timer-footer__mobile-stats';
						style = { gridRow: '1 / 3' }; // Make it take full height of the right column
					} else {
						return; // Skip other modules (Chat/Scramble)
					}

					modules.push(
						<div key={`mobile-custom-${i}`} className={className} style={style}>
							<TimerModule index={i} customOptions={mod} />
						</div>
					);
				});
			}
		} else {
			// Special 3-section layout for mobile (Default)
			// Left: Solutions (History)
			modules.push(
				<div key="mobile-history" className="cd-timer-footer__mobile-history">
					<TimerModule
						index={0}
						moduleType={TimerModuleType.HISTORY}
						customOptions={{
							hideAllOptions: true,
							moduleType: TimerModuleType.HISTORY,
						}}
					/>
				</div>
			);
			// Right top: Statistics (4 blocks)
			modules.push(
				<div key="mobile-stats" className="cd-timer-footer__mobile-stats">
					<TimerModule
						index={1}
						moduleType={TimerModuleType.STATS}
						customOptions={{
							hideAllOptions: true,
							moduleType: TimerModuleType.STATS,
						}}
					/>
				</div>
			);
			// Right bottom: Scramble visual
			modules.push(
				<div key="mobile-scramble" className="cd-timer-footer__mobile-scramble">
					<TimerModule
						index={2}
						moduleType={TimerModuleType.SCRAMBLE}
						customOptions={{
							hideAllOptions: true,
							moduleType: TimerModuleType.SCRAMBLE,
						}}
					/>
				</div>
			);
		}
	} else {
		// Show normal modules on desktop version
		// In right/left layout, vertical space is limited → max 2 modules
		const isVerticalLayout = timerLayout === 'right' || timerLayout === 'left';
		const moduleLimit = isVerticalLayout ? 2 : timerModuleCount;

		if (customModules && customModules?.length) {
			const limit = isVerticalLayout ? Math.min(customModules.length, 2) : customModules.length;
			for (let i = 0; i < limit; i++) {
				const customModule = customModules[i];
				const moduleType = customModule.moduleType;

				modules.push(<TimerModule key={`${i}-${moduleType}`} index={i} customOptions={customModule} />);
			}
		} else {
			for (let i = 0; i < moduleLimit; i++) {
				const moduleType = timerModules[i % timerModules.length];
				modules.push(<TimerModule key={`${i}-${moduleType}`} index={i} moduleType={moduleType} />);
			}
		}
	}

	// Footer always visible in mobile mode
	const body = <div className={b('body', { mobile: mobileMode, layout: timerLayout, match: matchMode })}>{modules}</div>;


	return (
		<div className={b({ layout: timerLayout, match: matchMode })}>
			{body}
		</div>
	);
}
