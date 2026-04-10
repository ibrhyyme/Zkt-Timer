import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {ArrowLeft, ArrowClockwise, Warning, Info} from 'phosphor-react';
import {b, formatResult, formatAttempts, formatTimeAgo, countryFlag, EventIcon, RecordTag} from '../shared';
import {useCompetitionData} from '../CompetitionLoader';
import {useCompetitorLiveResults} from '../useLiveResults';
import {useIsMobile} from '../../../../util/hooks/useIsMobile';
import ResultModal, {ResultModalRow} from './ResultModal';

interface Props {
	registrantId: number;
}

const BLD_EVENTS = ['333bf', '444bf', '555bf', '333mbf'];

export default function CompetitorLiveResults({registrantId}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const {detail} = useCompetitionData();
	const isMobile = useIsMobile();
	const [modalRow, setModalRow] = useState<ResultModalRow | null>(null);

	const selected = useMemo(() => {
		return detail?.competitors?.find((c: any) => c.registrantId === registrantId) || null;
	}, [detail, registrantId]);

	const liveCompetitor = useMemo(() => {
		if (!detail?.wcaLiveCompetitors) return null;
		if (selected?.wcaId) {
			const byWcaId = detail.wcaLiveCompetitors.find((c: any) => c.wcaId === selected.wcaId);
			if (byWcaId) return byWcaId;
		}
		if (selected?.name) {
			return detail.wcaLiveCompetitors.find((c: any) => c.name === selected.name) || null;
		}
		return null;
	}, [detail, selected]);

	const competitionId: string = detail?.competitionId || '';
	const personLiveId = liveCompetitor?.liveId || null;

	const {data, loading, lastUpdated, lastError, refresh} = useCompetitorLiveResults(
		competitionId,
		personLiveId,
		!!personLiveId && !!competitionId
	);

	// "Tick" — last updated metnini her 30s yenile
	const [, forceTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => forceTick((x) => x + 1), 30000);
		return () => clearInterval(id);
	}, []);

	// Sonuclari event ID'ye gore grupla
	const eventGroups = useMemo(() => {
		if (!data?.results) return [];
		const groups = new Map<string, {eventId: string; eventName: string; entries: any[]}>();
		for (const r of data.results) {
			if (!groups.has(r.eventId)) {
				groups.set(r.eventId, {eventId: r.eventId, eventName: r.eventName, entries: []});
			}
			groups.get(r.eventId)!.entries.push(r);
		}
		return Array.from(groups.values());
	}, [data]);

	if (!selected) {
		return (
			<div className={b('info-banner')}>
				<Info size={20} />
				<span>{t('my_schedule.competitor_not_found')}</span>
			</div>
		);
	}

	if (!liveCompetitor) {
		return (
			<div className={b('competitor-detail')}>
				<button className={b('back-sm')} onClick={() => history.goBack()}>
					<ArrowLeft size={16} />
					{t('my_schedule.back_to_competitor')}
				</button>
				<div className={b('info-banner')}>
					<Info size={20} />
					<span>{t('my_schedule.no_competitor_results')}</span>
				</div>
			</div>
		);
	}

	const showStaleBanner = lastError && lastUpdated && (lastError - lastUpdated > 0) && (Date.now() - lastError < 5 * 60 * 1000);

	function showAverage(eventId: string, numAttempts: number): boolean {
		return numAttempts > 1 && !BLD_EVENTS.includes(eventId);
	}

	function handleRowClick(entry: any) {
		const numAttempts = entry.format?.numberOfAttempts || (entry.attempts?.length || 0);
		const formattedAttempts = formatAttempts(entry.attempts || [], numAttempts, entry.eventId);
		setModalRow({
			title: `${entry.eventName} — ${entry.roundName}`,
			ranking: entry.ranking,
			best: entry.best,
			average: entry.average,
			attempts: formattedAttempts,
			eventId: entry.eventId,
			averageRecordTag: entry.averageRecordTag,
			singleRecordTag: entry.singleRecordTag,
			personWcaId: null, // Kendisi zaten — profile butonu gerekmez
		});
	}

	return (
		<div className={b('competitor-detail')}>
			<button className={b('back-sm')} onClick={() => history.goBack()}>
				<ArrowLeft size={16} />
				{t('my_schedule.back_to_competitor')}
			</button>

			{/* Header */}
			<div className={b('competitor-results-header')}>
				<div className={b('competitor-results-title-row')}>
					<h3 className={b('competitor-results-title')}>
						{data?.personCountryIso2 && (
							<span className={b('competitor-flag')}>{countryFlag(data.personCountryIso2)} </span>
						)}
						{data?.personName || selected.name}
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
				{(data?.personWcaId || selected.wcaId) && (
					<div className={b('competitor-results-subtitle')}>
						{data?.personWcaId || selected.wcaId}
					</div>
				)}
			</div>

			{/* Disclaimer */}
			<div className={b('disclaimer')}>
				<Warning size={16} />
				<span>{t('my_schedule.results_disclaimer')}</span>
			</div>

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
					{formatTimeAgo(lastUpdated, t)}
				</div>
			)}

			{/* Loading skeleton */}
			{loading && !data && (
				<div className={b('wca-live-skeleton')}>
					{Array.from({length: 6}).map((_, i) => (
						<div key={i} className={b('wca-live-skeleton-row')} />
					))}
				</div>
			)}

			{/* Empty state */}
			{!loading && data && eventGroups.length === 0 && (
				<div className={b('wca-live-empty')}>{t('my_schedule.no_competitor_results')}</div>
			)}

			{/* Error state */}
			{!loading && !data && lastError && (
				<div className={b('wca-live-empty')}>{t('my_schedule.results_error')}</div>
			)}

			{/* Event-based grouped results */}
			{eventGroups.map((group) => {
				// Bu event'in maks attempt sayisi (round'lar farkli olabilir)
				const maxAttempts = group.entries.reduce((max: number, e: any) => {
					const n = e.format?.numberOfAttempts || (e.attempts?.length || 0);
					return n > max ? n : max;
				}, 0);
				const showAvgCol = showAverage(group.eventId, maxAttempts);

				return (
					<div key={group.eventId} className={b('competitor-results-event')}>
						<div className={b('competitor-results-event-header')}>
							<EventIcon eventId={group.eventId} size={22} />
							<h4 className={b('competitor-results-event-name')}>{group.eventName}</h4>
						</div>

						<div className={b('wca-live-results-wrapper')}>
							<table className={b('wca-live-results-table', {mobile: isMobile})}>
								<thead>
									<tr>
										<th className={b('wca-live-th-name')}>{t('my_schedule.col_round')}</th>
										<th className={b('wca-live-th-rank')}>#</th>
										{showAvgCol && <th>{t('my_schedule.col_average')}</th>}
										<th>{t('my_schedule.col_best')}</th>
										{!isMobile && Array.from({length: maxAttempts}).map((_, i) => (
											<th key={i} className={b('wca-live-th-attempt')}>{i + 1}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{group.entries.map((entry: any) => {
										const numAttempts = entry.format?.numberOfAttempts || maxAttempts;
										const attempts = formatAttempts(entry.attempts || [], numAttempts, entry.eventId);
										return (
											<tr
												key={`${entry.eventId}-${entry.roundNumber}`}
												className={b('wca-live-result-row', {
													advancing: entry.advancing && !entry.advancingQuestionable,
													questionable: entry.advancing && entry.advancingQuestionable,
													clickable: isMobile,
												})}
												onClick={() => {
													if (isMobile) handleRowClick(entry);
												}}
											>
												<td className={b('wca-live-person')}>
													<span className={b('wca-live-person-name')}>{entry.roundName}</span>
												</td>
												<td className={b('wca-live-rank')}>{entry.ranking ?? '-'}</td>
												{showAvgCol && (
													<td className={b('wca-live-time', {strong: true})}>
														<span className={b('wca-live-time-inner')}>
															{formatResult(entry.average, entry.eventId, true)}
															<RecordTag tag={entry.averageRecordTag} />
														</span>
													</td>
												)}
												<td className={b('wca-live-time')}>
													<span className={b('wca-live-time-inner')}>
														{formatResult(entry.best, entry.eventId, false)}
														<RecordTag tag={entry.singleRecordTag} />
													</span>
												</td>
												{!isMobile && Array.from({length: maxAttempts}).map((_, i) => (
													<td key={i} className={b('wca-live-attempt')}>{attempts[i] || ''}</td>
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

			{/* Mobil detay modal */}
			{modalRow && (
				<ResultModal
					row={modalRow}
					competitionId={competitionId}
					onClose={() => setModalRow(null)}
					t={t}
					showAverage={showAverage(modalRow.eventId, modalRow.attempts.length)}
					showViewProfile={false}
				/>
			)}
		</div>
	);
}
