import React from 'react';
import {gql} from '@apollo/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {gqlQuery} from '../../api';
import Input from '../../common/inputs/input/Input';
import Button from '../../common/button/Button';
import ChoiceGroup from '../../common/choice_group/ChoiceGroup';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import {useInput} from '../../../util/hooks/useInput';
import {openModal} from '../../../actions/general';
import ManageUser from '../manage_user/ManageUser';
import {
	DEFAULT_FACETS,
	EXPIRING_DAYS,
	ProFacet,
	ProFacetFilters,
	ProFilters,
	ProRow,
	facetCounts,
	filterRows,
	isExpiringSoon,
	isStoreSource,
	rowPlatform,
	sortRows,
} from './pro_user_filters';
import '../users/AdminUsers.scss';
import './AdminProUsers.scss';

dayjs.extend(relativeTime);

const ADMIN_PRO_USERS_QUERY = gql`
	query AdminProUsers {
		adminProUsers {
			tier
			source
			status
			expires_at
			last_event_at
			promo_code
			user {
				id
				username
				email
				created_at
				iap_platform
				iap_product_id
				revenuecat_user_id
				profile {
					pfp_image {
						id
						storage_path
					}
				}
			}
		}
	}
`;

const PAGE_SIZE = 50;

const SOURCE_VALUES = ['all', 'lifetime', 'yearly', 'monthly', 'promo', 'admin', 'other'];
const TIER_VALUES = ['all', 'pro', 'premium'];
const PLATFORM_VALUES = ['all', 'ios', 'android', 'none'];
const STATUS_VALUES = ['all', 'active', 'cancelled', 'billing_issue', 'expiring'];

function ProUserRow({row, now, onUpdated}: {row: ProRow; now: Date; onUpdated: () => void}) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const [copied, setCopied] = React.useState(false);
	const {user} = row;
	const platform = rowPlatform(row);
	const expiring = isExpiringSoon(row, now);

	const handleManage = () => dispatch(openModal(<ManageUser userId={user.id} onUserUpdated={onUpdated} />, {width: 1100}));

	function copyRcId(e: React.MouseEvent) {
		e.stopPropagation();
		if (!user.revenuecat_user_id || typeof navigator === 'undefined' || !navigator.clipboard) return;
		navigator.clipboard.writeText(user.revenuecat_user_id).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}

	const sourceLabel =
		row.source === 'other' && user.iap_product_id ? user.iap_product_id : t(`admin_pro_users.source_${row.source}`);

	return (
		<tr className="zt-admin-users__row" onClick={handleManage}>
			<td className="zt-admin-users__cell zt-admin-users__cell--user">
				<div className="zt-admin-users__user-info">
					<div className="zt-admin-users__avatar-wrapper">
						<AvatarImage user={user as any} profile={user.profile} />
					</div>
					<div className="zt-admin-users__user-details">
						<div className="zt-admin-users__username">{user.username}</div>
						<div className="zt-admin-users__email">{user.email}</div>
					</div>
				</div>
			</td>
			<td className="zt-admin-users__cell">
				<div className="zt-admin-pro-users__tags">
					{row.tier === 'premium' && <span className="zt-admin-pro-users__tier">{t('admin_pro_users.tier_premium')}</span>}
					<span className={`zt-admin-pro-users__tag${isStoreSource(row.source) ? ' zt-admin-pro-users__tag--store' : ''}`}>
						{sourceLabel}
					</span>
				</div>
				{row.promo_code && (
					<div className="zt-admin-pro-users__sub">{t('admin_pro_users.promo_code_label', {code: row.promo_code})}</div>
				)}
			</td>
			<td className="zt-admin-users__cell">
				{platform === 'none' ? (
					<span className="zt-admin-pro-users__muted">-</span>
				) : (
					<span className="zt-admin-pro-users__tag">{t(`admin_pro_users.platform_${platform}`)}</span>
				)}
			</td>
			<td className="zt-admin-users__cell zt-admin-users__cell--date">
				{row.last_event_at ? (
					<>
						<div className="zt-admin-users__date-main">{dayjs(row.last_event_at).format('DD MMM YYYY')}</div>
						<div className="zt-admin-users__date-sub">{dayjs(row.last_event_at).fromNow()}</div>
					</>
				) : (
					<span className="zt-admin-pro-users__muted">-</span>
				)}
			</td>
			<td className="zt-admin-users__cell zt-admin-users__cell--date">
				{row.expires_at ? (
					<>
						<div className={`zt-admin-users__date-main${expiring ? ' zt-admin-pro-users__expiring' : ''}`}>
							{dayjs(row.expires_at).format('DD MMM YYYY')}
						</div>
						<div className="zt-admin-users__date-sub">{dayjs(row.expires_at).fromNow()}</div>
					</>
				) : (
					<div className="zt-admin-users__date-main">{t('admin_pro_users.unlimited')}</div>
				)}
			</td>
			<td className="zt-admin-users__cell">
				<span className={`zt-admin-pro-users__status zt-admin-pro-users__status--${row.status}`}>
					{t(`admin_pro_users.status_${row.status}`)}
				</span>
			</td>
			<td className="zt-admin-users__cell">
				{user.revenuecat_user_id ? (
					<button type="button" className="zt-admin-pro-users__copy" onClick={copyRcId} title={user.revenuecat_user_id}>
						{copied ? t('admin_pro_users.copied') : user.revenuecat_user_id.slice(0, 12) + '...'}
					</button>
				) : (
					<span className="zt-admin-pro-users__muted">-</span>
				)}
			</td>
		</tr>
	);
}

