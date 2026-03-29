import GraphQLError from '../util/graphql_error';
import {
	createUserAccount,
	deleteUserAccount,
	getUserByEmail,
	getUserByIdWithProfile,
	getUserByUsername,
	sanitizeUser,
	updateUserAccount,
	updateUserAccountPassword,
} from '../models/user_account';
import { sendEmailWithTemplate } from '../services/ses';
import { createSetting } from '../models/settings';
import { checkLoggedIn } from '../util/auth';
import { checkPassword, hashPassword } from '../util/password';
import { createNotificationPreference } from '../models/notification_preference';
import { createEmailVerification } from '../models/email_verification';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { ErrorCode } from '../constants/errors';
import { getPrisma } from '../database';
import { getEmailStrings } from '../util/email_translations';
import { validateEmailMx } from '../util/email_validation';

export const gqlQuery = `
	me: UserAccount!
`;

export const gqlMutation = `
	createUserAccount(first_name: String!, last_name: String!, email: String!, username: String!, password: String!, language: String): PublicUserAccount
	updateUserAccount(first_name: String!, last_name: String!, email: String!, username: String!): PublicUserAccount
	updateUserPassword(old_password: String!, new_password: String!): PublicUserAccount
	setUserPassword(new_password: String!): PublicUserAccount
	deleteUserAccount: PublicUserAccount
`;

export const queryActions = {
	me: async (a: any, b: any, { user }: GraphQLContext) => {
		const fullUser = await getUserByIdWithProfile(user.id);
		return sanitizeUser(fullUser);
	},
};

type CreateAccountInput = {
	first_name: string;
	last_name: string;
	email: string;
	username: string;
	password: string;
	language?: string;
};

type UpdatePasswordInput = {
	old_password: string;
	new_password: string;
};

export const mutateActions = {
	createUserAccount: async (
		_: any,
		{ first_name, last_name, email, username, password, language }: CreateAccountInput,
		{ req, res }: GraphQLContext
	) => {
		let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

		const existingUser = await getUserByEmail(email);
		if (existingUser) {
			if (!existingUser.email_verified) {
				// Dogrulanmamis hesabi sil, yeni kayda izin ver
				await getPrisma().userAccount.delete({where: {id: existingUser.id}});
			} else {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'That email address is already in use');
			}
		}

		const hasMx = await validateEmailMx(email);
		if (!hasMx) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'This email domain does not appear to accept emails. Please check your email address.');
		}

		if (username.length < 2) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Username must be at least 3 characters long');
		}

		if (username.length > 18) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Username cannot be longer than 15 characters');
		}

		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Username can only contain letters, numbers, and underscores');
		}

		const newUsername = await getUserByUsername(username);
		if (newUsername && newUsername.length) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'That username is already in use');
		}

		if (Array.isArray(ip)) {
			ip = ip[0];
		} else if (ip.indexOf(',') > -1) {
			ip = ip.split(',')[0];
		}

		const user = await createUserAccount(first_name, last_name, email, username, password, ip);
		await createSetting(user);
		await createNotificationPreference(user);

		// Dogrulama kodu olustur ve mail gonder
		const ev = await createEmailVerification(user);
		const emailStrings = getEmailStrings(language);
		sendEmailWithTemplate(user, emailStrings.verification_subject, 'email_verification', {
			code: ev.code,
			message: emailStrings.verification_message,
			greeting: emailStrings.greeting,
			code_expiry: emailStrings.code_expiry,
			closing: emailStrings.closing,
			team: emailStrings.team,
		}).catch(error => {
			console.error('Verification email could not be sent:', error);
		});

		return sanitizeUser(user);
	},

	updateUserAccount: async (
		_: any,
		{ first_name, last_name, email, username }: CreateAccountInput,
		{ user }: GraphQLContext
	) => {
		checkLoggedIn(user);

		if (!first_name || !last_name || !email || !username) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Please fill out all of the required fields');
		}

		if (email !== user.email) {
			const newEmail = await getUserByEmail(email);
			if (newEmail) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'That email address is already in use');
			}
		}

		if (username.length < 2) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Username must be at least 3 characters long');
		}

		if (username.length > 18) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Username cannot be longer than 15 characters');
		}

		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Username can only contain letters, numbers, and underscores');
		}

		if (username !== user.username) {
			const newUsername = await getUserByUsername(username);
			if (newUsername && newUsername.length) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'That username is already in use');
			}
		}

		return await updateUserAccount(user.id, first_name, last_name, email, username);
	},

	updateUserPassword: async (_: any, { old_password, new_password }: UpdatePasswordInput, { user }: GraphQLContext) => {
		checkLoggedIn(user);

		const goodPass = await checkPassword(old_password, user.password);
		if (!goodPass) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Incorrect old password');
		}

		return await updateUserAccountPassword(user.id, new_password);
	},

	setUserPassword: async (_: any, { new_password }: { new_password: string }, { user }: GraphQLContext) => {
		checkLoggedIn(user);

		if (user.password) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Zaten bir sifreniz var. Sifre degistir bolumunu kullanin.');
		}

		if (!new_password || new_password.length < 8) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Sifre en az 8 karakter olmalidir');
		}

		return await updateUserAccountPassword(user.id, new_password);
	},

	deleteUserAccount: async (_: any, params: any, { user }: GraphQLContext) => {
		checkLoggedIn(user);

		try {
			return await deleteUserAccount(user);
		} catch (e) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Something went wrong on our side');
		}
	},
};
