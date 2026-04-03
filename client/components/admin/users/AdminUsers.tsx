import React from 'react';
import './AdminUsers.scss';
import {gqlQueryTyped} from '../../api';
import Input from '../../common/inputs/input/Input';
import {useInput} from '../../../util/hooks/useInput';
import {gql} from '@apollo/client';
import dayjs from 'dayjs';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/tr';
import {useDispatch} from 'react-redux';
import {openModal} from '../../../actions/general';
import ManageUser from '../manage_user/ManageUser';
import {useTranslation} from 'react-i18next';
import SendFilteredEmailModal from './SendFilteredEmailModal';
import {EnvelopeSimple} from 'phosphor-react';

dayjs.extend(relativeTime);
dayjs.locale('tr');

interface UserAccountData {
	id: string;
	username: string;
	email: string;
	verified: boolean;
	email_verified: boolean;
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
	pushTokens?: {
		platform: string;
	}[];
}

const ADMIN_USER_SEARCH_QUERY = gql`
	query AdminUserSearch($pageArgs: PaginationArgsInput, $filters: AdminUserFiltersInput) {
		adminUserSearch(pageArgs: $pageArgs, filters: $filters) {
			hasMore
			total
			items {
				id
				username
				email
				verified
				email_verified
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
				pushTokens {
					platform
				}
			}
		}
	}
`;

