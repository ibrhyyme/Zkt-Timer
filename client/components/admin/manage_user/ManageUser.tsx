import React from 'react';
import {gql, useQuery} from '@apollo/client';
import './ManageUser.scss';
import {USER_FOR_ADMIN_FRAGMENT} from '../../../util/graphql/fragments';
import {NO_CACHE} from '../../api';
import Loading from '../../common/loading/Loading';
import Avatar from '../../common/avatar/Avatar';
import UserActions from './user_actions/UserActions';
import Empty from '../../common/empty/Empty';
import {getDateFromNow} from '../../../util/dates';
import block from '../../../styles/bem';
import UserSummary from './user_summary/UserSummary';
import {UserAccountForAdmin} from '../../../../server/schemas/UserAccount.schema';

const b = block('manage-user');

const GET_USER_FOR_ADMIN = gql`
	query getUserAccountForAdmin($userId: String) {
		getUserAccountForAdmin(userId: $userId) {
			id
			username
			email
			verified
			created_at
			banned_forever
			is_pro
			banned_until
			admin
			mod
			offline_hash
			pro_status
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
			chat_messages {
				id
				message
				created_at
			}
			summary {
				solves
				reports_for
				reports_created
				profile_views
				bans
				matches {
					count
					wins
					losses
				}
				match_solves {
					count
					average
					min_time
					max_time
					sum
					cube_type
				}
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
				elo_refund
			}
		}
	}
`;

interface Props {
	userId: string;
}

export default function ManageUser(props: Props) {
	const {userId} = props;

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
		return <Empty text="Kullanıcı bulunamadı" />;
	}

	function getGenericTable(title: string, obj) {
		const rows = Object.keys(obj || {}).map((key) => {
			const name = key.replace(/_/g, ' ');

			if (key.startsWith('_')) {
				return null;
			}

			return (
				<tr key={key}>
					<td className={b('table-stat')}>{name}</td>
					<td>{obj[key]}</td>
				</tr>
			);
		});

		let body = (
			<table className="cd-table">
				<tbody>{rows}</tbody>
			</table>
		);

		if (!rows.length) {
			body = <Empty text="No records found" />;
		}

		return (
			<div className={b('table')}>
				<h3>{title}</h3>
				{body}
			</div>
		);
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
			output = <Empty text="No records found" />;
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
		
		// Add WCA ID to settings display
		const wcaIntegration = userData.integrations?.find(int => int.service_name === 'wca');
		const wcaId = wcaIntegration?.wca_id || '—';
		
		const settingsWithWca = {
			...settings,
			wca_id: wcaId
		};
		
		return getGenericTable('Settings', settingsWithWca);
	}

	function getBans() {
		const bans = userData.bans;
		return getGenericGrid('Bans', bans, 'reason', 'banned_until');
	}

	function getReports() {
		const reports = userData.reports_for;
		return getGenericGrid('Reports', reports, 'reason', null);
	}

	function getChatMessage() {
		const messages = userData.chat_messages;
		return getGenericGrid('Chat Messages', messages, 'message', null);
	}

	return (
		<div className={b()}>
			<div className={b('user')}>
				<Avatar target="_blank" user={userData} showEmail profile={userData.profile} />
				<UserActions updateUser={refetch} user={userData} />
			</div>

			<div className={b('sections')}>
				<UserSummary summary={userData.summary} />
				<div className={b('section')}>{getBans()}</div>
				<div className={b('section')}>{getReports()}</div>
				<div className={b('section')}>{getChatMessage()}</div>
				<div className={b('section')}>{getSettings()}</div>
			</div>
		</div>
	);
}
