/**
 * XCrossSlotPicker — XCross F2L slot secici (native dropdown). "Optimal" + BL/BR/FR/FL.
 * NOT: slot idx<->isim eslemesi twisty ile dogrulanmali (constants XCROSS_SLOTS).
 */
import React from 'react';
import SelectMenu from '../../../common/select_menu/SelectMenu';
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
			<SelectMenu
				value={value ?? ''}
				onChange={(next) => onChange(next === '' ? undefined : Number(next))}
				ariaLabel={t('trainer.efficiency.xcross_slot_label', {defaultValue: 'Slot'})}
				options={[
					{value: '', label: t('trainer.efficiency.xcross_slot_optimal', {defaultValue: 'Optimal'})},
					...XCROSS_SLOTS.map((s) => ({value: String(s.idx), label: s.name})),
				]}
			/>
		</label>
	);
}
