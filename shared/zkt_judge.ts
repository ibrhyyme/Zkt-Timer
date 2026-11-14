// Online score entry (a judge types the times on their own phone).
//
// The federation site owns every rule; Zkt-Timer's server only relays calls on
// behalf of the signed-in member (server/services/ZktJudgeRelay.ts). These are
// the shapes the site answers with, plus the small pure helpers the phone needs
// to behave sensibly before the site has answered (keypad value, cutoff lock,
// which outcome counts as "sent").
//
// Source of truth for the contract: zekakuputurkiye-site lib/zkt/judge/service.ts.
// Nothing here imports Node or browser APIs: both sides use it.

export const JUDGE_DNF = -1;
export const JUDGE_DNS = -2;

export type JudgePurpose = 'JUDGE' | 'CORRECT' | 'EXTRA';

export type JudgeWarning = 'COMPETES_IN_GROUP' | 'NOT_ASSIGNED_JUDGE';

export type JudgeChoice =
	| {kind: 'self'}
	| {kind: 'competitor'; key: string}
	| {kind: 'external'; name: string};

export interface JudgeRound {
	id: string;
	eventId: string;
	roundNumber: number;
	format: string;
	status: string;
	dualChance: boolean;
	attemptCount: number;
	timeLimitCs: number | null;
	timeLimitCumulative: boolean;
	cutoffCs: number | null;
	cutoffAttempts: number | null;
}

export type JudgeSlotState = 'empty' | 'sent' | 'confirmed' | 'conflict' | 'accepted';

export interface JudgeSlot {
	no: number;
	value: number | null;
	extra: boolean;
	/** On an extra's slot: the time the attempt line itself held before the extra replaced it. */
	original?: number | null;
	/** A DNF's value with the time the judge wrote beside it (site: dnfTimesFor). */
	dnfTime?: number;
	/** The same for the attempt line under an extra. */
	originalDnfTime?: number;
	state: JudgeSlotState;
}

export interface JudgePermit {
	grantId: string;
	purpose: 'CORRECT' | 'EXTRA';
	attemptNo: number | null;
	expiresAt: string;
}

export interface JudgeCard {
	grantId: string;
	cardId: string;
	expiresAt: string;
	round: JudgeRound;
	group: {id: string; number: number | null} | null;
	chance: number;
	competitor: {key: string; name: string};
	station: number | null;
	judgeName: string;
	cardStatus: 'OPEN' | 'ACCEPTED' | 'CANCELLED';
	noShow: boolean;
	expected: number;
	filled: number;
	completed: boolean;
	attempts: JudgeSlot[];
	/** Attempt numbers whose extra is in force, in the order the extras were used: the first is E1. */
	extraAttempts?: number[];
	/** The event's standing ZKT records, for the typing check (null: none yet, or an older site). */
	records?: {single: number | null; average: number | null};
	permits: JudgePermit[];
}

export type JudgeEndReason =
	| 'SUPERSEDED'
	| 'JUDGE_LEFT'
	| 'STAFF'
	| 'ROUND_FINISHED'
	| 'CARD_ACCEPTED'
	| 'USED'
	| 'REJECTED';

export interface JudgeEnded {
	grantId: string;
	cardId: string | null;
	reason: JudgeEndReason | null;
	endedAt: string;
	competitorName: string | null;
}

export interface JudgeMe {
	/** False when the member has no ZKT link: the relay cannot ask the site at all. */
	linked: boolean;
	enabled: boolean;
	competitionId?: string;
	request?: {jti: string; status: 'pending' | 'approved' | 'rejected'; grantId?: string; cardId?: string | null} | null;
	cards?: JudgeCard[];
	ended?: JudgeEnded[];
}

export interface JudgeBoardCompetitor {
	key: string;
	name: string;
	number: number | null;
	station: number | null;
	/** The viewer's own line (site, 2026-11-14); absent from older site answers. */
	self?: boolean;
	card: {
		status: 'OPEN' | 'ACCEPTED' | 'CANCELLED';
		noShow: boolean;
		filled: number;
		expected: number;
		completed: boolean;
		judgeName: string | null;
		// Only for a member who may approve judges (the organiser panel).
		id?: string;
		grantId?: string | null;
		holderName?: string | null;
		judgeStation?: number | null;
		approvedByName?: string | null;
		approvedAt?: string | null;
		lastEntryAt?: string | null;
		attempts?: (number | null)[];
		extraAttempts?: number[];
	} | null;
}

