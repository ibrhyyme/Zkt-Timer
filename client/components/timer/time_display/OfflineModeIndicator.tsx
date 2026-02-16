import React, { useEffect, useState } from 'react';

export default function OfflineModeIndicator() {
	const [isOffline, setIsOffline] = useState(
		typeof navigator !== 'undefined' ? !navigator.onLine : false
	);

	useEffect(() => {
		const goOffline = () => setIsOffline(true);
		const goOnline = () => setIsOffline(false);

		window.addEventListener('offline', goOffline);
		window.addEventListener('online', goOnline);

		return () => {
			window.removeEventListener('offline', goOffline);
			window.removeEventListener('online', goOnline);
		};
	}, []);

	if (!isOffline) {
		return null;
	}

	return (
		<div className="offline-mode-indicator">
			Offline Mode
		</div>
	);
}
