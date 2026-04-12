import { useEffect, useState } from 'react';

/**
 * Soft klavyenin acik olup olmadigini takip eder.
 * Capacitor KeyboardResize.None ile innerHeight stabil kaldigi icin
 * visualViewport.height ile farki > 150px oldugunda klavye acik kabul edilir.
 */
export function useKeyboardOpen(): boolean {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		function check() {
			const visibleHeight = vv?.height ?? window.innerHeight;
			const diff = window.innerHeight - visibleHeight;
			setOpen(diff > 150);
		}

		check();
		vv.addEventListener('resize', check);
		return () => vv.removeEventListener('resize', check);
	}, []);

	return open;
}
