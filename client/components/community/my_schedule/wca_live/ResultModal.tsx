import React, {useEffect} from 'react';
import {useHistory} from 'react-router-dom';
import {X, ArrowSquareOut} from 'phosphor-react';
import {b, formatResult, RecordTag} from '../shared';
import {useBackdropClose} from '../../../../util/hooks/useBackdropClose';

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
	personRegistrantId?: number | null;
	/**
	 * ZKT Dual Chance round: both chances, already formatted. They replace the
	 * average and attempts blocks, which would only repeat the counting chance.
	 */
	chances?: {label: string; value: string; counting: boolean; attempts: string[]}[];
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
	const backdropClose = useBackdropClose(onClose);

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
		if (row.personRegistrantId != null) {
			history.push(`/competitions/${competitionId}/persons/${row.personRegistrantId}/results`);
		} else if (row.personWcaId) {
			history.push(`/competitions/${competitionId}/personal-bests/${row.personWcaId}`);
		}
	}

	const hasNavTarget = !!row.personWcaId || row.personRegistrantId != null;
	const showProfile = (showViewProfile ?? hasNavTarget) && hasNavTarget;

	return (
		<div className={b('wca-live-modal-overlay')} {...backdropClose}>
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
					<button
						className={b('wca-live-modal-close')}
						onClick={onClose}
						aria-label={t('common.close')}
						title={t('common.close')}
					>
						<X size={20} />
					</button>
				</div>

				<div className={b('wca-live-modal-body')}>
					{row.chances?.map((c) => (
						<div key={c.label} className={b('wca-live-modal-stat', {full: true, counting: c.counting})}>
							<div className={b('wca-live-modal-stat-label')}>{c.label}</div>
							<div className={b('wca-live-modal-stat-value')}>
								{c.value}
								{c.counting && showAverage && <RecordTag tag={row.averageRecordTag} />}
							</div>
							{c.attempts.length > 0 && (
								<div className={b('wca-live-modal-attempts')}>
									{c.attempts.map((a: string, i: number) => (
										<span key={i} className={b('wca-live-modal-attempt')}>{a}</span>
									))}
								</div>
							)}
						</div>
					))}
					{showAverage && !row.chances && (
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
					{!row.chances && (
						<div className={b('wca-live-modal-stat', {full: true})}>
							<div className={b('wca-live-modal-stat-label')}>{t('my_schedule.col_attempts')}</div>
							<div className={b('wca-live-modal-attempts')}>
								{row.attempts.map((a: string, i: number) => (
									<span key={i} className={b('wca-live-modal-attempt')}>{a}</span>
								))}
							</div>
						</div>
					)}
				</div>

				{showProfile && (
					<button className={b('wca-live-modal-profile-btn')} onClick={handleViewProfile}>
						<ArrowSquareOut size={16} />
						{t('my_schedule.view_complete_results')}
					</button>
				)}
			</div>
		</div>
	);
}
