import {
	getUserByEmail,
	sanitizeUser,
	updateUserAccountPassword
} from '../models/user_account';
import { sendEmail, sendEmailWithTemplate } from '../services/ses';
import { claimForgotPassword, createForgotPassword, getForgotPassword } from '../models/forgot_password';
import GraphQLError from '../util/graphql_error';
import { getJwtString, setSessionCookie } from '../util/auth';
import { getEmailStrings, buildForgotEmailData } from '../util/email_translations';
import { checkRateLimit } from '../services/rate_limit';
import { extractIp } from '../util/request';
import { logger } from '../services/logger';

export const gqlMutation = `
	sendForgotPasswordCode(email: String, language: String): Void
	checkForgotPasswordCode(email: String, code: String): Boolean
	updateForgotPassword(email: String, code: String, password: String): PublicUserAccount
`;

function forgotPasswordLessThan15Min(fp) {
	const createdAt = new Date(fp.created_at);
	const FIFTEEN_MIN = 15 * 60 * 1000;

	return new Date() - createdAt < FIFTEEN_MIN;
}

export const mutateActions = {
	sendForgotPasswordCode: async (_, { email, language }, { req }) => {
		const ip = extractIp(req);
		const emailKey = (email || '').toLowerCase();

		const perEmail = await checkRateLimit(`forgot:email:${emailKey}`, 3, 3600);
		if (!perEmail.allowed) {
			logger.warn('Forgot password rate limit (email)', {email: emailKey, count: perEmail.count});
			throw new GraphQLError(400, 'Cok fazla istek. Lutfen bir sure sonra tekrar deneyin.');
		}
		if (ip) {
			const perIp = await checkRateLimit(`forgot:ip:${ip}`, 10, 3600);
			if (!perIp.allowed) {
				logger.warn('Forgot password rate limit (ip)', {ip, count: perIp.count});
				throw new GraphQLError(400, 'Cok fazla istek. Lutfen bir sure sonra tekrar deneyin.');
			}
		}

		const user = await getUserByEmail(email);

		// Unverified hesaplara forgot password kodu gondermiyoruz — silently OK donuyoruz
		// boylece email enumeration sizdirma yok
		if (user && user.email_verified) {
			const fp = await createForgotPassword(user);
			const emailStrings = getEmailStrings(language);

			sendEmailWithTemplate(user, emailStrings.forgot_subject, 'forgot_password',
				buildForgotEmailData(user, fp.code, language));
		}
	},
	checkForgotPasswordCode: async (_, { email, code }) => {
		const user = await getUserByEmail(email);

		if (!user) {
			return false;
		}

		const fp = (await getForgotPassword(user))[0];

		if (!fp) {
			return false;
		}

		return fp && fp.code === code && forgotPasswordLessThan15Min(fp);
	},
	updateForgotPassword: async (_, { email, code, password }, { req, res }) => {
		const user = await getUserByEmail(email);

		if (!user) {
			return false;
		}

		// Unverified hesaplar forgot password ile auth bypass yapamasin
		if (!user.email_verified) {
			throw new GraphQLError(400, 'Bu hesap henuz dogrulanmadi. Lutfen once e-posta dogrulamasini tamamlayin.');
		}

		// Sifre minimum uzunluk kontrolu (Phase 3.7)
		if (!password || password.length < 8) {
			throw new GraphQLError(400, 'Sifre en az 8 karakter olmali');
		}

		const fp = (await getForgotPassword(user))[0];
		if (!fp) {
			throw new GraphQLError(400, 'Invalid code');
		}

		const passed = fp && fp.code === code && forgotPasswordLessThan15Min(fp);
		if (!passed) {
			throw new GraphQLError(400, 'Invalid code');
		}

		await claimForgotPassword(fp);
		await updateUserAccountPassword(user.id, password);

		const jwt = getJwtString(user);
		setSessionCookie(req, res, jwt);

		return sanitizeUser(user);
	},
};
