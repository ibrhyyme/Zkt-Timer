import React from 'react';
import {gql, useQuery} from '@apollo/client';
import './ManageUser.scss';
import {NO_CACHE} from '../../api';
import Loading from '../../common/loading/Loading';
import Avatar from '../../common/avatar/Avatar';
import UserActions from './user_actions/UserActions';
import Empty from '../../common/empty/Empty';
import {getDateFromNow} from '../../../util/dates';
import block from '../../../styles/bem';
import UserSummary from './user_summary/UserSummary';
import {UserAccountForAdmin} from '../../../../server/schemas/UserAccount.schema';
import {useTranslation} from 'react-i18next';

const b = block('manage-user');

const GET_USER_FOR_ADMIN = gql`
	query getUserAccountForAdmin($userId: String) {
		getUserAccountForAdmin(userId: $userId) {
			id
			username
			email
			email_verified
			verified
			created_at
			banned_forever
			is_pro
			is_premium
			banned_until
			admin
			mod
			offline_hash
			join_country
			join_ip
			integrations {
				id
				service_name
				wca_id
			}
			profile {
				id
				bio
				three_method
				three_goal
				main_three_cube
				favorite_event
				youtube_link
				twitter_link
				reddit_link
				twitch_link
				pfp_image {
					id
					user_id
					storage_path
				}
				header_image {
					id
					user_id
					storage_path
				}
			}
			settings {
				id
				focus_mode
				freeze_time
				inspection
				manual_entry
				inspection_delay
				inverse_time_list
				hide_time_when_solving
				nav_collapsed
				timer_decimal_points
				pb_confetti
				play_inspection_sound
				zero_out_time_after_solve
				confirm_delete_solve
				use_space_with_smart_cube
				require_period_in_manual_time_entry
				cube_type
			}
			reports_for {
				id
				reason
				created_at
				created_by {
					id
					username
				}
			}
			bans {
				id
				reason
				created_at
				banned_until
				forever
				active
				created_by {
					id
					username
				}
			}
			summary {
				solves
				reports_for
				reports_created
				profile_views
				bans
				timer_solves {
					count
					average
					min_time
					max_time
					sum
					cube_type
				}
			}
			notification_preferences {
				friend_request
				friend_request_accept
				marketing_emails
			}
		}
	}
`;

interface Props {
	userId: string;
}

export default function ManageUser(props: Props) {
	const {userId} = props;
	const {t} = useTranslation('translation', {keyPrefix: 'admin_users.manage_user'});

	const {data, loading, refetch} = useQuery<{getUserAccountForAdmin: UserAccountForAdmin}>(GET_USER_FOR_ADMIN, {
		variables: {
			userId,
		},
		fetchPolicy: NO_CACHE,
	});

	const userData = data?.getUserAccountForAdmin;

	if (loading) {
		return <Loading />;
	}

	if (!userData) {
		return <Empty text={t('user_not_found')} />;
	}

	const wcaIntegration = userData.integrations?.find((int) => int.service_name === 'wca');

	function getInfoTable() {
		const rows = [
			{label: 'Email', value: userData.email},
			{label: t('email_verified'), value: userData.email_verified ? '✓' : '✗', highlight: userData.email_verified},
			{label: t('join_country'), value: userData.join_country || '—'},
			{label: t('join_ip'), value: userData.join_ip || '—'},
			{label: t('wca_id'), value: wcaIntegration?.wca_id || '—'},
		];

		return (
			<div className={b('info')}>
				<table className="cd-table">
					<tbody>
						{rows.map((row) => (
							<tr key={row.label}>
								<td className={b('table-stat')}>{row.label}</td>
								<td>{row.value}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	function formatSettingValue(value: any): string {
		if (typeof value === 'boolean') {
			return value ? t('bool_true') : t('bool_false');
		}
		if (value === null || value === undefined) {
			return '—';
		}
		return String(value);
	}

	function getGenericGrid(title: string, list, name: string, sub) {
		let output = list || [];

		output = output.map((item) => (
			<div key={item.id} className={b('grid-row')}>
				<div className={b('grid-row', {left: true})}>
					<p>{item[name]}</p>
					{sub && item[sub] ? <span>{item[sub]}</span> : null}
				</div>

				<div className={b('grid-row', {right: true})}>
					<span>{getDateFromNow(item.created_at)}</span>
				</div>
			</div>
		));

		if (!output.length) {
			output = <Empty text={t('no_records')} />;
		}

		return (
			<div className={b('grid')}>
				<h3>{title}</h3>
				<div className={b('grid-body')}>{output}</div>
			</div>
		);
	}

	function getSettings() {
		const settings = userData.settings;
		if (!settings) {
			return null;
		}

		const settingKeys = Object.keys(settings).filter((key) => !key.startsWith('_'));

		return (
			<div className={b('table')}>
				<h3>{t('settings')}</h3>
				<table className="cd-table">
					<tbody>
						{settingKeys.map((key) => (
							<tr key={key}>
								<td className={b('table-stat')}>{t(`setting_${key}`, key.replace(/_/g, ' '))}</td>
								<td>{formatSettingValue(settings[key])}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	function getBans() {
		return getGenericGrid(t('bans_title'), userData.bans, 'reason', 'banned_until');
	}

	function getReports() {
		return getGenericGrid(t('reports_title'), userData.reports_for, 'reason', null);
	}

	return (
		<div className={b()}>
			<div className={b('user')}>
				<Avatar target="_blank" user={userData} showEmail profile={userData.profile} />
				{getInfoTable()}
				<UserActions updateUser={refetch} user={userData} />
			</div>

			<div className={b('sections')}>
				<UserSummary summary={userData.summary} />
				<div className={b('section')}>{getBans()}</div>
				<div className={b('section')}>{getReports()}</div>
				<div className={b('section')}>{getSettings()}</div>
			</div>
		</div>
	);
}
