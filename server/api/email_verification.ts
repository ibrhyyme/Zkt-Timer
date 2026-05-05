import GraphQLError from '../util/graphql_error';
import {getUserByEmail, getUserById, sanitizeUser} from '../models/user_account';
import {updateUserAccountWithParams} from '../models/user_account';
import {createEmailVerification, getEmailVerification, claimEmailVerification} from '../models/email_verification';
import {sendEmailWithTemplate} from '../services/ses';
import {getJwtString, setSessionCookie} from '../util/auth';
import {checkLoggedIn} from '../util/auth';
import {ErrorCode} from '../constants/errors';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getEmailStrings, buildVerificationEmailData} from '../util/email_translations';
import {notifyAdminsOfNewUser} from '../services/admin_notification';
import {checkRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';
import {logger} from '../services/logger';
import {getPrisma} from '../database';

export const gqlMutation = `
	resendEmailVerificationCode(email: String!, language: String): Void
	verifyEmailCode(email: String!, code: String!, language: String): PublicUserAccount
	confirmEmailChange(code: String!): PublicUserAccount
`;

function verificationLessThan30Min(ev) {
	const createdAt = new Date(ev.created_at);
	const THIRTY_MIN = 30 * 60 * 1000;

	return new Date().getTime() - createdAt.getTime() < THIRTY_MIN;
}

export const mutateActions = {
	resendEmailVerificationCode: async (_: any, {email, language}: {email: string; language?: string}, {req}: GraphQLContext) => {
		const ip = extractIp(req);
		const emailKey = (email || '').toLowerCase();

		const perEmail = await checkRateLimit(`resend_ev:email:${emailKey}`, 5, 3600);
		if (!perEmail.allowed) {
			logger.warn('Resend EV rate limit (email)', {email: emailKey, count: perEmail.count});
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla dogrulama kodu istegi. Lutfen bir sure sonra tekrar deneyin.');
		}
		if (ip) {
			const perIp = await checkRateLimit(`resend_ev:ip:${ip}`, 10, 3600);
			if (!perIp.allowed) {
				logger.warn('Resend EV rate limit (ip)', {ip, count: perIp.count});
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla dogrulama kodu istegi. Lutfen bir sure sonra tekrar deneyin.');
			}
		}

		const user = await getUserByEmail(email);

		if (user && !user.email_verified) {
			const ev = await createEmailVerification(user);
			const emailStrings = getEmailStrings(language);

			sendEmailWithTemplate(user, emailStrings.verification_subject, 'email_verification',
				buildVerificationEmailData(user, ev.code, language));
		}
	},

	verifyEmailCode: async (_: any, {email, code, language}: {email: string; code: string; language?: string}, {req, res}: GraphQLContext) => {
		const user = await getUserByEmail(email);

		if (!user) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Geçersiz kod');
		}

		if (user.email_verified) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu hesap zaten doğrulanmış');
		}

		const ev = (await getEmailVerification(user))[0];
		if (!ev) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Geçersiz kod');
		}

		const valid = ev.code === code && !ev.claimed && verificationLessThan30Min(ev);
		if (!valid) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Geçersiz veya süresi dolmuş kod');
		}

		await claimEmailVerification(ev);
		await updateUserAccountWithParams(user.id, {email_verified: true});

		notifyAdminsOfNewUser(user, 'local').catch(err =>
			console.error('[AdminNotification] Local signup notification failed:', err)
		);

		const jwt = getJwtString(user);
		setSessionCookie(req, res, jwt);

		return sanitizeUser(user);
	},

	confirmEmailChange: async (_: any, {code}: {code: string}, {user}: GraphQLContext) => {
		checkLoggedIn(user);

		const fresh = await getUserById(user.id);
		if (!fresh) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Kullanici bulunamadi');
		}
		if (!fresh.pending_email) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bekleyen e-posta degisikligi yok');
		}

		const ev = (await getEmailVerification(fresh as any))[0];
		if (!ev) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Geçersiz kod');
		}

		const valid = ev.code === code && !ev.claimed && verificationLessThan30Min(ev);
		if (!valid) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Geçersiz veya süresi dolmuş kod');
		}

		// Race koruma: ayni email'i bu sirada baska biri kullanmaya baslamis olabilir
		// (kendi satirimiz pending_email'da match yapar — getUserByEmail sadece email kolonuna bakar)
		const claimedByOther = await getUserByEmail(fresh.pending_email);
		if (claimedByOther && claimedByOther.id !== fresh.id) {
			await updateUserAccountWithParams(fresh.id, {pending_email: null});
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu e-posta artik kullanilmiyor. Lutfen farkli bir adres deneyin.');
		}

		const prisma = getPrisma();
		const [updated] = await prisma.$transaction([
			prisma.userAccount.update({
				where: {id: fresh.id},
				data: {
					email: fresh.pending_email,
					pending_email: null,
					email_verified: true,
				},
			}),
			prisma.emailVerification.update({
				where: {id: ev.id},
				data: {claimed: true},
			}),
		]);

		return sanitizeUser(updated as any);
	},
};
