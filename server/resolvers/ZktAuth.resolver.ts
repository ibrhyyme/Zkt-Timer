import {Arg, Ctx, Mutation, Resolver} from 'type-graphql';
import jwt from 'jsonwebtoken';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {ZktOAuthResult} from '../schemas/ZktOAuthResult.schema';
import {PublicUserAccount} from '../schemas/UserAccount.schema';
import {exchangeZktLoginCode, fetchZktProfile, syncZktProfileToIntegration, ZktProfile} from '../integrations/zkt_oauth';
import {createUserAccount, getUserByEmail, getUserById, getUserByUsername, sanitizeUser} from '../models/user_account';
import {
	createIntegration,
	getIntegration,
	getIntegrationByZktId,
	getIntegrationByZktUserId,
	updateIntegration,
} from '../models/integration';
import {createSetting} from '../models/settings';
import {createNotificationPreference} from '../models/notification_preference';
import {createDefaultSession} from '../models/session';
import {getJwtString, setSessionCookie, sessionTokenForBody} from '../util/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getPrisma} from '../database';
import {notifyAdminsOfNewUser} from '../services/admin_notification';
import {checkRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';
import {logger} from '../services/logger';

// "Sign in with Zeka Kupu Turkiye". The federation is an identity provider now,
// so a member can reach the same Zkt-Timer account through a password, through
// WCA, or through ZKT — whichever door they walk up to.
//
// Deliberately a copy of the WCA login shape rather than a shared abstraction:
// the two providers disagree on what identity even means (WCA has a numeric
// account id plus an optional competitor id; ZKT has a member number plus an
// optional competition id issued only after a published result), and the
// account-merge rules below are the part that must be read line by line rather
// than inherited.

const jwtSecret = (process as any).env.JWT_SECRET as string;
const ZKT_PENDING_COOKIE = 'zkt_pending';
const ZKT_PENDING_EXPIRY = 15 * 60; // seconds

interface ZktPendingPayload {
	sub: string;
	email: string;
	name: string;
	zktId: string | null;
	memberNo: number | null;
	avatarUrl: string | null;
	countryIso2: string | null;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: number;
}

/** Attach the federation identity to an account that has just proven ownership. */
async function upsertZktIntegration(user: any, profile: ZktProfile, tokens: {
	accessToken: string;
	refreshToken: string | null;
	expiresAt: number;
}) {
	let integration = await getIntegration(user, 'zkt');
	if (!integration) {
		integration = await createIntegration(
			user,
			'zkt',
			tokens.accessToken,
			tokens.refreshToken ?? '',
			tokens.expiresAt
		);
	} else {
		integration = await updateIntegration(integration, {
			auth_token: tokens.accessToken,
			refresh_token: tokens.refreshToken ?? integration.refresh_token,
			auth_expires_at: tokens.expiresAt,
		});
	}
	return syncZktProfileToIntegration(integration, profile);
}

@Resolver()
export class ZktAuthResolver {
	@Mutation(() => ZktOAuthResult)
	async authenticateWithZkt(
		@Ctx() context: GraphQLContext,
		@Arg('code') code: string
	): Promise<ZktOAuthResult> {
		const {req, res} = context;

		const ip = extractIp(req);
		if (ip) {
			const perIp = await checkRateLimit(`zkt_login:ip:${ip}`, 30, 600);
			if (!perIp.allowed) {
				logger.warn('ZKT login rate limit (ip)', {ip, count: perIp.count});
				throw new GraphQLError(
					ErrorCode.BAD_INPUT,
					'Cok fazla deneme. Lutfen birkac dakika sonra tekrar deneyin.'
				);
			}
		}

		const tokens = await exchangeZktLoginCode(code);
		const profile = await fetchZktProfile(tokens.accessToken);

		if (!profile.sub) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'ZKT hesabindan kimlik bilgisi alinamadi.');
		}

		// 1. Known federation identity. zkt_user_id first (always present), then
		// the competition id, which is what an older row might have been matched
		// on before the member's account subject was recorded.
		let linked = await getIntegrationByZktUserId(profile.sub);
		if (!linked && profile.zktId) {
			linked = await getIntegrationByZktId(profile.zktId);
		}
		if (linked) {
			const user = await getUserById(linked.user_id);
			if (user) {
				// Best-effort refresh: a failed profile sync must not block a login.
				try {
					const refreshed = await updateIntegration(linked, {
						auth_token: tokens.accessToken,
						refresh_token: tokens.refreshToken ?? linked.refresh_token,
						auth_expires_at: tokens.expiresAt,
					});
					await syncZktProfileToIntegration(refreshed, profile);
				} catch (e: any) {
					logger.warn('[ZktAuth] profile sync on login failed', {message: e?.message});
				}

				const jwtToken = getJwtString(user);
				setSessionCookie(req, res, jwtToken);
				return {
					success: true,
					needsUsername: false,
					sessionToken: sessionTokenForBody(req, jwtToken),
				};
			}
		}

		// 2. No ZKT link yet. Fall back to the email the federation confirmed.
		//
		// The same rule the WCA path uses, and for the same reason: auto-linking on
		// a bare email match would let somebody pre-create a local account with a
		// victim's address and inherit their federation identity. So it only heals
		// two safe cases — the member is already signed in as this account (they
		// have proven it), or the account has no password at all, which by
		// construction means it was created through an OAuth signup and this login
		// is the proof of ownership it was missing.
		//
		// An unverified federation email is not an identity claim at all, so it
		// never merges. Those members get the signup path instead.
		const existingUser =
			profile.email && profile.emailVerified ? await getUserByEmail(profile.email) : null;
		const loggedInUser = context.user;

		if (existingUser) {
			const isManualLink = loggedInUser && loggedInUser.id === existingUser.id;
			const isPasswordless = !(existingUser as any).password;

			if (isManualLink || isPasswordless) {
				await upsertZktIntegration(existingUser, profile, tokens);

				if (isManualLink) {
					// They already hold a session cookie; do not mint a second one.
					return {success: true, needsUsername: false};
				}

				const jwtToken = getJwtString(existingUser);
				setSessionCookie(req, res, jwtToken);
				return {
					success: true,
					needsUsername: false,
					sessionToken: sessionTokenForBody(req, jwtToken),
				};
			}

			// Structured, not prose: the callback screen turns this into a page that
			// explains the next two steps. A bare message was shown as a toast and
			// then replaced by a redirect to /login two seconds later, so nobody
			// ever read the one thing they needed to know.
			throw new GraphQLError(
				ErrorCode.BAD_INPUT,
				JSON.stringify({
					code: 'EMAIL_ALREADY_REGISTERED',
					provider: 'zkt',
					email: profile.email,
				})
			);
		}

		// 3. Brand new. Park the profile in a short-lived signed cookie and ask for
		// a username; nothing is written until they finish.
		if (!profile.email) {
			throw new GraphQLError(
				ErrorCode.BAD_INPUT,
				'ZKT hesabinizda e-posta adresi bulunamadi. Lutfen zekakuputurkiye.com uzerinden e-posta adresinizi ekleyin.'
			);
		}

		const pendingPayload: ZktPendingPayload = {
			sub: profile.sub,
			email: profile.email,
			name: profile.name || '',
			zktId: profile.zktId,
			memberNo: profile.memberNo,
			// Bounded so the cookie cannot approach the 4KB limit.
			avatarUrl: (profile.avatarUrl || '').slice(0, 500) || null,
			countryIso2: profile.countryIso2,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: tokens.expiresAt,
		};
		const pendingToken = jwt.sign(pendingPayload, jwtSecret, {expiresIn: ZKT_PENDING_EXPIRY});
		res.cookie(ZKT_PENDING_COOKIE, pendingToken, {
			httpOnly: true,
			maxAge: ZKT_PENDING_EXPIRY * 1000,
			sameSite: 'none' as const,
			secure: true,
		});

		return {
			success: false,
			needsUsername: true,
			zktName: profile.name || undefined,
			zktEmail: profile.email,
			zktId: profile.zktId || undefined,
			zktMemberNo: profile.memberNo ?? undefined,
		};
	}

	@Mutation(() => PublicUserAccount)
	async completeZktSignup(
		@Ctx() context: GraphQLContext,
		@Arg('username') username: string,
		// Explicit non-nullable: schema-wide nullableByDefault would otherwise emit
		// `Boolean`, and consent must not be omissible.
		@Arg('acceptedTerms', {nullable: false}) acceptedTerms: boolean
	): Promise<PublicUserAccount> {
		const {req, res} = context;

		// Enforced server-side: the client checkbox is bypassable over raw GraphQL.
		if (acceptedTerms !== true) {
			throw new GraphQLError(
				ErrorCode.BAD_INPUT,
				'Devam etmek icin Gizlilik Politikasi ve Kullanim Kosullari kabul edilmelidir.'
			);
		}

		const pendingToken = req.cookies[ZKT_PENDING_COOKIE];
		if (!pendingToken) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Oturum suresi doldu. Lutfen tekrar ZKT ile giris yapin.');
		}
		let payload: ZktPendingPayload;
		try {
			payload = jwt.verify(pendingToken, jwtSecret) as ZktPendingPayload;
		} catch {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Oturum suresi doldu. Lutfen tekrar ZKT ile giris yapin.');
		}

		const trimmed = (username || '').trim();
		if (trimmed.length < 2) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Kullanici adi en az 2 karakter olmalidir');
		}
		if (trimmed.length > 18) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Kullanici adi en fazla 18 karakter olabilir');
		}
		if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Kullanici adi sadece harf, rakam ve alt cizgi icerebilir');
		}
		const existingUsername = await getUserByUsername(trimmed);
		if (existingUsername && existingUsername.length) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu kullanici adi zaten kullaniliyor');
		}

		// Re-checked here as well as at step 2 above: the two requests are minutes
		// apart and somebody may have signed up with this address in between.
		const existingEmail = await getUserByEmail(payload.email);
		if (existingEmail) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu e-posta adresi zaten kullanimda');
		}
		// Same for the federation identity: refuse rather than move the link.
		const identityTaken = await getIntegrationByZktUserId(payload.sub);
		if (identityTaken) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu ZKT hesabi baska bir kullaniciya bagli.');
		}

		const nameParts = (payload.name || '').trim().split(/\s+/);
		const firstName = nameParts[0] || '';
		const lastName = nameParts.slice(1).join(' ') || '';

		const ip = extractIp(req);
		const user = await createUserAccount(firstName, lastName, payload.email, trimmed, null, ip as string);

		// The federation only hands us an address it confirmed itself, so there is
		// nothing left for us to verify.
		await getPrisma().userAccount.update({
			where: {id: user.id},
			data: {email_verified: true},
		});

		const locale = req.cookies?.zkt_language || 'tr';
		await createSetting(user, locale);
		await createNotificationPreference(user);
		await createDefaultSession(user, locale);

		await upsertZktIntegration(
			user,
			{
				sub: payload.sub,
				zktId: payload.zktId,
				memberNo: payload.memberNo,
				name: payload.name,
				firstName,
				lastName,
				email: payload.email,
				emailVerified: true,
				avatarUrl: payload.avatarUrl,
				countryIso2: payload.countryIso2,
				wcaId: null,
			},
			{
				accessToken: payload.accessToken,
				refreshToken: payload.refreshToken,
				expiresAt: payload.expiresAt,
			}
		);

		res.clearCookie(ZKT_PENDING_COOKIE, {sameSite: 'none' as const, secure: true});

		const jwtToken = getJwtString(user);
		setSessionCookie(req, res, jwtToken);

		notifyAdminsOfNewUser(user, 'zkt').catch((err) =>
			logger.warn('[ZktAuth] admin signup notification failed', {message: err?.message})
		);

		return {...sanitizeUser(user), session_token: sessionTokenForBody(req, jwtToken)} as PublicUserAccount;
	}
}
