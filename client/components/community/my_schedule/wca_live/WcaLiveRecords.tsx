import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {b, formatResult} from '../shared';

interface Props {
	records: any[];
	competitionId: string;
}

export default function WcaLiveRecords({records, competitionId}: Props) {
	const {t} = useTranslation();
	const history = useHistory();

	if (!records || records.length === 0) return null;

	function getTagColor(tag: string): string {
		if (tag === 'WR') return '#e74c3c';
		if (tag === 'CR') return '#f39c12';
		if (tag === 'NR') return '#27ae60';
		return '#888';
	}

	function handleClick(rec: any) {
		if (!rec.eventId || !rec.roundNumber) return;
		history.push(`/community/competitions/${competitionId}/wca-live/${rec.eventId}/${rec.roundNumber}`);
	}

	return (
		<div className={b('wca-live-records')}>
			<h3 className={b('wca-live-section-title')}>{t('my_schedule.wca_live_records')}</h3>
			<div className={b('wca-live-records-list')}>
				{records.map((rec, idx) => {
					const clickable = !!(rec.eventId && rec.roundNumber);
					return (
						<div
							key={idx}
							className={b('wca-live-record-item', {clickable})}
							onClick={() => clickable && handleClick(rec)}
						>
							<span
								className={b('wca-live-record-badge')}
								style={{backgroundColor: getTagColor(rec.tag)}}
							>
								{rec.tag}
							</span>
							<div className={b('wca-live-record-info')}>
								<span className={b('wca-live-record-text')}>
									{rec.eventName} {rec.type} of <strong>{formatResult(rec.attemptResult, rec.eventId, rec.type === 'average')}</strong>
								</span>
								<span className={b('wca-live-record-person')}>
									{rec.personName}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
