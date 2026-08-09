import {useCallback, useEffect, useState} from 'react';
import {gqlQueryTyped} from '../../components/api';
import {DmPresenceDocument, InboxSummaryDocument, InboxSummaryQuery} from '../../@types/generated/graphql';
import {socketClient} from '../socket/socketio';
import {useMe} from './useMe';
import {getLastKnownSiteConfig, useSiteConfig} from './useSiteConfig';

export const DM_MESSAGE_EVENT = 'dm:message';
export const DM_INBOX_EVENT = 'dm:inbox_changed';
export const DM_UNSEND_EVENT = 'dm:unsent';
export const DM_EDIT_EVENT = 'dm:edited';
export const DM_REACTION_EVENT = 'dm:reaction';
export const DM_TYPING_EVENT = 'dm:typing';
export const DM_READ_EVENT = 'dm:read';
export const DM_PRESENCE_EVENT = 'dm:presence';

type Summary = InboxSummaryQuery['inboxSummary'];

const EMPTY: Summary = {unread_total: 0, request_count: 0};

// A sender stops emitting when they pause, but a closed tab emits nothing at all, so
// the label clears itself if no refresh arrives.
const TYPING_TIMEOUT_MS = 4000;

// One shared summary for every consumer: the nav badge, the panel header and the
// inbox screen must never disagree about how many unread messages there are.
let cached: Summary = EMPTY;
const subscribers = new Set<(s: Summary) => void>();
let inFlight: Promise<void> | null = null;

function publish(next: Summary) {
	cached = next;
	subscribers.forEach((cb) => cb(next));
}

export function refreshInbox(): Promise<void> {
	if (inFlight) return inFlight;

	inFlight = gqlQueryTyped(InboxSummaryDocument, {}, {fetchPolicy: 'no-cache'})
		.then((res) => {
			const data = res?.data?.inboxSummary;
			if (data) publish(data);
		})
		.catch(() => {})
		.finally(() => {
			inFlight = null;
		});

	return inFlight;
}

/** Local decrement so marking a thread read updates the badge without a round trip. */
export function decrementInbox(by: number) {
	if (by <= 0) return;
	publish({...cached, unread_total: Math.max(0, cached.unread_total - by)});
}

/**
 * Inbox badge state, kept fresh by the socket rather than polling.
 *
 * There is no interval here on purpose: the server pushes `dm:inbox_changed` on every
 * delivery, so a timer would only add load for 77 daily users without making the
 * badge any more correct.
 */
export function useInbox(): Summary {
	const me = useMe();
	const [summary, setSummary] = useState<Summary>(cached);

	useEffect(() => {
		if (!me) {
			publish(EMPTY);
			return;
		}

		subscribers.add(setSummary);
		void refreshInbox();

		const socket = socketClient();
		const onChange = () => void refreshInbox();

		socket?.on(DM_INBOX_EVENT, onChange);
		// A reconnect means we may have missed events while offline.
		socket?.on('connect', onChange);

		return () => {
			subscribers.delete(setSummary);
			socket?.off(DM_INBOX_EVENT, onChange);
			socket?.off('connect', onChange);
		};
	}, [me?.id]);

	return summary;
}

/** Subscribes to incoming messages for an open conversation. */
export function useDmMessageListener(onMessage: (message: any) => void) {
	const handler = useCallback(onMessage, [onMessage]);

	useEffect(() => {
		const socket = socketClient();
		if (!socket) return;

		socket.on(DM_MESSAGE_EVENT, handler);
		return () => {
			socket.off(DM_MESSAGE_EVENT, handler);
		};
	}, [handler]);
}

/**
 * Subscribes to withdrawals. Separate from the message listener because the payload is
 * just an id pair: the message it refers to no longer exists anywhere to be sent.
 */
export function useDmUnsendListener(onUnsend: (payload: {conversation_id: string; message_id: string}) => void) {
	const handler = useCallback(onUnsend, [onUnsend]);

	useEffect(() => {
		const socket = socketClient();
		if (!socket) return;

		socket.on(DM_UNSEND_EVENT, handler);
		return () => {
			socket.off(DM_UNSEND_EVENT, handler);
		};
	}, [handler]);
}

/**
 * Subscribes to edits. Carries the whole message so a listener can swap its copy
 * without a request, which is why editing costs the reader nothing.
 */
export function useDmEditListener(onEdit: (payload: {conversation_id: string; message: any}) => void) {
	const handler = useCallback(onEdit, [onEdit]);

	useEffect(() => {
		const socket = socketClient();
		if (!socket) return;

		socket.on(DM_EDIT_EVENT, handler);
		return () => {
			socket.off(DM_EDIT_EVENT, handler);
		};
	}, [handler]);
}

/**
 * Subscribes to reaction changes. Carries the full set for that message rather than a
 * delta, so a client that missed an event cannot drift out of sync.
 */
