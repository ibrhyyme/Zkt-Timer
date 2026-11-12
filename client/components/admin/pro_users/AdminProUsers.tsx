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
	DEFAULT_PAID_FACETS,
	PaidFacet,
	PaidFacetFilters,
	ProRow,
	filterPaidRows,
	isExpiringSoon,
	isStoreSource,
	matchesQuery,
	paidFacetCounts,
	rowPlatform,
	sortRows,
	splitRows,
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

const SOURCE_VALUES = ['all', 'lifetime', 'yearly', 'monthly'];
const PLATFORM_VALUES = ['all', 'ios', 'android'];

/** 'paid' = store purchases (/admin/pro-users), 'granted' = promo code or admin (/admin/pro-grants). */
export type ProListKind = 'paid' | 'granted';

function ProUserRow({kind, row, now, onUpdated}: {kind: ProListKind; row: ProRow; now: Date; onUpdated: () => void}) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const [copied, setCopied] = React.useState(false);
	const {user} = row;
	const platform = rowPlatform(row);
	const expiring = isExpiringSoon(row, now);
	const paid = kind === 'paid';

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
			{paid && (
				<td className="zt-admin-users__cell">
					{platform === 'none' ? (
						<span className="zt-admin-pro-users__muted">-</span>
					) : (
						<span className="zt-admin-pro-users__tag">{t(`admin_pro_users.platform_${platform}`)}</span>
					)}
				</td>
			)}
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
			{paid && (
				<td className="zt-admin-users__cell">
					<span className={`zt-admin-pro-users__status zt-admin-pro-users__status--${row.status}`}>
						{t(`admin_pro_users.status_${row.status}`)}
					</span>
				</td>
			)}
			{paid && (
				<td className="zt-admin-users__cell">
					{user.revenuecat_user_id ? (
						<button type="button" className="zt-admin-pro-users__copy" onClick={copyRcId} title={user.revenuecat_user_id}>
							{copied ? t('admin_pro_users.copied') : user.revenuecat_user_id.slice(0, 12) + '...'}
						</button>
					) : (
						<span className="zt-admin-pro-users__muted">-</span>
					)}
				</td>
			)}
		</tr>
	);
}

export function ProUsersList({kind}: {kind: ProListKind}) {
	const {t} = useTranslation();
	const [query, setQuery] = useInput('');
	const [rows, setRows] = React.useState<ProRow[] | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [failed, setFailed] = React.useState(false);
	const [filters, setFilters] = React.useState<PaidFacetFilters>(DEFAULT_PAID_FACETS);
	const [page, setPage] = React.useState(0);
	// One clock per load, so the "expires soon" highlight agrees on every row.
	const [now, setNow] = React.useState(() => new Date());
	const paid = kind === 'paid';

	const fetchData = React.useCallback(async () => {
		setLoading(true);
		setFailed(false);
		try {
			const res = await gqlQuery<{adminProUsers: ProRow[]}>(ADMIN_PRO_USERS_QUERY, {}, 'no-cache');
			const split = splitRows(res.data?.adminProUsers || []);
			setRows(sortRows(paid ? split.paid : split.granted));
			setNow(new Date());
		} catch (err) {
			console.error('[AdminProUsers] fetch error', err);
			setFailed(true);
		} finally {
			setLoading(false);
		}
	}, [paid]);

	React.useEffect(() => {
		fetchData();
	}, [fetchData]);

	const fullFilters = {...filters, query};

	React.useEffect(() => {
		setPage(0);
	}, [filters, query]);

	const all = rows || [];
	const visible = paid ? filterPaidRows(all, fullFilters) : all.filter((row) => matchesQuery(row, query));
	const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
	const safePage = Math.min(page, pageCount - 1);
	const pageRows = visible.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
	const filtersActive =
		query.trim() !== '' || (paid && (Object.keys(DEFAULT_PAID_FACETS) as PaidFacet[]).some((k) => filters[k] !== 'all'));
	const colCount = paid ? 7 : 4;

	function facetOptions(facet: PaidFacet, values: string[]) {
		const counts = paidFacetCounts(all, fullFilters, facet, values);
		return values.map((v) => ({
			value: v,
			label: (
				<>
					{v === 'all' ? t('admin_pro_users.all') : t(`admin_pro_users.${facet}_${v}`)}
					<span className="zt-admin-pro-users__count">{counts[v]}</span>
				</>
			),
			disabled: counts[v] === 0 && filters[facet] !== v,
		}));
	}

	const facetRows: Array<{facet: PaidFacet; values: string[]; label: string}> = [
		{facet: 'source', values: SOURCE_VALUES, label: t('admin_pro_users.filter_source')},
		{facet: 'platform', values: PLATFORM_VALUES, label: t('admin_pro_users.filter_platform')},
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
					{filtersActive && (
						<Button
							small
							text={t('admin_pro_users.clear_filters')}
							onClick={() => {
								setFilters(DEFAULT_PAID_FACETS);
								setQuery('');
							}}
						/>
					)}
				</div>

				{paid && (
					<div className="zt-admin-pro-users__filters">
						{facetRows.map(({facet, values, label}) => (
							<div key={facet} className="zt-admin-pro-users__filter">
								<span className="zt-admin-pro-users__filter-label">{label}</span>
								<ChoiceGroup<string>
									label={label}
									value={filters[facet]}
									onChange={(v) => setFilters((prev) => ({...prev, [facet]: v}))}
									options={facetOptions(facet, values)}
								/>
							</div>
						))}
					</div>
				)}

				<div className="zt-admin-users__table-wrapper">
					<table className="zt-admin-users__table">
						<thead>
							<tr className="zt-admin-users__header-row">
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_user')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_source')}</th>
								{paid && <th className="zt-admin-users__header-cell">{t('admin_pro_users.col_platform')}</th>}
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_last_event')}</th>
								<th className="zt-admin-users__header-cell">{t('admin_pro_users.col_expires')}</th>
								{paid && <th className="zt-admin-users__header-cell">{t('admin_pro_users.col_status')}</th>}
								{paid && <th className="zt-admin-users__header-cell">{t('admin_pro_users.col_revenuecat')}</th>}
							</tr>
						</thead>
						<tbody>
							{loading && !rows ? (
								<tr>
									<td colSpan={colCount} className="zt-admin-pro-users__state">
										{t('admin_pro_users.loading')}
									</td>
								</tr>
							) : failed ? (
								<tr>
									<td colSpan={colCount} className="zt-admin-pro-users__state">
										{t('admin_pro_users.failed')}
									</td>
								</tr>
							) : pageRows.length === 0 ? (
								<tr>
									<td colSpan={colCount} className="zt-admin-pro-users__state">
										{t('admin_pro_users.empty')}
									</td>
								</tr>
							) : (
								pageRows.map((row) => (
									<ProUserRow key={row.user.id} kind={kind} row={row} now={now} onUpdated={fetchData} />
								))
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

/** Paid members: store purchases, filtered by plan and platform. */
export default function AdminProUsers() {
	return <ProUsersList kind="paid" />;
}
