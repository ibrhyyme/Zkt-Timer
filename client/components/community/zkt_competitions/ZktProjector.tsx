import React, {useEffect, useMemo, useRef, useState} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import {Pause, Play, X, ChartLineUp} from 'phosphor-react';
import {
	b,
	formatCs,
	getEventName,
	getFormatAttempts,
	formatHasAverage,
	competitorDisplayName,
	competitorFlag,
	competitorOf,
} from './shared';
import {useZktLiveResults} from './useZktLiveResults';
import {
	forecastResults,
	NA_VALUE,
	SUCCESS_VALUE,
	SKIPPED_VALUE,
	isSkipped,
} from './forecast';

const PROJECTOR_QUERY = gql`
	query ZktProjectorComp($id: String!) {
		zktCompetition(id: $id) {
			id
			name
			events {
				id
				event_id
				rounds {
					id
					round_number
					format
					status
					advancement_type
					advancement_level
				}
			}
		}
	}
`;

// Status machine ported 1:1 from wca-live ResultsProjector.jsx:
// SHOWING (rows fade in, staggered) → SHOWN (hold) → HIDING (fade out) →
// advance page → SHOWING ... PAUSED freezes the cycle.
type ProjectorStatus = 'showing' | 'shown' | 'hiding' | 'paused';

const DURATION = {
	SHOWN: 10 * 1000,
	FORECAST_SHOWN: 20 * 1000,
	SHOWING: 1000,
	HIDING: 1000,
};

/* (window height - toolbar - table header) / row height — wca-live formula. */
function getNumberOfRows(): number {
	if (typeof window === 'undefined') return 10;
	return Math.max(3, Math.floor((window.innerHeight - 72 - 52) / 58));
}

// Forecast cells can hold the wca-live sentinels: N/A and "any success works".
function formatForecastCs(v: number): string {
	if (v === NA_VALUE) return 'N/A';
	if (v === SUCCESS_VALUE) return '✓';
	if (v === SKIPPED_VALUE) return '';
	return formatCs(v);
}

interface DisplayRow {
	id: string;
	user: any;
	ranking: number | null;
	original: any;
	advancing: boolean;
	projected?: number;
	forFirst?: number;
	forAdvance?: number;
	bpa?: number;
	wpa?: number;
}

