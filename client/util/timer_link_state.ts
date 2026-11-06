import {useEffect, useState} from 'react';

// Whether a Bluetooth timer is on the link right now, for anything that shows it without owning
// the connection (the left drawer's dot). The timer page and the friendly room each hold their
// own connection object, so this is fed from the one place both go through: connectGanTimer and
// connectQiyiTimer.

export type TimerLink = 'gantimer' | 'qiyitimer';

// Both timer libraries emit their disconnect as state 0 (GanTimerState, QiyiTimerState.DISCONNECT).
const DISCONNECT_STATE = 0;

interface LinkEvents {
	events$: {subscribe(next: (event: {state: number}) => void): {unsubscribe(): void}};
}

const connected: Record<TimerLink, unknown> = {gantimer: null, qiyitimer: null};
const listeners = new Set<() => void>();

function notify() {
	listeners.forEach((listener) => listener());
}

export function isTimerLinkConnected(link: TimerLink): boolean {
	return connected[link] !== null;
}

/** Marks the timer connected until this connection reports its disconnect, and returns it. */
export function trackTimerLink<T extends LinkEvents>(link: TimerLink, connection: T): T {
	connected[link] = connection;
	notify();
	const subscription = connection.events$.subscribe((event) => {
		if (event.state !== DISCONNECT_STATE) return;
		subscription?.unsubscribe();
		// A late disconnect from the previous connection must not clear a newer one.
		if (connected[link] !== connection) return;
		connected[link] = null;
		notify();
	});
	return connection;
}

export function useTimerLinkConnected(link: TimerLink): boolean {
	const [value, setValue] = useState(() => isTimerLinkConnected(link));
	useEffect(() => {
		const listener = () => setValue(isTimerLinkConnected(link));
		listeners.add(listener);
		listener();
		return () => {
			listeners.delete(listener);
		};
	}, [link]);
	return value;
}
