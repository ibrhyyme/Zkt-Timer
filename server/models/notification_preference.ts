import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {UserAccount} from '../schemas/UserAccount.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

const GDPR_COUNTRY_CODES = [
	'AT',
	'BE',
	'BG',
	'CY',
	'CH',
	'CZ',
	'DE',
	'DK',
	'EE',
	'ES',
	'FI',
	'FR',
	'GB',
	'GR',
	'HR',
	'HU',
	'IE',
	'IS',
	'IT',
	'LI',
	'LT',
	'LU',
	'LV',
	'MT',
	'NL',
	'NO',
	'PL',
	'PT',
	'RO',
	'SE',
	'SI',
	'SK',
];

export async function getOrCreateNotificationPreferences(user: UserAccount) {
	const prefs = await getNotificationPreferences(user);
	if (!prefs) {
		return createNotificationPreference(user);
	}

	return prefs;
}

export async function getNotificationPreferences(user: UserAccount) {
	return await getPrisma().notificationPreference.findUnique({
		where: {
			user_id: user.id,
		},
	});
}

export async function createNotificationPreference(user: UserAccount) {
	const id = uuid();

	let emailMarketing = true;
	const ct = user.join_country;
	if (!ct || ct === 'NONE' || GDPR_COUNTRY_CODES.includes(ct)) {
		emailMarketing = false;
	}

	return await getPrisma().notificationPreference.create({
		data: {
			id,
			user_id: user.id,
			marketing_emails: emailMarketing,
		},
	});
}

// Only user-toggleable boolean preference columns. The key is client-supplied, so it must
// be whitelisted before reaching the Prisma `data` object (don't pass arbitrary input through).
const ALLOWED_PREFERENCE_KEYS = [
	'marketing_emails',
	'membership_granted',
	'support_ticket_reply',
	'zkt_competition_announced',
	'competition_groups_published',
	'competition_schedule_changed',
	'competition_results_official',
	'battle_challenge',
];

export type PushPreferenceKey =
	| 'zkt_competition_announced'
	| 'competition_groups_published'
	| 'competition_schedule_changed'
	| 'competition_results_official'
	| 'battle_challenge';

/**
 * Of these users, who switched `key` off. One query for a whole batch, and it
 * never creates rows: a user without a preference row has never opted out.
 */
export async function getUserIdsWithPrefDisabled(userIds: string[], key: PushPreferenceKey): Promise<Set<string>> {
	if (userIds.length === 0) return new Set();
	const rows = await getPrisma().notificationPreference.findMany({
		where: {user_id: {in: userIds}, [key]: false},
		select: {user_id: true},
	});
	return new Set(rows.map((r) => r.user_id));
}

export async function setNotificationPreference(user: UserAccount, key: string, value: boolean) {
	if (!ALLOWED_PREFERENCE_KEYS.includes(key)) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid notification preference');
	}

	const np = await getOrCreateNotificationPreferences(user);

	return await getPrisma().notificationPreference.update({
		where: {
			id: np.id,
		},
		data: {
			[key]: value,
		},
	});
}
