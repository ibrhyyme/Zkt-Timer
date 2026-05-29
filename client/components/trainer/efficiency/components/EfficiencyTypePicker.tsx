/**
 * EfficiencyTypePicker — Cross / XCross / EOCross segment secici.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {EFFICIENCY_TYPES} from '../../../../util/trainer/efficiency/constants';
import type {EfficiencyType} from '../types';

const b = block('trainer-efficiency');

interface Props {
	value: EfficiencyType;
	onChange: (type: EfficiencyType) => void;
}

const LABEL_KEY: Record<EfficiencyType, string> = {
	cross: 'trainer.efficiency.type_cross',
	xcross: 'trainer.efficiency.type_xcross',
	eocross: 'trainer.efficiency.type_eocross',
};

export default function EfficiencyTypePicker({value, onChange}: Props) {
	const {t} = useTranslation();
	return (
		<div className={b('segment')} role="tablist" aria-label={t('trainer.efficiency.type_label', {defaultValue: 'Type'})}>
			{EFFICIENCY_TYPES.map((type) => (
				<button
					key={type}
					type="button"
					role="tab"
					aria-selected={value === type}
					className={b('segment-btn', {active: value === type})}
					onClick={() => onChange(type)}
				>
					{t(LABEL_KEY[type], {defaultValue: type})}
				</button>
			))}
		</div>
	);
}