export function useDmReactionListener(
	onReaction: (payload: {conversation_id: string; message_id: string; reactions: {user_id: string; emoji: string}[]}) => void
) {
	const handler = useCallback(onReaction, [onReaction]);

	useEffect(() => {
		const socket = socketClient();
		if (!socket) return;

		socket.on(DM_REACTION_EVENT, handler);
		return () => {
			socket.off(DM_REACTION_EVENT, handler);
		};
	}, [handler]);
}

/**
 * Typing state for one conversation. The server only forwards this when both people
 * have the indicator switched on, so nothing extra is filtered here.
 *
 * The auto-clear matters: a "typing" event with no matching "stopped" would leave the
 * label stuck forever if the other person closed the tab mid-sentence.
 */
export function useTypingIndicator(conversationId?: string): boolean {
	const [typing, setTyping] = useState(false);

	useEffect(() => {
		if (!conversationId) {
			setTyping(false);
			return;
		}

		const socket = socketClient();
		if (!socket) return;

		let timer: ReturnType<typeof setTimeout> | null = null;
		const onTyping = (payload: {conversation_id: string; typing: boolean}) => {
			if (payload?.conversation_id !== conversationId) return;

			if (timer) clearTimeout(timer);
			setTyping(Boolean(payload.typing));
			if (payload.typing) {
				timer = setTimeout(() => setTyping(false), TYPING_TIMEOUT_MS);
			}
		};

		socket.on(DM_TYPING_EVENT, onTyping);
		return () => {
			if (timer) clearTimeout(timer);
			socket.off(DM_TYPING_EVENT, onTyping);
		};
	}, [conversationId]);

	return typing;
}

/**
 * Who among `userIds` is online right now.
 *
 * Asked once when the list settles, then kept current by the socket. There is no
 * polling here on purpose: presence changes are pushed on the connect and disconnect
 * transitions, so a timer would only add load without making the dot any fresher.
 *
 * Every permission decision is the server's. An empty answer is the correct answer for
 * someone who switched their own dot off, and the client never learns why.
 */
export function useDmPresence(userIds: string[]): Set<string> {
	const [online, setOnline] = useState<Set<string>>(new Set());
	const fresh = useSiteConfig();
	// Falls back to the last known value, stale or not. On a cold page load the fresh
	// config has not arrived yet, and without this the request the switch exists to
	// prevent would still go out on every first render. Being a minute behind on a
	// green dot costs nothing; the server decides the real answer either way.
	const siteConfig = fresh ?? getLastKnownSiteConfig();
	const presenceOff = siteConfig ? !siteConfig.presence_enabled : false;

	// Identity of the set, not the array: the callers rebuild their id list on every
	// render, and depending on the array itself would refetch forever.
	const key = [...userIds].sort().join(',');

	useEffect(() => {
		// The server would answer with an empty list anyway; not asking saves one
		// request per page, which is the whole point of having the switch.
		if (!key || presenceOff) {
			setOnline(new Set());
			return;
		}

		let cancelled = false;
		const ids = key.split(',');

		const load = async () => {
			try {
				const res = await gqlQueryTyped(DmPresenceDocument, {userIds: ids}, {fetchPolicy: 'no-cache'});
				if (!cancelled) setOnline(new Set((res?.data?.dmPresence as string[]) || []));
			} catch {
				if (!cancelled) setOnline(new Set());
			}
		};

		void load();

		const socket = socketClient();
		const onPresence = (payload: {user_id: string; online: boolean}) => {
			if (!payload?.user_id || !ids.includes(payload.user_id)) return;
			setOnline((prev) => {
				const next = new Set(prev);
				if (payload.online) next.add(payload.user_id);
				else next.delete(payload.user_id);
				return next;
			});
		};

		socket?.on(DM_PRESENCE_EVENT, onPresence);
		// Reconnecting means the events we missed while offline are gone for good.
		socket?.on('connect', load);

		return () => {
			cancelled = true;
			socket?.off(DM_PRESENCE_EVENT, onPresence);
			socket?.off('connect', load);
		};
	}, [key, presenceOff]);

	return online;
}

/** When the other person last read this conversation, or null if they do not share it. */
export function useReadReceipt(conversationId?: string): Date | null {
	const [readAt, setReadAt] = useState<Date | null>(null);

	useEffect(() => {
		setReadAt(null);
		if (!conversationId) return;

		const socket = socketClient();
		if (!socket) return;

		const onRead = (payload: {conversation_id: string; read_at: string}) => {
			if (payload?.conversation_id !== conversationId) return;
			setReadAt(new Date(payload.read_at));
		};

		socket.on(DM_READ_EVENT, onRead);
		return () => {
			socket.off(DM_READ_EVENT, onRead);
		};
	}, [conversationId]);

	return readAt;
}
