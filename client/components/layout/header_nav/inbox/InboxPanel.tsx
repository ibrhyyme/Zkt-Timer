import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {gql} from '@apollo/client';
import {ArrowsOutSimple, CaretLeft, ChatCircleDots, MagnifyingGlass, PencilSimpleLine} from 'phosphor-react';
import OldDropdown from '../../../common/dropdown/OldDropdown';
import AvatarImage from '../../../common/avatar/avatar_image/AvatarImage';
import Loading from '../../../common/loading/Loading';
import Empty from '../../../common/empty/Empty';
import {gqlMutate, gqlMutateTyped, gqlQuery, gqlQueryTyped} from '../../../api';
import {
	ConversationsDocument,
	ConversationsQuery,
	GetActiveAnnouncementsDocument,
	GetActiveAnnouncementsQuery,
	MarkAnnouncementAsViewedDocument,
	ArchiveConversationDocument,
	MessageRecipientSearchDocument,
	MessageRecipientSearchQuery,
} from '../../../../@types/generated/graphql';
import {bubblesAvailable, openChatBubble} from '../../../../util/chat-bubbles';
import {openInAppBrowser} from '../../../../util/external-link';
import {NOTIFICATION_FRAGMENT} from '../../../../util/graphql/fragments';
import {useInbox, refreshInbox, useDmMessageListener, useDmPresence} from '../../../../util/hooks/useInbox';
import {useMe} from '../../../../util/hooks/useMe';
import {getDateFromNow} from '../../../../util/dates';
import block from '../../../../styles/bem';
import InboxRow from './InboxRow';
import PresenceDot from '../../../messages/presence_dot/PresenceDot';
import './InboxPanel.scss';

const b = block('inbox-panel');

const VIEWPORT_GUTTER = 16;

// Announcements are global, so there is no server-side dismiss for them. Hiding one
// is a per-device preference and lives in localStorage.
const HIDDEN_ANNOUNCEMENTS_KEY = 'zkt_inbox_hidden_announcements';

function readHiddenAnnouncements(): Set<string> {
	try {
		return new Set(JSON.parse(localStorage.getItem(HIDDEN_ANNOUNCEMENTS_KEY) || '[]'));
	} catch {
		return new Set();
	}
}

function hideAnnouncement(id: string) {
	try {
		const next = readHiddenAnnouncements();
		next.add(id);
		localStorage.setItem(HIDDEN_ANNOUNCEMENTS_KEY, JSON.stringify([...next]));
	} catch {
		// storage unavailable — the row simply comes back next session
	}
}

/**
 * Turns a stored notification link into something the router understands.
 *
 * Notifications are written with absolute URLs (https://zktimer.app/admin/users), and
 * history.push treats anything it is given as a path, so those became
 * /https://zktimer.app/admin/users. Old rows in the database still hold absolute URLs,
 * so this has to be fixed where they are read, not only where they are written.
 *
 * A link pointing somewhere else entirely is returned as-is for the caller to open
 * externally rather than being forced through the router.
 */
function toRoutePath(link: string): {path: string; external: boolean} {
	if (!link) return {path: '', external: false};
	if (!/^https?:\/\//i.test(link)) {
		return {path: link.startsWith('/') ? link : `/${link}`, external: false};
	}

	try {
		const url = new URL(link);
		if (typeof window !== 'undefined' && url.host === window.location.host) {
			return {path: `${url.pathname}${url.search}${url.hash}`, external: false};
		}
		return {path: link, external: true};
	} catch {
		return {path: link, external: false};
	}
}

/** Colour key on the left edge, the same vocabulary as the cube-face legend. */
function keyToneFor(row: Row): string {
	if (row.kind === 'message') return 'message';
	if (row.kind === 'announcement') return 'announcement';

	const category = String(row.data?.notification_category_name || '').toLowerCase();
	if (category.includes('wca') || category.includes('zkt')) return 'competition';
	if (category.includes('member') || category.includes('pro')) return 'membership';
	return 'system';
}

const NOTIFICATIONS_QUERY = gql`
	${NOTIFICATION_FRAGMENT}
	query Query($page: Int) {
		notifications(page: $page) {
			...NotificationFragment
		}
	}
`;

// The badge must reflect every unread notification, not just the ones on the first
// page of the list, so the true count comes from the server.
const UNREAD_NOTIFICATION_COUNT = gql`
	query Query {
		unreadNotificationCount
	}
`;

const MARK_NOTIFICATION_READ = gql`
	mutation Mutate($id: String) {
		markNotificationAsRead(id: $id) {
			id
		}
	}
`;

