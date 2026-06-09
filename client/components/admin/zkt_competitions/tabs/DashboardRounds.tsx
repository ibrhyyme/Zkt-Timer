import React from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {
	b,
	getEventName,
	ZKT_ROUND_FORMATS,
	formatCs,
	getFormatAttempts,
	formatHasAverage,
	competitorDisplayName,
} from '../shared';
import {Plus, Minus, FilePdf, ArrowsClockwise, Table, IdentificationCard, MonitorPlay} from 'phosphor-react';
import EditTimeLimitModal from '../modals/EditTimeLimitModal';
import EditCutoffModal from '../modals/EditCutoffModal';
import EditAdvancementModal from '../modals/EditAdvancementModal';
import {generateScramblePdf} from '../../../../util/cubes/scramble_pdf';
import {generateResultsPdf} from '../../../../util/cubes/results_pdf';
import {generateScorecardsPdf} from '../../../../util/cubes/scorecard_pdf';

const CREATE_ROUND = gql`
	mutation CreateZktRound($input: CreateZktRoundInput!) {
		createZktRound(input: $input) {
			id
		}
	}
`;

const UPDATE_ROUND = gql`
	mutation UpdateZktRound($input: UpdateZktRoundInput!) {
		updateZktRound(input: $input) {
			id
		}
	}
`;

const DELETE_ROUND = gql`
	mutation DeleteZktRound($roundId: String!) {
		deleteZktRound(roundId: $roundId)
	}
`;

const UPDATE_ROUND_STATUS = gql`
	mutation UpdateZktRoundStatus($input: UpdateZktRoundStatusInput!) {
		updateZktRoundStatus(input: $input) {
			id
			status
		}
	}
`;

const REOPEN_ROUND = gql`
	mutation ReopenZktRoundInline($roundId: String!) {
		reopenZktRound(roundId: $roundId) {
			id
			status
		}
	}
`;

const ROUND_RESULTS_FOR_PDF = gql`
	query ZktRoundResultsForPdf($roundId: String!) {
		zktRoundResults(roundId: $roundId) {
			ranking
			attempt_1
			attempt_2
			attempt_3
			attempt_4
			attempt_5
			best
			average
			user {
				username
				first_name
				last_name
				join_country
			}
		}
	}
`;

const ROUND_SCRAMBLES = gql`
	query ZktRoundScramblesForPdf($roundId: String!) {
		zktRoundScrambles(roundId: $roundId) {
			id
			attempt_number
			is_extra
			scramble_string
		}
	}
`;

const ENSURE_SCRAMBLES = gql`
	mutation EnsureZktScramblesForPdf($roundId: String!) {
		ensureZktScrambles(roundId: $roundId) {
			id
			attempt_number
			is_extra
			scramble_string
		}
	}
`;

const REGENERATE_SCRAMBLES = gql`
	mutation RegenerateZktScramblesForPdf($roundId: String!) {
		regenerateZktScrambles(roundId: $roundId) {
			id
			attempt_number
			is_extra
			scramble_string
		}
	}
`;

