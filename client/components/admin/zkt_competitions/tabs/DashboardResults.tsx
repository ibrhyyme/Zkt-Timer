import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
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
import {MagnifyingGlass, FloppyDisk, CaretLeft, CaretRight} from 'phosphor-react';

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
			no_show
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
			ranking
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


const DNF = -1;
const DNS = -2;

interface Competitor {
	id: string;
	user_id: string;
	username: string;
	avatarUrl?: string;
}

export default function DashboardResults({detail, onUpdated}: {detail: any; onUpdated: () => void}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [selectedEventId, setSelectedEventId] = useState<string>(detail.events[0]?.id || '');
	const selectedEvent = detail.events.find((e: any) => e.id === selectedEventId);

	const [selectedRoundId, setSelectedRoundId] = useState<string>('');
	const [results, setResults] = useState<any[]>([]);
	const [activeUserId, setActiveUserId] = useState<string | null>(null);
	const [search, setSearch] = useState('');

	useEffect(() => {
		if (selectedEvent && selectedEvent.rounds.length > 0) {
			const active = selectedEvent.rounds.find((r: any) => r.status !== 'FINISHED');
			setSelectedRoundId(active?.id || selectedEvent.rounds[0].id);
		}
	}, [selectedEventId, selectedEvent]);

	const selectedRound = selectedEvent?.rounds.find((r: any) => r.id === selectedRoundId);

	const fetchResults = useCallback(async () => {
		if (!selectedRoundId) return;
		try {
			const res = await gqlMutate(ROUND_RESULTS, {roundId: selectedRoundId});
			setResults((res as any)?.data?.zktRoundResults || []);
		} catch {
			// ignore
		}
	}, [selectedRoundId]);

	useEffect(() => {
		fetchResults();
	}, [fetchResults]);

	const competitors: Competitor[] = useMemo(() => {
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

	// Auto-pick the first competitor when loading the round.
	useEffect(() => {
		if (!activeUserId && competitors.length > 0) {
			setActiveUserId(competitors[0].user_id);
		}
		if (activeUserId && !competitors.some((c) => c.user_id === activeUserId)) {
			setActiveUserId(competitors[0]?.user_id || null);
		}
	}, [competitors, activeUserId]);

	const filteredCompetitors = useMemo(() => {
		if (!search.trim()) return competitors;
		const q = search.toLowerCase();
		return competitors.filter((c) => c.username.toLowerCase().includes(q));
	}, [competitors, search]);

	const activeCompetitor = competitors.find((c) => c.user_id === activeUserId);
	const activeResult = results.find((r) => r.user_id === activeUserId);

	function goToAdjacent(delta: number) {
		if (!activeUserId || competitors.length === 0) return;
		const idx = competitors.findIndex((c) => c.user_id === activeUserId);
		const next = (idx + delta + competitors.length) % competitors.length;
		setActiveUserId(competitors[next].user_id);
	}

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
		<div className={b('scoretake-page')}>
			{/* Event pills */}
			<div className={b('scoretake-event-row')}>
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

			{/* Round pills */}
			<div className={b('scoretake-round-row')}>
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

			{selectedRound && (
				<div className={b('scoretake-info')}>
					<span><strong>{t('format')}:</strong> {selectedRound.format}</span>
					{selectedRound.time_limit_cs && (
						<span><strong>{t('time_limit')}:</strong> {formatCs(selectedRound.time_limit_cs)}</span>
					)}
					{selectedRound.cutoff_cs && (
						<span>
							<strong>{t('cutoff')}:</strong> {formatCs(selectedRound.cutoff_cs)} /{' '}
							{selectedRound.cutoff_attempts}
						</span>
					)}
					<span className={b('scoretake-entered')}>
						{results.filter((r) => r.best !== null && r.best !== undefined).length} / {competitors.length}{' '}
						{t('entered')}
					</span>
				</div>
			)}

			{selectedRound && (
				<div className={b('scoretake-split')}>
					{/* LEFT: active competitor form */}
					<div className={b('scoretake-left')}>
						{activeCompetitor ? (
							<ActiveResultForm
								key={activeCompetitor.user_id}
								competitor={activeCompetitor}
								roundId={selectedRound.id}
								format={selectedRound.format}
								timeLimitCs={selectedRound.time_limit_cs}
								cutoffCs={selectedRound.cutoff_cs}
								cutoffAttempts={selectedRound.cutoff_attempts}
								existing={activeResult}
								onSaved={async () => {
									await fetchResults();
									// Advance to next competitor without an entered result, if any.
									const idx = competitors.findIndex((c) => c.user_id === activeCompetitor.user_id);
									for (let i = 1; i <= competitors.length; i++) {
										const cand = competitors[(idx + i) % competitors.length];
										const candRes = results.find((r) => r.user_id === cand.user_id);
										const empty = !candRes || (candRes.best === null || candRes.best === undefined);
										if (empty) {
											setActiveUserId(cand.user_id);
											return;
										}
									}
								}}
								onPrev={() => goToAdjacent(-1)}
								onNext={() => goToAdjacent(1)}
							/>
						) : (
							<div className={b('empty')}>{t('no_competitors_in_round')}</div>
						)}
					</div>

					{/* RIGHT: live leaderboard */}
					<div className={b('scoretake-right')}>
						<div className={b('scoretake-search')}>
							<MagnifyingGlass weight="bold" />
							<input
								type="text"
								placeholder={t('search_competitor')}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>

						<LeaderboardTable
							competitors={filteredCompetitors}
							results={results}
							activeUserId={activeUserId}
							onSelect={setActiveUserId}
							format={selectedRound.format}
						/>
					</div>
				</div>
			)}

			{selectedRound && (
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
			)}
		</div>
	);
}

function ActiveResultForm({
	competitor,
	roundId,
	format,
	timeLimitCs,
	cutoffCs,
	cutoffAttempts,
	existing,
	onSaved,
	onPrev,
	onNext,
}: {
	competitor: Competitor;
	roundId: string;
	format: string;
	timeLimitCs?: number | null;
	cutoffCs?: number | null;
	cutoffAttempts?: number | null;
	existing?: any;
	onSaved: () => void;
	onPrev: () => void;
	onNext: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const attemptCount = getFormatAttempts(format);
	const hasAverage = formatHasAverage(format);

	const [attempts, setAttempts] = useState<(number | null)[]>(() => {
		const arr: (number | null)[] = [null, null, null, null, null];
		if (existing) {
			for (let i = 0; i < 5; i++) arr[i] = existing[`attempt_${i + 1}`] ?? null;
		}
		return arr;
	});
	const [saving, setSaving] = useState(false);
	const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

	function setAttempt(idx: number, cs: number | null) {
		const next = [...attempts];
		next[idx] = cs;
		setAttempts(next);
	}

	async function save() {
		setSaving(true);
		try {
			const input: any = {roundId, userId: competitor.user_id};
			for (let i = 0; i < attemptCount; i++) input[`attempt${i + 1}`] = attempts[i];
			await gqlMutate(SUBMIT_RESULT, {input});
			toastSuccess(t('saved'));
			onSaved();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSaving(false);
		}
	}

	const cutoffActive =
		cutoffCs != null && cutoffAttempts != null &&
		cutoffCs > 0 && cutoffAttempts > 0 && cutoffAttempts < attemptCount;
	const cutoffMet = cutoffActive
		? attempts.slice(0, cutoffAttempts!).some((a) => a !== null && a > 0 && a < cutoffCs!)
		: true;

	const relevantAttempts = attempts.slice(0, attemptCount);
	const previewBest = computeBestPreview(relevantAttempts);
	const previewAvg = hasAverage ? computeAveragePreview(relevantAttempts, format) : null;

	// "Required" attempts = either full format count, or cutoff count when cutoff
	// is active and unmet. All required cells must be filled (non-null) for submit
	// to unlock.
	const requiredCount = cutoffActive && !cutoffMet ? (cutoffAttempts as number) : attemptCount;
	const requiredFilled = attempts
		.slice(0, requiredCount)
		.every((v) => v !== null && v !== undefined);

	// Focus the first empty required attempt when the competitor changes, so the
	// scoretaker lands on the next field to type without clicking.
	useEffect(() => {
		const firstEmpty = attempts.findIndex((v, i) => i < requiredCount && (v === null || v === undefined));
		const target = firstEmpty === -1 ? 0 : firstEmpty;
		requestAnimationFrame(() => inputRefs.current[target]?.focus());
		// Intentionally on mount of a new competitor only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function attemptKeyDown(idx: number) {
		return (e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'ArrowLeft' && e.altKey) {
				e.preventDefault();
				onPrev();
				return;
			}
			if (e.key === 'ArrowRight' && e.altKey) {
				e.preventDefault();
				onNext();
				return;
			}
			if (e.key === 'Enter') {
				e.preventDefault();
				// Next required attempt; if we're on the last one and everything is
				// filled, submit. Otherwise jump to the first remaining empty.
				if (idx < requiredCount - 1) {
					inputRefs.current[idx + 1]?.focus();
					return;
				}
				if (requiredFilled) {
					save();
					return;
				}
				const firstEmpty = attempts.findIndex((v, i) => i < requiredCount && (v === null || v === undefined));
				if (firstEmpty !== -1) inputRefs.current[firstEmpty]?.focus();
			}
		};
	}

	return (
		<div className={b('active-form')}>
			<div className={b('active-form-header')}>
				<button type="button" className={b('icon-btn', {ghost: true})} onClick={onPrev} title={t('prev')}>
					<CaretLeft weight="bold" />
				</button>
				<div className={b('active-form-user')}>
					{competitor.avatarUrl && (
						<img className={b('user-avatar')} src={competitor.avatarUrl} alt="" />
					)}
					<div>
						<div className={b('active-form-name')}>{competitor.username}</div>
						{existing?.ranking && (
							<div className={b('active-form-rank')}>#{existing.ranking}</div>
						)}
					</div>
				</div>
				<button type="button" className={b('icon-btn', {ghost: true})} onClick={onNext} title={t('next')}>
					<CaretRight weight="bold" />
				</button>
			</div>

			<div className={b('active-form-attempts')}>
				{Array.from({length: attemptCount}).map((_, idx) => {
					const locked = cutoffActive && !cutoffMet && idx >= (cutoffAttempts as number);
					return (
						<div
							key={idx}
							className={b('active-form-attempt', {'cutoff-locked': locked})}
						>
							<label className={b('active-form-attempt-label')}>
								{t('attempt_n', {n: idx + 1})}
							</label>
							<TimeField
								inputRef={(el) => {
									inputRefs.current[idx] = el;
								}}
								value={attempts[idx]}
								onChange={(cs) => setAttempt(idx, cs)}
								disabled={locked}
								disabledReason={locked ? t('cutoff_locked_hint') : undefined}
								timeLimitCs={timeLimitCs ?? undefined}
								onKeyDown={attemptKeyDown(idx)}
							/>
						</div>
					);
				})}
			</div>

			<div className={b('active-form-stats')}>
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

			{requiredFilled && (
				<button className={b('save-btn', {primary: true})} onClick={save} disabled={saving}>
					<FloppyDisk weight="bold" /> {saving ? t('saving') : t('submit_attempts')}
				</button>
			)}
			<div className={b('active-form-hint')}>{t('scoretake_hint')}</div>
		</div>
	);
}

function LeaderboardTable({
	competitors,
	results,
	activeUserId,
	onSelect,
	format,
}: {
	competitors: Competitor[];
	results: any[];
	activeUserId: string | null;
	onSelect: (userId: string) => void;
	format: string;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const attemptCount = getFormatAttempts(format);
	const hasAverage = formatHasAverage(format);

	// Sort by ranking if available, then unranked after.
	const sorted = [...competitors].sort((a, b) => {
		const ra = results.find((r) => r.user_id === a.user_id);
		const rb = results.find((r) => r.user_id === b.user_id);
		const rankA = ra?.ranking ?? Number.MAX_SAFE_INTEGER;
		const rankB = rb?.ranking ?? Number.MAX_SAFE_INTEGER;
		return rankA - rankB;
	});

	return (
		<div className={b('leaderboard')}>
			<div className={b('leaderboard-head')}>
				<span className={b('leaderboard-col', {rank: true})}>#</span>
				<span className={b('leaderboard-col', {name: true})}>{t('competitor')}</span>
				{Array.from({length: attemptCount}).map((_, i) => (
					<span key={i} className={b('leaderboard-col', {attempt: true})}>{i + 1}</span>
				))}
				<span className={b('leaderboard-col', {best: true})}>{t('best')}</span>
				{hasAverage && (
					<span className={b('leaderboard-col', {avg: true})}>{t('average')}</span>
				)}
			</div>
			{sorted.map((c) => {
				const r = results.find((x) => x.user_id === c.user_id);
				const isActive = c.user_id === activeUserId;
				const advancing = r?.proceeds;
				return (
					<button
						key={c.user_id}
						type="button"
						className={b('leaderboard-row', {active: isActive, advancing, 'no-show': !!r?.no_show})}
						onClick={() => onSelect(c.user_id)}
					>
						<span className={b('leaderboard-col', {rank: true})}>
							{r?.ranking ?? '-'}
						</span>
						<span className={b('leaderboard-col', {name: true})}>
							{c.avatarUrl && <img className={b('user-avatar')} src={c.avatarUrl} alt="" />}
							<span>{c.username}</span>
						</span>
						{Array.from({length: attemptCount}).map((_, i) => (
							<span key={i} className={b('leaderboard-col', {attempt: true})}>
								{formatCs(r?.[`attempt_${i + 1}`])}
							</span>
						))}
						<span className={b('leaderboard-col', {best: true})}>
							{formatCs(r?.best)}
							{r?.single_record_tag && (
								<span className={b('record-tag', {[r.single_record_tag.toLowerCase()]: true})}>
									{r.single_record_tag}
								</span>
							)}
						</span>
						{hasAverage && (
							<span className={b('leaderboard-col', {avg: true})}>
								{formatCs(r?.average)}
								{r?.average_record_tag && (
									<span className={b('record-tag', {[r.average_record_tag.toLowerCase()]: true})}>
										{r.average_record_tag}
									</span>
								)}
							</span>
						)}
					</button>
				);
			})}
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
		if (vals.some((v) => v === DNF || v === DNS)) return DNF;
		return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
	}
	if (format === 'AO5') {
		const dnfCount = vals.filter((v) => v === DNF || v === DNS).length;
		if (dnfCount >= 2) return DNF;
		const sorted = [...vals].sort((a, b) => {
			if (a === DNF || a === DNS) return 1;
			if (b === DNF || b === DNS) return -1;
			return a - b;
		});
		const mid = sorted.slice(1, 4);
		return Math.round(mid.reduce((a, b) => a + b, 0) / 3);
	}
	return null;
}
