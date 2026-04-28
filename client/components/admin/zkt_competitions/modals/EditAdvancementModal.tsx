import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {openModal, closeModal} from '../../../../actions/general';
import {b} from '../shared';
import {useTranslation} from 'react-i18next';

interface Props {
	type: string | null | undefined; // 'RANKING' | 'PERCENT' | null
	level: number | null | undefined;
	onChange: (params: {type: string | null; level: number | null}) => Promise<void> | void;
}

export default function EditAdvancementModal({type, level, onChange}: Props) {
	const dispatch = useDispatch();

	function openEditor() {
		dispatch(openModal(<Editor initialType={type} initialLevel={level} onSave={onChange} />));
	}

	const label =
		type && level
			? type === 'PERCENT'
				? `İlk %${level}`
				: `İlk ${level}`
			: 'Ayarla';

	return (
		<button
			type="button"
			className={b('round-field-btn', {set: !!(type && level)})}
			onClick={openEditor}
		>
			{label}
		</button>
	);
}

function Editor({
	initialType,
	initialLevel,
	onSave,
}: {
	initialType: string | null | undefined;
	initialLevel: number | null | undefined;
	onSave: (params: {type: string | null; level: number | null}) => Promise<void> | void;
}) {
	const dispatch = useDispatch();
	const {t} = useTranslation();
	const [type, setType] = useState<string>(initialType || 'RANKING');
	const [level, setLevel] = useState<string>(initialLevel ? String(initialLevel) : '');

	async function handleSave() {
		const levelNum = parseInt(level, 10);
		if (isNaN(levelNum) || levelNum <= 0) return;
		await onSave({type, level: levelNum});
		dispatch(closeModal());
	}

	async function handleClear() {
		await onSave({type: null, level: null});
		dispatch(closeModal());
	}

	return (
		<div className={b('modal-content')}>
			<h2 className={b('modal-title')}>İlerleme Koşulu</h2>
			<p style={{fontSize: 13, color: 'rgba(var(--text-color), 0.65)', margin: 0}}>
				Bir sonraki tura kimler ilerleyebilir.
			</p>

			<div className={b('field')}>
				<label className={b('label')}>Tip</label>
				<select
					className={b('select')}
					value={type}
					onChange={(e) => setType(e.target.value)}
				>
					<option value="RANKING">İlk N yarışmacı</option>
					<option value="PERCENT">Yüzdelik dilim</option>
				</select>
			</div>

			<div className={b('field')}>
				<label className={b('label')}>
					{type === 'PERCENT' ? 'Yüzde (%)' : 'Kaç kişi'}
				</label>
				<input
					type="number"
					min="1"
					max={type === 'PERCENT' ? 99 : undefined}
					className={b('input')}
					value={level}
					onChange={(e) => setLevel(e.target.value)}
				/>
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
