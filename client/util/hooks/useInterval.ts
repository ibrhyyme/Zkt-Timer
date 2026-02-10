import { useEffect, useRef } from 'react';

function useInterval<T extends () => void>(callback: T, delay: number) {
	const savedCallback = useRef<T | undefined>(undefined);

	useEffect(() => {
		savedCallback.current = callback;
	}, [callback]);

	useEffect(() => {
		function tick() {
			savedCallback.current();
		}

		const id = setInterval(tick, delay);
		return () => clearInterval(id);
	}, [delay]);
}
