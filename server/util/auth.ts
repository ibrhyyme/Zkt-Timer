import jwt from 'jsonwebtoken';
import {v4 as uuidv4} from 'uuid';
import {getUserById, getUserByIdWithProfile, updateUserAccountWithParams} from '../models/user_account';
import {getOrCreateUserProfile} from '../models/profile';
import {deactivateAllBanLogs} from '../models/ban_log';
import GraphQLError from './graphql_error';
import {Request} from 'express-serve-static-core';
import {UserAccount} from '../schemas/UserAccount.schema';
import {ErrorCode} from '../constants/errors';
import {getRedisPubClient} from '../services/redis';

const jwtSecret = (process as any).env.JWT_SECRET as string;

const JWT_EXPIRY = '90d';
const JWT_ALGORITHM = 'HS256' as const;
// Token revoke edildiginde Redis'te bu prefix ile saklanir, TTL = token kalan suresi
const REVOKED_JWT_KEY_PREFIX = 'revoked_jwt:';
// 90 gun saniye cinsinden — revoke entry max bu kadar yasar (token zaten o zaman dolar)
const JWT_REVOKE_TTL_SECONDS = 90 * 24 * 60 * 60;

async function isJwtRevoked(jti: string | undefined): Promise<boolean> {
	if (!jti) return false; // Eski JWT'lerde jti yok — revoke edilemez (geriye uyumluluk)
	try {
		const client = getRedisPubClient();
		if (!client) return false;
		const exists = await client.exists(`${REVOKED_JWT_KEY_PREFIX}${jti}`);
		return exists === 1;
	} catch {
		return false; // Redis hatasinda token gecerli kabul (fail-open: kullanicilari kapidan disari atmamak icin)
	}
}

export async function revokeJwt(jti: string | undefined, exp: number | undefined): Promise<void> {
	if (!jti) return;
	try {
		const client = getRedisPubClient();
		if (!client) return;
		// TTL = token'in kalan omru (saniye). Yoksa default 90 gun.
		let ttl = JWT_REVOKE_TTL_SECONDS;
		if (exp) {
			const remaining = exp - Math.floor(Date.now() / 1000);
			if (remaining > 0) ttl = remaining;
		}
		await client.set(`${REVOKED_JWT_KEY_PREFIX}${jti}`, '1', 'EX', ttl);
	} catch {
		// Sessizce gec — revoke best-effort
	}
}

export async function getMe(req: Request) {
	const session = req.cookies.session;

	if (!session) {
		// User not logged in
		return null;
	}

	try {
		const output: any = jwt.verify(session, jwtSecret);

		if (output) {
			// Token revoke edilmis mi (logout sonrasi)?
			if (await isJwtRevoked(output.jti)) {
				return null;
			}

			const me = await getUserByIdWithProfile(output.user_id, true);

			if (!me) {
				return null;
			}

			if (!me.banned_forever && !me.banned_until && me.bans && me.bans.length) {
				deactivateAllBanLogs(me.id);
			} else if (me.banned_until && new Date() > new Date(me.banned_until)) {
				me.banned_until = null;
				updateUserAccountWithParams(me.id, {
					banned_until: null,
					banned_forever: false,
				});

				deactivateAllBanLogs(me.id);
			}

			// Pro expire check
			if (me.pro_expires_at && new Date() > new Date(me.pro_expires_at)) {
				me.is_pro = false;
				me.pro_expires_at = null;
				updateUserAccountWithParams(me.id, {is_pro: false, pro_expires_at: null});
			}

			// Premium expire check
			if (me.premium_expires_at && new Date() > new Date(me.premium_expires_at)) {
				me.is_premium = false;
				me.premium_expires_at = null;
				updateUserAccountWithParams(me.id, {is_premium: false, premium_expires_at: null});
			}

			return me;
		}
	} catch (e) {
		return null;
	}
	return null;
}

export async function getMeWithCookieString(cookies: string | any): Promise<UserAccount> {
	if (!cookies || typeof cookies !== 'string' || !cookies.trim()) {
		return null;
	}

	const coo = cookies.split('; ');
	if (!coo || !coo.length) {
		return null;
	}

	const cookieMap: {[key: string]: string} = {};
	for (const c of coo) {
		const kv = c.split('=');
		if (!kv || kv.length !== 2) {
			continue;
		}

		cookieMap[kv[0]] = kv[1];
	}

	const session = cookieMap.session;
	if (!session || !session.trim()) {
		return null;
	}

	try {
		const output: any = jwt.verify(session, jwtSecret);
		if (output) {
			// Token revoke edilmis mi?
			if (await isJwtRevoked(output.jti)) {
				return null;
			}

			const user = await getUserById(output.user_id);
			if (!user) {
				return null;
			}

			const profile = await getOrCreateUserProfile(user);
			return {
				...user,
				profile,
			} as any;
		}
	} catch (e) {
		return null;
	}
}

export function checkLoggedIn(user: UserAccount, admin: boolean = false) {
	if (!user) {
		throw new GraphQLError(ErrorCode.UNAUTHENTICATED, 'You must be logged in to perform this action');
	}

	if (admin && !user.admin) {
		throw new GraphQLError(ErrorCode.FORBIDDEN, 'You do not have permission to perform this action');
	}
}

export function getJwtString(user: UserAccount) {
	const payload = {
		user_id: user.id,
		createdAt: new Date().getTime(),
		jti: uuidv4(), // Token revocation icin benzersiz id
	};

	return jwt.sign(payload, jwtSecret, {
		algorithm: JWT_ALGORITHM,
		expiresIn: JWT_EXPIRY,
	});
}

// Cookie omurleri JWT_EXPIRY (90d) ile uyumlu — JWT zaten 90 gun sonra invalidate edildigi icin
// daha uzun cookie tutmak anlamsiz. remember=false 30 gun, remember=true 90 gun.
const SESSION_MAX_AGE_REMEMBER = 90 * 24 * 60 * 60 * 1000; // 90 gun
const SESSION_MAX_AGE_DEFAULT = 30 * 24 * 60 * 60 * 1000;  // 30 gun

// Native (Capacitor mobile) WebView icin sameSite='none' zorunlu (cross-origin context).
// Web icin 'lax' — CSRF korumasi.
function getSameSitePolicy(req: any): 'none' | 'lax' {
	return (req as any)?.isWebView ? 'none' : 'lax';
}

export function setSessionCookie(req: any, res: any, jwtToken: string, opts: {remember?: boolean} = {}) {
	const isProduction = process.env.NODE_ENV === 'production';
	const remember = opts.remember !== false;
	const sameSite: 'none' | 'lax' = isProduction ? getSameSitePolicy(req) : 'lax';
	res.cookie('session', jwtToken, {
		httpOnly: true,
		maxAge: remember ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE_DEFAULT,
		sameSite,
		// sameSite='none' icin secure zorunlu — native/production'da daima true
		secure: isProduction || sameSite === 'none',
	});
}

export function clearSessionCookie(req: any, res: any) {
	const isProduction = process.env.NODE_ENV === 'production';
	const sameSite: 'none' | 'lax' = isProduction ? getSameSitePolicy(req) : 'lax';
	res.clearCookie('session', {
		sameSite,
		secure: isProduction || sameSite === 'none',
	});
}
