import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {b, formatResult, countryFlag, EventIcon, RecordTag} from '../shared';

interface Props {
	podiums: any[];
	competitionId: string;
}

const MEDAL_LABELS: Record<number, string> = {1: '🥇', 2: '🥈', 3: '🥉'};

export default function WcaLivePodiums({podiums, competitionId}: Props) {
	const {t} = useTranslation();
	const history = useHistory();

	if (!podiums || podiums.length === 0) return null;

	function handleEventClick(eventId: string) {
		history.push(`/community/competitions/${competitionId}/wca-live/${eventId}`);
	}

	return (
		<div className={b('wca-live-podiums')}>
			<h3 className={b('wca-live-section-title')}>{t('my_schedule.wca_live_podiums')}</h3>
			<div className={b('wca-live-podiums-grid')}>
				{podiums.map((podium) => {
					const sortBy = podium.sortBy || 'best';
					return (
						<div
							key={podium.eventId}
							className={b('wca-live-podium-card')}
							onClick={() => handleEventClick(podium.eventId)}
						>
							<div className={b('wca-live-podium-header')}>
								<EventIcon eventId={podium.eventId} size={18} />
								<span className={b('wca-live-podium-event-name')}>{podium.eventName}</span>
							</div>
							<div className={b('wca-live-podium-entries')}>
								{podium.entries.map((entry: any) => {
									const value = sortBy === 'average' ? entry.average : entry.best;
									const recordTag = sortBy === 'average' ? entry.averageRecordTag : entry.singleRecordTag;
									return (
										<div
											key={entry.ranking}
											className={b('wca-live-podium-entry', {[`rank-${entry.ranking}`]: true})}
										>
											<span className={b('wca-live-podium-medal')}>{MEDAL_LABELS[entry.ranking] || ''}</span>
											<span className={b('wca-live-podium-name')}>
												{entry.personName}
											</span>
											<span className={b('wca-live-podium-time')}>
												{formatResult(value, podium.eventId, sortBy === 'average')}
												<RecordTag tag={recordTag} />
											</span>
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
