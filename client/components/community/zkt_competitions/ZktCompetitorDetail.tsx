import React, {useEffect, useState, useCallback, useMemo} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import {ArrowLeft, Trophy, ListBullets, Warning} from 'phosphor-react';
import Loading from '../../common/loading/Loading';
import {b, getEventName, formatCs, formatName, formatTimeRange, formatAttempts, formatHasAverage, getFormatAttempts, competitorDisplayName, competitorFlag, competitorOf, ZKT_ROLE_COLORS} from './shared';
import {useIsMobile} from '../../../util/hooks/useIsMobile';
import ZktResultModal from './ZktResultModal';

const COMPETITOR_DETAIL_QUERY = gql`
	query ZktCompetitorDetailPublic($competitionId: String!, $userId: String!) {
		zktCompetition(id: $competitionId) {
			id
			name
			date_start
			date_end
			events {
				id
				event_id
			}
			registrations {
				id
				user_id
				person_id
				status
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
				}
				events {
					comp_event_id
				}
			}
		}
		zktUserAssignments(competitionId: $competitionId, userId: $userId) {
			id
			round_id
			group_id
			user_id
			role
			station_number
			round {
				round_number
				format
				status
				comp_event {
					event_id
				}
			}
			group {
				group_number
				start_time
				end_time
			}
		}
		zktCompetitorResults(competitionId: $competitionId, userId: $userId) {
			id
			round_id
			attempt_1
			attempt_2
			attempt_3
			attempt_4
			attempt_5
			best
			average
			ranking
			proceeds
			single_record_tag
			average_record_tag
			round {
				round_number
				format
				comp_event {
					event_id
				}
			}
		}
	}
`;

const ROLE_LABELS: Record<string, string> = {
	COMPETITOR: 'role_competitor',
	JUDGE: 'role_judge',
	SCRAMBLER: 'role_scrambler',
	RUNNER: 'role_runner',
	ORGANIZER: 'role_organizer',
	STAFF: 'role_staff',
};

const ROLE_TINT = ZKT_ROLE_COLORS;

type Mode = 'schedule' | 'results';

