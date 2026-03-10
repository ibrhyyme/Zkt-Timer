import {io, Socket} from 'socket.io-client';
import {toastError} from '../toast';
import {SocketConst} from '../../shared/socket_costs';
import {ClientToServerEvents, ServerToClientEvents} from '../../../shared/match/socketio.types';
import {onVisibilityChange} from '../app-visibility';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
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

	socket = io(null, {
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
	}, SocketConst.CLIENT_RECONNECT_BEFORE_ALERT_TIMEOUT_MS);
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
