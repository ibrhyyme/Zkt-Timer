import React, {useState} from 'react';
import {Question} from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('trainer');

interface SettingSliderProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	suffix?: string;
	tooltip?: string;
	onChange: (next: number) => void;
}

export default function SettingSlider({label, value, min, max, step = 1, suffix, tooltip, onChange}: SettingSliderProps) {
	const [showTooltip, setShowTooltip] = useState(false);

	return (
		<div className={b('settings-row', {slider: true})}>
			<div className={b('settings-row-header')}>
				<span className={b('settings-row-label')}>
					{label}
					{tooltip && (
						<button
							type="button"
							className={b('settings-row-info-btn', {active: showTooltip})}
							onClick={() => setShowTooltip((v) => !v)}
							aria-label="Bilgi"
						>
							<Question size={14} weight="bold" />
						</button>
					)}
				</span>
				<span className={b('settings-row-value')}>{value}{suffix || ''}</span>
			</div>
			{tooltip && showTooltip && (
				<div className={b('settings-row-tooltip')}>{tooltip}</div>
			)}
			<input
				type="range"
				className={b('settings-slider')}
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={(e) => onChange(Number(e.target.value))}
			/>
		</div>
	);
}
