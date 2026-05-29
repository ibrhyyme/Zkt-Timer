import GraphQLError from '../util/graphql_error';
import {
	createUserAccount,
	deleteUserAccount,
	getUserByEmail,
	getUserByIdWithProfile,
	getUserByUsername,
	isEmailReserved,
	refreshUnverifiedAccount,
	sanitizeUser,
	updateUserAccountWithParams,
	updateUserAccountPassword,
} from '../models/user_account';
import { extractIp } from '../util/request';
import { sendEmailWithTemplate } from '../services/ses';
import { createSetting } from '../models/settings';
import { createDefaultSession } from '../models/session';
import { checkLoggedIn } from '../util/auth';
import { checkPassword, hashPassword } from '../util/password';
import { createNotificationPreference } from '../models/notification_preference';
import { createEmailVerification } from '../models/email_verification';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { ErrorCode } from '../constants/errors';
import { getEmailStrings, buildVerificationEmailData, buildEmailChangeWarningData } from '../util/email_translations';
import { validateEmailMx } from '../util/email_validation';
import { validateName } from '../util/name_validation';
import { checkRateLimit } from '../services/rate_limit';
import { logger } from '../services/logger';
import { notifyAdminsOfNewUser } from '../services/admin_notification';

export const gqlQuery = `
	me: UserAccount!
`;

