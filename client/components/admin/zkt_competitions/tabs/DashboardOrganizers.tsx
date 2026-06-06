import React, {useState, useEffect} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b} from '../shared';
import {UserPlus, X} from 'phosphor-react';

const USER_SEARCH = gql`
	query ZktOrganizerUserSearch($pageArgs: PaginationArgsInput) {
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

const ADD_ORGANIZER = gql`
	mutation AddZktOrganizer($input: AddZktOrganizerInput!) {
		addZktOrganizer(input: $input) {
			id
		}
	}
`;

const REMOVE_ORGANIZER = gql`
	mutation RemoveZktOrganizer($competitionId: String!, $userId: String!) {
		removeZktOrganizer(competitionId: $competitionId, userId: $userId)
	}
`;

export default function DashboardOrganizers({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [search, setSearch] = useState('');
	const [users, setUsers] = useState<any[]>([]);

	const organizers = detail.organizers || [];

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
				const organizerIds = new Set(organizers.map((d: any) => d.user_id));
				const filtered = (res?.data?.userSearch?.items || []).filter(
					(u: any) => !organizerIds.has(u.id)
				);
				setUsers(filtered);
			} catch {
				// ignore
			}
		}, 300);
		return () => clearTimeout(handle);
	}, [search, organizers]);

	async function addOrganizer(userId: string) {
		try {
			await gqlMutate(ADD_ORGANIZER, {
				input: {competitionId: detail.id, userId},
			});
			toastSuccess(t('organizer_added'));
			setSearch('');
			setUsers([]);
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function removeOrganizer(userId: string) {
		try {
			await gqlMutate(REMOVE_ORGANIZER, {
				competitionId: detail.id,
				userId,
			});
			toastSuccess(t('organizer_removed'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	return (
		<div className={b('delegates-tab')}>
			<div className={b('section-title')}>{t('add_organizer')}</div>
			<div className={b('field')}>
				<input
					className={b('input')}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('search_user_placeholder')}
				/>
			</div>
			{users.length > 0 && (
				<div className={b('user-list')}>
					{users.map((u) => (
						<button
							key={u.id}
							type="button"
							className={b('user-row')}
							onClick={() => addOrganizer(u.id)}
						>
							{u.profile?.pfp_image?.url && (
								<img className={b('user-avatar')} src={u.profile.pfp_image.url} alt="" />
							)}
							<span className={b('user-name')}>{u.username}</span>
							<span className={b('add-icon')}>
								<UserPlus weight="bold" />
							</span>
						</button>
					))}
				</div>
			)}

			<div className={b('section-title')} style={{marginTop: 24}}>
				{t('current_organizers')}
			</div>
			{organizers.length === 0 ? (
				<div className={b('empty')}>{t('no_organizers')}</div>
			) : (
				<div className={b('delegate-list')}>
					{organizers.map((d: any) => (
						<div key={d.id} className={b('delegate-row')}>
							{d.user?.profile?.pfp_image?.url && (
								<img
									className={b('user-avatar')}
									src={d.user.profile.pfp_image.url}
									alt=""
								/>
							)}
							<span className={b('user-name')}>{d.user?.username || d.user_id}</span>
							<button
								className={b('action-btn', {danger: true})}
								onClick={() => removeOrganizer(d.user_id)}
							>
								<X weight="bold" />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
