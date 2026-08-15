import React, {useState, useEffect, useMemo} from 'react';
import {useParams, useHistory, useRouteMatch, useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {b, getEventName, formatCs, formatName, formatHasAverage, getFormatAttempts, formatAttempts, competitorDisplayName, competitorFlag} from '../shared';
import {useZktLiveResults, LiveResult} from '../useZktLiveResults';
import {useIsMobile} from '../../../../util/hooks/useIsMobile';
import {ArrowClockwise, Broadcast} from 'phosphor-react';
import ZktLivePodiums from './ZktLivePodiums';
import ZktResultModal, {ZktResultModalRow} from '../ZktResultModal';
import AdvancementLegend from '../AdvancementLegend';

// Live results for a federation competition. Rounds/advancement/records all come
// pre-computed from the federation public API; this view selects an event+round
// and renders. Round metadata (format/limits/status) is read from the already
// loaded competition detail; the per-attempt rows poll every 10s via
// useZktLiveResults.
export default function ZktLiveTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const {competitionId} = useParams<{competitionId: string}>();
	const history = useHistory();
	const matchEvent = useRouteMatch<{eventId?: string; roundNumber?: string}>(
		'/zkt-competitions/:competitionId/live/:eventId/:roundNumber?'
	);

	const location = useLocation();

	const urlEventId = matchEvent?.params.eventId;
	const urlRoundNumber = matchEvent?.params.roundNumber
		? parseInt(matchEvent.params.roundNumber, 10)
		: null;
	// A day-split event has two rounds numbered 1, so the number alone does not
	// name a round: the path would always resolve to whichever came first, and a
	// link to the second day's round opened the first day's. The day rides along
	// as a query so the existing route (and every link already shared) still works.
	const urlDay = (() => {
		const raw = new URLSearchParams(location.search).get('day');
		const n = raw ? parseInt(raw, 10) : NaN;
		return Number.isFinite(n) ? n : null;
	})();

	/** The round a path+day pair points at, preferring an exact day match. */
	const findRoundInUrl = (rounds: any[]) => {
		if (!urlRoundNumber) return undefined;
		const sameNumber = rounds.filter((r: any) => r.roundNumber === urlRoundNumber);
		if (sameNumber.length === 0) return undefined;
		if (urlDay !== null) {
			const exact = sameNumber.find((r: any) => (r.dayIndex ?? 0) === urlDay);
			if (exact) return exact;
		}
		return sameNumber[0];
	};

	// ── Competition day
	// A day-split competition runs a whole chain per day, so without a day the
	// page shows both mornings at once: two "1. Tur"s, two finals, and no way to
	// tell which one is being run right now. Everyone here attends exactly one
	// day, so the page shows one day and the reader picks it.
	const compDays: Array<{position: number; label: string; date?: string}> = detail.days || [];
	const isDaySplit = compDays.length >= 2;

	/** The day this competition is on today, or null when it is not running. */
	const todayDay = (() => {
		if (!isDaySplit) return null;
		const today = new Date().toDateString();
		const match = compDays.find((d) => d.date && new Date(d.date).toDateString() === today);
		return match ? match.position : null;
	})();

	// Opening on competition day lands on today's day, which is the one the
	// reader is standing in. The URL wins when it names a day (a shared link),
	// and outside the competition the first day is the sensible start.
	const [selectedDay, setSelectedDay] = useState<number>(() => {
		if (!isDaySplit) return 0;
		if (urlDay !== null && urlDay > 0) return urlDay;
		return todayDay ?? compDays[0].position;
	});

	/**
	 * The rounds of an event that belong on the selected day: that day's own
	 * chain, plus every round that belongs to no day — the shared final everyone
	 * comes back for, and any event pinned to run once. Those are genuinely on
	 * both days' pages, which is what the organizer means by a shared round.
	 */
	const roundsForDay = (rounds: any[]) =>
		!isDaySplit ? rounds : rounds.filter((r: any) => !r.dayIndex || r.dayIndex === selectedDay);

	// selectedEventId is the WCA event id (e.g. "333"); "" = welcome screen.
	const [selectedEventId, setSelectedEventId] = useState<string>(
		urlEventId && detail.events.some((e: any) => e.eventId === urlEventId) ? urlEventId : ''
	);
	// An event with nothing on the selected day is not on this day's page at all.
	const visibleEvents = useMemo(
		() => detail.events.filter((ev: any) => roundsForDay(ev.rounds).length > 0),
		[detail.events, isDaySplit, selectedDay]
	);
	// Rebuilt with the day's rounds only. Memoised because it is an effect
	// dependency below, and a fresh object every render would re-run the effect
	// on every render rather than when the event or the day actually changes.
	const selectedEvent = useMemo(() => {
		const raw = detail.events.find((e: any) => e.eventId === selectedEventId);
		return raw ? {...raw, rounds: roundsForDay(raw.rounds)} : undefined;
	}, [detail.events, selectedEventId, isDaySplit, selectedDay]);

	const defaultRound =
		selectedEvent?.rounds.find((r: any) => r.status === 'ACTIVE') ||
		selectedEvent?.rounds.find((r: any) => r.status === 'FINISHED') ||
		selectedEvent?.rounds[0];
	const [selectedRoundId, setSelectedRoundId] = useState<string>(
		urlRoundNumber && selectedEvent
			? findRoundInUrl(selectedEvent.rounds)?.roundId || defaultRound?.roundId || ''
			: defaultRound?.roundId || ''
	);
	const selectedRound = selectedEvent?.rounds.find((r: any) => r.roundId === selectedRoundId);

	useEffect(() => {
		// Reset round selection when event changes
		if (selectedEvent && !selectedEvent.rounds.some((r: any) => r.roundId === selectedRoundId)) {
			const d = selectedEvent.rounds[0];
			setSelectedRoundId(d?.roundId || '');
		}
	}, [selectedEventId, selectedEvent, selectedRoundId]);

	// competitionId param may be a slug; detail.id is the federation UUID. The
	// results endpoint accepts either, so pass the UUID for stability.
	const {results, loading, refresh} = useZktLiveResults(detail.id, selectedRoundId);

	// Final round = the last round of THIS round's own day-chain, which the
	// federation already worked out (`isFinalOfChain`). Taking the event's
	// highest round number instead is wrong on a day-split event: each day runs
	// its own final, and only the later day's would have got the medals.
	// The fallback is the old rule, for a federation too old to send the flag.
	const isFinalRound = !!(
		selectedRound &&
		selectedEvent &&
		(selectedRound.isFinal ??
			selectedRound.roundNumber ===
				Math.max(...(selectedEvent.rounds || []).map((r: any) => r.roundNumber)))
	);

	// The day filter already answers "which day is this", so repeating it on every
	// round would be noise. It is only spelled out when there is no filter to read
	// it from, i.e. on a competition that is not split across days.
	const roundLabel = (r: any) =>
		`${r.isFinal ? t('round_final') : t('round_n', {n: r.roundNumber})}${
			!isDaySplit && r.dayLabel ? ` · ${r.dayLabel}` : ''
		}`;

	function handleDayChange(position: number) {
		setSelectedDay(position);
		// The open round belongs to the day being left, so it always goes. The
		// EVENT stays if it also runs on the new day: someone reading 3x3 on day A
		// who taps day B wants 3x3 on day B, not the front page.
		setSelectedRoundId('');
		const raw = detail.events.find((e: any) => e.eventId === selectedEventId);
		const stillRuns =
			raw && raw.rounds.some((r: any) => !r.dayIndex || r.dayIndex === position);
		const nextEvent = stillRuns ? selectedEventId : '';
		setSelectedEventId(nextEvent);
		history.push(
			`/zkt-competitions/${competitionId}/live${nextEvent ? `/${nextEvent}` : ''}?day=${position}`
		);
	}

	function handleEventChange(eventId: string) {
		setSelectedEventId(eventId);
		history.push(
			`/zkt-competitions/${competitionId}/live/${eventId}` +
				(isDaySplit ? `?day=${selectedDay}` : '')
		);
	}

	/**
	 * Path to a round, carrying the day. A round of a day-chain names its own
	 * day; a shared round has none, so it carries the day being viewed — without
	 * that, opening the shared final would drop the reader back to day one.
	 */
	function roundPath(eventId: string, r: any) {
		const base = `/zkt-competitions/${competitionId}/live/${eventId}/${r.roundNumber}`;
		const day = r.dayIndex || (isDaySplit ? selectedDay : 0);
		return day ? `${base}?day=${day}` : base;
	}

	function handleRoundChange(roundId: string) {
		setSelectedRoundId(roundId);
		const r = selectedEvent?.rounds.find((rr: any) => rr.roundId === roundId);
		if (r && selectedEvent) {
			history.push(roundPath(selectedEvent.eventId, r));
		}
	}

	if (detail.events.length === 0) {
		return <div className={b('empty')}>{t('no_events')}</div>;
	}

	return (
		<div className={b('live-tab')}>
			{isDaySplit && (
				<div className={b('day-filter')}>
					{compDays.map((d) => (
						<button
							key={d.position}
							className={b('day-chip', {active: selectedDay === d.position})}
							onClick={() => handleDayChange(d.position)}
						>
							{d.label}
						</button>
					))}
				</div>
			)}

			<div className={b('event-chips')}>
				{visibleEvents.map((ev: any) => (
					<button
						key={ev.eventId}
						className={b('event-chip-btn', {active: selectedEventId === ev.eventId})}
						onClick={() => handleEventChange(ev.eventId)}
					>
						<span className={`cubing-icon event-${ev.eventId}`} />
						<span>{getEventName(ev.eventId)}</span>
					</button>
				))}
			</div>

			{/* Welcome screen: no event selected */}
			{!selectedEvent && (
				<div>
					{/* Active rounds */}
					{visibleEvents.some((ev: any) =>
						roundsForDay(ev.rounds).some((r: any) => r.status === 'ACTIVE')
					) && (
						<div style={{marginBottom: '2rem'}}>
							<h3 className={b('section-title')}>
								<Broadcast weight="fill" style={{marginRight: 6, color: 'rgb(var(--primary-color))'}} />
								{t('active_rounds')}
							</h3>
							<div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
								{visibleEvents.flatMap((ev: any) =>
									roundsForDay(ev.rounds)
										.filter((r: any) => r.status === 'ACTIVE')
										.map((r: any) => (
											<button
												key={r.roundId}
												className={b('event-chip-btn', {active: true})}
												onClick={() => {
													setSelectedEventId(ev.eventId);
													history.push(roundPath(ev.eventId, r));
												}}
												style={{animation: 'zkt-pulse 1.4s ease-in-out infinite'}}
											>
												<span className={`cubing-icon event-${ev.eventId}`} />
												<span>{getEventName(ev.eventId)} {roundLabel(r)}</span>
												<span className={b('round-chip-status', {active: true})}>CANLI</span>
											</button>
										))
								)}
							</div>
						</div>
					)}

					{/* Podiums */}
					<ZktLivePodiums detail={detail} />

					{/* Tum turlar — schedule benzeri liste, her event icin round'larin
					    durumunu ozet kart olarak gosterir */}
					<div style={{marginTop: '2rem'}}>
						<h3 className={b('section-title')}>{t('all_rounds')}</h3>
						<div className={b('all-rounds-grid')}>
							{visibleEvents.map((ev: any) =>
								roundsForDay(ev.rounds).map((r: any) => (
									<button
										key={r.roundId}
										type="button"
										className={b('all-rounds-card', {[r.status.toLowerCase()]: true})}
										onClick={() => {
											setSelectedEventId(ev.eventId);
											history.push(roundPath(ev.eventId, r));
										}}
									>
										<span className={`cubing-icon event-${ev.eventId}`} style={{fontSize: 22}} />
										<div className={b('all-rounds-card-text')}>
											<span className={b('all-rounds-card-event')}>
												{getEventName(ev.eventId)}
											</span>
											<span className={b('all-rounds-card-round')}>
												{roundLabel(r)}
											</span>
										</div>
										<span className={b('round-chip-status', {[r.status.toLowerCase()]: true})}>
											{t(`round_status_${r.status.toLowerCase()}`)}
										</span>
									</button>
								))
							)}
						</div>
					</div>
				</div>
			)}

			{selectedEvent && (
				<>
					<div className={b('round-chips')}>
						{selectedEvent.rounds.map((r: any) => (
							<button
								key={r.roundId}
								className={b('round-chip', {
									active: selectedRoundId === r.roundId,
									[r.status.toLowerCase()]: true,
								})}
								onClick={() => handleRoundChange(r.roundId)}
							>
								{roundLabel(r)}
								<span className={b('round-chip-status', {[r.status.toLowerCase()]: true})}>
									{t(`round_status_${r.status.toLowerCase()}`)}
								</span>
							</button>
						))}
					</div>

					{selectedRound && (
						<>
							<div className={b('round-info-bar')}>
								{selectedRound.status === 'ACTIVE' && (
									<span className={b('live-badge')}>{t('live_badge')}</span>
								)}
								<span>{t('format')}: <strong>{formatName(selectedRound.format)}</strong></span>
								{selectedRound.timeLimitCs && (
									<span>{t('time_limit')}: {formatCs(selectedRound.timeLimitCs)}</span>
								)}
								{selectedRound.cutoffCs && (
									<span>{t('cutoff')}: {formatCs(selectedRound.cutoffCs)}</span>
								)}
								{selectedRound.advancementType && selectedRound.advancementLevel && (
									<span>
										{t('advancement')}:{' '}
										{selectedRound.advancementType === 'PERCENT'
											? `${selectedRound.advancementLevel}% · ${t('advancement_top_count', {
													n: Math.floor((results.length * selectedRound.advancementLevel) / 100),
											  })}`
											: t('advancement_top_count', {n: selectedRound.advancementLevel})}
									</span>
								)}
								<button className={b('refresh-btn')} onClick={refresh} title={t('refresh')}>
									<ArrowClockwise weight="bold" />
								</button>
							</div>

							<ResultsTable
								results={results}
								format={selectedRound.format}
								loading={loading}
								advancementType={selectedRound.advancementType}
								competitionId={competitionId}
								isFinalRound={isFinalRound}
							/>
						</>
					)}
				</>
			)}
		</div>
	);
}

