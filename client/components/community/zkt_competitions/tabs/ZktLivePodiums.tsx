import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {b, getEventName, formatCs, formatHasAverage, competitorDisplayName, competitorFlag, competitorOf} from '../shared';

// Welcome-screen podiums for the ZKT Live tab — the WCA WcaLivePodiums twin.
// Fetches its own podium data (final-round top 3 per event) so it stays correct
// regardless of which round the live socket is currently watching.
const PODIUMS_QUERY = gql`
	query ZktLivePodiumsQuery($id: String!) {
		zktCompetitionPodiums(id: $id) {
			event_id
			round_id
			results {
				id
				user_id
				person_id
				best
				average
				ranking
				single_record_tag
				average_record_tag
				user {
					id
					username
					first_name
					last_name
					join_country
				}
				person {
					id
					first_name
					last_name
					country_code
				}
			}
		}
	}
`;

const MEDAL = ['🥇', '🥈', '🥉'];

interface PodiumBlock {
	event_id: string;
	round_id: string;
	results: any[];
}

export default function ZktLivePodiums({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const [podiums, setPodiums] = useState<PodiumBlock[]>([]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res: any = await gqlMutate(PODIUMS_QUERY, {id: detail.id});
				if (!cancelled) setPodiums((res?.data?.zktCompetitionPodiums || []) as PodiumBlock[]);
			} catch {
				if (!cancelled) setPodiums([]);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [detail.id]);

	if (podiums.length === 0) return null;

	// event_id → final-round format, to show average (Ao5/Mo3) vs best (Bo*).
	const eventFormat = new Map<string, string>();
	for (const ev of detail.events || []) {
		const finalRound = [...(ev.rounds || [])].sort(
			(a: any, b: any) => b.round_number - a.round_number
		)[0];
		if (finalRound) eventFormat.set(ev.event_id, finalRound.format);
	}

	return (
		<div className={b('podiums')}>
			<h3 className={b('section-title')}>{t('podiums')}</h3>
			<div className={b('podiums-grid')}>
				{podiums.map((pod) => {
					const useAvg = formatHasAverage(eventFormat.get(pod.event_id) || 'AO5');
					const top3 = [...pod.results]
						.filter((r: any) => r.ranking != null && r.ranking <= 3)
						.sort((a: any, b: any) => (a.ranking || 99) - (b.ranking || 99));
					if (top3.length === 0) return null;
					return (
						<div
							key={pod.event_id}
							className={b('podium-card')}
							onClick={() =>
								history.push(`/community/zkt-competitions/${detail.id}/live/${pod.event_id}`)
							}
						>
							<div className={b('podium-header')}>
								<span className={`cubing-icon event-${pod.event_id}`} style={{fontSize: 20}} />
								<span className={b('podium-event-name')}>{getEventName(pod.event_id)}</span>
							</div>
							<div className={b('podium-entries')}>
								{top3.map((r: any) => {
									const value = useAvg ? r.average : r.best;
									const tag = useAvg ? r.average_record_tag : r.single_record_tag;
									return (
										<div
											key={r.id}
											className={b('podium-entry', {[`rank-${r.ranking}`]: true})}
										>
											<span className={b('podium-medal')}>{MEDAL[r.ranking - 1] || ''}</span>
											<span className={b('podium-name')}>
												{competitorFlag(competitorOf(r)) && (
													<span className={b('flag')}>{competitorFlag(competitorOf(r))}</span>
												)}
												{competitorDisplayName(competitorOf(r)) || r.user_id || r.person_id}
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
