import React, {useState, useEffect} from 'react';
import {useParams, useHistory, useRouteMatch} from 'react-router-dom';
import {useSelector} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {b, getEventName, formatCs, formatName, formatHasAverage, getFormatAttempts, formatAttempts, competitorDisplayName, competitorFlag, competitorOf} from '../shared';
import {useZktLiveResults, LiveResult} from '../useZktLiveResults';
import {useIsMobile} from '../../../../util/hooks/useIsMobile';
import {ArrowClockwise, Broadcast, MonitorPlay} from 'phosphor-react';
import ZktLivePodiums from './ZktLivePodiums';
import ZktResultModal, {ZktResultModalRow} from '../ZktResultModal';

export default function ZktLiveTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const {competitionId} = useParams<{competitionId: string}>();
	const history = useHistory();
	const matchEvent = useRouteMatch<{eventId?: string; roundNumber?: string}>(
		'/community/zkt-competitions/:competitionId/live/:eventId/:roundNumber?'
	);

	const urlEventId = matchEvent?.params.eventId;
	const urlRoundNumber = matchEvent?.params.roundNumber
		? parseInt(matchEvent.params.roundNumber, 10)
		: null;

	// If no eventId in URL, show welcome screen
	const [selectedEventId, setSelectedEventId] = useState<string>(
		urlEventId
			? detail.events.find((e: any) => e.event_id === urlEventId)?.id || ''
			: ''
	);
	const selectedEvent = detail.events.find((e: any) => e.id === selectedEventId);

	const defaultRound = selectedEvent?.rounds.find((r: any) => r.status === 'ACTIVE')
		|| selectedEvent?.rounds.find((r: any) => r.status === 'FINISHED')
		|| selectedEvent?.rounds[0];
	const [selectedRoundId, setSelectedRoundId] = useState<string>(
		urlRoundNumber && selectedEvent
			? selectedEvent.rounds.find((r: any) => r.round_number === urlRoundNumber)?.id || defaultRound?.id || ''
			: defaultRound?.id || ''
	);
	const selectedRound = selectedEvent?.rounds.find((r: any) => r.id === selectedRoundId);

	useEffect(() => {
		// Reset round selection when event changes
		if (selectedEvent && !selectedEvent.rounds.some((r: any) => r.id === selectedRoundId)) {
			const d = selectedEvent.rounds[0];
			setSelectedRoundId(d?.id || '');
		}
	}, [selectedEventId, selectedEvent, selectedRoundId]);

	const {results, loading, refresh} = useZktLiveResults(competitionId, selectedRoundId);

	// Map comp_event_id -> event_id for route updates
	function handleEventChange(compEventId: string) {
		setSelectedEventId(compEventId);
		const ev = detail.events.find((e: any) => e.id === compEventId);
		if (ev) {
			history.push(`/community/zkt-competitions/${competitionId}/live/${ev.event_id}`);
		}
	}

	function handleRoundChange(roundId: string) {
		setSelectedRoundId(roundId);
		const r = selectedEvent?.rounds.find((rr: any) => rr.id === roundId);
		if (r && selectedEvent) {
			history.push(
				`/community/zkt-competitions/${competitionId}/live/${selectedEvent.event_id}/${r.round_number}`
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
						key={ev.id}
						className={b('event-chip-btn', {active: selectedEventId === ev.id})}
						onClick={() => handleEventChange(ev.id)}
					>
						<span className={`cubing-icon event-${ev.event_id}`} />
						<span>{getEventName(ev.event_id)}</span>
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
												key={r.id}
												className={b('event-chip-btn', {active: true})}
												onClick={() => {
													setSelectedEventId(ev.id);
													history.push(`/community/zkt-competitions/${competitionId}/live/${ev.event_id}/${r.round_number}`);
												}}
												style={{animation: 'zkt-pulse 1.4s ease-in-out infinite'}}
											>
												<span className={`cubing-icon event-${ev.event_id}`} />
												<span>{getEventName(ev.event_id)} {t('round_n', {n: r.round_number})}</span>
												<span className={b('round-chip-status', {active: true})}>CANLI</span>
											</button>
										))
								)}
							</div>
						</div>
					)}

					{/* Podiums */}
					<ZktLivePodiums detail={detail} />

					{/* Tüm turlar — schedule benzeri liste, schedule modeli yokken
					    her event için round'ların durumunu özet kart olarak gösterir */}
					<div style={{marginTop: '2rem'}}>
						<h3 className={b('section-title')}>{t('all_rounds')}</h3>
						<div className={b('all-rounds-grid')}>
							{detail.events.map((ev: any) =>
								ev.rounds.map((r: any) => (
									<button
										key={r.id}
										type="button"
										className={b('all-rounds-card', {[r.status.toLowerCase()]: true})}
										onClick={() => {
											setSelectedEventId(ev.id);
											history.push(
												`/community/zkt-competitions/${competitionId}/live/${ev.event_id}/${r.round_number}`
											);
										}}
									>
										<span className={`cubing-icon event-${ev.event_id}`} style={{fontSize: 22}} />
										<div className={b('all-rounds-card-text')}>
											<span className={b('all-rounds-card-event')}>
												{getEventName(ev.event_id)}
											</span>
											<span className={b('all-rounds-card-round')}>
												{t('round_n', {n: r.round_number})}
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
								key={r.id}
								className={b('round-chip', {
									active: selectedRoundId === r.id,
									[r.status.toLowerCase()]: true,
								})}
								onClick={() => handleRoundChange(r.id)}
							>
								{t('round_n', {n: r.round_number})}
								<span className={b('round-chip-status', {[r.status.toLowerCase()]: true})}>
									{t(`round_status_${r.status.toLowerCase()}`)}
								</span>
							</button>
						))}
					</div>

					{selectedRound && (
						<>
							<div className={b('round-info-bar')}>
								<span>{t('format')}: <strong>{formatName(selectedRound.format)}</strong></span>
								{selectedRound.time_limit_cs && (
									<span>{t('time_limit')}: {formatCs(selectedRound.time_limit_cs)}</span>
								)}
								{selectedRound.cutoff_cs && (
									<span>{t('cutoff')}: {formatCs(selectedRound.cutoff_cs)}</span>
								)}
								{selectedRound.advancement_type && selectedRound.advancement_level && (
									<span>
										{t('advancement')}:{' '}
										{selectedRound.advancement_type === 'PERCENT'
											? `${selectedRound.advancement_level}%`
											: `Top ${selectedRound.advancement_level}`}
									</span>
								)}
								<button className={b('refresh-btn')} onClick={refresh} title={t('refresh')}>
									<ArrowClockwise weight="bold" />
								</button>
								<button
									className={b('refresh-btn')}
									onClick={() =>
										window.open(
											`/community/zkt-competitions/${competitionId}/projector/${selectedEvent.event_id}/${selectedRound.round_number}`,
											'_blank'
										)
									}
									title={t('open_projector')}
								>
									<MonitorPlay weight="bold" />
								</button>
							</div>

							<ResultsTable
								results={results}
								format={selectedRound.format}
								loading={loading}
								roundStatus={selectedRound.status}
								eventId={selectedEvent.event_id}
								competitionId={competitionId}
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
	roundStatus,
	eventId,
	competitionId,
}: {
	results: LiveResult[];
	format: string;
	loading: boolean;
	roundStatus?: string;
	eventId: string;
	competitionId: string;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const isMobile = useIsMobile();
	const me = useSelector((state: any) => state.account.me);
	const [modalRow, setModalRow] = useState<(ZktResultModalRow & {competitorId: string}) | null>(null);

	const attemptCount = getFormatAttempts(format);
	const hasAverage = formatHasAverage(format);
	const isFinished = roundStatus === 'FINISHED';

	if (loading && results.length === 0) {
		return <div className={b('empty')}>{t('loading')}</div>;
	}

	if (results.length === 0) {
		return <div className={b('empty')}>{t('no_results_yet')}</div>;
	}

	return (
		<div className={b('results-table-wrapper')}>
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
						const competitorId = (r.user_id || r.person_id) as string;
						const displayName =
							competitorDisplayName(competitorOf(r)) || competitorId;
						const flag = competitorFlag(competitorOf(r));
						const medal = isFinished ? MEDALS[(r.ranking || 0) - 1] || '' : '';
						const isMe = !!(me && r.user_id && me.id === r.user_id);
						const attempts = formatAttempts(
							[r.attempt_1, r.attempt_2, r.attempt_3, r.attempt_4, r.attempt_5],
							attemptCount
						);
						const openRow = () => {
							if (isMobile) {
								setModalRow({
									title: displayName,
									ranking: r.ranking,
									best: r.best,
									average: r.average,
									attempts,
									averageRecordTag: r.average_record_tag,
									singleRecordTag: r.single_record_tag,
									competitorId,
								});
							} else {
								history.push(
									`/community/zkt-competitions/${competitionId}/competitors/${competitorId}`
								);
							}
						};
						return (
							<tr
								key={r.id}
								className={b('result-row', {advancing: r.proceeds, me: isMe, clickable: true})}
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
										{r.user?.profile?.pfp_image?.url && (
											<img
												className={b('tiny-avatar')}
												src={r.user.profile.pfp_image.url}
												alt=""
											/>
										)}
										<span className={b('result-name-text')}>
											{flag && <span className={b('flag')}>{flag}</span>}
											{displayName}
										</span>
										{isMe && <span className={b('me-badge')}>{t('you')}</span>}
									</div>
								</td>
								{hasAverage && (
									<td className={b('time-cell', {nr: !!r.average_record_tag})}>
										<span className={b('time-inner')}>
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
										</span>
									</td>
								)}
								<td className={b('time-cell', {nr: !!r.single_record_tag})}>
									<span className={b('time-inner')}>
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
