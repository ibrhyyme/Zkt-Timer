/**
 * XCrossSlotPicker — XCross F2L slot secici (native dropdown). "Optimal" + BL/BR/FR/FL.
 * NOT: slot idx<->isim eslemesi twisty ile dogrulanmali (constants XCROSS_SLOTS).
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {XCROSS_SLOTS} from '../../../../util/trainer/efficiency/constants';

const b = block('trainer-efficiency');

interface Props {
	value: number | undefined; // undefined = optimal
	onChange: (slot: number | undefined) => void;
}

export default function XCrossSlotPicker({value, onChange}: Props) {
	const {t} = useTranslation();
	return (
		<label className={b('field')}>
			<span className={b('field-label')}>{t('trainer.efficiency.xcross_slot_label', {defaultValue: 'Slot'})}</span>
			<select
				className={b('field-select')}
				value={value ?? ''}
				onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
			>
				<option value="">{t('trainer.efficiency.xcross_slot_optimal', {defaultValue: 'Optimal'})}</option>
				{XCROSS_SLOTS.map((s) => (
					<option key={s.idx} value={s.idx}>
						{s.name}
					</option>
				))}
			</select>
		</label>
	);
}
