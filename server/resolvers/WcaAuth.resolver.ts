import {Arg, Ctx, Mutation, Resolver} from 'type-graphql';
import jwt from 'jsonwebtoken';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {WcaOAuthResult} from '../schemas/WcaOAuthResult.schema';
import {PublicUserAccount} from '../schemas/UserAccount.schema';
import {exchangeWcaLoginCode, syncWcaProfileToIntegration} from '../integrations/oauth';
import {createUserAccount, getUserByEmail, getUserById, getUserByUsername, sanitizeUser} from '../models/user_account';
import {createIntegration, getIntegration, getIntegrationByWcaId, getIntegrationByWcaUserId, updateIntegration} from '../models/integration';
import {createSetting} from '../models/settings';
import {createNotificationPreference} from '../models/notification_preference';
import {createDefaultSession} from '../models/session';
import {getJwtString, setSessionCookie} from '../util/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getPrisma} from '../database';
import {notifyAdminsOfNewUser} from '../services/admin_notification';
import {fetchAndSaveWcaRecords} from '../models/wca_record';

const jwtSecret = (process as any).env.JWT_SECRET as string;
const WCA_PENDING_COOKIE = 'wca_pending';
const WCA_PENDING_EXPIRY = 15 * 60; // 15 minutes (seconds)

interface WcaPendingPayload {
	email: string;
	name: string;
	wcaId: string | null;
	wcaUserId: string | null;
	wcaAvatarUrl: string | null;
	countryIso2: string | null;
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

@Resolver()
export class WcaAuthResolver {
	@Mutation(() => WcaOAuthResult)
	async authenticateWithWca(
		@Ctx() context: GraphQLContext,
		@Arg('code') code: string
	): Promise<WcaOAuthResult> {
		const {req, res} = context;

		// 1. Get token and profile information from WCA
		const wcaData = await exchangeWcaLoginCode(code);

		if (!wcaData.email) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'WCA hesabinizdan e-posta bilgisi alinamadi. Lutfen WCA hesabinizda e-posta adresinizin tanimli oldugundan emin olun.');
		}

		// 2. First search Integration table by wca_id — this account is already linked to WCA
		if (wcaData.wcaId) {
			const existingIntegration = await getIntegrationByWcaId(wcaData.wcaId);
			if (existingIntegration) {
				const user = await getUserById(existingIntegration.user_id);
				if (user) {
					// Refresh profile and tokens — do not block login (best-effort)
					try {
						const refreshed = await updateIntegration(existingIntegration, {
							auth_token: wcaData.accessToken,
							refresh_token: wcaData.refreshToken,
							auth_expires_at: wcaData.expiresAt,
						});
						await syncWcaProfileToIntegration(refreshed, (wcaData as any).rawWcaData);
					} catch (e: any) {
						console.warn('[WcaAuth] Profile sync on login failed:', e?.message);
					}

					const jwtToken = getJwtString(user);
					setSessionCookie(req, res, jwtToken);

					return {
						success: true,
						needsUsername: false,
					};
				}
			}
		}

		// 3. Not found by wca_id, search by email — automatic linking NOT allowed
		// An attacker can create a local account with the victim's email; automatic linking
		// would bind the victim's WCA data to the attacker. This is why we always throw
		// an error on email match; the user must manually link (Settings > Linked Accounts).
		//
		// EXCEPTION: User is already logged in and the email-matched account is their own.
		// This is the manual link scenario — they log in with their password and click the
		// WCA link button in Settings. On OAuth return, this mutation is called. They've
		// proven ownership, so linking is allowed.
		const existingUser = await getUserByEmail(wcaData.email);
		const loggedInUser = context.user;

		if (existingUser) {
			const isManualLink = loggedInUser && loggedInUser.id === existingUser.id;

			if (!isManualLink) {
				if ((existingUser as any).email_verified) {
					throw new GraphQLError(
						ErrorCode.BAD_INPUT,
						'Bu e-posta zaten kullanimda. Lutfen sifrenizle giris yapin, ardindan Ayarlar > Bagli Hesaplar bolumunden WCA hesabinizi baglayabilirsiniz.'
					);
				} else {
					throw new GraphQLError(
						ErrorCode.BAD_INPUT,
						'Bu e-posta ile dogrulanmamis bir kayit var. Lutfen onceki kaydinizi tamamlayin veya farkli bir e-posta kullanin.'
					);
				}
			}

			// Manual link — create Integration, user is already logged in
			const existingIntegration = await getIntegration(existingUser, 'wca');
			if (!existingIntegration) {
				let integration = await createIntegration(
					existingUser,
					'wca',
					wcaData.accessToken,
					wcaData.refreshToken,
					wcaData.expiresAt
				);
				integration = await syncWcaProfileToIntegration(integration, (wcaData as any).rawWcaData);
				if (wcaData.wcaId) {
					fetchAndSaveWcaRecords(existingUser, integration as any).catch((err) => {
						console.error('[Rankings] Auto-fetch on manual link failed:', err?.message);
					});
				}
			}

			return {
				success: true,
				needsUsername: false,
			};
		}