const DELETE_NOTIFICATION = gql`
	mutation Mutate($id: String) {
		deleteNotification(id: $id) {
			id
		}
	}
`;

// One call for the whole lot. Looping over the loaded page left everything past the
// first ten in place, so the list appeared to refill itself every time it was cleared.
const DELETE_ALL_NOTIFICATIONS = gql`
	mutation Mutate {
		deleteAllNotifications
	}
`;

type Conversation = ConversationsQuery['conversations']['conversations'][number];
type Announcement = GetActiveAnnouncementsQuery['getActiveAnnouncements'][number];
type Recipient = MessageRecipientSearchQuery['messageRecipientSearch'][number];

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

type Row =
	| {kind: 'message'; id: string; date: number; unread: boolean; data: Conversation}
	| {kind: 'notification'; id: string; date: number; unread: boolean; data: any}
	| {kind: 'announcement'; id: string; date: number; unread: boolean; data: Announcement};

/**
 * The single attention surface: messages, notifications and announcements in one
 * chronological list behind one icon.
 *
 * Everything that wants the user's attention competes on recency alone. Splitting
 * them into tabs only asks the user to check three places instead of one.
 */
export default function InboxPanel() {
	const {t} = useTranslation();
	const history = useHistory();
	const inbox = useInbox();
	const me = useMe();
	const rootRef = useRef<HTMLDivElement>(null);

	const dropdownRef = useRef<any>(null);

	const [rows, setRows] = useState<Row[]>([]);
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [extraUnread, setExtraUnread] = useState(0);

	// Composing takes over the panel rather than opening a second surface on top of it.
	// Somewhere to type a name is the whole feature; a modal for it would be heavier
	// than the thing it is looking for.
	const [composing, setComposing] = useState(false);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<Recipient[]>([]);
	const [searching, setSearching] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [convRes, notifRes, annRes, countRes] = await Promise.all([
				gqlQueryTyped(ConversationsDocument, {page: 1, requests: false}, {fetchPolicy: 'no-cache'}).catch(() => null),
				gqlQuery(NOTIFICATIONS_QUERY, {page: 0} as any).catch(() => null),
				gqlQueryTyped(GetActiveAnnouncementsDocument, {}, {fetchPolicy: 'no-cache'}).catch(() => null),
				gqlQuery(UNREAD_NOTIFICATION_COUNT).catch(() => null),
			]);

			const conversations = (convRes?.data?.conversations?.conversations || []) as Conversation[];
			const notifications = ((notifRes as any)?.data?.notifications || []) as any[];
			const announcements = (annRes?.data?.getActiveAnnouncements || []) as Announcement[];
			const hidden = readHiddenAnnouncements();

			const merged: Row[] = [
				...conversations.map((c) => ({
					kind: 'message' as const,
					id: `m-${c.id}`,
					date: new Date(c.last_message_at).getTime(),
					unread: c.unread_count > 0,
					data: c,
				})),
				...notifications.map((n) => ({
					kind: 'notification' as const,
					id: `n-${n.id}`,
					date: new Date(n.created_at).getTime(),
					unread: !n.read_at,
					data: n,
				})),
				...announcements.filter((a) => !hidden.has(a.id)).map((a) => ({
					kind: 'announcement' as const,
					id: `a-${a.id}`,
					date: new Date(a.createdAt).getTime(),
					unread: !a.hasViewed,
					data: a,
				})),
			].sort((x, y) => y.date - x.date);

			setRows(merged);
			// Notifications and announcements are not tracked by useInbox, so their
			// unread counts are folded into the badge here.
			const notifUnread = (countRes as any)?.data?.unreadNotificationCount ?? notifications.filter((n) => !n.read_at).length;
			setExtraUnread(notifUnread + announcements.filter((a) => !a.hasViewed && !hidden.has(a.id)).length);
			setLoaded(true);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	/**
	 * Patch the list from the message we were just handed, instead of refetching it.
	 *
	 * The socket event already carries everything a row needs: sender, body, timestamp.
	 * Reloading meant one arriving message cost five requests, and four of them were
	 * for notifications and announcements, which cannot possibly have changed because
	 * somebody sent a chat message. Measured at 5-6 requests per message before this,
	 * and one after (the badge count, which is still the server's to decide).
	 *
	 * A message in a thread we have never seen is the one case worth a real load: there
	 * is no row to patch and we do not have the other participant's details.
	 */
	useDmMessageListener(
		useCallback(
			(incoming: any) => {
				if (!incoming?.conversation_id) return;

				let known = false;
				setRows((prev) => {
					const next = prev.map((row) => {
						if (row.kind !== 'message' || row.data.id !== incoming.conversation_id) return row;
						known = true;

						const mine = incoming.sender_id === me?.id;
						return {
							...row,
							date: new Date(incoming.created_at).getTime(),
							// My own message in another tab is not unread to me.
							unread: mine ? row.unread : true,
							data: {
								...row.data,
								last_message: incoming,
								last_message_at: incoming.created_at,
								unread_count: mine ? row.data.unread_count : row.data.unread_count + 1,
							},
						};
					});

					// Newest first, same order load() produces.
					return known ? [...next].sort((x, y) => y.date - x.date) : prev;
				});

				if (!known) void load();
			},
			[load, me?.id]
		)
	);

	// Only the people actually listed. Asking about anyone else would be handing the
	// server a list of users to check, which is not what this panel is for.
	const conversationUserIds = rows
		.filter((r): r is Extract<Row, {kind: 'message'}> => r.kind === 'message')
		.map((r) => (r.data.other_user as any)?.id)
		.filter(Boolean);
	const onlineIds = useDmPresence(conversationUserIds);

	// Debounced so typing a name is one request, not one per keystroke.
	useEffect(() => {
		const term = query.trim();
		if (term.length < MIN_SEARCH_LENGTH) {
			setResults([]);
			setSearching(false);
			return;
		}

		let cancelled = false;
		setSearching(true);
		const timer = setTimeout(async () => {
			try {
				const res = await gqlQueryTyped(
					MessageRecipientSearchDocument,
					{query: term},
					{fetchPolicy: 'no-cache'}
				);
				if (!cancelled) setResults((res?.data?.messageRecipientSearch as Recipient[]) || []);
			} catch {
				if (!cancelled) setResults([]);
			} finally {
				if (!cancelled) setSearching(false);
			}
		}, SEARCH_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [query]);

	// Requests are visible in-app but never trigger a push, so a stranger cannot make
	// someone's phone buzz. The badge is the only place they announce themselves.
	const totalUnread = inbox.unread_total + inbox.request_count + extraUnread;

	// The panel is left-anchored so it opens rightward from the icon, but the icon
	// sits near the right edge of the header. Nudge it back just far enough to stay
	// on screen instead of flipping the whole panel back across the nav.
	function clampToViewport() {
		const panel = rootRef.current?.querySelector<HTMLElement>('.cd-common__dropdown__body');
		if (!panel) return;

		panel.style.transform = '';
		const rect = panel.getBoundingClientRect();
		const overflow = rect.right - (window.innerWidth - VIEWPORT_GUTTER);
		if (overflow > 0) {
			panel.style.transform = `translateX(-${Math.ceil(overflow)}px)`;
		}
	}

	function handleOpen() {
		void refreshInbox();
		void load();
		// Reopening always lands on the list. A half-typed name from last time is not
		// what anyone came back for.
		closeCompose();
		// Runs after the dropdown has painted, so the measurement is real.
		requestAnimationFrame(clampToViewport);
	}

	/**
	 * Opens a conversation without leaving the page.
	 *
	 * Reading a message should never cost you what you were doing. Routing to the full
	 * thread meant a reply from the timer was: leave the timer, answer, find your way
	 * back. The floating window removes all three steps.
	 *
	 * Two cases still route: a phone, where the bubbles give way to the full screen
	 * page, and the messages page itself, where a floating copy of the thread you are
	 * already reading would be nonsense.
	 */
	function openConversation(conversation: Conversation) {
		const other = conversation.other_user as any;
		const onMessagesPage = history.location.pathname.startsWith('/messages');

		if (!other || !bubblesAvailable() || onMessagesPage) {
			history.push(`/messages/${conversation.id}`);
			return;
		}

		openChatBubble({
			conversationId: conversation.id,
			userId: other.id,
			username: other.username || '',
			user: other,
		});
		dropdownRef.current?.close();
	}

	/** Same, for someone picked out of the search rather than the list. */
	function openRecipient(recipient: Recipient) {
		const onMessagesPage = history.location.pathname.startsWith('/messages');

		// Searching for someone you already talk to should land in that conversation,
		// not in an empty one. The inbox is already loaded, so this costs no request.
		const known = rows.find(
			(r) => r.kind === 'message' && (r.data.other_user as any)?.id === recipient.id
		);
		const conversationId = known?.kind === 'message' ? known.data.id : null;

		if (!bubblesAvailable() || onMessagesPage) {
			history.push(
				conversationId ? `/messages/${conversationId}` : `/messages/new?to=${encodeURIComponent(recipient.username || '')}`
			);
			return;
		}

		openChatBubble({
			conversationId,
			userId: recipient.id,
			username: recipient.username || '',
			user: recipient,
		});
		closeCompose();
		dropdownRef.current?.close();
	}

	function closeCompose() {
		setComposing(false);
		setQuery('');
		setResults([]);
	}

	function openRow(row: Row) {
		if (row.kind === 'message') {
			openConversation(row.data);
			return;
		}

		if (row.kind === 'notification') {
			const notif = row.data;
			if (row.unread) {
				void gqlMutate(MARK_NOTIFICATION_READ, {id: notif.id}).catch(() => {});
			}
			if (notif.link) {
				const {path, external} = toRoutePath(notif.link);
				if (external) openInAppBrowser(path);
				else history.push(path);
			}
			void load();
			return;
		}

		const announcement = row.data;
		if (row.unread) {
			void gqlMutate(MarkAnnouncementAsViewedDocument as any, {announcementId: announcement.id}).catch(() => {});
		}
		if (announcement.targetUrl) {
			const {path, external} = toRoutePath(announcement.targetUrl);
			if (external) openInAppBrowser(path);
			else history.push(path);
		}
		void load();
	}

	/**
	 * Removes one row from the inbox. "Dismiss" means something different per kind:
	 * a notification is deleted, a conversation is archived out of your own inbox
	 * (the other side keeps theirs), and a global announcement is hidden locally.
	 */
	async function dismissRow(row: Row) {
		setRows((prev) => prev.filter((r) => r.id !== row.id));

		try {
			if (row.kind === 'message') {
				await gqlMutateTyped(ArchiveConversationDocument, {conversationId: row.data.id});
				void refreshInbox();
				return;
			}

			if (row.kind === 'notification') {
				await gqlMutate(DELETE_NOTIFICATION, {id: row.data.id});
				setExtraUnread((n) => (row.unread ? Math.max(0, n - 1) : n));
				return;
			}

			hideAnnouncement(row.data.id);
			if (row.unread) {
				await gqlMutateTyped(MarkAnnouncementAsViewedDocument, {announcementId: row.data.id});
				setExtraUnread((n) => Math.max(0, n - 1));
			}
		} catch {
			// Put it back if the server refused, so the list never lies.
			void load();
		}
	}

	/**
	 * Empties the notification side of the inbox.
	 *
	 * Two deliberate choices. It goes through one server call rather than looping over
	 * what happens to be loaded, because the list only holds ten at a time and the old
	 * loop left everything past the first page untouched: the panel refilled itself and
	 * looked broken.
	 *
	 * And it leaves conversations alone. They share this panel, but archiving somebody's
	 * entire chat list behind a button labelled "clear" is not something anyone means to
	 * press, and it is not what a notification centre does.
	 */
	async function dismissAll() {
		const clearable = rows.filter((r) => r.kind !== 'message');
		if (clearable.length === 0) return;
		if (!window.confirm(t('inbox.clear_confirm'))) return;

		setRows((prev) => prev.filter((r) => r.kind === 'message'));

		try {
			await gqlMutate(DELETE_ALL_NOTIFICATIONS);
		} catch {
			// Put the list back if the server refused, so it never lies about being empty.
			void load();
			return;
		}

		// Announcements are global, so "clearing" one is a per-device preference.
		for (const row of clearable) {
			if (row.kind !== 'announcement') continue;
			hideAnnouncement(row.data.id);
			if (row.unread) {
				await gqlMutateTyped(MarkAnnouncementAsViewedDocument, {announcementId: row.data.id}).catch(() => {});
			}
		}

		setExtraUnread(0);
		void load();
	}

	function renderRow(row: Row) {
		const isMessage = row.kind === 'message';
		const title = isMessage
			? row.data.other_user?.username
			: row.kind === 'announcement'
				? t('inbox.announcement')
				: row.data.notification_category_name;

		const text = isMessage
			? row.data.last_message?.body || (row.data.last_message?.solve ? t('inbox.sent_a_solve') : '')
			: row.kind === 'announcement'
				? row.data.title
				: row.data.in_app_message || row.data.message;

		const stamp = isMessage
			? row.data.last_message_at
			: row.kind === 'announcement'
				? row.data.createdAt
				: row.data.created_at;

		return (
			<>
				<span className={b('key', {tone: keyToneFor(row)})} />
				{isMessage && (
					<span className={b('avatar')}>
						<AvatarImage
							tiny
							user={row.data.other_user as any}
							profile={(row.data.other_user as any)?.profile}
						/>
						<PresenceDot small online={onlineIds.has((row.data.other_user as any)?.id)} />
					</span>
				)}
				<span className={b('title')}>{title}</span>
				<span className={b('text')}>{text}</span>
				<span className={b('stamp')}>{getDateFromNow(stamp, true)}</span>
			</>
		);
	}

	/**
	 * The compose list. Nothing is shown before two characters are typed: search is the
	 * only way to reach someone on purpose, so that people cannot be browsed as a
	 * directory. Anyone who set their profile to unlisted never appears here.
	 */
	let composeBody = null;
	if (query.trim().length < MIN_SEARCH_LENGTH) {
		composeBody = <Empty text={t('inbox.search_hint')} />;
	} else if (searching) {
		composeBody = <Loading />;
	} else if (results.length === 0) {
		composeBody = <Empty text={t('inbox.no_people')} />;
	} else {
		composeBody = results.map((person) => (
			<button
				key={person.id}
				type="button"
				className={b('person')}
				onClick={() => openRecipient(person)}
			>
				<AvatarImage tiny user={person as any} profile={(person as any).profile} />
				<span className={b('person-name')}>{person.username}</span>
			</button>
		));
	}

	let body = null;
	if (loading && !loaded) {
		body = <Loading />;
	} else if (rows.length === 0) {
		body = <Empty text={t('inbox.empty')} />;
	} else {
		body = rows.map((row) => (
			<InboxRow
				key={row.id}
				unread={row.unread}
				onOpen={() => openRow(row)}
				onDismiss={() => void dismissRow(row)}
			>
				{renderRow(row)}
				{row.unread && <span className={b('dot')} />}
			</InboxRow>
		));
	}

	return (
		<div className={b()} ref={rootRef}>
			{totalUnread > 0 && <span className={b('badge')}>{totalUnread > 99 ? '99+' : totalUnread}</span>}
			<OldDropdown
				ref={dropdownRef}
				left
				preventCloseOnInnerClick
				onOpen={handleOpen}
				rawHandle={
					<div className={b('handle')} title={t('inbox.title')}>
						<ChatCircleDots weight="bold" />
					</div>
				}
			>
				<div className={b('head')}>
					{composing && (
						<button
							type="button"
							className={b('head-action')}
							title={t('inbox.back')}
							aria-label={t('inbox.back')}
							// Both header buttons unmount themselves on click. The dropdown
							// decides whether a click was "inside" by walking up from the
							// clicked node, and a node React has already removed no longer
							// leads anywhere, so the panel would close instead of switching
							// views. Keeping the event off window sidesteps that entirely.
							onClick={(e) => {
								e.stopPropagation();
								closeCompose();
							}}
						>
							<CaretLeft weight="bold" />
						</button>
					)}
					<span className={b('head-title')}>{composing ? t('inbox.new_message') : t('inbox.title')}</span>
					{!composing && (
						<>
							{/* Expand, the way Instagram does it: the panel is for answering,
							    the page is for everything else. */}
							<button
								type="button"
								className={b('head-action')}
								title={t('inbox.open_full')}
								aria-label={t('inbox.open_full')}
								onClick={() => {
									dropdownRef.current?.close();
									history.push('/messages');
								}}
							>
								<ArrowsOutSimple weight="bold" />
							</button>
							<button
								type="button"
								className={b('head-action')}
								title={t('inbox.new_message')}
								aria-label={t('inbox.new_message')}
								// See the back button: this unmounts itself, so the click must
								// not reach the dropdown's outside-click listener.
								onClick={(e) => {
									e.stopPropagation();
									setComposing(true);
								}}
							>
								<PencilSimpleLine weight="regular" />
							</button>
						</>
					)}
				</div>

				{composing ? (
					<>
						<div className={b('search')}>
							<MagnifyingGlass weight="bold" />
							<input
								className={b('search-input')}
								value={query}
								autoFocus
								placeholder={t('inbox.search_people')}
								onChange={(e) => setQuery(e.target.value)}
							/>
						</div>
						<div className={b('body')}>{composeBody}</div>
					</>
				) : (
					<>
						{/* A request never pushes, so this row is how it announces itself. */}
						{inbox.request_count > 0 && (
							<button
								type="button"
								className={b('requests')}
								onClick={() => {
									dropdownRef.current?.close();
									history.push('/messages?requests=1');
								}}
							>
								<span className={b('requests-dot')} />
								{t('inbox.request_line', {count: inbox.request_count})}
							</button>
						)}
						<div className={b('body')}>{body}</div>
						<button
							type="button"
							className={b('footer')}
							onClick={dismissAll}
							disabled={rows.every((r) => r.kind === 'message')}
						>
							{t('inbox.clear_all')}
						</button>
					</>
				)}
			</OldDropdown>
		</div>
	);
}
