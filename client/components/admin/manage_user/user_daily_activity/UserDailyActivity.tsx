import React from 'react';
import {gql, useQuery} from '@apollo/client';
import './UserDailyActivity.scss';
import block from '../../../../styles/bem';
import {NO_CACHE} from '../../../api';
import Empty from '../../../common/empty/Empty';
import {useTranslation} from 'react-i18next';

const b = block('user-daily-activity');

const GET_DAILY_ACTIVITY = gql`
	query adminUserDailyActivity($userId: String!) {
		adminUserDailyActivity(userId: $userId) {
			total_minutes
			rows {
				path
				minutes
			}
		}
	}
`;

interface ActivityRow {
	path: string;
	minutes: number;
}

interface Props {
	userId: string;
}

export default function UserDailyActivity(props: Props) {
	const {userId} = props;
	const {t} = useTranslation('translation', {keyPrefix: 'admin_users.manage_user'});

	const {data, loading} = useQuery<{adminUserDailyActivity: {rows: ActivityRow[]; total_minutes: number}}>(
		GET_DAILY_ACTIVITY,
		{variables: {userId}, fetchPolicy: NO_CACHE},
	);

	const result = data?.adminUserDailyActivity;
	const rows = result?.rows || [];
	const maxMinutes = rows.reduce((m, r) => Math.max(m, r.minutes), 0) || 1;

	// Unknown categories fall back to the raw path so a new route is still readable.
	function pageLabel(path: string): string {
		return t(`activity_page_${path}`, path);
	}

	function formatDuration(minutes: number): string {
		if (minutes >= 60) {
			const h = Math.floor(minutes / 60);
			const m = minutes % 60;
			const hStr = `${h}${t('hours_unit')}`;
			return m > 0 ? `${hStr} ${m}${t('minutes_unit')}` : hStr;
		}
		return `${minutes}${t('minutes_unit')}`;
	}

	return (
		<div className={b()}>
			<div className={b('head')}>
				<h3 className={b('title')}>{t('daily_activity_title')}</h3>
				{!loading && rows.length > 0 && (
					<span className={b('total')}>{formatDuration(result?.total_minutes || 0)}</span>
				)}
			</div>

			{loading ? null : rows.length === 0 ? (
				<Empty text={t('no_activity_today')} />
			) : (
				<div className={b('list')}>
					{rows.map((row) => (
						<div key={row.path} className={b('row')}>
							<div className={b('row-head')}>
								<span className={b('label')}>{pageLabel(row.path)}</span>
								<span className={b('value')}>{formatDuration(row.minutes)}</span>
							</div>
							<div className={b('bar')}>
								<div
									className={b('bar-fill')}
									style={{width: `${Math.round((row.minutes / maxMinutes) * 100)}%`}}
								/>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
