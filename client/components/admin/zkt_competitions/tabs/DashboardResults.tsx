import React, {useState, useEffect, useCallback} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {
	b,
	getEventName,
	formatCs,
	getFormatAttempts,
	formatHasAverage,
} from '../shared';
import TimeField from '../TimeField';

const ROUND_RESULTS = gql`
	query ZktRoundResults($roundId: String!) {
		zktRoundResults(roundId: $roundId) {
			id
			user_id
			attempt_1
			attempt_2
			attempt_3
			attempt_4
			attempt_5
			best
			average
			ranking
			proceeds
			single_record_tag
			average_record_tag
			user {
				id
				username
				profile {
					pfp_image {
						id
						url
					}
				}
			}
		}
	}
`;

const SUBMIT_RESULT = gql`
	mutation SubmitZktResult($input: SubmitZktResultInput!) {
		submitZktResult(input: $input) {
			id
			best
			average
			attempt_1
			attempt_2
			attempt_3
			attempt_4
			attempt_5
		}
	}
`;

const FINALIZE_ROUND = gql`
	mutation FinalizeZktRound($roundId: String!) {
		finalizeZktRound(roundId: $roundId) {
			id
			status
		}
	}
`;

interface Competitor {
	id: string;
	user_id: string;
	username: string;
	avatarUrl?: string;
}

const DNF = -1;

