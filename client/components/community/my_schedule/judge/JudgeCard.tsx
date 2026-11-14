import React, {forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {v4 as uuid} from 'uuid';
import block from '../../../../styles/bem';
import {
	CaretLeft,
	Check,
	CheckCircle,
	Clock,
	DotsThreeVertical,
	Lock,
	PencilSimple,
	PlusCircle,
	SignOut,
	UserMinus,
	WarningCircle,
	X,
} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import {anchorOf, useActionMenu} from '../../../common/action_menu/ActionMenu';
import {allowScreenSleep, keepScreenAwake} from '../../../../util/native-plugins';
import {useKeyboardInset} from '../../../../util/hooks/useKeyboardInset';
import {getJudgeOutbox} from '../../../../util/judge-outbox-device';
import {JudgeCallError, judgeErrorKey, toJudgeError} from '../../../../util/judge-api';
import {nextDeviceSeq, OutboxSnapshot} from '../../../../util/judge-outbox';
import {buildRows, EXTRA_LINES, isEditable, isSent, Row} from './judge-rows';
import {b as scheduleBlock, formatWcaTime, localEventName} from '../shared';
import JudgePermitSheet from './JudgePermitSheet';
import {
	draftFromText,
	draftValue,
	DraftValue,
	EMPTY_DRAFT,
	exceedsTimeLimit,
	formatDraft,
	formatJudgeLine,
	formatJudgeValue,
	inconsistentWithCard,
	averageFarBelowRecord,
	dnsBeforeValid,
	farBelowRecord,
	formatJudgeAverage,
	JudgeCard as JudgeCardData,
	judgeEntryMode,
	KeypadDraft,
	pressKey,
	ZERO_DIGITS,
} from '../../../../../shared/zkt_judge';

const b = block('judge');

interface Props {
	competitionId: string;
	userId: string;
	card: JudgeCardData;
	outbox: OutboxSnapshot;
	onEnd: () => Promise<void>;
	onBack: () => void;
	/** Ask the site for the card again (a permit was just approved). */
	onRefresh: () => Promise<unknown>;
	/** The switch between the cards a judge holds at once, drawn over the card. */
	switcher?: React.ReactNode;
	/** Holding several cards: Gönder names the station, so a time never goes to the wrong one. */
	sendToStation?: boolean;
	/** Kept mounted behind the card on screen (its draft waits there). */
	hidden?: boolean;
}

export interface JudgeCardHandle {
	/** Put the cursor (and the phone's keyboard) on the line being entered, if any. */
	focusEntry: () => void;
}

/**
 * Step 4 of "Hakem Ol": the paper scorecard, line for line, so the desk can lay
 * the two side by side in the double check. Five attempt lines (or the format's
 * count) and two extra lines under them. The line being entered is a field for
 * the phone's own keyboard; DNF, DNS and +2 sit under it as buttons.
 */
const JudgeCard = forwardRef<JudgeCardHandle, Props>(function JudgeCard(
	{competitionId, userId, card, outbox, onEnd, onBack, onRefresh, switcher, sendToStation, hidden = false},
	ref
) {
	const {t} = useTranslation();
	const mode = judgeEntryMode(card.round.eventId);
	// What the keyboard types: a move count for FMC, a time otherwise.
	const keypadMode: 'time' | 'moves' = mode === 'moves' ? 'moves' : 'time';
	const rows = useMemo(() => buildRows(card, outbox, userId), [card, outbox, userId]);
	const [selected, setSelected] = useState<string | null>(null);
	const [draft, setDraft] = useState<KeypadDraft>(EMPTY_DRAFT);
	const [confirming, setConfirming] = useState<DraftValue | null>(null);
	const [asking, setAsking] = useState<'end' | 'no_show' | null>(null);
	const [ending, setEnding] = useState(false);
	const [endError, setEndError] = useState<JudgeCallError | null>(null);
	// A sent attempt tapped open to show "Süre düzelt" / "Ekstra iste".
	const menu = useActionMenu();
	// rowId: the line the request was made from (an attempt line or an extra line).
	const [permitAsk, setPermitAsk] = useState<{attemptNo: number; purpose: 'CORRECT' | 'EXTRA'; rowId: string} | null>(null);
	const field = useRef<HTMLInputElement>(null);
	// The keyboard is drawn over the page; this much room below lets the line
	// being typed scroll clear of it.
	const keyboardInset = useKeyboardInset();

	useImperativeHandle(ref, () => ({focusEntry: () => field.current?.focus()}), []);

	// The phone lies on the table between attempts; it must not lock itself.
	// Only the card on screen holds the lock: the plugin does not count, so a
	// hidden card ending would otherwise let the phone sleep under the other.
	useEffect(() => {
		if (hidden) return;
		void keepScreenAwake();
		return () => {
			void allowScreenSleep();
		};
	}, [hidden]);

	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[]
	);

	const closed = card.cardStatus !== 'OPEN';
	const usable = mode !== 'unsupported' && !closed;
	// An approved correction or extra is what the judge is about to type, so it
	// comes before the next empty attempt.
	const firstPermit = rows.find((r) => r.permit && isEditable(r))?.id ?? null;
	const firstEmpty = rows.find((r) => r.kind === 'attempt' && r.state === 'empty')?.id ?? null;
	const selectedRow = selected ? rows.find((r) => r.id === selected) : undefined;
	const activeId = usable ? (selectedRow && isEditable(selectedRow) ? selected : (firstPermit ?? firstEmpty)) : null;
	const activeRow = rows.find((r) => r.id === activeId) || null;
	const extraLinesUsed = rows.filter((r) => r.kind === 'extra' && r.attemptNo !== null).length;

	const waiting = rows.filter((r) => r.state === 'pending').length;
	const noShowPending = outbox.items.some(
		(i) => i.cardId === card.cardId && i.userId === userId && i.kind === 'NO_SHOW' && i.state === 'pending'
	);
	const nothingEntered = rows.every((r) => r.state === 'empty' || r.state === 'later' || r.state === 'locked' || r.state === 'unused');
	const value = activeRow && mode !== 'unsupported' ? draftValue(draft, keypadMode) : null;

	function press(key: 'DNF' | 'DNS' | '+2') {
		if (!activeRow) return;
		setDraft((d) => pressKey(d, key, keypadMode));
		// Should the platform still have moved the focus, the keyboard comes back.
		if (typeof document !== 'undefined' && document.activeElement !== field.current) field.current?.focus();
	}

	function askToSend() {
		if (!value) return;
		// Close the keyboard: the question is asked on the whole screen.
		field.current?.blur();
		setConfirming(value);
	}

	function bringIntoView() {
		// After the keyboard has risen.
		setTimeout(() => field.current?.scrollIntoView({block: 'center', behavior: 'smooth'}), 350);
	}

	function selectRow(id: string) {
		if (id === activeId) return;
		setSelected(id);
		setDraft(EMPTY_DRAFT);
		// The tap that picks the line also opens the keyboard for it.
		setTimeout(() => field.current?.focus(), 0);
	}

	async function send() {
		if (!confirming || !activeRow || activeRow.attemptNo === null) return;
		const entry = confirming;
		const permit = activeRow.permit && isEditable(activeRow) ? activeRow.permit : null;
		setConfirming(null);
		setDraft(EMPTY_DRAFT);
		setSelected(null);
		// Stored on the device before anything is sent; the line locks at once.
		await getJudgeOutbox().enqueue({
			submissionId: uuid(),
			cardId: card.cardId,
			kind: 'ATTEMPT',
			attemptNo: activeRow.attemptNo,
			value: entry.value,
			rawValue: entry.rawValue,
			penalty: entry.penalty,
			// Only a time that says it uses the approval spends it.
			permit,
			deviceSeq: nextDeviceSeq(),
			userId,
			competitionId,
		});
	}

	async function markNoShow() {
		setAsking(null);
		await getJudgeOutbox().enqueue({
			submissionId: uuid(),
			cardId: card.cardId,
			kind: 'NO_SHOW',
			attemptNo: null,
			value: null,
			rawValue: null,
			penalty: 0,
			permit: null,
			deviceSeq: nextDeviceSeq(),
			userId,
			competitionId,
		});
	}

	async function end() {
		setEnding(true);
		setEndError(null);
		try {
			await onEnd();
		} catch (e) {
			// Not ended (no signal, the site refused): the card stays, and says so.
			if (mounted.current) setEndError(toJudgeError(e));
		} finally {
			// A successful end closes this card: nothing left to update then.
			if (mounted.current) {
				setEnding(false);
				setAsking(null);
			}
		}
	}

	const others = rows
		.filter((r) => r.kind === 'attempt' && r.id !== activeId && r.state !== 'blocked' && r.state !== 'invalid')
		.map((r) => r.value);
	// The card's attempts in force (an extra's time on its attempt, a time still
	// waiting to be sent included) with the one about to be sent in its place.
	const withDraft = (() => {
		const values = card.attempts.map((s) => s.value);
		for (const r of rows) {
			if (r.attemptNo === null || r.state !== 'pending') continue;
			if (r.kind === 'extra' || !r.replacedBy) values[r.attemptNo - 1] = r.value;
		}
		if (confirming && activeRow?.attemptNo) values[activeRow.attemptNo - 1] = confirming.value;
		return values;
	})();
	const confirmTitle = activeRow
		? activeRow.kind === 'extra'
			? t('zkt_comp.judge_confirm_extra_title', {line: activeRow.label, no: activeRow.attemptNo, name: card.competitor.name})
			: t('zkt_comp.judge_confirm_title', {no: activeRow.attemptNo, name: card.competitor.name})
		: '';

	function stateText(row: Row): string {
		if (row.permit === 'CORRECT' && isSent(row)) return t('zkt_comp.judge_state_correct_ready');
		if (row.state === 'locked') return t('zkt_comp.judge_state_cutoff');
		if (row.state === 'empty' || row.state === 'later' || row.state === 'unused') return '';
		return t(`zkt_comp.judge_state_${row.state}`);
	}

	function stateIcon(row: Row): React.ReactNode {
		if (row.permit === 'CORRECT' && isSent(row)) return <PencilSimple size={14} weight="bold" />;
		switch (row.state) {
			case 'pending':
				return <Clock size={14} weight="bold" />;
			case 'sent':
				return <Check size={14} weight="bold" />;
			case 'accepted':
				return <CheckCircle size={14} weight="fill" />;
			case 'conflict':
			case 'blocked':
			case 'invalid':
				return <WarningCircle size={14} weight="fill" />;
			case 'locked':
				return <Lock size={14} weight="bold" />;
			default:
				return null;
		}
	}

	/** "2. çözüm: 12.34", or for an extra line "E1 (2. çözüm yerine): 11.50". */
	function lineTitle(row: Row): string {
		const shown = formatJudgeLine(row.value, row.dnfTime, card.round.eventId) || '-';
		return row.kind === 'extra'
			? t('zkt_comp.judge_permit_extra_line', {line: row.label, no: row.attemptNo, value: shown})
			: t('zkt_comp.judge_permit_attempt', {no: row.attemptNo, value: shown});
	}

	function openRequests(row: Row, target: HTMLElement) {
		const correct = {
			id: 'correct',
			label: t('zkt_comp.judge_correct'),
			icon: <PencilSimple size={20} />,
			onSelect: () => setPermitAsk({attemptNo: row.attemptNo!, purpose: 'CORRECT', rowId: row.id}),
		};
		// An extra line only takes a correction: a second extra for the same
		// attempt is not on the paper card.
		if (row.kind === 'extra') {
			menu.open({...anchorOf(target), title: lineTitle(row), message: t('zkt_comp.judge_correct_message'), items: [correct]});
			return;
		}
		menu.open({
			...anchorOf(target),
			title: lineTitle(row),
			message: t('zkt_comp.judge_requests_message'),
			items: [
				correct,
				{
					id: 'extra',
					label: t('zkt_comp.judge_extra'),
					icon: <PlusCircle size={20} />,
					disabled: extraLinesUsed >= EXTRA_LINES,
					note: t('zkt_comp.judge_extra_full'),
					onSelect: () => setPermitAsk({attemptNo: row.attemptNo!, purpose: 'EXTRA', rowId: row.id}),
				},
			],
		});
	}

	// A tap on a dock button must not take the focus from the field: the keyboard
	// would drop and the dock with it, under the finger.
	const keepFocus = (e: React.MouseEvent) => e.preventDefault();

	function renderRow(row: Row) {
		const active = row.id === activeId;
		const selectable = usable && isEditable(row);
		// A sent line changes only with an organiser's approval: tapping it opens
		// the requests, never the field. An attempt line an extra replaced is
		// closed (the paper keeps it as written); the extra line takes a correction.
		const canRequest =
			usable &&
			isSent(row) &&
			!row.permit &&
			((row.kind === 'attempt' && !row.replacedBy) || (row.kind === 'extra' && row.attemptNo !== null));
		const shown = formatJudgeLine(row.value, row.dnfTime, card.round.eventId);
		const state = stateText(row);

		let value: React.ReactNode;
		if (active) {
			value = (
				<span className={b('entry')}>
					<input
						ref={field}
						className={b('entry-input')}
						type="text"
						inputMode={keypadMode === 'moves' ? 'numeric' : 'decimal'}
						enterKeyHint="send"
						autoComplete="off"
						autoCorrect="off"
						spellCheck={false}
						aria-label={confirmTitle}
						placeholder={t('zkt_comp.judge_time_placeholder')}
						value={formatDraft(draft, keypadMode)}
						onChange={(e) => setDraft(draftFromText(e.target.value, draft, keypadMode))}
						onFocus={bringIntoView}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								askToSend();
							}
						}}
					/>
					{draft.penalty > 0 && (
						<button
							type="button"
							className={b('entry-penalty')}
							aria-label={t('zkt_comp.judge_penalty_clear')}
							onMouseDown={keepFocus}
							onClick={() => setDraft((d) => ({...d, penalty: 0}))}
						>
							+{draft.penalty / 100}
							<X size={12} weight="bold" />
						</button>
					)}
				</span>
			);
		} else if (shown) {
			value = <span className={b('row-value')}>{shown}</span>;
		} else {
			value = <span className={b('row-value')} />;
		}

		const content = (
			<>
				<span className={b('row-no')}>{row.label}</span>
				<span className={b('row-body')}>
					{value}
					{/* Which attempt an extra belongs to, written on both lines as on paper. */}
					{row.replacedBy && <span className={b('row-tag')}>{t('zkt_comp.judge_extra_to', {line: row.replacedBy})}</span>}
					{row.kind === 'extra' && row.attemptNo !== null && (
						<span className={b('row-tag')}>{t('zkt_comp.judge_extra_for', {no: row.attemptNo})}</span>
					)}
					{/* Why Gönder stays off: a DNF or DNS goes with its reading (owner, 2026-11-14). */}
					{active && keypadMode === 'time' && draft.special && !draft.digits && (
						<span className={b('row-tag')}>
							{t(draft.special === 'DNF' ? 'zkt_comp.judge_needs_reading_dnf' : 'zkt_comp.judge_needs_reading_dns')}
						</span>
					)}
					{!active && state && (
						<span className={b('row-state')}>
							{stateIcon(row)}
							{state}
						</span>
					)}
					{canRequest && <DotsThreeVertical className={b('row-more')} size={20} weight="bold" aria-hidden="true" />}
				</span>
			</>
		);

		return (
			<li key={row.id} className={b('row', {state: row.state, active})}>
				{canRequest ? (
					<button type="button" className={b('row-main', {tap: true})} onClick={(e) => openRequests(row, e.currentTarget)}>
						{content}
					</button>
				) : selectable && !active ? (
					<button type="button" className={b('row-main', {tap: true})} onClick={() => selectRow(row.id)}>
						{content}
					</button>
				) : (
					<div className={b('row-main')}>{content}</div>
				)}
				{active && row.permit && (
					<p className={b('row-note')}>
						{row.permit === 'EXTRA'
							? t('zkt_comp.judge_permit_ready_extra', {line: row.label, no: row.attemptNo})
							: t('zkt_comp.judge_permit_ready_correct', {value: shown})}
					</p>
				)}
				{row.refused && (
					<p className={b('row-note', {error: true})}>{t(`zkt_comp.judge_refused_${row.refused.toLowerCase()}`)}</p>
				)}
				{(row.state === 'blocked' || row.state === 'invalid') && row.item && (
					<p className={b('row-note', {error: true})}>
						{t(row.state === 'blocked' ? 'zkt_comp.judge_blocked_note' : 'zkt_comp.judge_invalid_note')}{' '}
						<button type="button" className={b('link')} onClick={() => void getJudgeOutbox().discard(row.item!.submissionId)}>
							{t('zkt_comp.judge_discard')}
						</button>
					</p>
				)}
			</li>
		);
	}

	const attemptRows = rows.filter((r) => r.kind === 'attempt');
	const extraRows = rows.filter((r) => r.kind === 'extra');
	const limit = card.round.timeLimitCs;
	const cutoff = card.round.cutoffCs && card.round.cutoffAttempts ? card.round.cutoffCs : null;
	const showNoShow = usable && nothingEntered && !card.noShow && !noShowPending;
	// Every line the card takes is in (or the competitor did not come): judges
	// forgot to end their judging here, so the card asks for it (owner, 2026-11-14).
	const cardDone = usable && (!activeRow || card.noShow || noShowPending);
	// The dock rides on the keyboard; under it the page keeps room for the dock.
	const dockOpen = !!activeRow && !cardDone && !confirming && !permitAsk;
	const doneOpen = cardDone && !confirming && !permitAsk && !asking;

	return (
		<div className={b('card', {docked: dockOpen || doneOpen})} style={keyboardInset ? {paddingBottom: keyboardInset} : undefined}>
			<button type="button" className={scheduleBlock('back')} onClick={onBack}>
				<CaretLeft size={18} weight="bold" />
				{t('zkt_comp.judge_other_cards')}
			</button>

			{switcher}

			<header className={b('sc-head')}>
				<span className={b('sc-event')}>
					{localEventName(t, card.round.eventId)} · {t('zkt_comp.judge_round_n', {n: card.round.roundNumber})}
				</span>
				<h2 className={b('sc-name')}>{card.competitor.name}</h2>
				<dl className={b('facts')}>
					{card.group?.number != null && (
						<div className={b('fact')}>
							<dt>{t('my_schedule.col_group')}</dt>
							<dd>{card.group.number}</dd>
						</div>
					)}
					{card.station != null && (
						<div className={b('fact')}>
							<dt>{t('zkt_comp.judge_station')}</dt>
							<dd>{card.station}</dd>
						</div>
					)}
					{card.round.dualChance && (
						<div className={b('fact')}>
							<dt>{t('zkt_comp.judge_chance')}</dt>
							<dd>{card.chance}</dd>
						</div>
					)}
					<div className={b('fact', {wide: true})}>
						<dt>{t('zkt_comp.judge_judge')}</dt>
						<dd className={b('fact-text')}>{card.judgeName}</dd>
					</div>
				</dl>
				{(limit || cutoff) && (
					<p className={b('sc-rules')}>
						{limit ? (
							<span>
								{t(card.round.timeLimitCumulative ? 'zkt_comp.judge_limit_cumulative' : 'my_schedule.time_limit')}{' '}
								<strong>{formatWcaTime(limit)}</strong>
							</span>
						) : null}
						{cutoff ? (
							<span>
								{t('my_schedule.cutoff')} <strong>{formatWcaTime(cutoff)}</strong>{' '}
								({t('my_schedule.cutoff_attempts', {count: card.round.cutoffAttempts})})
							</span>
						) : null}
					</p>
				)}
			</header>

			{outbox.paused === 'auth' && <p className={b('notice', {error: true})}>{t('zkt_comp.judge_error_auth')}</p>}
			{outbox.paused !== 'auth' && outbox.offline && waiting + (noShowPending ? 1 : 0) > 0 && (
				<p className={b('notice', {warning: true})}>{t('zkt_comp.judge_offline')}</p>
			)}
			{card.cardStatus === 'ACCEPTED' && <p className={b('notice')}>{t('zkt_comp.judge_card_accepted')}</p>}
			{card.cardStatus === 'CANCELLED' && <p className={b('notice')}>{t('zkt_comp.judge_card_cancelled')}</p>}
			{(card.noShow || noShowPending) && <p className={b('notice')}>{t('zkt_comp.judge_no_show_marked')}</p>}
			{mode === 'unsupported' && <p className={b('notice')}>{t('zkt_comp.judge_event_unsupported')}</p>}
			{endError && <p className={b('notice', {error: true})}>{t(judgeErrorKey(endError.code))}</p>}

			<section className={b('section')}>
				<h3 className={b('section-title')}>{t('zkt_comp.judge_section_attempts')}</h3>
				<ol className={b('rows')}>{attemptRows.map(renderRow)}</ol>
			</section>

			<section className={b('section')}>
				<div className={b('section-head')}>
					<h3 className={b('section-title')}>{t('zkt_comp.judge_section_extras')}</h3>
					<span className={b('section-hint')}>{t('zkt_comp.judge_extras_hint')}</span>
				</div>
				<ol className={b('rows', {extra: true})}>{extraRows.map(renderRow)}</ol>
			</section>

			{showNoShow && (
				<ul className={b('actions-list')}>
					<li>
						<button type="button" className={b('action-row')} onClick={() => setAsking('no_show')}>
							<UserMinus size={22} />
							<span className={b('action-text')}>
								<span className={b('action-label')}>{t('zkt_comp.judge_no_show')}</span>
								<span className={b('action-desc')}>{t('zkt_comp.judge_no_show_desc')}</span>
							</span>
						</button>
					</li>
				</ul>
			)}

			{/* Its own red-framed box, not one more row: judges walked past it. */}
			<ul className={b('actions-list', {end: true})}>
				<li>
					<button type="button" className={b('action-row', {danger: true})} onClick={() => setAsking('end')}>
						<SignOut size={22} />
						<span className={b('action-text')}>
							<span className={b('action-label')}>{t('zkt_comp.judge_end')}</span>
							<span className={b('action-desc')}>{t('zkt_comp.judge_end_desc')}</span>
						</span>
					</button>
				</li>
			</ul>

			{doneOpen && (
				<div className={b('done')} style={{bottom: keyboardInset}} role="status">
					<div className={b('done-inner')}>
						<CheckCircle className={b('done-icon')} size={24} weight="fill" />
						<span className={b('done-text')}>
							<span className={b('done-title')}>
								{t(card.noShow || noShowPending ? 'zkt_comp.judge_done_title_no_show' : 'zkt_comp.judge_done_title')}
							</span>
							<span className={b('done-desc')}>{t('zkt_comp.judge_done_desc')}</span>
						</span>
						<Button theme={CommonType.PRIMARY} text={t('zkt_comp.judge_end_short')} onClick={() => setAsking('end')} />
					</div>
				</div>
			)}

			{dockOpen && (
				<div className={b('dock')} style={{bottom: keyboardInset}} role="toolbar" aria-label={confirmTitle}>
					<div className={b('dock-inner')}>
						<button
							type="button"
							className={b('dock-key', {on: draft.special === 'DNF'})}
							onMouseDown={keepFocus}
							onClick={() => press('DNF')}
						>
							DNF
						</button>
						<button
							type="button"
							className={b('dock-key', {on: draft.special === 'DNS'})}
							onMouseDown={keepFocus}
							onClick={() => press('DNS')}
						>
							DNS
						</button>
						{keypadMode === 'time' && (
							<button
								type="button"
								className={b('dock-key', {on: draft.penalty > 0})}
								disabled={!draft.digits || draft.digits === ZERO_DIGITS || !!draft.special}
								onMouseDown={keepFocus}
								onClick={() => press('+2')}
							>
								+2
							</button>
						)}
						<button type="button" className={b('dock-key', {send: true})} disabled={!value} onClick={askToSend}>
							{t('zkt_comp.judge_send')}
							{sendToStation && card.station != null && (
								<span className={b('dock-send-to')}>{t('zkt_comp.judge_send_to', {station: card.station})}</span>
							)}
						</button>
					</div>
				</div>
			)}

			{menu.element}

			{confirming && activeRow && (
				<div className={b('sheet')} role="dialog" aria-modal="true">
					<div className={b('sheet-body')}>
						<span className={b('sheet-title')}>{confirmTitle}</span>
						<span className={b('big')}>{formatJudgeLine(confirming.value, confirming.rawValue, card.round.eventId)}</span>
						{confirming.penalty > 0 && confirming.rawValue !== null && (
							<span className={b('hint')}>
								{formatJudgeValue(confirming.rawValue, card.round.eventId)} + {confirming.penalty / 100}
							</span>
						)}
						{exceedsTimeLimit(confirming.value, card.round) && (
							<p className={b('notice', {warning: true})}>{t('zkt_comp.judge_warn_limit')}</p>
						)}
						{inconsistentWithCard(confirming.value, others) && (
							<p className={b('notice', {warning: true})}>{t('zkt_comp.judge_warn_inconsistent')}</p>
						)}
						{/* The rest of the desk's typing checks (site scoretaking/warnings.ts). */}
						{farBelowRecord(confirming.value, card.records?.single) && (
							<p className={b('notice', {warning: true})}>
								{t('zkt_comp.judge_warn_record', {record: formatJudgeValue(card.records!.single, card.round.eventId)})}
							</p>
						)}
						{averageFarBelowRecord(withDraft, card.round.format, card.records?.average, card.round.eventId) && (
							<p className={b('notice', {warning: true})}>
								{t('zkt_comp.judge_warn_record_average', {record: formatJudgeAverage(card.records!.average, card.round.eventId)})}
							</p>
						)}
						{dnsBeforeValid(withDraft) && <p className={b('notice', {warning: true})}>{t('zkt_comp.judge_warn_dns')}</p>}
						<p className={b('hint')}>{t('zkt_comp.judge_confirm_note')}</p>
						<div className={b('actions')}>
							<Button large fullWidth theme={CommonType.PRIMARY} text={t('zkt_comp.judge_send')} onClick={send} />
							<Button large fullWidth theme={CommonType.GRAY} text={t('zkt_comp.judge_fix')} onClick={() => setConfirming(null)} />
						</div>
					</div>
				</div>
			)}

			{permitAsk && (
				<JudgePermitSheet
					competitionId={competitionId}
					cardId={card.cardId}
					attemptNo={permitAsk.attemptNo}
					purpose={permitAsk.purpose}
					currentValue={rows.find((r) => r.id === permitAsk.rowId)?.value ?? null}
					extraLine={rows.find((r) => r.id === permitAsk.rowId && r.kind === 'extra')?.label ?? null}
					eventId={card.round.eventId}
					onClose={() => setPermitAsk(null)}
					onApproved={() => {
						setPermitAsk(null);
						setSelected(null);
						setDraft(EMPTY_DRAFT);
						// The permit arrives with the card; the line it opens becomes the
						// active one by itself. Then the keyboard opens for it.
						void onRefresh().then(() => setTimeout(() => field.current?.focus(), 0));
					}}
				/>
			)}

			{asking && (
				<div className={b('sheet')} role="dialog" aria-modal="true">
					<div className={b('sheet-body')}>
						<p className={b('sheet-text')}>
							{asking === 'no_show'
								? t('zkt_comp.judge_no_show_confirm', {name: card.competitor.name})
								: waiting > 0
									? t('zkt_comp.judge_end_confirm_waiting', {count: waiting})
									: t('zkt_comp.judge_end_confirm')}
						</p>
						<div className={b('actions')}>
							{asking === 'no_show' ? (
								<Button large fullWidth theme={CommonType.PRIMARY} text={t('zkt_comp.judge_no_show')} onClick={markNoShow} />
							) : (
								<Button large fullWidth theme={CommonType.DANGER} text={t('zkt_comp.judge_end')} onClick={end} loading={ending} />
							)}
							<Button large fullWidth theme={CommonType.GRAY} text={t('zkt_comp.judge_cancel')} onClick={() => setAsking(null)} />
						</div>
					</div>
				</div>
			)}
		</div>
	);
});

export default JudgeCard;
