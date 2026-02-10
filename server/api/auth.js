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

		// If remember me is true, set cookie for 24 days approx (2147483647 ms is ~24 days)
		// If false, set session cookie (no maxAge)
		const cookieOptions = {
			httpOnly: true,
			...(remember ? { maxAge: 2147483647 } : {})
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
