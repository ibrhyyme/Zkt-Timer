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
import UserDailyActivity from './user_daily_activity/UserDailyActivity';
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
				wca_user_id
				wca_name
				wca_avatar_url
				zkt_id
				zkt_member_no
				zkt_name
				zkt_avatar_url
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
					scramble_subset
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
	// Parent list (AdminUsers / AdminProUsers) passes this so a ban/pro/verify
	// mutation inside the modal also refreshes the row behind it.
	onUserUpdated?: () => void;
}

export default function ManageUser(props: Props) {
	const {userId, onUserUpdated} = props;
	const {t} = useTranslation('translation', {keyPrefix: 'admin_users.manage_user'});

	const {data, loading, refetch} = useQuery<{getUserAccountForAdmin: UserAccountForAdmin}>(GET_USER_FOR_ADMIN, {
		variables: {userId},
		fetchPolicy: NO_CACHE,
	});

	const handleUserUpdate = React.useCallback(() => {
		refetch();
		onUserUpdated?.();
	}, [refetch, onUserUpdated]);

	const userData = data?.getUserAccountForAdmin;

	if (loading) return <Loading />;
	if (!userData) return <Empty text={t('user_not_found')} />;

	const wcaIntegration = userData.integrations?.find((int) => int.service_name === 'wca');
	const zktIntegration = userData.integrations?.find((int) => int.service_name === 'zkt') as any;
	// The two providers name the same person; show it once. WCA leads because it
	// is the older identity and the one most rows already carry.
	const identityName = wcaIntegration?.wca_name || zktIntegration?.zkt_name || null;
	const identityAvatar = wcaIntegration?.wca_avatar_url || zktIntegration?.zkt_avatar_url || null;
	const differingName =
		wcaIntegration?.wca_name &&
		zktIntegration?.zkt_name &&
		wcaIntegration.wca_name !== zktIntegration.zkt_name
			? zktIntegration.zkt_name
			: null;

	function getInfoCards() {
		const rows = [
			{label: 'Email', value: userData.email},
			{label: t('email_verified'), value: userData.email_verified ? '✓' : '✗'},
			{label: t('join_country'), value: userData.join_country || '—'},
			{label: t('join_ip'), value: userData.join_ip || '—'},
		];

		return (
			<div className={b('list')}>
				{/* One "linked accounts" card, one row per federation. They used to be
				    two separate cards, which repeated the person's name twice and made
				    you read the field labels to tell which card was which. The name is
				    shown once, and again only if the two providers disagree on it —
				    that disagreement is worth an admin's attention. */}
				{(wcaIntegration || zktIntegration) && (
					<div className={b('card', {wca: true})}>
						{identityName && (
							<div className={b('card-wca-identity')}>
								{identityAvatar && (
									<img src={identityAvatar} alt="" className={b('wca-avatar')} />
								)}
								<span className={b('wca-name')}>{identityName}</span>
							</div>
						)}
						{wcaIntegration && (
							<div className={b('card-stats')}>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>WCA ID</span>
									<span className={b('card-stat-value')}>{wcaIntegration.wca_id || '—'}</span>
								</div>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>WCA User ID</span>
									<span className={b('card-stat-value')}>{wcaIntegration.wca_user_id || '—'}</span>
								</div>
							</div>
						)}
						{/* A member number exists from signup; the ZKT ID only after their
						    first published result, so "—" there means "linked, has not
						    competed yet". */}
						{zktIntegration && (
							<div className={b('card-stats')}>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>ZKT ID</span>
									<span className={b('card-stat-value')}>{zktIntegration.zkt_id || '—'}</span>
								</div>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>ZKT Üye No</span>
									<span className={b('card-stat-value')}>
										{zktIntegration.zkt_member_no ?? '—'}
									</span>
								</div>
							</div>
						)}
						{differingName && (
							<div className={b('card-stats')}>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>ZKT adı</span>
									<span className={b('card-stat-value')}>{differingName}</span>
								</div>
							</div>
						)}
					</div>
				)}
				{rows.map((row) => (
					<div key={row.label} className={b('card')}>
						<span className={b('card-label')}>{row.label}</span>
						<span className={b('card-value')}>{row.value}</span>
					</div>
				))}
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

	// Two columns, not three: the third used to hold the user's timer preferences
	// (inspection delay, confetti, decimal places…), which tell an admin nothing
	// about the person they are moderating. Dropping it gives the solve breakdown
	// and the activity chart the width they actually need.
	return (
		<div className={b()}>
			<div className={b('col', {side: true})}>
				<div className={b('header')}>
					<Avatar target="_blank" user={userData} showEmail profile={userData.profile} />
				</div>
				{getInfoCards()}
				<div className={b('actions')}>
					<UserActions updateUser={handleUserUpdate} user={userData} />
				</div>
			</div>

			<div className={b('col', {main: true})}>
				<UserSummary summary={userData.summary} />
				<UserDailyActivity userId={userId} />
				{/* Moderation history sits below the numbers and shares one row:
				    both lists are empty for almost every user. */}
				<div className={b('meta-row')}>
					{getSection(t('bans_title'), userData.bans, 'reason', 'banned_until')}
					{getSection(t('reports_title'), userData.reports_for, 'reason', null)}
				</div>
			</div>
		</div>
	);
}
