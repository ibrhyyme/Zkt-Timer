import uniqid from 'uniqid';
import {getPrisma} from '../database';
import {UserAccount} from '../schemas/UserAccount.schema';

export function createDefaultSession(user: UserAccount) {
	return getPrisma().session.create({
		data: {
			id: uniqid('se-'),
			name: 'Yeni Sezon',
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
