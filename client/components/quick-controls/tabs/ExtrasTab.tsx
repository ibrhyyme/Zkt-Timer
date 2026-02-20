import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import screenfull from '../../../util/vendor/screenfull';
import { CaretDown, CaretUp } from 'phosphor-react';

interface ExtrasOptionProps {
	label: string;
	isActive: boolean;
	disabled?: boolean;
	hidden?: boolean;
	onClick: () => void;
}

function ExtrasOption({ label, isActive, disabled = false, hidden = false, onClick }: ExtrasOptionProps) {
	if (hidden) {
		return null;
	}

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<span className={`font-medium transition-colors ${disabled ? 'text-[#555]' : 'text-slate-200 group-hover:text-white'}`}>
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

interface ExtrasSelectProps {
	label: string;
	value: string;
	options: { label: string; value: string }[];
	hidden?: boolean;
	onChange: (val: string) => void;
}

function ExtrasSelect({ label, value, options, hidden, onChange }: ExtrasSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	if (hidden) return null;

	const selectedLabel = options.find(o => o.value === value)?.label || value;

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] transition-all duration-200 hover:border-white/[0.15]">
			<span className="font-medium text-slate-200 group-hover:text-white transition-colors">
				{label}
			</span>
			<div className="relative" ref={containerRef}>
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 min-w-[120px] justify-between border ${isOpen
							? 'bg-[#2a2a2e] border-[#4a9eff]/50 text-white'
							: 'bg-[#2a2a2e] border-white/[0.1] text-slate-300 hover:bg-[#3a3a3e] hover:text-white hover:border-white/[0.15]'
						}`}
				>
					<span>{selectedLabel}</span>
					{isOpen ? <CaretUp weight="bold" className="text-[#4a9eff]" /> : <CaretDown weight="bold" className="text-[#888] group-hover:text-slate-200" />}
				</button>

				{isOpen && (
					<div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1c1c1e] border border-white/[0.1] shadow-xl shadow-black/40 z-50 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-right">
						<div className="py-1">
							{options.map((option) => (
								<button
									key={option.value}
									className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group/item ${option.value === value
											? 'bg-[#4a9eff]/10 text-[#4a9eff] font-medium'
											: 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
										}`}
									onClick={() => {
										onChange(option.value);
										setIsOpen(false);
									}}
								>
									<span>{option.label}</span>
									{option.value === value && <div className="w-1.5 h-1.5 rounded-full bg-[#4a9eff] shadow-[0_0_8px_rgba(74,158,255,0.5)]"></div>}
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default function ExtrasTab() {
	const { t } = useTranslation();
	const focusMode = useSettings('focus_mode');
	const inspection = useSettings('inspection');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');
	const timerType = useSettings('timer_type');
	const analysisMode = useSettings('smart_cube_analysis_mode');

	const [fullScreenMode, setFullScreenMode] = useState(false);

	// Track fullscreen state
	if (screenfull.isEnabled) {
		useEffect(() => {
			const updateFullScreenState = () => setFullScreenMode(screenfull.isFullscreen);
			updateFullScreenState();
			screenfull.on('change', updateFullScreenState);
			return () => screenfull.off('change', updateFullScreenState);
		}, []);
	}

	const extrasOptions = [
		{
			label: t('quick_controls.full_screen'),
			isActive: fullScreenMode,
			hidden: !screenfull.isEnabled,
			onClick: () => screenfull.toggle(),
		},
		{
			label: t('quick_controls.focus_mode'),
			isActive: focusMode,
			hidden: false,
			onClick: () => toggleSetting('focus_mode'),
		},
		{
			label: t('quick_controls.inspection'),
			isActive: inspection,
			hidden: false,
			onClick: () => toggleSetting('inspection'),
		},
		{
			label: t('quick_controls.hide_time_when_solving'),
			isActive: hideTimeWhenSolving,
			hidden: false,
			onClick: () => toggleSetting('hide_time_when_solving'),
		},
	];

	const analysisOptions = [
		{ label: t('quick_controls.none'), value: 'none' },
		{ label: 'CFOP', value: 'cfop' },
		{ label: 'CF+OP', value: 'cf_plus_op' }, // Multi-phase (4 steps: Cross, F2L, OLL, PLL)
		{ label: 'CFFFFOP', value: 'cffffop' }, // F2L Split (Cross, F2L1, F2L2, F2L3, F2L4, OLL, PLL)
		{ label: 'CFFFFOOPP', value: 'cffffoopp' }, // Detailed (Cross, F2L1...4, 2-look OLL/PLL?) - User requested name.
	];

	return (
		<div className="space-y-3">
			<div className="flex items-center space-x-2 mb-6">
				<div className="h-2 w-2 bg-[#4a9eff] rounded-full"></div>
				<p className="text-[#888] text-sm font-medium">
					{t('quick_controls.extras_description')}
				</p>
			</div>
			{extrasOptions.map((option) => (
				<ExtrasOption
					key={option.label}
					label={option.label}
					isActive={option.isActive}
					hidden={option.hidden}
					onClick={option.onClick}
				/>
			))}

			<ExtrasSelect
				label={t('quick_controls.multi_phase')}
				value={analysisMode || 'none'}
				options={analysisOptions}
				hidden={timerType !== 'smart'} // Only show if Smart Cube is selected
				onChange={(val) => setSetting('smart_cube_analysis_mode', val)}
			/>
		</div>
	);
}
