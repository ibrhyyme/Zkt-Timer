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
	competitorDisplayName,
	competitorFlag,
} from '../shared';
import TimeField from '../TimeField';
import {MagnifyingGlass, FloppyDisk, CaretLeft, CaretRight, UserPlus, Play} from 'phosphor-react';
import {socketClient} from '../../../../util/socket/socketio';
import {ZktCompClientEvent, ZktCompServerEvent} from '../../../../../shared/zkt_competition/events';
import {computeAdvancementStates} from '../../../../../shared/zkt_competition/advancement';
import AdvancementLegend from '../../../community/zkt_competitions/AdvancementLegend';

const ROUND_RESULTS = gql`
	query ZktRoundResults($roundId: String!) {
		zktRoundResults(roundId: $roundId) {
			id
			user_id
			person_id
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
			created_at
			user {
				id
				username
				first_name
				last_name
				join_country
				profile {
					pfp_image {
						id
						url
					}
				}
			}
			person {
				id
				first_name
				last_name
				country_code
			}
			entered_by {
				id
				username
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

// WCA-style: starting a round is a single confirmation (UPCOMING -> ACTIVE).
// The server generates scrambles on this transition.
const SET_ROUND_STATUS = gql`
	mutation SetZktRoundStatusFromResults($input: UpdateZktRoundStatusInput!) {
		updateZktRoundStatus(input: $input) {
			id
			status
		}
	}
`;

const REOPEN_ROUND = gql`
	mutation ReopenZktRoundFromResults($roundId: String!) {
		reopenZktRound(roundId: $roundId) {
			id
			status
		}
	}
`;

const SUBMIT_BATCH = gql`
	mutation SubmitZktResultsBatchInline($input: SubmitZktResultsBatchInput!) {
		submitZktResultsBatch(input: $input) {
			id
		}
	}
`;

const MARK_NOSHOW = gql`
	mutation MarkZktNoShowInline($input: MarkZktNoShowInput!) {
		markZktNoShow(input: $input) {
			id
		}
	}
`;

const DELETE_RESULT = gql`
	mutation DeleteZktResultInline($resultId: String!) {
		deleteZktResult(resultId: $resultId)
	}
`;

const CLEAR_ROUND = gql`
	mutation ClearZktRoundResults($roundId: String!) {
		clearZktRoundResults(roundId: $roundId)
	}
`;

const CANDIDATES_QUERY = gql`
	query ZktRoundAdvancementCandidates($roundId: String!) {
		zktRoundAdvancementCandidates(roundId: $roundId) {
			id
			username
			first_name
			last_name
			join_country
		}
	}
`;

const ADD_COMPETITOR = gql`
	mutation AddZktCompetitorToRound($roundId: String!, $userId: String!) {
		addZktCompetitorToRound(roundId: $roundId, userId: $userId) {
			id
		}
	}
`;

const QUIT_COMPETITOR = gql`
	mutation QuitZktCompetitorFromRound($roundId: String!, $userId: String!, $replaceWithNext: Boolean!) {
		quitZktCompetitorFromRound(roundId: $roundId, userId: $userId, replaceWithNext: $replaceWithNext)
	}
