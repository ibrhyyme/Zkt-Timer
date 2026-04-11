import { Capacitor } from '@capacitor/core';
import { gql } from '@apollo/client';
import { gqlMutate } from '../components/api';

const REGISTER_PUSH_TOKEN = gql`
	mutation RegisterPushToken($input: RegisterPushTokenInput) {
		registerPushToken(input: $input) {
			success
		}
	}
`;

async function registerTokenWithBackend(token: string, platform: string): Promise<void> {
	try {
		await gqlMutate(REGISTER_PUSH_TOKEN, {
			input: { token, platform },
		});
		console.log('[Push] Token registered:', platform);
	} catch (error) {
		console.error('[Push] Failed to register token:', error);
	}
}

async function showLocalNotification(title: string, body: string, data?: any): Promise<void> {
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		// Permission'i ilk seferinde iste
		const perm = await LocalNotifications.checkPermissions();
		if (perm.display !== 'granted') {
			const req = await LocalNotifications.requestPermissions();
			if (req.display !== 'granted') return;
		}

		await LocalNotifications.schedule({
			notifications: [
				{
					id: Date.now() % 2147483647, // 32-bit int
					title,
					body,
					extra: data || {},
					schedule: {at: new Date(Date.now() + 100)}, // hemen
				},
			],
		});
	} catch (err) {
		console.error('[Push] LocalNotification show failed:', err);
	}
}

async function initNativePush(): Promise<void> {
	const { PushNotifications } = await import('@capacitor/push-notifications');

	const permResult = await PushNotifications.requestPermissions();
	if (permResult.receive !== 'granted') {
		console.log('[Push] Native push permission denied');
		return;
	}

	await PushNotifications.register();

	PushNotifications.addListener('registration', (token) => {
		const platform = Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID';
		registerTokenWithBackend(token.value, platform);
	});

	PushNotifications.addListener('registrationError', (error) => {
		console.error('[Push] Native registration error:', error);
	});

	// Foreground'da iken bildirim geldiginde:
	// PushNotifications plugin foreground'da bildirim gostermez (hem iOS hem Android).
	// LocalNotifications plugin ile manuel goster — bu plugin iOS'ta da foreground'da
	// otomatik bildirim gosterir (UNUserNotificationCenterDelegate.willPresent default).
	// Bu yaklasim native build/store gerektirmez, plugin zaten compile edilmis.
	PushNotifications.addListener('pushNotificationReceived', (notification) => {
		console.log('[Push] Notification received in foreground:', notification);
		const title = notification.title || 'Zkt-Timer';
		const body = notification.body || '';
		showLocalNotification(title, body, notification.data);
	});

	PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
		console.log('[Push] Notification action:', action);
	});
}

async function initWebPush(): Promise<void> {
	if (!('Notification' in window) || !('serviceWorker' in navigator)) {
		console.log('[Push] Web push not supported');
		return;
	}

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		console.log('[Push] Web push permission denied');
		return;
	}

	try {
		const { initializeApp } = await import('firebase/app');
		const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

		const firebaseConfig = {
			apiKey: process.env.FIREBASE_WEB_API_KEY,
			projectId: process.env.FIREBASE_PROJECT_ID,
			messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
			appId: process.env.FIREBASE_APP_ID,
		};

		const app = initializeApp(firebaseConfig);
		const messaging = getMessaging(app);

		const swRegistration = await navigator.serviceWorker.ready;

		const token = await getToken(messaging, {
			vapidKey: process.env.FIREBASE_VAPID_KEY,
			serviceWorkerRegistration: swRegistration,
		});

		if (token) {
			await registerTokenWithBackend(token, 'WEB');
		}

		// Web foreground'da gelen FCM mesajlarini browser Notification API ile manuel goster
		// (FCM web SDK foreground'da otomatik gostermez)
		onMessage(messaging, (payload) => {
			console.log('[Push] Web foreground message:', payload);
			try {
				if (Notification.permission !== 'granted') return;

				const title = payload.notification?.title || 'Zkt-Timer';
				const body = payload.notification?.body || '';
				const tag = (payload.data?.type as string) || 'default';
				const link = (payload.data?.competitionId as string)
					? `/community/competitions/${payload.data?.competitionId}/wca-live`
					: '/';

				const notif = new Notification(title, {
					body,
					icon: '/favicon-192.png',
					badge: '/favicon-96.png',
					tag, // ayni tag bildirimleri grupla
					data: payload.data,
				});

				notif.onclick = () => {
					window.focus();
					if (link) window.location.href = link;
					notif.close();
				};
			} catch (err) {
				console.error('[Push] Web foreground notification show failed:', err);
			}
		});
	} catch (error) {
		console.error('[Push] Web push init error:', error);
	}
}

export async function initPushNotifications(): Promise<void> {
	try {
		if (Capacitor.isNativePlatform()) {
			await initNativePush();
		} else {
			await initWebPush();
		}
	} catch (error) {
		console.error('[Push] Init error:', error);
	}
}
