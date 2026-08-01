import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {useAppVisible} from '../../../../util/hooks/useAppVisible';
import SupportTicketModal from '../../../account/support/SupportTicketModal';
import './SupportTickets.scss';

const b = block('admin-support-tickets');

// Keep the queue fresh without a page reload; pauses while the tab is hidden.
const POLL_INTERVAL_MS = 15000;

type Filter = 'open' | 'resolved' | 'all';

// null means "no filter" on the server side, which returns both states.
const RESOLVED_BY_FILTER: Record<Filter, boolean | null> = {
	open: false,
	resolved: true,
	all: null,
};

const SUPPORT_TICKETS_QUERY = gql`
	query Query($resolved: Boolean) {
		supportTickets(resolved: $resolved) {
			id
			created_at
			subject
			message
			resolved_at
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
			}
		}
	}
`;

export default function SupportTickets() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const appVisible = useAppVisible();
	const [filter, setFilter] = useState<Filter>('open');

	const {data, loading, refetch} = useQuery<{supportTickets: SupportTicket[]}>(SUPPORT_TICKETS_QUERY, {
		variables: {resolved: RESOLVED_BY_FILTER[filter]},
		fetchPolicy: 'no-cache',
		pollInterval: appVisible ? POLL_INTERVAL_MS : 0,
	});

	const openTicket = useCallback(
		(ticketId: string) => {
			dispatch(
				openModal(<SupportTicketModal ticketId={ticketId} isAdminView onUpdate={() => refetch()} />, {
					width: 720,
					closeButtonText: t('solve_info.done'),
				})
			);
		},
		[dispatch, refetch, t]
	);

	// Admin notifications link to ?tab=support&ticket=<id> — open that conversation
	// directly. The queue may be filtered to "open" while the target is resolved, so the
	// id is used as-is rather than looked up in the current list.
	const deepLinkHandledRef = useRef(false);
	useEffect(() => {
		if (deepLinkHandledRef.current) return;
		if (typeof window === 'undefined') return;

		const requestedId = new URLSearchParams(window.location.search).get('ticket');
		if (!requestedId) return;

		deepLinkHandledRef.current = true;
		openTicket(requestedId);

		const url = new URL(window.location.href);
		url.searchParams.delete('ticket');
		window.history.replaceState({}, '', url.toString());
	}, [openTicket]);

	const FILTERS: {id: Filter; label: string}[] = [
		{id: 'open', label: t('admin_reports.ticket_filter_open')},
		{id: 'resolved', label: t('admin_reports.ticket_filter_resolved')},
		{id: 'all', label: t('admin_reports.ticket_filter_all')},
	];

	const emptyText =
		filter === 'resolved'
			? t('admin_reports.no_tickets_resolved')
			: filter === 'all'
			? t('admin_reports.no_tickets_all')
			: t('admin_reports.no_tickets');

	const tickets = data?.supportTickets || [];

	return (
		<div className={b()}>
			<div className={b('filters')}>
				{FILTERS.map((f) => (
					<button
						key={f.id}
						type="button"
						className={b('filter', {active: filter === f.id})}
						onClick={() => setFilter(f.id)}
					>
						{f.label}
					</button>
				))}
			</div>

			{loading && tickets.length === 0 ? (
				<div className={b('state')}>
					<Loading />
				</div>
			) : tickets.length === 0 ? (
				<div className={b('state')}>
					<Empty text={emptyText} />
				</div>
			) : (
				<div className={b('list')}>
					{tickets.map((ticket) => {
						const messageCount = (ticket.messages?.length || 0) + 1; // +1 for the opening message
						const lastMessage = ticket.messages?.[ticket.messages.length - 1];
						const isResolved = !!ticket.resolved_at;
						const waitingReply = !isResolved && (!lastMessage || !lastMessage.is_admin);
						const lastTime = lastMessage?.created_at || ticket.created_at;
						// Unread = the user side wrote something after this ticket was last
						// opened by an admin.
						const lastUserActivity = lastMessage && !lastMessage.is_admin ? lastMessage.created_at : ticket.created_at;
						const isUnread =
							(!lastMessage || !lastMessage.is_admin) &&
							(!ticket.admin_read_at ||
								new Date(lastUserActivity).getTime() > new Date(ticket.admin_read_at).getTime());
						return (
							<div
								key={ticket.id}
								className={b('ticket', {resolved: isResolved, unread: isUnread})}
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
										{isUnread ? (
											<Tag small backgroundColor="blue" text={t('admin_reports.ticket_unread')} />
										) : null}
										{isResolved ? (
											<Tag small backgroundColor="green" text={t('support.status_resolved')} />
										) : null}
										{waitingReply ? (
											<Tag
												small
												backgroundColor="orange"
												text={t('admin_reports.ticket_awaiting_reply')}
											/>
										) : null}
									</div>
								</div>
								<h3 className={b('subject')}>{ticket.subject}</h3>
								<p className={b('preview')}>{ticket.message}</p>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
