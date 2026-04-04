import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Lock } from 'phosphor-react';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { openModal } from '../../../actions/general';
import StackMatPicker from '../../settings/stackmat_picker/StackMatPicker';
import { AllSettings } from '../../../db/settings/query';

interface TimerOptionProps {
	label: string | React.ReactNode;
	isActive: boolean;
	disabled?: boolean;
	onClick: () => void;
}

function TimerOption({ label, isActive, disabled = false, onClick }: TimerOptionProps) {
	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-text/[0.15] transition-all duration-200">
			<span className={`font-medium transition-colors ${disabled ? 'text-text/40' : 'text-text/80 group-hover:text-text'}`}>
				{label}
			</span>
			<button
				type="button"
				disabled={disabled}
				className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 ${isActive
					? 'bg-primary border-primary shadow-lg shadow-primary/30'
					: 'bg-button border-text/[0.1] hover:bg-button'
					} ${disabled ? 'opacity-30 cursor-not-allowed transform-none' : 'cursor-pointer'}`}
				onClick={onClick}
			>
				<div
					className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ${isActive ? 'translate-x-5 shadow-white/20' : 'translate-x-0.5'
						}`}
				/>
			</button>
		</div>
	);
}

interface TimerTabProps {
	allowedTimerTypes?: string[];
}

export default function TimerTab({ allowedTimerTypes }: TimerTabProps) {
	const { t } = useTranslation();
	const dispatch = useDispatch();

	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const cubeType = useSettings('cube_type');
	const mobileMode = useGeneral('mobile_mode');

	// Küp türü değiştiğinde smart cube uyumluluğunu kontrol et
	useEffect(() => {
		const smartCubeSupportedTypes = ['333', '333oh', '333bl', '333mirror'];

		if (timerType === 'smart' && !smartCubeSupportedTypes.includes(cubeType)) {
			setSetting('timer_type', 'keyboard');
		}
	}, [cubeType, timerType]);

	let manualDisabled = false;
	// Smart cube selection disables manual entry only for 3x3
	// if (timerType === 'smart' && cubeType === '333') {
	// 	manualDisabled = true;
	// }

	function selectTimerType(newTimerType: AllSettings['timer_type']) {
		// Turn off all timer types first, then turn on the selected one
		setSetting('manual_entry', false);
		setSetting('timer_type', newTimerType);
	}

	function openStackMat() {
		dispatch(openModal(<StackMatPicker />, { width: 400, compact: true, title: t('stackmat.select_input'), description: t('stackmat.description'), closeButtonText: t('solve_info.done') }));
	}

	function toggleManualEntry() {
		// If manual entry is being turned on, turn off timer type
		if (!manualEntry) {
			setSetting('timer_type', 'keyboard');
		}
		toggleSetting('manual_entry');
	}

	const timerOptions = [
		{
			typeKey: 'keyboard',
			label: mobileMode ? t('quick_controls.touch') : t('quick_controls.keyboard'),
			isActive: timerType === 'keyboard' && !manualEntry,
			onClick: () => selectTimerType('keyboard'),
		},
		{
			typeKey: 'stackmat',
			label: t('quick_controls.stackmat'),
			isActive: timerType === 'stackmat' && !manualEntry,
			onClick: openStackMat,
		},
		{
			typeKey: 'smart',
			label: t('quick_controls.smart_cube'),
			isActive: timerType === 'smart' && !manualEntry,
			disabled: cubeType !== '333',
			onClick: () => selectTimerType('smart'),
		},
		{
			typeKey: 'gantimer',
			label: t('quick_controls.gan_smart_timer'),
			isActive: timerType === 'gantimer' && !manualEntry,
			onClick: () => selectTimerType('gantimer'),
		},
		{
			typeKey: 'manual',
			label: t('quick_controls.manual_entry'),
			isActive: manualEntry,
			disabled: manualDisabled,
			onClick: toggleManualEntry,
		},
	];

	// Room kisitlamasi: allowedTimerTypes verilmisse, izin verilmeyen turleri disable et
	const finalOptions = timerOptions.map((option) => {
		if (!allowedTimerTypes || allowedTimerTypes.includes(option.typeKey)) {
			return option;
		}
		return {
			...option,
			disabled: true,
			label: (
				<span className="flex items-center gap-2">
					{option.label}
					<span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded flex items-center gap-1">
						<Lock size={10} weight="fill" />
						{t('room_settings.not_allowed')}
					</span>
				</span>
			),
		};
	});

	return (
		<div className="space-y-3">
			<div className="flex items-center space-x-1.5 mb-1">
				<div className="h-1.5 w-1.5 bg-primary rounded-full"></div>
				<p className="text-text/50 text-xs font-medium">
					{t('quick_controls.timer_type_description')}
				</p>
			</div>
			{finalOptions.map((option) => (
				<TimerOption
					key={option.typeKey}
					label={option.label}
					isActive={option.isActive}
					disabled={option.disabled}
					onClick={option.onClick}
				/>
			))}
		</div>
	);
}
