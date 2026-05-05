import {Arg, Ctx, Mutation, Resolver} from 'type-graphql';
import jwt from 'jsonwebtoken';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {WcaOAuthResult} from '../schemas/WcaOAuthResult.schema';
import {PublicUserAccount} from '../schemas/UserAccount.schema';
import {exchangeWcaLoginCode} from '../integrations/oauth';
import {createUserAccount, getUserByEmail, getUserById, getUserByUsername, sanitizeUser} from '../models/user_account';
import {createIntegration, getIntegration, getIntegrationByWcaId, updateIntegration} from '../models/integration';
import {createSetting} from '../models/settings';
import {createNotificationPreference} from '../models/notification_preference';
import {getJwtString, setSessionCookie} from '../util/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getPrisma} from '../database';
import {notifyAdminsOfNewUser} from '../services/admin_notification';
import {fetchAndSaveWcaRecords} from '../models/wca_record';

const jwtSecret = (process as any).env.JWT_SECRET as string;
const WCA_PENDING_COOKIE = 'wca_pending';
const WCA_PENDING_EXPIRY = 15 * 60; // 15 dakika (saniye)

interface WcaPendingPayload {
	email: string;
	name: string;
	wcaId: string;
	countryIso2: string;
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

		// 1. WCA'dan token ve profil bilgilerini al
		const wcaData = await exchangeWcaLoginCode(code);

		if (!wcaData.email) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'WCA hesabinizdan e-posta bilgisi alinamadi. Lutfen WCA hesabinizda e-posta adresinizin tanimli oldugundan emin olun.');
		}

		// 2. Once wca_id ile Integration tablosundan ara — bu hesap zaten WCA bagli
		if (wcaData.wcaId) {
			const existingIntegration = await getIntegrationByWcaId(wcaData.wcaId);
			if (existingIntegration) {
				const user = await getUserById(existingIntegration.user_id);
				if (user) {
					const jwtToken = getJwtString(user);
					setSessionCookie(req, res, jwtToken);

					return {
						success: true,
						needsUsername: false,
					};
				}
			}
		}

		// 3. wca_id ile bulunamadiysa email ile ara — otomatik linking YOK
		// Saldirgan kurbanin email'i ile local hesap acabilir; otomatik link
		// kurbanin WCA verilerini saldirgana baglar. Bu yuzden email match'te
		// her zaman hata atiyoruz; kullanici manuel link yapmali (Ayarlar > Bagli Hesaplar).
		//
		// ISTISNA: Kullanici zaten login ve email match'lenen hesap kendi hesabi.
		// Bu manuel link senaryosu — sifresiyle giris yapip Ayarlar'dan WCA bagla butonuna bastiginda
		// OAuth donusunde bu mutation cagrilir. Sahibi oldugu kanitli, link yapilabilir.
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

			// Manuel link — Integration olustur, kullanici zaten oturum acmis durumda
			const existingIntegration = await getIntegration(existingUser, 'wca');
			if (!existingIntegration) {
				const integration = await createIntegration(
					existingUser,
					'wca',
					wcaData.accessToken,
					wcaData.refreshToken,
					wcaData.expiresAt
				);
				if (wcaData.wcaId) {
					await updateIntegration(integration, {
						wca_id: wcaData.wcaId,
						wca_country_iso2: wcaData.countryIso2 || null,
					});
					fetchAndSaveWcaRecords(existingUser, {...integration, wca_id: wcaData.wcaId} as any).catch((err) => {
						console.error('[Rankings] Auto-fetch on manual link failed:', err?.message);
					});
				}
			}

			return {
				success: true,
				needsUsername: false,
			};
		}

		// 3. Hesap yok — wca_pending cookie'ye bilgileri yaz
		const pendingPayload: WcaPendingPayload = {
			email: wcaData.email,
			name: wcaData.name,
			wcaId: wcaData.wcaId,
			countryIso2: wcaData.countryIso2,
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

		// 1. wca_pending cookie'den JWT oku
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

		// 2. Username validasyonu
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

		// 3. Email tekrar kontrol (race condition onlemi) — otomatik silme YOK
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

		// 4. WCA name'i split et
		const nameParts = (payload.name || '').trim().split(/\s+/);
		const firstName = nameParts[0] || '';
		const lastName = nameParts.slice(1).join(' ') || '';

		// 5. Hesap olustur (sifresiz)
		let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		if (Array.isArray(ip)) {
			ip = ip[0];
		} else if (ip && ip.indexOf(',') > -1) {
			ip = ip.split(',')[0];
		}

		const user = await createUserAccount(firstName, lastName, payload.email, username, null, ip as string);

		// email_verified = true (WCA email'i guvenilir)
		await getPrisma().userAccount.update({
			where: {id: user.id},
			data: {email_verified: true},
		});

		// 6. Setting + NotificationPreference olustur
		const wcaLocale = req.cookies?.zkt_language || 'en';
		await createSetting(user, wcaLocale);
		await createNotificationPreference(user);

		// 7. WCA ID baska hesaba bagli mi kontrol et
		if (payload.wcaId) {
			const existingWca = await getIntegrationByWcaId(payload.wcaId);
			if (existingWca) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu WCA hesabi baska bir kullaniciya bagli.');
			}
		}

		// 8. Integration record olustur
		const integration = await createIntegration(
			user,
			'wca',
			payload.accessToken,
			payload.refreshToken,
			payload.expiresAt
		);
		if (payload.wcaId) {
			await updateIntegration(integration, {wca_id: payload.wcaId});
			// WCA kayitlarini cek + ranking hesapla
			fetchAndSaveWcaRecords(user, {...integration, wca_id: payload.wcaId} as any).catch((err) => {
				console.error('[Rankings] Auto-fetch on signup failed:', err?.message);
			});
		}

		// 8. wca_pending cookie temizle + session cookie set et
		res.clearCookie(WCA_PENDING_COOKIE, { sameSite: 'none' as const, secure: true });

		const jwtToken = getJwtString(user);
		setSessionCookie(req, res, jwtToken);

		notifyAdminsOfNewUser(user, 'wca').catch(err =>
			console.error('[AdminNotification] WCA signup notification failed:', err)
		);

		return sanitizeUser(user) as PublicUserAccount;
	}
}
