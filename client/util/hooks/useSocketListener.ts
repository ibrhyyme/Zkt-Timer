import { useEffect, useRef } from 'react';
import { socketClient } from '../socket/socketio';

export function useSocketListener(
	event: string,
	handler: (...args: any[]) => void,
	deps: any[] = []
) {
	const savedHandler = useRef<((...args: any[]) => void) | undefined>(undefined);

	useEffect(() => {
		savedHandler.current = handler;
	}, [handler]);

	useEffect(() => {
		socketClient().on(event, handler as any);

		return () => {
			socketClient().off(event, handler as any);
		};
	}, [event, ...deps]);
}
