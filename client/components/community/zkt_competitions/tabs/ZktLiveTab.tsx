import React, {useState, useEffect} from 'react';
import {useParams, useHistory, useRouteMatch} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {b, getEventName, formatCs, formatName, formatHasAverage, getFormatAttempts} from '../shared';
import {useZktLiveResults, LiveResult} from '../useZktLiveResults';
import {ArrowClockwise, Broadcast} from 'phosphor-react';
import ZktLivePodiums from './ZktLivePodiums';

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

	// URL'de eventId yoksa welcome screen goster
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
					<ZktLivePodiums detail={detail} results={new Map()} />

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
							</div>

							<ResultsTable
								results={results}
								format={selectedRound.format}
								loading={loading}
							/>
						</>
					)}
				</>
			)}
		</div>
	);
}

function ResultsTable({
	results,
	format,
	loading,
}: {
	results: LiveResult[];
	format: string;
	loading: boolean;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
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
			<table className={b('results-table')}>
				<thead>
					<tr>
						<th>#</th>
						<th>{t('competitor')}</th>
						{hasAverage && <th>{t('average')}</th>}
						<th>{t('best')}</th>
						{Array.from({length: attemptCount}).map((_, i) => (
							<th key={i} className={b('attempt-col')}>
								{i + 1}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{results.map((r) => (
						<tr
							key={r.id}
							className={b('result-row', {proceeds: r.proceeds})}
						>
							<td>{r.ranking ?? '-'}</td>
							<td>
								<div className={b('result-name')}>
									{r.user?.profile?.pfp_image?.url && (
										<img
											className={b('tiny-avatar')}
											src={r.user.profile.pfp_image.url}
											alt=""
										/>
									)}
									<span>{r.user?.username || r.user_id}</span>
								</div>
							</td>
							{hasAverage && (
								<td className={b('time-cell', {nr: !!r.average_record_tag})}>
									{formatCs(r.average)}
									{r.average_record_tag && (
										<span className={b('record-tag')}>{r.average_record_tag}</span>
									)}
								</td>
							)}
							<td className={b('time-cell', {nr: !!r.single_record_tag})}>
								{formatCs(r.best)}
								{r.single_record_tag && (
									<span className={b('record-tag')}>{r.single_record_tag}</span>
								)}
							</td>
							{Array.from({length: attemptCount}).map((_, i) => {
								const val = (r as any)[`attempt_${i + 1}`];
								return <td key={i}>{formatCs(val)}</td>;
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
