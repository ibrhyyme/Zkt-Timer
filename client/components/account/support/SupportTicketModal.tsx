import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {gql, useMutation, useQuery} from '@apollo/client';
import Avatar from '../../common/avatar/Avatar';
import Tag from '../../common/tag/Tag';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import {toastError} from '../../../util/toast';
import {getDateFromNow} from '../../../util/dates';
import {SupportTicket as SupportTicketSchema} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import block from '../../../styles/bem';
import './SupportTicketModal.scss';

const b = block('support-ticket-modal');

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
			}
		}
	}
`;

const ADD_MESSAGE = gql`
	mutation Mutate($ticketId: String!, $body: String!) {
		addSupportTicketMessage(ticketId: $ticketId, body: $body) {
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
};

export default function SupportTicketModal({ticketId, isAdminView, onUpdate}: Props) {
	const {t} = useTranslation();
	const me = useMe();
	const [reply, setReply] = useState('');

	const {data, loading, refetch} = useQuery<{supportTicket: SupportTicketSchema}>(SUPPORT_TICKET_DETAIL, {
		variables: {id: ticketId},
		fetchPolicy: 'cache-and-network',
	});

	const [addMessage, {loading: sending}] = useMutation(ADD_MESSAGE);
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
			},
			...((ticket.messages || []) as TimelineMessage[]),
		];
	}, [ticket?.id, ticket?.message, ticket?.created_at, ticket?.created_by, ticket?.messages]);

	async function handleSend() {
		const trimmed = reply.trim();
		if (!trimmed) return;

		try {
			await addMessage({variables: {ticketId, body: trimmed}});
			setReply('');
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

	const canSend = reply.trim().length > 0 && !sending && !isResolved;

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
								<div className={b('bubble', {mine: isMine})}>{msg.body}</div>
							</div>
						</div>
					);
				})}
			</div>

			<div className={b('reply')}>
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
