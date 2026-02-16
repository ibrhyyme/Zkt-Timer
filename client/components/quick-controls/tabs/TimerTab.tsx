import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { openModal } from '../../../actions/general';
import StackMatPicker from '../../settings/stackmat_picker/StackMatPicker';
import { AllSettings } from '../../../db/settings/query';

interface TimerOptionProps {
	label: string;
	isActive: boolean;
	disabled?: boolean;
	onClick: () => void;
}

function TimerOption({ label, isActive, disabled = false, onClick }: TimerOptionProps) {
	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<span className={`font-medium transition-colors ${disabled ? 'text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>
				{label}
			</span>
			<button
				type="button"
				disabled={disabled}
				className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 ${isActive
					? 'bg-[#4a9eff] border-[#4a9eff] shadow-lg shadow-[#4a9eff]/30'
					: 'bg-[#2a2a2e] border-white/[0.1] hover:bg-[#3a3a3e]'
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

export default function TimerTab() {
	const dispatch = useDispatch();

	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const cubeType = useSettings('cube_type');

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
		dispatch(openModal(<StackMatPicker />));
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
			label: 'Klavye',
			isActive: timerType === 'keyboard' && !manualEntry,
			onClick: () => selectTimerType('keyboard'),
		},
		{
			label: 'StackMat',
			isActive: timerType === 'stackmat' && !manualEntry,
			onClick: openStackMat,
		},
		{
			label: 'Akıllı Küp',
			isActive: timerType === 'smart' && !manualEntry,
			disabled: cubeType !== '333',
			onClick: () => selectTimerType('smart'),
		},
		{
			label: 'GAN Akıllı Timer',
			isActive: timerType === 'gantimer' && !manualEntry,
			onClick: () => selectTimerType('gantimer'),
		},
		{
			label: 'Manuel Giriş',
			isActive: manualEntry,
			disabled: manualDisabled,
			onClick: toggleManualEntry,
		},
	];

	return (
		<div className="space-y-3">
			<div className="flex items-center space-x-2 mb-6">
				<div className="h-2 w-2 bg-[#4a9eff] rounded-full"></div>
				<p className="text-[#888] text-sm font-medium">
					Timer türünü seçin (sadece bir tane aktif olabilir)
				</p>
			</div>
			{timerOptions.map((option) => (
				<TimerOption
					key={option.label}
					label={option.label}
					isActive={option.isActive}
					disabled={option.disabled}
					onClick={option.onClick}
				/>
			))}
		</div>
	);
}