export default function ZktProjector() {
	const {competitionId, eventId, roundNumber} = useParams<{
		competitionId: string;
		eventId: string;
		roundNumber: string;
	}>();
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const [detail, setDetail] = useState<any>(null);
	const [status, setStatus] = useState<ProjectorStatus>('showing');
	const [topResultIndex, setTopResultIndex] = useState(0);
	const [forecast, setForecast] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res: any = await gqlMutate(PROJECTOR_QUERY, {id: competitionId});
				if (!cancelled) setDetail(res?.data?.zktCompetition || null);
			} catch {
				// leave detail null — empty state below
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [competitionId]);

	const compEvent = useMemo(
		() => detail?.events?.find((ev: any) => ev.event_id === eventId) || null,
		[detail, eventId]
	);
	const round = useMemo(
		() =>
			compEvent?.rounds?.find((r: any) => r.round_number === parseInt(roundNumber, 10)) ||
			null,
		[compEvent, roundNumber]
	);

	const {results} = useZktLiveResults(competitionId, round?.id || null);

	const attemptCount = round ? getFormatAttempts(round.format) : 5;
	const hasAverage = round ? formatHasAverage(round.format) : true;

	// wca-live forecastViewSupported: average-sorted formats, unfinished round,
	// final round or ranking-based advancement only.
	const forecastSupported =
		!!round &&
		hasAverage &&
		round.status !== 'FINISHED' &&
		(!round.advancement_type || round.advancement_type === 'RANKING');
	const forecastActive = forecast && forecastSupported;

	// Only rows with at least one attempt, ranking order (wca-live nonemptyResults).
	const nonempty = useMemo(() => {
		const filled = (results || []).filter((r: any) =>
			[r.attempt_1, r.attempt_2, r.attempt_3, r.attempt_4, r.attempt_5]
				.slice(0, attemptCount)
				.some((a: any) => a !== null && a !== undefined)
		);
		return filled
			.slice()
			.sort(
				(a: any, bx: any) =>
					(a.ranking ?? Number.MAX_SAFE_INTEGER) - (bx.ranking ?? Number.MAX_SAFE_INTEGER)
			);
	}, [results, attemptCount]);

	// Green highlight for advancing competitors: confirmed (proceeds) or within
	// the advancement condition while the round is live.
	const advancingCount = useMemo(() => {
		if (!round?.advancement_type) return 0;
		if (round.advancement_type === 'RANKING') return round.advancement_level || 0;
		if (round.advancement_type === 'PERCENT') {
			return Math.floor(((round.advancement_level || 0) / 100) * nonempty.length);
		}
		return 0;
	}, [round, nonempty.length]);

	const displayRows: DisplayRow[] = useMemo(() => {
		if (forecastActive) {
			const level =
				round?.advancement_type === 'RANKING' ? round.advancement_level || null : null;
			return forecastResults(nonempty, attemptCount, level).map((f) => ({
				id: f.id,
				user: f.original.user,
				ranking: f.ranking,
				original: f.original,
				advancing: f.advancing,
				projected: f.projectedAverage,
				forFirst: f.forFirst,
				forAdvance: f.forAdvance,
				bpa: f.bestPossibleAverage,
				wpa: f.worstPossibleAverage,
			}));
		}
		return nonempty.map((r: any) => ({
			id: r.id,
			user: r.user,
			ranking: r.ranking ?? null,
			original: r,
			advancing:
				r.proceeds ||
				(advancingCount > 0 && r.ranking != null && r.ranking <= advancingCount),
		}));
	}, [forecastActive, nonempty, attemptCount, round, advancingCount]);

	const displayRowsRef = useRef(displayRows);
	useEffect(() => {
		displayRowsRef.current = displayRows;
	});
	const forecastRef = useRef(forecastActive);
	useEffect(() => {
		forecastRef.current = forecastActive;
	});

	// wca-live status machine, verbatim timing (forecast pages hold longer).
	useEffect(() => {
		const list = displayRowsRef.current;
		if (status === 'paused') return;
		if (status === 'shown') {
			if (list.length > getNumberOfRows()) {
				const timeout = setTimeout(
					() => setStatus('hiding'),
					forecastRef.current ? DURATION.FORECAST_SHOWN : DURATION.SHOWN
				);
				return () => clearTimeout(timeout);
			}
			return;
		}
		if (status === 'showing') {
			const timeout = setTimeout(() => setStatus('shown'), DURATION.SHOWING);
			return () => clearTimeout(timeout);
		}
		if (status === 'hiding') {
			const timeout = setTimeout(() => {
				setStatus('showing');
				setTopResultIndex((top) => {
					const list = displayRowsRef.current;
					const next = top + getNumberOfRows();
					// In forecast mode the focus is on advancing rows — show a single
					// page of non-advancing results, then roll back to page one.
					if (
						next > list.length ||
						(forecastRef.current &&
							list[top] &&
							!list[top].advancing &&
							list[next] &&
							!list[next].advancing)
					) {
						return 0;
					}
					return next;
				});
			}, DURATION.HIDING);
			return () => clearTimeout(timeout);
		}
	}, [status]);

	const rowsVisible = status === 'showing' || status === 'shown' || status === 'paused';
	const pageRows = displayRows.slice(topResultIndex, topResultIndex + getNumberOfRows());

	const advancementLevelLabel =
		round?.advancement_type === 'RANKING' && round.advancement_level
			? round.advancement_level
			: 3;

	const title = detail
		? `${getEventName(eventId)} — ${t('round_n', {n: roundNumber})}`
		: '';

	function exit() {
		history.push(`/community/zkt-competitions/${competitionId}/live/${eventId}/${roundNumber}`);
	}

	return (
		<div className={b('projector')}>
			<div className={b('projector-bar')}>
				<div className={b('projector-title')}>
					<span className={b('projector-comp')}>{detail?.name}</span>
					<span>{title}</span>
				</div>
				<div className={b('projector-actions')}>
					{forecastSupported && (
						<button
							type="button"
							className={b('projector-btn', {active: forecastActive})}
							onClick={() => {
								setForecast((v) => !v);
								setTopResultIndex(0);
								setStatus('showing');
							}}
							title={t('forecast_view')}
						>
							<ChartLineUp weight="bold" size={26} />
						</button>
					)}
					{status === 'paused' ? (
						<button
							type="button"
							className={b('projector-btn')}
							onClick={() => setStatus('hiding')}
							title={t('projector_play')}
						>
							<Play weight="fill" size={26} />
						</button>
					) : (
						<button
							type="button"
							className={b('projector-btn')}
							onClick={() => setStatus('paused')}
							title={t('projector_pause')}
						>
							<Pause weight="fill" size={26} />
						</button>
					)}
					<button type="button" className={b('projector-btn')} onClick={exit} title={t('back')}>
						<X weight="bold" size={26} />
					</button>
				</div>
			</div>

			{!round ? (
				<div className={b('projector-empty')}>{t('not_found')}</div>
			) : displayRows.length === 0 ? (
				<div className={b('projector-empty')}>{t('no_results_yet')}</div>
			) : (
				<table className={b('projector-table')}>
					<thead>
						<tr>
							<th className={b('projector-rank-col')}>#</th>
							<th className={b('projector-name-col')}>{t('col_name')}</th>
							{Array.from({length: attemptCount}).map((_, i) => (
								<th key={i}>{i + 1}</th>
							))}
							<th>{t('best')}</th>
							{hasAverage && <th>{forecastActive ? t('forecast_projected') : t('average')}</th>}
							{forecastActive && <th>{t('forecast_for_first')}</th>}
							{forecastActive && (
								<th>{t('forecast_for_advance', {n: advancementLevelLabel})}</th>
							)}
							{forecastActive && attemptCount === 5 && <th>BPA</th>}
							{forecastActive && attemptCount === 5 && <th>WPA</th>}
						</tr>
					</thead>
					<tbody>
						{pageRows.map((row, index) => {
							const r = row.original;
							return (
								<tr
									key={row.id}
									className={b('projector-row', {visible: rowsVisible})}
									style={
										status === 'showing'
											? {transitionDelay: `${index * (forecastActive ? 50 : 150)}ms`}
											: {transitionDelay: '0ms'}
									}
								>
									<td className={b('projector-rank', {advancing: row.advancing})}>
										{row.ranking ?? '-'}
									</td>
									<td className={b('projector-name')}>
										{competitorFlag(competitorOf(row.original)) ? competitorFlag(competitorOf(row.original)) + ' ' : ''}
										{competitorDisplayName(competitorOf(row.original)) || row.original?.user_id || row.original?.person_id}
									</td>
									{Array.from({length: attemptCount}).map((_, i) => (
										<td key={i} className={b('projector-time')}>
											{formatCs(r[`attempt_${i + 1}`])}
										</td>
									))}
									<td className={b('projector-time', {bold: true})}>
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
									{hasAverage && (
										<td className={b('projector-time')}>
											{forecastActive ? (
												isSkipped(row.projected ?? SKIPPED_VALUE) ? (
													''
												) : (
													formatCs(row.projected)
												)
											) : (
												<>
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
												</>
											)}
										</td>
									)}
									{forecastActive && (
										<td className={b('projector-time')}>
											{formatForecastCs(row.forFirst ?? SKIPPED_VALUE)}
										</td>
									)}
									{forecastActive && (
										<td className={b('projector-time')}>
											{formatForecastCs(row.forAdvance ?? SKIPPED_VALUE)}
										</td>
									)}
									{forecastActive && attemptCount === 5 && (
										<td className={b('projector-time')}>
											{formatForecastCs(row.bpa ?? SKIPPED_VALUE)}
										</td>
									)}
									{forecastActive && attemptCount === 5 && (
										<td className={b('projector-time')}>
											{formatForecastCs(row.wpa ?? SKIPPED_VALUE)}
										</td>
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}
