/**
 * RotationPicker — kup tutus acisi (CUBE_ORIENTATIONS). Native dropdown. '' = None.
 */
import React from 'react';
import SelectMenu from '../../../common/select_menu/SelectMenu';
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
			<SelectMenu
				value={value}
				onChange={onChange}
				ariaLabel={t('trainer.efficiency.rotation_label', {defaultValue: 'Rotation'})}
				options={ROTATION_OPTIONS.map((rot) => ({
					value: rot,
					label: rot === '' ? t('trainer.efficiency.rotation_none', {defaultValue: 'None'}) : rot,
				}))}
			/>
		</label>
	);
}