function UserTableRow({user}: {user: UserAccountData}) {
	const dispatch = useDispatch();
	const {t} = useTranslation();

	const badges = [];
	if (user.admin) badges.push({label: 'Admin', color: 'red'});
	if (user.mod) badges.push({label: 'Mod', color: 'orange'});
	if (user.is_pro) badges.push({label: 'Pro', color: 'purple'});
	if (user.email_verified) badges.push({label: t('admin_users.verified'), color: 'green'});
	if (user.verified) badges.push({label: t('admin_users.approved'), color: 'blue'});
	if (user.banned_forever || user.banned_until) badges.push({label: t('admin_users.banned'), color: 'gray'});

	const platforms = user.pushTokens ? [...new Set(user.pushTokens.map((pt) => pt.platform))] : [];
	const platformColors: Record<string, string> = {WEB: 'blue', ANDROID: 'green', IOS: 'gray'};
	platforms.forEach((p) => badges.push({label: p, color: platformColors[p] || 'gray'}));

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
				<div className="cd-admin-users__date-main">{dayjs(user.created_at).format('DD MMM YYYY')}</div>
				<div className="cd-admin-users__date-sub">{dayjs(user.created_at).fromNow()}</div>
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--date">
				{user.last_solve_at ? (
					<>
						<div className="cd-admin-users__date-main">{dayjs(user.last_solve_at).format('DD MMM YYYY')}</div>
						<div className="cd-admin-users__date-sub">{dayjs(user.last_solve_at).fromNow()}</div>
					</>
				) : (
					<span className="cd-admin-users__no-data">{t('admin_users.never_solved')}</span>
				)}
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--country">{user.join_country || '-'}</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--ip">{user.join_ip || '-'}</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--badges">
				<div className="cd-admin-users__badges">
					{badges.map((badge) => (
						<span key={badge.label} className={`cd-admin-users__badge cd-admin-users__badge--${badge.color}`}>
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

const FILTERS = [
	{key: 'ADMIN', label: 'Admin', color: '#ef4444'},
	{key: 'MOD', label: 'Mod', color: '#f97316'},
	{key: 'PRO', label: 'Pro', color: '#a855f7'},
	{key: 'VERIFIED', label: 'Dogrulanmis', color: '#22c55e'},
	{key: 'APPROVED', label: 'Onayli', color: '#3b82f6'},
	{key: 'BANNED', label: 'Banned', color: '#6b7280'},
	{key: 'WEB', label: 'Web', color: '#3b82f6'},
	{key: 'ANDROID', label: 'Android', color: '#22c55e'},
	{key: 'IOS', label: 'iOS', color: '#6b7280'},
];

function buildServerFilters(activeFilters: string[]) {
	if (activeFilters.length === 0) return undefined;

	const filters: any = {};
	const platforms: string[] = [];

	for (const key of activeFilters) {
		switch (key) {
			case 'ADMIN': filters.admin = true; break;
			case 'MOD': filters.mod = true; break;
			case 'PRO': filters.is_pro = true; break;
			case 'VERIFIED': filters.email_verified = true; break;
			case 'APPROVED': filters.verified = true; break;
			case 'BANNED': filters.banned = true; break;
			case 'WEB': platforms.push('WEB'); break;
			case 'ANDROID': platforms.push('ANDROID'); break;
			case 'IOS': platforms.push('IOS'); break;
		}
	}

	if (platforms.length > 0) filters.platforms = platforms;
	return filters;
}

export default function AdminUsers() {
	const {t} = useTranslation();
	const [query, setQuery] = useInput('');
	const [users, setUsers] = React.useState<UserAccountData[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [page, setPage] = React.useState(0);
	const [hasMore, setHasMore] = React.useState(true);
	const [total, setTotal] = React.useState(0);
	const [activeFilters, setActiveFilters] = React.useState<string[]>([]);
	const [showEmailModal, setShowEmailModal] = React.useState(false);

	const filtersRef = React.useRef(activeFilters);
	filtersRef.current = activeFilters;

	async function fetchData(currentPage: number, currentFilters?: string[]) {
		setLoading(true);
		try {
			const filters = buildServerFilters(currentFilters ?? filtersRef.current);
			const res = await gqlQueryTyped(
				ADMIN_USER_SEARCH_QUERY,
				{
					pageArgs: {
						page: currentPage,
						searchQuery: query,
						pageSize: 50,
					},
					filters,
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

	function toggleFilter(key: string) {
		const next = activeFilters.includes(key) ? activeFilters.filter((f) => f !== key) : [...activeFilters, key];
		setActiveFilters(next);
		setPage(0);
		fetchData(0, next);
	}

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
						<Input value={query} onChange={setQuery} placeholder={t('admin_users.search_placeholder')} />
					</div>
					<div className="cd-admin-users__stats">{t('admin_users.total_users', {count: total})}</div>
					<div style={{display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px', alignItems: 'center'}}>
						{FILTERS.map((f) => {
							const active = activeFilters.includes(f.key);
							return (
								<button
									key={f.key}
									type="button"
									onClick={() => toggleFilter(f.key)}
									style={{
										padding: '4px 12px',
										borderRadius: '12px',
										fontSize: '0.75rem',
										fontWeight: 600,
										cursor: 'pointer',
										transition: 'all 0.15s',
										border: 'none',
										backgroundColor: active ? f.color : 'rgba(255,255,255,0.06)',
										color: active ? '#fff' : 'rgba(255,255,255,0.5)',
									}}
								>
									{f.label}
								</button>
							);
						})}
						{activeFilters.length > 0 && users.length > 0 && (
							<button
								onClick={() => setShowEmailModal(true)}
								style={{
									marginLeft: '8px',
									padding: '4px 14px',
									borderRadius: '12px',
									fontSize: '0.75rem',
									fontWeight: 600,
									cursor: 'pointer',
									border: 'none',
									backgroundColor: '#3b82f6',
									color: '#fff',
									display: 'flex',
									alignItems: 'center',
									gap: '4px',
								}}
							>
								<EnvelopeSimple size={14} weight="bold" />
								{t('admin_users.send_email_filtered')} ({total})
							</button>
						)}
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
										<th className="cd-admin-users__header-cell" style={{textAlign: 'right'}}>
										<div style={{display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px'}}>
											<button onClick={handlePrevPage} disabled={page === 0} className="cd-admin-users__pagination-btn">←</button>
											<span style={{fontSize: '0.8rem', opacity: 0.6}}>{page + 1}</span>
											<button onClick={handleNextPage} disabled={!hasMore} className="cd-admin-users__pagination-btn">→</button>
										</div>
									</th>
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
					</>
				)}
			</div>

			{showEmailModal && (
				<SendFilteredEmailModal
					users={users.map((u) => ({id: u.id, username: u.username, email: u.email}))}
					onClose={() => setShowEmailModal(false)}
				/>
			)}
		</div>
	);
}
