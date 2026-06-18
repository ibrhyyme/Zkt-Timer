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
	WCA_FOLLOW_RESULT_ENTERED = 'wca_follow_result_entered',
	WCA_FOLLOW_ROUND_FINISHED = 'wca_follow_round_finished',
	WCA_FOLLOW_COUNTDOWN = 'wca_follow_countdown',
	ZKT_REGISTRATION_STATUS = 'zkt_registration_status',
	ZKT_ROUND_FINISHED = 'zkt_round_finished',
	ZKT_FOLLOW_ROUND_FINISHED = 'zkt_follow_round_finished',
}

export enum MetricLogType {
	DELETE_USER_ACCOUNT = 'DELETE_USER_ACCOUNT'
}
