import React, {useEffect} from 'react';
import {useHistory} from 'react-router-dom';
import {X, ArrowSquareOut} from 'phosphor-react';
import {b, formatCs} from './shared';

// Mobile result detail bottom-sheet — the ZKT twin of the WCA my_schedule
// ResultModal. On a phone the live table only shows #/Name/Avg/Best; tapping a
// row opens this with all attempts + record tags, matching the WCA experience.
export interface ZktResultModalRow {
	title: string;
	subtitle?: string;
	ranking?: number | null;
	best?: number;
	average?: number;
	attempts: string[];
	averageRecordTag?: string | null;
	singleRecordTag?: string | null;
	competitorId?: string | null; // user_id || person_id
}

interface Props {
	row: ZktResultModalRow;
	competitionId: string;
	onClose: () => void;
	t: any;
	showAverage?: boolean;
}

export default function ZktResultModal({row, competitionId, onClose, t, showAverage = true}: Props) {
	const history = useHistory();

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		document.addEventListener('keydown', onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [onClose]);

	function handleViewProfile() {
		onClose();
		if (row.competitorId) {
			history.push(`/community/zkt-competitions/${competitionId}/competitors/${row.competitorId}`);
		}
	}

	return (
		<div className={b('result-modal-overlay')} onClick={onClose}>
			<div className={b('result-modal')} onClick={(e) => e.stopPropagation()}>
				<div className={b('result-modal-header')}>
					<div>
						{row.ranking != null && (
							<div className={b('result-modal-rank')}>#{row.ranking}</div>
						)}
						<h3 className={b('result-modal-name')}>{row.title}</h3>
						{row.subtitle && (
							<div className={b('result-modal-subtitle')}>{row.subtitle}</div>
						)}
					</div>
					<button className={b('result-modal-close')} onClick={onClose} aria-label={t('close')}>
						<X size={20} />
					</button>
				</div>

				<div className={b('result-modal-body')}>
					{showAverage && (
						<div className={b('result-modal-stat')}>
							<div className={b('result-modal-stat-label')}>{t('average')}</div>
							<div className={b('result-modal-stat-value')}>
								{formatCs(row.average) || '-'}
								{row.averageRecordTag && (
									<span className={b('record-tag', {[row.averageRecordTag.toLowerCase()]: true})}>
										{row.averageRecordTag}
									</span>
								)}
							</div>
						</div>
					)}
					<div className={b('result-modal-stat')}>
						<div className={b('result-modal-stat-label')}>{t('best')}</div>
						<div className={b('result-modal-stat-value')}>
							{formatCs(row.best) || '-'}
							{row.singleRecordTag && (
								<span className={b('record-tag', {[row.singleRecordTag.toLowerCase()]: true})}>
									{row.singleRecordTag}
								</span>
							)}
						</div>
					</div>
					<div className={b('result-modal-stat', {full: true})}>
						<div className={b('result-modal-stat-label')}>{t('attempts')}</div>
						<div className={b('result-modal-attempts')}>
							{row.attempts.map((a, i) => (
								<span key={i} className={b('result-modal-attempt')}>{a}</span>
							))}
						</div>
					</div>
				</div>

				{row.competitorId && (
					<button className={b('result-modal-profile-btn')} onClick={handleViewProfile}>
						<ArrowSquareOut size={16} />
						{t('view_full_results')}
					</button>
				)}
			</div>
		</div>
	);
}
