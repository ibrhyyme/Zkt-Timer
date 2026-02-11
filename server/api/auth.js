import { getJwtString } from '../util/auth';
import GraphQLError from '../util/graphql_error';
import { checkPassword } from '../util/password';
import { getUserByEmail, sanitizeUser } from '../models/user_account';

const gqlMutation = `
	logOut: PublicUserAccount!
authenticateUser(email: String!, password: String!, remember: Boolean): PublicUserAccount!
`;

const mutateActions = {
	authenticateUser: async (_, { email, password, remember }, { res }) => {
		const user = await getUserByEmail(email);
		if (!user) {
			throw new GraphQLError(400, 'Geçersiz kullanıcı adı veya şifre');
		}

		const goodPass = await checkPassword(password, user.password);
		if (!goodPass) {
			throw new GraphQLError(400, 'Geçersiz kullanıcı adı veya şifre');
		}

		const jwt = getJwtString(user);

		// If remember me is true, set cookie for 10 years (effectively forever)
		// If false, set cookie for 1 year (also effectively forever for normal users unless they clear cookies)
		const cookieOptions = {
			httpOnly: true,
			maxAge: remember ? 315360000000 : 31536000000 // 10 years vs 1 year
		};

		res.cookie('session', jwt, cookieOptions);

		return sanitizeUser(user);
	},
	logOut: async (_, params, { res, user }) => {
		res.clearCookie('session');
		return sanitizeUser(user);
	},
};

module.exports = {
	gqlMutation,
	mutateActions,
};
