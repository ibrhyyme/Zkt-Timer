import {io, Socket} from 'socket.io-client';
import {toastError} from '../toast';
import {onVisibilityChange} from '../app-visibility';
import {getApiBase} from '../api-base';

const CLIENT_RECONNECT_BEFORE_ALERT_TIMEOUT_MS = 5000;

let socket: Socket = io(getApiBase() || undefined);
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

	socket = io(getApiBase() || undefined, {
		forceNew: true,
	});

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
