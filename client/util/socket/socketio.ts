import {io, Socket} from 'socket.io-client';
import {toastError} from '../toast';
import {onVisibilityChange} from '../app-visibility';
import {isNative} from '../platform';
import {getApiBase} from '../api-base';
import {getSessionToken} from '../auth/session-token';

const CLIENT_RECONNECT_BEFORE_ALERT_TIMEOUT_MS = 5000;

// Native connects cross-origin from the local bundle: needs the absolute server URL,
// cookies where they still exist (old binaries), and the session JWT via the Socket.IO
// auth payload (server falls back to it when the handshake has no cookie). On web this
// resolves to the page origin with default options — behavior unchanged.
function socketTarget(): string {
	return getApiBase();
}

function socketOptions(extra: Record<string, any> = {}): Record<string, any> {
	if (typeof window === 'undefined' || !isNative()) {
		return extra;
	}

	return {
		...extra,
		withCredentials: true,
		auth: (cb: (data: Record<string, any>) => void) => {
			getSessionToken()
				.then((token) => cb(token ? {token} : {}))
				.catch(() => cb({}));
		},
	};
}

// Guard module-scope socket creation: this file is imported on the server via the
// SSR route table (Routes.ts -> FriendlyRoom -> socketio), and io() would open a stray
// client connection during server render. socketClient() is only called in the browser.
let socket: Socket = typeof window !== 'undefined' ? io(socketTarget(), socketOptions()) : (null as any);
let initiated = false;
let rooms = [];
let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
let disconnectedByVisibility = false;
const BACKGROUND_GRACE_MS = 5000;

// Arka plana gecildiginde 5s sonra disconnect, on plana donulunce reconnect
onVisibilityChange((visible) => {
	if (!visible) {
		backgroundTimer = setTimeout(() => {
			if (socket?.connected) {
				disconnectedByVisibility = true;
				socket.disconnect();
			}
		}, BACKGROUND_GRACE_MS);
	} else {
		if (backgroundTimer) {
			clearTimeout(backgroundTimer);
			backgroundTimer = null;
		}
		if (disconnectedByVisibility && socket && !socket.connected) {
			disconnectedByVisibility = false;
			socket.connect();
		}
	}
});

export function initSocketIO() {
	if (socket) {
		return;
	}

	socket = io(socketTarget(), socketOptions({forceNew: true}));

	socketClient().on('myRoomsUpdated', updateRooms);
	socketClient().on('connect', onReconnect);
	socketClient().on('disconnect', onDisconnect);
}

function onDisconnect() {
	if (isSocketConnected() || disconnectedByVisibility) {
		return;
	}

	setTimeout(() => {
		// TODO FUTURE investigate this
		if (socket && !socket.connected && !disconnectedByVisibility) {
			toastError('Lost connection to server. Please check your connection to the Internet.');
		}
	}, CLIENT_RECONNECT_BEFORE_ALERT_TIMEOUT_MS);
}

function updateRooms(r) {
	rooms = r;
}

function onReconnect() {
	if (!initiated) {
		initiated = true;
		return;
	}

	socketClient().emit('rejoinMyRooms', rooms);
}

export function isSocketConnected() {
	return socket.connected;
}

export function socketClient() {
	return socket;
}