export default function ZktCompetitorDetail() {
	const {competitionId, userId} = useParams<{competitionId: string; userId: string}>();
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [mode, setMode] = useState<Mode>('schedule');

	const fetch = useCallback(async () => {
		try {
			const res: any = await gqlMutate(COMPETITOR_DETAIL_QUERY, {competitionId, userId});
			setData(res?.data || null);
		} finally {
			setLoading(false);
		}
	}, [competitionId, userId]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	const competitor = useMemo(() => {
		if (!data) return null;
		// userId route param is a competitorId: either a user id or a ghost id.
		const reg = (data.zktCompetition?.registrations || []).find(
			(r: any) => r.user_id === userId || r.person_id === userId
		);
		return competitorOf(reg) || null;
	}, [data, userId]);

	const competitorEvents = useMemo(() => {
		if (!data) return [] as string[];
		const reg = (data.zktCompetition?.registrations || []).find(
			(r: any) => r.user_id === userId || r.person_id === userId
		);
		const compEventMap = new Map<string, string>();
		(data.zktCompetition?.events || []).forEach((e: any) =>
			compEventMap.set(e.id, e.event_id)
		);
		const ids: string[] = [];
		for (const ev of reg?.events || []) {
			const eid = compEventMap.get(ev.comp_event_id);
			if (eid) ids.push(eid);
		}
		return ids;
	}, [data, userId]);

	if (loading) return <Loading />;
	if (!data || !competitor) {
		return (
			<div className={b('detail-page')}>
				<div className={b('empty')}>{t('competitor_not_found')}</div>
			</div>
		);
	}

	const assignments = data.zktUserAssignments || [];
	const results = data.zktCompetitorResults || [];

	return (
		<div className={b('detail-page')}>
			<button
				className={b('back-btn')}
				onClick={() => history.push(`/community/zkt-competitions/${competitionId}`)}
			>
				<ArrowLeft weight="bold" /> {t('back')}
			</button>

			{/* Person header — WCA Person paritesi */}
			<div className={b('person-header')}>
				{competitor.profile?.pfp_image?.url ? (
					<img
						className={b('person-avatar')}
						src={competitor.profile.pfp_image.url}
						alt=""
					/>
				) : (
					<div className={b('person-avatar-placeholder')} />
				)}
				<h1 className={b('person-name')}>
					{competitorFlag(competitor) && (
						<span className={b('flag')}>{competitorFlag(competitor)}</span>
					)}
					{competitorDisplayName(competitor) || competitor.username}
				</h1>
			</div>

			{/* Cubing icon strip — yarışmacının kayıtlı olduğu eventler */}
			{competitorEvents.length > 0 && (
				<div className={b('person-events-strip')}>
					{competitorEvents.map((eid) => (
						<span
							key={eid}
							className={`cubing-icon event-${eid}`}
							title={getEventName(eid)}
						/>
					))}
				</div>
			)}

			{/* Mode toggle butonları */}
			<div className={b('person-mode-buttons')}>
				<button
					type="button"
					className={b('person-mode-btn', {active: mode === 'schedule', schedule: true})}
					onClick={() => setMode('schedule')}
				>
					<ListBullets weight="bold" /> {t('schedule_and_assignments')}
				</button>
				<button
					type="button"
					className={b('person-mode-btn', {active: mode === 'results', results: true})}
					onClick={() => setMode('results')}
				>
					<Trophy weight="bold" /> {t('results')}
				</button>
			</div>

			{mode === 'schedule' && (
				<>
					{assignments.length > 0 && (
						<div className={b('schedule-warning')}>
							<Warning weight="fill" />
							<span>{t('schedule_warning')}</span>
						</div>
					)}
					<ScheduleTable assignments={assignments} t={t} />
				</>
			)}

			{mode === 'results' && (
				<ResultsList results={results} competitionId={competitionId} t={t} />
			)}
		</div>
	);
}

function ScheduleTable({assignments, t}: {assignments: any[]; t: any}) {
	if (assignments.length === 0) {
		return <div className={b('empty')}>{t('no_assignments')}</div>;
	}

	// Sort by event then round then group
	const sorted = [...assignments].sort((a, bx) => {
		const ea = a.round?.comp_event?.event_id || '';
		const eb = bx.round?.comp_event?.event_id || '';
		if (ea !== eb) return ea.localeCompare(eb);
		const ra = a.round?.round_number || 0;
		const rb = bx.round?.round_number || 0;
		if (ra !== rb) return ra - rb;
		return (a.group?.group_number || 0) - (bx.group?.group_number || 0);
	});

	return (
		<div className={b('schedule-table-wrapper')}>
			<table className={b('schedule-table')}>
				<thead>
					<tr>
						<th>{t('col_event')}</th>
						<th>{t('col_round')}</th>
						<th>{t('time')}</th>
						<th>{t('col_role')}</th>
						<th>{t('col_group')}</th>
						<th>{t('col_station')}</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((a) => {
						const eventId = a.round?.comp_event?.event_id || '';
						const role = a.role || 'STAFF';
						const tint = ROLE_TINT[role] || '#888';
						const timeRange = a.group?.start_time
							? formatTimeRange(a.group.start_time, a.group.end_time)
							: '';
						const isLive =
							(a.round as any)?.status === 'OPEN' || (a.round as any)?.status === 'ACTIVE';
						return (
							<tr key={a.id} className={isLive ? b('schedule-row-live') : undefined}>
								<td>
									<span className={`cubing-icon event-${eventId}`} style={{marginRight: 8, fontSize: 16, verticalAlign: 'middle'}} />
									{getEventName(eventId)}
									{isLive && (
										<span className={b('live-now-chip', {static: true})}>{t('live_now')}</span>
									)}
								</td>
								<td>R{a.round?.round_number}</td>
								<td className={b('schedule-cell-time')}>{timeRange || '-'}</td>
								<td>
									<span
										className={b('role-pill')}
										style={{
											background: `${tint}22`,
											color: tint,
											border: `1px solid ${tint}55`,
										}}
									>
										{t(ROLE_LABELS[role] || role)}
									</span>
								</td>
								<td className={b('schedule-cell-center')}>
									{a.group?.group_number ?? '-'}
								</td>
								<td className={b('schedule-cell-center')}>
									{a.station_number ?? '-'}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function ResultsList({
	results,
	competitionId,
	t,
}: {
	results: any[];
	competitionId: string;
	t: any;
}) {
	const isMobile = useIsMobile();
	const [modalRow, setModalRow] = useState<any | null>(null);

	if (results.length === 0) {
		return <div className={b('empty')}>{t('no_results_yet')}</div>;
	}

	// Group by event
	const byEvent = new Map<string, any[]>();
	for (const r of results) {
		const eid = r.round?.comp_event?.event_id || 'unknown';
		if (!byEvent.has(eid)) byEvent.set(eid, []);
		byEvent.get(eid)!.push(r);
	}

	return (
		<div className={b('person-results')}>
			{Array.from(byEvent.entries()).map(([eventId, rounds]) => {
				const maxAttempts = rounds.reduce(
					(m: number, r: any) => Math.max(m, getFormatAttempts(r.round?.format || 'AO5')),
					0
				);
				const hasAvg = rounds.some((r: any) => formatHasAverage(r.round?.format || 'AO5'));
				const sorted = [...rounds].sort(
					(a, bx) => (a.round?.round_number || 0) - (bx.round?.round_number || 0)
				);
				return (
					<div key={eventId} className={b('person-results-event')}>
						<div className={b('person-results-event-header')}>
							<span className={`cubing-icon event-${eventId}`} style={{fontSize: 22}} />
							<span className={b('person-results-event-title')}>{getEventName(eventId)}</span>
						</div>
						<div className={b('results-table-wrapper')}>
							<table className={b('results-table', {mobile: isMobile})}>
								<thead>
									<tr>
										<th>{t('col_round')}</th>
										<th>#</th>
										{hasAvg && <th>{t('average')}</th>}
										<th>{t('best')}</th>
										{!isMobile &&
											Array.from({length: maxAttempts}).map((_, i) => (
												<th key={i} className={b('attempt-col')}>
													{i + 1}
												</th>
											))}
									</tr>
								</thead>
								<tbody>
									{sorted.map((r) => {
										const attempts = formatAttempts(
											[r.attempt_1, r.attempt_2, r.attempt_3, r.attempt_4, r.attempt_5],
											maxAttempts
										);
										const openRow = () => {
											if (!isMobile) return;
											setModalRow({
												title: `${getEventName(eventId)} — R${r.round?.round_number}`,
												ranking: r.ranking,
												best: r.best,
												average: r.average,
												attempts,
												averageRecordTag: r.average_record_tag,
												singleRecordTag: r.single_record_tag,
												competitorId: null,
											});
										};
										return (
											<tr
												key={r.id}
												className={b('result-row', {advancing: r.proceeds, clickable: isMobile})}
												onClick={openRow}
											>
												<td>R{r.round?.round_number}</td>
												<td className={b('result-rank')}>{r.ranking ?? '-'}</td>
												{hasAvg && (
													<td className={b('time-cell', {nr: !!r.average_record_tag})}>
														<span className={b('time-inner')}>
															{formatCs(r.average)}
															{r.average_record_tag && (
																<span className={b('record-tag', {[r.average_record_tag.toLowerCase()]: true})}>
																	{r.average_record_tag}
																</span>
															)}
														</span>
													</td>
												)}
												<td className={b('time-cell', {nr: !!r.single_record_tag})}>
													<span className={b('time-inner')}>
														{formatCs(r.best)}
														{r.single_record_tag && (
															<span className={b('record-tag', {[r.single_record_tag.toLowerCase()]: true})}>
																{r.single_record_tag}
															</span>
														)}
													</span>
												</td>
												{!isMobile &&
													attempts.map((a, i) => (
														<td key={i} className={b('result-attempt')}>
															{a}
														</td>
													))}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				);
			})}

			{modalRow && (
				<ZktResultModal
					row={modalRow}
					competitionId={competitionId}
					onClose={() => setModalRow(null)}
					t={t}
					showAverage={modalRow.average != null}
				/>
			)}
		</div>
	);
}
