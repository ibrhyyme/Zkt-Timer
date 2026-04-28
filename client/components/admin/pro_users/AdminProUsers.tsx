import React from 'react';
import {gqlQueryTyped} from '../../api';
import Input from '../../common/inputs/input/Input';
import {useInput} from '../../../util/hooks/useInput';
import dayjs from 'dayjs';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import relativeTime from 'dayjs/plugin/relativeTime';
import {useDispatch} from 'react-redux';
import {openModal} from '../../../actions/general';
import ManageUser from '../manage_user/ManageUser';
import {gql} from '@apollo/client';

const ADMIN_PRO_USERS_QUERY = gql`
	query AdminProUsers($pageArgs: PaginationArgsInput) {
		adminUserSearch(pageArgs: $pageArgs, filters: { is_pro: true }) {
			hasMore
			total
			items {
				id
				username
				email
				created_at
				is_pro
				pro_expires_at
				iap_platform
				iap_product_id
				iap_cancellation_at
				iap_billing_issue_at
				iap_paused_until
				revenuecat_user_id
				profile {
					pfp_image {
						storage_path
					}
				}
			}
		}
	}
`;

dayjs.extend(relativeTime);

interface ProUserData {
	id: string;
	username: string;
	email: string;
	created_at: string;
	is_pro: boolean;
	pro_expires_at?: string | null;
	iap_platform?: string | null;
	iap_product_id?: string | null;
	iap_cancellation_at?: string | null;
	iap_billing_issue_at?: string | null;
	iap_paused_until?: string | null;
	revenuecat_user_id?: string | null;
	profile?: {pfp_image?: {storage_path?: string}};
}

function subscriptionType(user: ProUserData): {label: string; color: string} {
	const pid = user.iap_product_id;
	if (!pid) return {label: 'Admin / Promo', color: '#a855f7'};
	if (pid.endsWith('lifetime')) return {label: 'Lifetime', color: '#f59e0b'};
	if (pid.endsWith('yearly')) return {label: 'Yearly', color: '#3b82f6'};
	if (pid.endsWith('monthly')) return {label: 'Monthly', color: '#22c55e'};
	return {label: pid, color: '#6b7280'};
}

function subscriptionStatus(user: ProUserData): {label: string; color: string} {
	if (user.iap_paused_until) return {label: 'Paused', color: '#f97316'};
	if (user.iap_billing_issue_at) return {label: 'Billing Issue', color: '#ef4444'};
	if (user.iap_cancellation_at) return {label: 'Cancelled', color: '#6b7280'};
	return {label: 'Active', color: '#22c55e'};
}

function expiryLabel(user: ProUserData): string {
	if (!user.pro_expires_at) return 'Unlimited';
	return dayjs(user.pro_expires_at).format('DD MMM YYYY');
}

function ProUserRow({user}: {user: ProUserData}) {
	const dispatch = useDispatch();
	const type = subscriptionType(user);
	const status = subscriptionStatus(user);

	const handleManage = () => dispatch(openModal(<ManageUser userId={user.id} />, {width: 1100}));

	const [copied, setCopied] = React.useState(false);
	function copyRcId() {
		if (!user.revenuecat_user_id) return;
		navigator.clipboard.writeText(user.revenuecat_user_id);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<tr className="cd-admin-users__row" style={{cursor: 'pointer'}} onClick={handleManage}>
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
			<td className="cd-admin-users__cell">
				<span className="cd-admin-users__badge" style={{background: type.color + '22', color: type.color, border: `1px solid ${type.color}55`}}>
					{type.label}
				</span>
			</td>
			<td className="cd-admin-users__cell">
				{user.iap_platform ? (
					<span className="cd-admin-users__badge" style={{background: '#ffffff11', color: '#ccc', border: '1px solid #ffffff22'}}>
						{user.iap_platform === 'ios' ? 'iOS' : 'Android'}
					</span>
				) : (
					<span style={{color: '#666'}}>—</span>
				)}
			</td>
			<td className="cd-admin-users__cell cd-admin-users__cell--date">
				<div className="cd-admin-users__date-main">{expiryLabel(user)}</div>
				{user.pro_expires_at && (
					<div className="cd-admin-users__date-sub">{dayjs(user.pro_expires_at).fromNow()}</div>
				)}
			</td>
			<td className="cd-admin-users__cell">
				<span className="cd-admin-users__badge" style={{background: status.color + '22', color: status.color, border: `1px solid ${status.color}55`}}>
					{status.label}
				</span>
			</td>
			<td className="cd-admin-users__cell" onClick={(e) => e.stopPropagation()}>
				{user.revenuecat_user_id ? (
					<button
						style={{fontFamily: 'monospace', fontSize: '11px', background: 'transparent', border: '1px solid #444', borderRadius: '4px', color: '#aaa', cursor: 'pointer', padding: '2px 6px'}}
						onClick={copyRcId}
					>
						{copied ? 'Copied' : user.revenuecat_user_id.slice(0, 12) + '...'}
					</button>
				) : (
					<span style={{color: '#666'}}>—</span>
				)}
			</td>
		</tr>
	);
}

