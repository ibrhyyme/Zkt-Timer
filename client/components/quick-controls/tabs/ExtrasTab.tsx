import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import screenfull from '../../../util/vendor/screenfull';
import { CaretDown, CaretUp, Minus, Plus } from 'phosphor-react';

interface ExtrasNumberInputProps {
	label: string;
	value: number;
	step: number;
	min: number;
	hidden?: boolean;
	onChange: (val: number) => void;
}

function ExtrasNumberInput({ label, value, step, min, hidden, onChange }: ExtrasNumberInputProps) {
	if (hidden) return null;

	const decrement = () => {
		const next = Math.round((value - step) * 100) / 100;
		if (next >= min) onChange(next);
	};

	const increment = () => {
		onChange(Math.round((value + step) * 100) / 100);
	};

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-text/[0.15] transition-all duration-200">
			<span className="font-medium text-text/80 group-hover:text-text transition-colors">
				{label}
			</span>
			<div className="flex items-center space-x-2">
				<button
					type="button"
					onClick={decrement}
					disabled={value <= min}
					className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 border ${value <= min
						? 'bg-button border-text/[0.05] text-text/30 cursor-not-allowed'
						: 'bg-button border-text/[0.1] text-text/70 hover:bg-button hover:text-text hover:border-text/[0.15] cursor-pointer'
					}`}
				>
					<Minus weight="bold" size={12} />
				</button>
				<span className="text-sm font-medium text-primary min-w-[40px] text-center tabular-nums">
					{value.toFixed(1)}
				</span>
				<button
					type="button"
					onClick={increment}
					className="h-7 w-7 rounded-lg flex items-center justify-center bg-button border border-text/[0.1] text-text/70 hover:bg-button hover:text-text hover:border-text/[0.15] transition-all duration-200 cursor-pointer"
				>
					<Plus weight="bold" size={12} />
				</button>
			</div>
		</div>
	);
}

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
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-text/[0.15] transition-all duration-200">
			<span className={`font-medium transition-colors ${disabled ? 'text-text/30' : 'text-text/80 group-hover:text-text'}`}>
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
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] transition-all duration-200 hover:border-text/[0.15]">
			<span className="font-medium text-text/80 group-hover:text-text transition-colors">
				{label}
			</span>
			<div className="relative" ref={containerRef}>
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 min-w-[120px] justify-between border ${isOpen
							? 'bg-button border-primary/50 text-text'
							: 'bg-button border-text/[0.1] text-text/70 hover:bg-button hover:text-text hover:border-text/[0.15]'
						}`}
				>
					<span>{selectedLabel}</span>
					{isOpen ? <CaretUp weight="bold" className="text-primary" /> : <CaretDown weight="bold" className="text-text/50 group-hover:text-text/80" />}
				</button>

				{isOpen && (
					<div className="absolute right-0 mt-2 w-48 rounded-xl bg-module border border-text/[0.1] shadow-xl shadow-black/40 z-50 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-right">
						<div className="py-1">
							{options.map((option) => (
								<button
									key={option.value}
									className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group/item ${option.value === value
											? 'bg-primary/10 text-primary font-medium'
											: 'text-text/70 hover:bg-text/[0.05] hover:text-text'
										}`}
									onClick={() => {
										onChange(option.value);
										setIsOpen(false);
									}}
								>
									<span>{option.label}</span>
									{option.value === value && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary-color),0.5)]"></div>}
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
	const freezeTime = useSettings('freeze_time');
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
			<div className="flex items-center space-x-1.5 mb-1">
				<div className="h-1.5 w-1.5 bg-primary rounded-full"></div>
				<p className="text-text/50 text-xs font-medium">
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

			<ExtrasNumberInput
				label={t('quick_controls.freeze_time')}
				value={freezeTime ?? 0.2}
				step={0.1}
				min={0}
				onChange={(val) => setSetting('freeze_time', val)}
			/>

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
