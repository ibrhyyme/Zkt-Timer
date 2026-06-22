import {gql} from '@apollo/client';
import {gqlMutate} from '../components/api';

const HEARTBEAT_MUTATION = gql`
	mutation RecordActivityHeartbeat($path: String) {
		recordActivityHeartbeat(path: $path) {
			success
		}
	}
`;

const INTERVAL_MS = 60 * 1000;
const IDLE_THRESHOLD_MS = 3 * 60 * 1000;
// Route-change heartbeat debounce — only fire once the user settles on a page,
// so rapid navigation doesn't spam mutations. Pages visited <5s are skipped.
const ROUTE_SETTLE_MS = 5 * 1000;

let timer: number | null = null;
let started = false;
let lastActivityAt = 0;
let routeSettleTimer: number | null = null;

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
		const path = typeof window !== 'undefined' ? window.location.pathname : '';
		await gqlMutate(HEARTBEAT_MUTATION, {path});
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
	if (routeSettleTimer !== null) {
		window.clearTimeout(routeSettleTimer);
		routeSettleTimer = null;
	}
	started = false;
}

export function notifyUserActivity() {
	markActive();
}

// Call on route change so short visits (<60s tick) still get recorded against the
// page the user actually settled on. Debounced: only the page held for ROUTE_SETTLE_MS
// fires a heartbeat, so rapid navigation doesn't spam the server.
export function notifyRouteChange() {
	if (typeof window === 'undefined') return;
	markActive();
	if (routeSettleTimer !== null) {
		window.clearTimeout(routeSettleTimer);
	}
	routeSettleTimer = window.setTimeout(() => {
		routeSettleTimer = null;
		tick();
	}, ROUTE_SETTLE_MS);
}
