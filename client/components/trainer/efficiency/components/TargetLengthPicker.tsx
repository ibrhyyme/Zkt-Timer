/**
 * TargetLengthPicker (Faz 3) — hedef move count secici (native dropdown).
 * "Herhangi" + ture gore uzunluklar. Nadir uzunlukta opsiyonda ⚠ isareti.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {LENGTH_RANGES, RARE_LENGTHS} from '../../../../util/trainer/efficiency/constants';
import type {EfficiencyType} from '../types';

const b = block('trainer-efficiency');

interface Props {
	type: EfficiencyType;
	value: number | undefined;
	onChange: (len: number | undefined) => void;
}

export default function TargetLengthPicker({type, value, onChange}: Props) {
	const {t} = useTranslation();
	const range = LENGTH_RANGES[type];
	const rare = RARE_LENGTHS[type];

	return (
		<label className={b('field')}>
			<span className={b('field-label')}>{t('trainer.efficiency.length_label', {defaultValue: 'Length'})}</span>
			<select
				className={b('field-select')}
				value={value ?? ''}
				onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
			>
				<option value="">{t('trainer.efficiency.length_any', {defaultValue: 'Any'})}</option>
				{range.map((len) => (
					<option key={len} value={len}>
						{len}
						{rare.includes(len) ? ' ⚠' : ''}
					</option>
				))}
			</select>
		</label>
	);
}
