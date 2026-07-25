import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {b, getEventName, formatCs, formatHasAverage, competitorDisplayName, competitorFlag} from '../shared';

// Welcome-screen podiums for the ZKT Live tab — the WCA WcaLivePodiums twin.
// The federation competition detail already embeds `podiums` (final-round top 3
// per event), so this reads straight from `detail` — no extra fetch.
const MEDAL = ['🥇', '🥈', '🥉'];

export default function ZktLivePodiums({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const podiums = detail.podiums || [];
	if (podiums.length === 0) return null;

	// eventId → final-round format, to show average (Ao5/Mo3) vs best (Bo*).
	const eventFormat = new Map<string, string>();
	for (const ev of detail.events || []) {
		const finalRound = [...(ev.rounds || [])].sort(
			(a: any, b: any) => b.roundNumber - a.roundNumber
		)[0];
		if (finalRound) eventFormat.set(ev.eventId, finalRound.format);
	}

	return (
		<div className={b('podiums')}>
			<h3 className={b('section-title')}>{t('podiums')}</h3>
			<div className={b('podiums-grid')}>
				{podiums.map((pod: any) => {
					const useAvg = formatHasAverage(eventFormat.get(pod.eventId) || 'AO5');
					const top3 = [...(pod.entries || [])]
						.filter((e: any) => e.ranking != null && e.ranking <= 3)
						.sort((a: any, b: any) => (a.ranking || 99) - (b.ranking || 99));
					if (top3.length === 0) return null;
					return (
						<div
							key={pod.eventId}
							className={b('podium-card')}
							onClick={() => history.push(`/zkt-competitions/${detail.id}/live/${pod.eventId}`)}
						>
							<div className={b('podium-header')}>
								<span className={`cubing-icon event-${pod.eventId}`} style={{fontSize: 20}} />
								<span className={b('podium-event-name')}>{getEventName(pod.eventId)}</span>
							</div>
							<div className={b('podium-entries')}>
								{top3.map((e: any) => {
									const value = useAvg ? e.average : e.best;
									const tag = useAvg ? e.recordTags?.average : e.recordTags?.single;
									return (
										<div
											key={e.competitor.id}
											className={b('podium-entry', {[`rank-${e.ranking}`]: true})}
										>
											<span className={b('podium-medal')}>{MEDAL[e.ranking - 1] || ''}</span>
											<span className={b('podium-name')}>
												{competitorFlag(e.competitor) && (
													<span className={b('flag')}>{competitorFlag(e.competitor)}</span>
												)}
												{competitorDisplayName(e.competitor) || e.competitor.id}
											</span>
											<span className={b('podium-time')}>
												{formatCs(value)}
												{tag && (
													<span className={b('record-tag', {[tag.toLowerCase()]: true})}>
														{tag}
													</span>
												)}
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
