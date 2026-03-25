import { isNative } from './platform';

// Keep Awake — cozum sirasinda ekran acik tutar
export async function keepScreenAwake(): Promise<void> {
	if (!isNative()) return;
	try {
		const { KeepAwake } = await import('@capacitor-community/keep-awake');
		await KeepAwake.keepAwake();
	} catch (e) {
		console.warn('[Native] keepAwake failed:', e);
	}
}

export async function allowScreenSleep(): Promise<void> {
	if (!isNative()) return;
	try {
		const { KeepAwake } = await import('@capacitor-community/keep-awake');
		await KeepAwake.allowSleep();
	} catch (e) {
		console.warn('[Native] allowSleep failed:', e);
	}
}

// Haptics — dokunsal geri bildirim
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
	if (!isNative()) return;
	try {
		const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
		const styleMap = {
			light: ImpactStyle.Light,
			medium: ImpactStyle.Medium,
			heavy: ImpactStyle.Heavy,
		};
		await Haptics.impact({ style: styleMap[style] });
	} catch (e) {
		// Sessizce basarisiz ol — haptic kritik degil
	}
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
	if (!isNative()) return;
	try {
		const { Haptics, NotificationType } = await import('@capacitor/haptics');
		const typeMap = {
			success: NotificationType.Success,
			warning: NotificationType.Warning,
			error: NotificationType.Error,
		};
		await Haptics.notification({ type: typeMap[type] });
	} catch (e) {
		// Sessizce basarisiz ol
	}
}

// Status Bar — koyu tema + arka plan rengi
export async function initStatusBar(): Promise<void> {
	if (!isNative()) return;
	try {
		const { StatusBar, Style } = await import('@capacitor/status-bar');
		await StatusBar.setStyle({ style: Style.Dark });
		await StatusBar.setBackgroundColor({ color: '#12141C' });
	} catch (e) {
		console.warn('[Native] StatusBar init failed:', e);
	}
}

// Text Zoom — iOS yazi boyutu kilidleme
export async function lockTextZoom(): Promise<void> {
	if (!isNative()) return;
	try {
		const { TextZoom } = await import('@capacitor/text-zoom');
		await TextZoom.set({ value: 1.0 });
	} catch (e) {
		console.warn('[Native] TextZoom lock failed:', e);
	}
}

// Safe Area — native safe area inset'lerini CSS env() degiskenlerine uygular
export async function initSafeArea(): Promise<void> {
	if (!isNative()) return;
	try {
		const { SafeArea } = await import('@capacitor-community/safe-area');
		await SafeArea.enable({
			config: {
				customColorsForSystemBars: false,
				statusBarColor: '#12141C',
				statusBarContent: 'light',
				navigationBarColor: '#12141C',
				navigationBarContent: 'light',
			},
		});
	} catch (e) {
		console.warn('[Native] SafeArea init failed:', e);
	}
}

// Network — baglanti durumu izleme
export async function initNetworkListener(
	onStatusChange: (connected: boolean) => void
): Promise<(() => void) | undefined> {
	if (!isNative()) return;
	try {
		const { Network } = await import('@capacitor/network');
		const handle = await Network.addListener('networkStatusChange', (status) => {
			console.log('[Native] Network status:', status.connected, status.connectionType);
			onStatusChange(status.connected);
		});
		return () => handle.remove();
	} catch (e) {
		console.warn('[Native] Network listener failed:', e);
	}
}

export async function getNetworkStatus(): Promise<boolean> {
	if (!isNative()) return navigator.onLine;
	try {
		const { Network } = await import('@capacitor/network');
		const status = await Network.getStatus();
		return status.connected;
	} catch (e) {
		return navigator.onLine;
	}
}

// Toast — native toast mesajlari
export async function showNativeToast(text: string, duration: 'short' | 'long' = 'short'): Promise<void> {
	if (!isNative()) return;
	try {
		const { Toast } = await import('@capacitor/toast');
		await Toast.show({ text, duration, position: 'bottom' });
	} catch (e) {
		// Fallback: web toast kullanilacak
	}
}

// Share — native paylasim dialog'u
export async function shareContent(options: { title: string; text: string; url?: string }): Promise<boolean> {
	if (!isNative()) {
		// Web Share API fallback
		if (navigator.share) {
			try {
				await navigator.share(options);
				return true;
			} catch (e) {
				return false;
			}
		}
		return false;
	}
	try {
		const { Share } = await import('@capacitor/share');
		await Share.share({
			title: options.title,
			text: options.text,
			url: options.url || 'https://zktimer.app',
			dialogTitle: options.title,
		});
		return true;
	} catch (e) {
		return false;
	}
}

// In-App Review — store degerlendirme istegi
let _reviewRequested = false;
export async function requestInAppReview(): Promise<void> {
	if (!isNative() || _reviewRequested) return;
	try {
		const { InAppReview } = await import('@capacitor-community/in-app-review');
		await InAppReview.requestReview();
		_reviewRequested = true;
	} catch (e) {
		console.warn('[Native] InAppReview failed:', e);
	}
}

// Local Notifications — yerel bildirim gonderme
export async function scheduleLocalNotification(options: {
	title: string;
	body: string;
	id?: number;
}): Promise<void> {
	if (!isNative()) {
		// Web Notification fallback
		if ('Notification' in window && Notification.permission === 'granted') {
			new Notification(options.title, { body: options.body, icon: '/favicon.ico' });
		}
		return;
	}
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		await LocalNotifications.schedule({
			notifications: [
				{
					title: options.title,
					body: options.body,
					id: options.id || Date.now(),
					schedule: { at: new Date(Date.now() + 100) },
				},
			],
		});
	} catch (e) {
		console.warn('[Native] LocalNotification failed:', e);
	}
}

export async function requestNotificationPermission(): Promise<boolean> {
	if (!isNative()) {
		if ('Notification' in window) {
			const result = await Notification.requestPermission();
			return result === 'granted';
		}
		return false;
	}
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		const perms = await LocalNotifications.checkPermissions();
		if (perms.display === 'granted') return true;
		const result = await LocalNotifications.requestPermissions();
		return result.display === 'granted';
	} catch (e) {
		return false;
	}
}
