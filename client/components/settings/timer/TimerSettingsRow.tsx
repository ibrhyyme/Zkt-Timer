import React, { useState } from 'react';
import { CaretDown, CaretUp, Minus, Plus } from 'phosphor-react';

// --- Group ---

interface TimerSettingsGroupProps {
	label: string;
	children: React.ReactNode;
}

export function TimerSettingsGroup({ label, children }: TimerSettingsGroupProps) {
	return (
		<div className="mt-6 first:mt-0">
			<div className="flex items-center space-x-1.5 mb-2">
				<div className="h-1.5 w-1.5 bg-[#4a9eff] rounded-full"></div>
				<span className="text-[#888] text-xs font-medium uppercase tracking-wider">
					{label}
				</span>
			</div>
			<div className="space-y-2">
				{children}
			</div>
		</div>
	);
}

// --- Toggle ---

interface TimerSettingsToggleProps {
	label: string;
	description?: string;
	isActive: boolean;
	disabled?: boolean;
	hidden?: boolean;
	onClick: () => void;
}

export function TimerSettingsToggle({ label, description, isActive, disabled = false, hidden = false, onClick }: TimerSettingsToggleProps) {
	if (hidden) return null;

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className={`font-medium transition-colors ${disabled ? 'text-[#555]' : 'text-slate-200 group-hover:text-white'}`}>
					{label}
				</span>
				{description && (
					<span className="text-xs text-[#666] mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<button
				type="button"
				disabled={disabled}
				className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 shrink-0 ${isActive
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

// --- Number ---

interface TimerSettingsNumberProps {
	label: string;
	description?: string;
	value: number;
	step: number;
	min: number;
	max?: number;
	hidden?: boolean;
	formatValue?: (v: number) => string;
	onChange: (val: number) => void;
}

export function TimerSettingsNumber({ label, description, value, step, min, max, hidden, formatValue, onChange }: TimerSettingsNumberProps) {
	if (hidden) return null;

	const decrement = () => {
		const next = Math.round((value - step) * 100) / 100;
		if (next >= min) onChange(next);
	};

	const increment = () => {
		const next = Math.round((value + step) * 100) / 100;
		if (max !== undefined && next > max) return;
		onChange(next);
	};

	const displayValue = formatValue ? formatValue(value) : (step < 1 ? value.toFixed(1) : String(value));

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium text-slate-200 group-hover:text-white transition-colors">
					{label}
				</span>
				{description && (
					<span className="text-xs text-[#666] mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<div className="flex items-center space-x-2 shrink-0">
				<button
					type="button"
					onClick={decrement}
					disabled={value <= min}
					className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 border ${value <= min
						? 'bg-[#2a2a2e] border-white/[0.05] text-[#555] cursor-not-allowed'
						: 'bg-[#2a2a2e] border-white/[0.1] text-slate-300 hover:bg-[#3a3a3e] hover:text-white hover:border-white/[0.15] cursor-pointer'
						}`}
				>
					<Minus weight="bold" size={12} />
				</button>
				<span className="text-sm font-medium text-[#4a9eff] min-w-[40px] text-center tabular-nums">
					{displayValue}
				</span>
				<button
					type="button"
					onClick={increment}
					disabled={max !== undefined && value >= max}
					className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 border ${max !== undefined && value >= max
						? 'bg-[#2a2a2e] border-white/[0.05] text-[#555] cursor-not-allowed'
						: 'bg-[#2a2a2e] border-white/[0.1] text-slate-300 hover:bg-[#3a3a3e] hover:text-white hover:border-white/[0.15] cursor-pointer'
						}`}
				>
					<Plus weight="bold" size={12} />
				</button>
			</div>
		</div>
	);
}

// --- Select ---

interface TimerSettingsSelectProps {
	label: string;
	description?: string;
	value: string;
	options: { label: string; value: string }[];
	hidden?: boolean;
	onChange: (val: string) => void;
}

export function TimerSettingsSelect({ label, description, value, options, hidden, onChange }: TimerSettingsSelectProps) {
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
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium text-slate-200 group-hover:text-white transition-colors">
					{label}
				</span>
				{description && (
					<span className="text-xs text-[#666] mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<div className="relative shrink-0" ref={containerRef}>
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 min-w-[120px] justify-between border ${isOpen
						? 'bg-[#2a2a2e] border-[#4a9eff]/50 text-white'
						: 'bg-[#2a2a2e] border-white/[0.1] text-slate-300 hover:bg-[#3a3a3e] hover:text-white hover:border-white/[0.15]'
						}`}
				>
					<span>{selectedLabel}</span>
					{isOpen ? <CaretUp weight="bold" className="text-[#4a9eff]" /> : <CaretDown weight="bold" className="text-[#888]" />}
				</button>

				{isOpen && (
					<div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1c1c1e] border border-white/[0.1] shadow-xl shadow-black/40 z-50 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-right">
						<div className="py-1">
							{options.map((option) => (
								<button
									key={option.value}
									className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between ${option.value === value
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

// --- Action ---

interface TimerSettingsActionProps {
	label: string;
	description?: string;
	hidden?: boolean;
	children: React.ReactNode;
}

export function TimerSettingsAction({ label, description, hidden, children }: TimerSettingsActionProps) {
	if (hidden) return null;

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium text-slate-200 group-hover:text-white transition-colors">
					{label}
				</span>
				{description && (
					<span className="text-xs text-[#666] mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<div className="shrink-0">
				{children}
			</div>
		</div>
	);
}

// --- Panel (vertical card: label top, full-width children below) ---

interface TimerSettingsPanelProps {
	label: string;
	description?: string;
	hidden?: boolean;
	onReset?: () => void;
	resetLabel?: string;
	showReset?: boolean;
	children: React.ReactNode;
}

export function TimerSettingsPanel({ label, description, hidden, onReset, resetLabel, showReset, children }: TimerSettingsPanelProps) {
	if (hidden) return null;

	return (
		<div className="py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<div className="flex items-center justify-between mb-3">
				<div className="flex flex-col">
					<span className="font-medium text-slate-200">{label}</span>
					{description && (
						<span className="text-xs text-[#666] mt-0.5 leading-relaxed">{description}</span>
					)}
				</div>
				{showReset && onReset && (
					<button
						type="button"
						onClick={onReset}
						className="text-xs text-orange-400 hover:text-orange-300 transition-colors cursor-pointer shrink-0 ml-4"
					>
						{resetLabel || 'Reset'}
					</button>
				)}
			</div>
			<div>{children}</div>
		</div>
	);
}

// --- Slider ---

interface TimerSettingsSliderProps {
	label: string;
	description?: string;
	value: number;
	min: number;
	max: number;
	hidden?: boolean;
	showReset?: boolean;
	resetLabel?: string;
	onReset?: () => void;
	onChange: (val: number) => void;
	children?: React.ReactNode;
}

export function TimerSettingsSlider({ label, description, value, min, max, hidden, showReset, resetLabel, onReset, onChange, children }: TimerSettingsSliderProps) {
	if (hidden) return null;

	const percentage = ((value - min) / (max - min)) * 100;

	return (
		<div className="py-4 px-4 rounded-xl bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
			<div className="flex items-center justify-between mb-3">
				<div className="flex flex-col">
					<span className="font-medium text-slate-200">{label}</span>
					{description && (
						<span className="text-xs text-[#666] mt-0.5 leading-relaxed">{description}</span>
					)}
				</div>
				<div className="flex items-center space-x-3 shrink-0 ml-4">
					<span className="text-sm font-medium text-[#4a9eff] tabular-nums">{value}px</span>
					{showReset && onReset && (
						<button
							type="button"
							onClick={onReset}
							className="text-xs text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
						>
							{resetLabel || 'Reset'}
						</button>
					)}
				</div>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				value={value}
				onChange={(e) => onChange(parseInt(e.target.value, 10))}
				className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
				style={{
					background: `linear-gradient(to right, #4a9eff 0%, #4a9eff ${percentage}%, #2a2a2e ${percentage}%, #2a2a2e 100%)`,
				}}
			/>
			{children && <div className="mt-3">{children}</div>}
		</div>
	);
}
