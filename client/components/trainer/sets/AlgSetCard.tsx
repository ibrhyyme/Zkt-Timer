/**
 * AlgSetCard: one set in My Sets and in Community Sets (trainer-sets 7.1).
 *
 *   [d1][d2][d3][d4]  Name
 *                     21 algorithms  [OLL] [PLL] [F2L]
 *   owner · 14 saves  (Community, Saved)   or   visibility (My sets)
 *
 * The thumbnails are the first rows (`preview`) drawn with CasePattern; 3D fallbacks share the
 * global player budget. A tap opens the set page; long press, right click or "..." opens the
 * card's actions when the list gives some (holding "..." itself does not start a long press).
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {DotsThreeVertical, EyeSlash} from 'phosphor-react';
import block from '../../../styles/bem';
import CasePattern from '../common/CasePattern';
import {facesFor, usePatternFaces} from './picker/PickerCards';
import {trainerAlgText} from '../../../util/trainer/set_queue';
import {CategoryBadges, OwnerChip, VisibilityTag, useLongPress} from './parts';
import type {AlgSetSummaryData} from '../../../lib/alg_sets/types';

const b = block('alg-sets');

export type AlgSetCardVariant = 'mine' | 'saved' | 'community';

interface Props {
	set: AlgSetSummaryData;
	variant: AlgSetCardVariant;
	onOpen: (set: AlgSetSummaryData) => void;
	onMenu?: (set: AlgSetSummaryData) => void;
}

export default function AlgSetCard({set, variant, onOpen, onMenu}: Props) {
	const {t} = useTranslation();
	const openMenu = onMenu ? () => onMenu(set) : null;
	const {handlers, consumeClick} = useLongPress(openMenu);

	const faces = usePatternFaces();
	const thumbs = set.preview.slice(0, 4);
	const showOwner = variant !== 'mine';

	return (
		<div className={b('card')} {...handlers}>
			<button
				type="button"
				className={b('card-main')}
				onClick={() => {
					if (consumeClick()) return;
					onOpen(set);
				}}
			>
				<span className={b('thumbs')} aria-hidden="true">
					{[0, 1, 2, 3].map((i) => (
						<span key={i} className={b('thumb', {empty: !thumbs[i]})}>
							{thumbs[i] ? (
								<CasePattern
									category={thumbs[i].category}
									algorithm={trainerAlgText(thumbs[i].algorithm)}
									{...facesFor(thumbs[i].category, faces)}
									fit
								/>
							) : null}
						</span>
					))}
				</span>
				<span className={b('card-body')}>
					<span className={b('card-name')}>{set.name}</span>
					<span className={b('card-line')}>
						<span className={b('card-count')}>{t('trainer.sets.count', {count: set.item_count})}</span>
						<CategoryBadges categories={set.categories} />
					</span>
					<span className={b('card-line', {meta: true})}>
						{showOwner ? <OwnerChip owner={set.owner} plain /> : <VisibilityTag visibility={set.visibility} />}
						{variant === 'community' || (variant === 'mine' && set.visibility !== 'private') ? (
							<span className={b('card-saves')}>{t('trainer.sets.saves_count', {count: set.save_count})}</span>
						) : null}
						{set.hidden ? (
							<span className={b('hidden-tag')}>
								<EyeSlash size={13} weight="bold" aria-hidden="true" />
								{t('trainer.sets.hidden_tag')}
							</span>
						) : null}
					</span>
				</span>
			</button>
			{openMenu ? (
				<button
					type="button"
					className={b('card-menu')}
					onClick={openMenu}
					onTouchStart={(e) => e.stopPropagation()}
					onContextMenu={(e) => e.stopPropagation()}
					aria-label={t('trainer.sets.more_actions')}
					title={t('trainer.sets.more_actions')}
				>
					<DotsThreeVertical size={20} weight="bold" />
				</button>
			) : null}
		</div>
	);
}
