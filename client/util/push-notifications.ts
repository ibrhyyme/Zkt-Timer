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

	PushNotifications.addListener('pushNotificationReceived', (notification) => {
		console.log('[Push] Notification received in foreground:', notification);
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

		onMessage(messaging, (payload) => {
			console.log('[Push] Web foreground message:', payload);
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
