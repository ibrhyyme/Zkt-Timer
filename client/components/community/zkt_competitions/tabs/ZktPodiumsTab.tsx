import React, {useEffect, useMemo, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {b, formatCs, getEventName, competitorDisplayName, competitorFlag, competitorExtId} from '../shared';
import {useHistory} from 'react-router-dom';

// Rankings tab: event chips come from the competition detail's embedded podiums
// (events with a finished final round); the full ranking for the selected event
// is fetched from that final round via the federation public round-results API.
const ROUND_RESULTS = gql`
	query ZktPublicRankingResults($competitionId: String!, $roundId: String!) {
		zktPublicRoundResults(competitionId: $competitionId, roundId: $roundId) {
			roundId
			results {
				competitor {
					id
					name
					wcaId
					externalId
					country
					avatarUrl
					isGhost
				}
				ranking
				best
				average
				recordTags {
					single
					average
				}
			}
		}
	}
`;

const MEDAL_TINT: Record<number, string> = {
	1: 'rgba(245, 197, 24, 0.18)',
	2: 'rgba(192, 192, 192, 0.18)',
	3: 'rgba(205, 127, 50, 0.18)',
};

export default function ZktPodiumsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [eventResults, setEventResults] = useState<any[]>([]);
	const [resultsLoading, setResultsLoading] = useState(false);

	// Which events have a ranking (a finished final round) + that round's id.
	const rankingEvents = useMemo(() => {
		return (detail.podiums || [])
			.map((pod: any) => {
				const ev = (detail.events || []).find((e: any) => e.eventId === pod.eventId);
				const finalRound = ev
					? [...(ev.rounds || [])]
							.filter((r: any) => r.status === 'FINISHED')
							.sort((a: any, b: any) => b.roundNumber - a.roundNumber)[0]
					: null;
				return {eventId: pod.eventId, roundId: finalRound?.roundId || null};
			})
			.filter((x: any) => x.roundId);
	}, [detail.podiums, detail.events]);

	useEffect(() => {
		if (!selectedEventId && rankingEvents.length > 0) {
			setSelectedEventId(rankingEvents[0].eventId);
		}
	}, [rankingEvents, selectedEventId]);

	const selectedRoundId = useMemo(
		() => rankingEvents.find((e: any) => e.eventId === selectedEventId)?.roundId || null,
		[rankingEvents, selectedEventId]
	);

	// Fetch the full ranking for the selected event's final round.
	useEffect(() => {
		if (!selectedRoundId) {
			setEventResults([]);
			return;
		}
		let cancelled = false;
		setResultsLoading(true);
		(async () => {
			try {
				const res: any = await gqlMutate(ROUND_RESULTS, {
					competitionId: detail.id,
					roundId: selectedRoundId,
				});
				if (!cancelled) setEventResults(res?.data?.zktPublicRoundResults?.results || []);
			} finally {
				if (!cancelled) setResultsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [selectedRoundId, detail.id]);

	const sortedRanking = useMemo(() => {
		return [...eventResults].sort((a, bx) => {
			const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
			const rb = bx.ranking ?? Number.MAX_SAFE_INTEGER;
			return ra - rb;
		});
	}, [eventResults]);

	if (rankingEvents.length === 0) {
		return <div className={b('empty')}>{t('no_podiums_yet')}</div>;
	}

	return (
		<div className={b('rankings-tab')}>
			{/* Event filter chips — WCA style */}
			<div className={b('event-chips')}>
				{rankingEvents.map((e: any) => (
					<button
						key={e.eventId}
						type="button"
						className={b('event-chip-btn', {active: selectedEventId === e.eventId})}
						onClick={() => setSelectedEventId(e.eventId)}
					>
						<span className={`cubing-icon event-${e.eventId}`} />
						<span>{getEventName(e.eventId)}</span>
					</button>
				))}
			</div>

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
								const compId = competitorExtId(r.competitor);
								const singleTag = r.recordTags?.single;
								const averageTag = r.recordTags?.average;
								return (
									<tr
										key={r.competitor.id}
										className={b('ranking-row', {podium: !!tint, clickable: true})}
										style={tint ? {background: tint} : undefined}
										onClick={() =>
											history.push(
												`/zkt-competitions/${detail.id}/competitors/${r.competitor.id}`
											)
										}
									>
										<td className={b('rank-num')}>{r.ranking ?? '-'}</td>
										<td>
											<div className={b('rank-name')}>
												{r.competitor.avatarUrl && (
													<img className={b('user-avatar')} src={r.competitor.avatarUrl} alt="" />
												)}
												<div className={b('rank-name-main')}>
													<span className={b('rank-name-text')}>
														{competitorFlag(r.competitor) ? competitorFlag(r.competitor) + ' ' : ''}
														{competitorDisplayName(r.competitor) || r.competitor.id}
													</span>
													{compId && <span className={b('rank-id')}>{compId}</span>}
												</div>
											</div>
										</td>
										<td className={b('rank-time')}>
											{formatCs(r.best)}
											{singleTag && (
												<span className={b('record-tag', {[singleTag.toLowerCase()]: true})}>
													{singleTag}
												</span>
											)}
										</td>
										<td className={b('rank-time')}>
											{formatCs(r.average)}
											{averageTag && (
												<span className={b('record-tag', {[averageTag.toLowerCase()]: true})}>
													{averageTag}
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
		</div>
	);
}