const MEDALS = ['🥇', '🥈', '🥉'];

function ResultsTable({
	results,
	format,
	loading,
	advancementType,
	competitionId,
	isFinalRound,
}: {
	results: LiveResult[];
	format: string;
	loading: boolean;
	advancementType?: string | null;
	competitionId: string;
	isFinalRound?: boolean;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const isMobile = useIsMobile();
	const [modalRow, setModalRow] = useState<(ZktResultModalRow & {competitorId: string}) | null>(null);

	const attemptCount = getFormatAttempts(format);
	const hasAverage = formatHasAverage(format);

	if (loading && results.length === 0) {
		return <div className={b('empty')}>{t('loading')}</div>;
	}

	if (results.length === 0) {
		return <div className={b('empty')}>{t('no_results_yet')}</div>;
	}

	return (
		<div className={b('results-table-wrapper')}>
			{advancementType && <AdvancementLegend />}
			<table className={b('results-table', {mobile: isMobile})}>
				<thead>
					<tr>
						<th>#</th>
						<th>{t('competitor')}</th>
						{hasAverage && <th>{t('average')}</th>}
						<th>{t('best')}</th>
						{!isMobile &&
							Array.from({length: attemptCount}).map((_, i) => (
								<th key={i} className={b('attempt-col')}>
									{i + 1}
								</th>
							))}
					</tr>
				</thead>
				<tbody>
					{results.map((r) => {
						const competitorId = r.competitor.id;
						const displayName = competitorDisplayName(r.competitor) || competitorId;
						const flag = competitorFlag(r.competitor);
						const medal = isFinalRound ? MEDALS[(r.ranking || 0) - 1] || '' : '';
						const singleTag = r.recordTags?.single;
						const averageTag = r.recordTags?.average;
						const attempts = formatAttempts(r.attempts || [], attemptCount);
						const openRow = () => {
							if (isMobile) {
								setModalRow({
									title: displayName,
									ranking: r.ranking,
									best: r.best ?? undefined,
									average: r.average ?? undefined,
									attempts,
									averageRecordTag: averageTag,
									singleRecordTag: singleTag,
									competitorId,
								});
							} else {
								history.push(
									`/zkt-competitions/${competitionId}/competitors/${competitorId}`
								);
							}
						};
						return (
							<tr
								key={competitorId}
								className={b('result-row', {advancing: r.clinched, questionable: r.questionable, clickable: true})}
								onClick={openRow}
							>
								<td className={b('result-rank')}>
									{medal ? (
										<span className={b('result-medal')}>{medal}</span>
									) : (
										r.ranking ?? '-'
									)}
								</td>
								<td>
									<div className={b('result-name')}>
										{r.competitor.avatarUrl && (
											<img
												className={b('tiny-avatar')}
												src={r.competitor.avatarUrl}
												alt=""
											/>
										)}
										<span className={b('result-name-text')}>
											{flag && <span className={b('flag')}>{flag}</span>}
											{displayName}
										</span>
									</div>
								</td>
								{hasAverage && (
									<td className={b('time-cell', {nr: !!averageTag, bad: typeof r.average === 'number' && r.average < 0})}>
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
								<td className={b('time-cell', {nr: !!singleTag, bad: typeof r.best === 'number' && r.best < 0})}>
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
										<td key={i} className={b('result-attempt', {bad: a === 'DNF' || a === 'DNS'})}>
											{a}
										</td>
									))}
							</tr>
						);
					})}
				</tbody>
			</table>

			{modalRow && (
				<ZktResultModal
					row={modalRow}
					competitionId={competitionId}
					onClose={() => setModalRow(null)}
					t={t}
					showAverage={hasAverage}
				/>
			)}
		</div>
	);
}
