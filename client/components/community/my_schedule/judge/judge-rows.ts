// The lines of a judge card as the phone draws them: the attempt lines and the
// two extra lines of the paper scorecard, each with what it shows and whether it
// takes a new time. Pure (no React), so it is unit tested
// (__tests__/judge_rows.test.ts); JudgeCard.tsx renders what this returns.

import {OutboxItem, OutboxSnapshot} from '../../../../util/judge-outbox';
import {cutoffMissed, JUDGE_DNF, JudgeCard as JudgeCardData} from '../../../../../shared/zkt_judge';
/** A paper scorecard has two extra lines under the attempts; so does this one. */
export const EXTRA_LINES = 2;

export type RowState = 'empty' | 'pending' | 'sent' | 'accepted' | 'conflict' | 'blocked' | 'invalid' | 'locked' | 'unused';

export interface Row {
	/** 'a1'..'a5' for the attempt lines, 'e1' / 'e2' for the extra lines. */
	id: string;
	kind: 'attempt' | 'extra';
	/** Printed in the first column: 1..5, E1, E2. */
	label: string;
	/** The attempt a time typed here is sent for (an extra line: the attempt it replaces). */
	attemptNo: number | null;
	value: number | null;
	/** On a DNF: the time the judge wrote beside it ("DNF (12.34)"), when there is one. */
	dnfTime?: number | null;
	state: RowState;
	/** Attempt line: the extra line that replaced it ("E1"). */
	replacedBy: string | null;
	/** An approved, unused permit this line may spend with one new time. */
	permit: 'CORRECT' | 'EXTRA' | null;
	/** The outbox entry behind a pending, blocked or invalid line. */
	item?: OutboxItem;
	/** Why the last time typed for this line did not land. */
	refused?: string;
}

export const isSent = (row: Row) => row.state === 'sent' || row.state === 'conflict';
/**
 * The line takes a new time: an empty attempt, a sent line (attempt or extra)
 * reopened by a correction, an extra line given out.
 */
export const isEditable = (row: Row) =>
	(row.kind === 'attempt' && row.state === 'empty') ||
	(row.permit === 'CORRECT' && isSent(row)) ||
	(row.kind === 'extra' && row.permit === 'EXTRA' && row.state === 'unused');

/** A DNF waiting in the outbox carries its time as the timer reading. */
const itemDnfTime = (item: OutboxItem) => (item.value === JUDGE_DNF ? (item.rawValue ?? null) : null);

function stateOf(slotState: string): RowState {
	return slotState === 'conflict' ? 'conflict' : slotState === 'confirmed' || slotState === 'accepted' ? 'accepted' : 'sent';
}

export function buildRows(card: JudgeCardData, outbox: OutboxSnapshot, userId: string): Row[] {
	const mine = outbox.items.filter((i) => i.cardId === card.cardId && i.userId === userId && i.kind === 'ATTEMPT');
	const newest = (list: OutboxItem[]) => [...list].sort((a, c) => c.deviceSeq - a.deviceSeq)[0];
	const permits = card.permits || [];

	// Extra lines in the order the extras were used, then the one an approved
	// extra permit is waiting to fill. More than two never happens on paper.
	// The site keeps that order (extraAttempts); a site answer from before it
	// did falls back to attempt order.
	const extraSlots = card.attempts.filter((s) => s.extra).map((s) => s.no);
	const usedExtras = card.extraAttempts
		? card.extraAttempts.filter((no) => extraSlots.includes(no))
		: extraSlots;
	// A correction on an attempt whose extra is in force changes the extra line.
	const onExtraLine = (attemptNo: number | null) => attemptNo !== null && usedExtras.includes(attemptNo);
	const pendingExtras = mine.filter((i) => i.permit === 'EXTRA' && !usedExtras.includes(i.attemptNo!)).map((i) => i.attemptNo!);
	const waitingExtra = permits.find(
		(p) => p.purpose === 'EXTRA' && p.attemptNo && !usedExtras.includes(p.attemptNo) && !pendingExtras.includes(p.attemptNo)
	);
	const extraFor = [...usedExtras, ...pendingExtras, ...(waitingExtra ? [waitingExtra.attemptNo!] : [])].slice(0, EXTRA_LINES);
	const extraLabel = (attemptNo: number) => {
		const i = extraFor.indexOf(attemptNo);
		return i === -1 ? null : `E${i + 1}`;
	};

	const attemptRows: Row[] = card.attempts.map((slot) => {
		const notice = outbox.notices.find(
			(n) => n.cardId === card.cardId && n.kind === 'ATTEMPT' && n.attemptNo === slot.no
		);
		const replacedBy = extraLabel(slot.no);
		const base = {id: `a${slot.no}`, kind: 'attempt' as const, label: String(slot.no), attemptNo: slot.no, replacedBy};
		const item = newest(
			mine.filter((i) => i.attemptNo === slot.no && i.permit !== 'EXTRA' && !(i.permit === 'CORRECT' && onExtraLine(slot.no)))
		);
		const correction = permits.find((p) => p.purpose === 'CORRECT' && p.attemptNo === slot.no);
		const permit = correction && !(item && item.permit === 'CORRECT') ? ('CORRECT' as const) : null;
		if (item) return {...base, value: item.value, dnfTime: itemDnfTime(item), state: item.state === 'pending' ? 'pending' : item.state, permit, item};
		if (replacedBy && slot.extra) {
			// The site's value is the extra's; this line keeps what was written on it.
			return {...base, value: slot.original ?? null, dnfTime: slot.originalDnfTime ?? null, state: 'sent', permit: null};
		}
		if (slot.value !== null) return {...base, value: slot.value, dnfTime: slot.dnfTime ?? null, state: stateOf(slot.state), permit};
		return {...base, value: null, state: 'empty', permit: null, refused: notice?.outcome};
	});

	const extraRows: Row[] = Array.from({length: EXTRA_LINES}, (_, i) => {
		const attemptNo = extraFor[i] ?? null;
		const base = {id: `e${i + 1}`, kind: 'extra' as const, label: `E${i + 1}`, attemptNo, replacedBy: null};
		if (attemptNo === null) return {...base, value: null, state: 'unused', permit: null};
		const item = newest(
			mine.filter((x) => x.attemptNo === attemptNo && (x.permit === 'EXTRA' || (x.permit === 'CORRECT' && onExtraLine(attemptNo))))
		);
		// "Süre düzelt" on the extra line, approved by QR like on an attempt line.
		const correction = permits.find((p) => p.purpose === 'CORRECT' && p.attemptNo === attemptNo);
		const permit = correction && !(item && item.permit === 'CORRECT') ? ('CORRECT' as const) : null;
		if (item) return {...base, value: item.value, dnfTime: itemDnfTime(item), state: item.state === 'pending' ? 'pending' : item.state, permit, item};
		const slot = card.attempts.find((s) => s.no === attemptNo);
		if (slot && slot.extra && slot.value !== null) return {...base, value: slot.value, dnfTime: slot.dnfTime ?? null, state: stateOf(slot.state), permit};
		return {...base, value: null, state: 'unused', permit: 'EXTRA'};
	});

	// Once the cutoff attempts are in and none made it, the rest of the card is closed.
	const effective = card.attempts.map((s) => s.value);
	if (cutoffMissed(effective, card.round)) {
		for (const row of attemptRows) {
			if (row.attemptNo! > (card.round.cutoffAttempts || 0) && row.state === 'empty') row.state = 'locked';
		}
	}
	return [...attemptRows, ...extraRows];
}
