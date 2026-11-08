import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {generateRandomNumericCode} from '../../shared/code';

// A 6 digit code is 1-in-a-million, so the code itself is burned after this many
// wrong guesses. Without it, the time-window rate limit alone lets a patient
// attacker keep guessing the same account forever.
export const MAX_CODE_ATTEMPTS = 5;

// Second layer: burning a code is cheap to work around by requesting a new one,
// so wrong guesses are also capped per account over a long window. This is what
// stops a slow attacker from grinding the 1M space over weeks.
export const MAX_WRONG_CODES_PER_DAY = 30;
export const WRONG_CODE_WINDOW_SECONDS = 24 * 60 * 60;

export function getEmailVerification(user) {
	return getPrisma().emailVerification.findMany({
		where: {
			user_id: user.id,
		},
		orderBy: {
			created_at: 'desc',
		},
		take: 1,
	});
}

export function createEmailVerification(user) {
	return getPrisma().emailVerification.create({
		data: {
			id: uuid(),
			user_id: user.id,
			code: generateRandomNumericCode(6),
		},
	});
}

// How long a sent code keeps being re-sent instead of replaced. Codes live for 30
// minutes, so re-sending one younger than this still leaves the user at least 15.
export const REUSE_CODE_WINDOW_MS = 15 * 60 * 1000;

export function canReuseEmailVerification(emailVerification, now = Date.now()) {
	if (!emailVerification || emailVerification.claimed) return false;
	return now - new Date(emailVerification.created_at).getTime() < REUSE_CODE_WINDOW_MS;
}

/**
 * The code to mail to a user who is waiting to verify. Only the newest code is
 * accepted, so replacing it on every "resend" made the code in the first mail
 * fail ("invalid or expired") and cost a wrong attempt for anyone who opened
 * that mail. Re-sending the same code makes every mail in the inbox work.
 * A burned code (claimed after MAX_CODE_ATTEMPTS) is never reused.
 */
export async function getOrCreateEmailVerification(user) {
	const [latest] = await getEmailVerification(user);
	return canReuseEmailVerification(latest) ? latest : createEmailVerification(user);
}

export function registerFailedEmailVerificationAttempt(emailVerification) {
	const attempts = (emailVerification.attempts || 0) + 1;
	const data = {attempts};

	if (attempts >= MAX_CODE_ATTEMPTS) {
		data.claimed = true;
	}

	return getPrisma().emailVerification.update({
		where: {
			id: emailVerification.id,
		},
		data,
	});
}

export function claimEmailVerification(emailVerification) {
	return getPrisma().emailVerification.update({
		where: {
			id: emailVerification.id,
		},
		data: {
			claimed: true,
		},
	});
}