export default function DashboardResults({detail, onUpdated}: {detail: any; onUpdated: () => void}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [selectedEventId, setSelectedEventId] = useState<string>(detail.events[0]?.id || '');
	const selectedEvent = detail.events.find((e: any) => e.id === selectedEventId);

	const [selectedRoundId, setSelectedRoundId] = useState<string>('');
	const [results, setResults] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	// Pick first non-finished round by default
	useEffect(() => {
		if (selectedEvent && selectedEvent.rounds.length > 0) {
			const active = selectedEvent.rounds.find((r: any) => r.status !== 'FINISHED');
			setSelectedRoundId(active?.id || selectedEvent.rounds[0].id);
		}
	}, [selectedEventId, selectedEvent]);

	const selectedRound = selectedEvent?.rounds.find((r: any) => r.id === selectedRoundId);

	const fetchResults = useCallback(async () => {
		if (!selectedRoundId) return;
		setLoading(true);
		try {
			const res = await gqlMutate(ROUND_RESULTS, {roundId: selectedRoundId});
			setResults(res?.data?.zktRoundResults || []);
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [selectedRoundId]);

	useEffect(() => {
		fetchResults();
	}, [fetchResults]);

	// Competitors eligible for this round
	const competitors: Competitor[] = React.useMemo(() => {
		if (!selectedRound || !selectedEvent) return [];
		if (selectedRound.round_number === 1) {
			return detail.registrations
				.filter(
					(r: any) =>
						r.status === 'APPROVED' &&
						r.events.some((e: any) => e.comp_event_id === selectedEvent.id)
				)
				.map((r: any) => ({
					id: r.id,
					user_id: r.user_id,
					username: r.user?.username || r.user_id,
					avatarUrl: r.user?.profile?.pfp_image?.url,
				}));
		}
		return results.map((r) => ({
			id: r.id,
			user_id: r.user_id,
			username: r.user?.username || r.user_id,
			avatarUrl: r.user?.profile?.pfp_image?.url,
		}));
	}, [selectedRound, selectedEvent, detail.registrations, results]);

	async function finalize() {
		if (!selectedRoundId) return;
		try {
			await gqlMutate(FINALIZE_ROUND, {roundId: selectedRoundId});
			toastSuccess(t('round_finalized'));
			await fetchResults();
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	if (!selectedEvent) return <div className={b('empty')}>{t('no_events')}</div>;

	return (
		<div className={b('results-tab')}>
			<div className={b('event-card-grid')} style={{gridTemplateColumns: 'auto'}}>
				<div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
					{detail.events.map((ev: any) => (
						<button
							key={ev.id}
							className={b('filter-pill', {active: selectedEventId === ev.id})}
							onClick={() => setSelectedEventId(ev.id)}
						>
							<span className={`cubing-icon event-${ev.event_id}`} />
							<span>{getEventName(ev.event_id)}</span>
						</button>
					))}
				</div>

				<div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
					{selectedEvent.rounds.map((r: any) => (
						<button
							key={r.id}
							className={b('filter-pill', {active: selectedRoundId === r.id})}
							onClick={() => setSelectedRoundId(r.id)}
						>
							<span>{t('round_n', {n: r.round_number})}</span>
							<span className={b('round-status', {[r.status.toLowerCase()]: true})}>
								{t(`round_status_${r.status.toLowerCase()}`)}
							</span>
						</button>
					))}
				</div>
			</div>

			{selectedRound && (
				<>
					<div className={b('round-info-banner')}>
						<span>
							<strong>{t('format')}:</strong> {selectedRound.format}
						</span>
						{selectedRound.time_limit_cs && (
							<span>
								<strong>{t('time_limit')}:</strong> {formatCs(selectedRound.time_limit_cs)}
							</span>
						)}
						{selectedRound.cutoff_cs && (
							<span>
								<strong>{t('cutoff')}:</strong> {formatCs(selectedRound.cutoff_cs)} /{' '}
								{selectedRound.cutoff_attempts}
							</span>
						)}
					</div>

					<div className={b('results-entry')}>
						{competitors.length === 0 ? (
							<div className={b('empty')}>{t('no_competitors_in_round')}</div>
						) : (
							competitors.map((comp) => (
								<ResultRow
									key={comp.user_id}
									competitor={comp}
									roundId={selectedRound.id}
									format={selectedRound.format}
									timeLimitCs={selectedRound.time_limit_cs}
									cutoffCs={selectedRound.cutoff_cs}
									cutoffAttempts={selectedRound.cutoff_attempts}
									existing={results.find((r) => r.user_id === comp.user_id)}
									onSaved={fetchResults}
								/>
							))
						)}
					</div>

					<div className={b('sticky-footer')}>
						<button
							className={b('finalize-btn')}
							onClick={finalize}
							disabled={selectedRound.status === 'FINISHED'}
						>
							{selectedRound.status === 'FINISHED'
								? t('round_already_finalized')
								: t('finalize_round')}
						</button>
					</div>
				</>
			)}
		</div>
	);
}

function ResultRow({
	competitor,
	roundId,
	format,
	timeLimitCs,
	cutoffCs,
	cutoffAttempts,
	existing,
	onSaved,
}: {
	competitor: Competitor;
	roundId: string;
	format: string;
	timeLimitCs?: number | null;
	cutoffCs?: number | null;
	cutoffAttempts?: number | null;
	existing?: any;
	onSaved: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const attemptCount = getFormatAttempts(format);
	const hasAverage = formatHasAverage(format);

	const [attempts, setAttempts] = useState<(number | null)[]>(() => {
		const arr: (number | null)[] = [null, null, null, null, null];
		if (existing) {
			for (let i = 0; i < 5; i++) {
				arr[i] = existing[`attempt_${i + 1}`] ?? null;
			}
		}
		return arr;
	});
	const [saving, setSaving] = useState(false);

	function setAttempt(idx: number, cs: number | null) {
		const next = [...attempts];
		next[idx] = cs;
		setAttempts(next);
	}

	function setSpecial(idx: number, type: 'DNF' | 'DNS' | 'PLUS2' | 'CLEAR') {
		const next = [...attempts];
		if (type === 'DNF') next[idx] = -1;
		else if (type === 'DNS') next[idx] = -2;
		else if (type === 'CLEAR') next[idx] = null;
		else if (type === 'PLUS2') {
			const current = next[idx];
			if (current !== null && current > 0) {
				next[idx] = current + 200;
			}
		}
		setAttempts(next);
	}

	async function save() {
		setSaving(true);
		try {
			const input: any = {
				roundId,
				userId: competitor.user_id,
			};
			for (let i = 0; i < attemptCount; i++) {
				input[`attempt${i + 1}`] = attempts[i];
			}
			await gqlMutate(SUBMIT_RESULT, {input});
			toastSuccess(t('saved'));
			onSaved();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSaving(false);
		}
	}

	// Live preview of best/average
	const relevantAttempts = attempts.slice(0, attemptCount);
	const previewBest = computeBestPreview(relevantAttempts);
	const previewAvg = hasAverage ? computeAveragePreview(relevantAttempts, format) : null;

	// Cutoff gate: if first N attempts don't include one that beats cutoff_cs,
	// later attempts are locked (server will wipe them on save anyway).
	const cutoffActive =
		cutoffCs != null &&
		cutoffAttempts != null &&
		cutoffCs > 0 &&
		cutoffAttempts > 0 &&
		cutoffAttempts < attemptCount;
	const cutoffMet = cutoffActive
		? attempts
				.slice(0, cutoffAttempts!)
				.some((a) => a !== null && a > 0 && a < cutoffCs!)
		: true;

	return (
		<div className={b('result-row')}>
			<div className={b('result-user')}>
				{competitor.avatarUrl && (
					<img className={b('user-avatar')} src={competitor.avatarUrl} alt="" />
				)}
				<span className={b('user-name')}>{competitor.username}</span>
				{existing?.ranking && (
					<span className={b('ranking-pill')}>#{existing.ranking}</span>
				)}
			</div>

			<div className={b('attempts')}>
				{Array.from({length: attemptCount}).map((_, idx) => {
					const lockedByCutoff =
						cutoffActive && !cutoffMet && idx >= (cutoffAttempts as number);
					return (
						<div
							key={idx}
							className={b('attempt-cell', {'cutoff-locked': lockedByCutoff})}
						>
							<TimeField
								value={attempts[idx]}
								onChange={(cs) => setAttempt(idx, cs)}
								placeholder={`D${idx + 1}`}
								disabled={lockedByCutoff}
								disabledReason={
									lockedByCutoff ? t('cutoff_locked_hint') : undefined
								}
								timeLimitCs={timeLimitCs ?? undefined}
							/>
							<div className={b('attempt-actions')}>
								<button
									className={b('mini-btn')}
									onClick={() => setSpecial(idx, 'DNF')}
									disabled={lockedByCutoff}
								>
									DNF
								</button>
								<button
									className={b('mini-btn')}
									onClick={() => setSpecial(idx, 'DNS')}
									disabled={lockedByCutoff}
								>
									DNS
								</button>
								<button
									className={b('mini-btn')}
									onClick={() => setSpecial(idx, 'PLUS2')}
									disabled={lockedByCutoff}
								>
									+2
								</button>
								<button
									className={b('mini-btn')}
									onClick={() => setSpecial(idx, 'CLEAR')}
									disabled={lockedByCutoff}
								>
									×
								</button>
							</div>
						</div>
					);
				})}
			</div>

			<div className={b('result-stats')}>
				<div className={b('stat-pill')}>
					<span>{t('best')}:</span>
					<strong>{formatCs(previewBest)}</strong>
				</div>
				{hasAverage && (
					<div className={b('stat-pill')}>
						<span>{t('average')}:</span>
						<strong>{formatCs(previewAvg)}</strong>
					</div>
				)}
			</div>

			<button className={b('save-btn')} onClick={save} disabled={saving}>
				{saving ? t('saving') : t('save')}
			</button>
		</div>
	);
}

function computeBestPreview(attempts: (number | null)[]): number | null {
	const valid = attempts.filter((a) => a !== null && a > 0) as number[];
	if (valid.length === 0) {
		if (attempts.some((a) => a !== null)) return DNF;
		return null;
	}
	return Math.min(...valid);
}

function computeAveragePreview(attempts: (number | null)[], format: string): number | null {
	const complete = attempts.every((a) => a !== null);
	if (!complete) return null;
	const vals = attempts as number[];

	if (format === 'MO3') {
		if (vals.some((v) => v === -1 || v === -2)) return DNF;
		return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
	}
	if (format === 'AO5') {
		const dnfCount = vals.filter((v) => v === -1 || v === -2).length;
		if (dnfCount >= 2) return DNF;
		const sorted = [...vals].sort((a, b) => {
			if (a === -1 || a === -2) return 1;
			if (b === -1 || b === -2) return -1;
			return a - b;
		});
		const mid = sorted.slice(1, 4);
		return Math.round(mid.reduce((a, b) => a + b, 0) / 3);
	}
	return null;
}
