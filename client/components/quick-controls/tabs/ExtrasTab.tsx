import React, { useEffect, useState } from 'react';
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
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-gradient-to-r from-slate-800/30 to-slate-700/30 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-black/10">
			<span className={`font-medium transition-colors ${disabled ? 'text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>
				{label}
			</span>
			<button
				type="button"
				disabled={disabled}
				className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 ${isActive
					? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 shadow-lg shadow-emerald-500/30'
					: 'bg-slate-700 border-slate-600 hover:bg-slate-600'
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
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-gradient-to-r from-slate-800/30 to-slate-700/30 border border-slate-700/50 transition-all duration-200 hover:border-slate-600/50 hover:shadow-lg hover:shadow-black/10">
			<span className="font-medium text-slate-200 group-hover:text-white transition-colors">
				{label}
			</span>
			<div className="relative" ref={containerRef}>
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 min-w-[120px] justify-between border ${isOpen
							? 'bg-slate-700 border-emerald-500/50 text-white shadow-[0_0_10px_rgba(16,185,129,0.1)]'
							: 'bg-slate-800/50 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500'
						}`}
				>
					<span>{selectedLabel}</span>
					{isOpen ? <CaretUp weight="bold" className="text-emerald-400" /> : <CaretDown weight="bold" className="text-slate-400 group-hover:text-slate-200" />}
				</button>

				{isOpen && (
					<div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1e293b] border border-slate-600/50 shadow-xl shadow-black/40 z-50 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-right">
						<div className="py-1">
							{options.map((option) => (
								<button
									key={option.value}
									className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group/item ${option.value === value
											? 'bg-emerald-500/10 text-emerald-400 font-medium'
											: 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
										}`}
									onClick={() => {
										onChange(option.value);
										setIsOpen(false);
									}}
								>
									<span>{option.label}</span>
									{option.value === value && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>}
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
			label: 'Full Screen',
			isActive: fullScreenMode,
			hidden: !screenfull.isEnabled,
			onClick: () => screenfull.toggle(),
		},
		{
			label: 'Odak Modu',
			isActive: focusMode,
			hidden: false,
			onClick: () => toggleSetting('focus_mode'),
		},
		{
			label: 'İnceleme',
			isActive: inspection,
			hidden: false,
			onClick: () => toggleSetting('inspection'),
		},
		{
			label: 'Çözerken Süreyi Gizle',
			isActive: hideTimeWhenSolving,
			hidden: false,
			onClick: () => toggleSetting('hide_time_when_solving'),
		},
	];

	const analysisOptions = [
		{ label: 'Yok', value: 'none' },
		{ label: 'CFOP', value: 'cfop' },
		{ label: 'CF+OP', value: 'cf_plus_op' }, // Multi-phase (4 steps: Cross, F2L, OLL, PLL)
		{ label: 'CFFFFOP', value: 'cffffop' }, // F2L Split (Cross, F2L1, F2L2, F2L3, F2L4, OLL, PLL)
		{ label: 'CFFFFOOPP', value: 'cffffoopp' }, // Detailed (Cross, F2L1...4, 2-look OLL/PLL?) - User requested name.
	];

	return (
		<div className="space-y-3">
			<div className="flex items-center space-x-2 mb-6">
				<div className="h-2 w-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></div>
				<p className="text-slate-300 text-sm font-medium">
					Ek özellikleri aç/kapat (birden fazla seçilebilir)
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
				label="Multi-Evre"
				value={analysisMode || 'none'}
				options={analysisOptions}
				hidden={timerType !== 'smart'} // Only show if Smart Cube is selected
				onChange={(val) => setSetting('smart_cube_analysis_mode', val)}
			/>
		</div>
	);
}
