import React from 'react';
import { gql } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Users, ChartLineUp, UserPlus, Cube, CrownSimple, Flag, WifiHigh, Globe, CaretDown, CaretUp, Lifebuoy } from 'phosphor-react';
import { gqlQuery } from '../../api';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import { openModal } from '../../../actions/general';
import ManageUser from '../manage_user/ManageUser';
import './AdminDashboard.scss';

interface DashboardStats {
	total_users: number;
	dau: number;
	wau: number;
	mau: number;
	signups_today: number;
	signups_week: number;
	solves_today: number;
	solves_week: number;
	solves_total: number;
	pro_users_count: number;
	pending_reports_count: number;
	pending_support_tickets_count: number;
	online_users: number;
	wca_connected: number;
}

const STATS_QUERY = gql`
	query AdminDashboardStats {
		adminDashboardStats {
			total_users
			dau
			wau
			mau
			signups_today
			signups_week
			solves_today
			solves_week
			solves_total
			pro_users_count
			pending_reports_count
			pending_support_tickets_count
			online_users
			wca_connected
		}
	}
`;

const ACTIVE_USERS_QUERY = gql`
	query AdminActiveUsers($period: String!, $monthYear: String) {
		adminActiveUsers(period: $period, monthYear: $monthYear) {
			rows {
				user {
					id
					username
					is_pro
					profile {
						pfp_image {
							id
							user_id
							storage_path
						}
					}
				}
				active_minutes
				last_seen_at
			}
			total_active_users
			total_active_minutes
			available_months
		}
	}
`;

interface ActiveUserRow {
	user: {
		id: string;
		username: string;
		is_pro: boolean;
		profile?: {
			pfp_image?: { id: string; user_id: string; storage_path: string } | null;
		};
	};
	active_minutes: number;
	last_seen_at?: string | null;
}

interface AdminActiveUsersResult {
	rows: ActiveUserRow[];
	total_active_users: number;
	total_active_minutes: number;
	available_months: string[];
}

interface CardProps {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	subValue?: string;
	color?: string;
	to?: string;
	highlight?: boolean;
	onClick?: () => void;
	expanded?: boolean;
	expandable?: boolean;
}

function StatCard({ icon, label, value, subValue, color, to, highlight, onClick, expanded, expandable }: CardProps) {
	const content = (
		<div className={`cd-admin-dashboard__card${highlight ? ' cd-admin-dashboard__card--highlight' : ''}${expandable ? ' cd-admin-dashboard__card--expandable' : ''}${expanded ? ' cd-admin-dashboard__card--expanded' : ''}`}>
			<div className="cd-admin-dashboard__card-icon" style={color ? { color } : undefined}>{icon}</div>
			<div className="cd-admin-dashboard__card-body">
				<div className="cd-admin-dashboard__card-label">{label}</div>
				<div className="cd-admin-dashboard__card-value">{value}</div>
				{subValue && <div className="cd-admin-dashboard__card-sub">{subValue}</div>}
			</div>
			{expandable && (
				<div className="cd-admin-dashboard__card-caret">
					{expanded ? <CaretUp size={18} weight="bold" /> : <CaretDown size={18} weight="bold" />}
				</div>
			)}
		</div>
	);

	if (to) {
		return <Link to={to} className="cd-admin-dashboard__card-link">{content}</Link>;
	}
	if (onClick) {
		return <button type="button" onClick={onClick} className="cd-admin-dashboard__card-button">{content}</button>;
	}
	return content;
}

