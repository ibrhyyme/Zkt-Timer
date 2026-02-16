import React, { useEffect, useState, useRef } from 'react';
import './OfflineAlert.scss';
import { useEventListener } from '../../../util/event_handler';

let bannerShownThisOfflinePeriod = false;

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => { bannerShownThisOfflinePeriod = false; });
}

export default function OfflineAlert() {
	const [visible, setVisible] = useState(false);
	const hideTimer = useRef(null);

	useEventListener('solveDbUpdatedEvent', () => {
		if (navigator.onLine || bannerShownThisOfflinePeriod) return;

		bannerShownThisOfflinePeriod = true;
		setVisible(true);

		if (hideTimer.current) clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => {
			setVisible(false);
		}, 5000);
	});

	useEffect(() => {
		function handleOnline() {
			setVisible(false);
			if (hideTimer.current) clearTimeout(hideTimer.current);
		}

		window.addEventListener('online', handleOnline);

		return () => {
			window.removeEventListener('online', handleOnline);
			if (hideTimer.current) clearTimeout(hideTimer.current);
		};
	}, []);

	if (!visible) return null;

	return (
		<div className="cd-offline">
			<p>Çevrimdışısınız. Çözümleriniz kaydediliyor, internet bağlandığında senkronize edilecek.</p>
		</div>
	);
}
