/**
 * PresetCard — preset karti (default veya custom).
 * Header sticker pattern grid + label + subtitle + PbStats + case count badge + delete (deletable ise).
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Check, Circle, X, GridFour, MinusCircle} from 'phosphor-react';
import StickerPattern from './StickerPattern';
import PbStats from './PbStats';
import {getGroups, presetKeys, subtitle as presetSubtitle, type Preset} from '../../../../util/trainer/recognition/session_presets';
import type {PersonalBest} from '../../../../util/trainer/recognition/session_history';

const b = block('trainer-recognition');

interface PresetCardProps {
	preset: Preset;
	selected?: boolean;
	deletable?: boolean;
	pb?: PersonalBest | null;
	onSelect: () => void;
	onDelete?: () => void;
	deleteTitle?: string;
}

export default function PresetCard({preset, selected = false, deletable = false, pb = null, onSelect, onDelete, deleteTitle}: PresetCardProps) {
	const {t} = useTranslation();
	const subtitle = presetSubtitle(preset);
	const caseCount = presetKeys(preset).length;
	const groups = preset.groups ? getGroups(preset.groups) : [];

	return (
		<div
			className={b('preset-card', {selected})}
			onClick={onSelect}
			role="button"
			tabIndex={0}
		>
			<div className={b('preset-card-check', {selected})}>
				{selected ? <Check weight="fill" /> : <Circle />}
			</div>

			{deletable && onDelete && (
				<button
					type="button"
					className={b('preset-card-delete')}
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					title={deleteTitle}
				>
					<X />
				</button>
			)}

			{preset.groups && groups.length > 0 ? (
				<div className={b('preset-card-patterns')}>
					{groups.map((g) => (
						<StickerPattern key={g.id} layers={g.header.layers} cellSize={18} minColumns={6} />
					))}
				</div>
			) : (
				<div className={b('preset-card-icon')}>
					{preset.exclude ? <MinusCircle /> : <GridFour />}
				</div>
			)}

			<h6 className={b('preset-card-title')}>{preset.label}</h6>
			{subtitle && <small className={b('preset-card-subtitle')}>{subtitle}</small>}
			{pb && <PbStats pb={pb} />}
			<span className={b('preset-card-cases-badge')}>
				{t('trainer.recognition.quest_case_count', {count: caseCount, defaultValue: `${caseCount} cases`})}
			</span>
		</div>
	);
}
