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

let timer: number | null = null;
let started = false;

async function tick() {
	// Sadece sekme onde ise (visibility) — arka planda heartbeat atma
	if (typeof document === 'undefined') return;
	if (document.visibilityState !== 'visible') return;

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

	// Ilk tetikleyicide 5sn sonra ilk heartbeat — sayfa yuklenir yuklenmez gondermez
	window.setTimeout(() => tick(), 5000);

	timer = window.setInterval(tick, INTERVAL_MS);

	// Sekme tekrar gorunur olunca anlik bir heartbeat at
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') tick();
	});
}

export function stopActivityHeartbeat() {
	if (timer !== null) {
		window.clearInterval(timer);
		timer = null;
	}
	started = false;
}