		// 3. Account does not exist — write information to wca_pending cookie
		// Trim avatar URL to 500 chars; safety measure to not exceed 4KB cookie limit
		const pendingPayload: WcaPendingPayload = {
			email: wcaData.email,
			name: wcaData.name,
			wcaId: wcaData.wcaId || null,
			wcaUserId: (wcaData as any).wcaUserId || null,
			wcaAvatarUrl: ((wcaData as any).wcaAvatarUrl || '').slice(0, 500) || null,
			countryIso2: wcaData.countryIso2 || null,
			accessToken: wcaData.accessToken,
			refreshToken: wcaData.refreshToken,
			expiresAt: wcaData.expiresAt,
		};

		const pendingToken = jwt.sign(pendingPayload, jwtSecret, {expiresIn: WCA_PENDING_EXPIRY});

		res.cookie(WCA_PENDING_COOKIE, pendingToken, {
			httpOnly: true,
			maxAge: WCA_PENDING_EXPIRY * 1000,
			sameSite: 'none' as const,
			secure: true,
		});

		return {
			success: false,
			needsUsername: true,
			wcaName: wcaData.name,
			wcaEmail: wcaData.email,
			wcaId: wcaData.wcaId,
		};
	}

	@Mutation(() => PublicUserAccount)
	async completeWcaSignup(
		@Ctx() context: GraphQLContext,
		@Arg('username') username: string
	): Promise<PublicUserAccount> {
		const {req, res} = context;

		// 1. Read JWT from wca_pending cookie
		const pendingToken = req.cookies[WCA_PENDING_COOKIE];
		if (!pendingToken) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Oturum suresi doldu. Lutfen tekrar WCA ile giris yapin.');
		}

		let payload: WcaPendingPayload;
		try {
			payload = jwt.verify(pendingToken, jwtSecret) as WcaPendingPayload;
		} catch {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Oturum suresi doldu. Lutfen tekrar WCA ile giris yapin.');
		}

		// 2. Username validation
		if (!username || username.length < 2) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Kullanici adi en az 2 karakter olmalidir');
		}
		if (username.length > 18) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Kullanici adi en fazla 18 karakter olabilir');
		}
		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Kullanici adi sadece harf, rakam ve alt cizgi icerebilir');
		}

		const existingUsername = await getUserByUsername(username);
		if (existingUsername && existingUsername.length) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu kullanici adi zaten kullaniliyor');
		}

		// 3. Re-check email (race condition prevention) — no automatic deletion
		const existingEmail = await getUserByEmail(payload.email);
		if (existingEmail) {
			if (!(existingEmail as any).email_verified) {
				throw new GraphQLError(
					ErrorCode.BAD_INPUT,
					'Bu e-posta ile dogrulanmamis bir kayit var. Lutfen onceki kaydinizi tamamlayin veya farkli bir e-posta kullanin.'
				);
			} else {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu e-posta adresi zaten kullanimda');
			}
		}

		// 4. Split WCA name
		const nameParts = (payload.name || '').trim().split(/\s+/);
		const firstName = nameParts[0] || '';
		const lastName = nameParts.slice(1).join(' ') || '';

		// 5. Create account (passwordless)
		let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		if (Array.isArray(ip)) {
			ip = ip[0];
		} else if (ip && ip.indexOf(',') > -1) {
			ip = ip.split(',')[0];
		}

		const user = await createUserAccount(firstName, lastName, payload.email, username, null, ip as string);

		// email_verified = true (WCA email is trusted)
		await getPrisma().userAccount.update({
			where: {id: user.id},
			data: {email_verified: true},
		});

		// 6. Create Setting + NotificationPreference + default Session
		const wcaLocale = req.cookies?.zkt_language || 'en';
		await createSetting(user, wcaLocale);
		await createNotificationPreference(user);
		await createDefaultSession(user, wcaLocale);

		// 7. Check if WCA account is linked to another user — wca_user_id always exists including newcomers
		if (payload.wcaUserId) {
			const existing = await getIntegrationByWcaUserId(payload.wcaUserId);
			if (existing) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu WCA hesabi baska bir kullaniciya bagli.');
			}
		}
		if (payload.wcaId) {
			const existingByWcaId = await getIntegrationByWcaId(payload.wcaId);
			if (existingByWcaId) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu WCA hesabi baska bir kullaniciya bagli.');
			}
		}

		// 8. Create Integration record — write all WCA information from pendingPayload
		let integration = await createIntegration(
			user,
			'wca',
			payload.accessToken,
			payload.refreshToken,
			payload.expiresAt
		);
		// Synthetic wcaData — provide same shape to syncWcaProfileToIntegration for pendingPayload
		const syntheticWcaData: any = {
			id: payload.wcaUserId,
			wca_id: payload.wcaId,
			name: payload.name,
			avatar: payload.wcaAvatarUrl ? {thumb_url: payload.wcaAvatarUrl} : null,
			country_iso2: payload.countryIso2,
		};
		integration = await syncWcaProfileToIntegration(integration, syntheticWcaData);

		if (payload.wcaId) {
			// Fetch WCA records + calculate ranking
			fetchAndSaveWcaRecords(user, integration as any).catch((err) => {
				console.error('[Rankings] Auto-fetch on signup failed:', err?.message);
			});
		}

		// 8. Clear wca_pending cookie + set session cookie
		res.clearCookie(WCA_PENDING_COOKIE, { sameSite: 'none' as const, secure: true });

		const jwtToken = getJwtString(user);
		setSessionCookie(req, res, jwtToken);

		notifyAdminsOfNewUser(user, 'wca').catch(err =>
			console.error('[AdminNotification] WCA signup notification failed:', err)
		);

		return sanitizeUser(user) as PublicUserAccount;
	}
}
