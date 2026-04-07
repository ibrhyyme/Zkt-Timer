import { gql } from '@apollo/client';

export const MICRO_SOLVE_FRAGMENT = gql`
	fragment MicroSolveFragment on Solve {
		id
		time
		raw_time
		cube_type
		session_id
		trainer_name
		bulk
		from_timer
		training_session_id
		dnf
		plus_two
		scramble
		is_smart_cube
		created_at
		started_at
		ended_at
	}
`;

export const MINI_SOLVE_FRAGMENT = gql`
	fragment MiniSolveFragment on Solve {
		id
		time
		raw_time
		cube_type
		session_id
		trainer_name
		bulk
		scramble
		from_timer
		training_session_id
		dnf
		plus_two
		is_smart_cube
		created_at
		started_at
		ended_at
	}
`;

export const STATS_FRAGMENT = gql`
	fragment StatsFragment on Stats {
		profile_views
		solve_views
	}
`;

export const STATS_MODULE_BLOCK_FRAGMENT = gql`
	fragment StatsModuleBlockFragment on StatsModuleBlock {
		statType
		sortBy
		session
		colorName
		averageCount
	}
`;


export const SESSION_FRAGMENT = gql`
	fragment SessionFragment on Session {
		id
		name
		created_at
		order
	}
`;

export const SOLVE_FRAGMENT = gql`
	fragment SolveFragment on Solve {
		id
		time
		raw_time
		cube_type
		user_id
		scramble
		session_id
		started_at
		ended_at
		dnf
		plus_two
		notes
		created_at
		is_smart_cube
		smart_turn_count
		share_code
		smart_turns
		smart_pick_up_time
		smart_put_down_time
		inspection_time
		smart_device {
			id
			name
			internal_name
			device_id
			created_at
		}
		solve_method_steps {
			id
			turn_count
			turns
			total_time
			tps
			recognition_time
			oll_case_key
			pll_case_key
			skipped
			parent_name
			method_name
			step_index
			step_name
			created_at
		}
	}
`;

export const CUSTOM_CUBE_TYPE_FRAGMENT = gql`
	fragment CustomCubeTypeFragment on CustomCubeType {
		id
		user_id
		name
		created_at
		scramble
		private
	}
`;

export const SETTING_FRAGMENT = gql`
	${CUSTOM_CUBE_TYPE_FRAGMENT}

	fragment SettingsFragment on Setting {
		id
		user_id
		focus_mode
		freeze_time
		inspection
		manual_entry
		inspection_delay
		session_id
		inverse_time_list
		hide_time_when_solving
		nav_collapsed
		timer_decimal_points
		pb_confetti
		play_inspection_sound
		zero_out_time_after_solve
		confirm_delete_solve
		use_space_with_smart_cube
		use_2d_scramble_visual
		require_period_in_manual_time_entry
		cube_type
		custom_cube_types {
			...CustomCubeTypeFragment
		}
	}
`;

export const IMAGE_FRAGMENT = gql`
	fragment ImageFragment on Image {
		id
		user_id
		storage_path
	}
`;

export const PUBLIC_USER_FRAGMENT = gql`
	${IMAGE_FRAGMENT}

	fragment PublicUserFragment on PublicUserAccount {
		id
		username
		verified
		created_at
		banned_forever
		is_pro
		banned_until
		admin
		mod
		integrations {
			id
			service_name
		}
		profile {
			pfp_image {
				...ImageFragment
			}
		}
	}
`;

export const PUBLIC_USER_WITH_ELO_FRAGMENT = gql`
	${PUBLIC_USER_FRAGMENT}

	fragment PublicUserWithEloFragment on PublicUserAccount {
		...PublicUserFragment
	}
`;

export const SOLVE_WITH_USER_FRAGMENT = gql`
	${SOLVE_FRAGMENT}
	${PUBLIC_USER_WITH_ELO_FRAGMENT}

	fragment SolveWithUserFragment on Solve {
		...SolveFragment
		user {
			...PublicUserWithEloFragment
		}
	}
`;

export const NOTIFICATION_PREFERENCE_FRAGMENT = gql`
	fragment NotificationPreferenceFragment on NotificationPreference {
		marketing_emails
	}
`;

export const NOTIFICATION_FRAGMENT = gql`
	${PUBLIC_USER_WITH_ELO_FRAGMENT}

	fragment NotificationFragment on Notification {
		id
		user_id
		notification_type
		notification_category_name
		triggering_user_id
		in_app_message
		read_at
		message
		icon
		link
		link_text
		subject
		created_at
		triggering_user {
			...PublicUserWithEloFragment
		}
	}
`;

