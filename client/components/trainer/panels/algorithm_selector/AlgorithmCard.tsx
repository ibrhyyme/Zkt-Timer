import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../styles/bem';
import { algToId } from '../../../../util/trainer/algorithm_engine';
import { getBestTime, averageOfFive, getLearnedStatus, setLearnedStatus, getLastTimes } from '../../hooks/useAlgorithmData';
import { useTrainerDb } from '../../../../util/hooks/useTrainerDb';
import { BookmarkSimple, Check, PencilSimple, Plus } from 'phosphor-react';
import CasePattern from '../../common/CasePattern';
import type { CubeFace, LearnedStatus } from '../../types';

const b = block('trainer');

interface AlgorithmCardProps {
	name: string;
	algorithm: string;
	category: string;
	subset: string;
	checked: boolean;
	onToggle: (algorithm: string, name: string, checked: boolean) => void;
	onDetail: (algorithm: string, name: string, category: string, subset: string) => void;
	topFace: CubeFace;
	frontFace: CubeFace;
}

function formatTimeShort(ms: number | null): string {
	if (!ms) return '-';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export default function AlgorithmCard({
	name,
	algorithm,
	category,
	subset,
	checked,
	onToggle,
	onDetail,
	topFace,
	frontFace,
}: AlgorithmCardProps) {
	const { t } = useTranslation();
	// Re-render when trainer stats change (best time, learned flag).
	useTrainerDb();
	const algId = algToId(algorithm);
	const best = getBestTime(algId);
	const ao5 = averageOfFive(algId);
	const learned = getLearnedStatus(algId);
	const solveCount = getLastTimes(algId).length;

	const cycleLearnedStatus = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const next = ((learned + 1) % 3) as LearnedStatus;
			setLearnedStatus(algId, next);
		},
		[algId, learned]
	);

	const learnedColor =
		learned === 2 ? 'var(--green-color, #66bb6a)' : learned === 1 ? '#ffa726' : undefined;

	return (
		<div
			className={b('alg-card', { checked })}
			onClick={() => onToggle(algorithm, name, !checked)}
		>
			<div className={b('alg-card-header')}>
				<span className={b('alg-card-name')} title={algorithm}>
					{name}
				</span>
				<button
					className={b('alg-card-bookmark')}
					onClick={cycleLearnedStatus}
					title={t('trainer.card_learned_status')}
					aria-label={t('trainer.card_learned_status')}
				>
					<BookmarkSimple
						size={20}
						weight={learned > 0 ? 'fill' : 'regular'}
						color={learnedColor}
					/>
				</button>
			</div>

			<div className={b('alg-card-stats')}>
				<div className={b('alg-card-stat')}>
					<span className={b('alg-card-stat-label')}>{t('trainer.card_best')}</span>
					<span className={b('alg-card-stat-value')}>{formatTimeShort(best)}</span>
				</div>
				<div className={b('alg-card-stat')}>
					<span className={b('alg-card-stat-label')}>{t('trainer.card_ao5')}</span>
					<span className={b('alg-card-stat-value')}>{formatTimeShort(ao5)}</span>
				</div>
			</div>

			<div className={b('alg-card-preview')}>
				<CasePattern category={category} algorithm={algorithm} topFace={topFace} frontFace={frontFace} />
			</div>

			<div className={b('alg-card-toggle')}>
				<div className={b('alg-card-checkbox', { checked })}>
					{checked ? <Check size={14} weight="bold" /> : <Plus size={14} />}
				</div>
				{solveCount > 0 && (
					<span className={b('alg-card-solves')}>
						<Check size={12} /> {solveCount}
					</span>
				)}
				<button
					className={b('alg-card-edit')}
					onClick={(e) => {
						e.stopPropagation();
						onDetail(algorithm, name, category, subset);
					}}
				>
					<PencilSimple size={16} />
				</button>
			</div>
		</div>
	);
}
