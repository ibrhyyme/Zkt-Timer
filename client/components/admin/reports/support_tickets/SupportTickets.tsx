import React from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {gql, useQuery} from '@apollo/client';
import block from '../../../../styles/bem';
import Avatar from '../../../common/avatar/Avatar';
import Tag from '../../../common/tag/Tag';
import Loading from '../../../common/loading/Loading';
import Empty from '../../../common/empty/Empty';
import {getDateFromNow} from '../../../../util/dates';
import {SupportTicket} from '../../../../@types/generated/graphql';
import {openModal} from '../../../../actions/general';
import SupportTicketModal from '../../../account/support/SupportTicketModal';
import './SupportTickets.scss';

const b = block('admin-support-tickets');

const SUPPORT_TICKETS_QUERY = gql`
	query Query($resolved: Boolean) {
		supportTickets(resolved: $resolved) {
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
			}
		}
	}
`;

export default function SupportTickets() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const {data, loading, refetch} = useQuery<{supportTickets: SupportTicket[]}>(SUPPORT_TICKETS_QUERY, {
		variables: {resolved: false},
		fetchPolicy: 'no-cache',
	});

	function openTicket(ticketId: string) {
		dispatch(openModal(<SupportTicketModal ticketId={ticketId} isAdminView onUpdate={() => refetch()} />, {width: 720}));
	}

	if (loading) {
		return <div className={b({loading: true})}><Loading /></div>;
	}

	if (!data?.supportTickets || data.supportTickets.length === 0) {
		return <div className={b({empty: true})}><Empty text={t('admin_reports.no_tickets')} /></div>;
	}

	return (
		<div className={b()}>
			{data.supportTickets.map((ticket) => {
				const messageCount = (ticket.messages?.length || 0) + 1; // +1 ilk konu mesaji
				const lastMessage = ticket.messages?.[ticket.messages.length - 1];
				const waitingReply = !lastMessage || !lastMessage.is_admin;
				const lastTime = lastMessage?.created_at || ticket.created_at;
				return (
					<div
						key={ticket.id}
						className={b('ticket')}
						onClick={() => openTicket(ticket.id)}
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								openTicket(ticket.id);
							}
						}}
					>
						<div className={b('top')}>
							<div className={b('user')}>
								<Avatar user={ticket.created_by} />
							</div>
							<div className={b('meta')}>
								<Tag small text={getDateFromNow(lastTime)} />
								<Tag
									small
									text={t('admin_reports.ticket_message_count', {count: messageCount})}
								/>
								{waitingReply ? (
									<Tag small backgroundColor="orange" text={t('admin_reports.ticket_awaiting_reply')} />
								) : null}
							</div>
						</div>
						<h3 className={b('subject')}>{ticket.subject}</h3>
						<p className={b('preview')}>{ticket.message}</p>
					</div>
				);
			})}
		</div>
	);
}
