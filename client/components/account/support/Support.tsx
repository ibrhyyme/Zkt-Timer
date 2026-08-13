import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {gql, useMutation, useQuery} from '@apollo/client';
import Input from '../../common/inputs/input/Input';
import Button from '../../common/button/Button';
import {Lifebuoy, ClockCounterClockwise} from 'phosphor-react';
import SettingsCard from '../common/settings_card/SettingsCard';
import Tag from '../../common/tag/Tag';
import {toastError, toastSuccess} from '../../../util/toast';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {getDateFromNow} from '../../../util/dates';
import {SupportTicket} from '../../../@types/generated/graphql';
import {openModal} from '../../../actions/general';
import {useAppVisible} from '../../../util/hooks/useAppVisible';
import SupportTicketModal from './SupportTicketModal';
import block from '../../../styles/bem';
import './Support.scss';

const b = block('support');

// Keeps the history list (and its "new reply" marker) current without a page reload.
const POLL_INTERVAL_MS = 20000;

const CREATE_SUPPORT_TICKET = gql`
	mutation CreateSupportTicket($input: SupportTicketInput!) {
		createSupportTicket(input: $input) {
			id
		}
	}
`;

const MY_SUPPORT_TICKETS = gql`
	query Query {
		mySupportTickets {
			id
			created_at
			subject
			message
			resolved_at
			user_read_at
			created_by_id
			messages {
				id
				body
				is_admin
				created_at
			}
		}
	}
`;

export default function Support() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const [subject, setSubject] = useState('');
	const [message, setMessage] = useState('');

	const appVisible = useAppVisible();

	const [createTicket, {loading}] = useMutation(CREATE_SUPPORT_TICKET);
	const {data: historyData, refetch} = useQuery<{mySupportTickets: SupportTicket[]}>(MY_SUPPORT_TICKETS, {
		fetchPolicy: 'network-only',
		pollInterval: appVisible ? POLL_INTERVAL_MS : 0,
	});

	const tickets = historyData?.mySupportTickets || [];

	async function handleSubmit() {
		const trimmedSubject = subject.trim();
		const trimmedMessage = message.trim();
		if (!trimmedSubject || !trimmedMessage) return;

		try {
			await createTicket({
				variables: {input: {subject: trimmedSubject, message: trimmedMessage}},
			});
			toastSuccess(t('support.success'));
			setSubject('');
			setMessage('');
			await refetch();
		} catch (e: any) {
			toastError(getGqlErrorMessage(e, t, 'support.error'));
		}
	}

	const openTicket = useCallback(
		(ticketId: string) => {
			dispatch(
				openModal(<SupportTicketModal ticketId={ticketId} onUpdate={() => refetch()} />, {
					width: 720,
					closeButtonText: t('solve_info.done'),
				})
			);
		},
		[dispatch, refetch, t]
	);

	// The reply notification links to ?ticket=<id>; open that conversation straight away
	// instead of dropping the user on the list to find it themselves.
	const deepLinkHandledRef = useRef(false);
	useEffect(() => {
		if (deepLinkHandledRef.current) return;
		if (typeof window === 'undefined') return;

		const requestedId = new URLSearchParams(window.location.search).get('ticket');
		if (!requestedId) return;
		// Wait for the list so a stale or foreign id never opens an empty modal.
		if (!historyData) return;

		deepLinkHandledRef.current = true;
		if (tickets.some((ticket) => ticket.id === requestedId)) {
			openTicket(requestedId);
		}

		// Drop the param so a refresh (or closing the modal) does not reopen it.
		const url = new URL(window.location.href);
		url.searchParams.delete('ticket');
		window.history.replaceState({}, '', url.toString());
	}, [historyData, tickets, openTicket]);

	const canSubmit = subject.trim().length > 0 && message.trim().length > 0 && !loading;

	return (
		<div className={b()}>
			<SettingsCard
				title={t('support.title')}
				description={t('support.description')}
				icon={<Lifebuoy weight="fill" />}
				footer={
					<Button
						text={loading ? t('support.sending') : t('support.send')}
						primary
						large
						glow
						disabled={!canSubmit}
						onClick={handleSubmit}
					/>
				}
			>
			<div className={b('field')}>
				<label className={b('label')}>{t('support.subject')}</label>
				<Input
					value={subject}
					onChange={(e) => setSubject(e.target.value)}
					placeholder={t('support.subject_placeholder')}
					maxWidth
					maxLength={200}
				/>
			</div>

			<div className={b('field')}>
				<label className={b('label')}>{t('support.message')}</label>
				<textarea
					className={b('textarea')}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder={t('support.message_placeholder')}
					rows={8}
					maxLength={5000}
				/>
				<div className={b('char-count')}>{message.length} / 5000</div>
				<div className={b('hint')}>{t('support.attach_hint')}</div>
			</div>

			</SettingsCard>

			<SettingsCard title={t('support.history_title')} icon={<ClockCounterClockwise weight="bold" />}>
				<div className={b('history')}>
				{tickets.length === 0 ? (
					<div className={b('history-empty')}>{t('support.no_history')}</div>
				) : (
					<div className={b('history-list')}>
						{tickets.map((ticket) => {
							const lastMessage = ticket.messages?.[ticket.messages.length - 1];
							const lastTime = lastMessage?.created_at || ticket.created_at;
							const isResolved = !!ticket.resolved_at;
							// Unread means the support side wrote after the last time this
							// user opened the ticket — not merely "support replied last".
							const hasSupportReply =
								!!lastMessage?.is_admin &&
								(!ticket.user_read_at ||
									new Date(lastMessage.created_at).getTime() >
										new Date(ticket.user_read_at).getTime());
							return (
								<div
									key={ticket.id}
									className={b('history-item')}
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
									<div className={b('history-item-main')}>
										<div className={b('history-item-subject')}>{ticket.subject}</div>
										<div className={b('history-item-time')}>{getDateFromNow(lastTime)}</div>
									</div>
									<div className={b('history-item-tags')}>
										{hasSupportReply && (
											<Tag small backgroundColor="blue" text={t('support.new_reply')} />
										)}
										<Tag
											small
											backgroundColor={isResolved ? 'green' : 'orange'}
											text={isResolved ? t('support.status_resolved') : t('support.status_open')}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
				</div>
			</SettingsCard>
		</div>
	);
}