export interface JudgeBoardGroup {
	id: string;
	number: number;
	chance: number;
	judges: string[];
	competitors: JudgeBoardCompetitor[];
}

export interface JudgeBoard {
	competitionId: string;
	canApprove: boolean;
	canApproveExtra: boolean;
	/** Without a round: every round of the competition. */
	rounds?: JudgeRound[];
	round?: JudgeRound;
	groups?: JudgeBoardGroup[];
}

export interface JudgeRequestResult {
	purpose: JudgePurpose;
	token: string;
	jti: string;
	expiresAt: string;
	approveUrl: string;
	qrSvg: string;
	round: JudgeRound;
	group?: {id: string; number: number};
	chance?: number;
	competitor: {key?: string; name: string; number?: number | null};
	station?: number | null;
	judge?: {name: string; external: boolean; differsFromHolder: boolean};
	warnings?: JudgeWarning[];
	canSelfAuthorize: boolean;
	/** The judge "Bu cihazı yetkilendir" would replace; only sent to approvers (JUDGE). */
	currentJudge?: {name: string; holderName: string} | null;
}

/**
 * What an organiser sees after scanning a judge's QR. Somebody who may not
 * decide gets only `purpose`, `canApprove: false` and `reason`: nothing about
 * the person or the card.
 */
export interface JudgeApprovalPreview {
	purpose: JudgePurpose;
	canApprove: boolean;
	/** NO_PERMISSION, EXTRA_DELEGATES_ONLY, or a site code (ROUND_FINISHED, CARD_LOCKED, NOT_HOLDER...). */
	reason?: string;
	expiresAt?: string;
	requester?: {name: string; zktId: string | null; avatarUrl: string | null} | null;
	decision?: {status: 'approved' | 'rejected'; grantId: string; decidedBy: string; decidedAt: string};
	competition?: {id: string; slug: string; name: string};
	round?: JudgeRound;
	group?: {id: string; number: number};
	chance?: number;
	/** avatarUrl: the profile picture, when the site sends one (2026-11-14). */
	competitor?: {key?: string; name: string; number?: number | null; avatarUrl?: string | null};
	station?: number | null;
	judge?: {name: string; external: boolean; differsFromHolder?: boolean; avatarUrl?: string | null} | null;
	warnings?: JudgeWarning[];
	/** The judge this approval would replace (JUDGE). */
	currentJudge?: {name: string; holderName: string} | null;
	/**
	 * The card this JUDGE approval reopens, when it exists (site, 2026-11-14): how
	 * far it got, Gelmedi, and who ended its judging. Null for a card not opened
	 * yet; absent from older site answers.
	 */
	card?: {filled: number; expected: number; noShow: boolean; endedJudge: string | null} | null;
	/** The attempt a correction or an extra is asked for. */
	attempt?: {no: number | null; value: number | null; extra: boolean};
}

/** Hosts an approval QR may point at. Anything else is not ours and is refused. */
export const JUDGE_APPROVE_HOSTS = ['zktimer.app', 'www.zktimer.app'];

/**
 * The token of a judge approval QR, or null when the text is not one. The QR is
 * a Zkt-Timer address (`https://zktimer.app/judge/approve?t=...`); a local site
 * may still print the production host, so the current host is accepted too.
 */
