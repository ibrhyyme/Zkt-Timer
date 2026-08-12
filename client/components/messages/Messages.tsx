import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useRouteMatch, Link} from 'react-router-dom';
import {
	PaperPlaneRight,
	Prohibit,
	ArrowLeft,
	PencilSimpleLine,
	MagnifyingGlass,
	Cube,
	X,
	DotsThreeVertical,
	Trash,
	Flag,
	ArrowUUpLeft,
	PencilSimple,
	BellSimple,
	BellSimpleSlash,
} from 'phosphor-react';
import Header from '../layout/header/Header';
import MobileNav from '../layout/nav/mobile_nav/MobileNav';
import Avatar from '../common/avatar/Avatar';
import AvatarImage from '../common/avatar/avatar_image/AvatarImage';
import PresenceDot from './presence_dot/PresenceDot';
import SwipeRow, {SwipeAction} from './swipe_row/SwipeRow';
import MessageBubble from './message_bubble/MessageBubble';
import Loading from '../common/loading/Loading';
import Empty from '../common/empty/Empty';
import Button from '../common/button/Button';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import {gqlMutateTyped, gqlQueryTyped} from '../api';
import {
	ConversationsDocument,
	ConversationsQuery,
	DmMessagesDocument,
	DmMessagesQuery,
	SendMessageDocument,
	MarkConversationReadDocument,
	SetTypingDocument,
	BlockUserDocument,
	MessageRecipientSearchDocument,
	MessageRecipientSearchQuery,
	UnsendMessageDocument,
	ClearConversationDocument,
	ReportConversationDocument,
	EditMessageDocument,
	AcceptConversationRequestDocument,
	SetConversationMutedDocument,
	SetMessageReactionDocument,
} from '../../@types/generated/graphql';
import {useDmEditListener, useDmMessageListener, useDmReactionListener, useDmPresence, useDmUnsendListener, useTypingIndicator, useReadReceipt, refreshInbox, decrementInbox, useInbox} from '../../util/hooks/useInbox';
import {useMe} from '../../util/hooks/useMe';
import {getDateFromNow, getFullFormattedDate} from '../../util/dates';
import {getTimeString} from '../../util/time';
import {getCubeTypeBucketLabel} from '../../util/cubes/util';
import {toastError} from '../../util/toast';
import SolvePicker from './SolvePicker';
import MessageBody from './message_body/MessageBody';
import block from '../../styles/bem';
import './Messages.scss';

const b = block('messages');

type Conversation = ConversationsQuery['conversations']['conversations'][number];
type DmMessage = DmMessagesQuery['messages']['messages'][number];
type RecipientHit = MessageRecipientSearchQuery['messageRecipientSearch'][number];

// /messages/new is the compose screen; the segment can never collide with a uuid.
const COMPOSE_ROUTE = 'new';

// Mirrors REPORT_SNAPSHOT_SIZE on the server. Shown to the reporter so they know
// exactly how much of the conversation they are handing over.
const REPORT_SNAPSHOT_SIZE = 5;

// Mirrors EDIT_WINDOW_MS on the server. Duplicated rather than fetched because it only
// decides whether to draw a button; the server is still the one that enforces it.
const EDIT_WINDOW_MS = 15 * 60 * 1000;

// Matches the inbox panel's compose list, so the two surfaces stay the same shape.
const RECENT_PEOPLE_LIMIT = 6;

type ListFilter = 'all' | 'unread' | 'requests';

function SolveCard({solve}: {solve: any}) {
	const {t} = useTranslation();
	const label = getCubeTypeBucketLabel(solve.cube_type, solve.scramble_subset) || solve.cube_type;

	return (
		<Link className={b('solve-card')} to={`/solve/${solve.share_code}`}>
			<div className={b('solve-time')}>{solve.dnf ? 'DNF' : getTimeString(solve.time)}</div>
			<div className={b('solve-meta')}>
				<span>{label}</span>
				<span>{t('messages.view_solve')}</span>
			</div>
		</Link>
	);
}

/**
 * The quoted line shown above a reply.
 *
 * Reads the quoted message's own state rather than a snapshot: if the original was
 * unsent, the quote says so instead of preserving text the sender took back.
 */
function QuotedMessage({quote, mine}: {quote: any; mine: boolean}) {
	const {t} = useTranslation();

	const text = quote.deleted_at
		? t('messages.quote_removed')
		: quote.body || (quote.solve_id ? t('inbox.sent_a_solve') : '');

	return (
		<div className={b('quote', {mine})}>
			<span className={b('quote-name')}>{quote.sender?.username || ''}</span>
			<span className={b('quote-text')}>{text}</span>
		</div>
	);
}

