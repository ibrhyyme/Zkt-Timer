type VisibilityCallback = (visible: boolean) => void;

const listeners = new Set<VisibilityCallback>();
let currentlyVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

function handleVisibilityChange() {
	const visible = document.visibilityState === 'visible';
	if (visible === currentlyVisible) return;
	currentlyVisible = visible;
	listeners.forEach((cb) => cb(visible));
}

if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function isAppVisible(): boolean {
	return currentlyVisible;
}

export function onVisibilityChange(callback: VisibilityCallback): () => void {
	listeners.add(callback);
	return () => {
		listeners.delete(callback);
	};
}
