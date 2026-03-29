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
import {getJwtString} from '../util/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getPrisma} from '../database';
import {notifyAdminsOfNewUser} from '../services/admin_notification';

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
		const {res, req} = context;

		// 1. WCA'dan token ve profil bilgilerini al
		const wcaData = await exchangeWcaLoginCode(code);

		if (!wcaData.email) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'WCA hesabinizdan e-posta bilgisi alinamadi. Lutfen WCA hesabinizda e-posta adresinizin tanimli oldugundan emin olun.');
		}

		// 2. Once wca_id ile Integration tablosundan ara
		if (wcaData.wcaId) {
			const existingIntegration = await getIntegrationByWcaId(wcaData.wcaId);
			if (existingIntegration) {
				const user = await getUserById(existingIntegration.user_id);
				if (user) {
					const jwtToken = getJwtString(user);
					res.cookie('session', jwtToken, {
						httpOnly: true,
						maxAge: 315360000000,
					});

					return {
						success: true,
						needsUsername: false,
					};
				}
			}
		}

		// 3. wca_id ile bulunamadiysa email ile ara
		const existingUser = await getUserByEmail(wcaData.email);

		if (existingUser) {
			if ((existingUser as any).email_verified) {
				// Dogrulanmis hesap — otomatik giris yap
				const jwtToken = getJwtString(existingUser);
				res.cookie('session', jwtToken, {
					httpOnly: true,
					maxAge: 315360000000,
				});

				// Integration yoksa olustur
				const existing = await getIntegration(existingUser, 'wca');
				if (!existing) {
					const integration = await createIntegration(
						existingUser,
						'wca',
						wcaData.accessToken,
						wcaData.refreshToken,
						wcaData.expiresAt
					);
					if (wcaData.wcaId) {
						await updateIntegration(integration, {wca_id: wcaData.wcaId});
					}
				}

				return {
					success: true,
					needsUsername: false,
				};
			} else {
				// Dogrulanmamis hesap — sil
				await getPrisma().userAccount.delete({where: {id: existingUser.id}});
			}
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

		// 3. Email tekrar kontrol (race condition onlemi)
		const existingEmail = await getUserByEmail(payload.email);
		if (existingEmail) {
			if (!(existingEmail as any).email_verified) {
				await getPrisma().userAccount.delete({where: {id: existingEmail.id}});
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
		await createSetting(user);
		await createNotificationPreference(user);

		// 7. Integration record olustur
		const integration = await createIntegration(
			user,
			'wca',
			payload.accessToken,
			payload.refreshToken,
			payload.expiresAt
		);
		if (payload.wcaId) {
			await updateIntegration(integration, {wca_id: payload.wcaId});
		}

		// 8. wca_pending cookie temizle + session cookie set et
		res.clearCookie(WCA_PENDING_COOKIE);

		const jwtToken = getJwtString(user);
		res.cookie('session', jwtToken, {
			httpOnly: true,
			maxAge: 315360000000, // 10 yil
		});

		notifyAdminsOfNewUser(user, 'wca').catch(err =>
			console.error('[AdminNotification] WCA signup notification failed:', err)
		);

		return sanitizeUser(user) as PublicUserAccount;
	}
}
