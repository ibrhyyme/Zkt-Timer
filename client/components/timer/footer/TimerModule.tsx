import React, { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown } from 'phosphor-react';
import { TimerModuleDropdownOptions, TimerModuleType } from '../@types/enums';
import { TimerCustomModuleOptions } from '../@types/interfaces';
import { snakeCase } from 'change-case';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { TimerContext } from '../Timer';
import ModuleBody from '../module_registry';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';

interface Props {
	index: number;
	moduleType?: TimerModuleType;
	customOptions?: TimerCustomModuleOptions;
}

export default function TimerModule(props: Props) {
	const { index, moduleType, customOptions } = props;

	const { t } = useTranslation();
	const context = useContext(TimerContext);
	// Only the clock special case below needs anything from the context now; the module
	// bodies read what they need themselves (see module_registry).
	const { cubeType } = context;

	const timerModules = useSettings('timer_modules');

	if (typeof moduleType !== 'string' && !customOptions) {
		return <div className="">{moduleType}</div>;
	}

	function selectVisual(newModuleType: TimerModuleType) {
		const newTimerModules = [...timerModules];
		if (newTimerModules.length <= index) {
			newTimerModules.push(newModuleType);
		} else {
			newTimerModules[index] = newModuleType;
		}
		setSetting('timer_modules', newTimerModules);
	}

	const moduleDropdownOptions: TimerModuleDropdownOptions[] = customOptions?.dropdownOptions || [
		{ label: t('timer_modules.history'), value: TimerModuleType.HISTORY },
		{ label: t('timer_modules.cross_solver'), value: TimerModuleType.CROSS_SOLVER },
		{ label: t('timer_modules.stats'), value: TimerModuleType.STATS },
		{ label: t('timer_modules.last_solve'), value: TimerModuleType.LAST_SOLVE },
		{ label: t('timer_modules.scramble'), value: TimerModuleType.SCRAMBLE },
		{ label: t('timer_modules.consistency'), value: TimerModuleType.CONSISTENCY },
		{ label: t('timer_modules.solve_graph'), value: TimerModuleType.SOLVE_GRAPH },
		{ label: t('timer_modules.time_distro'), value: TimerModuleType.TIME_DISTRO },
		{ label: t('timer_modules.phase_analysis'), value: TimerModuleType.PHASE_ANALYSIS },
		{ label: t('timer_modules.none'), value: TimerModuleType.NONE },
	];

	const currentModuleName = moduleDropdownOptions.find((option) => option.value === moduleType)?.label;

	// What this module draws. Custom bodies (rooms, battle) win, then any extra type the
	// caller registered, then the shared module registry that the desktop tiles use too.
	let visual: ReactNode;
	if (customOptions?.customBody) {
		visual = customOptions.customBody(context)?.module;
	} else {
		const visualType = (customOptions?.moduleType || snakeCase(moduleType)) as TimerModuleType;
		const additional = customOptions?.additionalDropdownTypes?.[visualType];
		visual = additional ? additional.module : <ModuleBody moduleType={visualType} />;
	}

	let dropdown: ReactNode = (
		<div className="absolute inset-0 z-40 flex items-start justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
			<div className="pointer-events-auto">
				<Dropdown
					openLeft
					noMargin
					dropdownButtonProps={{
						primary: true,
						glow: true,
					}}
					dropdownMaxHeight={200}
					icon={<CaretDown />}
					text={currentModuleName}
					options={moduleDropdownOptions.map((option) => ({
						text: option.label,
						onClick: () => selectVisual(option.value),
					}))}
				/>
			</div>
		</div>
	);

	if (customOptions?.hideAllOptions) {
		dropdown = null;
	}

	// Every module looks the same. This used to box only the odd-indexed ones
	// (`index % 2 !== 0`), so neighbouring modules of the same kind rendered
	// differently for no reason other than their position. Separation now comes from
	// a hairline between modules, defined in TimerFooter.scss so it can follow the
	// layout direction.
	const wrapperClass = ['group', 'h-full', 'w-full', 'p-3', 'overflow-hidden', 'relative'];
	// Clock küpü için özel class
	if (moduleType === TimerModuleType.SCRAMBLE && cubeType === 'clock') {
		wrapperClass.push('clock-scramble');
	}

	return (
		<div className={wrapperClass.join(' ')}>
			{dropdown}
			<div className="h-full w-full overflow-hidden">
				{visual}
			</div>
		</div>
	);
}
