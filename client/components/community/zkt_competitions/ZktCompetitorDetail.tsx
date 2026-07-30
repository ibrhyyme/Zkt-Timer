import React, {useEffect, useState, useCallback} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import {ArrowLeft, Trophy, ListBullets, Warning} from 'phosphor-react';
import Loading from '../../common/loading/Loading';
import {b, getEventName, formatCs, formatName, formatTimeRange, formatAttempts, formatHasAverage, getFormatAttempts, competitorDisplayName, competitorFlag, ZKT_ROLE_COLORS} from './shared';
import {useIsMobile} from '../../../util/hooks/useIsMobile';
import ZktResultModal from './ZktResultModal';

// One competitor's personal view (schedule/assignments + results) from the
// federation public API. The route param is the opaque competitor key emitted by
// the list/results payloads — no internal user/person id is ever exposed.
const COMPETITOR_DETAIL_QUERY = gql`
	query ZktPublicCompetitor($competitionId: String!, $key: String!) {
		zktPublicCompetitor(competitionId: $competitionId, key: $key) {
			competitor {
				id
				name
				wcaId
				externalId
				country
				avatarUrl
				isGhost
			}
			registeredEventIds
			dayLabel
			days {
				position
				label
				date
			}
			assignments {
				role
				stationNumber
				groupNumber
				startTime
				endTime
				dayLabel
				round {
					roundNumber
					format
					status
					eventId
					eventName
					isFinal
					dayLabel
				}
			}
			results {
				roundId
				eventId
				eventName
				roundNumber
				format
				attempts
				best
				average
				ranking
				proceeds
				recordTags {
					single
					average
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
	// `userId` route param is really the opaque competitor key.
	const {competitionId, userId: key} = useParams<{competitionId: string; userId: string}>();
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [mode, setMode] = useState<Mode>('schedule');

	const fetch = useCallback(async () => {
		try {
			const res: any = await gqlMutate(COMPETITOR_DETAIL_QUERY, {competitionId, key});
			setData(res?.data?.zktPublicCompetitor || null);
		} finally {
			setLoading(false);
		}
	}, [competitionId, key]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	if (loading) return <Loading />;
	if (!data || !data.competitor) {
		return (
			<div className={b('detail-page')}>
				<div className={b('empty')}>{t('competitor_not_found')}</div>
			</div>
		);
	}

	const competitor = data.competitor;
	const competitorEvents: string[] = data.registeredEventIds || [];
	const assignments = data.assignments || [];
	const results = data.results || [];

	return (
		<div className={b('detail-page')}>
			<button
				className={b('back-btn')}
				onClick={() => history.push(`/zkt-competitions/${competitionId}`)}
			>
				<ArrowLeft weight="bold" /> {t('back')}
			</button>

			{/* Person header — WCA Person paritesi */}
			<div className={b('person-header')}>
				{competitor.avatarUrl ? (
					<img className={b('person-avatar')} src={competitor.avatarUrl} alt="" />
				) : (
					<div className={b('person-avatar-placeholder')} />
				)}
				<h1 className={b('person-name')}>
					{competitorFlag(competitor) && (
						<span className={b('flag')}>{competitorFlag(competitor)}</span>
					)}
					{competitorDisplayName(competitor) || competitor.id}
				</h1>
			</div>

			{/* Cubing icon strip — yarismacinin kayitli oldugu eventler */}
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

			{/* Mode toggle butonlari */}
			{/* On a day-split competition this is the headline of the page: which
			    morning is theirs. It sits above the schedule, not inside it. */}
			{data.dayLabel && (
				<div className={b('competitor-day-card')}>
					<strong>
						{t('attending_day')}: {data.dayLabel}
					</strong>
					{(() => {
						const day = (data.days || []).find((d: any) => d.label === data.dayLabel);
						if (!day?.date) return null;
						return (
							<span className={b('competitor-day-date')}>
								{new Date(day.date).toLocaleDateString(
									i18n.language === 'tr' ? 'tr-TR' : i18n.language,
									{day: 'numeric', month: 'long', year: 'numeric', weekday: 'long'}
								)}
							</span>
						);
					})()}
				</div>
			)}

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
					<ScheduleTable assignments={assignments} t={t} myDayLabel={data.dayLabel} />
				</>
			)}

			{mode === 'results' && (
				<ResultsList results={results} competitionId={competitionId} t={t} />
			)}
		</div>
	);
}

function ScheduleTable({
	assignments,
	t,
	myDayLabel,
}: {
	assignments: any[];
	t: any;
	/** The day this competitor was accepted onto; null unless the comp is split. */
	myDayLabel?: string | null;
}) {
	if (assignments.length === 0) {
		return <div className={b('empty')}>{t('no_assignments')}</div>;
	}

	// Sort by event then round then group
	const sorted = [...assignments].sort((a, bx) => {
		const ea = a.round?.eventId || '';
		const eb = bx.round?.eventId || '';
		if (ea !== eb) return ea.localeCompare(eb);
		const ra = a.round?.roundNumber || 0;
		const rb = bx.round?.roundNumber || 0;
		if (ra !== rb) return ra - rb;
		return (a.groupNumber || 0) - (bx.groupNumber || 0);
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
					{sorted.map((a, i) => {
						const eventId = a.round?.eventId || '';
						const role = a.role || 'STAFF';
						const tint = ROLE_TINT[role] || '#888';
						const timeRange = a.startTime ? formatTimeRange(a.startTime, a.endTime) : '';
						const isLive = a.round?.status === 'OPEN' || a.round?.status === 'ACTIVE';
						return (
							<tr key={i} className={isLive ? b('schedule-row-live') : undefined}>
								<td>
									<span className={`cubing-icon event-${eventId}`} style={{marginRight: 8, fontSize: 16, verticalAlign: 'middle'}} />
									{getEventName(eventId)}
									{isLive && (
										<span className={b('live-now-chip', {static: true})}>{t('live_now')}</span>
									)}
								</td>
								<td>
									{a.round?.isFinal ? t('round_final') : `R${a.round?.roundNumber}`}
									{a.round?.dayLabel ? ` · ${a.round.dayLabel}` : ''}
								</td>
								<td className={b('schedule-cell-time')}>
									{timeRange || '-'}
									{/* The row shows a clock time only. On a day-split competition an
									    event pinned to the other day, or a shared final, runs outside
									    the day this competitor was accepted for — saying just "09:37"
									    is how someone turns up on the wrong morning. */}
									{a.dayLabel && (
										<div
											className={b('schedule-cell-day', {
												foreign: !!myDayLabel && a.dayLabel !== myDayLabel,
											})}
										>
											{a.dayLabel}
											{myDayLabel && a.dayLabel !== myDayLabel
												? ` (${t('not_your_day')})`
												: ''}
										</div>
									)}
								</td>
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
									{a.groupNumber ?? '-'}
								</td>
								<td className={b('schedule-cell-center')}>
									{a.stationNumber ?? '-'}
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
		const eid = r.eventId || 'unknown';
		if (!byEvent.has(eid)) byEvent.set(eid, []);
		byEvent.get(eid)!.push(r);
	}

	return (
		<div className={b('person-results')}>
			{Array.from(byEvent.entries()).map(([eventId, rounds]) => {
				const maxAttempts = rounds.reduce(
					(m: number, r: any) => Math.max(m, getFormatAttempts(r.format || 'AO5')),
					0
				);
				const hasAvg = rounds.some((r: any) => formatHasAverage(r.format || 'AO5'));
				const sorted = [...rounds].sort(
					(a, bx) => (a.roundNumber || 0) - (bx.roundNumber || 0)
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
										const attempts = formatAttempts(r.attempts || [], maxAttempts);
										const singleTag = r.recordTags?.single;
										const averageTag = r.recordTags?.average;
										const openRow = () => {
											if (!isMobile) return;
											setModalRow({
												title: `${getEventName(eventId)} — R${r.roundNumber}`,
												ranking: r.ranking,
												best: r.best,
												average: r.average,
												attempts,
												averageRecordTag: averageTag,
												singleRecordTag: singleTag,
												competitorId: null,
											});
										};
										return (
											<tr
												key={r.roundId}
												className={b('result-row', {advancing: r.proceeds, clickable: isMobile})}
												onClick={openRow}
											>
												<td>R{r.roundNumber}</td>
												<td className={b('result-rank')}>{r.ranking ?? '-'}</td>
												{hasAvg && (
													<td className={b('time-cell', {nr: !!averageTag})}>
														<span className={b('time-inner')}>
															{formatCs(r.average)}
															{averageTag && (
																<span className={b('record-tag', {[averageTag.toLowerCase()]: true})}>
																	{averageTag}
																</span>
															)}
														</span>
													</td>
												)}
												<td className={b('time-cell', {nr: !!singleTag})}>
													<span className={b('time-inner')}>
														{formatCs(r.best)}
														{singleTag && (
															<span className={b('record-tag', {[singleTag.toLowerCase()]: true})}>
																{singleTag}
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
