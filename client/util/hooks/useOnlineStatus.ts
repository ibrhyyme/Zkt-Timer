import {useEffect, useState} from 'react';

// Reactive navigator.onLine: re-renders on browser online/offline events.
// SSR-safe (defaults to online so server markup never shows the offline state).
export function useOnlineStatus(): boolean {
	const [online, setOnline] = useState<boolean>(() =>
		typeof navigator === 'undefined' ? true : navigator.onLine !== false
	);

	useEffect(() => {
		const handleOnline = () => setOnline(true);
		const handleOffline = () => setOnline(false);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	return online;
}