export const TOP_SOLVE_FRAGMENT = gql`
	${SOLVE_FRAGMENT}
	${PUBLIC_USER_WITH_ELO_FRAGMENT}

	fragment TopSolveFragment on TopSolve {
		id
		time
		cube_type
		created_at
		solve {
			...SolveFragment
		}
		user {
			...PublicUserWithEloFragment
		}
	}
`;

export const TOP_AVERAGE_FRAGMENT = gql`
	${SOLVE_FRAGMENT}
	${PUBLIC_USER_WITH_ELO_FRAGMENT}

	fragment TopAverageFragment on TopAverage {
		id
		time
		cube_type
		created_at
		solve_1 {
			...SolveFragment
		}
		solve_2 {
			...SolveFragment
		}
		solve_3 {
			...SolveFragment
		}
		solve_4 {
			...SolveFragment
		}
		solve_5 {
			...SolveFragment
		}
		user {
			...PublicUserWithEloFragment
		}
	}
`;

export const PROFILE_FRAGMENT = gql`
	${PUBLIC_USER_WITH_ELO_FRAGMENT}
	${TOP_SOLVE_FRAGMENT}
	${TOP_AVERAGE_FRAGMENT}
	${IMAGE_FRAGMENT}

	fragment ProfileFragment on Profile {
		id
		bio
		three_method
		three_goal
		main_three_cube
		favorite_event
		youtube_link
		twitter_link
		user_id
		reddit_link
		twitch_link
		user {
			...PublicUserWithEloFragment
		}
		top_solves {
			...TopSolveFragment
		}
		top_averages {
			...TopAverageFragment
		}
		header_image {
			...ImageFragment
		}
		pfp_image {
			...ImageFragment
		}
	}
`;

export const REPORT_FRAGMENT = gql`
	${PUBLIC_USER_WITH_ELO_FRAGMENT}

	fragment ReportFragment on Report {
		id
		reported_user_id
		created_by_id
		reason
		resolved_at
		created_at
		created_by {
			...PublicUserWithEloFragment
		}
		reported_user {
			...PublicUserWithEloFragment
		}
	}
`;

export const INTEGRATION_FRAGMENT = gql`
	fragment IntegrationFragment on Integration {
		id
		auth_expires_at
		service_name
		created_at
	}
`;

export const TIMER_BACKGROUND_FRAGMENT = gql`
	fragment TimerBackgroundFragment on TimerBackground {
		created_at
		hex
		storage_path
		id
		url
	}
`;

export const USER_FOR_ME_FRAGMENT = gql`
	${PUBLIC_USER_WITH_ELO_FRAGMENT}
	${TIMER_BACKGROUND_FRAGMENT}

	fragment UserForMeFragment on UserAccount {
		email
		join_country
		timer_background {
			...TimerBackgroundFragment
		}

		...PublicUserWithEloFragment
	}
`;

export const USER_ACCOUNT_SOLVES_SUMMARY_FRAGMENT = gql`
	fragment UserAccountSolvesSummaryFragment on UserAccountSolvesSummary {
		count
		average
		min_time
		max_time
		sum
		cube_type
	}
`;

export const USER_ACCOUNT_SUMMARY_FRAGMENT = gql`
	${USER_ACCOUNT_SOLVES_SUMMARY_FRAGMENT}

	fragment UserAccountSummaryFragment on UserAccountSummary {
		solves
		reports_for
		reports_created
		profile_views
		bans
		timer_solves {
			...UserAccountSolvesSummaryFragment
		}
	}
`;

export const USER_FOR_ADMIN_FRAGMENT = gql`
	${NOTIFICATION_PREFERENCE_FRAGMENT}
	${PUBLIC_USER_WITH_ELO_FRAGMENT}
	${REPORT_FRAGMENT}
	${SETTING_FRAGMENT}
	${USER_ACCOUNT_SUMMARY_FRAGMENT}

	fragment UserForAdminFragment on UserAccountForAdmin {
		...PublicUserWithEloFragment

		email
		join_country
		join_ip
		reports_for {
			...ReportFragment
		}
		settings {
			...SettingsFragment
		}
		notification_preferences {
			...NotificationPreferenceFragment
		}
		summary {
			...UserAccountSummaryFragment
		}
	}
`;

export const REPORT_SUMMARY_FRAGMENT = gql`
	${PUBLIC_USER_WITH_ELO_FRAGMENT}
	${REPORT_FRAGMENT}

	fragment ReportSummaryFragment on ReportSummary {
		last_report
		first_report
		count
		user {
			...PublicUserWithEloFragment
		}
		reports {
			...ReportFragment
		}
	}
`;