export default function DashboardRounds({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	async function addRound(compEvent: any) {
		const nextNumber = (compEvent.rounds.length || 0) + 1;
		try {
			await gqlMutate(CREATE_ROUND, {
				input: {compEventId: compEvent.id, roundNumber: nextNumber, format: 'AO5'},
			});
			toastSuccess(t('round_added'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function removeLastRound(compEvent: any) {
		const lastRound = compEvent.rounds[compEvent.rounds.length - 1];
		if (!lastRound) return;
		try {
			await gqlMutate(DELETE_ROUND, {roundId: lastRound.id});
			toastSuccess(t('round_deleted'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function updateRound(roundId: string, patch: Record<string, any>) {
		try {
			await gqlMutate(UPDATE_ROUND, {input: {roundId, ...patch}});
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function setStatus(roundId: string, status: string) {
		try {
			await gqlMutate(UPDATE_ROUND_STATUS, {input: {roundId, status}});
			toastSuccess(t('status_updated'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	// Reopen a finalized round (FINISHED -> ACTIVE). Untouched advancement carry
	// rows in the next round are revoked server-side; admin re-finalizes to recompute.
	async function reopenRound(roundId: string) {
		if (!window.confirm(t('reopen_round_confirm'))) return;
		try {
			await gqlMutate(REOPEN_ROUND, {roundId});
			toastSuccess(t('round_reopened'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function downloadScramblePdf(eventId: string, round: any) {
		try {
			// Lazy-ensure: server creates scrambles on first view if absent.
			await gqlMutate(ENSURE_SCRAMBLES, {roundId: round.id});
			const res: any = await gqlMutate(ROUND_SCRAMBLES, {roundId: round.id});
			const scrambles = (res?.data?.zktRoundScrambles || [])
				.slice()
				.sort((a: any, bx: any) => a.attempt_number - bx.attempt_number);
			if (scrambles.length === 0) {
				toastError(t('no_scrambles'));
				return;
			}
			generateScramblePdf({
				competitionName: detail.name,
				eventName: getEventName(eventId),
				eventId,
				roundNumber: round.round_number,
				scrambles: scrambles.map((s: any) => ({
					attemptNumber: s.attempt_number,
					isExtra: s.is_extra,
					scrambleString: s.scramble_string,
				})),
			});
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function downloadResultsPdf(eventId: string, round: any) {
		try {
			const res: any = await gqlMutate(ROUND_RESULTS_FOR_PDF, {roundId: round.id});
			const results = (res?.data?.zktRoundResults || []).filter(
				(r: any) => r.best !== null && r.best !== undefined
			);
			if (results.length === 0) {
				toastError(t('no_results_to_export'));
				return;
			}
			const attemptCount = getFormatAttempts(round.format);
			const hasAverage = formatHasAverage(round.format);
			const sorted = results
				.slice()
				.sort(
					(a: any, bx: any) =>
						(a.ranking ?? Number.MAX_SAFE_INTEGER) - (bx.ranking ?? Number.MAX_SAFE_INTEGER)
				);
			generateResultsPdf({
				competitionName: detail.name,
				eventName: getEventName(eventId),
				roundNumber: round.round_number,
				attemptCount,
				hasAverage,
				rows: sorted.map((r: any) => ({
					rank: r.ranking != null ? String(r.ranking) : '-',
					name: competitorDisplayName(r.user),
					country: r.user?.join_country || '',
					attempts: Array.from({length: attemptCount}).map((_, i) =>
						formatCs(r[`attempt_${i + 1}`])
					),
					best: formatCs(r.best),
					average: hasAverage ? formatCs(r.average) : '',
				})),
			});
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function regenerateScrambles(round: any) {
		if (!window.confirm(t('regenerate_scrambles_confirm'))) return;
		try {
			await gqlMutate(REGENERATE_SCRAMBLES, {roundId: round.id});
			toastSuccess(t('scrambles_regenerated'));
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	// WCA scorecards: one per competitor registered for this event (APPROVED),
	// name-sorted and seat-numbered. Scrambles are intentionally excluded — they
	// print separately. Empty result/signature cells are filled by hand on site.
	function downloadScorecards(ev: any, round: any) {
		const names: string[] = (detail.registrations || [])
			.filter(
				(r: any) =>
					r.status === 'APPROVED' &&
					(r.events || []).some((e: any) => e.comp_event_id === ev.id)
			)
			.map((r: any) => competitorDisplayName(r.user) || r.user?.username || r.user_id)
			.sort((a: string, bx: string) => a.localeCompare(bx));

		const entries = names.map((name, i) => ({registrantId: i + 1, name}));

		generateScorecardsPdf({
			competitionName: detail.name,
			eventName: getEventName(ev.event_id),
			eventId: ev.event_id,
			roundNumber: round.round_number,
			attemptCount: getFormatAttempts(round.format),
			cutoff: round.cutoff_cs ? formatCs(round.cutoff_cs) : '',
			timeLimit: round.time_limit_cs ? formatCs(round.time_limit_cs) : '',
			entries,
		});
	}

	return (
		<div className={b('event-card-grid')}>
			{detail.events.map((ev: any) => (
				<div key={ev.id} className={b('event-pane')}>
					<div className={b('event-pane-header')}>
						<div className={b('event-pane-title')}>
							<span className={`cubing-icon event-${ev.event_id}`} />
							<span>{getEventName(ev.event_id)}</span>
						</div>
						<div className={b('event-pane-actions')}>
							<button
								className={b('round-count-btn')}
								onClick={() => removeLastRound(ev)}
								disabled={ev.rounds.length === 0}
								title={t('remove_round')}
							>
								<Minus weight="bold" />
							</button>
							<span style={{padding: '0 0.4rem', fontSize: 13, fontWeight: 600}}>
								{ev.rounds.length}
							</span>
							<button
								className={b('round-count-btn')}
								onClick={() => addRound(ev)}
								title={t('add_round')}
							>
								<Plus weight="bold" />
							</button>
						</div>
					</div>

					{ev.rounds.length === 0 ? (
						<div className={b('empty')}>{t('no_rounds')}</div>
					) : (
						ev.rounds.map((round: any) => (
							<div key={round.id} className={b('round-row-card')}>
								<div className={b('round-row-title')}>
									<span>{t('round_n', {n: round.round_number})}</span>
									<span className={b('round-status', {[round.status.toLowerCase()]: true})}>
										{t(`round_status_${round.status.toLowerCase()}`)}
									</span>
									<div style={{marginLeft: 'auto', display: 'flex', gap: '0.35rem'}}>
											{(round.status === 'OPEN' || round.status === 'ACTIVE' || round.status === 'FINISHED') && (
												<button
													type="button"
													className={b('scramble-action-btn')}
													onClick={() =>
														window.open(
															`/community/zkt-competitions/${detail.id}/projector/${ev.event_id}/${round.round_number}`,
															'_blank'
														)
													}
													title={t('open_projector')}
												>
													<MonitorPlay weight="bold" /> {t('projector')}
												</button>
											)}
											<button
												type="button"
												className={b('scramble-action-btn')}
												onClick={() => downloadScorecards(ev, round)}
												title={t('download_scorecards')}
											>
												<IdentificationCard weight="bold" /> {t('scorecards')}
											</button>
											{(round.status === 'ACTIVE' || round.status === 'FINISHED') && (
												<button
													type="button"
													className={b('scramble-action-btn')}
													onClick={() => downloadResultsPdf(ev.event_id, round)}
													title={t('download_results_pdf')}
												>
													<Table weight="bold" /> {t('results_pdf')}
												</button>
											)}
										<button
											type="button"
											className={b('scramble-action-btn')}
											onClick={() => downloadScramblePdf(ev.event_id, round)}
											title={t('download_scramble_pdf')}
										>
											<FilePdf weight="bold" /> {t('scramble_pdf')}
										</button>
										<button
											type="button"
											className={b('scramble-action-btn', {ghost: true})}
											onClick={() => regenerateScrambles(round)}
											title={t('regenerate_scrambles_hint')}
										>
											<ArrowsClockwise weight="bold" />
										</button>
									</div>
								</div>

								<div className={b('round-row-fields')}>
									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('format')}</span>
										<select
											className={b('round-field-btn')}
											value={round.format}
											onChange={(e) => updateRound(round.id, {format: e.target.value})}
										>
											{ZKT_ROUND_FORMATS.map((f) => (
												<option key={f.id} value={f.id}>
													{f.name}
												</option>
											))}
										</select>
									</div>

									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('time_limit')}</span>
										<EditTimeLimitModal
											value={round.time_limit_cs}
											onChange={(cs) => updateRound(round.id, {timeLimitCs: cs})}
										/>
									</div>

									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('cutoff')}</span>
										<EditCutoffModal
											cutoffCs={round.cutoff_cs}
											cutoffAttempts={round.cutoff_attempts}
											onChange={({cutoffCs, cutoffAttempts}) =>
												updateRound(round.id, {cutoffCs, cutoffAttempts})
											}
										/>
									</div>

									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('advancement')}</span>
										<EditAdvancementModal
											type={round.advancement_type}
											level={round.advancement_level}
											onChange={({type, level}) =>
												updateRound(round.id, {advancementType: type, advancementLevel: level})
											}
										/>
									</div>
								</div>

								<div className={b('round-row-footer')}>
									{round.status === 'UPCOMING' && (
										<button
											className={b('modal-btn', {primary: true})}
											onClick={() => setStatus(round.id, 'OPEN')}
										>
											{t('open_round')}
										</button>
									)}
									{round.status === 'OPEN' && (
										<button
											className={b('modal-btn', {primary: true})}
											onClick={() => setStatus(round.id, 'ACTIVE')}
										>
											{t('activate_round')}
										</button>
									)}
									{round.status === 'FINISHED' && (
										<button
											className={b('modal-btn')}
											onClick={() => reopenRound(round.id)}
										>
											{t('reopen_round')}
										</button>
									)}
								</div>
							</div>
						))
					)}
				</div>
			))}
		</div>
	);
}