export function parseJudgeApproveToken(text: string, extraHosts: string[] = []): string | null {
	let url: URL;
	try {
		url = new URL((text || '').trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	const hosts = [...JUDGE_APPROVE_HOSTS, ...extraHosts.filter(Boolean)].map((h) => h.toLowerCase());
	if (!hosts.includes(url.host.toLowerCase())) return null;
	if (url.pathname.replace(/\/+$/, '') !== '/judge/approve') return null;
	const token = url.searchParams.get('t');
	// The site's token is "<kid>.<base64url>"; the relay refuses anything over 1024.
	if (!token || token.length > 1024 || !/^[A-Za-z0-9_.-]+$/.test(token)) return null;
	return token;
}

export interface JudgeGrantResult {
	status: 'approved' | 'rejected';
	grantId: string;
	purpose: JudgePurpose;
	cardId: string | null;
	superseded: {name: string; holderName: string} | null;
}

export type JudgeEntryOutcome =
	| 'APPLIED'
	| 'CONFIRMED'
	| 'CONFLICT'
	| 'LATE'
	| 'REJECTED_SCOPE'
	| 'REJECTED_LOCKED'
	| 'REJECTED_SENT'
	| 'REJECTED_CUTOFF';

export interface JudgeEntryItem {
	submissionId: string;
	cardId: string;
	kind: 'ATTEMPT' | 'NO_SHOW';
	attemptNo: number | null;
	value: number | null;
	rawValue: number | null;
	penalty: number;
	permit: 'CORRECT' | 'EXTRA' | null;
	deviceSeq: number;
}

export interface JudgeEntryResult {
	submissionId: string;
	/** 200 processed, 403 not this card's judge, 404 unknown card, 409 switch off, 422 malformed. */
	status: number;
	outcome?: JudgeEntryOutcome;
	appliedValue?: number | null;
	error?: string;
	card?: {
		id: string;
		status: 'OPEN' | 'ACCEPTED' | 'CANCELLED';
		attempts: (number | null)[];
		extraAttempts: number[];
		noShow: boolean;
		completed: boolean;
	};
}

/** The outcomes that put the time on the judge card. Anything else was not sent. */
export function outcomeLanded(outcome: JudgeEntryOutcome | undefined | null): boolean {
	return outcome === 'APPLIED' || outcome === 'CONFIRMED' || outcome === 'CONFLICT';
}

// ---------------------------------------------------------------------------
// Keypad value
// ---------------------------------------------------------------------------

/** Events whose result is not a time. FMC is a move count; MBLD is packed and is not typed on the phone. */
export function judgeEntryMode(eventId: string): 'time' | 'moves' | 'unsupported' {
	if (eventId === '333fm') return 'moves';
	if (eventId === '333mbf') return 'unsupported';
	return 'time';
}

/**
 * Digits typed on the keypad to centiseconds, positionally ("1224" is 12.24,
 * "12345" is 1:23.45). The same rule as the desk's time field on the site
 * (lib/zkt/format.ts timeDigitsToCs): null when nothing usable was typed, or
 * when the seconds or minutes pair reads 60 or more.
 */
export function digitsToCentiseconds(digits: string): number | null {
	const onlyDigits = digits.replace(/\D/g, '').slice(-8);
	if (!onlyDigits) return null;
	const n = parseInt(onlyDigits, 10) || 0;
	if (n === 0) return null;
	const str = String(n).padStart(8, '0');
	const hh = parseInt(str.slice(0, 2), 10);
	const mm = parseInt(str.slice(2, 4), 10);
	const ss = parseInt(str.slice(4, 6), 10);
	const cc = parseInt(str.slice(6, 8), 10);
	if (ss >= 60 || mm >= 60) return null;
	return hh * 360000 + mm * 6000 + ss * 100 + cc;
}

export interface KeypadDraft {
	digits: string;
	/** Centiseconds added on top of the timer reading, in +2 steps. */
	penalty: number;
	special: 'DNF' | 'DNS' | null;
}

export const EMPTY_DRAFT: KeypadDraft = {digits: '', penalty: 0, special: null};

/**
 * The digits of a timer that read 0.00 (it never started). Kept as one "0" on a
 * timed event: alone it is no time, but a DNF or DNS needs a reading typed with
 * it (owner, 2026-11-14) and 0.00 is the reading when there was none.
 */
export const ZERO_DIGITS = '0';

/** The site refuses a penalty past +16 as a typo. */
export const MAX_PENALTY_CS = 1600;
const MAX_DIGITS = 7;

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'DNF' | 'DNS' | '+2' | 'DEL';

/**
 * A DNF keeps the time typed with it on a timed event (the team's ask, 12 Nov:
 * "süreli ama DNF"; the paper scorecard has the time and the DNF on one line).
 * The official result is DNF all the same; the time travels as `rawValue`.
 * On a timed event a DNF or DNS is sent only with a reading typed beside it
 * (owner, 2026-11-14): a DNF with the time the timer showed or 0.00, a DNS with
 * 0.00 and nothing else. FMC (moves) has no time beside either.
 */
export function pressKey(draft: KeypadDraft, key: KeypadKey, mode: 'time' | 'moves' = 'time'): KeypadDraft {
	if (mode === 'time' && (key === 'DNF' || key === 'DNS')) {
		// Pressed again: the DNF or DNS goes, the time stays.
		if (draft.special === key) return draft.digits ? {digits: draft.digits, penalty: 0, special: null} : EMPTY_DRAFT;
		// A DNS keeps only a 0.00; a DNF keeps whatever was typed.
		const digits = key === 'DNS' && draft.digits !== ZERO_DIGITS ? '' : draft.digits;
		return {digits, penalty: 0, special: key};
	}
	if (key === 'DNF' || key === 'DNS') {
		return draft.special === key ? EMPTY_DRAFT : {digits: '', penalty: 0, special: key};
	}
	if (key === 'DEL') {
		if (draft.special && draft.digits) return {...draft, digits: draft.digits.slice(0, -1)};
		if (draft.special) return EMPTY_DRAFT;
		// The last thing typed goes first: a penalty is added after the digits.
		if (draft.penalty > 0) return {...draft, penalty: draft.penalty - 200};
		return {...draft, digits: draft.digits.slice(0, -1)};
	}
	if (key === '+2') {
		if (mode !== 'time' || draft.special || !draft.digits || draft.digits === ZERO_DIGITS) return draft;
		return draft.penalty >= MAX_PENALTY_CS ? draft : {...draft, penalty: draft.penalty + 200};
	}
	if (mode === 'time' && draft.special === 'DNS') {
		// A 0 is the DNS's reading; any other digit starts a time over it.
		return key === '0' ? {...draft, digits: ZERO_DIGITS} : {digits: key, penalty: 0, special: null};
	}
	// FMC: a digit after a DNF or DNS starts a move count.
	if (draft.special && mode !== 'time') return {digits: key === '0' ? '' : key, penalty: 0, special: null};
	if (mode === 'time' && (!draft.digits || draft.digits === ZERO_DIGITS)) {
		return {...draft, digits: key === '0' ? ZERO_DIGITS : key};
	}
	const maxDigits = mode === 'moves' ? 3 : MAX_DIGITS;
	if (draft.digits.length >= maxDigits) return draft;
	if (!draft.digits && key === '0') return draft;
	return {...draft, digits: draft.digits + key};
}

/**
 * The draft after the judge typed in the row's field on the phone's own
 * keyboard. `text` is the whole field as it reads now.
 *
 * Digits are read positionally, as on the keypad. DNF and DNS have no key on a
 * phone's number pad, so they are reached the way the desk reaches them: a lone
 * "." is DNF and a lone "," is DNS; on a keyboard with letters D, F, "/" or "#"
 * give DNF and S or "*" give DNS. "+" adds a +2.
 */
export function draftFromText(text: string, prev: KeypadDraft, mode: 'time' | 'moves' = 'time'): KeypadDraft {
	const raw = (text || '').trim().toUpperCase();
	const maxDigits = mode === 'moves' ? 3 : MAX_DIGITS;
	// The field shows a 0 reading as "0.00", so a backspace leaves "0.0": still
	// zeros, but shorter than what was shown. That is the judge deleting it.
	const shrank = raw.length < formatDraft(prev, mode).length;
	const cleanDigits = (s: string) => {
		const all = s.replace(/\D/g, '');
		const digits = all.replace(/^0+/, '').slice(0, maxDigits);
		if (digits || !all || mode !== 'time') return digits;
		return prev.digits === ZERO_DIGITS && shrank ? '' : ZERO_DIGITS;
	};
	// A DNS takes no reading but 0.00.
	const dnsDigits = (s: string) => (mode === 'time' && cleanDigits(s) === ZERO_DIGITS ? ZERO_DIGITS : '');

	if (prev.special === 'DNF' && mode === 'time') {
		// The field reads "DNF" or "DNF 12.34" (formatDraft). Digits typed or
		// deleted change the time; deleting into the word drops the DNF.
		if (!raw.includes('DNF')) {
			const digits = cleanDigits(raw);
			return digits ? {digits, penalty: 0, special: null} : EMPTY_DRAFT;
		}
		const typed = raw.replace('DNF', '');
		if (/[S*]/.test(typed)) return {digits: dnsDigits(typed), penalty: 0, special: 'DNS'};
		return {digits: cleanDigits(typed), penalty: 0, special: 'DNF'};
	}

	if (prev.special === 'DNS' && mode === 'time') {
		// The field reads "DNS" or "DNS 0.00". A 0 types its reading, another
		// digit starts a time over the DNS; deleting into the word drops it.
		if (!raw.includes('DNS')) return EMPTY_DRAFT;
		const typed = raw.replace('DNS', '');
		if (/[DF#/]/.test(typed)) return {digits: cleanDigits(typed), penalty: 0, special: 'DNF'};
		const digits = cleanDigits(typed);
		if (digits && digits !== ZERO_DIGITS) return {digits, penalty: 0, special: null};
		return {digits, penalty: 0, special: 'DNS'};
	}

	if (prev.special) {
		// The field read "DNF" or "DNS". Shorter means the judge deleted it.
		if (raw.length < prev.special.length) return EMPTY_DRAFT;
		const typed = raw.replace(prev.special, '');
		if (/[S*]/.test(typed)) return {digits: '', penalty: 0, special: 'DNS'};
		if (/[DF#/]/.test(typed)) return {digits: '', penalty: 0, special: 'DNF'};
		const digits = cleanDigits(typed);
		return digits ? {digits, penalty: 0, special: null} : prev;
	}

	if (raw === ',' || /[S*]/.test(raw)) return {digits: dnsDigits(raw), penalty: 0, special: 'DNS'};
	if (raw === '.' || /[DF#/]/.test(raw)) {
		// On a timed event the digits already typed stay as the DNF's time.
		return {digits: mode === 'time' ? cleanDigits(raw) : '', penalty: 0, special: 'DNF'};
	}

	const digits = cleanDigits(raw);
	if (!digits) return EMPTY_DRAFT;
	// A 0 reading takes no penalty.
	if (digits === ZERO_DIGITS) return {digits, penalty: 0, special: null};
	let penalty = prev.penalty;
	if (raw.includes('+') && mode === 'time') penalty = Math.min(MAX_PENALTY_CS, penalty + 200);
	return {digits, penalty, special: null};
}

export interface DraftValue {
	value: number;
	rawValue: number | null;
	penalty: number;
}

/** What the draft would send, or null while it is empty or does not read as a time. */
export function draftValue(draft: KeypadDraft, mode: 'time' | 'moves' = 'time'): DraftValue | null {
	if (draft.special && mode !== 'time') return {value: draft.special === 'DNF' ? JUDGE_DNF : JUDGE_DNS, rawValue: null, penalty: 0};
	// On a timed event a DNF or DNS needs its reading typed (owner, 2026-11-14).
	// A 0.00 reading goes as no time: the site takes a reading above zero or none.
	if (draft.special === 'DNS') return draft.digits === ZERO_DIGITS ? {value: JUDGE_DNS, rawValue: null, penalty: 0} : null;
	if (draft.special === 'DNF') {
		if (draft.digits === ZERO_DIGITS) return {value: JUDGE_DNF, rawValue: null, penalty: 0};
		// The time typed with a DNF goes as the timer reading; the site keeps it, the result stays DNF.
		const reading = digitsToCentiseconds(draft.digits);
		return reading === null ? null : {value: JUDGE_DNF, rawValue: reading, penalty: 0};
	}
	if (mode === 'moves') {
		const moves = parseInt(draft.digits, 10);
		return moves > 0 ? {value: moves, rawValue: null, penalty: 0} : null;
	}
	const raw = digitsToCentiseconds(draft.digits);
	if (raw === null) return null;
	return {value: raw + draft.penalty, rawValue: raw, penalty: draft.penalty};
}

export function formatJudgeValue(value: number | null | undefined, eventId: string): string {
	if (value === JUDGE_DNF) return 'DNF';
	if (value === JUDGE_DNS) return 'DNS';
	if (value === null || value === undefined || value <= 0) return '';
	if (judgeEntryMode(eventId) === 'moves') return String(value);
	const minutes = Math.floor(value / 6000);
	const seconds = Math.floor((value % 6000) / 100);
	const cs = String(value % 100).padStart(2, '0');
	return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}.${cs}` : `${seconds}.${cs}`;
}

/**
 * A sent value as the staff read it: a DNF with the time written beside it is
 * "DNF (12.34)"; anything else as formatJudgeValue.
 */
export function formatJudgeLine(value: number | null | undefined, dnfTime: number | null | undefined, eventId: string): string {
	if (value === JUDGE_DNF && typeof dnfTime === 'number' && dnfTime > 0) return `DNF (${formatJudgeValue(dnfTime, eventId)})`;
	return formatJudgeValue(value, eventId);
}

/**
 * The draft as the judge reads it while typing: "12.24", "12.24 +2", "DNF",
 * "DNF 12.24". No brackets in the field: a backspace on ")" would change nothing.
 */
export function formatDraft(draft: KeypadDraft, mode: 'time' | 'moves' = 'time'): string {
	if (draft.special && mode === 'time' && draft.digits) {
		return `${draft.special} ${formatDraft({digits: draft.digits, penalty: 0, special: null})}`;
	}
	if (draft.special) return draft.special;
	if (!draft.digits) return '';
	if (mode === 'moves') return draft.digits;
	if (draft.digits === ZERO_DIGITS) return '0.00';
	const raw = digitsToCentiseconds(draft.digits);
	// Not a time yet (a 60+ seconds pair): show the digits as typed, not a guess.
	return raw === null ? draft.digits : formatJudgeValue(raw, '333');
}

// ---------------------------------------------------------------------------
// Card rules the phone mirrors (the site decides; this only locks rows early)
// ---------------------------------------------------------------------------

type RoundRules = Pick<JudgeRound, 'eventId' | 'attemptCount' | 'cutoffCs' | 'cutoffAttempts' | 'timeLimitCs' | 'timeLimitCumulative'>;

function cutoffApplies(round: RoundRules): boolean {
	return (
		judgeEntryMode(round.eventId) === 'time' &&
		!!round.cutoffCs &&
		round.cutoffCs > 0 &&
		!!round.cutoffAttempts &&
		round.cutoffAttempts > 0 &&
		round.cutoffAttempts < round.attemptCount
	);
}

/** True once every cutoff attempt is in and none of them made the cutoff. */
export function cutoffMissed(values: readonly (number | null)[], round: RoundRules): boolean {
	if (!cutoffApplies(round)) return false;
	const firstN = values.slice(0, round.cutoffAttempts!);
	if (firstN.length < round.cutoffAttempts! || firstN.some((v) => v === null || v === undefined)) return false;
	return !firstN.some((v) => v !== null && v > 0 && v < round.cutoffCs!);
}

/** A single time over a per-attempt limit ends up DNF at the desk; the judge is told before sending. */
export function exceedsTimeLimit(value: number, round: RoundRules): boolean {
	return (
		judgeEntryMode(round.eventId) === 'time' &&
		!round.timeLimitCumulative &&
		!!round.timeLimitCs &&
		value > 0 &&
		value >= round.timeLimitCs
	);
}

/**
 * A typing check before a time is sent, after the desk's own (site
 * scoretaking/warnings.ts): a time more than four times away from the others on
 * the card is usually a slipped digit. The record check stays at the desk, which
 * has the record list.
 */
export function inconsistentWithCard(value: number, others: readonly (number | null)[]): boolean {
	if (value <= 0) return false;
	const valid = others.filter((v): v is number => typeof v === 'number' && v > 0);
	if (valid.length === 0) return false;
	const best = Math.min(value, ...valid);
	const worst = Math.max(value, ...valid);
	return worst > best * 4;
}

/**
 * The desk's DNS check (site scoretaking/warnings.ts): a DNS means the
 * competitor left, so a time after one is almost always a DNF typed as DNS.
 * `values` are the card's attempts with the time about to be sent in place.
 */
export function dnsBeforeValid(values: readonly (number | null)[]): boolean {
	const dns = values.findIndex((v) => v === -2);
	if (dns === -1) return false;
	return values.slice(dns + 1).some((v) => typeof v === 'number' && v > 0);
}

/**
 * The desk's record check: a single below half the standing ZKT record is a
 * slipped digit (1.23 for 12.30), not a record. Beating the record is not a
 * warning.
 */
export function farBelowRecord(value: number, recordSingle: number | null | undefined): boolean {
	return value > 0 && typeof recordSingle === 'number' && recordSingle > 0 && value * 2 < recordSingle;
}

/**
 * The card's average once every attempt is in, by the site's rule (lib/zkt/calc.ts
 * calculateAverage): Mo3 a plain mean, any DNF/DNS makes it DNF; Ao5 and Ao12
 * drop the best and the worst, two DNF/DNS make it DNF. Null for a format
 * without an average or while an attempt is missing. -1 is DNF.
 *
 * Event-aware like the site's calculateBestAndAverageForEvent: an FMC average
 * is the mean of the move counts times 100 (26, 27, 27 is 2667, as the record
 * is stored), MBLD has no average, and an average past ten minutes is rounded
 * to the second (9f2).
 */
export function cardAverage(values: readonly (number | null)[], format: string, eventId?: string): number | null {
	if (eventId === '333mbf') return null;
	const n = format === 'MO3' ? 3 : format === 'AO5' ? 5 : format === 'AO12' ? 12 : 0;
	if (!n) return null;
	const v = values.slice(0, n);
	if (v.length < n || v.some((x) => x === null || x === undefined)) return null;
	const scale = eventId === '333fm' ? 100 : 1;
	const nums = (v as number[]).map((x) => (x > 0 ? x * scale : x));
	const bad = (x: number) => x <= 0;
	const over10 = (x: number) => (x > 60000 ? Math.round(x / 100) * 100 : x);
	if (format === 'MO3') {
		if (nums.some(bad)) return -1;
		return over10(Math.round(nums.reduce((a, b) => a + b, 0) / 3));
	}
	if (nums.filter(bad).length >= 2) return -1;
	const sorted = [...nums].sort((a, b) => (bad(a) ? 1 : bad(b) ? -1 : a - b));
	const middle = sorted.slice(1, n - 1);
	return over10(Math.round(middle.reduce((a, b) => a + b, 0) / middle.length));
}

/** A standing average record as text: an FMC average is stored times 100 ("25.33"). */
export function formatJudgeAverage(value: number | null | undefined, eventId: string): string {
	if (eventId === '333fm' && typeof value === 'number' && value > 0) return (value / 100).toFixed(2);
	return formatJudgeValue(value, eventId);
}

/** The desk's average check: the card's average below half the standing ZKT average record. */
export function averageFarBelowRecord(
	values: readonly (number | null)[],
	format: string,
	recordAverage: number | null | undefined,
	eventId?: string
): boolean {
	const average = cardAverage(values, format, eventId);
	return average !== null && average > 0 && typeof recordAverage === 'number' && recordAverage > 0 && average * 2 < recordAverage;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Codes the relay can answer with, on top of the site's own (see the plan's contract). */
export const JUDGE_ERROR = {
	NOT_LINKED: 'ZKT_NOT_LINKED',
	UNAVAILABLE: 'JUDGE_UNAVAILABLE',
	RATE_LIMITED: 'RATE_LIMITED',
} as const;

/** The site's refusal codes that have their own sentence in the app. */
export const JUDGE_KNOWN_ERRORS = [
	'ZKT_NOT_LINKED',
	'JUDGE_UNAVAILABLE',
	'RATE_LIMITED',
	'UNKNOWN_MEMBER',
	'SUSPENDED',
	'NO_PERMISSION',
	'NOT_HOLDER',
	'COMPETITION_NOT_FOUND',
	'GROUP_NOT_FOUND',
	'ROUND_NOT_FOUND',
	'COMPETITOR_NOT_IN_GROUP',
	'JUDGE_NOT_FOUND',
	'CARD_NOT_FOUND',
	'GRANT_NOT_FOUND',
	'DISABLED',
	'ROUND_FINISHED',
	'SELF_CARD',
	'CARD_LOCKED',
	'NOTHING_TO_CORRECT',
	'INVALID_INPUT',
	'EXPIRED_TOKEN',
	'INVALID_TOKEN',
	'REASON_REQUIRED',
] as const;
