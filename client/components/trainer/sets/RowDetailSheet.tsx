/**
 * RowDetailSheet: a set row up close, read only (trainer-sets 7.4 "a row tap opens the
 * algorithm detail, read only"). The picture, the algorithm, its move count and this device's
 * statistics for that algorithm text. Nothing here writes to the set or to the device's
 * library copy; the learned flag can be changed, it is the same global flag the normal trainer
 * shows (3.2).
 */
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {BookmarkSimple} from 'phosphor-react';
import block from '../../../styles/bem';
import CasePattern from '../common/CasePattern';
import {facesFor, type PatternFaces} from './picker/PickerCards';
import {useTrainerDb} from '../../../util/hooks/useTrainerDb';
import {useMe} from '../../../util/hooks/useMe';
import {algToId, countMovesETM, ensureCubingReady} from '../../../util/trainer/algorithm_engine';
import {trainerAlgText} from '../../../util/trainer/set_queue';
import {averageOfFive, getBestTime, getLastTimes, getLearnedStatus, setLearnedStatus} from '../hooks/useAlgorithmData';
import type {AlgSetItemData} from '../../../lib/alg_sets/types';
import type {LearnedStatus} from '../types';

const b = block('alg-sets');

function formatTime(ms: number | null): string {
	if (!ms) return '-';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

/** `faces` comes from the page: the sheet opens in a modal, outside the trainer's context. */
export default function RowDetailSheet({item, faces}: {item: AlgSetItemData; faces: PatternFaces; onClose?: () => void}) {
	const {t} = useTranslation();
	const me = useMe();
	useTrainerDb();
	const [moves, setMoves] = useState(0);

	const text = trainerAlgText(item.algorithm);
	const algId = algToId(text);

	useEffect(() => {
		let alive = true;
		ensureCubingReady().then(
			() => alive && setMoves(countMovesETM(text)),
			() => {}
		);
		return () => {
			alive = false;
		};
	}, [text]);

	const learned = getLearnedStatus(algId);
	const nextStatus = ((learned + 1) % 3) as LearnedStatus;
	const flagLabel =
		learned === 2 ? t('trainer.sets.flag_learned') : learned === 1 ? t('trainer.sets.flag_learning') : t('trainer.sets.flag_none');

	return (
		<div className={b('sheet', {detail: true})}>
			<div className={b('detail-pattern')}>
				<CasePattern category={item.category} algorithm={text} {...facesFor(item.category, faces)} />
			</div>
			<p className={b('detail-category')}>{item.category}</p>
			<code className={b('detail-alg')}>{item.algorithm}</code>
			{moves > 0 ? <p className={b('detail-moves')}>{t('trainer.sets.variant_moves', {count: moves})}</p> : null}

			{me ? (
				<>
					<dl className={b('detail-stats')}>
						<div>
							<dt>{t('trainer.card_best')}</dt>
							<dd>{formatTime(getBestTime(algId))}</dd>
						</div>
						<div>
							<dt>{t('trainer.card_ao5')}</dt>
							<dd>{formatTime(averageOfFive(algId))}</dd>
						</div>
						<div>
							<dt>{t('trainer.solves')}</dt>
							<dd>{getLastTimes(algId).length}</dd>
						</div>
					</dl>
					<button
						type="button"
						className={b('flag-button', {learned: learned === 2, learning: learned === 1})}
						onClick={() => setLearnedStatus(algId, nextStatus)}
					>
						<BookmarkSimple size={18} weight={learned > 0 ? 'fill' : 'regular'} aria-hidden="true" />
						<span>{flagLabel}</span>
					</button>
				</>
			) : null}
		</div>
	);
}
