import uniqid from 'uniqid';
import {getPrisma} from '../database';
import {UserAccount} from '../schemas/UserAccount.schema';

// Client'taki i18n key 'sessions.new_session' ile birebir esit kalmali.
const DEFAULT_SESSION_NAME: Record<string, string> = {
	tr: 'Yeni Sezon',
	en: 'New Session',
	es: 'Nueva sesión',
	ru: 'Новая сессия',
	zh: '新建阶段',
};

export function getDefaultSessionName(locale?: string | null): string {
	if (!locale) return DEFAULT_SESSION_NAME.en;
	return DEFAULT_SESSION_NAME[locale] || DEFAULT_SESSION_NAME.en;
}

export function createDefaultSession(user: UserAccount, locale?: string | null) {
	return getPrisma().session.create({
		data: {
			id: uniqid('se-'),
			name: getDefaultSessionName(locale),
			order: 0,
			user_id: user.id,
		},
	});
}

export function countSessionsForUser(userId: string) {
	return getPrisma().session.count({
		where: {user_id: userId},
	});
}
