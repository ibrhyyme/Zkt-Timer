import {getPrisma} from '../database';
import {v4 as uuid} from 'uuid';
import {UserAccount} from '../schemas/UserAccount.schema';

/**
 * Records that an email went out, not what it said. The template variables hold
 * verification codes and notification text and nothing reads them back, so `vars` stays
 * an empty object.
 */
export async function createEmailLog(user: UserAccount, subject: string, template: string) {
	return getPrisma().emailLog.create({
		data: {
			id: uuid(),
			user_id: user.id,
			email: user.email,
			subject,
			template,
			vars: '{}',
		},
	});
}
