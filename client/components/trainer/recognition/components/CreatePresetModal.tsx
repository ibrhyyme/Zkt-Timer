/**
 * CreatePresetModal — custom preset creation modal with 9-group grid.
 * Provider-less — takes only onSave callback.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {CheckSquare, Square, Plus} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import StickerPattern from './StickerPattern';
import {ALL_GROUP_IDS} from '../../../../util/trainer/recognition/session_presets';
import {getGuideGroup, getGuideData, keysForGroups} from '../../../../util/trainer/recognition/guide_lookup';

const b = block('trainer-recognition');

interface CreatePresetModalProps {
	onSave: (label: string, groupIds: string[]) => void;
	onClose: () => void;
}

export default function CreatePresetModal({onSave, onClose}: CreatePresetModalProps) {
	const {t} = useTranslation();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
	const [presetName, setPresetName] = useState('');

	const gridRows = getGuideData().layout.rows;

	const groups = useMemo(
		() =>
			ALL_GROUP_IDS.map((id) => {
				const g = getGuideGroup(id);
				return {
					id,
					title: g?.title || id,
					headerLayers: g?.header.layers || [],
					caseCount: keysForGroups([id]).length,
				};
			}),
		[]
	);

	const autoName = useMemo(() => {
		if (selected.size === 0) return '';
		return [...selected]
			.map((id) => getGuideGroup(id)?.title)
			.filter(Boolean)
			.join(' + ');
	}, [selected]);

	useEffect(() => {
		if (!nameManuallyEdited) setPresetName(autoName);
	}, [autoName, nameManuallyEdited]);

	function toggleGroup(id: string) {
		const s = new Set(selected);
		if (s.has(id)) s.delete(id);
		else s.add(id);
		setSelected(s);
	}

	function selectAll() {
		setSelected(new Set(ALL_GROUP_IDS));
	}
	function selectNone() {
		setSelected(new Set());
		setNameManuallyEdited(false);
	}

	const totalCases = useMemo(() => (selected.size === 0 ? 0 : keysForGroups([...selected]).length), [selected]);
	const canSave = selected.size > 0 && presetName.trim().length > 0;

	function handleSave() {
		if (!canSave) return;
		const label = presetName.trim() || autoName || 'Custom';
		onSave(label, [...selected]);
		onClose();
	}

	return (
		<div className={b('preset-modal')}>
			<input
				type="text"
				maxLength={100}
				placeholder={t('trainer.recognition.preset_custom_name', {defaultValue: 'Preset name'})}
				value={presetName}
				onChange={(e) => {
					setPresetName(e.target.value);
					setNameManuallyEdited(true);
				}}
				className={b('preset-modal-input')}
			/>

			<div className={b('preset-modal-toolbar')}>
				<span className={b('preset-modal-counter')}>
					{selected.size > 0
						? t('trainer.recognition.preset_cases_selected', {count: totalCases, defaultValue: `${totalCases} cases selected`})
						: ' '}
				</span>
				<div className={b('preset-modal-toolbar-actions')}>
					<Button
						theme={CommonType.GRAY}
						small
						text={t('trainer.recognition.preset_select_all', {defaultValue: 'All'})}
						onClick={selectAll}
						noMargin
					/>
					<Button
						theme={CommonType.GRAY}
						small
						text={t('trainer.recognition.preset_select_none', {defaultValue: 'None'})}
						onClick={selectNone}
						noMargin
					/>
				</div>
			</div>

			<div className={b('preset-modal-grid')}>
				{gridRows.flat().map((groupId) => {
					const g = groups.find((x) => x.id === groupId)!;
					const isSelected = selected.has(groupId);
					return (
						<button
							key={groupId}
							type="button"
							onClick={() => toggleGroup(groupId)}
							className={b('preset-modal-cell', {selected: isSelected})}
						>
							<div className={b('preset-modal-cell-check')}>
								{isSelected ? (
									<CheckSquare weight="fill" size={20} />
								) : (
									<Square size={20} />
								)}
							</div>
							<div className={b('preset-modal-cell-pattern')}>
								<StickerPattern layers={g.headerLayers} cellSize={18} minColumns={6} />
							</div>
							<div className={b('preset-modal-cell-title')}>{g.title}</div>
							<span className={b('preset-modal-cell-count')}>{g.caseCount}</span>
						</button>
					);
				})}
			</div>

			<div className={b('preset-modal-footer')}>
				<Button
					theme={CommonType.GRAY}
					text={t('trainer.recognition.preset_cancel', {defaultValue: 'Cancel'})}
					onClick={onClose}
				/>
				<Button
					primary
					disabled={!canSave}
					icon={<Plus />}
					text={t('trainer.recognition.preset_save', {defaultValue: 'Save Preset'})}
					onClick={handleSave}
				/>
			</div>
		</div>
	);
}
