import { useEffect, useRef } from 'react';

/**
 * Sayfa yüklendiğinde viewport yüksekliğini yakalar ve --stable-vh CSS değişkenine yazar.
 * Klavye açılınca oluşan viewport küçülmesini yok sayar.
 * Sadece oryantasyon değişikliği veya belirgin boyut farkında (>150px) günceller.
 */
export function useStableViewportHeight() {
	const stableHeight = useRef<number>(0);

	useEffect(() => {
		function getViewportHeight(): number {
			return window.visualViewport?.height ?? window.innerHeight;
		}

		function setStableHeight(h: number) {
			stableHeight.current = h;
			document.documentElement.style.setProperty('--stable-vh', `${h}px`);
		}

		// İlk yüksekliği yakala
		setStableHeight(getViewportHeight());

		function onResize() {
			const currentHeight = getViewportHeight();
			const diff = Math.abs(currentHeight - stableHeight.current);

			// Küçük farklar (< 150px) klavye açılması/kapanmasıdır → yoksay
			// Büyük farklar oryantasyon değişikliği veya gerçek resize → güncelle
			if (diff > 150) {
				setStableHeight(currentHeight);
			}
		}

		// Oryantasyon değişikliğinde her zaman güncelle
		function onOrientationChange() {
			setTimeout(() => {
				setStableHeight(getViewportHeight());
			}, 200);
		}

		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', onResize);
		} else {
			window.addEventListener('resize', onResize);
		}
		window.addEventListener('orientationchange', onOrientationChange);

		return () => {
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', onResize);
			} else {
				window.removeEventListener('resize', onResize);
			}
			window.removeEventListener('orientationchange', onOrientationChange);
		};
	}, []);
}
