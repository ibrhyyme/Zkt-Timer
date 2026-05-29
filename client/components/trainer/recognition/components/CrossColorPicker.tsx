/**
 * CrossColorPicker — 6 cross renk swatch toggle. Son secimi kaldirmaya calisirsa shake.
 */
import React, {useRef} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Check} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';

const b = block('trainer-recognition');

interface CrossColorPickerProps {
	value: string[];
	onChange: (next: string[]) => void;
}

interface ColorOpt {
	letter: string;
	name: string;
	hex: string;
	darkCheck: boolean;
}

const COLORS: ColorOpt[] = [
	{letter: 'w', name: 'White', hex: '#FFFFFF', darkCheck: true},
	{letter: 'y', name: 'Yellow', hex: '#FFFF00', darkCheck: true},
	{letter: 'b', name: 'Blue', hex: '#0000FF', darkCheck: false},
	{letter: 'g', name: 'Green', hex: '#32CD32', darkCheck: false},
	{letter: 'o', name: 'Orange', hex: '#FFA500', darkCheck: false},
	{letter: 'r', name: 'Red', hex: '#FF0000', darkCheck: false},
];

export default function CrossColorPicker({value, onChange}: CrossColorPickerProps) {
	const {t} = useTranslation();
	const refs = useRef<Record<string, HTMLButtonElement | null>>({});

	const isSelected = (letter: string) => value.includes(letter);
	const allSelected = value.length === COLORS.length;

	function shakeIfLast(letter: string) {
		const el = refs.current[letter];
		if (el) {
			const shakeClass = 'cd-trainer-recognition__cross-swatch--shake';
			el.classList.remove(shakeClass);
			void el.offsetWidth;
			el.classList.add(shakeClass);
		}
	}

	function toggle(letter: string) {
		if (isSelected(letter)) {
			if (value.length <= 1) {
				shakeIfLast(letter);
				return;
			}
			onChange(value.filter((c) => c !== letter));
		} else {
			onChange([...value, letter]);
		}
	}

	function selectAll() {
		onChange(COLORS.map((c) => c.letter));
	}
	function onlyWhite() {
		onChange(['w']);
	}

	return (
		<div>
			<div className={b('cross-colors')}>
				{COLORS.map((c) => (
					<div key={c.letter} className={b('cross-swatch-wrap')}>
						<button
							type="button"
							ref={(el) => {
								refs.current[c.letter] = el;
							}}
							className={b('cross-swatch', {selected: isSelected(c.letter)})}
							style={{backgroundColor: c.hex}}
							aria-pressed={isSelected(c.letter)}
							aria-label={c.name}
							onClick={() => toggle(c.letter)}
						>
							{isSelected(c.letter) && (
								<Check weight="bold" style={{color: c.darkCheck ? '#333' : '#fff', fontSize: 20}} />
							)}
						</button>
						<span className={b('cross-swatch-label', {selected: isSelected(c.letter)})}>{c.name}</span>
					</div>
				))}
			</div>
			<div className={b('cross-action')}>
				{!allSelected ? (
					<Button
						theme={CommonType.TRANSPARENT}
						small
						text={t('trainer.recognition.settings_cross_select_all', {defaultValue: 'Select all'})}
						onClick={selectAll}
						noMargin
					/>
				) : (
					<Button
						theme={CommonType.TRANSPARENT}
						small
						text={t('trainer.recognition.settings_cross_only_white', {defaultValue: 'Only white'})}
						onClick={onlyWhite}
						noMargin
					/>
				)}
			</div>
		</div>
	);
}
