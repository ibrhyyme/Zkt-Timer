// Messenger-style chat heads.
//
// The whole point of in-app messaging was that people would not leave the app to talk.
// Sending them to /messages to answer a line of text defeats that: nobody puts the cube
// down mid-session to go find a page. So an incoming message parks the sender's avatar
// in the corner, and tapping it opens a small thread right where they already are.
//
// Two rules exist purely to protect the timer, which outranks this feature everywhere:
// the bubbles hide while a solve is running, and touching the timer closes the window.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import {useTranslation} from 'react-i18next';
import {useSelector} from 'react-redux';
import {Link, useHistory, useLocation} from 'react-router-dom';
import {X, PaperPlaneRight, ArrowSquareOut} from 'phosphor-react';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import MessageBody from '../message_body/MessageBody';
import PresenceDot from '../presence_dot/PresenceDot';
import {OPEN_CHAT_BUBBLE_EVENT, OpenChatBubbleDetail} from '../../../util/chat-bubbles';
import {gqlMutateTyped, gqlQueryTyped} from '../../api';
import {
	DmMessagesDocument,
	DmMessagesQuery,
	SendMessageDocument,
	MarkConversationReadDocument,
} from '../../../@types/generated/graphql';
import {useDmEditListener, useDmMessageListener, useDmPresence, useDmUnsendListener, refreshInbox} from '../../../util/hooks/useInbox';
import {useKeyboardInset} from '../../../util/hooks/useKeyboardInset';
import {useMe} from '../../../util/hooks/useMe';
import {isPro} from '../../../lib/pro';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {getDateFromNow} from '../../../util/dates';
import {getTimeString} from '../../../util/time';
import {getCubeTypeBucketLabel} from '../../../util/cubes/util';
import {toastError} from '../../../util/toast';
import block from '../../../styles/bem';
import './ChatBubbles.scss';

const b = block('chat-bubbles');

type DmMessage = DmMessagesQuery['messages']['messages'][number];

interface Bubble {
	/**
	 * Null when the two have never spoken. Composing from the inbox opens a window
	 * before any thread exists; the id arrives with the first sent message.
	 */
	conversationId: string | null;
	userId: string;
	username: string;
	/** Kept whole so AvatarImage can render the same picture the rest of the app does. */
	user: any;
	unread: number;
}

/**
 * Identity of a bubble for React keys and for the open/closed flag.
 *
 * A bubble with no conversation yet still has to be addressable, so it is keyed by the
 * person instead. Keying everything by conversation id would collapse every pending
 * compose window into one.
 */
function bubbleKey(bubble: {conversationId?: string | null; userId: string}): string {
	return bubble.conversationId || `user:${bubble.userId}`;
}

// Bubbles survive a reload, the way a Messenger chat head does. More than this and the
// corner turns into a wall of faces, so the oldest one drops off.
//
// Pro gets two more slots. Note what this is NOT: it gives the subscriber more of their
// own screen, it never takes anything from the person they are talking to. Read receipts
// and typing stay reciprocal and free for exactly that reason.
const MAX_BUBBLES_FREE = 3;
const MAX_BUBBLES_PRO = 5;
const STORAGE_KEY = 'zkt_chat_bubbles';
const POSITION_KEY = 'zkt_chat_bubbles_pos';

// Geometry the window's height budget is worked out from. Mirrors the stylesheet: an
// avatar bubble ($bubbleAvatarSize), the flex gap between stack items, and the
// breathing room kept between the window and the edge of the screen.
const BUBBLE_SIZE_PX = 45;
const STACK_GAP_PX = 10;
const VIEWPORT_GUTTER_PX = 16;
// Below this the window is not worth showing as a conversation, so it stops shrinking
// and simply scrolls instead.
const MIN_WINDOW_HEIGHT_PX = 280;

/**
 * Where the stack sits. Horizontally it snaps to whichever edge it was released
 * nearest: a bubble parked in the middle of the screen would cover the timer, which is
 * the one thing this feature is not allowed to do. Vertically it goes wherever you put
 * it, clamped so it can never be dragged off screen.
 */
interface Position {
	side: 'left' | 'right';
	/** Percentage of viewport height, matching how the drawer notch stores its own. */
	y: number;
}

const DEFAULT_POSITION: Position = {side: 'right', y: 82};

// Below this a pointer gesture is a tap, above it a drag. Without the gap every click
// would jitter the bubble a pixel and every drag would also open the conversation.
const DRAG_THRESHOLD_PX = 6;

