import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {openModal, closeModal} from '../../../../actions/general';
import {b, formatCs} from '../shared';
import TimeField from '../TimeField';
import {useTranslation} from 'react-i18next';

interface Props {
	value: number | null | undefined;
	onChange: (cs: number | null) => Promise<void> | void;
}

export default function EditTimeLimitModal({value, onChange}: Props) {
	const dispatch = useDispatch();

	function openEditor() {
		dispatch(openModal(<Editor initialValue={value} onSave={onChange} />));
	}

	return (
		<button
			type="button"
			className={b('round-field-btn', {set: !!value})}
			onClick={openEditor}
		>
			{value ? formatCs(value) : 'Ayarla'}
		</button>
	);
}

function Editor({
	initialValue,
	onSave,
}: {
	initialValue: number | null | undefined;
	onSave: (cs: number | null) => Promise<void> | void;
}) {
	const dispatch = useDispatch();
	const {t} = useTranslation();
	const [draft, setDraft] = useState<number | null>(initialValue ?? null);

	async function handleSave() {
		await onSave(draft);
		dispatch(closeModal());
	}

	async function handleClear() {
		await onSave(null);
		dispatch(closeModal());
	}

	return (
		<div className={b('modal-content')}>
			<h2 className={b('modal-title')}>Zaman Limiti</h2>
			<div className={b('field')}>
				<label className={b('label')}>Limit (mm:ss.cc)</label>
				<TimeField value={draft} onChange={setDraft} placeholder="10:00.00" />
			</div>
			<div className={b('modal-actions')}>
				<button type="button" className={b('modal-btn', {danger: true})} onClick={handleClear}>
					{t('common.clear')}
				</button>
				<button type="button" className={b('modal-btn')} onClick={() => dispatch(closeModal())}>
					{t('common.cancel')}
				</button>
				<button type="button" className={b('modal-btn', {primary: true})} onClick={handleSave}>
					{t('common.save')}
				</button>
			</div>
		</div>
	);
}
