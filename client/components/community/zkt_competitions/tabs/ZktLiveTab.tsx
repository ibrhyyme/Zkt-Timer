import React, {useState, useEffect} from 'react';
import {useParams, useHistory, useRouteMatch} from 'react-router-dom';
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

	const urlEventId = matchEvent?.params.eventId;
	const urlRoundNumber = matchEvent?.params.roundNumber
		? parseInt(matchEvent.params.roundNumber, 10)
		: null;

	// selectedEventId is the WCA event id (e.g. "333"); "" = welcome screen.
	const [selectedEventId, setSelectedEventId] = useState<string>(
		urlEventId && detail.events.some((e: any) => e.eventId === urlEventId) ? urlEventId : ''
	);
	const selectedEvent = detail.events.find((e: any) => e.eventId === selectedEventId);

	const defaultRound =
		selectedEvent?.rounds.find((r: any) => r.status === 'ACTIVE') ||
		selectedEvent?.rounds.find((r: any) => r.status === 'FINISHED') ||
		selectedEvent?.rounds[0];
	const [selectedRoundId, setSelectedRoundId] = useState<string>(
		urlRoundNumber && selectedEvent
			? selectedEvent.rounds.find((r: any) => r.roundNumber === urlRoundNumber)?.roundId ||
					defaultRound?.roundId ||
					''
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

	// Final round = the event's last round. Medals (gold/silver/bronze) show on
	// the top 3 throughout the final round (live), regardless of status.
	const isFinalRound = !!(
		selectedRound &&
		selectedEvent &&
		selectedRound.roundNumber ===
			Math.max(...(selectedEvent.rounds || []).map((r: any) => r.roundNumber))
	);

	function handleEventChange(eventId: string) {
		setSelectedEventId(eventId);
		history.push(`/zkt-competitions/${competitionId}/live/${eventId}`);
	}

	function handleRoundChange(roundId: string) {
		setSelectedRoundId(roundId);
		const r = selectedEvent?.rounds.find((rr: any) => rr.roundId === roundId);
		if (r && selectedEvent) {
			history.push(
				`/zkt-competitions/${competitionId}/live/${selectedEvent.eventId}/${r.roundNumber}`
			);
		}
	}

	if (detail.events.length === 0) {
		return <div className={b('empty')}>{t('no_events')}</div>;
	}

	return (
		<div className={b('live-tab')}>
			<div className={b('event-chips')}>
				{detail.events.map((ev: any) => (
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
					{detail.events.some((ev: any) => ev.rounds.some((r: any) => r.status === 'ACTIVE')) && (
						<div style={{marginBottom: '2rem'}}>
							<h3 className={b('section-title')}>
								<Broadcast weight="fill" style={{marginRight: 6, color: 'rgb(var(--primary-color))'}} />
								{t('active_rounds')}
							</h3>
							<div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
								{detail.events.flatMap((ev: any) =>
									ev.rounds
										.filter((r: any) => r.status === 'ACTIVE')
										.map((r: any) => (
											<button
												key={r.roundId}
												className={b('event-chip-btn', {active: true})}
												onClick={() => {
													setSelectedEventId(ev.eventId);
													history.push(`/zkt-competitions/${competitionId}/live/${ev.eventId}/${r.roundNumber}`);
												}}
												style={{animation: 'zkt-pulse 1.4s ease-in-out infinite'}}
											>
												<span className={`cubing-icon event-${ev.eventId}`} />
												<span>{getEventName(ev.eventId)} {t('round_n', {n: r.roundNumber})}</span>
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
							{detail.events.map((ev: any) =>
								ev.rounds.map((r: any) => (
									<button
										key={r.roundId}
										type="button"
										className={b('all-rounds-card', {[r.status.toLowerCase()]: true})}
										onClick={() => {
											setSelectedEventId(ev.eventId);
											history.push(
												`/zkt-competitions/${competitionId}/live/${ev.eventId}/${r.roundNumber}`
											);
										}}
									>
										<span className={`cubing-icon event-${ev.eventId}`} style={{fontSize: 22}} />
										<div className={b('all-rounds-card-text')}>
											<span className={b('all-rounds-card-event')}>
												{getEventName(ev.eventId)}
											</span>
											<span className={b('all-rounds-card-round')}>
												{t('round_n', {n: r.roundNumber})}
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
								{t('round_n', {n: r.roundNumber})}
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
