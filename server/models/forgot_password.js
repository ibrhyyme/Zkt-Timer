import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {generateRandomNumericCode} from '../../shared/code';

// See MAX_CODE_ATTEMPTS in models/email_verification — same reasoning, and this
// path resets a password, so the burn matters more here.
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_WRONG_CODES_PER_DAY = 30;
export const WRONG_CODE_WINDOW_SECONDS = 24 * 60 * 60;

export function getForgotPassword(user) {
	return getPrisma().forgotPassword.findMany({
		where: {
			user_id: user.id,
		},
		orderBy: {
			created_at: 'desc',
		},
		take: 1,
	});
}

export function createForgotPassword(user) {
	return getPrisma().forgotPassword.create({
		data: {
			id: uuid(),
			user_id: user.id,
			code: generateRandomNumericCode(6),
		},
	});
}

// How long a sent code keeps being re-sent instead of replaced. Codes live for 15
// minutes, so re-sending one younger than this still leaves the user at least 10.
export const REUSE_CODE_WINDOW_MS = 5 * 60 * 1000;

export function canReuseForgotPassword(forgotPassword, now = Date.now()) {
	if (!forgotPassword || forgotPassword.claimed) return false;
	return now - new Date(forgotPassword.created_at).getTime() < REUSE_CODE_WINDOW_MS;
}

/**
 * Only the newest code is accepted, so replacing it on every request made the
 * code in an earlier mail fail. See getOrCreateEmailVerification. A used or
 * burned code is never reused.
 */
export async function getOrCreateForgotPassword(user) {
	const [latest] = await getForgotPassword(user);
	return canReuseForgotPassword(latest) ? latest : createForgotPassword(user);
}

export function registerFailedForgotPasswordAttempt(forgotPassword) {
	const attempts = (forgotPassword.attempts || 0) + 1;
	const data = {attempts};

	if (attempts >= MAX_CODE_ATTEMPTS) {
		data.claimed = true;
	}

	return getPrisma().forgotPassword.update({
		where: {
			id: forgotPassword.id,
		},
		data,
	});
}

export function claimForgotPassword(forgotPassword) {
	return getPrisma().forgotPassword.update({
		where: {
			id: forgotPassword.id,
		},
		data: {
			claimed: true,
		},
	});
}