function readPosition(): Position {
	try {
		const raw = localStorage.getItem(POSITION_KEY);
		if (!raw) return DEFAULT_POSITION;
		const parsed = JSON.parse(raw);
		const y = Number(parsed?.y);
		return {
			side: parsed?.side === 'left' ? 'left' : 'right',
			y: Number.isFinite(y) ? Math.max(8, Math.min(92, y)) : DEFAULT_POSITION.y,
		};
	} catch {
		return DEFAULT_POSITION;
	}
}

function writePosition(pos: Position) {
	try {
		localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
	} catch {
		// storage unavailable — position resets on reload, nothing worse
	}
}

function readStored(): Bubble[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function writeStored(bubbles: Bubble[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(bubbles));
	} catch {
		// storage unavailable — bubbles simply do not survive the reload
	}
}

export default function ChatBubbles() {
	const me = useMe();
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const appLoaded = useGeneral('app_loaded');
	// The one state the timer owns: while a solve is running nothing may appear on screen.
	const solving = useSelector((s: any) => Boolean(s?.timer?.solving));
	const maxBubbles = isPro(me) ? MAX_BUBBLES_PRO : MAX_BUBBLES_FREE;

	const [bubbles, setBubbles] = useState<Bubble[]>([]);
	const [openId, setOpenId] = useState<string | null>(null);
	const [messages, setMessages] = useState<DmMessage[]>([]);
	const [draft, setDraft] = useState('');
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(false);
	// Requests no longer raise a bubble, but one stored before that rule existed can
	// still be reopened from localStorage, so the window checks for itself.
	const [threadAccepted, setThreadAccepted] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	// On a phone the open window is the whole screen, and the keyboard covers the bottom
	// of it without resizing the WebView, so the composer has to be lifted by hand.
	const keyboardInset = useKeyboardInset();

	const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
	// While the finger is down the stack follows it anywhere on screen. Only on release
	// does it snap to an edge, so dragging feels like moving an object rather than
	// scrubbing a slider pinned to one side.
	const [dragPoint, setDragPoint] = useState<{x: number; y: number} | null>(null);
	const dragState = useRef<{startX: number; startY: number; moved: boolean} | null>(null);
	const suppressClick = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);
	// Mirror of `bubbles` for handlers that must read the current stack without being
	// re-subscribed every time a message arrives.
	const bubblesRef = useRef<Bubble[]>([]);
	// Where the stack physically was at the instant the finger left it. Kept so the
	// snap can be played back as travel from that spot instead of a teleport.
	const releaseRect = useRef<{left: number; top: number} | null>(null);

	// Starts at a desktop-ish value rather than 0 so the first paint does not clamp the
	// window to its minimum before the real height is known.
	const [viewportHeight, setViewportHeight] = useState(900);

	// Hydrate after mount: localStorage does not exist during SSR.
	useEffect(() => {
		setBubbles(readStored());
		setPosition(readPosition());
		setViewportHeight(window.innerHeight);
	}, []);

	// The height budget is a function of the viewport, so it has to be recalculated
	// when the window is resized or a phone is turned on its side.
	useEffect(() => {
		const onResize = () => setViewportHeight(window.innerHeight);
		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onResize);
		};
	}, []);

	useEffect(() => {
		bubblesRef.current = bubbles;
		if (bubbles.length || readStored().length) {
			writeStored(bubbles);
		}
	}, [bubbles]);

	/**
	 * Plays the edge snap as movement instead of a cut.
	 *
	 * A plain CSS transition cannot do this: mid-drag the stack is placed with `left`
	 * and `top` in pixels, at rest with `right`/`left` and a percentage, and there is
	 * no interpolation between two different sets of offset properties. So the element
	 * is put where it already is (translated back by the difference between the two
	 * layouts) and then released, which the browser can animate because only
	 * `transform` changes.
	 *
	 * Layout effect, not a normal one: this has to happen before the browser paints,
	 * otherwise the first frame shows the stack already snapped and the animation
	 * starts by yanking it backwards.
	 */
	useIsomorphicLayoutEffect(() => {
		const from = releaseRect.current;
		releaseRect.current = null;

		const el = containerRef.current;
		if (!from || !el) return;

		const to = el.getBoundingClientRect();
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		if (!dx && !dy) return;

		// Someone who asked the OS for less motion gets the old instant snap.
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

		el.style.transition = 'none';
		el.style.transform = `translate(${dx}px, ${dy}px)`;
		// Reading a layout property forces the offset to be committed. Without it the
		// browser folds both writes into one recalculation, the starting position never
		// exists, and there is nothing to animate away from.
		void el.offsetWidth;

		el.style.transition = '';
		el.style.transform = '';
	}, [position]);

	const openBubble = bubbles.find((x) => bubbleKey(x) === openId) || null;

	// Only the people whose bubbles are actually on screen.
	const onlineIds = useDmPresence(bubbles.map((x) => x.userId));

	// Touching the timer closes the window, same contract every other dropdown honours.
	// The bubble itself stays: closing the window is not dismissing the conversation.
	useEffect(() => {
		if (!openId) return;
		const close = () => setOpenId(null);
		window.addEventListener('timerInteractionStart', close);
		return () => window.removeEventListener('timerInteractionStart', close);
	}, [openId]);

	useDmMessageListener(
		useCallback(
			(incoming: any) => {
				if (!incoming || !me || incoming.sender_id === me.id) return;

				// Someone whose request has not been accepted does not get to put their
				// face on the timer screen. The message is still delivered and still
				// counts towards the request badge; it just waits in the request box.
				if (incoming.request) return;

				// Already reading this thread: append, do not bump the counter.
				if (incoming.conversation_id === openId) {
					setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
					void gqlMutateTyped(MarkConversationReadDocument, {conversationId: incoming.conversation_id}).catch(
						() => {}
					);
					return;
				}

				setBubbles((prev) => {
					const existing = prev.find((x) => x.conversationId === incoming.conversation_id);
					if (existing) {
						return prev.map((x) =>
							x.conversationId === incoming.conversation_id ? {...x, unread: x.unread + 1} : x
						);
					}

					// A compose window opened for this person before either side wrote:
					// their reply belongs in that window rather than a second bubble.
					const pending = prev.find((x) => !x.conversationId && x.userId === incoming.sender_id);
					if (pending) {
						return prev.map((x) =>
							x === pending
								? {...x, conversationId: incoming.conversation_id, unread: x.unread + 1}
								: x
						);
					}

					const next: Bubble = {
						conversationId: incoming.conversation_id,
						userId: incoming.sender_id,
						username: incoming.sender?.username || '',
						user: incoming.sender,
						unread: 1,
					};
					return [...prev, next].slice(-maxBubbles);
				});
			},
			[me?.id, openId, maxBubbles]
		)
	);

	/**
	 * Opening a conversation from somewhere else in the app, currently the inbox panel.
	 *
	 * The point is that reading a message should not cost you the page you are on. From
	 * the inbox the window opens over the timer, in place, instead of routing away to a
	 * full screen thread and making you find your way back.
	 */
	useEffect(() => {
		function onRequest(e: Event) {
			const detail = (e as CustomEvent<OpenChatBubbleDetail>).detail;
			if (!detail?.userId || !me) return;

			// One bubble per person, never one per way of opening them. Picking someone
			// out of the search who is already in the stack must raise their existing
			// window with its history, not stack an empty second one beside it.
			const existing = bubblesRef.current.find((x) => x.userId === detail.userId);
			const conversationId = detail.conversationId || existing?.conversationId || null;
			const key = bubbleKey({conversationId, userId: detail.userId});

			setBubbles((prev) => {
				if (existing) {
					return prev.map((x) => (x.userId === detail.userId ? {...x, conversationId, unread: 0} : x));
				}

				const next: Bubble = {
					conversationId,
					userId: detail.userId,
					username: detail.username,
					user: detail.user,
					unread: 0,
				};
				return [...prev, next].slice(-maxBubbles);
			});

			setOpenId(key);
			setMessages([]);
			if (conversationId) {
				void loadThread(conversationId);
			} else {
				// Nothing to fetch yet, but the window must not sit on a spinner.
				setLoading(false);
				setThreadAccepted(true);
			}
		}

		window.addEventListener(OPEN_CHAT_BUBBLE_EVENT, onRequest);
		return () => window.removeEventListener(OPEN_CHAT_BUBBLE_EVENT, onRequest);
	}, [me?.id, maxBubbles]);

	// The bubble window shows text too, so an edit has to land here as well or the
	// floating copy keeps showing the old wording.
	useDmEditListener(
		useCallback((payload: {message: any}) => {
			if (!payload?.message?.id) return;
			setMessages((prev) => prev.map((m) => (m.id === payload.message.id ? {...m, ...payload.message} : m)));
		}, [])
	);

	useDmUnsendListener(
		useCallback((payload: {message_id: string}) => {
			setMessages((prev) => prev.filter((m) => m.id !== payload.message_id));
		}, [])
	);

	async function loadThread(conversationId: string) {
		setLoading(true);
		setThreadAccepted(false);
		try {
			const res = await gqlQueryTyped(DmMessagesDocument, {conversationId}, {fetchPolicy: 'no-cache'});
			const rows = (res?.data?.messages?.messages || []) as DmMessage[];
			// The query returns newest-first; the window reads oldest at the top.
			setMessages([...rows].reverse());
			setThreadAccepted(Boolean(res?.data?.messages?.accepted));
			await gqlMutateTyped(MarkConversationReadDocument, {conversationId}).catch(() => {});
			void refreshInbox();
		} catch (e) {
			toastError(e as Error);
		} finally {
			setLoading(false);
		}
	}

	function handleOpen(bubble: Bubble) {
		const key = bubbleKey(bubble);

		if (openId === key) {
			setOpenId(null);
			return;
		}

		setOpenId(key);
		setMessages([]);
		setBubbles((prev) => prev.map((x) => (bubbleKey(x) === key ? {...x, unread: 0} : x)));

		if (bubble.conversationId) {
			void loadThread(bubble.conversationId);
		} else {
			setLoading(false);
			setThreadAccepted(true);
		}
	}

	/**
	 * One gesture handles both jobs. Pointer events cover mouse and touch with the same
	 * code, which is what keeps desktop and mobile behaving identically. Movement under
	 * the threshold stays a tap and opens the conversation; past it the stack follows
	 * the pointer and snaps to the nearer edge on release.
	 */
	function handlePointerDown(e: React.PointerEvent, bubble: Bubble) {
		dragState.current = {startX: e.clientX, startY: e.clientY, moved: false};
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: React.PointerEvent) {
		const drag = dragState.current;
		if (!drag) return;

		const dx = Math.abs(e.clientX - drag.startX);
		const dy = Math.abs(e.clientY - drag.startY);
		if (!drag.moved && dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;

		if (!drag.moved) {
			drag.moved = true;
			// A window anchored to the old spot while the bubble travels looks broken.
			setOpenId(null);
		}

		setDragPoint({x: e.clientX, y: e.clientY});
	}

	function handlePointerUp(e: React.PointerEvent) {
		const drag = dragState.current;
		dragState.current = null;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// pointer already released
		}

		if (!drag?.moved) {
			return;
		}

		// Measured, not derived from the pointer. Mid-drag the stack is centred on the
		// finger, so reading `y` off clientY alone made it drop by half its own height
		// on release. Anchoring to the edge the resting style actually uses keeps the
		// snap purely horizontal, which is the only movement the release should cause.
		const rect = containerRef.current?.getBoundingClientRect();
		releaseRect.current = rect ? {left: rect.left, top: rect.top} : null;

		const vh = window.innerHeight;
		const centreY = rect ? rect.top + rect.height / 2 : e.clientY;
		// `y` means the top edge in the upper half and the bottom edge in the lower
		// half, because that is the edge each branch of `dragStyle` pins.
		const opensDownNext = (centreY / vh) * 100 < 50;
		const anchorY = rect ? (opensDownNext ? rect.top : rect.bottom) : e.clientY;

		const next: Position = {
			side: e.clientX < window.innerWidth / 2 ? 'left' : 'right',
			y: Math.max(8, Math.min(92, (anchorY / vh) * 100)),
		};
		setPosition(next);
		writePosition(next);
		setDragPoint(null);

		// A drag ends with a click event too. Swallow that one so letting go of the
		// bubble does not also open the conversation.
		suppressClick.current = true;
	}

	/**
	 * Opening lives on click rather than pointerup so the bubble stays a real button:
	 * keyboard and assistive tech fire click, never pointer events, and a pointer-only
	 * handler would have made this unreachable without a mouse.
	 */
	function handleClick(bubble: Bubble) {
		if (suppressClick.current) {
			suppressClick.current = false;
			return;
		}

		handleOpen(bubble);
	}

	function dismiss(key: string) {
		setBubbles((prev) => prev.filter((x) => bubbleKey(x) !== key));
		if (openId === key) {
			setOpenId(null);
		}
	}

	async function send() {
		const body = draft.trim();
		if (!body || !openBubble || sending) return;

		const key = bubbleKey(openBubble);
		setSending(true);
		try {
			// A window with no thread behind it addresses the person instead, and the
			// server creates the conversation. Sending both would be ambiguous.
			const res = await gqlMutateTyped(
				SendMessageDocument,
				openBubble.conversationId
					? {body, conversationId: openBubble.conversationId}
					: {body, recipientId: openBubble.userId}
			);
			const sent = res?.data?.sendMessage as DmMessage;
			if (sent) {
				setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));

				// First message in a brand new thread: adopt the id the server just made,
				// so the reply arrives in this window rather than opening a second one.
				if (!openBubble.conversationId && sent.conversation_id) {
					setBubbles((prev) =>
						prev.map((x) => (bubbleKey(x) === key ? {...x, conversationId: sent.conversation_id} : x))
					);
					setOpenId(sent.conversation_id);
				}
			}
			setDraft('');
		} catch (e) {
			toastError(e as Error);
		} finally {
			setSending(false);
		}
	}

	useEffect(() => {
		// One frame later: right after the effect runs the bubbles are in the DOM but the
		// scroll container has not been laid out yet, so scrollHeight is still short and
		// the newest message ends up half-hidden behind the composer.
		const id = requestAnimationFrame(() => {
			const list = bottomRef.current?.parentElement;
			if (list) {
				list.scrollTop = list.scrollHeight;
			}
		});
		return () => cancelAnimationFrame(id);
		// keyboardInset shortens the window on a phone, so the newest message has to be
		// pulled back into view the moment the keyboard takes half the screen.
	}, [messages.length, openId, loading, keyboardInset]);

	// The messages page already is the inbox; a floating copy of it would be noise.
	const onMessagesPage = location.pathname.startsWith('/messages');

	if (!me || !appLoaded || solving || onMessagesPage || bubbles.length === 0) {
		return null;
	}

	// The window opens away from the nearer screen edge: a stack parked at the top drops
	// its window downward, one at the bottom opens upward. Anchoring it the same way in
	// both cases pushed it off screen at one end or the other.
	const opensDown = position.y < 50;

	// The anchor is the bubble, never the container. Pinning the container's centre
	// meant that opening the window grew it in both directions and pushed the bubble
	// itself off screen. Anchoring the edge the stack sits on keeps the bubble exactly
	// where it was dropped and lets only the window move.
	const dragStyle = dragPoint
		? {left: dragPoint.x, top: dragPoint.y, right: 'auto' as const}
		: opensDown
		? {top: `${position.y}%`}
		: {bottom: `${100 - position.y}%`};

	/**
	 * How tall the window may actually be here.
	 *
	 * A fixed viewport-based cap is not enough: the window is anchored to the bubble,
	 * so what limits it is the room between the bubble and the edge it grows towards,
	 * not the height of the screen. On a 768px laptop with the stack parked low, the
	 * full height ran off the top of the page. The stylesheet cannot know the bubble's
	 * position because it lives in an inline style, so the room is measured here.
	 */
	const room = opensDown ? viewportHeight * (1 - position.y / 100) : viewportHeight * (position.y / 100);
	const stackHeight = bubbles.length * BUBBLE_SIZE_PX + (bubbles.length - 1) * STACK_GAP_PX;
	const maxWindowHeight = Math.max(
		MIN_WINDOW_HEIGHT_PX,
		Math.round(room - stackHeight - STACK_GAP_PX - VIEWPORT_GUTTER_PX)
	);

	return (
		<div
			ref={containerRef}
			className={b({
				[position.side]: !dragPoint,
				dragging: Boolean(dragPoint),
				down: opensDown,
				// Drives the full-screen sheet on phones, where the stack has to get out
				// of the way of its own window.
				open: Boolean(openBubble),
				// Only while a window is open: the closed stack is a small floating thing
				// that the keyboard has no reason to move.
				keyboard: Boolean(openBubble) && keyboardInset > 0,
			})}
			// Vertical placement is free-form, so it cannot live in the stylesheet.
			// translate keeps the stack centred on the point it was dropped at.
			style={{
				...dragStyle,
				['--chat-window-max-h' as any]: `${maxWindowHeight}px`,
				['--keyboard-h' as any]: `${openBubble ? keyboardInset : 0}px`,
			}}
		>
			{openBubble && (
				<div className={b('window')}>
					<div className={b('window-head')}>
						<span className={b('window-avatar')}>
							<AvatarImage small user={openBubble.user} profile={openBubble.user?.profile} />
							<PresenceDot online={onlineIds.has(openBubble.userId)} />
						</span>
						<span className={b('window-name')}>{openBubble.username}</span>
						<button
							type="button"
							className={b('window-action')}
							title={t('chat_bubbles.open_full')}
							aria-label={t('chat_bubbles.open_full')}
							// No thread yet means there is no page to expand into, so the
							// inbox is the honest destination.
							onClick={() =>
								history.push(
									openBubble.conversationId ? `/messages/${openBubble.conversationId}` : '/messages'
								)
							}
						>
							<ArrowSquareOut weight="bold" />
						</button>
						<button
							type="button"
							className={b('window-action')}
							title={t('chat_bubbles.close')}
							aria-label={t('chat_bubbles.close')}
							onClick={() => setOpenId(null)}
						>
							<X weight="bold" />
						</button>
					</div>

					<div className={b('window-body')}>
						{loading && <div className={b('window-loading')}>{t('chat_bubbles.loading')}</div>}
						{/* Composing to someone new: the window would otherwise be a blank
						    rectangle with no hint that it is waiting for the first line. */}
						{!loading && messages.length === 0 && (
							<div className={b('window-loading')}>
								{t('chat_bubbles.start_with', {name: openBubble.username})}
							</div>
						)}
						{!loading &&
							messages.map((m) => (
								<div key={m.id} className={b('msg', {mine: m.sender_id === me.id})}>
									{/* A div, not a span: MessageBody renders block children and a
								    div inside a span is invalid markup that hydration trips over. */}
								{m.body && (
									<div className={b('msg-body')}>
										<MessageBody body={m.body} compact trusted={threadAccepted} />
									</div>
								)}
									{/* Without this a shared solve arrived as an empty bubble, which
									    is now the common case: sending happens from the solve card. */}
									{m.solve && (
										<Link className={b('msg-solve')} to={`/solve/${(m.solve as any).share_code}`}>
											<span className={b('msg-solve-time')}>
												{(m.solve as any).dnf ? 'DNF' : getTimeString((m.solve as any).time)}
											</span>
											<span className={b('msg-solve-meta')}>
												{getCubeTypeBucketLabel(
													(m.solve as any).cube_type,
													(m.solve as any).scramble_subset
												) || (m.solve as any).cube_type}
											</span>
										</Link>
									)}
									<span className={b('msg-time')}>
										{getDateFromNow(m.created_at, true)}
										{(m as any).edited_at && <span className={b('msg-edited')}>{t('messages.edited')}</span>}
									</span>
								</div>
							))}
						<div ref={bottomRef} />
					</div>

					<div className={b('window-composer')}>
						<textarea
							className={b('window-input')}
							value={draft}
							placeholder={t('chat_bubbles.placeholder')}
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									void send();
								}
							}}
						/>
						<button
							type="button"
							className={b('window-send')}
							disabled={sending || !draft.trim()}
							aria-label={t('chat_bubbles.send')}
							onClick={() => void send()}
						>
							<PaperPlaneRight weight="bold" />
						</button>
					</div>
				</div>
			)}

			<div className={b('stack')}>
				{bubbles.map((bubble) => (
					<div key={bubbleKey(bubble)} className={b('bubble')}>
						<button
							type="button"
							className={b('bubble-handle', {active: openId === bubbleKey(bubble)})}
							title={bubble.username}
							onPointerDown={(e) => handlePointerDown(e, bubble)}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
							onClick={() => handleClick(bubble)}
						>
							<AvatarImage small user={bubble.user} profile={bubble.user?.profile} />
							<PresenceDot online={onlineIds.has(bubble.userId)} />
							{bubble.unread > 0 && (
								// Keyed on the count so React replaces the node on every new
								// message, which restarts the pop. Without it the animation
								// runs once and later messages arrive silently.
								<span key={bubble.unread} className={b('bubble-badge')}>
									{bubble.unread > 9 ? '9+' : bubble.unread}
								</span>
							)}
						</button>
						<button
							type="button"
							className={b('bubble-dismiss')}
							title={t('chat_bubbles.dismiss')}
							aria-label={t('chat_bubbles.dismiss')}
							onClick={() => dismiss(bubbleKey(bubble))}
						>
							<X weight="bold" />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