export default function AdminProUsers() {
	const {t} = useTranslation();
	const [query, setQuery] = useInput('');
	const [rows, setRows] = React.useState<ProRow[] | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [failed, setFailed] = React.useState(false);
	const [filters, setFilters] = React.useState<ProFacetFilters>(DEFAULT_FACETS);
	const [page, setPage] = React.useState(0);
	// One clock per load, so "expires within 7 days" and its count agree on every row.
	const [now, setNow] = React.useState(() => new Date());

	const fetchData = React.useCallback(async () => {
		setLoading(true);
		setFailed(false);
		try {
			const res = await gqlQuery<{adminProUsers: ProRow[]}>(ADMIN_PRO_USERS_QUERY, {}, 'no-cache');
			setRows(sortRows(res.data?.adminProUsers || []));
			setNow(new Date());
		} catch (err) {
			console.error('[AdminProUsers] fetch error', err);
			setFailed(true);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchData();
	}, [fetchData]);

	const fullFilters: ProFilters = {...filters, query};

	React.useEffect(() => {
		setPage(0);
	}, [filters, query]);

	const all = rows || [];
	const visible = filterRows(all, fullFilters, now);
	const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
	const safePage = Math.min(page, pageCount - 1);
	const pageRows = visible.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
	const hasOther = all.some((r) => r.source === 'other');
	const filtersActive =
		query.trim() !== '' || (Object.keys(DEFAULT_FACETS) as ProFacet[]).some((k) => filters[k] !== 'all');

	function facetOptions(facet: ProFacet, values: string[], labelPrefix: string) {
		const counts = facetCounts(all, fullFilters, facet, values, now);
		return values
			.filter((v) => facet !== 'source' || v !== 'other' || hasOther)
			.map((v) => ({
				value: v,
				label: (
					<>
						{v === 'all'
							? t('admin_pro_users.all')
							: v === 'expiring'
								? t('admin_pro_users.status_expiring', {days: EXPIRING_DAYS})
								: t(`admin_pro_users.${labelPrefix}_${v}`)}
						<span className="zt-admin-pro-users__count">{counts[v]}</span>
					</>
				),
				disabled: counts[v] === 0 && filters[facet] !== v,
			}));
	}

	function setFacet(facet: ProFacet, value: string) {
		setFilters((prev) => ({...prev, [facet]: value}));
	}

	const facetRows: Array<{facet: ProFacet; values: string[]; prefix: string; label: string}> = [
		{facet: 'source', values: SOURCE_VALUES, prefix: 'source', label: t('admin_pro_users.filter_source')},
		{facet: 'tier', values: TIER_VALUES, prefix: 'tier', label: t('admin_pro_users.filter_tier')},
		{facet: 'platform', values: PLATFORM_VALUES, prefix: 'platform', label: t('admin_pro_users.filter_platform')},
		{facet: 'status', values: STATUS_VALUES, prefix: 'status', label: t('admin_pro_users.filter_status')},
	];

	return (
		<div className="zt-admin-users zt-admin-pro-users">
			<div className="zt-admin-users__container">
				<div className="zt-admin-pro-users__toolbar">
					<div className="zt-admin-pro-users__search">
						<Input value={query} onChange={setQuery} placeholder={t('admin_pro_users.search_placeholder')} />
					</div>
					<div className="zt-admin-pro-users__total">
						{t('admin_pro_users.showing', {shown: visible.length, total: all.length})}
					</div>
				</div>

				<div className="zt-admin-pro-users__filters">
					{facetRows.map(({facet, values, prefix, label}) => (
						<div key={facet} className="zt-admin-pro-users__filter">
							<span className="zt-admin-pro-users__filter-label">{label}</span>
							<ChoiceGroup<string>
								label={label}
								value={filters[facet]}
								onChange={(v) => setFacet(facet, v)}
								options={facetOptions(facet, values, prefix)}
							/>
						</div>
					))}
					{filtersActive && (
						<div className="zt-admin-pro-users__clear">
							<Button
								small
								text={t('admin_pro_users.clear_filters')}
								onClick={() => {
									setFilters(DEFAULT_FACETS);
									setQuery('');
								}}
							/>
						</div>
					)}
				</div>

				<div className="zt-admin-users__table-wrapper">
					<table className="zt-admin-users__table">
						<thead>
							<tr className="zt-admin-users__header-row">
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_user')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_source')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_platform')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_last_event')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_expires')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_status')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_revenuecat')}</th>
							</tr>
						</thead>
						<tbody>
							{loading && !rows ? (
								<tr>
									<td colSpan={7} className="zt-admin-pro-users__state">
										{t('admin_pro_users.loading')}
									</td>
								</tr>
							) : failed ? (
								<tr>
									<td colSpan={7} className="zt-admin-pro-users__state">
										{t('admin_pro_users.failed')}
									</td>
								</tr>
							) : pageRows.length === 0 ? (
								<tr>
									<td colSpan={7} className="zt-admin-pro-users__state">
										{t('admin_pro_users.empty')}
									</td>
								</tr>
							) : (
								pageRows.map((row) => <ProUserRow key={row.user.id} row={row} now={now} onUpdated={fetchData} />)
							)}
						</tbody>
					</table>
				</div>

				{visible.length > PAGE_SIZE && (
					<div className="zt-admin-users__pagination">
						<Button small text={t('admin_pro_users.prev')} disabled={safePage === 0} onClick={() => setPage(safePage - 1)} />
						<span className="zt-admin-users__pagination-info">
							{safePage * PAGE_SIZE + 1}-{safePage * PAGE_SIZE + pageRows.length} / {visible.length}
						</span>
						<Button
							small
							text={t('admin_pro_users.next')}
							disabled={safePage >= pageCount - 1}
							onClick={() => setPage(safePage + 1)}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
