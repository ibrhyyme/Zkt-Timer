/**
 * RotationPicker — kup tutus acisi (CUBE_ORIENTATIONS). Native dropdown. '' = None.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {ROTATION_OPTIONS} from '../../../../util/trainer/efficiency/constants';

const b = block('trainer-efficiency');

interface Props {
	value: string;
	onChange: (rot: string) => void;
}

export default function RotationPicker({value, onChange}: Props) {
	const {t} = useTranslation();
	return (
		<label className={b('field')}>
			<span className={b('field-label')}>{t('trainer.efficiency.rotation_label', {defaultValue: 'Rotation'})}</span>
			<select className={b('field-select')} value={value} onChange={(e) => onChange(e.target.value)}>
				{ROTATION_OPTIONS.map((rot) => (
					<option key={rot || 'none'} value={rot}>
						{rot === '' ? t('trainer.efficiency.rotation_none', {defaultValue: 'None'}) : rot}
					</option>
				))}
			</select>
		</label>
	);
}
