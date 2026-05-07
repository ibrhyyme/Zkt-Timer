import React from 'react';
import { gql } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Users, ChartLineUp, UserPlus, Cube, CrownSimple, Flag, WifiHigh, Globe } from 'phosphor-react';
import { gqlQuery } from '../../api';
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
	pro_users_count: number;
	pending_reports_count: number;
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
			pro_users_count
			pending_reports_count
			online_users
			wca_connected
		}
	}
`;

interface CardProps {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	subValue?: string;
	color?: string;
	to?: string;
	highlight?: boolean;
}

function StatCard({ icon, label, value, subValue, color, to, highlight }: CardProps) {
	const content = (
		<div className={`cd-admin-dashboard__card${highlight ? ' cd-admin-dashboard__card--highlight' : ''}`}>
			<div className="cd-admin-dashboard__card-icon" style={color ? { color } : undefined}>{icon}</div>
			<div className="cd-admin-dashboard__card-body">
				<div className="cd-admin-dashboard__card-label">{label}</div>
				<div className="cd-admin-dashboard__card-value">{value}</div>
				{subValue && <div className="cd-admin-dashboard__card-sub">{subValue}</div>}
			</div>
		</div>
	);

	if (to) {
		return <Link to={to} className="cd-admin-dashboard__card-link">{content}</Link>;
	}
	return content;
}

export default function AdminDashboard() {
	const { t } = useTranslation();
	const [stats, setStats] = React.useState<DashboardStats | null>(null);
	const [loading, setLoading] = React.useState(true);

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
							subValue={t('admin_dashboard.last_24h')}
							color="#3b82f6"
							to="/admin/users"
						/>
						<StatCard
							icon={<ChartLineUp size={28} weight="bold" />}
							label={t('admin_dashboard.wau')}
							value={stats.wau}
							subValue={t('admin_dashboard.last_7d')}
							color="#8b5cf6"
							to="/admin/users"
						/>
						<StatCard
							icon={<ChartLineUp size={28} weight="bold" />}
							label={t('admin_dashboard.mau')}
							value={stats.mau}
							subValue={t('admin_dashboard.last_30d')}
							color="#a855f7"
							to="/admin/users"
						/>
					</div>
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
					</div>
				</div>
			</div>
		</div>
	);
}
