import React, {useEffect} from 'react';
import {useHistory} from 'react-router-dom';
import {X, ArrowSquareOut} from 'phosphor-react';
import {b, formatResult, RecordTag} from '../shared';

export interface ResultModalRow {
	title: string;            // Modal basligi (personName veya event-round adi)
	subtitle?: string;        // Opsiyonel alt baslik
	ranking?: number | null;
	best: number;
	average: number;
	attempts: string[];       // formatted attempt strings
	eventId: string;
	averageRecordTag?: string | null;
	singleRecordTag?: string | null;
	personWcaId?: string | null;
}

interface Props {
	row: ResultModalRow;
	competitionId: string;
	onClose: () => void;
	t: any;
	showViewProfile?: boolean; // default: personWcaId varsa true
	showAverage?: boolean;     // default: true (Bo1/BLD durumunda false)
}

export default function ResultModal({row, competitionId, onClose, t, showViewProfile, showAverage = true}: Props) {
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
		if (!row.personWcaId) return;
		onClose();
		history.push(`/community/competitions/${competitionId}/personal-bests/${row.personWcaId}`);
	}

	const showProfile = (showViewProfile ?? !!row.personWcaId) && !!row.personWcaId;

	return (
		<div className={b('wca-live-modal-overlay')} onClick={onClose}>
			<div className={b('wca-live-modal')} onClick={(e) => e.stopPropagation()}>
				<div className={b('wca-live-modal-header')}>
					<div>
						{row.ranking != null && (
							<div className={b('wca-live-modal-rank')}>#{row.ranking}</div>
						)}
						<h3 className={b('wca-live-modal-name')}>{row.title}</h3>
						{row.subtitle && (
							<div className={b('wca-live-modal-subtitle')}>{row.subtitle}</div>
						)}
					</div>
					<button className={b('wca-live-modal-close')} onClick={onClose}>
						<X size={20} />
					</button>
				</div>

				<div className={b('wca-live-modal-body')}>
					{showAverage && (
						<div className={b('wca-live-modal-stat')}>
							<div className={b('wca-live-modal-stat-label')}>{t('my_schedule.col_average')}</div>
							<div className={b('wca-live-modal-stat-value')}>
								{formatResult(row.average, row.eventId, true)}
								<RecordTag tag={row.averageRecordTag} />
							</div>
						</div>
					)}
					<div className={b('wca-live-modal-stat')}>
						<div className={b('wca-live-modal-stat-label')}>{t('my_schedule.col_best')}</div>
						<div className={b('wca-live-modal-stat-value')}>
							{formatResult(row.best, row.eventId, false)}
							<RecordTag tag={row.singleRecordTag} />
						</div>
					</div>
					<div className={b('wca-live-modal-stat', {full: true})}>
						<div className={b('wca-live-modal-stat-label')}>{t('my_schedule.col_attempts')}</div>
						<div className={b('wca-live-modal-attempts')}>
							{row.attempts.map((a: string, i: number) => (
								<span key={i} className={b('wca-live-modal-attempt')}>{a}</span>
							))}
						</div>
					</div>
				</div>

				{showProfile && (
					<button className={b('wca-live-modal-profile-btn')} onClick={handleViewProfile}>
						<ArrowSquareOut size={16} />
						{t('my_schedule.view_personal_records')}
					</button>
				)}
			</div>
		</div>
	);
}
