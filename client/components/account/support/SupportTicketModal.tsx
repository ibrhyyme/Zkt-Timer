import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {gql, useMutation, useQuery} from '@apollo/client';
import {Lifebuoy, Paperclip, PaperPlaneRight, X} from 'phosphor-react';
import Avatar from '../../common/avatar/Avatar';
import Tag from '../../common/tag/Tag';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import {toastError} from '../../../util/toast';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {getLongDate, getRelativeDayKey, getTimeOfDay, isSameCalendarDay} from '../../../util/dates';
import {SupportTicket as SupportTicketSchema} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {useAppVisible} from '../../../util/hooks/useAppVisible';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import {useIsMobile} from '../../../util/hooks/useIsMobile';
import block from '../../../styles/bem';
import SupportAttachments, {AttachmentLike} from './SupportAttachments';
import './SupportTicketModal.scss';

const b = block('support-ticket-modal');

const MAX_FILES = 1;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// Live conversation: refetch this often while the ticket is on screen and the app is visible.
const POLL_INTERVAL_MS = 6000;
// Messages from the same side inside this window render as one visual group.
const GROUP_WINDOW_MS = 5 * 60 * 1000;
// How close to the bottom the user must be for new messages to auto-scroll.
const STICK_TO_BOTTOM_PX = 140;

const SUPPORT_TICKET_DETAIL = gql`
	query Query($id: String!) {
		supportTicket(id: $id) {
			id
			created_at
			subject
			message
			device_info
			resolved_at
			user_read_at
			admin_read_at
			created_by_id
			created_by {
				id
				username
				profile {
					pfp_image {
						id
						user_id
						storage_path
					}
				}
			}
			messages {
				id
				body
				is_admin
				created_at
				sender {
					id
					username
					profile {
						pfp_image {
							id
							user_id
							storage_path
						}
					}
				}
				attachments {
					id
					storage_path
					mime_type
					kind
					size_bytes
					original_name
				}
			}
		}
	}
`;

// The full message shape is requested back so the newly sent message (attachments
// included) lands in the Apollo cache immediately instead of waiting for the refetch.
const ADD_MESSAGE = gql`
	mutation Mutate($ticketId: String!, $body: String!, $attachments: [Upload!]) {
		addSupportTicketMessage(ticketId: $ticketId, body: $body, attachments: $attachments) {
			id
			body
			is_admin
			created_at
			sender {
				id
				username
				profile {
					pfp_image {
						id
						user_id
						storage_path
					}
				}
			}
			attachments {
				id
				storage_path
				mime_type
				kind
				size_bytes
				original_name
			}
		}
	}
`;

const RESOLVE_TICKET = gql`
	mutation Mutate($id: String!) {
		resolveSupportTicket(id: $id) {
			id
			resolved_at
		}
	}
`;

const REOPEN_TICKET = gql`
	mutation Mutate($id: String!) {
		reopenSupportTicket(id: $id) {
			id
			resolved_at
		}
	}
`;

const MARK_READ = gql`
	mutation Mutate($id: String!) {
		markSupportTicketRead(id: $id) {
			id
			user_read_at
			admin_read_at
		}
	}
`;

interface Props {
	ticketId: string;
	isAdminView?: boolean;
	onUpdate?: () => void;
}

type TimelineMessage = {
	id: string;
	body: string;
	created_at: any;
	is_admin: boolean;
	sender?: {id?: string | null; username?: string | null; profile?: any} | null;
	attachments?: AttachmentLike[] | null;
};

interface TimelineItem {
	message: TimelineMessage;
	/** Written by the support side (admin), regardless of who is looking at it. */
	isSupportSide: boolean;
	/** Right hand side of the conversation for the current viewer. */
	isMine: boolean;
	/** First message of a visual group — carries the avatar and the author name. */
	isGroupStart: boolean;
	/** Last message of a visual group — carries the tail on the bubble corner. */
	isGroupEnd: boolean;
	dayLabel: string | null;
}

