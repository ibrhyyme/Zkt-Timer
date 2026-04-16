import React, {useState, useEffect} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b} from '../shared';
import {UserPlus, X} from 'phosphor-react';

const USER_SEARCH = gql`
	query ZktDelegateUserSearch($pageArgs: PaginationArgsInput) {
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

const ADD_DELEGATE = gql`
	mutation AddZktDelegate($input: AddZktDelegateInput!) {
		addZktDelegate(input: $input) {
			id
		}
	}
`;

const REMOVE_DELEGATE = gql`
	mutation RemoveZktDelegate($competitionId: String!, $userId: String!) {
		removeZktDelegate(competitionId: $competitionId, userId: $userId)
	}
`;

export default function DashboardDelegates({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [search, setSearch] = useState('');
	const [users, setUsers] = useState<any[]>([]);

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
				const delegateIds = new Set(detail.delegates.map((d: any) => d.user_id));
				const filtered = (res?.data?.userSearch?.items || []).filter(
					(u: any) => !delegateIds.has(u.id)
				);
				setUsers(filtered);
			} catch {
				// ignore
			}
		}, 300);
		return () => clearTimeout(handle);
	}, [search, detail.delegates]);

	async function addDelegate(userId: string) {
		try {
			await gqlMutate(ADD_DELEGATE, {
				input: {competitionId: detail.id, userId},
			});
			toastSuccess(t('delegate_added'));
			setSearch('');
			setUsers([]);
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function removeDelegate(userId: string) {
		try {
			await gqlMutate(REMOVE_DELEGATE, {
				competitionId: detail.id,
				userId,
			});
			toastSuccess(t('delegate_removed'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	return (
		<div className={b('delegates-tab')}>
			<div className={b('section-title')}>{t('add_delegate')}</div>
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
						<button key={u.id} type="button" className={b('user-row')} onClick={() => addDelegate(u.id)}>
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
				{t('current_delegates')}
			</div>
			{detail.delegates.length === 0 ? (
				<div className={b('empty')}>{t('no_delegates')}</div>
			) : (
				<div className={b('delegate-list')}>
					{detail.delegates.map((d: any) => (
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
								onClick={() => removeDelegate(d.user_id)}
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
