// Mobil cihaz tespiti — referans `device.js` portu.
// SSR safety: navigator/window olmadığı durumda false döner.
export const isMobile: boolean = (() => {
	if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
	const ua = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	const touch = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
	return ua || touch;
})();
