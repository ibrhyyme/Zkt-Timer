import React, {useState, useEffect} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {IModalProps} from '../../../common/modal/Modal';
import {b, getEventName} from '../shared';
import {UserPlus} from 'phosphor-react';

const USER_SEARCH = gql`
	query ZktUserSearch($pageArgs: PaginationArgsInput) {
		userSearch(pageArgs: $pageArgs) {
			items {
				id
				username
				profile {
					pfp_image {
						id
						url
					}
				}
			}
		}
	}
`;

const ADD_COMPETITOR = gql`
	mutation AddZktCompetitor($input: AddZktCompetitorManuallyInput!) {
		addZktCompetitorManually(input: $input) {
			id
		}
	}
`;

interface Props extends IModalProps {
	competitionId: string;
	compEvents: Array<{id: string; event_id: string}>;
}

export default function AddCompetitorModal(props: Props) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [search, setSearch] = useState('');
	const [users, setUsers] = useState<any[]>([]);
	const [selectedUser, setSelectedUser] = useState<any>(null);
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (search.length < 2) {
			setUsers([]);
			return;
		}
		const handle = setTimeout(async () => {
			try {
				const res = await gqlMutate(USER_SEARCH, {
					pageArgs: {page: 0, pageSize: 10, searchQuery: search},
				});
				setUsers(res?.data?.userSearch?.items || []);
			} catch {
				// ignore
			}
		}, 300);
		return () => clearTimeout(handle);
	}, [search]);

	function toggleEvent(compEventId: string) {
		const next = new Set(selectedEvents);
		if (next.has(compEventId)) next.delete(compEventId);
		else next.add(compEventId);
		setSelectedEvents(next);
	}

	async function handleAdd() {
		if (!selectedUser) return;
		if (selectedEvents.size === 0) {
			toastError(t('select_at_least_one_event'));
			return;
		}
		setSubmitting(true);
		try {
			await gqlMutate(ADD_COMPETITOR, {
				input: {
					competitionId: props.competitionId,
					userId: selectedUser.id,
					eventIds: Array.from(selectedEvents),
				},
			});
			toastSuccess(t('added'));
			if (props.onComplete) props.onComplete();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className={b('add-competitor-modal')}>
			<div className={b('modal-header')}>
				<div className={b('modal-icon')}>
					<UserPlus weight="fill" />
				</div>
				<h2 className={b('modal-title')}>{t('add_competitor')}</h2>
			</div>

			<div className={b('form')}>
				{!selectedUser ? (
					<>
						<div className={b('field')}>
							<label className={b('label')}>{t('search_user')}</label>
							<input
								className={b('input')}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder={t('search_user_placeholder')}
								autoFocus
							/>
						</div>
						{users.length > 0 && (
							<div className={b('user-list')}>
								{users.map((u) => (
									<button
										key={u.id}
										type="button"
										className={b('user-row')}
										onClick={() => setSelectedUser(u)}
									>
										{u.profile?.pfp_image?.url && (
											<img
												className={b('user-avatar')}
												src={u.profile.pfp_image.url}
												alt=""
											/>
										)}
										<span className={b('user-name')}>{u.username}</span>
									</button>
								))}
							</div>
						)}
					</>
				) : (
					<>
						<div className={b('selected-user')}>
							{selectedUser.profile?.pfp_image?.url && (
								<img
									className={b('user-avatar')}
									src={selectedUser.profile.pfp_image.url}
									alt=""
								/>
							)}
							<span className={b('user-name')}>{selectedUser.username}</span>
							<button className={b('change-user')} onClick={() => setSelectedUser(null)}>
								{t('change')}
							</button>
						</div>

						<div className={b('field')}>
							<label className={b('label')}>{t('select_events')}</label>
							<div className={b('event-grid')}>
								{props.compEvents.map((ev) => (
									<button
										key={ev.id}
										type="button"
										className={b('event-option', {selected: selectedEvents.has(ev.id)})}
										onClick={() => toggleEvent(ev.id)}
									>
										<span className={`cubing-icon event-${ev.event_id}`} />
										<span>{getEventName(ev.event_id)}</span>
									</button>
								))}
							</div>
						</div>
					</>
				)}
			</div>

			<button
				type="button"
				className={b('cta')}
				onClick={handleAdd}
				disabled={submitting || !selectedUser || selectedEvents.size === 0}
			>
				{submitting ? t('adding') : t('add')}
			</button>
		</div>
	);
}
