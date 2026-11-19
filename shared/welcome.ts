/** Message.kind of the automatic welcome message an admin's account sends a new member. */
export const WELCOME_MESSAGE_KIND = 'welcome';

/**
 * Message.kind of the admin's automatic thanks after the member answers. Marked so a
 * client can tell it from a message the admin typed: only a typed one reopens the thread.
 */
export const WELCOME_THANKS_KIND = 'welcome_thanks';

/**
 * Adds the member's answer to a thread in time order. The admin's thanks is written
 * after it but reaches the client first (over the socket, before the mutation answers),
 * so a plain append put the thanks above the answer.
 */
export function insertByTime<T extends {id: string; created_at: any}>(list: T[], message: T): T[] {
	if (list.some((m) => m.id === message.id)) return list;
	return [...list, message].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Whether an incoming message from an admin opens a closed thread again. */
export function reopensThread(message: {kind?: string | null; sender?: {admin?: boolean | null} | null}): boolean {
	return Boolean(message?.sender?.admin) && message?.kind !== WELCOME_THANKS_KIND && message?.kind !== WELCOME_MESSAGE_KIND;
}

/**
 * The answers offered under the welcome message to "where did you hear about Zkt-Timer?".
 * Stored as-is in UserAccount.acquisition_source; the labels live in the translation files
 * under welcome_message.sources.<value>.
 */
export const ACQUISITION_SOURCES = [
	'instagram',
	'youtube',
	'friend',
	'search',
	'app_store',
	'competition',
	'other',
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export function isAcquisitionSource(value: unknown): value is AcquisitionSource {
	return typeof value === 'string' && (ACQUISITION_SOURCES as readonly string[]).includes(value);
}

/** Only accounts this young get the welcome message, so switching it on never reaches old members. */
export const WELCOME_ACCOUNT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Active minutes (heartbeat rows) before the message goes out. The first heartbeat fires a few
 * seconds after the app opens and the next one a minute later, so two means "has been using
 * the app for about a minute", not "has just landed".
 */
export const WELCOME_MIN_ACTIVE_MINUTES = 2;

/**
 * The checks that need nothing but the user row, run on every heartbeat before anything
 * touches the database. Almost every heartbeat stops here.
 */
export function isWelcomeCandidate(
	user: {welcome_sent_at?: Date | string | null; created_at?: Date | string | null},
	now: number = Date.now()
): boolean {
	if (!user || user.welcome_sent_at || !user.created_at) return false;
	const age = now - new Date(user.created_at).getTime();
	return age >= 0 && age <= WELCOME_ACCOUNT_MAX_AGE_MS;
}
