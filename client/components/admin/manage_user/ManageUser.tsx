import React, {useState} from 'react';
import {gql, useQuery, useLazyQuery} from '@apollo/client';
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

const GET_IP_INFO = gql`
	query ipInfo($ip: String!) {
		ipInfo(ip: $ip) {
			ip country countryCode regionName city isp org proxy mobile hosting timezone
		}
	}
`;

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
				wca_user_id
				wca_name
				wca_avatar_url
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
		variables: {userId},
		fetchPolicy: NO_CACHE,
	});

	const [showIpDetail, setShowIpDetail] = useState(false);
	const [fetchIpInfo, {data: ipData, loading: ipLoading}] = useLazyQuery<{ipInfo: any}>(GET_IP_INFO, {fetchPolicy: NO_CACHE});

	const userData = data?.getUserAccountForAdmin;

	if (loading) return <Loading />;
	if (!userData) return <Empty text={t('user_not_found')} />;

	const wcaIntegration = userData.integrations?.find((int) => int.service_name === 'wca');

	function formatSettingValue(value: any): string {
		if (typeof value === 'boolean') return value ? t('bool_true') : t('bool_false');
		if (value === null || value === undefined) return '—';
		return String(value);
	}

	function handleIpDetail() {
		if (!showIpDetail && userData.join_ip) {
			fetchIpInfo({variables: {ip: userData.join_ip}});
		}
		setShowIpDetail((v) => !v);
	}

	function getInfoCards() {
		const ipDetail = ipData?.ipInfo;
		const rows = [
			{label: 'Email', value: userData.email},
			{label: t('email_verified'), value: userData.email_verified ? '✓' : '✗'},
			{label: t('join_country'), value: userData.join_country || '—'},
		];

		return (
			<div className={b('list')}>
				{wcaIntegration && (
					<div className={b('card', {wca: true})}>
						{(wcaIntegration.wca_avatar_url || wcaIntegration.wca_name) && (
							<div className={b('card-wca-identity')}>
								{wcaIntegration.wca_avatar_url && (
									<img src={wcaIntegration.wca_avatar_url} alt="" className={b('wca-avatar')} />
								)}
								{wcaIntegration.wca_name && (
									<span className={b('wca-name')}>{wcaIntegration.wca_name}</span>
								)}
							</div>
						)}
						<div className={b('card-stats')}>
							<div className={b('card-stat')}>
								<span className={b('card-stat-label')}>WCA ID</span>
								<span className={b('card-stat-value')}>{wcaIntegration.wca_id || '—'}</span>
							</div>
							<div className={b('card-stat')}>
								<span className={b('card-stat-label')}>User ID</span>
								<span className={b('card-stat-value')}>{wcaIntegration.wca_user_id || '—'}</span>
							</div>
						</div>
					</div>
				)}
				{rows.map((row) => (
					<div key={row.label} className={b('card')}>
						<span className={b('card-label')}>{row.label}</span>
						<span className={b('card-value')}>{row.value}</span>
					</div>
				))}
				{userData.join_ip && (
					<div className={b('card', {'ip-expandable': true})}>
						<div className={b('card-ip-header')}>
							<span className={b('card-label')}>{t('join_ip')}</span>
							<div className={b('card-ip-right')}>
								<span className={b('card-value')}>{userData.join_ip}</span>
								<button className={b('ip-toggle')} onClick={handleIpDetail}>
									{showIpDetail ? '▲' : '▼'}
								</button>
							</div>
						</div>
						{showIpDetail && (
							<div className={b('ip-detail')}>
								{ipLoading ? (
									<span className={b('ip-detail-loading')}>Sorgulanıyor...</span>
								) : ipDetail ? (
									<>
										<div className={b('ip-detail-row')}>
											<span>{ipDetail.city}{ipDetail.regionName ? `, ${ipDetail.regionName}` : ''}</span>
											<span>{ipDetail.country} ({ipDetail.countryCode})</span>
										</div>
										<div className={b('ip-detail-row')}>
											<span className={b('ip-detail-label')}>ISP</span>
											<span>{ipDetail.isp}</span>
										</div>
										{ipDetail.org && ipDetail.org !== ipDetail.isp && (
											<div className={b('ip-detail-row')}>
												<span className={b('ip-detail-label')}>Org</span>
												<span>{ipDetail.org}</span>
											</div>
										)}
										<div className={b('ip-detail-row')}>
											<span className={b('ip-detail-label')}>Timezone</span>
											<span>{ipDetail.timezone}</span>
										</div>
										<div className={b('ip-detail-flags')}>
											<span className={b('ip-flag', {danger: ipDetail.proxy, ok: !ipDetail.proxy})}>
												{ipDetail.proxy ? 'PROXY/VPN' : 'Proxy yok'}
											</span>
											<span className={b('ip-flag', {warn: ipDetail.hosting, ok: !ipDetail.hosting})}>
												{ipDetail.hosting ? 'Hosting/VPS' : 'Hosting yok'}
											</span>
											<span className={b('ip-flag', {neutral: true})}>
												{ipDetail.mobile ? 'Mobil' : 'Sabit hat'}
											</span>
										</div>
									</>
								) : null}
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	function getSection(title: string, list: any[], nameKey: string, subKey: string | null) {
		const items = list || [];
		return (
			<div className={b('section')}>
				<div className={b('section-title')}>{title}</div>
				{items.length === 0 ? (
					<Empty text={t('no_records')} />
				) : (
					<div className={b('list')}>
						{items.map((item) => (
							<div key={item.id} className={b('card')}>
								<span className={b('card-label')}>{item[nameKey]}</span>
								<div className={b('card-meta')}>
									{subKey && item[subKey] && <span>{item[subKey]}</span>}
									<span className={b('card-date')}>{getDateFromNow(item.created_at)}</span>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	function getSettings() {
		const settings = userData.settings;
		if (!settings) return null;
		const settingKeys = Object.keys(settings).filter((key) => !key.startsWith('_'));

		return (
			<div className={b('section')}>
				<div className={b('section-title')}>{t('settings')}</div>
				<div className={b('settings-grid')}>
					{settingKeys.map((key) => (
						<div key={key} className={b('setting-card')}>
							<span className={b('card-stat-label')}>{t(`setting_${key}`, key.replace(/_/g, ' '))}</span>
							<span className={b('card-stat-value')}>{formatSettingValue(settings[key])}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={b()}>
			<div className={b('col')}>
				<div className={b('header')}>
					<Avatar target="_blank" user={userData} showEmail profile={userData.profile} />
				</div>
				{getInfoCards()}
				<div className={b('actions')}>
					<UserActions updateUser={refetch} user={userData} />
				</div>
			</div>

			<div className={b('col')}>
				<UserSummary summary={userData.summary} />
			</div>

			<div className={b('col')}>
				{getSection(t('bans_title'), userData.bans, 'reason', 'banned_until')}
				{getSection(t('reports_title'), userData.reports_for, 'reason', null)}
				{getSettings()}
			</div>
		</div>
	);
}