`;


const DNF = -1;
const DNS = -2;

interface Competitor {
	id: string;
	// Exactly one of user_id / person_id is set. user_id = registered account,
	// person_id = account-less ("ghost") competitor imported into this comp.
	user_id: string | null;
	person_id?: string | null;
	username: string;
	first_name?: string | null;
	last_name?: string | null;
	join_country?: string | null;
	avatarUrl?: string;
	// Competition-local registrant id — lets the scoretaker jump by typing "3".
	registrationNumber?: number | null;
}

// Stable competitor key: the account id when present, else the ghost-person id.
// Works for both Competitor and result rows (both carry user_id / person_id).
function idOf(x: {user_id?: string | null; person_id?: string | null}): string {
	return (x.user_id || x.person_id) as string;
}

export default function DashboardResults({detail, onUpdated}: {detail: any; onUpdated: () => void}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [selectedEventId, setSelectedEventId] = useState<string>(detail.events[0]?.id || '');
	const selectedEvent = detail.events.find((e: any) => e.id === selectedEventId);

	const [selectedRoundId, setSelectedRoundId] = useState<string>('');
	const [results, setResults] = useState<any[]>([]);
	const [activeUserId, setActiveUserId] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	// The ID quick-select input — focused after each save so the scoretaker can
	// type the next competitor's number without touching the mouse.
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Batch mode: collect entries locally, commit all at once (wca-live parity).
	// Lets a delegate power through a stack of scorecards, then submit in one go.
	const [batchMode, setBatchMode] = useState<boolean>(
		() => typeof window !== 'undefined' && localStorage.getItem('zkt:batch-mode') === '1'
	);
	const [batch, setBatch] = useState<Record<string, (number | null)[]>>({});

	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('zkt:batch-mode', batchMode ? '1' : '0');
		}
	}, [batchMode]);

	// Pending batch is round-scoped; drop it when the round changes.
	useEffect(() => {
		setBatch({});
	}, [selectedRoundId]);

	useEffect(() => {
		if (selectedEvent && selectedEvent.rounds.length > 0) {
			// Keep the current round across silent refetches (detail is a new
			// reference each time). Only re-pick when the selected round no longer
			// belongs to this event (e.g. the event itself changed) — so entering a
			// time never jumps from 3x3 R1 to another round/event.
			const stillValid = selectedEvent.rounds.some((r: any) => r.id === selectedRoundId);
			if (!stillValid) {
				const active = selectedEvent.rounds.find((r: any) => r.status !== 'FINISHED');
				setSelectedRoundId(active?.id || selectedEvent.rounds[0].id);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
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

	// Live sync (multi-scoretaker): join the competition's socket room so this
	// screen reacts when ANOTHER scoretaker enters/deletes a result or changes
	// a round's status. Without this, a second scoretaker's leaderboard stays
	// stale and the same competitor could be overwritten.
	useEffect(() => {
		if (!detail?.id) return;
		const socket = socketClient();
		socket.emit(ZktCompClientEvent.JOIN_COMP, detail.id);
		return () => {
			socket.emit(ZktCompClientEvent.LEAVE_COMP, detail.id);
		};
	}, [detail?.id]);

	useEffect(() => {
		if (!selectedRoundId) return;
		const socket = socketClient();
		const onChanged = (payload: {roundId: string}) => {
			if (payload.roundId === selectedRoundId) fetchResults();
		};
		// Registration changes (add/edit/import/delete competitor) carry no
		// roundId — they affect the round-1 competitor list. Refresh the parent
		// detail so a newly added/edited competitor appears here immediately,
		// without a manual page reload.
		const onRegistration = () => onUpdated();
		socket.on(ZktCompServerEvent.RESULT_UPDATED, onChanged);
		socket.on(ZktCompServerEvent.RESULT_DELETED, onChanged);
		socket.on(ZktCompServerEvent.ROUND_STATUS_CHANGED, onChanged);
		socket.on(ZktCompServerEvent.REGISTRATION_UPDATED, onRegistration);
		return () => {
			socket.off(ZktCompServerEvent.RESULT_UPDATED, onChanged);
			socket.off(ZktCompServerEvent.RESULT_DELETED, onChanged);
			socket.off(ZktCompServerEvent.ROUND_STATUS_CHANGED, onChanged);
			socket.off(ZktCompServerEvent.REGISTRATION_UPDATED, onRegistration);
		};
	}, [selectedRoundId, fetchResults, onUpdated]);

	// Polling fallback — if a socket event is missed (proxy/disconnect/background
	// throttle), a 10s refetch (only while visible) guarantees convergence.
	useEffect(() => {
		if (!selectedRoundId) return;
		let active = typeof document !== 'undefined' && document.visibilityState === 'visible';
		const onVis = () => {
			active = document.visibilityState === 'visible';
			if (active) fetchResults();
		};
		document.addEventListener('visibilitychange', onVis);
		const id = window.setInterval(() => {
			if (active) fetchResults();
		}, 10000);
		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onVis);
		};
	}, [selectedRoundId, fetchResults]);

	// competitor key (user_id || person_id) -> registrant number, from the
	// competition registrations (results rows don't carry it).
	const regNumberByKey = useMemo(() => {
		const m = new Map<string, number>();
		for (const r of detail.registrations || []) {
			const key = r.user_id || r.person_id;
			if (key && r.registration_number != null) m.set(key, r.registration_number);
		}
		return m;
	}, [detail.registrations]);

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
					person_id: r.person_id,
					username: r.user?.username || r.user_id || r.person_id,
					first_name: r.user?.first_name ?? r.person?.first_name,
					last_name: r.user?.last_name ?? r.person?.last_name,
					join_country: r.user?.join_country ?? r.person?.country_code,
					avatarUrl: r.user?.profile?.pfp_image?.url,
					registrationNumber: r.registration_number,
				}));
		}
		return results.map((r) => ({
			id: r.id,
			user_id: r.user_id,
			person_id: r.person_id,
			username: r.user?.username || r.user_id || r.person_id,
			first_name: r.user?.first_name ?? r.person?.first_name,
			last_name: r.user?.last_name ?? r.person?.last_name,
			join_country: r.user?.join_country ?? r.person?.country_code,
			avatarUrl: r.user?.profile?.pfp_image?.url,
			registrationNumber: regNumberByKey.get(r.user_id || r.person_id) ?? null,
		}));
	}, [selectedRound, selectedEvent, detail.registrations, results, regNumberByKey]);

	// NEVER auto-pick a competitor — the scoretaker always selects by ID so they
	// never accidentally edit the wrong person. Only CLEAR the selection if the
	// active competitor no longer exists in this round (round/event changed, or
	// the competitor was removed) → form goes blank.
	useEffect(() => {
		if (activeUserId && !competitors.some((c) => idOf(c) === activeUserId)) {
			setActiveUserId(null);
		}
	}, [competitors, activeUserId]);

	const filteredCompetitors = useMemo(() => {
		if (!search.trim()) return competitors;
		const q = search.trim().toLowerCase();
		return competitors.filter(
			(c) =>
				c.username.toLowerCase().includes(q) ||
				competitorDisplayName(c).toLowerCase().includes(q) ||
				// Registrant number: "3" → competitor #3 (exact or prefix).
				(c.registrationNumber != null && String(c.registrationNumber).startsWith(q))
		);
	}, [competitors, search]);

	const activeCompetitor = competitors.find((c) => idOf(c) === activeUserId);
	const activeResult = results.find((r) => idOf(r) === activeUserId);

	function goToAdjacent(delta: number) {
		if (!activeUserId || competitors.length === 0) return;
		const idx = competitors.findIndex((c) => idOf(c) === activeUserId);
		const next = (idx + delta + competitors.length) % competitors.length;
		setActiveUserId(idOf(competitors[next]));
	}

	// Batch is keyed by competitor key (user_id || person_id).
	function handleBatchAdd(key: string, attempts: (number | null)[]) {
		setBatch((prev) => ({...prev, [key]: attempts}));
	}

	async function submitBatch() {
		const entries = Object.entries(batch);
		if (entries.length === 0) return;
		try {
			const batchResults = entries.map(([key, attempts]) => {
				const c = competitors.find((x) => idOf(x) === key);
				return {
					userId: c?.user_id || null,
					personId: c?.person_id || null,
					attempt1: attempts[0] ?? null,
					attempt2: attempts[1] ?? null,
					attempt3: attempts[2] ?? null,
					attempt4: attempts[3] ?? null,
					attempt5: attempts[4] ?? null,
				};
			});
			await gqlMutate(SUBMIT_BATCH, {input: {roundId: selectedRoundId, results: batchResults}});
			toastSuccess(t('batch_submitted', {count: entries.length}));
			setBatch({});
			await fetchResults();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function handleNoShow(key: string) {
		const c = competitors.find((x) => idOf(x) === key);
		try {
			await gqlMutate(MARK_NOSHOW, {
				input: {roundId: selectedRoundId, userId: c?.user_id || null, personId: c?.person_id || null},
			});
			await fetchResults();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	// Late addition / quit (wca-live Add/QuitCompetitorDialog parity).
	const [addPanelOpen, setAddPanelOpen] = useState(false);
	const [candidates, setCandidates] = useState<any[]>([]);

	async function toggleAddPanel() {
		if (addPanelOpen) {
			setAddPanelOpen(false);
			return;
		}
		try {
			const res: any = await gqlMutate(CANDIDATES_QUERY, {roundId: selectedRoundId});
			setCandidates(res?.data?.zktRoundAdvancementCandidates || []);
			setAddPanelOpen(true);
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function handleAddCompetitor(userId: string) {
		try {
			await gqlMutate(ADD_COMPETITOR, {roundId: selectedRoundId, userId});
			toastSuccess(t('competitor_added_to_round'));
			setAddPanelOpen(false);
			await fetchResults();
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	// Double-check mode (wca-live RoundDoubleCheck): step through entered
	// results one by one to verify against the paper scorecards.
	const [checkMode, setCheckMode] = useState(false);

	// Bulk no-show (wca-live QuitNoShowsDialog) — round 1 only, where the bulk
	// of no-shows happen. Lists competitors without any entered attempt.
	const [noShowPanelOpen, setNoShowPanelOpen] = useState(false);
	const [noShowSelection, setNoShowSelection] = useState<Set<string>>(new Set());

	const noShowCandidates = useMemo(() => {
		if (!selectedRound || selectedRound.round_number !== 1) return [];
		return competitors.filter((c) => {
			const r = results.find((x) => idOf(x) === idOf(c));
			return !r || ((r.best === null || r.best === undefined) && !r.no_show);
		});
	}, [selectedRound, competitors, results]);

	function toggleNoShowSelection(userId: string) {
		setNoShowSelection((prev) => {
			const next = new Set(prev);
			if (next.has(userId)) next.delete(userId);
			else next.add(userId);
			return next;
		});
	}

	async function submitBulkNoShow() {
		if (noShowSelection.size === 0) return;
		if (!window.confirm(t('bulk_no_show_confirm', {count: noShowSelection.size}))) return;
		try {
			for (const key of Array.from(noShowSelection)) {
				const c = competitors.find((x) => idOf(x) === key);
				await gqlMutate(MARK_NOSHOW, {
					input: {roundId: selectedRoundId, userId: c?.user_id || null, personId: c?.person_id || null},
				});
			}
			toastSuccess(t('bulk_no_show_done', {count: noShowSelection.size}));
			setNoShowSelection(new Set());
			setNoShowPanelOpen(false);
			await fetchResults();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function handleQuit(userId: string | null) {
		// Quit/replacement is account-only for now (server quit path is user-keyed).
		if (!userId) return;
		if (!window.confirm(t('quit_competitor_confirm'))) return;
		const replaceWithNext =
			(selectedRound?.round_number || 1) > 1 && window.confirm(t('quit_replace_confirm'));
		try {
			await gqlMutate(QUIT_COMPETITOR, {
				roundId: selectedRoundId,
				userId,
				replaceWithNext,
			});
			toastSuccess(t('competitor_quit_round'));
			await fetchResults();
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function handleClearResult(resultId: string) {
		try {
			await gqlMutate(DELETE_RESULT, {resultId});
			await fetchResults();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
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

	// Single-confirmation start (UPCOMING -> ACTIVE). Covers both round 1 and any
	// later round that is waiting with its carried-over competitors.
	async function startRound() {
		if (!selectedRoundId) return;
		try {
			await gqlMutate(SET_ROUND_STATUS, {input: {roundId: selectedRoundId, status: 'ACTIVE'}});
			toastSuccess(t('round_started'));
			await fetchResults();
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	// Undo a finalize (FINISHED -> ACTIVE); server revokes untouched carry rows.
	async function reopenRound() {
		if (!selectedRoundId) return;
		if (!window.confirm(t('reopen_round_confirm'))) return;
		try {
			await gqlMutate(REOPEN_ROUND, {roundId: selectedRoundId});
			toastSuccess(t('round_reopened'));
			await fetchResults();
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	// Wipe every time in this round (wrong event / mis-entry). Competitors stay.
	async function clearRoundResults() {
		if (!selectedRoundId) return;
		if (!window.confirm(t('clear_round_results_confirm'))) return;
		try {
			await gqlMutate(CLEAR_ROUND, {roundId: selectedRoundId});
			toastSuccess(t('round_results_cleared'));
			await fetchResults();
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

			{/* Round not started — single "start round" confirmation (WCA-style). */}
			{selectedRound && selectedRound.status === 'UPCOMING' && (
				<div className={b('round-start-panel')}>
					<p className={b('round-start-hint')}>{t('round_not_started_hint')}</p>
					<button className={b('start-round-btn')} onClick={startRound}>
						<Play weight="fill" /> {t('start_round')}
					</button>
				</div>
			)}

			{selectedRound && selectedRound.status !== 'UPCOMING' && (
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
					<label className={b('batch-toggle')}>
						<input
							type="checkbox"
							checked={batchMode}
							onChange={(e) => setBatchMode(e.target.checked)}
						/>
						<span>{t('batch_mode')}</span>
					</label>
					{Object.keys(batch).length > 0 && (
						<button className={b('batch-submit')} onClick={submitBatch}>
							{t('submit_batch', {count: Object.keys(batch).length})}
						</button>
					)}
					<button className={b('add-competitor-btn')} onClick={toggleAddPanel}>
						<UserPlus weight="bold" /> {t('add_competitor_to_round')}
					</button>
					{selectedRound.round_number === 1 && noShowCandidates.length > 0 && (
						<button
							className={b('add-competitor-btn')}
							onClick={() => setNoShowPanelOpen((v) => !v)}
						>
							{t('bulk_no_show')}
						</button>
					)}
					<button
						className={b('add-competitor-btn', {active: checkMode})}
						onClick={() => setCheckMode((v) => !v)}
					>
						{t('double_check_mode')}
					</button>
				</div>
			)}

			{noShowPanelOpen && (
				<div className={b('add-panel')}>
					{noShowCandidates.map((c) => (
						<label key={idOf(c)} className={b('add-panel-item', {checkbox: true})}>
							<input
								type="checkbox"
								checked={noShowSelection.has(idOf(c))}
								onChange={() => toggleNoShowSelection(idOf(c))}
							/>
							{competitorFlag(c) && <span className={b('flag')}>{competitorFlag(c)}</span>}
							<span>{competitorDisplayName(c)}</span>
						</label>
					))}
					<button
						type="button"
						className={b('batch-submit')}
						onClick={submitBulkNoShow}
						disabled={noShowSelection.size === 0}
					>
						{t('bulk_no_show_submit', {count: noShowSelection.size})}
					</button>
				</div>
			)}

			{addPanelOpen && (
				<div className={b('add-panel')}>
					{candidates.length === 0 ? (
						<div className={b('add-panel-empty')}>{t('no_candidates')}</div>
					) : (
						candidates.map((u: any, i: number) => (
							<button
								key={u.id}
								type="button"
								className={b('add-panel-item')}
								onClick={() => handleAddCompetitor(u.id)}
							>
								<span className={b('add-panel-order')}>{i + 1}</span>
								{competitorFlag(u) && <span className={b('flag')}>{competitorFlag(u)}</span>}
								<span>{competitorDisplayName(u) || u.username}</span>
							</button>
						))
					)}
				</div>
			)}

			{selectedRound && checkMode && (
				<DoubleCheckView
					results={results}
					format={selectedRound.format}
					onEdit={(userId) => {
						setActiveUserId(userId);
						setCheckMode(false);
					}}
				/>
			)}

			{selectedRound && selectedRound.status !== 'UPCOMING' && !checkMode && (
				<div className={b('scoretake-split')}>
					{/* LEFT: active competitor form */}
					<div className={b('scoretake-left')}>
						{competitors.length > 0 && (
							<CompetitorQuickSelect
								competitors={competitors}
								onSelect={setActiveUserId}
								inputRef={searchInputRef}
							/>
						)}
						{activeCompetitor ? (
							<ActiveResultForm
								key={idOf(activeCompetitor)}
								competitor={activeCompetitor}
								roundId={selectedRound.id}
								format={selectedRound.format}
								timeLimitCs={selectedRound.time_limit_cs}
								cutoffCs={selectedRound.cutoff_cs}
								cutoffAttempts={selectedRound.cutoff_attempts}
								existing={activeResult}
								batchMode={batchMode}
								onBatchAdd={handleBatchAdd}
								onSaved={async () => {
									if (!batchMode) await fetchResults();
									// Clear the form and return to the ID box — the scoretaker picks
									// the next competitor by number (random order). Blank form means
									// no risk of typing onto the previous/next competitor.
									setActiveUserId(null);
									requestAnimationFrame(() => searchInputRef.current?.focus());
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
							onClear={handleClearResult}
							onNoShow={handleNoShow}
							onQuit={handleQuit}
							batch={batch}
							format={selectedRound.format}
							advancementType={selectedRound.advancement_type}
							advancementLevel={selectedRound.advancement_level}
							cutoffCs={selectedRound.cutoff_cs}
							cutoffAttempts={selectedRound.cutoff_attempts}
							roundFinished={selectedRound.status === 'FINISHED'}
						/>
					</div>
				</div>
			)}

			{selectedRound && selectedRound.status !== 'UPCOMING' && (
				<div className={b('sticky-footer')}>
					<button
						className={b('reopen-btn', {danger: true})}
						style={{marginRight: 'auto', color: 'rgb(var(--error-color))'}}
						onClick={clearRoundResults}
					>
						{t('clear_round_results')}
					</button>
					{selectedRound.status === 'FINISHED' && (
						<button className={b('reopen-btn')} onClick={reopenRound}>
							{t('reopen_round')}
						</button>
					)}
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
	batchMode,
	onBatchAdd,
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
	batchMode?: boolean;
	onBatchAdd?: (userId: string, attempts: (number | null)[]) => void;
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
		// Typo guard (wca-live attemptResultsWarning): a valid attempt that is
		// 10x+ away from another usually means a misplaced digit (8.34 vs 83.40).
		const valid = attempts
			.slice(0, attemptCount)
			.filter((a): a is number => a !== null && a > 0);
		if (valid.length >= 2) {
			const min = Math.min(...valid);
			const max = Math.max(...valid);
			if (max > min * 10) {
				const ok = window.confirm(
					t('warning_10x_confirm', {min: formatCs(min), max: formatCs(max)})
				);
				if (!ok) return;
			}
		}

		// Batch mode: stash locally and move on; parent commits everything later.
		if (batchMode && onBatchAdd) {
			onBatchAdd(idOf(competitor), attempts.slice(0, attemptCount));
			toastSuccess(t('added_to_batch'));
			onSaved();
			return;
		}
		setSaving(true);
		try {
			const input: any = {roundId, userId: competitor.user_id, personId: competitor.person_id};
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
			// wca-live useKeyNavigation parity: vertical arrows move between
			// attempts, Escape leaves the field.
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				if (idx < requiredCount - 1) inputRefs.current[idx + 1]?.focus();
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				if (idx > 0) inputRefs.current[idx - 1]?.focus();
				return;
			}
			if (e.key === 'Escape') {
				(e.target as HTMLInputElement).blur();
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
						<div className={b('active-form-name')}>
							{competitorFlag(competitor) && (
								<span className={b('flag')}>{competitorFlag(competitor)}</span>
							)}
							{competitorDisplayName(competitor)}
						</div>
						{existing?.ranking && (
							<div className={b('active-form-rank')}>#{existing.ranking}</div>
						)}
						{existing?.entered_by?.username && (
							<div className={b('active-form-entered')}>
								{t('entered_by')}: {existing.entered_by.username}
							</div>
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
	onClear,
	onNoShow,
	onQuit,
	batch,
	format,
	advancementType,
	advancementLevel,
	cutoffCs,
	cutoffAttempts,
	roundFinished,
}: {
	competitors: Competitor[];
	results: any[];
	activeUserId: string | null;
	onSelect: (key: string) => void;
	onClear: (resultId: string) => void;
	onNoShow: (key: string) => void;
	onQuit: (userId: string | null) => void;
	batch: Record<string, (number | null)[]>;
	format: string;
	advancementType: string | null;
	advancementLevel: number | null;
	cutoffCs: number | null;
	cutoffAttempts: number | null;
	roundFinished: boolean;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const attemptCount = getFormatAttempts(format);
	const hasAverage = formatHasAverage(format);
	const [menu, setMenu] = useState<{key: string; userId: string | null; resultId?: string; x: number; y: number} | null>(null);
	// WCA-live three-state advancement: green=clinched, orange=questionable.
	const advStates = React.useMemo(
		() =>
			computeAdvancementStates(
				results,
				advancementType as any,
				advancementLevel,
				format as any,
				cutoffCs,
				cutoffAttempts,
				roundFinished
			),
		[results, advancementType, advancementLevel, format, cutoffCs, cutoffAttempts, roundFinished]
	);

	// Sort by ranking if available, then unranked after.
	const sorted = [...competitors].sort((a, b) => {
		const ra = results.find((r) => idOf(r) === idOf(a));
		const rb = results.find((r) => idOf(r) === idOf(b));
		const rankA = ra?.ranking ?? Number.MAX_SAFE_INTEGER;
		const rankB = rb?.ranking ?? Number.MAX_SAFE_INTEGER;
		return rankA - rankB;
	});

	return (
		<>
		{advancementType && <AdvancementLegend />}
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
				const r = results.find((x) => idOf(x) === idOf(c));
				const isActive = idOf(c) === activeUserId;
				const advState = r ? advStates.get(r.id) : undefined;
				const advancing = advState?.advancing ?? false;
				const questionable = advState?.questionable ?? false;
				const pending = batch[idOf(c)] !== undefined;
				return (
					<button
						key={idOf(c)}
						type="button"
						className={b('leaderboard-row', {active: isActive, advancing: advancing && !questionable, questionable, 'no-show': !!r?.no_show, pending})}
						onClick={() => onSelect(idOf(c))}
						onContextMenu={(e) => {
							e.preventDefault();
							setMenu({key: idOf(c), userId: c.user_id, resultId: r?.id, x: e.clientX, y: e.clientY});
						}}
					>
						<span className={b('leaderboard-col', {rank: true})}>
							{r?.ranking ?? '-'}
						</span>
						<span className={b('leaderboard-col', {name: true})}>
							{c.avatarUrl && <img className={b('user-avatar')} src={c.avatarUrl} alt="" />}
							{competitorFlag(c) && <span className={b('flag')}>{competitorFlag(c)}</span>}
							<span>{competitorDisplayName(c)}</span>
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
			{menu && (
				<>
					<div
						className={b('ctx-overlay')}
						onClick={() => setMenu(null)}
						onContextMenu={(e) => {
							e.preventDefault();
							setMenu(null);
						}}
					/>
					<div className={b('ctx-menu')} style={{top: menu.y, left: menu.x}}>
						<button type="button" onClick={() => { onSelect(menu.key); setMenu(null); }}>
							{t('ctx_edit')}
						</button>
						{menu.resultId && (
							<button type="button" onClick={() => { onClear(menu.resultId!); setMenu(null); }}>
								{t('ctx_clear')}
							</button>
						)}
						<button type="button" onClick={() => { onNoShow(menu.key); setMenu(null); }}>
							{t('ctx_no_show')}
						</button>
						{menu.userId && (
							<button type="button" onClick={() => { onQuit(menu.userId); setMenu(null); }}>
								{t('ctx_quit_round')}
							</button>
						)}
					</div>
				</>
			)}
		</>
	);
}

// Quick competitor jump: type a name/username, Enter (or click) jumps the
// scoretaker straight to that competitor. Mirrors wca-live's ResultSelect so a
// delegate can land on anyone without hunting the leaderboard.
function CompetitorQuickSelect({
	competitors,
	onSelect,
	inputRef,
}: {
	competitors: Competitor[];
	onSelect: (userId: string) => void;
	inputRef?: React.RefObject<HTMLInputElement>;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState(false);

	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return competitors
			.filter(
				(c) =>
					c.username.toLowerCase().includes(q) ||
					competitorDisplayName(c).toLowerCase().includes(q) ||
					(c.registrationNumber != null && String(c.registrationNumber).startsWith(q))
			)
			// Exact registrant-number match first, so typing "3" + Enter lands on #3.
			.sort((a, b) => {
				const aExact = String(a.registrationNumber ?? '') === q ? 0 : 1;
				const bExact = String(b.registrationNumber ?? '') === q ? 0 : 1;
				return aExact - bExact;
			})
			.slice(0, 6);
	}, [competitors, query]);

	function pick(c: Competitor) {
		onSelect(idOf(c));
		setQuery('');
		setOpen(false);
		// Release focus so the ActiveResultForm's mount-focus lands on the first
		// attempt input (otherwise this search box keeps the caret).
		inputRef?.current?.blur();
	}

	return (
		<div className={b('quick-select')}>
			<MagnifyingGlass weight="bold" />
			<input
				ref={inputRef}
				type="text"
				placeholder={t('quick_select_placeholder')}
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && matches.length > 0) {
						e.preventDefault();
						pick(matches[0]);
					}
					if (e.key === 'Escape') setOpen(false);
				}}
			/>
			{open && matches.length > 0 && (
				<div className={b('quick-select-list')}>
					{matches.map((c) => (
						<button
							key={idOf(c)}
							type="button"
							className={b('quick-select-item')}
							onMouseDown={(e) => {
								e.preventDefault();
								pick(c);
							}}
						>
							{c.registrationNumber != null && (
								<span
									style={{
										fontWeight: 700,
										fontSize: 12,
										minWidth: 20,
										color: 'rgb(var(--primary-color))',
									}}
								>
									{c.registrationNumber}
								</span>
							)}
							{competitorFlag(c) && <span className={b('flag')}>{competitorFlag(c)}</span>}
							<span>{competitorDisplayName(c)}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

// Step through entered results one at a time to verify against paper
// scorecards (wca-live RoundDoubleCheck). Arrow keys navigate; the optional
// scoretaker filter narrows to results entered by one person.
function DoubleCheckView({
	results,
	format,
	onEdit,
}: {
	results: any[];
	format: string;
	onEdit: (userId: string) => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const attemptCount = getFormatAttempts(format);
	const hasAverage = formatHasAverage(format);

	const [scoretakerId, setScoretakerId] = useState('');
	const [index, setIndex] = useState(0);

	const scoretakers = useMemo(() => {
		const map = new Map<string, string>();
		for (const r of results) {
			if (r.entered_by?.id) map.set(r.entered_by.id, r.entered_by.username);
		}
		return Array.from(map.entries()).map(([id, username]) => ({id, username}));
	}, [results]);

	const entered = useMemo(() => {
		return results
			.filter((r) => r.best !== null && r.best !== undefined)
			.filter((r) => !scoretakerId || r.entered_by?.id === scoretakerId)
			.slice()
			// Order by ENTRY order (created_at ascending) — the order the scoretaker
			// typed them, so double-check follows the paper scorecard stack, not the
			// ranking (which felt reversed/random to verify against).
			.sort((a, bx) => String(a.created_at || '').localeCompare(String(bx.created_at || '')));
	}, [results, scoretakerId]);

	useEffect(() => {
		setIndex(0);
	}, [scoretakerId]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, entered.length - 1));
			if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [entered.length]);

	const current = entered[Math.min(index, Math.max(entered.length - 1, 0))];

	if (entered.length === 0) {
		return <div className={b('empty')}>{t('no_results_yet')}</div>;
	}

	// Resolve the current row's identity (registered user or ghost person).
	const currentIdent = current.user
		? current.user
		: current.person
		? {
				first_name: current.person.first_name,
				last_name: current.person.last_name,
				join_country: current.person.country_code,
		  }
		: null;

	return (
		<div className={b('double-check')}>
			<div className={b('double-check-toolbar')}>
				{scoretakers.length > 1 && (
					<select
						className={b('select')}
						value={scoretakerId}
						onChange={(e) => setScoretakerId(e.target.value)}
					>
						<option value="">{t('all_scoretakers')}</option>
						{scoretakers.map((s) => (
							<option key={s.id} value={s.id}>
								{s.username}
							</option>
						))}
					</select>
				)}
				<span className={b('double-check-counter')}>
					{index + 1} / {entered.length}
				</span>
			</div>

			<div className={b('double-check-card')}>
				<button
					type="button"
					className={b('icon-btn', {ghost: true})}
					onClick={() => setIndex((i) => Math.max(i - 1, 0))}
					disabled={index === 0}
				>
					<CaretLeft weight="bold" size={28} />
				</button>

				<div className={b('double-check-body')}>
					<div className={b('double-check-name')}>
						{competitorFlag(currentIdent) && (
							<span className={b('flag')}>{competitorFlag(currentIdent)}</span>
						)}
						{competitorDisplayName(currentIdent) || current.user?.username}
						{current.ranking != null && (
							<span className={b('double-check-rank')}>#{current.ranking}</span>
						)}
					</div>
					<div className={b('double-check-attempts')}>
						{Array.from({length: attemptCount}).map((_, i) => (
							<div key={i} className={b('double-check-attempt')}>
								<span className={b('double-check-attempt-label')}>
									{t('attempt_n', {n: i + 1})}
								</span>
								<span className={b('double-check-attempt-value')}>
									{formatCs(current[`attempt_${i + 1}`])}
								</span>
							</div>
						))}
					</div>
					<div className={b('double-check-stats')}>
						<span>
							{t('best')}: <strong>{formatCs(current.best)}</strong>
						</span>
						{hasAverage && (
							<span>
								{t('average')}: <strong>{formatCs(current.average)}</strong>
							</span>
						)}
						{current.entered_by?.username && (
							<span>
								{t('entered_by')}: <strong>{current.entered_by.username}</strong>
							</span>
						)}
					</div>
					<button
						type="button"
						className={b('save-btn')}
						onClick={() => onEdit(idOf(current))}
					>
						{t('ctx_edit')}
					</button>
				</div>

				<button
					type="button"
					className={b('icon-btn', {ghost: true})}
					onClick={() => setIndex((i) => Math.min(i + 1, entered.length - 1))}
					disabled={index >= entered.length - 1}
				>
					<CaretRight weight="bold" size={28} />
				</button>
			</div>
			<div className={b('active-form-hint')}>{t('double_check_hint')}</div>
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
