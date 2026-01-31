import React, { useEffect, useState } from 'react';
import { toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import screenfull from '../../../util/vendor/screenfull';

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

export default function ExtrasTab() {
	const focusMode = useSettings('focus_mode');
	const inspection = useSettings('inspection');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');

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
		</div>
	);
}
