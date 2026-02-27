import React from 'react';
import './AdminUsers.scss';
import { gqlQueryTyped } from '../../api';
import { PaginationArgsInput } from '../../../../server/schemas/Pagination.schema';
import Input from '../../common/inputs/input/Input';
import { useInput } from '../../../util/hooks/useInput';
import { gql } from '@apollo/client';
import dayjs from 'dayjs';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/tr';
import { useDispatch } from 'react-redux';
import { openModal } from '../../../actions/general';
import ManageUser from '../manage_user/ManageUser';
import { useTranslation } from 'react-i18next';

dayjs.extend(relativeTime);
dayjs.locale('tr');

interface UserAccountData {
	id: string;
	username: string;
	email: string;
	verified: boolean;
	created_at: string;
	last_solve_at?: string;
	join_country?: string;
	join_ip?: string;
	banned_forever: boolean;
	banned_until?: string;
	is_pro: boolean;
	admin: boolean;
	mod: boolean;
	profile?: {
		pfp_image?: {
			storage_path?: string;
		};
	};
}

const ADMIN_USER_SEARCH_QUERY = gql`
	query AdminUserSearch($pageArgs: PaginationArgsInput) {
		adminUserSearch(pageArgs: $pageArgs) {
			hasMore
			total
			items {
				id
				username
				email
				verified
				created_at
				last_solve_at
				join_country
				join_ip
				banned_forever
				is_pro
				banned_until
				admin
				mod
				profile {
					pfp_image {
						storage_path
					}
				}
			}
		}
	}
`;

function UserTableRow({ user }: { user: UserAccountData }) {
	const dispatch = useDispatch();
	const { t } = useTranslation();

	const badges = [];
	if (user.admin) badges.push({ label: 'Admin', color: 'red' });
	if (user.mod) badges.push({ label: 'Mod', color: 'orange' });
	if (user.is_pro) badges.push({ label: 'Pro', color: 'purple' });
	if (user.verified) badges.push({ label: t('admin_users.verified'), color: 'green' });
	if (user.banned_forever || user.banned_until) badges.push({ label: t('admin_users.banned'), color: 'gray' });

	const handleManage = () => {
		dispatch(openModal(<ManageUser userId={user.id} />));
	};

	return (
		<tr className="cd-admin-users__row">
			<td className="cd-admin-users__cell cd-admin-users__cell--user">
				<div className="cd-admin-users__user-info">
					<div className="cd-admin-users__avatar-wrapper">
						<AvatarImage user={user} profile={user.profile} />
					</div>
					<div className="cd-admin-users__user-details">
						<div className="cd-admin-users__username">{user.username}</div>
						<div className="cd-admin-users__email">{user.email}</div>
					</div>
				</div>
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--date">
				<div className="cd-admin-users__date-main">
					{dayjs(user.created_at).format('DD MMM YYYY')}
				</div>
				<div className="cd-admin-users__date-sub">
					{dayjs(user.created_at).fromNow()}
				</div>
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--date">
				{user.last_solve_at ? (
					<>
						<div className="cd-admin-users__date-main">
							{dayjs(user.last_solve_at).format('DD MMM YYYY')}
						</div>
						<div className="cd-admin-users__date-sub">
							{dayjs(user.last_solve_at).fromNow()}
						</div>
					</>
				) : (
					<span className="cd-admin-users__no-data">{t('admin_users.never_solved')}</span>
				)}
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--country">
				{user.join_country || '-'}
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--ip">
				{user.join_ip || '-'}
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--badges">
				<div className="cd-admin-users__badges">
					{badges.map((badge) => (
						<span
							key={badge.label}
							className={`cd-admin-users__badge cd-admin-users__badge--${badge.color}`}
						>
							{badge.label}
						</span>
					))}
				</div>
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--actions">
				<button className="cd-admin-users__manage-btn" onClick={handleManage}>
					{t('admin_users.manage')}
				</button>
			</td>
		</tr>
	);
}

export default function AdminUsers() {
	const { t } = useTranslation();
	const [query, setQuery] = useInput('');
	const [users, setUsers] = React.useState<UserAccountData[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [page, setPage] = React.useState(0);
	const [hasMore, setHasMore] = React.useState(true);
	const [total, setTotal] = React.useState(0);

	async function fetchData(currentPage: number) {
		setLoading(true);
		try {
			const res = await gqlQueryTyped(
				ADMIN_USER_SEARCH_QUERY,
				{
					pageArgs: {
						page: currentPage,
						searchQuery: query,
						pageSize: 50,
					},
				},
				{
					fetchPolicy: 'network-only',
				}
			);

			if (!res.data.adminUserSearch) {
				console.error('AdminUserSearch returned null response');
				return;
			}

			setUsers(res.data.adminUserSearch.items);
			setHasMore(res.data.adminUserSearch.hasMore);
			setTotal(res.data.adminUserSearch.total);
		} catch (error) {
			console.error('Error fetching admin users:', error);
		} finally {
			setLoading(false);
		}
	}

	React.useEffect(() => {
		setPage(0);
		fetchData(0);
	}, [query]);

	const handlePrevPage = () => {
		if (page > 0) {
			const newPage = page - 1;
			setPage(newPage);
			fetchData(newPage);
		}
	};

	const handleNextPage = () => {
		if (hasMore) {
			const newPage = page + 1;
			setPage(newPage);
			fetchData(newPage);
		}
	};

	return (
		<div className="cd-admin-users">
			<div className="cd-admin-users__container">
				<div className="cd-admin-users__header">
					<h1 className="cd-admin-users__title">{t('admin_users.page_title')}</h1>
					<div className="cd-admin-users__search">
						<Input
							value={query}
							onChange={setQuery}
							placeholder={t('admin_users.search_placeholder')}
						/>
					</div>
					<div className="cd-admin-users__stats">
						{t('admin_users.total_users', { count: total })}
					</div>
				</div>

				{loading ? (
					<div className="cd-admin-users__loading">{t('admin_users.loading')}</div>
				) : (
					<>
						<div className="cd-admin-users__table-wrapper">
							<table className="cd-admin-users__table">
								<thead>
									<tr className="cd-admin-users__header-row">
										<th className="cd-admin-users__header-cell">{t('admin_users.user')}</th>
										<th className="cd-admin-users__header-cell">{t('admin_users.register_date')}</th>
										<th className="cd-admin-users__header-cell">{t('admin_users.last_solve')}</th>
										<th className="cd-admin-users__header-cell">{t('admin_users.country')}</th>
										<th className="cd-admin-users__header-cell">IP</th>
										<th className="cd-admin-users__header-cell">{t('admin_users.status')}</th>
										<th className="cd-admin-users__header-cell">{t('admin_users.actions')}</th>
									</tr>
								</thead>
								<tbody>
									{users.map((user) => (
										<UserTableRow key={user.id} user={user} />
									))}
								</tbody>
							</table>
						</div>

						{users.length === 0 && !loading && (
							<div className="cd-admin-users__empty">{t('admin_users.no_users_found')}</div>
						)}

						<div className="cd-admin-users__pagination">
							<button
								onClick={handlePrevPage}
								disabled={page === 0}
								className="cd-admin-users__pagination-btn"
							>
								{t('admin_users.previous')}
							</button>
							<span className="cd-admin-users__pagination-info">
								{t('admin_users.page', { page: page + 1 })}
							</span>
							<button
								onClick={handleNextPage}
								disabled={!hasMore}
								className="cd-admin-users__pagination-btn"
							>
								{t('admin_users.next')}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