function formatDuration(minutes: number, t: (k: string) => string): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} ${t('admin_dashboard.duration_min')}`;
	if (m === 0) return `${h} ${t('admin_dashboard.duration_hour')}`;
	return `${h} ${t('admin_dashboard.duration_hour')} ${m} ${t('admin_dashboard.duration_min')}`;
}

function formatRelative(iso: string | null | undefined, t: (k: string, opts?: any) => string): string {
	if (!iso) return '-';
	const ms = Date.now() - new Date(iso).getTime();
	const min = Math.floor(ms / 60000);
	if (min < 1) return t('admin_dashboard.just_now');
	if (min < 60) return t('admin_dashboard.min_ago', { count: min });
	const h = Math.floor(min / 60);
	if (h < 24) return t('admin_dashboard.hour_ago', { count: h });
	const d = Math.floor(h / 24);
	return t('admin_dashboard.day_ago', { count: d });
}

function formatMonthLabel(ym: string, locale: string): string {
	const m = /^(\d{4})-(\d{2})$/.exec(ym);
	if (!m) return ym;
	const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
	try {
		return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
	} catch {
		return ym;
	}
}

function getCurrentIstanbulMonthYear(): string {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Istanbul',
		year: 'numeric',
		month: '2-digit',
	}).formatToParts(new Date());
	const year = parts.find((p) => p.type === 'year')?.value || '';
	const month = parts.find((p) => p.type === 'month')?.value || '';
	return `${year}-${month}`;
}

interface ActiveUsersPanelProps {
	period: 'day' | 'week' | 'month';
}

function ActiveUsersPanel({ period }: ActiveUsersPanelProps) {
	const { t, i18n } = useTranslation();
	const dispatch = useDispatch();
	const [result, setResult] = React.useState<AdminActiveUsersResult | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);

	const currentMonth = React.useMemo(() => getCurrentIstanbulMonthYear(), []);
	const effectiveMonth = period === 'month' ? (selectedMonth ?? currentMonth) : null;

	React.useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const variables: { period: string; monthYear?: string } = { period };
		if (period === 'month' && selectedMonth && selectedMonth !== currentMonth) {
			variables.monthYear = selectedMonth;
		}
		gqlQuery<{ adminActiveUsers: AdminActiveUsersResult }>(ACTIVE_USERS_QUERY, variables, 'no-cache')
			.then((res) => {
				if (cancelled) return;
				setResult(res.data.adminActiveUsers || null);
			})
			.catch(() => {
				if (!cancelled) setResult(null);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [period, selectedMonth, currentMonth]);

	function openManageUser(userId: string) {
		dispatch(openModal(<ManageUser userId={userId} />, { width: 1100 }));
	}

	const monthOptions = React.useMemo(() => {
		if (period !== 'month') return [];
		const fromServer = result?.available_months ?? [];
		const merged = Array.from(new Set([currentMonth, ...fromServer]));
		merged.sort((a, b) => (a < b ? 1 : -1));
		return merged;
	}, [period, result?.available_months, currentMonth]);

	return (
		<div className="cd-admin-dashboard__expand-panel">
			{period === 'month' && monthOptions.length > 0 && (
				<div className="cd-admin-dashboard__month-controls">
					<label className="cd-admin-dashboard__month-label" htmlFor="cd-admin-dashboard-month-select">
						{t('admin_dashboard.select_month')}
					</label>
					<select
						id="cd-admin-dashboard-month-select"
						className="cd-admin-dashboard__month-select"
						value={effectiveMonth ?? currentMonth}
						onChange={(e) => {
							const v = e.target.value;
							setSelectedMonth(v === currentMonth ? null : v);
						}}
					>
						{monthOptions.map((ym) => (
							<option key={ym} value={ym}>
								{ym === currentMonth ? t('admin_dashboard.this_month') : formatMonthLabel(ym, i18n.language)}
							</option>
						))}
					</select>
				</div>
			)}

			{!loading && result && result.rows.length > 0 && (
				<div className="cd-admin-dashboard__panel-summary">
					{t('admin_dashboard.month_summary', {
						users: result.total_active_users,
						duration: formatDuration(result.total_active_minutes, t),
					})}
				</div>
			)}

			{loading && <div className="cd-admin-dashboard__table-loading">{t('admin_dashboard.loading')}</div>}

			{!loading && (!result || result.rows.length === 0) && (
				<div className="cd-admin-dashboard__table-empty">{t('admin_dashboard.no_active_users')}</div>
			)}

			{!loading && result && result.rows.length > 0 && (
				<div className="cd-admin-dashboard__table">
					<div className="cd-admin-dashboard__table-header">
						<span>{t('admin_dashboard.tbl_user')}</span>
						<span>{t('admin_dashboard.tbl_active_time')}</span>
						<span>{t('admin_dashboard.tbl_last_seen')}</span>
					</div>
					{result.rows.map((row) => (
						<div
							key={row.user.id}
							className="cd-admin-dashboard__table-row cd-admin-dashboard__table-row--clickable"
							onClick={() => openManageUser(row.user.id)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openManageUser(row.user.id);
								}
							}}
						>
							<span className="cd-admin-dashboard__table-user">
								<AvatarImage user={row.user as any} tiny />
								<span className="cd-admin-dashboard__table-username">{row.user.username}</span>
							</span>
							<span className="cd-admin-dashboard__table-time">{formatDuration(row.active_minutes, t)}</span>
							<span className="cd-admin-dashboard__table-last">{formatRelative(row.last_seen_at, t)}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export default function AdminDashboard() {
	const { t } = useTranslation();
	const [stats, setStats] = React.useState<DashboardStats | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [expanded, setExpanded] = React.useState<'day' | 'week' | 'month' | null>(null);

	React.useEffect(() => {
		fetchStats();
		const interval = setInterval(fetchStats, 60_000);
		return () => clearInterval(interval);
	}, []);

	async function fetchStats() {
		try {
			const res = await gqlQuery<{ adminDashboardStats: DashboardStats }>(STATS_QUERY, {}, 'no-cache');
			setStats(res.data.adminDashboardStats);
		} catch (err) {
			console.error('dashboard stats fetch failed:', err);
		} finally {
			setLoading(false);
		}
	}

	function toggleExpand(period: 'day' | 'week' | 'month') {
		setExpanded((prev) => (prev === period ? null : period));
	}

	if (loading || !stats) {
		return <div className="cd-admin-dashboard"><div className="cd-admin-dashboard__loading">{t('admin_dashboard.loading')}</div></div>;
	}

	return (
		<div className="cd-admin-dashboard">
			<div className="cd-admin-dashboard__container">
				<h1 className="cd-admin-dashboard__title">{t('admin_dashboard.title')}</h1>

				<div className="cd-admin-dashboard__section">
					<h2 className="cd-admin-dashboard__section-title">{t('admin_dashboard.activity')}</h2>
					<div className="cd-admin-dashboard__grid">
						<StatCard
							icon={<WifiHigh size={28} weight="bold" />}
							label={t('admin_dashboard.online_now')}
							value={stats.online_users}
							color="#22c55e"
							highlight
							to="/admin/site-config"
						/>
						<StatCard
							icon={<ChartLineUp size={28} weight="bold" />}
							label={t('admin_dashboard.dau')}
							value={stats.dau}
							subValue={t('admin_dashboard.today')}
							color="#3b82f6"
							onClick={() => toggleExpand('day')}
							expanded={expanded === 'day'}
							expandable
						/>
						<StatCard
							icon={<ChartLineUp size={28} weight="bold" />}
							label={t('admin_dashboard.wau')}
							value={stats.wau}
							subValue={t('admin_dashboard.this_week')}
							color="#8b5cf6"
							onClick={() => toggleExpand('week')}
							expanded={expanded === 'week'}
							expandable
						/>
						<StatCard
							icon={<ChartLineUp size={28} weight="bold" />}
							label={t('admin_dashboard.mau')}
							value={stats.mau}
							subValue={t('admin_dashboard.this_month')}
							color="#a855f7"
							onClick={() => toggleExpand('month')}
							expanded={expanded === 'month'}
							expandable
						/>
					</div>
					{expanded && <ActiveUsersPanel period={expanded} />}
				</div>

				<div className="cd-admin-dashboard__section">
					<h2 className="cd-admin-dashboard__section-title">{t('admin_dashboard.users')}</h2>
					<div className="cd-admin-dashboard__grid">
						<StatCard
							icon={<Users size={28} weight="bold" />}
							label={t('admin_dashboard.total_users')}
							value={stats.total_users}
							to="/admin/users"
						/>
						<StatCard
							icon={<UserPlus size={28} weight="bold" />}
							label={t('admin_dashboard.new_today')}
							value={stats.signups_today}
							subValue={t('admin_dashboard.new_week_count', { count: stats.signups_week })}
							color="#22c55e"
							to="/admin/users"
						/>
						<StatCard
							icon={<CrownSimple size={28} weight="bold" />}
							label={t('admin_dashboard.pro_users')}
							value={stats.pro_users_count}
							color="#a855f7"
							to="/admin/pro-users"
						/>
						<StatCard
							icon={<Globe size={28} weight="bold" />}
							label={t('admin_dashboard.wca_connected')}
							value={stats.wca_connected}
							color="#14b8a6"
							to="/admin/users"
						/>
					</div>
				</div>

				<div className="cd-admin-dashboard__section">
					<h2 className="cd-admin-dashboard__section-title">{t('admin_dashboard.solves_section')}</h2>
					<div className="cd-admin-dashboard__grid">
						<StatCard
							icon={<Cube size={28} weight="bold" />}
							label={t('admin_dashboard.solves_today')}
							value={stats.solves_today}
							color="#f59e0b"
						/>
						<StatCard
							icon={<Cube size={28} weight="bold" />}
							label={t('admin_dashboard.solves_week')}
							value={stats.solves_week}
							color="#f97316"
						/>
						<StatCard
							icon={<Cube size={28} weight="bold" />}
							label={t('admin_dashboard.solves_total')}
							value={stats.solves_total}
							subValue={t('admin_dashboard.solves_total_sub')}
							color="#ea580c"
						/>
					</div>
				</div>

				<div className="cd-admin-dashboard__section">
					<h2 className="cd-admin-dashboard__section-title">{t('admin_dashboard.action_required')}</h2>
					<div className="cd-admin-dashboard__grid">
						<StatCard
							icon={<Flag size={28} weight="bold" />}
							label={t('admin_dashboard.pending_reports')}
							value={stats.pending_reports_count}
							color={stats.pending_reports_count > 0 ? '#ef4444' : '#6b7280'}
							to="/admin/reports"
							highlight={stats.pending_reports_count > 0}
						/>
						<StatCard
							icon={<Lifebuoy size={28} weight="bold" />}
							label={t('admin_dashboard.pending_support_tickets')}
							value={stats.pending_support_tickets_count}
							color={stats.pending_support_tickets_count > 0 ? '#f59e0b' : '#6b7280'}
							to="/admin/reports?tab=support"
							highlight={stats.pending_support_tickets_count > 0}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
