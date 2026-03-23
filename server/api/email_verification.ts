import GraphQLError from '../util/graphql_error';
import {getUserByEmail, sanitizeUser} from '../models/user_account';
import {updateUserAccountWithParams} from '../models/user_account';
import {createEmailVerification, getEmailVerification, claimEmailVerification} from '../models/email_verification';
import {sendEmailWithTemplate} from '../services/ses';
import {getJwtString} from '../util/auth';
import {ErrorCode} from '../constants/errors';
import {GraphQLContext} from '../@types/interfaces/server.interface';

export const gqlMutation = `
	resendEmailVerificationCode(email: String!): Void
	verifyEmailCode(email: String!, code: String!): PublicUserAccount
`;

function verificationLessThan30Min(ev) {
	const createdAt = new Date(ev.created_at);
	const THIRTY_MIN = 30 * 60 * 1000;

	return new Date().getTime() - createdAt.getTime() < THIRTY_MIN;
}

export const mutateActions = {
	resendEmailVerificationCode: async (_: any, {email}: {email: string}) => {
		const user = await getUserByEmail(email);

		if (user && !user.email_verified) {
			const ev = await createEmailVerification(user);

			sendEmailWithTemplate(user, 'Zkt-Timer E-posta Doğrulama', 'email_verification', {
				code: ev.code,
				message: 'Hesabınızı doğrulamak için lütfen aşağıdaki kodu kullanın:',
			});
		}
	},

	verifyEmailCode: async (_: any, {email, code}: {email: string; code: string}, {res}: GraphQLContext) => {
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
		try {
			await sendEmailWithTemplate(user, "Zkt-Timer'a Hoş Geldin! 🎉", 'welcome', {});
		} catch (error) {
			console.error('Welcome email could not be sent:', error);
		}

		const jwt = getJwtString(user);
		res.cookie('session', jwt, {maxAge: 2147483647, httpOnly: true});

		return sanitizeUser(user);
	},
};
