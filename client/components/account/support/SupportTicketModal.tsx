import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {gql, useMutation, useQuery} from '@apollo/client';
import Avatar from '../../common/avatar/Avatar';
import Tag from '../../common/tag/Tag';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import {toastError} from '../../../util/toast';
import {getDateFromNow} from '../../../util/dates';
import {SupportTicket as SupportTicketSchema} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {closeModal} from '../../../actions/general';
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

export default function SupportTicketModal({ticketId, isAdminView, onUpdate}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const [reply, setReply] = useState('');

	const {data, loading, refetch} = useQuery<{supportTicket: SupportTicketSchema}>(SUPPORT_TICKET_DETAIL, {
		variables: {id: ticketId},
		fetchPolicy: 'network-only',
	});

	const [addMessage, {loading: sending}] = useMutation(ADD_MESSAGE);
	const [resolveTicket, {loading: resolving}] = useMutation(RESOLVE_TICKET);

	const ticket = data?.supportTicket;
	const isResolved = !!ticket?.resolved_at;

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

	// Bubble'lar: ilk konu mesaji (creator) + sonraki messages
	const initialMessage = {
		id: 'initial',
		body: ticket.message,
		is_admin: false,
		created_at: ticket.created_at,
		sender: ticket.created_by,
	};
	const allMessages = [initialMessage, ...(ticket.messages || [])];

	return (
		<div className={b()}>
			<div className={b('header')}>
				<h2 className={b('subject')}>{ticket.subject}</h2>
				<div className={b('header-meta')}>
					<Tag
						small
						backgroundColor={isResolved ? 'green' : 'orange'}
						text={isResolved ? t('support.status_resolved') : t('support.status_open')}
					/>
					{isAdminView && !isResolved && (
						<Button
							small
							secondary
							text={t('admin_reports.ticket_resolve')}
							loading={resolving}
							onClick={handleResolve}
						/>
					)}
				</div>
			</div>

			<div className={b('timeline')}>
				{allMessages.map((msg: any) => {
					const isMine = msg.sender?.id === me?.id;
					const side = msg.is_admin ? 'right' : 'left';
					return (
						<div key={msg.id} className={b('row', {side})}>
							{!isMine && msg.sender && (
								<div className={b('avatar')}>
									<Avatar user={msg.sender} />
								</div>
							)}
							<div className={b('bubble', {admin: msg.is_admin, mine: isMine})}>
								<div className={b('bubble-meta')}>
									<span className={b('bubble-author')}>
										{isMine ? t('support.you') : msg.is_admin ? t('support.admin_label') : msg.sender?.username}
									</span>
									<span className={b('bubble-time')}>{getDateFromNow(msg.created_at)}</span>
								</div>
								<div className={b('bubble-body')}>{msg.body}</div>
							</div>
						</div>
					);
				})}
			</div>

			{isResolved ? (
				<div className={b('closed-notice')}>{t('support.closed_cant_reply')}</div>
			) : (
				<div className={b('reply')}>
					<textarea
						className={b('reply-input')}
						value={reply}
						onChange={(e) => setReply(e.target.value)}
						placeholder={t('support.reply_placeholder')}
						rows={3}
						maxLength={5000}
					/>
					<div className={b('reply-actions')}>
						<Button
							text={sending ? t('support.sending') : t('support.send_reply')}
							primary
							glow
							disabled={!canSend}
							onClick={handleSend}
						/>
					</div>
				</div>
			)}

			<div className={b('footer')}>
				<Button text={t('support.modal_close')} secondary onClick={() => dispatch(closeModal())} />
			</div>
		</div>
	);
}
