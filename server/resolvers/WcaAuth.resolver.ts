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
import {getJwtString, setSessionCookie, sessionTokenForBody} from '../util/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getPrisma} from '../database';
import {notifyAdminsOfNewUser} from '../services/admin_notification';
import {fetchAndSaveWcaRecords} from '../models/wca_record';
import {checkRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';
import {logger} from '../services/logger';

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

		// Abuse/DoS korumasi: WCA OAuth login akisini IP basina sinirla
		const ip = extractIp(req);
		if (ip) {
			const perIp = await checkRateLimit(`wca_login:ip:${ip}`, 30, 600);
			if (!perIp.allowed) {
				logger.warn('WCA login rate limit (ip)', {ip, count: perIp.count});
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla deneme. Lutfen birkac dakika sonra tekrar deneyin.');
			}
		}

		// 1. Get token and profile information from WCA
		const wcaData = await exchangeWcaLoginCode(code);

		if (!wcaData.email) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'WCA hesabinizdan e-posta bilgisi alinamadi. Lutfen WCA hesabinizda e-posta adresinizin tanimli oldugundan emin olun.');
		}

		// 2. Find the linked Integration. Match by wca_id for competitors, then fall back to
		// wca_user_id for newcomers — WCA account holders who never competed have no wca_id,
		// only a numeric user id. Matching by wca_id alone deadlocks these accounts on login:
		// the email fallback below throws "log in with password", but they signed up
		// passwordless via WCA, so the password path throws "use WCA". wca_user_id is always
		// present (it is the primary identity the signup/link paths already conflict-check on).
		let linkedIntegration = wcaData.wcaId ? await getIntegrationByWcaId(wcaData.wcaId) : null;
		if (!linkedIntegration && wcaData.wcaUserId) {
			linkedIntegration = await getIntegrationByWcaUserId(wcaData.wcaUserId);
		}
		if (linkedIntegration) {
			const user = await getUserById(linkedIntegration.user_id);
			if (user) {
				// Refresh profile and tokens — do not block login (best-effort).
				// Also backfills wca_id the first time a newcomer competes.
				try {
					const refreshed = await updateIntegration(linkedIntegration, {
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
					sessionToken: sessionTokenForBody(req, jwtToken),
				};
			}
		}

		// 3. Not linked by WCA identity (wca_id / wca_user_id). Fall back to email match.
		// Auto-linking a WCA login to an email-matched account is normally unsafe: an attacker
		// could pre-create a local (password) account with the victim's email, and auto-linking
		// would bind the victim's WCA data to the attacker. So password-holding accounts still
		// throw and must link manually (Settings > Linked Accounts).
		//
		// It IS safe to heal + log in when the matched account is:
		//  - a manual link: the user is already logged in as this account (proven ownership), or
		//  - passwordless: password IS NULL means (invariant) the account was created via WCA
		//    signup, so its integration is merely missing or lost its wca_user_id/wca_id at
		//    signup — the identity lookups above missed it. This WCA OAuth proves ownership.
		//    Without this branch such accounts deadlock: WCA login says "log in with password"
		//    but they have none, and the password path says "use WCA".
		const existingUser = await getUserByEmail(wcaData.email);
		const loggedInUser = context.user;

		if (existingUser) {
			const isManualLink = loggedInUser && loggedInUser.id === existingUser.id;
			const isPasswordless = !(existingUser as any).password;

			if (isManualLink || isPasswordless) {
				// Find-or-create the WCA integration on this account, refresh its tokens, and
				// backfill identity (wca_user_id/wca_id) from the WCA profile. Collision-free:
				// reaching here means the identity lookups returned nothing, so no other row
				// holds this wca_user_id/wca_id (both are @unique).
				let integration = await getIntegration(existingUser, 'wca');
				if (!integration) {
					integration = await createIntegration(
						existingUser,
						'wca',
						wcaData.accessToken,
						wcaData.refreshToken,
						wcaData.expiresAt
					);
				} else {
					integration = await updateIntegration(integration, {
						auth_token: wcaData.accessToken,
						refresh_token: wcaData.refreshToken,
						auth_expires_at: wcaData.expiresAt,
					});
				}
				integration = await syncWcaProfileToIntegration(integration, (wcaData as any).rawWcaData);
				if (wcaData.wcaId) {
					fetchAndSaveWcaRecords(existingUser, integration as any).catch((err) => {
						console.error('[Rankings] Auto-fetch on WCA login heal failed:', err?.message);
					});
				}

				// Manual link: the user already carries a session cookie, so keep the original
				// response shape (no new session token).
				if (isManualLink) {
					return {
						success: true,
						needsUsername: false,
					};
				}

				// Passwordless heal: issue a fresh session so the user is logged in.
				const jwtToken = getJwtString(existingUser);
				setSessionCookie(req, res, jwtToken);
				return {
					success: true,
					needsUsername: false,
					sessionToken: sessionTokenForBody(req, jwtToken),
				};
			}

			// Password-holding account, not a manual link — preserve the security throw.
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

		// 4. Account does not exist — write information to wca_pending cookie
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
		@Arg('username') username: string,
		// Explicit non-nullable: schema-wide nullableByDefault is true, so without this
		// the arg generates as `Boolean` — keep parity with createUserAccount's `terms_agreed: Boolean!`.
		@Arg('acceptedTerms', {nullable: false}) acceptedTerms: boolean
	): Promise<PublicUserAccount> {
		const {req, res} = context;

		// Consent is mandatory and enforced server-side — the client checkbox is bypassable
		// via direct GraphQL. No account is created without explicit acceptance.
		if (acceptedTerms !== true) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Devam etmek icin Gizlilik Politikasi ve Kullanim Kosullari kabul edilmelidir.');
		}

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
		const ip = extractIp(req);

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

		return {...sanitizeUser(user), session_token: sessionTokenForBody(req, jwtToken)} as PublicUserAccount;
	}
}
