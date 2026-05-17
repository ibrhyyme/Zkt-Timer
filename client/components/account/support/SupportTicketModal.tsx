import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {gql, useMutation, useQuery} from '@apollo/client';
import {Paperclip, X} from 'phosphor-react';
import Avatar from '../../common/avatar/Avatar';
import Tag from '../../common/tag/Tag';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import {toastError} from '../../../util/toast';
import {getDateFromNow} from '../../../util/dates';
import {SupportTicket as SupportTicketSchema} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import block from '../../../styles/bem';
import SupportAttachments, {AttachmentLike} from './SupportAttachments';
import './SupportTicketModal.scss';

const b = block('support-ticket-modal');

const MAX_FILES = 1;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const SUPPORT_TICKET_DETAIL = gql`
	query Query($id: String!) {
		supportTicket(id: $id) {
			id
			created_at
			subject
			message
			resolved_at
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

const ADD_MESSAGE = gql`
	mutation Mutate($ticketId: String!, $body: String!, $attachments: [Upload!]) {
		addSupportTicketMessage(ticketId: $ticketId, body: $body, attachments: $attachments) {
			id
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

interface Props {
	ticketId: string;
	isAdminView?: boolean;
	onUpdate?: () => void;
}

type TimelineMessage = {
	id: string;
	body: string;
	created_at: any;
	sender?: {id?: string | null; username?: string | null; profile?: any} | null;
	attachments?: AttachmentLike[] | null;
};

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
	const [reply, setReply] = useState('');
	const [pending, setPending] = useState<PendingFile[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		return () => {
			pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const {data, loading, refetch} = useQuery<{supportTicket: SupportTicketSchema}>(SUPPORT_TICKET_DETAIL, {
		variables: {id: ticketId},
		fetchPolicy: 'cache-and-network',
	});

	const [addMessage, {loading: sending}] = useMutation(ADD_MESSAGE, {
		// apollo-upload-client v15 multipart isteklerinde CSRF preflight header'ini otomatik eklemiyor;
		// CSRF middleware (server/middlewares/csrf.ts) bu header'i bekliyor — el ile veriyoruz.
		context: {
			headers: {
				'apollo-require-preflight': 'true',
			},
		},
	});
	const [resolveTicket, {loading: resolving}] = useMutation(RESOLVE_TICKET);

	const ticket = data?.supportTicket;
	const isResolved = !!ticket?.resolved_at;

	const allMessages = useMemo<TimelineMessage[]>(() => {
		if (!ticket) return [];
		return [
			{
				id: 'initial',
				body: ticket.message,
				created_at: ticket.created_at,
				sender: ticket.created_by,
				attachments: null,
			},
			...((ticket.messages || []) as TimelineMessage[]),
		];
	}, [ticket?.id, ticket?.message, ticket?.created_at, ticket?.created_by, ticket?.messages]);

	function clearPending() {
		pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
		setPending([]);
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

		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
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
			await refetch();
			onUpdate?.();
		} catch (e: any) {
			toastError(e?.message || t('support.error'));
		}
	}

	async function handleResolve() {
		try {
			await resolveTicket({variables: {id: ticketId}});
			await refetch();
			onUpdate?.();
		} catch (e: any) {
			toastError(e?.message || t('support.error'));
		}
	}

	if (loading || !ticket) {
		return (
			<div className={b({loading: true})}>
				<Loading />
			</div>
		);
	}

	const canSend = (reply.trim().length > 0 || pending.length > 0) && !sending && !isResolved;
	const showAttachUI = isAdminView && !isResolved;

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

			<div className={b('timeline')} role="log" aria-live="polite">
				{allMessages.map((msg) => {
					const isMine = msg.sender?.id === me?.id;
					const username = msg.sender?.username || '';
					const displayName = isMine ? `${username} (${t('support.you')})` : username;
					const attachments = (msg.attachments || []) as AttachmentLike[];
					const hasBody = !!msg.body && msg.body.trim().length > 0;
					return (
						<div key={msg.id} className={b('row', {mine: isMine})}>
							{!isMine && msg.sender && (
								<div className={b('avatar')}>
									<Avatar user={msg.sender} tiny noLink hideBadges />
								</div>
							)}
							<div className={b('bubble-group')}>
								<div className={b('bubble-meta')}>
									<span className={b('bubble-author')}>{displayName}</span>
									<span className={b('bubble-time')}>{getDateFromNow(msg.created_at)}</span>
								</div>
								{hasBody && <div className={b('bubble', {mine: isMine})}>{msg.body}</div>}
								{attachments.length > 0 && <SupportAttachments attachments={attachments} />}
							</div>
						</div>
					);
				})}
			</div>

			<div className={b('reply')}>
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

				<textarea
					className={b('reply-input')}
					value={isResolved ? '' : reply}
					onChange={(e) => setReply(e.target.value)}
					placeholder={isResolved ? t('support.closed_cant_reply') : t('support.reply_placeholder')}
					rows={3}
					maxLength={5000}
					disabled={isResolved}
				/>
				<div className={b('reply-actions')}>
					{showAttachUI && (
						<>
							<input
								ref={fileInputRef}
								type="file"
								className={b('file-input')}
								accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')}
								multiple
								onChange={(e) => handleFilesSelected(e.target.files)}
							/>
							<button
								type="button"
								className={b('file-picker')}
								onClick={() => fileInputRef.current?.click()}
								disabled={sending || pending.length >= MAX_FILES}
								aria-label={t('support.attach_file')}
								title={t('support.attach_file')}
							>
								<Paperclip weight="bold" />
							</button>
						</>
					)}
					{isAdminView && !isResolved && (
						<Button
							warning
							text={t('admin_reports.ticket_resolve')}
							loading={resolving}
							onClick={handleResolve}
						/>
					)}
					{!isResolved && (
						<Button
							text={sending ? t('support.sending') : t('support.send_reply')}
							primary
							glow
							disabled={!canSend}
							onClick={handleSend}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
