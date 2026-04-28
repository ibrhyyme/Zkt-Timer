import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {openModal, closeModal} from '../../../../actions/general';
import {b, formatCs} from '../shared';
import TimeField from '../TimeField';
import {useTranslation} from 'react-i18next';

interface Props {
	cutoffCs: number | null | undefined;
	cutoffAttempts: number | null | undefined;
	onChange: (params: {cutoffCs: number | null; cutoffAttempts: number | null}) => Promise<void> | void;
}

export default function EditCutoffModal({cutoffCs, cutoffAttempts, onChange}: Props) {
	const dispatch = useDispatch();

	function openEditor() {
		dispatch(
			openModal(
				<Editor
					initialCs={cutoffCs}
					initialAttempts={cutoffAttempts}
					onSave={onChange}
				/>
			)
		);
	}

	const isSet = !!cutoffCs && !!cutoffAttempts;

	return (
		<button
			type="button"
			className={b('round-field-btn', {set: isSet})}
			onClick={openEditor}
		>
			{isSet ? `${formatCs(cutoffCs)} / ${cutoffAttempts}` : 'Ayarla'}
		</button>
	);
}

function Editor({
	initialCs,
	initialAttempts,
	onSave,
}: {
	initialCs: number | null | undefined;
	initialAttempts: number | null | undefined;
	onSave: (params: {cutoffCs: number | null; cutoffAttempts: number | null}) => Promise<void> | void;
}) {
	const dispatch = useDispatch();
	const {t} = useTranslation();
	const [cs, setCs] = useState<number | null>(initialCs ?? null);
	const [attempts, setAttempts] = useState<number>(initialAttempts ?? 2);

	async function handleSave() {
		await onSave({cutoffCs: cs, cutoffAttempts: cs ? attempts : null});
		dispatch(closeModal());
	}

	async function handleClear() {
		await onSave({cutoffCs: null, cutoffAttempts: null});
		dispatch(closeModal());
	}

	return (
		<div className={b('modal-content')}>
			<h2 className={b('modal-title')}>Cutoff</h2>
			<p style={{fontSize: 13, color: 'rgba(var(--text-color), 0.65)', margin: 0}}>
				İlk N denemede verilen süreyi aşmayan ilerleme hakkı kazanır.
			</p>

			<div className={b('field')}>
				<label className={b('label')}>Deneme sayısı</label>
				<select
					className={b('select')}
					value={attempts}
					onChange={(e) => setAttempts(parseInt(e.target.value, 10))}
				>
					<option value={1}>1</option>
					<option value={2}>2</option>
					<option value={3}>3</option>
				</select>
			</div>

			<div className={b('field')}>
				<label className={b('label')}>Cutoff süresi</label>
				<TimeField value={cs} onChange={setCs} placeholder="1:00.00" />
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
