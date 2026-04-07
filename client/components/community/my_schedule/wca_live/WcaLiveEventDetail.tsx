import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {X, ArrowClockwise, Warning, ArrowSquareOut} from 'phosphor-react';
import {b, formatWcaTime, formatResult, formatAttempts, formatTimeAgo, countryFlag, rankingMedal, RecordTag, EventIcon} from '../shared';
import {useLiveRoundResults} from '../useLiveResults';

interface Props {
	event: any;
	competitionId: string;
	roundNumber: number | null;
	isMobile: boolean;
}

const PAGE_SIZE = 50;

export default function WcaLiveEventDetail({event, competitionId, roundNumber, isMobile}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const [modalRow, setModalRow] = useState<any | null>(null);
	const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

	const defaultRound = useMemo(() => {
		if (!event?.rounds || event.rounds.length === 0) return null;
		const active = event.rounds.find((r: any) => r.active);
		if (active) return active;
		const finishedRounds = event.rounds.filter((r: any) => r.finished);
		if (finishedRounds.length > 0) return finishedRounds[finishedRounds.length - 1];
		return event.rounds[0];
	}, [event]);

	const selectedRound = useMemo(() => {
		if (!roundNumber || !event?.rounds) return defaultRound;
		return event.rounds.find((r: any) => r.number === roundNumber) || defaultRound;
	}, [event, roundNumber, defaultRound]);

	useEffect(() => {
		if (!event?.rounds || event.rounds.length === 0) return;
		if (!roundNumber && defaultRound) {
			history.replace(`/community/competitions/${competitionId}/wca-live/${event.eventId}/${defaultRound.number}`);
		}
	}, [roundNumber, defaultRound, event?.eventId, competitionId, history, event?.rounds]);

	useEffect(() => {
		setModalRow(null);
		setVisibleCount(PAGE_SIZE);
	}, [selectedRound?.liveRoundId]);

	const liveRoundId = selectedRound?.liveRoundId || null;
	const {data: roundResults, loading, lastUpdated, lastError, refresh, isActive} = useLiveRoundResults(competitionId, liveRoundId, !!liveRoundId);

	// "Tick" — last updated metnini her 30s yenile
	const [, forceTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => forceTick((x) => x + 1), 30000);
		return () => clearInterval(id);
	}, []);

	if (!event?.rounds || event.rounds.length === 0) {
		return <div className={b('wca-live-empty')}>{t('my_schedule.wca_live_no_rounds')}</div>;
	}

	if (!selectedRound) {
		return <div className={b('wca-live-empty')}>{t('my_schedule.wca_live_no_results')}</div>;
	}

	function getRoundStatusLabel(round: any) {
		if (round.finished) return t('my_schedule.round_status_done');
		if (round.active) return t('my_schedule.round_status_live');
		if (round.open) return t('my_schedule.round_status_open');
		return t('my_schedule.round_status_upcoming');
	}

	function getRoundStatusModifier(round: any) {
		if (round.finished) return 'done';
		if (round.active) return 'live';
		if (round.open) return 'open';
		return 'upcoming';
	}

	const numAttempts = roundResults?.numberOfAttempts || selectedRound.format?.numberOfAttempts || 5;
	const sortBy = roundResults?.sortBy || selectedRound.format?.sortBy || 'best';
	const isBldEvent = ['333bf', '444bf', '555bf', '333mbf'].includes(event.eventId);
	const showAverage = numAttempts > 1 && !isBldEvent;

	function formatTimeLimitLabel(): string | null {
		if (!selectedRound.timeLimit) return null;
		const cs = selectedRound.timeLimit.centiseconds;
		if (!cs) return null;
		const cumulative = selectedRound.timeLimit.cumulativeRoundWcifIds || [];
		const time = formatWcaTime(cs);
		if (cumulative.length > 1) {
			return `${t('my_schedule.time_limit')}: ${time} (${t('my_schedule.cumulative')})`;
		}
		return `${t('my_schedule.time_limit')}: ${time}`;
	}

	function formatCutoffLabel(): string | null {
		if (!selectedRound.cutoff) return null;
		const time = formatWcaTime(selectedRound.cutoff.attemptResult);
		return `${t('my_schedule.cutoff')}: ${time} / ${selectedRound.cutoff.numberOfAttempts}`;
	}

	function formatAdvancementLabel(): string | null {
		if (!selectedRound.advancementCondition) return null;
		const {type, level} = selectedRound.advancementCondition;
		if (type === 'percent') {
			return t('my_schedule.advancement_top_percent', {level});
		}
		if (type === 'attemptResult') {
			return `${t('my_schedule.advancement')}: < ${formatWcaTime(level)}`;
		}
		return t('my_schedule.advancement_top_ranking', {level});
	}

	function handlePersonClick(personWcaId: string | null | undefined) {
		if (!personWcaId) return;
		history.push(`/community/competitions/${competitionId}/personal-bests/${personWcaId}`);
	}

	const allResults = roundResults?.results || [];
	const visibleResults = allResults.slice(0, visibleCount);
	const hasMore = allResults.length > visibleCount;
	const isFinished = selectedRound.finished;
	const showStaleBanner = lastError && lastUpdated && (lastError - lastUpdated > 0) && (Date.now() - lastError < 5 * 60 * 1000);

	return (
		<div className={b('wca-live-event-content')}>
			<div className={b('wca-live-event-header')}>
				<EventIcon eventId={event.eventId} size={28} />
				<h3 className={b('wca-live-event-title')}>
					{event.eventName}
					{selectedRound && <span className={b('wca-live-event-subtitle')}> — {selectedRound.name}</span>}
				</h3>
				<button
					className={b('wca-live-refresh-btn', {spinning: loading})}
					onClick={refresh}
					title={t('my_schedule.refresh')}
					disabled={loading}
				>
					<ArrowClockwise size={18} />
				</button>
			</div>

			{/* Round chips */}
			<div className={b('wca-live-rounds')}>
				{(event?.rounds || []).map((round: any) => {
					const isSelected = round.liveRoundId === selectedRound.liveRoundId;
					return (
						<button
							key={round.liveRoundId}
							className={b('wca-live-round-tab', {active: isSelected})}
							onClick={() => history.push(`/community/competitions/${competitionId}/wca-live/${event.eventId}/${round.number}`)}
						>
							<span className={b('wca-live-round-name')}>{round.name}</span>
							<span className={b('wca-live-status-badge', {[getRoundStatusModifier(round)]: true})}>
								{getRoundStatusLabel(round)}
							</span>
						</button>
					);
				})}
			</div>

			{/* Round info bar */}
			{(selectedRound.format || selectedRound.timeLimit || selectedRound.cutoff || selectedRound.advancementCondition) && (
				<div className={b('wca-live-round-info')}>
					{selectedRound.format && (
						<span className={b('wca-live-round-info-item')}>
							{numAttempts === 1 ? 'Bo1' : sortBy === 'average' ? `Ao${numAttempts}` : `Mo${numAttempts}`}
						</span>
					)}
					{formatTimeLimitLabel() && (
						<span className={b('wca-live-round-info-item')}>{formatTimeLimitLabel()}</span>
					)}
					{formatCutoffLabel() && (
						<span className={b('wca-live-round-info-item')}>{formatCutoffLabel()}</span>
					)}
					{formatAdvancementLabel() && (
						<span className={b('wca-live-round-info-item')}>{formatAdvancementLabel()}</span>
					)}
				</div>
			)}

			{/* Stale data banner */}
			{showStaleBanner && (
				<div className={b('wca-live-stale-banner')}>
					<Warning size={16} />
					<span>{t('my_schedule.connection_error_stale')}</span>
					<button className={b('wca-live-stale-retry')} onClick={refresh}>
						<ArrowClockwise size={14} />
					</button>
				</div>
			)}

			{/* Last updated */}
			{lastUpdated && (
				<div className={b('wca-live-last-updated')}>
					{isActive && <span className={b('wca-live-live-dot')} />}
					{formatTimeAgo(lastUpdated, t)}
				</div>
			)}

			{/* Loading skeleton */}
			{loading && !roundResults && (
				<div className={b('wca-live-skeleton')}>
					{Array.from({length: 6}).map((_, i) => (
						<div key={i} className={b('wca-live-skeleton-row')} />
					))}
				</div>
			)}

			{/* Results table */}
			{roundResults && (roundResults.results?.length || 0) > 0 && numAttempts > 0 ? (
				<>
					<div className={b('wca-live-results-wrapper')}>
						<table className={b('wca-live-results-table', {mobile: isMobile})}>
							<thead>
								<tr>
									<th className={b('wca-live-th-rank')}>#</th>
									{!isMobile && <th className={b('wca-live-th-country')}>{t('my_schedule.col_country')}</th>}
									<th className={b('wca-live-th-name')}>{t('my_schedule.col_name')}</th>
									{showAverage && <th>{t('my_schedule.col_average')}</th>}
									<th>{t('my_schedule.col_best')}</th>
									{!isMobile && Array.from({length: numAttempts}).map((_, i) => (
										<th key={i} className={b('wca-live-th-attempt')}>{i + 1}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{visibleResults.map((r: any) => {
									const attempts = formatAttempts(r.attempts || [], numAttempts, event.eventId);
									const clickable = isMobile || !!r.personWcaId;
									const medal = isFinished ? rankingMedal(r.ranking) : '';
									return (
										<tr
											key={r.personLiveId || `${r.ranking}-${r.personName}`}
											className={b('wca-live-result-row', {
												advancing: r.advancing && !r.advancingQuestionable,
												questionable: r.advancing && r.advancingQuestionable,
												clickable,
												[`rank-${r.ranking}`]: isFinished && r.ranking && r.ranking <= 3,
											})}
											onClick={() => {
												if (isMobile) {
													setModalRow({...r, attempts, numAttempts, eventId: event.eventId});
												} else if (r.personWcaId) {
													handlePersonClick(r.personWcaId);
												}
											}}
										>
											<td className={b('wca-live-rank')}>
												{medal ? <span className={b('wca-live-medal')}>{medal}</span> : (r.ranking ?? '-')}
											</td>
											{!isMobile && (
												<td className={b('wca-live-country-cell')}>
													{r.personCountryIso2 && (
														<>
															<span className={b('wca-live-flag-emoji')}>{countryFlag(r.personCountryIso2)}</span>
															<span className={b('wca-live-flag-iso')}>{r.personCountryIso2}</span>
														</>
													)}
												</td>
											)}
											<td className={b('wca-live-person')}>
												<span className={b('wca-live-person-name')}>{r.personName}</span>
											</td>
											{showAverage && (
												<td className={b('wca-live-time', {strong: true})}>
													<span className={b('wca-live-time-inner')}>
														{formatResult(r.average, event.eventId, true)}
														<RecordTag tag={r.averageRecordTag} />
													</span>
												</td>
											)}
											<td className={b('wca-live-time')}>
												<span className={b('wca-live-time-inner')}>
													{formatResult(r.best, event.eventId, false)}
													<RecordTag tag={r.singleRecordTag} />
												</span>
											</td>
											{!isMobile && attempts.map((a, i) => (
												<td key={i} className={b('wca-live-attempt')}>{a}</td>
											))}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{hasMore && (
						<button className={b('wca-live-show-more')} onClick={() => setVisibleCount((x) => x + PAGE_SIZE)}>
							{t('my_schedule.show_more', {count: Math.min(PAGE_SIZE, allResults.length - visibleCount)})}
						</button>
					)}
				</>
			) : (
				!loading && (
					<div className={b('wca-live-empty')}>{t('my_schedule.wca_live_no_results')}</div>
				)
			)}

			{/* Mobil detay modal */}
			{modalRow && (
				<ResultModal
					row={modalRow}
					competitionId={competitionId}
					onClose={() => setModalRow(null)}
					t={t}
				/>
			)}
		</div>
	);
}

function ResultModal({row, competitionId, onClose, t}: {row: any; competitionId: string; onClose: () => void; t: any}) {
	const history = useHistory();

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		document.addEventListener('keydown', onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [onClose]);

	function handleViewProfile() {
		if (!row.personWcaId) return;
		onClose();
		history.push(`/community/competitions/${competitionId}/personal-bests/${row.personWcaId}`);
	}

	return (
		<div className={b('wca-live-modal-overlay')} onClick={onClose}>
			<div className={b('wca-live-modal')} onClick={(e) => e.stopPropagation()}>
				<div className={b('wca-live-modal-header')}>
					<div>
						<div className={b('wca-live-modal-rank')}>#{row.ranking ?? '-'}</div>
						<h3 className={b('wca-live-modal-name')}>{row.personName}</h3>
					</div>
					<button className={b('wca-live-modal-close')} onClick={onClose}>
						<X size={20} />
					</button>
				</div>

				<div className={b('wca-live-modal-body')}>
					<div className={b('wca-live-modal-stat')}>
						<div className={b('wca-live-modal-stat-label')}>{t('my_schedule.col_average')}</div>
						<div className={b('wca-live-modal-stat-value')}>
							{formatResult(row.average, row.eventId, true)}
							<RecordTag tag={row.averageRecordTag} />
						</div>
					</div>
					<div className={b('wca-live-modal-stat')}>
						<div className={b('wca-live-modal-stat-label')}>{t('my_schedule.col_best')}</div>
						<div className={b('wca-live-modal-stat-value')}>
							{formatResult(row.best, row.eventId, false)}
							<RecordTag tag={row.singleRecordTag} />
						</div>
					</div>
					<div className={b('wca-live-modal-stat', {full: true})}>
						<div className={b('wca-live-modal-stat-label')}>{t('my_schedule.col_attempts')}</div>
						<div className={b('wca-live-modal-attempts')}>
							{row.attempts.map((a: string, i: number) => (
								<span key={i} className={b('wca-live-modal-attempt')}>{a}</span>
							))}
						</div>
					</div>
				</div>

				{row.personWcaId && (
					<button className={b('wca-live-modal-profile-btn')} onClick={handleViewProfile}>
						<ArrowSquareOut size={16} />
						{t('my_schedule.view_personal_records')}
					</button>
				)}
			</div>
		</div>
	);
}