function MessagesPage() {
	const {t} = useTranslation();
	const me = useMe();
	const inbox = useInbox();
	const requestCount = inbox.request_count;
	const unreadTotal = inbox.unread_total;
	const history = useHistory();
	const match = useRouteMatch<{conversationId?: string}>();
	const routeId = match.params.conversationId;
	const composing = routeId === COMPOSE_ROUTE;
	const activeId = composing ? undefined : routeId;

	const [conversations, setConversations] = useState<Conversation[]>([]);
	// "unread" narrows what is already loaded; "requests" is a different server query,
	// because the request box is a separate list rather than a subset of the inbox.
	const [filter, setFilter] = useState<ListFilter>(() => {
		if (typeof window === 'undefined') return 'all';
		return new URLSearchParams(window.location.search).get('requests') === '1' ? 'requests' : 'all';
	});
	const [search, setSearch] = useState('');
	const [listLoading, setListLoading] = useState(true);

	const showRequests = filter === 'requests';

	const [messages, setMessages] = useState<DmMessage[]>([]);
	const [threadLoading, setThreadLoading] = useState(false);
	// Starts false so a thread that has not loaded yet is treated as untrusted: links
	// are rendered as plain text until the server says this conversation was accepted.
	const [threadAccepted, setThreadAccepted] = useState(false);
	// The sender's side of the same rule: one message into a request box, then wait.
	const [awaitingAccept, setAwaitingAccept] = useState(false);
	const [threadMuted, setThreadMuted] = useState(false);
	const [accepting, setAccepting] = useState(false);
	// Only one row may sit open; the list owns that, not the row.
	const [swipedRow, setSwipedRow] = useState<string | null>(null);
	// The message the composer is currently answering, or null for a normal message.
	const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
	const [draft, setDraft] = useState('');
	// Arriving from a profile's "Send message" carries the username, so the search is
	// already filled in and the person is one click away.
	const [recipientQuery, setRecipientQuery] = useState(() => {
		if (typeof window === 'undefined') return '';
		return new URLSearchParams(window.location.search).get('to') || '';
	});
	const [recipients, setRecipients] = useState<RecipientHit[]>([]);
	const [searching, setSearching] = useState(false);
	const [sending, setSending] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [picked, setPicked] = useState<RecipientHit | null>(null);
	// Tapping your own bubble reveals its actions; there is no hover on a phone and a
	// long-press would fight the browser's own text selection.
	const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState('');
	const [savingEdit, setSavingEdit] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [reportReason, setReportReason] = useState('');
	const [reporting, setReporting] = useState(false);
	const [reportSent, setReportSent] = useState(false);

	const otherTyping = useTypingIndicator(activeId);
	const otherReadAt = useReadReceipt(activeId);
	// Throttle: one "typing" per interval instead of one per keystroke, plus a single
	// "stopped" once the person pauses.
	const typingSentAt = useRef(0);
	const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const bottomRef = useRef<HTMLDivElement>(null);
	const mounted = useRef(true);
	useEffect(() => () => {
		mounted.current = false;
	}, []);

	const active = conversations.find((c) => c.id === activeId);

	/**
	 * The person on the other side of the open thread.
	 *
	 * Falls back to the sender of a message when the inbox list does not contain this
	 * conversation. That is not an edge case: opening a request straight from a link or
	 * the inbox panel leaves the "all" filter loaded, which has no request threads in
	 * it, and the header rendered a blank name and a blank avatar.
	 */
	const threadOther =
		(active?.other_user as any) || (messages.find((m) => m.sender_id !== me?.id)?.sender as any) || null;

	// Everyone in the list, plus whoever is open. The server decides what comes back.
	const onlineIds = useDmPresence(
		conversations.map((c) => (c.other_user as any)?.id).filter(Boolean)
	);

	/**
	 * People already in the loaded inbox, newest first. Derived from state that is
	 * already here, so offering the list costs no extra request.
	 */
	const recentPeople = conversations
		.map((c) => c.other_user as any)
		.filter((u) => u?.id)
		.slice(0, RECENT_PEOPLE_LIMIT);

	const loadConversations = useCallback(async (requests: boolean) => {
		setListLoading(true);
		try {
			const res = await gqlQueryTyped(ConversationsDocument, {page: 1, requests}, {fetchPolicy: 'no-cache'});
			if (!mounted.current) return;
			setConversations((res?.data?.conversations?.conversations || []) as Conversation[]);
		} finally {
			if (mounted.current) setListLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadConversations(showRequests);
	}, [showRequests, loadConversations]);

	const loadThread = useCallback(async (conversationId: string) => {
		setThreadLoading(true);
		// Cleared up front so switching threads cannot carry the previous one's trust
		// across while the new one is still in flight.
		setThreadAccepted(false);
		setAwaitingAccept(false);
		setThreadMuted(false);
		setReplyTo(null);
		try {
			const res = await gqlQueryTyped(
				DmMessagesDocument,
				{conversationId},
				{fetchPolicy: 'no-cache'}
			);
			// The API returns newest-first for cursor paging; the thread reads oldest-first.
			if (!mounted.current) return;
			const rows = (res?.data?.messages?.messages || []) as DmMessage[];
			setMessages([...rows].reverse());
			setThreadAccepted(Boolean(res?.data?.messages?.accepted));
			setAwaitingAccept(Boolean(res?.data?.messages?.awaiting_accept));
			setThreadMuted(Boolean(res?.data?.messages?.muted));
		} finally {
			if (mounted.current) setThreadLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!activeId) {
			setMessages([]);
			setThreadAccepted(false);
			setAwaitingAccept(false);
			return;
		}

		void loadThread(activeId);

		// Opening a thread is what clears its unread count, locally and on the server.
		const unread = conversations.find((c) => c.id === activeId)?.unread_count || 0;
		void gqlMutateTyped(MarkConversationReadDocument, {conversationId: activeId})
			.then(() => {
				if (unread > 0) decrementInbox(unread);
				if (!mounted.current) return;
				setConversations((prev) =>
					prev.map((c) => (c.id === activeId ? {...c, unread_count: 0} : c))
				);
			})
			.catch(() => {});
	}, [activeId, loadThread]);

	useEffect(() => {
		if (!composing) return;

		const term = recipientQuery.trim();
		if (term.length < 2) {
			setRecipients([]);
			return;
		}

		// Debounced so typing a name is one request, not one per keystroke.
		setSearching(true);
		const timer = setTimeout(async () => {
			try {
				const res = await gqlQueryTyped(MessageRecipientSearchDocument, {query: term}, {fetchPolicy: 'no-cache'});
				setRecipients((res?.data?.messageRecipientSearch || []) as RecipientHit[]);
			} finally {
				setSearching(false);
			}
		}, 280);

		return () => clearTimeout(timer);
	}, [recipientQuery, composing]);

	async function startConversation(userId: string) {
		const body = draft.trim();
		if (!body) return;

		setSending(true);
		try {
			const res = await gqlMutateTyped(SendMessageDocument, {body, recipientId: userId});
			const sent = res?.data?.sendMessage as DmMessage;
			setDraft('');
			setRecipientQuery('');
			setRecipients([]);
			setPicked(null);
			await loadConversations(false);
			void refreshInbox();
			// Settle local state before navigating: a setState in `finally` would land
			// after the route change and warn about updating an unmounted component.
			setSending(false);
			if (sent?.conversation_id) history.push(`/messages/${sent.conversation_id}`);
			return;
		} catch (e) {
			toastError(e as Error);
			setSending(false);
		}
	}

	useEffect(() => {
		// scrollIntoView walks up every scrollable ancestor, including the document, so
		// it dragged the whole page down and parked the thread header (back arrow and
		// block button) underneath the fixed site nav, where it could not be clicked.
		// The bubble list is its own scroll container, so move only that one.
		const list = bottomRef.current?.parentElement;
		if (list) {
			list.scrollTo({top: list.scrollHeight, behavior: 'smooth'});
		}
	}, [messages.length]);

	// The sender withdrew a message: drop it from the open thread and refresh the list
	// preview, which may have been showing the text that no longer exists.
	useDmEditListener(
		useCallback((payload: {conversation_id: string; message: any}) => {
			if (!payload?.message?.id) return;
			// Replace in place: the edited message keeps its position in the thread,
			// because editing is not sending something new.
			setMessages((prev) => prev.map((m) => (m.id === payload.message.id ? {...m, ...payload.message} : m)));
			setConversations((prev) =>
				prev.map((c) =>
					c.id === payload.conversation_id && (c.last_message as any)?.id === payload.message.id
						? {...c, last_message: payload.message}
						: c
				)
			);
		}, [])
	);

	useDmReactionListener(
		useCallback((payload: {message_id: string; reactions: {user_id: string; emoji: string}[]}) => {
			if (!payload?.message_id) return;
			setMessages((prev) =>
				prev.map((m) => (m.id === payload.message_id ? ({...m, reactions: payload.reactions} as DmMessage) : m))
			);
		}, [])
	);

	useDmUnsendListener((payload) => {
		setMessages((prev) => prev.filter((m) => m.id !== payload.message_id));
		void loadConversations(showRequests);
	});

	/**
	 * Same rule as the inbox panel: patch from the event, do not refetch.
	 *
	 * `loadConversations` used to run on every arriving message, which re-read the whole
	 * list to change one row's preview and counter. The event already contains both.
	 * A thread that is not in the loaded list is the only case that needs the server.
	 */
	useDmMessageListener(
		useCallback(
			(incoming: DmMessage) => {
				if (!incoming?.conversation_id) return;

				const reading = incoming.conversation_id === activeId;
				if (reading) {
					setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
					void gqlMutateTyped(MarkConversationReadDocument, {conversationId: activeId}).catch(() => {});
				}

				let known = false;
				setConversations((prev) => {
					const next = prev.map((c) => {
						if (c.id !== incoming.conversation_id) return c;
						known = true;

						const mine = incoming.sender_id === me?.id;
						return {
							...c,
							last_message: incoming as any,
							last_message_at: incoming.created_at,
							// Reading the thread right now means it never became unread.
							unread_count: mine || reading ? c.unread_count : c.unread_count + 1,
						};
					});

					return known
						? [...next].sort(
								(x, y) => new Date(y.last_message_at).getTime() - new Date(x.last_message_at).getTime()
						  )
						: prev;
				});

				if (!known) void loadConversations(showRequests);
			},
			[activeId, me?.id, loadConversations, showRequests]
		)
	);

	// Sending a solve is the one thing a generic chat app cannot do, so it is a first
	// class action: the picker attaches it and sends in the same step, with whatever
	// text is already in the box.
	async function sendSolve(solveId: string) {
		if (sending || !activeId) return;

		setPickerOpen(false);
		setSending(true);
		try {
			const res = await gqlMutateTyped(SendMessageDocument, {
				body: draft.trim(),
				conversationId: activeId,
				solveId,
			});
			const sent = res?.data?.sendMessage as DmMessage;
			if (sent) {
				setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
			}
			setDraft('');
			void loadConversations(showRequests);
			void refreshInbox();
		} catch (e) {
			toastError(e as Error);
		} finally {
			setSending(false);
		}
	}

	async function handleSend() {
		const body = draft.trim();
		if (!body || sending || !activeId) return;

		setSending(true);
		try {
			const res = await gqlMutateTyped(SendMessageDocument, {
				body,
				conversationId: activeId,
				replyToId: replyTo?.id,
			});
			const sent = res?.data?.sendMessage as DmMessage;
			if (sent) {
				setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
			}
			setDraft('');
			setReplyTo(null);
			void loadConversations(showRequests);
			void refreshInbox();
		} catch (e) {
			toastError(e as Error);
		} finally {
			setSending(false);
		}
	}

	/**
	 * Lets a request through without writing back.
	 *
	 * Also unlocks the other person's composer, so the thread becomes an ordinary
	 * conversation for both sides at the same moment.
	 */
	async function handleAcceptRequest() {
		if (!activeId || accepting) return;

		setAccepting(true);
		try {
			await gqlMutateTyped(AcceptConversationRequestDocument, {conversationId: activeId});
			setThreadAccepted(true);
			setFilter('all');
			void refreshInbox();
			void loadConversations(false);
		} catch (e) {
			toastError(e as Error);
		} finally {
			setAccepting(false);
		}
	}

	/**
	 * Silences or unsilences the open thread.
	 *
	 * Nothing is confirmed and nothing is announced: muting is meant to be a quiet,
	 * reversible thing you do for yourself, unlike blocking which the other side
	 * eventually notices.
	 */
	async function handleToggleMute() {
		if (!activeId) return;

		const next = !threadMuted;
		setMenuOpen(false);
		setThreadMuted(next);
		try {
			await gqlMutateTyped(SetConversationMutedDocument, {conversationId: activeId, muted: next});
			setConversations((prev) => prev.map((c) => (c.id === activeId ? {...c, muted: next} : c)));
			// The badge excludes muted threads, so the number changes the moment this does.
			void refreshInbox();
		} catch (e) {
			setThreadMuted(!next);
			toastError(e as Error);
		}
	}

	/**
	 * The four actions a swiped row offers.
	 *
	 * The same four that live behind the menu inside a conversation. Having them only
	 * there meant opening a thread you wanted to mute or delete, which is exactly what
	 * someone avoiding that person does not want to do.
	 */
	function rowActions(c: Conversation): SwipeAction[] {
		const other = c.other_user as any;

		return [
			{
				key: 'mute',
				label: c.muted ? t('messages.unmute') : t('messages.mute'),
				icon: c.muted ? <BellSimple weight="bold" /> : <BellSimpleSlash weight="bold" />,
				onSelect: () => void muteConversation(c.id, !c.muted),
			},
			{
				key: 'report',
				label: t('messages.report'),
				icon: <Flag weight="bold" />,
				onSelect: () => {
					setSwipedRow(null);
					history.push(`/messages/${c.id}`);
					setReportOpen(true);
				},
			},
			{
				key: 'block',
				label: t('messages.block'),
				icon: <Prohibit weight="bold" />,
				tone: 'danger',
				onSelect: () => void blockFromRow(c.id, other),
			},
			{
				key: 'delete',
				label: t('messages.clear_chat'),
				icon: <Trash weight="bold" />,
				tone: 'danger',
				onSelect: () => void clearFromRow(c.id),
			},
		];
	}

	async function muteConversation(conversationId: string, muted: boolean) {
		setSwipedRow(null);
		setConversations((prev) => prev.map((c) => (c.id === conversationId ? {...c, muted} : c)));
		if (conversationId === activeId) setThreadMuted(muted);
		try {
			await gqlMutateTyped(SetConversationMutedDocument, {conversationId, muted});
			void refreshInbox();
		} catch (e) {
			setConversations((prev) => prev.map((c) => (c.id === conversationId ? {...c, muted: !muted} : c)));
			toastError(e as Error);
		}
	}

	async function clearFromRow(conversationId: string) {
		if (!window.confirm(t('messages.clear_confirm'))) return;

		setSwipedRow(null);
		try {
			await gqlMutateTyped(ClearConversationDocument, {conversationId});
			setConversations((prev) => prev.filter((c) => c.id !== conversationId));
			if (conversationId === activeId) history.push('/messages');
			void refreshInbox();
		} catch (e) {
			toastError(e as Error);
		}
	}

	async function blockFromRow(conversationId: string, other: any) {
		if (!other?.id) return;
		if (!window.confirm(t('messages.block_confirm', {name: other.username}))) return;

		setSwipedRow(null);
		try {
			await gqlMutateTyped(BlockUserDocument, {userId: other.id});
			setConversations((prev) => prev.filter((c) => c.id !== conversationId));
			if (conversationId === activeId) history.push('/messages');
			void refreshInbox();
		} catch (e) {
			toastError(e as Error);
		}
	}

	/**
	 * Toggles the caller's reaction. Optimistic, because a reaction that waits for a
	 * round trip before appearing feels broken on a tap.
	 */
	async function handleReact(messageId: string, emoji: string) {
		const meId = me?.id;
		if (!meId) return;

		const before = messages;
		setMessages((prev) =>
			prev.map((m) => {
				if (m.id !== messageId) return m;
				const list = ((m as any).reactions || []) as {user_id: string; emoji: string}[];
				const existing = list.find((r) => r.user_id === meId);
				const without = list.filter((r) => r.user_id !== meId);
				// Same emoji again means "take it back".
				const next = existing?.emoji === emoji ? without : [...without, {user_id: meId, emoji}];
				return {...m, reactions: next} as DmMessage;
			})
		);

		try {
			await gqlMutateTyped(SetMessageReactionDocument, {messageId, emoji});
		} catch (e) {
			setMessages(before);
			toastError(e as Error);
		}
	}

	async function handleBlock() {
		const otherId = threadOther?.id;
		if (!otherId) return;
		if (!window.confirm(t('messages.block_confirm', {name: threadOther?.username}))) return;

		try {
			await gqlMutateTyped(BlockUserDocument, {userId: otherId});
			history.push('/messages');
			void loadConversations(showRequests);
			void refreshInbox();
		} catch (e) {
			toastError(e as Error);
		}
	}

	/**
	 * Whether the edit button is worth showing on this message.
	 *
	 * Mirrors the server's window rather than replacing it. The server decides; this
	 * only avoids offering a button that would be refused, and hides the option on a
	 * message with nothing editable (a shared solve carries no text).
	 */
	function canEdit(m: DmMessage): boolean {
		if (!m.body) return false;
		return Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;
	}

	function startEdit(m: DmMessage) {
		setEditingId(m.id);
		setEditDraft(m.body || '');
		setSelectedMessage(null);
	}

	function cancelEdit() {
		setEditingId(null);
		setEditDraft('');
	}

	async function saveEdit(messageId: string) {
		const body = editDraft.trim();
		if (!body || savingEdit) return;

		setSavingEdit(true);
		try {
			const res = await gqlMutateTyped(EditMessageDocument, {messageId, body});
			const updated = res?.data?.editMessage as DmMessage;
			if (updated) {
				setMessages((prev) => prev.map((m) => (m.id === messageId ? {...m, ...updated} : m)));
			}
			cancelEdit();
		} catch (e) {
			// The window may have closed while the box was open, so the refusal is a
			// real outcome rather than a bug: show it and leave the text in place.
			toastError(e as Error);
		} finally {
			setSavingEdit(false);
		}
	}

	/** Withdraws one of your own messages; the server wipes the body, not just a flag. */
	async function handleUnsend(messageId: string) {
		if (!window.confirm(t('messages.unsend_confirm'))) return;

		setMenuOpen(false);
		try {
			await gqlMutateTyped(UnsendMessageDocument, {messageId});
			setMessages((prev) => prev.filter((m) => m.id !== messageId));
			setSelectedMessage(null);
			void loadConversations(showRequests);
		} catch (e) {
			toastError(e as Error);
		}
	}

	function notifyTyping() {
		if (!activeId) return;

		const now = Date.now();
		if (now - typingSentAt.current > 2500) {
			typingSentAt.current = now;
			void gqlMutateTyped(SetTypingDocument, {conversationId: activeId, typing: true}).catch(() => {});
		}

		if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
		typingStopTimer.current = setTimeout(() => {
			typingSentAt.current = 0;
			void gqlMutateTyped(SetTypingDocument, {conversationId: activeId, typing: false}).catch(() => {});
		}, 2500);
	}

	async function handleClearConversation() {
		if (!activeId) return;
		if (!window.confirm(t('messages.clear_confirm'))) return;

		setMenuOpen(false);
		try {
			await gqlMutateTyped(ClearConversationDocument, {conversationId: activeId});
			history.push('/messages');
			void loadConversations(showRequests);
			void refreshInbox();
		} catch (e) {
			toastError(e as Error);
		}
	}

	async function handleReport() {
		if (!activeId || !reportReason.trim()) return;

		setReporting(true);
		try {
			await gqlMutateTyped(ReportConversationDocument, {
				conversationId: activeId,
				reason: reportReason.trim(),
			});
			setReportOpen(false);
			setReportReason('');
			setReportSent(true);
		} catch (e) {
			toastError(e as Error);
		} finally {
			setReporting(false);
		}
	}

	// Search filters what is already loaded rather than asking the server: an inbox is
	// a short list, and a round trip per keystroke would be slower than the filter.
	const query = search.trim().toLowerCase();
	const visibleConversations = conversations.filter((c) => {
		if (filter === 'unread' && c.unread_count === 0) {
			return false;
		}
		if (!query) {
			return true;
		}
		const name = (c.other_user?.username || '').toLowerCase();
		const body = (c.last_message?.body || '').toLowerCase();
		return name.includes(query) || body.includes(query);
	});

	/**
	 * A shared solve shows its time instead of "sent a solve". This is the one place the
	 * inbox can look like it belongs to a timer rather than to any chat app, and the
	 * number is the thing the reader actually wants to see.
	 */
	function previewOf(c: Conversation): string {
		const last = c.last_message;
		if (!last) {
			return '';
		}
		if (last.body) {
			return last.body;
		}
		if (last.solve) {
			return t('messages.solve_preview', {
				time: last.solve.dnf ? 'DNF' : getTimeString(last.solve.time),
			});
		}
		return '';
	}

	let listBody = null;
	if (listLoading && conversations.length === 0) {
		listBody = <Loading />;
	} else if (visibleConversations.length === 0) {
		const emptyText = query
			? t('messages.no_search_results')
			: filter === 'requests'
			? t('messages.no_requests')
			: filter === 'unread'
			? t('messages.no_unread')
			: t('inbox.no_messages');
		listBody = <Empty text={emptyText} />;
	} else {
		// A button, not a Link: Avatar renders its own anchor, and an <a> inside an <a>
		// is invalid HTML that browsers resolve inconsistently.
		listBody = visibleConversations.map((c) => (
			<SwipeRow
				key={c.id}
				open={swipedRow === c.id}
				onSwipeOpen={() => setSwipedRow(swipedRow === c.id ? null : c.id)}
				onOpen={() => history.push(`/messages/${c.id}`)}
				actions={rowActions(c)}
			>
			<div
				className={b('row', {active: c.id === activeId, unread: c.unread_count > 0})}
			>
				<span className={b('row-avatar')}>
					<AvatarImage user={c.other_user as any} profile={(c.other_user as any)?.profile} />
					<PresenceDot online={onlineIds.has((c.other_user as any)?.id)} />
				</span>
				<div className={b('row-main')}>
					<div className={b('row-top')}>
						<span className={b('row-name')}>{c.other_user?.username}</span>
							{c.muted && <BellSimpleSlash className={b('row-muted')} weight="bold" />}
						<span className={b('row-date')}>{getDateFromNow(c.last_message_at, true)}</span>
					</div>
					<div className={b('row-bottom')}>
						<span className={b('row-preview')}>{previewOf(c)}</span>
						{c.unread_count > 0 && (
							<span className={b('row-badge')}>{c.unread_count > 99 ? '99+' : c.unread_count}</span>
						)}
					</div>
				</div>
			</div>
			</SwipeRow>
		));
	}

	// Newest message I sent, so the read mark has exactly one place to live.
	const lastMineId = [...messages].reverse().find((m) => m.sender_id === me?.id)?.id;

	let threadBody = null;
	if (composing) {
		threadBody = (
			<div className={b('compose')}>
				<div className={b('thread-head')}>
					<Link className={b('back')} to="/messages">
						<ArrowLeft weight="bold" />
					</Link>
					<span className={b('compose-title')}>{t('messages.new_message')}</span>
				</div>

				{/* Pick the person first, then write — the order every messaging app uses. */}
				{picked ? (
					<div className={b('compose-picked')}>
						<AvatarImage small user={picked as any} profile={(picked as any)?.profile} />
						<span className={b('compose-picked-name')}>{picked.username}</span>
						<button
							type="button"
							className={b('compose-clear')}
							onClick={() => setPicked(null)}
							aria-label={t('messages.change_recipient')}
						>
							<X weight="bold" />
						</button>
					</div>
				) : (
					<>
						<label className={b('compose-search')}>
							<MagnifyingGlass weight="bold" />
							<input
								autoFocus
								value={recipientQuery}
								placeholder={t('messages.recipient_placeholder')}
								onChange={(e) => setRecipientQuery(e.target.value)}
							/>
						</label>

						<div className={b('compose-results')}>
							{searching && <Loading />}
							{!searching && recipientQuery.trim().length >= 2 && recipients.length === 0 && (
								<p className={b('compose-hint')}>{t('messages.no_recipients')}</p>
							)}

							{/* Before anything is typed, offer the people already in the inbox.
							    This screen is the only compose surface a phone can reach, and it
							    was the one still demanding a name be typed out in full while the
							    desktop panel and the solve-share sheet both offered the list. */}
							{!searching && recipientQuery.trim().length < 2 && (
								recentPeople.length > 0 ? (
									<>
										<div className={b('compose-section')}>{t('inbox.recent_people')}</div>
										{recentPeople.map((user) => (
											<button
												key={user.id}
												type="button"
												className={b('compose-hit')}
												onClick={() => setPicked(user)}
											>
												<AvatarImage small user={user} profile={user?.profile} />
												<span>{user.username}</span>
											</button>
										))}
									</>
								) : (
									<p className={b('compose-hint')}>{t('messages.recipient_hint')}</p>
								)
							)}

							{recipientQuery.trim().length >= 2 &&
								recipients.map((user) => (
									<button
										key={user.id}
										type="button"
										className={b('compose-hit')}
										onClick={() => setPicked(user)}
									>
										<AvatarImage small user={user as any} profile={(user as any)?.profile} />
										<span>{user.username}</span>
									</button>
								))}
						</div>
					</>
				)}

				{picked && <div className={b('compose-spacer')} />}

				<div className={b('composer')}>
					<textarea
						className={b('composer-input')}
						value={draft}
						disabled={!picked}
						placeholder={picked ? t('messages.placeholder') : t('messages.pick_recipient_first')}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								if (picked) void startConversation(picked.id);
							}
						}}
					/>
					<Button
						primary
						disabled={sending || !picked || !draft.trim()}
						icon={<PaperPlaneRight weight="bold" />}
						onClick={() => picked && startConversation(picked.id)}
					/>
				</div>
			</div>
		);
	} else if (!activeId) {
		threadBody = <Empty text={t('messages.pick_a_conversation')} />;
	} else if (threadLoading && messages.length === 0) {
		threadBody = <Loading />;
	} else {
		threadBody = (
			<>
				<div className={b('thread-head')}>
					<Link className={b('back')} to="/messages">
						<ArrowLeft weight="bold" />
					</Link>
					<span className={b('thread-avatar')}>
						<Avatar small user={threadOther} profile={threadOther?.profile} hideBadges />
						<PresenceDot online={onlineIds.has(threadOther?.id)} />
					</span>
					{/* Three actions do not fit side by side on a phone, so they live in one
					    menu. Report sits first: it is the one you reach for in a hurry. */}
					<div className={b('thread-menu')}>
						<button
							type="button"
							className={b('thread-menu-handle')}
							aria-label={t('messages.more_actions')}
							onClick={() => setMenuOpen(!menuOpen)}
						>
							<DotsThreeVertical weight="bold" />
						</button>
						{menuOpen && (
							<div className={b('thread-menu-panel')}>
								<button type="button" onClick={() => {setMenuOpen(false); setReportOpen(true);}}>
									<Flag weight="bold" />
									{t('messages.report')}
								</button>
								<button type="button" onClick={() => void handleToggleMute()}>
									{threadMuted ? <BellSimple weight="bold" /> : <BellSimpleSlash weight="bold" />}
									{threadMuted ? t('messages.unmute') : t('messages.mute')}
								</button>
								<button type="button" onClick={handleClearConversation}>
									<Trash weight="bold" />
									{t('messages.clear_chat')}
								</button>
								<button type="button" onClick={() => {setMenuOpen(false); void handleBlock();}}>
									<Prohibit weight="bold" />
									{t('messages.block')}
								</button>
							</div>
						)}
					</div>
				</div>
				<div className={b('bubbles')}>
					{messages.map((m) => {
						const mine = m.sender_id === me?.id;
						return (
							<MessageBubble
								key={m.id}
								mine={mine}
								myUserId={me?.id}
								reactions={(m as any).reactions || []}
								onReply={() => setReplyTo(m)}
								onReact={(emoji) => void handleReact(m.id, emoji)}
								onSelect={() => {
									if (mine) setSelectedMessage(selectedMessage === m.id ? null : m.id);
								}}
							>
								<div className={b('bubble-inner', {mine, clickable: mine})}>
									{/* The quoted line, above the reply's own text. */}
									{(m as any).reply_to && <QuotedMessage quote={(m as any).reply_to} mine={mine} />}
									{editingId === m.id ? (
										<div className={b('bubble-edit')} onClick={(e) => e.stopPropagation()}>
											<textarea
												className={b('bubble-edit-input')}
												value={editDraft}
												autoFocus
												onChange={(e) => setEditDraft(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Escape') cancelEdit();
													if (e.key === 'Enter' && !e.shiftKey) {
														e.preventDefault();
														void saveEdit(m.id);
													}
												}}
											/>
											<div className={b('bubble-edit-actions')}>
												<button type="button" onClick={cancelEdit}>
													{t('messages.edit_cancel')}
												</button>
												<button
													type="button"
													className={b('bubble-edit-save')}
													disabled={savingEdit || !editDraft.trim()}
													onClick={() => void saveEdit(m.id)}
												>
													{t('messages.edit_save')}
												</button>
											</div>
										</div>
									) : (
										m.body && (
											<div className={b('bubble-body')}>
												<MessageBody body={m.body} trusted={threadAccepted} />
											</div>
										)
									)}
									{m.solve && <SolveCard solve={m.solve} />}
									<div className={b('bubble-time')} title={getFullFormattedDate(m.created_at)}>
										{getDateFromNow(m.created_at, true)}
										{/* Both sides see this. A silent edit would let someone change
										    what the other person already read without them knowing. */}
										{m.edited_at && <span className={b('bubble-edited')}>{t('messages.edited')}</span>}
									</div>
								</div>
								{/* Only on the newest message of mine: a tick under every bubble
								    is noise, and the last one already answers "did they see it". */}
								{mine &&
									otherReadAt &&
									m.id === lastMineId &&
									new Date(m.created_at).getTime() <= otherReadAt.getTime() && (
										<span className={b('read-mark')}>{t('messages.seen')}</span>
									)}
								{mine && selectedMessage === m.id && editingId !== m.id && (
									<div className={b('bubble-actions')}>
										{/* Only offered while the window is open. Showing a dead button
										    on an old message and refusing on click would be worse. */}
										{canEdit(m) && (
											<button type="button" className={b('bubble-action')} onClick={() => startEdit(m)}>
												<PencilSimple weight="bold" />
												{t('messages.edit')}
											</button>
										)}
										<button
											type="button"
											className={b('bubble-action')}
											onClick={() => void handleUnsend(m.id)}
										>
											<ArrowUUpLeft weight="bold" />
											{t('messages.unsend')}
										</button>
									</div>
								)}
							</MessageBubble>
						);
					})}
					{/* Sits inside the scroll area so it is pinned to the newest message
					    rather than floating over the composer. */}
					{otherTyping && (
						<div className={b('typing')}>
							{t('messages.typing', {name: threadOther?.username || ''})}
						</div>
					)}
					<div ref={bottomRef} />
				</div>
				{/* A request the reader has not accepted. Instagram's shape: the decision is
				    an explicit bar, not something you stumble into by replying. */}
				{!threadLoading && !threadAccepted && messages.length > 0 && (
					<div className={b('request-bar')}>
						<span className={b('request-bar-text')}>
							{t('messages.request_intro', {name: threadOther?.username || ''})}
						</span>
						<div className={b('request-bar-actions')}>
							<button
								type="button"
								className={b('request-bar-btn', {primary: true})}
								disabled={accepting}
								onClick={() => void handleAcceptRequest()}
							>
								{t('messages.request_accept')}
							</button>
							<button type="button" className={b('request-bar-btn')} onClick={() => void handleClearConversation()}>
								{t('messages.request_delete')}
							</button>
							<button type="button" className={b('request-bar-btn')} onClick={() => void handleBlock()}>
								{t('messages.block')}
							</button>
						</div>
					</div>
				)}

				{/* Answering something specific: the quote sits directly above the box you
				    type into, so it is obvious what the reply attaches to. */}
				{replyTo && (
					<div className={b('reply-bar')}>
						<div className={b('reply-bar-body')}>
							<span className={b('reply-bar-name')}>
								{replyTo.sender_id === me?.id ? t('messages.reply_to_self') : threadOther?.username}
							</span>
							<span className={b('reply-bar-text')}>
								{replyTo.body || (replyTo.solve ? t('inbox.sent_a_solve') : '')}
							</span>
						</div>
						<button
							type="button"
							className={b('reply-bar-close')}
							title={t('messages.edit_cancel')}
							aria-label={t('messages.edit_cancel')}
							onClick={() => setReplyTo(null)}
						>
							<X weight="bold" />
						</button>
					</div>
				)}

				<div className={b('composer')}>
					{pickerOpen && (
						<SolvePicker onPick={sendSolve} onClose={() => setPickerOpen(false)} />
					)}
					<Button
						gray
						title={t('messages.attach_solve')}
						disabled={sending}
						icon={<Cube weight="bold" />}
						onClick={() => setPickerOpen(!pickerOpen)}
					/>
					<textarea
						className={b('composer-input')}
						value={draft}
						disabled={awaitingAccept}
						placeholder={awaitingAccept ? t('messages.awaiting_accept') : t('messages.placeholder')}
						onChange={(e) => {
							setDraft(e.target.value);
							notifyTyping();
						}}
						onKeyDown={(e) => {
							// Enter sends, Shift+Enter makes a new line — the convention every
							// chat app trained these users on.
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								void handleSend();
							}
						}}
					/>
					<Button
						primary
						disabled={sending || awaitingAccept || !draft.trim()}
						icon={<PaperPlaneRight weight="bold" />}
						onClick={handleSend}
					/>
				</div>
			</>
		);
	}

	return (
		<div className={b({'thread-open': Boolean(activeId) || composing})}>
			<Header path="/messages" title={t('messages.page_title')} />
			{/* Every other page picks the mobile nav up from PageTitle. This screen draws
			    its own header instead, so without mounting MobileNav here the edge notch
			    never renders and a phone user has no way back out of the inbox.
			    MobileNav hides itself on desktop and on the timer route. */}
			<MobileNav />
			<div className={b('list')}>
				<div className={b('list-head')}>
					<h1>{t('messages.page_title')}</h1>
					<button
						type="button"
						className={b('new')}
						title={t('messages.new_message')}
						aria-label={t('messages.new_message')}
						onClick={() => history.push('/messages/new')}
					>
						<PencilSimpleLine weight="regular" />
					</button>
				</div>

				<label className={b('search')}>
					<MagnifyingGlass weight="bold" />
					<input
						value={search}
						placeholder={t('messages.search_placeholder')}
						onChange={(e) => setSearch(e.target.value)}
					/>
					{search && (
						<button
							type="button"
							className={b('search-clear')}
							aria-label={t('messages.clear_search')}
							onClick={() => setSearch('')}
						>
							<X weight="bold" />
						</button>
					)}
				</label>

				{/* Requests used to be a link that swapped the whole list. As a chip it sits
				    beside the other filters, which is where every messenger puts it and where
				    its count is visible without opening anything. */}
				<div className={b('filters')}>
					{([
						{id: 'all' as const, label: t('messages.filter_all'), count: 0},
						{id: 'unread' as const, label: t('messages.filter_unread'), count: unreadTotal},
						{id: 'requests' as const, label: t('messages.requests'), count: requestCount},
					]).map((chip) => (
						<button
							key={chip.id}
							type="button"
							className={b('chip', {active: filter === chip.id})}
							onClick={() => setFilter(chip.id)}
						>
							{chip.label}
							{chip.count > 0 && <span className={b('chip-count')}>{chip.count}</span>}
						</button>
					))}
				</div>

				{filter === 'requests' && <p className={b('requests-note')}>{t('messages.requests_note')}</p>}
				<div className={b('list-body')}>{listBody}</div>
				{/* Said out loud rather than buried in the privacy policy: people should know
				    what the rule is before they type, not after. */}
				<p className={b('privacy-note')}>{t('messages.privacy_note')}</p>
			</div>
			<div className={b('thread')}>{threadBody}</div>

			{reportOpen && (
				<div className={b('report-backdrop')} onClick={() => setReportOpen(false)}>
					<div className={b('report')} onClick={(e) => e.stopPropagation()}>
						<h2>{t('messages.report_title')}</h2>
						{/* The one place message text leaves the two participants, so it says so
						    plainly instead of hiding behind "we may review your report". */}
						<p className={b('report-explain')}>
							{t('messages.report_explain', {count: REPORT_SNAPSHOT_SIZE})}
						</p>
						<textarea
							autoFocus
							className={b('report-input')}
							value={reportReason}
							maxLength={500}
							placeholder={t('messages.report_placeholder')}
							onChange={(e) => setReportReason(e.target.value)}
						/>
						<div className={b('report-actions')}>
							<Button gray text={t('messages.cancel')} onClick={() => setReportOpen(false)} />
							<Button
								primary
								disabled={reporting || !reportReason.trim()}
								text={t('messages.report_send')}
								onClick={handleReport}
							/>
						</div>
					</div>
				</div>
			)}

			{reportSent && (
				<div className={b('report-backdrop')} onClick={() => setReportSent(false)}>
					<div className={b('report')} onClick={(e) => e.stopPropagation()}>
						<h2>{t('messages.report_sent_title')}</h2>
						<p className={b('report-explain')}>{t('messages.report_sent_body')}</p>
						<div className={b('report-actions')}>
							<Button primary text={t('messages.done')} onClick={() => setReportSent(false)} />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default function Messages() {
	return (
		<FeatureGuard feature="messaging_enabled" pageNameKey="messages.page_title">
			<MessagesPage />
		</FeatureGuard>
	);
}
