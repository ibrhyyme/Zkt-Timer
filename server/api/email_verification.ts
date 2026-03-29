import GraphQLError from '../util/graphql_error';
import {getUserByEmail, sanitizeUser} from '../models/user_account';
import {updateUserAccountWithParams} from '../models/user_account';
import {createEmailVerification, getEmailVerification, claimEmailVerification} from '../models/email_verification';
import {sendEmailWithTemplate} from '../services/ses';
import {getJwtString} from '../util/auth';
import {ErrorCode} from '../constants/errors';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getEmailStrings, getWelcomeTemplateName} from '../util/email_translations';
import {notifyAdminsOfNewUser} from '../services/admin_notification';

export const gqlMutation = `
	resendEmailVerificationCode(email: String!, language: String): Void
	verifyEmailCode(email: String!, code: String!, language: String): PublicUserAccount
`;

function verificationLessThan30Min(ev) {
	const createdAt = new Date(ev.created_at);
	const THIRTY_MIN = 30 * 60 * 1000;

	return new Date().getTime() - createdAt.getTime() < THIRTY_MIN;
}

export const mutateActions = {
	resendEmailVerificationCode: async (_: any, {email, language}: {email: string; language?: string}) => {
		const user = await getUserByEmail(email);

		if (user && !user.email_verified) {
			const ev = await createEmailVerification(user);
			const emailStrings = getEmailStrings(language);

			sendEmailWithTemplate(user, emailStrings.verification_subject, 'email_verification', {
				code: ev.code,
				message: emailStrings.verification_message,
				greeting: emailStrings.greeting,
				code_expiry: emailStrings.code_expiry,
				closing: emailStrings.closing,
				team: emailStrings.team,
			});
		}
	},

	verifyEmailCode: async (_: any, {email, code, language}: {email: string; code: string; language?: string}, {res}: GraphQLContext) => {
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

		// Hosgeldin mailini dogrulama sonrasi gonder
		const emailStrings = getEmailStrings(language);
		try {
			await sendEmailWithTemplate(user, emailStrings.welcome_subject, getWelcomeTemplateName(language), {});
		} catch (error) {
			console.error('Welcome email could not be sent:', error);
		}

		notifyAdminsOfNewUser(user, 'local').catch(err =>
			console.error('[AdminNotification] Local signup notification failed:', err)
		);

		const jwt = getJwtString(user);
		res.cookie('session', jwt, {maxAge: 2147483647, httpOnly: true});

		return sanitizeUser(user);
	},
};
