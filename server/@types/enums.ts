export enum NotificationType {
	NEW_USER_SIGNUP = 'new_user_signup',
	MEMBERSHIP_GRANTED = 'membership_granted',
	ADMIN_PRO_PURCHASE = 'admin_pro_purchase',
	ADMIN_PRO_CANCELLATION = 'admin_pro_cancellation',
	ADMIN_SUPPORT_TICKET = 'admin_support_ticket',
	SUPPORT_TICKET_REPLY = 'support_ticket_reply',
	ADMIN_SUPPORT_TICKET_REPLY = 'admin_support_ticket_reply',
	WCA_RESULT_ENTERED = 'wca_result_entered',
	WCA_ROUND_FINISHED = 'wca_round_finished',
	WCA_COMPETITION_COUNTDOWN = 'wca_competition_countdown',
	WCA_RECORD_BROKEN = 'wca_record_broken',
	ZKT_RECORD_BROKEN = 'zkt_record_broken',
	WCA_FOLLOW_RESULT_ENTERED = 'wca_follow_result_entered',
	WCA_FOLLOW_ROUND_FINISHED = 'wca_follow_round_finished',
	WCA_FOLLOW_COUNTDOWN = 'wca_follow_countdown',
	// Competition lifecycle. Each value is also a NotificationPreference column,
	// so a user can switch the push off per type.
	ZKT_COMPETITION_ANNOUNCED = 'zkt_competition_announced',
	COMPETITION_GROUPS_PUBLISHED = 'competition_groups_published',
	COMPETITION_SCHEDULE_CHANGED = 'competition_schedule_changed',
	COMPETITION_RESULTS_OFFICIAL = 'competition_results_official',
}

export enum MetricLogType {
	DELETE_USER_ACCOUNT = 'DELETE_USER_ACCOUNT'
}
