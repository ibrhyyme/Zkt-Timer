import React, {useState, useCallback, useEffect} from 'react';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import Tag from '../../../common/tag/Tag';
import {getFullFormattedDate} from '../../../../util/dates';
import {
	deleteTrainerSolve,
	toggleTrainerPlusTwo,
	toggleTrainerDnf,
	getLastTimes,
} from '../../hooks/useAlgorithmData';
import type {TrainerSolveRecord} from '../../types';
import {useTranslation} from 'react-i18next';

const b = block('trainer');

interface TrainerSolveInfoProps {
	record: TrainerSolveRecord;
	index: number;
	algId: string;
	category: string;
	onClose: () => void;
	onDelete: () => void;
}

function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export default function TrainerSolveInfo({record: initialRecord, index, algId, category, onClose, onDelete}: TrainerSolveInfoProps) {
	const {t} = useTranslation();
	const [record, setRecord] = useState<TrainerSolveRecord>(initialRecord);

	const refreshRecord = useCallback(() => {
		const records = getLastTimes(algId);
		if (index >= 0 && index < records.length) {
			setRecord(records[index]);
		}
	}, [algId, index]);

	const handlePlusTwo = useCallback(() => {
		toggleTrainerPlusTwo(algId, index);
		refreshRecord();
	}, [algId, index, refreshRecord]);

	const handleDnf = useCallback(() => {
		toggleTrainerDnf(algId, index);
		refreshRecord();
	}, [algId, index, refreshRecord]);

	const handleDelete = useCallback(() => {
		deleteTrainerSolve(algId, index);
		onDelete();
	}, [algId, index, onDelete]);

	const effectiveTime = record.dnf ? null : record.t + (record.p2 ? 2000 : 0);
	const timeDisplay = record.dnf ? 'DNF' : formatTime(effectiveTime!);

	return (
		<div className={b('solve-info-overlay')} onClick={onClose}>
			<div className={b('solve-info-card')} onClick={(e) => e.stopPropagation()}>
				<div className={b('solve-info-top')}>
					<Button gray text={t('solve_info.delete')} onClick={handleDelete} />
					<span className={b('solve-info-done')} onClick={onClose}>{t('solve_info.done')}</span>
				</div>

				<div className={b('solve-info-body')}>
					<h2 className={b('solve-info-time', {dnf: record.dnf})}>{timeDisplay}</h2>

					<div className={b('solve-info-actions')}>
						<Tag text={category} backgroundColor="button" />
						<Button gray text="+2" onClick={handlePlusTwo} warning={!!record.p2} />
						<Button gray text="DNF" onClick={handleDnf} danger={!!record.dnf} />
					</div>

					{record.ts && (
						<div className={b('solve-info-date')}>
							{getFullFormattedDate(new Date(record.ts))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