export const gqlMutation = `
	createUserAccount(first_name: String!, last_name: String!, email: String!, username: String!, password: String!, language: String, turnstile_token: String!): PublicUserAccount
	updateUserAccount(first_name: String!, last_name: String!, email: String!, username: String!, language: String): PublicUserAccount
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
		{ first_name, last_name, email, username, password, language, turnstile_token }: CreateAccountInput & { turnstile_token: string },
		{ req, res }: GraphQLContext
	) => {
		const ip = extractIp(req);

		if (process.env.NODE_ENV === 'production' && turnstile_token !== 'NATIVE_APP') {
			try {
				const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						secret: process.env.CLOUDFLARE_TURNSTILE_SECRET,
						response: turnstile_token,
						remoteip: ip,
					}),
				});
				const verifyData = await verifyRes.json() as { success: boolean };
				if (!verifyData.success) {
					throw new GraphQLError(ErrorCode.BAD_INPUT, 'Güvenlik doğrulaması başarısız. Lütfen sayfayı yenileyip tekrar deneyin.');
				}
			} catch (e) {
				if (e instanceof GraphQLError) throw e;
				logger.error('Turnstile verification failed', { error: e });
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Güvenlik doğrulaması başarısız. Lütfen sayfayı yenileyip tekrar deneyin.');
			}
		}

		if (ip) {
			const hourly = await checkRateLimit(`signup:ip:${ip}`, 3, 3600);
			if (!hourly.allowed) {
				logger.warn('Signup rate limit exceeded', {ip, count: hourly.count, scope: 'hourly'});
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla kayit denemesi. Lutfen daha sonra tekrar deneyin.');
			}

			const daily = await checkRateLimit(`signup:ip:daily:${ip}`, 10, 86400);
			if (!daily.allowed) {
				logger.warn('Signup rate limit exceeded', {ip, count: daily.count, scope: 'daily'});
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla kayit denemesi. Lutfen daha sonra tekrar deneyin.');
			}
		}

		const firstNameError = validateName(first_name, 'Ad');
		if (firstNameError) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, firstNameError);
		}

		const lastNameError = validateName(last_name, 'Soyad');
		if (lastNameError) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, lastNameError);
		}

		const existingUser = await getUserByEmail(email);
		const isRefresh = existingUser && !existingUser.email_verified;

		if (existingUser && existingUser.email_verified) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'That email address is already in use');
		}

		// If NOT a refresh state, check pending_email — another user may be
		// waiting for this email change; if we allow signup, confirmEmailChange will have
		// an email @unique violation.
		if (!existingUser) {
			const reservedAsPending = await isEmailReserved(email);
			if (reservedAsPending) {
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

		// Username check — in refresh state, don't count our own row
		const usernameOwners = await getUserByUsername(username);
		const conflict = usernameOwners?.find((u: any) => !existingUser || u.id !== existingUser.id);
		if (conflict) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'That username is already in use');
		}

		let user;
		if (isRefresh) {
			// Instead of deleting and recreating an existing unverified account, UPDATE it.
			// An attacker was deleting the victim's registration (DoS); now the same row is refreshed.
			user = await refreshUnverifiedAccount(
				existingUser.id, first_name.trim(), last_name.trim(), username, password, ip
			);
		} else {
			user = await createUserAccount(first_name.trim(), last_name.trim(), email, username, password, ip);
			await createSetting(user, language || 'en');
			await createNotificationPreference(user);
			await createDefaultSession(user, language || 'en');
		}

		// Create verification code and send email
		const ev = await createEmailVerification(user);
		const emailStrings = getEmailStrings(language);
		sendEmailWithTemplate(user, emailStrings.verification_subject, 'email_verification',
			buildVerificationEmailData(user, ev.code, language)
		).catch(error => {
			console.error('Verification email could not be sent:', error);
		});

		notifyAdminsOfNewUser(user as any, 'local', true).catch(err =>
			console.error('[AdminNotification] Pending signup notification failed:', err)
		);

		return sanitizeUser(user);
	},

	updateUserAccount: async (
		_: any,
		{ first_name, last_name, email, username, language }: CreateAccountInput,
		{ user }: GraphQLContext
	) => {
		checkLoggedIn(user);

		if (!first_name || !last_name || !email || !username) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Please fill out all of the required fields');
		}

		const firstNameError = validateName(first_name, 'Ad');
		if (firstNameError) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, firstNameError);
		}

		const lastNameError = validateName(last_name, 'Soyad');
		if (lastNameError) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, lastNameError);
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

		// Username change: 30 day cooldown — impersonation/scam protection
		const usernameChanged = username !== user.username;
		const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
		if (usernameChanged) {
			const newUsername = await getUserByUsername(username);
			if (newUsername && newUsername.length) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'That username is already in use');
			}
			const lastChange = (user as any).username_changed_at;
			if (lastChange) {
				const elapsed = Date.now() - new Date(lastChange).getTime();
				if (elapsed < USERNAME_CHANGE_COOLDOWN_MS) {
					const daysLeft = Math.ceil((USERNAME_CHANGE_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
					throw new GraphQLError(ErrorCode.BAD_INPUT, `Kullanici adini cok sik degistiremezsin. ${daysLeft} gun sonra tekrar deneyin.`);
				}
			}
		}

		const emailLower = email.toLowerCase();
		const emailChanged = emailLower !== user.email.toLowerCase();
		let pendingEmailUpdate: string | null | undefined = undefined;

		if (emailChanged) {
			// Is the new email reserved by another user (either email or pending_email)?
			const taken = await isEmailReserved(emailLower);
			if (taken) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'That email address is already in use');
			}
			pendingEmailUpdate = emailLower;
		}

		// Update fields other than email immediately. Email change goes through verification flow.
		const updated = await updateUserAccountWithParams(user.id, {
			first_name: first_name.trim(),
			last_name: last_name.trim(),
			username,
			...(usernameChanged ? {username_changed_at: new Date()} : {}),
			...(pendingEmailUpdate !== undefined ? {pending_email: pendingEmailUpdate} : {}),
		});

		if (emailChanged && pendingEmailUpdate) {
			// Send verification code to new email (existing EV pattern — confirmEmailChange consumes it)
			const ev = await createEmailVerification(updated as any);
			const emailStrings = getEmailStrings(language);

			const newEmailRecipient = {email: pendingEmailUpdate, first_name: updated.first_name};
			sendEmailWithTemplate(newEmailRecipient as any, emailStrings.email_change_subject, 'email_verification',
				buildVerificationEmailData(newEmailRecipient as any, ev.code, language)
			).catch(error => {
				console.error('Email change verification could not be sent:', error);
			});

			// Send notification warning to old email
			const oldEmailRecipient = {email: user.email, first_name: updated.first_name};
			sendEmailWithTemplate(oldEmailRecipient as any, emailStrings.email_change_warning_subject, 'email_change_request',
				buildEmailChangeWarningData(oldEmailRecipient as any, pendingEmailUpdate, language)
			).catch(error => {
				console.error('Email change warning could not be sent:', error);
			});
		}

		return updated;
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
