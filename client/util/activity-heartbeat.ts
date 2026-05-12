import {gql} from '@apollo/client';
import {gqlMutate} from '../components/api';

const HEARTBEAT_MUTATION = gql`
	mutation RecordActivityHeartbeat {
		recordActivityHeartbeat {
			success
		}
	}
`;

const INTERVAL_MS = 60 * 1000;
const IDLE_THRESHOLD_MS = 3 * 60 * 1000;

let timer: number | null = null;
let started = false;
let lastActivityAt = 0;

function markActive() {
	lastActivityAt = Date.now();
}

function isUserEngaged(): boolean {
	if (typeof document === 'undefined') return false;
	if (document.visibilityState !== 'visible') return false;
	return Date.now() - lastActivityAt <= IDLE_THRESHOLD_MS;
}

async function tick() {
	if (!isUserEngaged()) return;

	try {
		await gqlMutate(HEARTBEAT_MUTATION, {});
	} catch {
		// Sessizce gec — heartbeat best-effort
	}
}

export function startActivityHeartbeat() {
	if (started) return;
	if (typeof window === 'undefined') return;
	started = true;

	lastActivityAt = Date.now();

	const events: Array<keyof DocumentEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
	for (const ev of events) {
		document.addEventListener(ev, markActive, {passive: true});
	}

	// Ilk tetikleyicide 5sn sonra ilk heartbeat — sayfa yuklenir yuklenmez gondermez
	window.setTimeout(() => tick(), 5000);

	timer = window.setInterval(tick, INTERVAL_MS);

	// Sekme tekrar gorunur olunca aktivite zamanini guncelle ve anlik bir heartbeat at
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			markActive();
			tick();
		}
	});
}

export function stopActivityHeartbeat() {
	if (timer !== null) {
		window.clearInterval(timer);
		timer = null;
	}
	started = false;
}

export function notifyUserActivity() {
	markActive();
}
