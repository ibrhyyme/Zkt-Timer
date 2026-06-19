import React, {useEffect, useMemo, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {b, formatCs, getEventName, competitorDisplayName, competitorFlag, competitorOf} from '../shared';
import {useHistory} from 'react-router-dom';

const PODIUMS_QUERY = gql`
	query ZktPodiumsRankings($id: String!) {
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
					profile {
						pfp_image {
							url
						}
					}
				}
				person {
					id
					first_name
					last_name
					country_code
					wca_id
					external_id
				}
			}
		}
	}
`;

const ROUND_RESULTS = gql`
	query ZktRoundResultsForRankings($roundId: String!) {
		zktRoundResults(roundId: $roundId) {
			id
			user_id
			person_id
			best
			average
			ranking
			no_show
			single_record_tag
			average_record_tag
			user {
				id
				username
				first_name
				last_name
				join_country
				profile {
					pfp_image {
						url
					}
				}
			}
			person {
				id
				first_name
				last_name
				country_code
					wca_id
					external_id
			}
		}
	}
`;

interface PodiumBlock {
	event_id: string;
	round_id: string;
	results: any[];
}

const MEDAL_TINT: Record<number, string> = {
	1: 'rgba(245, 197, 24, 0.18)',
	2: 'rgba(192, 192, 192, 0.18)',
	3: 'rgba(205, 127, 50, 0.18)',
};

export default function ZktPodiumsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const [podiums, setPodiums] = useState<PodiumBlock[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [eventResults, setEventResults] = useState<any[]>([]);
	const [resultsLoading, setResultsLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res: any = await gqlMutate(PODIUMS_QUERY, {id: detail.id});
				if (!cancelled) {
					const list = (res?.data?.zktCompetitionPodiums || []) as PodiumBlock[];
					setPodiums(list);
					if (list.length > 0 && !selectedEventId) {
						setSelectedEventId(list[0].event_id);
					}
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [detail.id]);

	const selectedPodium = useMemo(
		() => podiums.find((p) => p.event_id === selectedEventId) || null,
		[podiums, selectedEventId]
	);

	// Fetch full ranking for the selected event's final round.
	useEffect(() => {
		if (!selectedPodium) {
			setEventResults([]);
			return;
		}
		let cancelled = false;
		setResultsLoading(true);
		(async () => {
			try {
				const res: any = await gqlMutate(ROUND_RESULTS, {roundId: selectedPodium.round_id});
				if (!cancelled) setEventResults(res?.data?.zktRoundResults || []);
			} finally {
				if (!cancelled) setResultsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [selectedPodium?.round_id]);

	// All hooks must run before any early return — keep this useMemo above the
	// loading/empty guards or React throws "Rendered more hooks than previous".
	const sortedRanking = useMemo(() => {
		return [...eventResults].sort((a, bx) => {
			const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
			const rb = bx.ranking ?? Number.MAX_SAFE_INTEGER;
			return ra - rb;
		});
	}, [eventResults]);

	if (loading) return <div className={b('empty')}>{t('loading')}</div>;
	if (podiums.length === 0) {
		return <div className={b('empty')}>{t('no_podiums_yet')}</div>;
	}

	return (
		<div className={b('rankings-tab')}>
			{/* Event filter chips — WCA style */}
			<div className={b('event-chips')}>
				{podiums.map((p) => (
					<button
						key={p.event_id}
						type="button"
						className={b('event-chip-btn', {active: selectedEventId === p.event_id})}
						onClick={() => setSelectedEventId(p.event_id)}
					>
						<span className={`cubing-icon event-${p.event_id}`} />
						<span>{getEventName(p.event_id)}</span>
					</button>
				))}
			</div>

			{selectedPodium && (
				<>
					{/* Full ranking table */}
					<div className={b('ranking-table-wrapper')}>
						<table className={b('ranking-table')}>
							<thead>
								<tr>
									<th>#</th>
									<th>{t('col_name')}</th>
									<th>{t('best')}</th>
									<th>{t('average')}</th>
								</tr>
							</thead>
							<tbody>
								{resultsLoading ? (
									<tr>
										<td colSpan={4} className={b('rankings-empty-cell')}>
											{t('loading')}
										</td>
									</tr>
								) : sortedRanking.length === 0 ? (
									<tr>
										<td colSpan={4} className={b('rankings-empty-cell')}>
											{t('no_results_yet')}
										</td>
									</tr>
								) : (
									sortedRanking.map((r) => {
										const tint = r.ranking && r.ranking <= 3 ? MEDAL_TINT[r.ranking] : undefined;
							const compId = r.person ? r.person.wca_id || r.person.external_id : null;
										return (
											<tr
												key={r.id}
												className={b('ranking-row', {
													podium: !!tint,
													'no-show': !!r.no_show,
													clickable: true,
												})}
												style={tint ? {background: tint} : undefined}
												onClick={() =>
													history.push(
														`/zkt-competitions/${detail.id}/competitors/${r.user_id || r.person_id}`
													)
												}
											>
												<td className={b('rank-num')}>{r.ranking ?? '-'}</td>
												<td>
													<div className={b('rank-name')}>
														{r.user?.profile?.pfp_image?.url && (
															<img
																className={b('user-avatar')}
																src={r.user.profile.pfp_image.url}
																alt=""
															/>
														)}
														<div className={b('rank-name-main')}>
											<span className={b('rank-name-text')}>{competitorFlag(competitorOf(r)) ? competitorFlag(competitorOf(r)) + ' ' : ''}{competitorDisplayName(competitorOf(r)) || r.user_id || r.person_id}</span>
											{compId && <span className={b('rank-id')}>{compId}</span>}
										</div>
													</div>
												</td>
												<td className={b('rank-time')}>
													{formatCs(r.best)}
													{r.single_record_tag && (
														<span
															className={b('record-tag', {
																[r.single_record_tag.toLowerCase()]: true,
															})}
														>
															{r.single_record_tag}
														</span>
													)}
												</td>
												<td className={b('rank-time')}>
													{formatCs(r.average)}
													{r.average_record_tag && (
														<span
															className={b('record-tag', {
																[r.average_record_tag.toLowerCase()]: true,
															})}
														>
															{r.average_record_tag}
														</span>
													)}
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</>
			)}
		</div>
	);
}
