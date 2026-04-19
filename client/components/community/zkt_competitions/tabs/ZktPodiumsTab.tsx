import React, {useEffect, useMemo, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {b, formatCs, getEventName} from '../shared';
import {Trophy} from 'phosphor-react';

const PODIUMS_QUERY = gql`
	query ZktPodiumsRankings($id: String!) {
		zktCompetitionPodiums(id: $id) {
			event_id
			round_id
			results {
				id
				user_id
				best
				average
				ranking
				single_record_tag
				average_record_tag
				user {
					id
					username
					profile {
						pfp_image {
							url
						}
					}
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
			best
			average
			ranking
			no_show
			single_record_tag
			average_record_tag
			user {
				id
				username
				profile {
					pfp_image {
						url
					}
				}
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

	// Pull full ranking for the selected event's final round.
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

	if (loading) return <div className={b('empty')}>{t('loading')}</div>;
	if (podiums.length === 0) {
		return <div className={b('empty')}>{t('no_podiums_yet')}</div>;
	}

	const sortedRanking = useMemo(() => {
		return [...eventResults].sort((a, bx) => {
			const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
			const rb = bx.ranking ?? Number.MAX_SAFE_INTEGER;
			return ra - rb;
		});
	}, [eventResults]);

	return (
		<div className={b('rankings-tab')}>
			{/* Event filter chips — WCA pattern */}
			<div className={b('ranking-events')}>
				{podiums.map((p) => (
					<button
						key={p.event_id}
						type="button"
						className={b('event-chip', {active: selectedEventId === p.event_id})}
						onClick={() => setSelectedEventId(p.event_id)}
					>
						<span className={`cubing-icon event-${p.event_id}`} />
						<span>{getEventName(p.event_id)}</span>
					</button>
				))}
			</div>

			{selectedPodium && (
				<>
					{/* Top 3 podium banner — sadece görsel, ranking tablosunda da yer alır */}
					<div className={b('podium-banner')}>
						{selectedPodium.results
							.filter((r: any) => r.ranking !== null && r.ranking <= 3)
							.map((r: any) => (
								<div
									key={r.id}
									className={b('podium-medal-card', {[`pos-${r.ranking}`]: true})}
								>
									<Trophy weight="fill" size={28} />
									<div className={b('podium-medal-rank')}>#{r.ranking}</div>
									<div className={b('podium-medal-name')}>
										{r.user?.username || r.user_id}
									</div>
									<div className={b('podium-medal-time')}>{formatCs(r.best)}</div>
								</div>
							))}
					</div>

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
										return (
											<tr
												key={r.id}
												className={b('ranking-row', {
													podium: !!tint,
													'no-show': !!r.no_show,
												})}
												style={tint ? {background: tint} : undefined}
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
														<span>{r.user?.username || r.user_id}</span>
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
