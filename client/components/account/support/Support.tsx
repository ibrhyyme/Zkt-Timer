import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {gql, useMutation, useQuery} from '@apollo/client';
import Input from '../../common/inputs/input/Input';
import Button from '../../common/button/Button';
import Tag from '../../common/tag/Tag';
import {toastError, toastSuccess} from '../../../util/toast';
import {getDateFromNow} from '../../../util/dates';
import {SupportTicket} from '../../../@types/generated/graphql';
import {openModal} from '../../../actions/general';
import SupportTicketModal from './SupportTicketModal';
import block from '../../../styles/bem';
import './Support.scss';

const b = block('support');

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

	const [createTicket, {loading}] = useMutation(CREATE_SUPPORT_TICKET);
	const {data: historyData, refetch} = useQuery<{mySupportTickets: SupportTicket[]}>(MY_SUPPORT_TICKETS, {
		fetchPolicy: 'network-only',
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
			toastError(e?.message || t('support.error'));
		}
	}

	function openTicket(ticketId: string) {
		dispatch(openModal(<SupportTicketModal ticketId={ticketId} onUpdate={() => refetch()} />, {width: 720}));
	}

	const canSubmit = subject.trim().length > 0 && message.trim().length > 0 && !loading;

	return (
		<div className={b()}>
			<h2 className={b('title')}>{t('support.title')}</h2>
			<p className={b('description')}>{t('support.description')}</p>

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
			</div>

			<Button
				text={loading ? t('support.sending') : t('support.send')}
				primary
				glow
				disabled={!canSubmit}
				onClick={handleSubmit}
			/>

			<div className={b('history')}>
				<h3 className={b('history-title')}>{t('support.history_title')}</h3>
				{tickets.length === 0 ? (
					<div className={b('history-empty')}>{t('support.no_history')}</div>
				) : (
					<div className={b('history-list')}>
						{tickets.map((ticket) => {
							const lastMessage = ticket.messages?.[ticket.messages.length - 1];
							const lastTime = lastMessage?.created_at || ticket.created_at;
							const isResolved = !!ticket.resolved_at;
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
									<Tag
										small
										backgroundColor={isResolved ? 'green' : 'orange'}
										text={isResolved ? t('support.status_resolved') : t('support.status_open')}
									/>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