interface PendingFile {
	id: string;
	file: File;
	previewUrl: string;
	kind: 'image' | 'video';
}

function classifyFile(file: File): 'image' | 'video' | null {
	const mime = (file.type || '').toLowerCase();
	if (ALLOWED_IMAGE_TYPES.includes(mime)) return 'image';
	if (ALLOWED_VIDEO_TYPES.includes(mime)) return 'video';
	return null;
}

export default function SupportTicketModal({ticketId, isAdminView, onUpdate}: Props) {
	const {t} = useTranslation();
	const me = useMe();
	const isMobile = useIsMobile();
	const appVisible = useAppVisible();
	const [reply, setReply] = useState('');
	const [pending, setPending] = useState<PendingFile[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const timelineRef = useRef<HTMLDivElement>(null);
	const stickToBottomRef = useRef(true);
	const renderedCountRef = useRef(0);

	// Track the latest pending list so the unmount cleanup revokes the object URLs
	// that actually exist at unmount — not the stale initial [] captured by an empty-dep effect.
	const pendingRef = useRef<PendingFile[]>(pending);
	pendingRef.current = pending;

	useEffect(() => {
		return () => {
			pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
		};
	}, []);

	const {data, loading, refetch} = useQuery<{supportTicket: SupportTicketSchema}>(SUPPORT_TICKET_DETAIL, {
		variables: {id: ticketId},
		fetchPolicy: 'cache-and-network',
		// Live conversation. Polling pauses while the app is backgrounded so a modal left
		// open on a phone does not keep hitting the API.
		pollInterval: appVisible ? POLL_INTERVAL_MS : 0,
	});

	// Coming back to the tab should show the current state right away, not after a poll tick.
	useEffect(() => {
		if (!appVisible) return;
		refetch().catch(() => undefined);
	}, [appVisible]);

	const [addMessage, {loading: sending}] = useMutation(ADD_MESSAGE, {
		// apollo-upload-client v15 does not add the CSRF preflight header on multipart
		// requests; the CSRF middleware (server/middlewares/csrf.ts) expects it.
		context: {
			headers: {
				'apollo-require-preflight': 'true',
			},
		},
	});
	const [resolveTicket, {loading: resolving}] = useMutation(RESOLVE_TICKET);
	const [reopenTicket, {loading: reopening}] = useMutation(REOPEN_TICKET);
	const [markRead] = useMutation(MARK_READ);

	const ticket = data?.supportTicket;
	const isResolved = !!ticket?.resolved_at;

	// Stamp the viewer's side as read once the conversation is on screen, and again
	// whenever a newer message arrives while it stays open.
	const lastMarkedMessageRef = useRef<string | null>(null);
	const lastMessageId = ticket?.messages?.length
		? ticket.messages[ticket.messages.length - 1].id
		: ticket?.id || null;

	useEffect(() => {
		if (!ticket?.id || !lastMessageId) return;
		if (lastMarkedMessageRef.current === lastMessageId) return;
		lastMarkedMessageRef.current = lastMessageId;
		markRead({variables: {id: ticket.id}})
			.then(() => onUpdate?.())
			.catch(() => undefined);
	}, [ticket?.id, lastMessageId]);

	const timeline = useMemo<TimelineItem[]>(() => {
		if (!ticket) return [];

		const messages: TimelineMessage[] = [
			{
				id: 'initial',
				body: ticket.message,
				created_at: ticket.created_at,
				// The opening message always belongs to the person who created the ticket.
				is_admin: false,
				sender: ticket.created_by,
				attachments: null,
			},
			...((ticket.messages || []) as TimelineMessage[]).map((msg) => ({
				...msg,
				is_admin: !!msg.is_admin,
			})),
		];

		return messages.map((message, index) => {
			const prev = messages[index - 1];
			const next = messages[index + 1];
			const isSupportSide = message.is_admin;

			const newDay = !prev || !isSameCalendarDay(prev.created_at, message.created_at);
			const groupedWithPrev =
				!!prev &&
				!newDay &&
				prev.is_admin === isSupportSide &&
				new Date(message.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS;
			const groupedWithNext =
				!!next &&
				isSameCalendarDay(message.created_at, next.created_at) &&
				next.is_admin === isSupportSide &&
				new Date(next.created_at).getTime() - new Date(message.created_at).getTime() < GROUP_WINDOW_MS;

			let dayLabel: string | null = null;
			if (newDay) {
				const relative = getRelativeDayKey(message.created_at);
				dayLabel = relative ? t(`support.${relative}`) : getLongDate(message.created_at);
			}

			return {
				message,
				isSupportSide,
				// Side is decided by role, never by comparing ids: an unresolved viewer id
				// used to make every bubble land on the same side.
				isMine: isAdminView ? isSupportSide : !isSupportSide,
				isGroupStart: !groupedWithPrev,
				isGroupEnd: !groupedWithNext,
				dayLabel,
			};
		});
	}, [ticket, isAdminView, t]);

	// One technical line for whoever answers the ticket. Deliberately unlocalised: it is
	// admin-only and every token in it is a version string or a model name.
	const deviceSummary = useMemo(() => {
		if (!isAdminView || !ticket?.device_info) return '';

		let info: Record<string, any>;
		try {
			info = JSON.parse(ticket.device_info);
		} catch (e) {
			// Older or hand-edited rows: show the raw value rather than nothing.
			return ticket.device_info;
		}

		const parts = [
			[info.operatingSystem, info.osVersion].filter(Boolean).join(' '),
			[info.manufacturer, info.model].filter(Boolean).join(' '),
			info.webViewVersion && `WebView ${info.webViewVersion}`,
			info.appVersion && `app ${info.appVersion}${info.appBuild ? ` (${info.appBuild})` : ''}`,
			info.otaBundle && `OTA ${info.otaBundle}`,
			info.isVirtual && 'emulator',
			info.language,
		];

		return parts.filter(Boolean).join(' · ');
	}, [isAdminView, ticket?.device_info]);

	function handleTimelineScroll() {
		const el = timelineRef.current;
		if (!el) return;
		stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
	}

	// Keep the newest message in view — but never yank the view away from someone
	// who scrolled up to read the history.
	useIsomorphicLayoutEffect(() => {
		const el = timelineRef.current;
		if (!el) return;
		if (timeline.length === renderedCountRef.current) return;

		const isFirstPaint = renderedCountRef.current === 0;
		renderedCountRef.current = timeline.length;

		if (isFirstPaint || stickToBottomRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [timeline.length]);

	function autoGrowTextarea() {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
	}

	const clearPending = useCallback(() => {
		setPending((prev) => {
			prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
			return [];
		});
	}, []);

	function openFilePicker() {
		const input = fileInputRef.current;
		if (!input) return;
		// Reset here rather than after selection: on iOS WebKit clearing the input once a
		// File is already held detaches it, and the upload then leaves with an empty body.
		input.value = '';
		input.click();
	}

	function handleFilesSelected(filesList: FileList | null) {
		if (!filesList || filesList.length === 0) return;

		const incoming = Array.from(filesList);
		if (pending.length + incoming.length > MAX_FILES) {
			toastError(t('support.attach_max_reached', {count: MAX_FILES}));
			return;
		}

		const accepted: PendingFile[] = [];
		for (const file of incoming) {
			const kind = classifyFile(file);
			if (!kind) {
				toastError(t('support.attach_invalid_type'));
				continue;
			}
			const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
			if (file.size > limit) {
				const sizeMb = Math.floor(limit / (1024 * 1024));
				toastError(t('support.attach_too_large', {size: `${sizeMb}MB`}));
				continue;
			}
			accepted.push({
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				file,
				previewUrl: URL.createObjectURL(file),
				kind,
			});
		}

		if (accepted.length === 0) return;
		setPending((prev) => [...prev, ...accepted]);
	}

	function removePending(id: string) {
		setPending((prev) => {
			const target = prev.find((p) => p.id === id);
			if (target) URL.revokeObjectURL(target.previewUrl);
			return prev.filter((p) => p.id !== id);
		});
	}

	async function handleSend() {
		const trimmed = reply.trim();
		if (!trimmed && pending.length === 0) return;
		if (sending) return;

		try {
			await addMessage({
				variables: {
					ticketId,
					body: trimmed,
					attachments: pending.length > 0 ? pending.map((p) => p.file) : null,
				},
			});
			setReply('');
			clearPending();
			// Own message: always ride the scroll down to it.
			stickToBottomRef.current = true;
			if (textareaRef.current) {
				textareaRef.current.style.height = 'auto';
			}
			await refetch();
			onUpdate?.();
		} catch (e: any) {
			toastError(getGqlErrorMessage(e, t, 'support.error'));
		}
	}

	function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key !== 'Enter') return;
		// Enter while an IME candidate window is open commits the candidate, it does not
		// end the message.
		if ((e.nativeEvent as any)?.isComposing) return;
		// Ctrl/Cmd+Enter always sends. Plain Enter sends on desktop only — on a phone
		// the same key is the newline the on-screen keyboard offers.
		const modifierSend = e.ctrlKey || e.metaKey;
		if (!modifierSend && (isMobile || e.shiftKey)) return;
		e.preventDefault();
		handleSend();
	}

	async function handleResolve() {
		try {
			await resolveTicket({variables: {id: ticketId}});
			await refetch();
			onUpdate?.();
		} catch (e: any) {
			toastError(getGqlErrorMessage(e, t, 'support.error'));
		}
	}

	async function handleReopen() {
		try {
			await reopenTicket({variables: {id: ticketId}});
			await refetch();
			onUpdate?.();
		} catch (e: any) {
			toastError(getGqlErrorMessage(e, t, 'support.error'));
		}
	}

	// Polls keep `loading` false once the first response landed, so the conversation
	// never flashes back to a spinner while it stays open.
	if (!ticket) {
		return (
			<div className={b({loading: true})}>
				{loading ? <Loading /> : <div className={b('closed-note')}>{t('support.error')}</div>}
			</div>
		);
	}

	const canSend = (reply.trim().length > 0 || pending.length > 0) && !sending && !isResolved;
	// Attaching is open to both sides: a reporter who cannot send a screenshot has to
	// describe the bug in words, which is the slowest possible support loop.
	const showAttachUI = !isResolved;

	return (
		<div className={b()}>
			<div className={b('header')}>
				<h2 className={b('subject')}>{ticket.subject}</h2>
				<Tag
					small
					backgroundColor={isResolved ? 'green' : 'orange'}
					text={isResolved ? t('support.status_resolved') : t('support.status_open')}
				/>
			</div>

			{isAdminView && deviceSummary && <div className={b('device')}>{deviceSummary}</div>}

			<div className={b('timeline')} ref={timelineRef} onScroll={handleTimelineScroll} role="log" aria-live="polite">
				{timeline.map((item) => {
					const {message, isMine, isSupportSide, isGroupStart, isGroupEnd, dayLabel} = item;
					const attachments = (message.attachments || []) as AttachmentLike[];
					const hasBody = !!message.body && message.body.trim().length > 0;
					// Name follows the side it is printed on. "You" is only ever allowed on
					// the viewer's own side: an admin who also owns the ticket matches
					// `isSelf` on both sides, and labelling the opposite bubble "You" reads
					// as a bug. Within the viewer's side, a second admin keeps their name.
					const isSelf = !!me?.id && message.sender?.id === me.id;
					const authorName = isMine
						? isSelf
							? t('support.you')
							: message.sender?.username || t('support.admin_label')
						: isSupportSide
						? t('support.admin_label')
						: message.sender?.username || '';

					return (
						<React.Fragment key={message.id}>
							{dayLabel && (
								<div className={b('day-separator')}>
									<span>{dayLabel}</span>
								</div>
							)}
							<div className={b('row', {mine: isMine, grouped: !isGroupStart})}>
								<div className={b('avatar-slot')}>
									{!isMine &&
										isGroupStart &&
										// The support side speaks as the team, so it gets the team mark
										// rather than the personal avatar behind the account.
										(isSupportSide ? (
											<span className={b('support-avatar')} title={t('support.admin_label')}>
												<Lifebuoy weight="fill" />
											</span>
										) : (
											message.sender && <Avatar user={message.sender} tiny noLink hideBadges />
										))}
								</div>
								<div className={b('bubble-group')}>
									{isGroupStart && <div className={b('bubble-author')}>{authorName}</div>}
									<div className={b('bubble', {mine: isMine, tail: isGroupEnd})}>
										{hasBody && <div className={b('bubble-text')}>{message.body}</div>}
										{attachments.length > 0 && <SupportAttachments attachments={attachments} />}
										<div className={b('bubble-time')}>{getTimeOfDay(message.created_at)}</div>
									</div>
								</div>
							</div>
						</React.Fragment>
					);
				})}
			</div>

			<div className={b('reply')}>
				{!isResolved && (
					<div className={b('admin-actions')}>
						{/* Closing your own ticket is a normal user action, not an admin one,
						    so it does not carry the warning styling on that side. */}
						<Button
							warning={isAdminView}
							gray={!isAdminView}
							small
							text={isAdminView ? t('admin_reports.ticket_resolve') : t('support.mark_solved')}
							loading={resolving}
							onClick={handleResolve}
						/>
					</div>
				)}

				{isResolved ? (
					<div className={b('closed-actions')}>
						<div className={b('closed-note')}>{t('support.closed_cant_reply')}</div>
						<Button
							small
							primary
							text={t('support.reopen')}
							loading={reopening}
							onClick={handleReopen}
						/>
					</div>
				) : (
					<>
						{pending.length > 0 && (
							<div className={b('preview-grid')}>
								{pending.map((p) => (
									<div key={p.id} className={b('preview-item')}>
										{p.kind === 'image' ? (
											<img className={b('preview-media')} src={p.previewUrl} alt={p.file.name} />
										) : (
											<video className={b('preview-media')} src={p.previewUrl} muted />
										)}
										<button
											type="button"
											className={b('preview-remove')}
											onClick={() => removePending(p.id)}
											aria-label={t('support.remove_attachment')}
										>
											<X weight="bold" />
										</button>
									</div>
								))}
							</div>
						)}

						<div className={b('composer')}>
							{showAttachUI && (
								<>
									<input
										ref={fileInputRef}
										type="file"
										className={b('file-input')}
										accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')}
										onChange={(e) => handleFilesSelected(e.target.files)}
									/>
									<button
										type="button"
										className={b('icon-button')}
										onClick={openFilePicker}
										disabled={sending || pending.length >= MAX_FILES}
										aria-label={t('support.attach_file')}
										title={t('support.attach_file')}
									>
										<Paperclip weight="bold" />
									</button>
								</>
							)}

							<textarea
								ref={textareaRef}
								className={b('composer-input')}
								value={reply}
								onChange={(e) => {
									setReply(e.target.value);
									autoGrowTextarea();
								}}
								onKeyDown={handleTextareaKeyDown}
								placeholder={t('support.reply_placeholder')}
								rows={1}
								maxLength={5000}
							/>

							<button
								type="button"
								className={b('icon-button', {send: true})}
								onClick={handleSend}
								disabled={!canSend}
								aria-label={t('support.send_reply')}
								title={t('support.send_reply')}
							>
								<PaperPlaneRight weight="fill" />
							</button>
						</div>

						{sending && <div className={b('sending-note')}>{t('support.sending')}</div>}
					</>
				)}
			</div>
		</div>
	);
}
