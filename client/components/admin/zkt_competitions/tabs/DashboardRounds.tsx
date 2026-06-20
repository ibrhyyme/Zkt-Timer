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
import {FilePdf, ArrowsClockwise, Table, IdentificationCard, MonitorPlay} from 'phosphor-react';
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
			person {
				first_name
				last_name
				country_code
			}
		}
	}
`;

const ROUND_SCRAMBLES = gql`
	query ZktRoundScramblesForPdf($roundId: String!) {
		zktRoundScrambles(roundId: $roundId) {
			id
			group_id
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

	// WCA-style round-count selector: create/delete rounds so the event ends up
	// with exactly `target` rounds. Only the last (highest-numbered) rounds are
	// removed, matching the WCA EditEvents dropdown behaviour.
	async function setRoundCount(compEvent: any, target: number) {
		const current = compEvent.rounds.length;
		if (target === current) return;
		try {
			if (target > current) {
				for (let n = current + 1; n <= target; n++) {
					await gqlMutate(CREATE_ROUND, {
						input: {compEventId: compEvent.id, roundNumber: n, format: 'AO5'},
					});
				}
			} else {
				const sorted = [...compEvent.rounds].sort(
					(a: any, bx: any) => a.round_number - bx.round_number
				);
				for (let i = current - 1; i >= target; i--) {
					await gqlMutate(DELETE_ROUND, {roundId: sorted[i].id});
				}
			}
			toastSuccess(t('rounds_updated'));
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

	async function downloadScramblePdf(eventId: string, round: any) {
		try {
			// Lazy-ensure: server creates scrambles on first view if absent. With
			// groups present, each group gets its own distinct set (server-side).
			await gqlMutate(ENSURE_SCRAMBLES, {roundId: round.id});
			const res: any = await gqlMutate(ROUND_SCRAMBLES, {roundId: round.id});
			const all: any[] = res?.data?.zktRoundScrambles || [];
			if (all.length === 0) {
				toastError(t('no_scrambles'));
				return;
			}

			const toRow = (s: any) => ({
				attemptNumber: s.attempt_number,
				isExtra: s.is_extra,
				scrambleString: s.scramble_string,
			});
			const byAttempt = (a: any, bx: any) => a.attempt_number - bx.attempt_number;

			const base = {
				competitionName: detail.name,
				eventName: getEventName(eventId),
				eventId,
				roundNumber: round.round_number,
			};

			// Per-group scrambles → one labelled page per group (WCA parity).
			const hasGroups = all.some((s) => s.group_id);
			if (hasGroups) {
				const groupNumById = new Map<string, number>(
					(round.groups || []).map((g: any) => [g.id, g.group_number])
				);
				const byGroup = new Map<string, any[]>();
				for (const s of all) {
					if (!s.group_id) continue;
					if (!byGroup.has(s.group_id)) byGroup.set(s.group_id, []);
					byGroup.get(s.group_id)!.push(s);
				}
				const groups = Array.from(byGroup.entries())
					.sort((a, bx) => (groupNumById.get(a[0]) || 0) - (groupNumById.get(bx[0]) || 0))
					.map(([gid, list]) => ({
						label: t('group_n', {n: groupNumById.get(gid) || '?'}),
						scrambles: list.slice().sort(byAttempt).map(toRow),
					}));
				await generateScramblePdf({...base, groups});
			} else {
				await generateScramblePdf({
					...base,
					scrambles: all.slice().sort(byAttempt).map(toRow),
				});
			}
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
			await generateResultsPdf({
				competitionName: detail.name,
				eventName: getEventName(eventId),
				roundNumber: round.round_number,
				attemptCount,
				hasAverage,
				rows: sorted.map((r: any) => ({
					rank: r.ranking != null ? String(r.ranking) : '-',
					name:
						competitorDisplayName(r.user) ||
						[r.person?.first_name, r.person?.last_name].filter(Boolean).join(' ').trim(),
					country: r.user?.join_country || r.person?.country_code || '',
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

	// WCA scorecards: one per competitor registered for this event (APPROVED).
	// Group + station come from this round's COMPETITOR assignments (who solves
	// at which table); when assigned, cards are sorted by group then station so
	// they print in seating order. Scrambles print separately; result/signature
	// cells are filled by hand on site.
	async function downloadScorecards(ev: any, round: any) {
		// competitor key (user_id || person_id) -> {group, station}
		const assignMap = new Map<string, {group?: number; station?: number}>();
		for (const a of round.assignments || []) {
			if (a.role !== 'COMPETITOR') continue;
			const key = a.user_id || a.person_id;
			if (key) {
				assignMap.set(key, {group: a.group?.group_number, station: a.station_number});
			}
		}

		const competitors = (detail.registrations || [])
			.filter(
				(r: any) =>
					r.status === 'APPROVED' &&
					(r.events || []).some((e: any) => e.comp_event_id === ev.id)
			)
			.map((r: any) => {
				const key = r.user_id || r.person_id;
				const a = assignMap.get(key);
				const name =
					competitorDisplayName(r.user) ||
					[r.person?.first_name, r.person?.last_name].filter(Boolean).join(' ').trim() ||
					r.user?.username ||
					'';
				return {
					name,
					wcaId: r.person?.wca_id || r.user?.wca_id || '',
					group: a?.group,
					station: a?.station,
					registrationNumber: r.registration_number,
				};
			})
			.filter((c: any) => c.name);

		// Seating order when assigned (group, then station); otherwise alphabetical.
		competitors.sort((a: any, bx: any) => {
			const aHas = a.station != null;
			const bHas = bx.station != null;
			if (aHas && bHas) {
				if ((a.group || 0) !== (bx.group || 0)) return (a.group || 0) - (bx.group || 0);
				return (a.station || 0) - (bx.station || 0);
			}
			if (aHas !== bHas) return aHas ? -1 : 1;
			return a.name.localeCompare(bx.name);
		});

		// Print the real competition registrant id (import/registration order),
		// NOT the seating index. Falls back to the seating index only for legacy
		// rows that have no number yet (pre-backfill).
		const entries = competitors.map((c: any, i: number) => ({
			registrantId: c.registrationNumber ?? i + 1,
			name: c.name,
			wcaId: c.wcaId,
			group: c.group,
			station: c.station,
		}));

		await generateScorecardsPdf({
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
			{detail.events.map((ev: any) => {
				const rounds = [...ev.rounds].sort(
					(a: any, bx: any) => a.round_number - bx.round_number
				);
				return (
					<div key={ev.id} className={b('event-pane')}>
						<div className={b('event-pane-header')}>
							<div className={b('event-pane-title')}>
								<span className={`cubing-icon event-${ev.event_id}`} />
								<span>{getEventName(ev.event_id)}</span>
							</div>
							<label className={b('round-count-select')}>
								<span>{t('round_count')}</span>
								<select
									value={rounds.length}
									onChange={(e) => setRoundCount(ev, Number(e.target.value))}
								>
									{[0, 1, 2, 3, 4].map((n) => (
										<option key={n} value={n}>
											{n}
										</option>
									))}
								</select>
							</label>
						</div>

						{rounds.length === 0 ? (
							<div className={b('empty')}>{t('no_rounds')}</div>
						) : (
							<div className={b('round-table')}>
								<div className={b('round-table-head')}>
									<span className={b('round-cell', {num: true})}>#</span>
									<span className={b('round-cell')}>{t('format')}</span>
									<span className={b('round-cell')}>{t('time_limit')}</span>
									<span className={b('round-cell')}>{t('cutoff')}</span>
									<span className={b('round-cell')}>{t('advancement')}</span>
									<span className={b('round-cell')}>{t('groups')}</span>
									<span className={b('round-cell', {actions: true})} />
								</div>
								{rounds.map((round: any) => (
									<div key={round.id} className={b('round-table-row')}>
										<span className={b('round-cell', {num: true})}>
											{round.round_number}
											{round.status !== 'UPCOMING' && (
												<span
													className={b('round-status', {
														[round.status.toLowerCase()]: true,
													})}
												>
													{t(`round_status_${round.status.toLowerCase()}`)}
												</span>
											)}
										</span>
										<span className={b('round-cell')}>
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
										</span>
										<span className={b('round-cell')}>
											<EditTimeLimitModal
												value={round.time_limit_cs}
												onChange={(cs) => updateRound(round.id, {timeLimitCs: cs})}
											/>
										</span>
										<span className={b('round-cell')}>
											<EditCutoffModal
												cutoffCs={round.cutoff_cs}
												cutoffAttempts={round.cutoff_attempts}
												onChange={({cutoffCs, cutoffAttempts}) =>
													updateRound(round.id, {cutoffCs, cutoffAttempts})
												}
											/>
										</span>
										<span className={b('round-cell')}>
											<EditAdvancementModal
												type={round.advancement_type}
												level={round.advancement_level}
												onChange={({type, level}) =>
													updateRound(round.id, {
														advancementType: type,
														advancementLevel: level,
													})
												}
											/>
										</span>
										<span className={b('round-cell')}>
											<select
												className={b('round-field-btn')}
												value={round.group_count ?? 0}
												onChange={(e) =>
													updateRound(round.id, {groupCount: Number(e.target.value)})
												}
												title={t('group_count_hint')}
											>
												{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
													<option key={n} value={n}>
														{n === 0 ? '—' : n}
													</option>
												))}
											</select>
										</span>
										<span className={b('round-cell', {actions: true})}>
											{(round.status === 'OPEN' ||
												round.status === 'ACTIVE' ||
												round.status === 'FINISHED') && (
												<button
													type="button"
													className={b('scramble-action-btn', {icon: true})}
													onClick={() =>
														window.open(
															`/zkt-competitions/${detail.slug || detail.id}/projector/${ev.event_id}/${round.round_number}`,
															'_blank'
														)
													}
													title={t('open_projector')}
												>
													<MonitorPlay weight="bold" />
												</button>
											)}
											<button
												type="button"
												className={b('scramble-action-btn', {icon: true})}
												onClick={() => downloadScorecards(ev, round)}
												title={t('download_scorecards')}
											>
												<IdentificationCard weight="bold" />
											</button>
											{(round.status === 'ACTIVE' || round.status === 'FINISHED') && (
												<button
													type="button"
													className={b('scramble-action-btn', {icon: true})}
													onClick={() => downloadResultsPdf(ev.event_id, round)}
													title={t('download_results_pdf')}
												>
													<Table weight="bold" />
												</button>
											)}
											<button
												type="button"
												className={b('scramble-action-btn', {icon: true})}
												onClick={() => downloadScramblePdf(ev.event_id, round)}
												title={t('download_scramble_pdf')}
											>
												<FilePdf weight="bold" />
											</button>
											<button
												type="button"
												className={b('scramble-action-btn', {ghost: true, icon: true})}
												onClick={() => regenerateScrambles(round)}
												title={t('regenerate_scrambles_hint')}
											>
												<ArrowsClockwise weight="bold" />
											</button>
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
