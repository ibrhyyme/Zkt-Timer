import { getJwtString, setSessionCookie, clearSessionCookie, revokeJwt } from '../util/auth';
import jwtLib from 'jsonwebtoken';
import GraphQLError from '../util/graphql_error';
import { checkPassword } from '../util/password';
import { getUserByEmail, sanitizeUser } from '../models/user_account';
import { checkRateLimit } from '../services/rate_limit';
import { extractIp } from '../util/request';
import { logger } from '../services/logger';
import { ErrorCode } from '../constants/errors';
import { disconnectUserSockets } from '../services/socket_util';

const gqlMutation = `
	logOut: PublicUserAccount!
authenticateUser(email: String!, password: String!, remember: Boolean): PublicUserAccount!
`;

const mutateActions = {
	authenticateUser: async (_, { email, password, remember }, { req, res }) => {
		const ip = extractIp(req);
		const emailKey = (email || '').toLowerCase();

		// Brute force korumasi: 10 dak / 10 deneme per email, 30 deneme per IP
		const perEmail = await checkRateLimit(`login:email:${emailKey}`, 10, 600);
		if (!perEmail.allowed) {
			logger.warn('Login rate limit (email)', {email: emailKey, count: perEmail.count});
			throw new GraphQLError(400, 'Cok fazla giris denemesi. Lutfen birkac dakika sonra tekrar deneyin.');
		}
		if (ip) {
			const perIp = await checkRateLimit(`login:ip:${ip}`, 30, 600);
			if (!perIp.allowed) {
				logger.warn('Login rate limit (ip)', {ip, count: perIp.count});
				throw new GraphQLError(400, 'Cok fazla giris denemesi. Lutfen birkac dakika sonra tekrar deneyin.');
			}
		}

		const user = await getUserByEmail(email);
		if (!user) {
			throw new GraphQLError(400, 'Geçersiz kullanıcı adı veya şifre');
		}

		if (!user.password) {
			throw new GraphQLError(400, 'Bu hesap WCA ile giriş yapıyor. Lütfen WCA ile giriş yap butonunu kullanın.');
		}

		const goodPass = await checkPassword(password, user.password);
		if (!goodPass) {
			throw new GraphQLError(400, 'Geçersiz kullanıcı adı veya şifre');
		}

		if (!user.email_verified) {
			throw new GraphQLError(
				ErrorCode.EMAIL_NOT_VERIFIED,
				'Lütfen önce e-posta adresinizi doğrulayın',
				{email: user.email}
			);
		}

		const jwt = getJwtString(user);
		setSessionCookie(req, res, jwt, {remember: !!remember});

		return sanitizeUser(user);
	},
	logOut: async (_, params, { req, res, user }) => {
		// Token revocation: cookie'den JWT'yi cikar, jti'yi Redis'e blacklist et
		const session = req?.cookies?.session;
		if (session) {
			try {
				const decoded = jwtLib.decode(session);
				if (decoded && typeof decoded === 'object' && decoded.jti) {
					await revokeJwt(decoded.jti, decoded.exp);
				}
			} catch {
				// Decode edilemezse de cookie'yi temizle
			}
		}
		clearSessionCookie(req, res);
		if (user?.id) {
			disconnectUserSockets(user.id);
		}
		return sanitizeUser(user);
	},
};

module.exports = {
	gqlMutation,
	mutateActions,
};
