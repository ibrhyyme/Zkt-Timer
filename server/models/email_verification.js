import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {generateRandomCode} from '../../shared/code';

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
			code: generateRandomCode(6),
		},
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