const PAGE_SIZE = 50;

export default function AdminProUsers() {
	const [query, setQuery] = useInput('');
	const [users, setUsers] = React.useState<ProUserData[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [page, setPage] = React.useState(0);
	const [hasMore, setHasMore] = React.useState(true);
	const [total, setTotal] = React.useState(0);

	async function fetchData(currentPage: number, currentQuery?: string) {
		setLoading(true);
		try {
			const res = await gqlQueryTyped(ADMIN_PRO_USERS_QUERY, {
				pageArgs: {page: currentPage, searchQuery: currentQuery ?? query, pageSize: PAGE_SIZE},
			}, {fetchPolicy: 'network-only'});

			const data = res.data?.adminUserSearch;
			if (!data) return;
			setUsers(data.items as ProUserData[]);
			setHasMore(data.hasMore);
			setTotal(data.total);
		} catch (err) {
			console.error('[AdminProUsers] fetch error', err);
		} finally {
			setLoading(false);
		}
	}

	React.useEffect(() => {
		setPage(0);
		fetchData(0, query);
	}, [query]);

	function prevPage() {
		if (page === 0) return;
		const next = page - 1;
		setPage(next);
		fetchData(next);
	}

	function nextPage() {
		if (!hasMore) return;
		const next = page + 1;
		setPage(next);
		fetchData(next);
	}

	const startIdx = page * PAGE_SIZE + 1;
	const endIdx = page * PAGE_SIZE + users.length;

	return (
		<div className="cd-admin-users">
			<div className="cd-admin-users__controls">
				<Input value={query} onChange={setQuery} placeholder="Search users..." />
				<span className="cd-admin-users__total">{total} pro users</span>
			</div>

			<div className="cd-admin-users__table-wrapper">
				<table className="cd-admin-users__table">
					<thead>
						<tr>
							<th className="cd-admin-users__th">User</th>
							<th className="cd-admin-users__th">Subscription</th>
							<th className="cd-admin-users__th">Platform</th>
							<th className="cd-admin-users__th">Expires</th>
							<th className="cd-admin-users__th">Status</th>
							<th className="cd-admin-users__th">RevenueCat ID</th>
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr><td colSpan={6} style={{textAlign: 'center', padding: '32px', color: '#666'}}>Loading...</td></tr>
						) : users.length === 0 ? (
							<tr><td colSpan={6} style={{textAlign: 'center', padding: '32px', color: '#666'}}>No pro users found</td></tr>
						) : (
							users.map((u) => <ProUserRow key={u.id} user={u} />)
						)}
					</tbody>
				</table>
			</div>

			<div className="cd-admin-users__pagination">
				<button className="cd-admin-users__page-btn" onClick={prevPage} disabled={page === 0}>← Previous</button>
				<span className="cd-admin-users__page-info">{startIdx}–{endIdx} / {total}</span>
				<button className="cd-admin-users__page-btn" onClick={nextPage} disabled={!hasMore}>Next →</button>
			</div>
		</div>
	);
}
