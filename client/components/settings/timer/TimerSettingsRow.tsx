import React, { useState } from 'react';
import { Minus, Plus } from 'phosphor-react';
import FancyDropdown from '../../timer/header_control/FancyDropdown';
import Switch from '../../common/switch/Switch';
import { hasVisibleSettingsRow } from './visible_settings_row';
import { useSettingsSearch, matchesSearch } from '../SettingsSearchContext';

// --- Group ---

interface TimerSettingsGroupProps {
	label: string;
	id?: string;
	/**
	 * Extra text the group answers to in search. The filter below reads `label` and
	 * `description` off its direct children, so a group whose content is a custom
	 * component (the theme picker, the language list) has nothing to match on and
	 * used to be unreachable from the search box entirely. Such a group declares the
	 * words its content contains here instead.
	 */
	searchText?: string[];
	children: React.ReactNode;
}

export function TimerSettingsGroup({ label, id, searchText, children }: TimerSettingsGroupProps) {
	const { query } = useSettingsSearch();
	const trimmed = query.trim();

	let visibleChildren: React.ReactNode = children;
	if (trimmed && !matchesSearch(trimmed, label, ...(searchText || []))) {
		// Group label itself doesn't match -> keep only rows whose label/description match.
		const filtered = React.Children.toArray(children).filter((child) => {
			if (!React.isValidElement(child)) return false;
			const props = child.props as { label?: string; description?: string; hidden?: boolean };
			if (props.hidden) return false;
			// Rows without searchable text (custom content) only surface via a group-label match.
			if (props.label === undefined && props.description === undefined) return false;
			return matchesSearch(trimmed, props.label, props.description);
		});
		if (filtered.length === 0) return null;
		visibleChildren = filtered;
	}

	// A row can hide itself independent of search (e.g. Input settings' Virtual Cube rows,
	// all gated on `hidden={!isVirtual}`). Every row component already returns null for its
	// own `hidden`, but the group wrapper used to render its header regardless, leaving a
	// section title with nothing underneath. Hide the whole group instead when nothing in
	// it would actually render.
	if (!hasVisibleSettingsRow(visibleChildren)) return null;

	return (
		<div id={id} data-settings-group data-settings-label={label} className="mt-6 first:mt-0">
			<div className="mb-3">
				<span className="text-text/70 text-xs font-semibold uppercase tracking-wider">
					{label}
				</span>
			</div>
			<div className="space-y-2">
				{visibleChildren}
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
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium transition-colors text-text">
					{label}
				</span>
				{description && (
					<span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<Switch on={isActive} disabled={disabled} ariaLabel={label} onChange={() => onClick()} />
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
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium text-text transition-colors">
					{label}
				</span>
				{description && (
					<span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<div className="flex items-center space-x-2 shrink-0">
				<button
					type="button"
					onClick={decrement}
					disabled={value <= min}
					className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 border ${value <= min
						? 'bg-text/[0.04] border-transparent text-text/30 cursor-not-allowed'
						: 'bg-text/[0.08] border-transparent text-text hover:bg-text/[0.14] cursor-pointer'
						}`}
				>
					<Minus weight="bold" size={12} />
				</button>
				<span className="text-sm font-medium text-primary min-w-[40px] text-center tabular-nums">
					{displayValue}
				</span>
				<button
					type="button"
					onClick={increment}
					disabled={max !== undefined && value >= max}
					className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 border ${max !== undefined && value >= max
						? 'bg-text/[0.04] border-transparent text-text/30 cursor-not-allowed'
						: 'bg-text/[0.08] border-transparent text-text hover:bg-text/[0.14] cursor-pointer'
						}`}
				>
					<Plus weight="bold" size={12} />
				</button>
			</div>
		</div>
	);
}

// --- Decimal ---

interface TimerSettingsDecimalProps {
	label: string;
	description?: string;
	value: number;
	step: number;
	min: number;
	max: number;
	decimals: number;
	hidden?: boolean;
	/** Turns whatever was typed (or nudged) into a valid value; only its result is committed. */
	normalize: (raw: unknown) => number;
	onChange: (val: number) => void;
}

/**
 * A number the user can type, for values too fine to reach with +/- alone: a 0.01 step
 * over several seconds is hundreds of taps. The buttons stay for nudging. Like
 * TimerSettingsText, typing is held locally and committed on blur or Enter, since every
 * commit rewrites the whole platform prefs blob.
 */
export function TimerSettingsDecimal({ label, description, value, step, min, max, decimals, hidden, normalize, onChange }: TimerSettingsDecimalProps) {
	const [draft, setDraft] = useState('');
	const [focused, setFocused] = useState(false);

	if (hidden) return null;

	const current = normalize(value);
	const shown = focused ? draft : current.toFixed(decimals);
	const scale = Math.pow(10, decimals);

	const commit = () => {
		setFocused(false);
		// An emptied field keeps the old value rather than silently becoming 0
		if (!draft.trim()) return;
		const next = normalize(draft);
		if (next !== current) onChange(next);
	};

	const nudge = (direction: 1 | -1) => {
		const next = normalize(Math.round((current + direction * step) * scale) / scale);
		if (next !== current) onChange(next);
	};

	const buttonClass = (disabled: boolean) =>
		`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 border ${disabled
			? 'bg-text/[0.04] border-transparent text-text/30 cursor-not-allowed'
			: 'bg-text/[0.08] border-transparent text-text hover:bg-text/[0.14] cursor-pointer'
		}`;

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium text-text transition-colors">
					{label}
				</span>
				{description && (
					<span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<div className="flex items-center space-x-2 shrink-0">
				<button type="button" onClick={() => nudge(-1)} disabled={current <= min} className={buttonClass(current <= min)}>
					<Minus weight="bold" size={12} />
				</button>
				<input
					type="text"
					inputMode="decimal"
					value={shown}
					aria-label={label}
					onFocus={() => {
						setDraft(current.toFixed(decimals));
						setFocused(true);
					}}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commit}
					onKeyDown={(e) => {
						if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
					}}
					className="w-16 px-2 py-1 rounded-lg bg-text/[0.08] border border-transparent text-sm font-medium text-text text-center tabular-nums focus:border-primary focus:outline-none transition-colors"
				/>
				<button type="button" onClick={() => nudge(1)} disabled={current >= max} className={buttonClass(current >= max)}>
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
	placeholder?: string;
	options: { label: string; value: string }[];
	hidden?: boolean;
	onChange: (val: string) => void;
}

export function TimerSettingsSelect({ label, description, value, placeholder, options, hidden, onChange }: TimerSettingsSelectProps) {
	if (hidden) return null;

	const selectedLabel = options.find(o => o.value === value)?.label || placeholder || value;

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium text-text transition-colors">
					{label}
				</span>
				{description && (
					<span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<div className="shrink-0">
				<FancyDropdown
					value={value}
					onValueChange={onChange}
					options={options}
					triggerLabel={selectedLabel}
					ariaLabel={label}
					align="end"
					triggerMinWidth={120}
				/>
			</div>
		</div>
	);
}

// --- Action ---

interface TimerSettingsActionProps {
	label: string;
	description?: string;
	hidden?: boolean;
	/**
	 * Below lg the control sits under the text at full width instead of beside it. For a
	 * wide control (the background picker is a 200px preview plus a hint) that would
	 * otherwise squeeze the label to one word per line on a phone and push the hint off
	 * the screen. lg, not md: from 768px the settings nav takes a column of its own, and
	 * a portrait tablet left the label about 100px wide.
	 */
	stackOnMobile?: boolean;
	children: React.ReactNode;
}

export function TimerSettingsAction({ label, description, hidden, stackOnMobile, children }: TimerSettingsActionProps) {
	if (hidden) return null;

	return (
		<div
			className={`group flex ${stackOnMobile ? 'flex-col items-start lg:flex-row lg:items-center lg:justify-between' : 'items-center justify-between'} py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200`}
		>
			<div className={`flex flex-col ${stackOnMobile ? 'lg:mr-4' : 'mr-4'}`}>
				<span className="font-medium text-text transition-colors">
					{label}
				</span>
				{description && (
					<span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>
				)}
			</div>
			<div className={stackOnMobile ? 'mt-3 lg:mt-0 lg:shrink-0' : 'shrink-0'}>
				{children}
			</div>
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
	restoreDefaultLabel?: string;
	onRestoreDefault?: () => void;
	onChange: (val: number) => void;
	children?: React.ReactNode;
}

export function TimerSettingsSlider({ label, description, value, min, max, hidden, showReset, resetLabel, onReset, restoreDefaultLabel, onRestoreDefault, onChange, children }: TimerSettingsSliderProps) {
	const [savedFlash, setSavedFlash] = React.useState(false);

	if (hidden) return null;

	const percentage = ((value - min) / (max - min)) * 100;

	function handleRestoreDefault() {
		if (!onRestoreDefault) return;
		onRestoreDefault();
		setSavedFlash(true);
		setTimeout(() => setSavedFlash(false), 1500);
	}

	return (
		<div className="py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex items-center justify-between mb-3">
				<div className="flex flex-col">
					<span className="font-medium text-text">{label}</span>
					{description && (
						<span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>
					)}
				</div>
				<div className="flex items-center space-x-3 shrink-0 ml-4">
					<span className="text-sm font-medium text-primary tabular-nums">{value}px</span>
					{onRestoreDefault && (
						<button
							type="button"
							onClick={handleRestoreDefault}
							// Text actions share one colour, the accent ("Default" was a fixed
							// blue next to an orange "Reset").
							className={`text-xs transition-colors cursor-pointer ${savedFlash ? 'text-[rgb(var(--success-color))]' : 'text-primary hover:text-primary/80'}`}
						>
							{savedFlash ? '✓' : (restoreDefaultLabel || 'Default')}
						</button>
					)}
					{showReset && onReset && (
						<button
							type="button"
							onClick={onReset}
							className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
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
				className="zt-range w-full h-1.5 rounded-full appearance-none cursor-pointer"
				style={{
					background: `linear-gradient(to right, rgb(var(--primary-color)) 0%, rgb(var(--primary-color)) ${percentage}%, rgba(var(--text-color), 0.2) ${percentage}%, rgba(var(--text-color), 0.2) 100%)`,
				}}
			/>
			{children && <div className="mt-3">{children}</div>}
		</div>
	);
}

// --- Text ---

interface TimerSettingsTextProps {
	label: string;
	description?: string;
	value: string;
	placeholder?: string;
	maxLength?: number;
	hidden?: boolean;
	onChange: (val: string) => void;
}

export function TimerSettingsText({ label, description, value, placeholder, maxLength, hidden, onChange }: TimerSettingsTextProps) {
	// Held locally while typing and committed on blur: every commit rewrites the whole
	// platform prefs blob, so a request per keystroke would be wasteful.
	const [draft, setDraft] = useState(value);
	const [focused, setFocused] = useState(false);

	if (hidden) return null;

	const shown = focused ? draft : value;

	const commit = () => {
		setFocused(false);
		if (draft !== value) onChange(draft);
	};

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex flex-col mr-4">
				<span className="font-medium transition-colors text-text">{label}</span>
				{description && <span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>}
			</div>
			<input
				type="text"
				value={shown}
				placeholder={placeholder}
				maxLength={maxLength}
				onFocus={() => {
					setDraft(value);
					setFocused(true);
				}}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
				}}
				className="w-36 px-3 py-1.5 rounded-lg bg-text/[0.08] border border-transparent text-sm text-text text-center focus:border-primary focus:outline-none transition-colors"
			/>
		</div>
	);
}
