import {Socket} from 'socket.io';
import {getSocketIO} from '../services/socket';
import {joinRoom, leaveRoom} from '../services/socket_util';
import {
	ZktCompClientEvent,
	ZktCompServerEvent,
	getZktCompSocketRoom,
} from '../../shared/zkt_competition';
import {logger} from '../services/logger';

const io = (): any => getSocketIO();

export function listenForZktCompEvents(client: Socket) {
	client.on(ZktCompClientEvent.JOIN_COMP, (competitionId: string) => {
		if (!competitionId) return;
		const room = getZktCompSocketRoom(competitionId);
		joinRoom(client, room);
	});

	client.on(ZktCompClientEvent.LEAVE_COMP, (competitionId: string) => {
		if (!competitionId) return;
		const room = getZktCompSocketRoom(competitionId);
		leaveRoom(client, room);
	});
}

// ============================================================================
// EMIT HELPERS (called from resolvers)
// ============================================================================

export function emitZktResultUpdated(
	competitionId: string,
	payload: {roundId: string; resultId: string; userId: string}
) {
	try {
		const room = getZktCompSocketRoom(competitionId);
		io().to(room).emit(ZktCompServerEvent.RESULT_UPDATED, payload);
	} catch (err) {
		logger.warn('Failed to emit zkt result updated', {competitionId, err});
	}
}

export function emitZktResultDeleted(
	competitionId: string,
	payload: {roundId: string; resultId: string; userId: string}
) {
	try {
		const room = getZktCompSocketRoom(competitionId);
		io().to(room).emit(ZktCompServerEvent.RESULT_DELETED, payload);
	} catch (err) {
		logger.warn('Failed to emit zkt result deleted', {competitionId, err});
	}
}

export function emitZktRoundStatusChanged(
	competitionId: string,
	payload: {roundId: string; status: string}
) {
	try {
		const room = getZktCompSocketRoom(competitionId);
		io().to(room).emit(ZktCompServerEvent.ROUND_STATUS_CHANGED, payload);
	} catch (err) {
		logger.warn('Failed to emit zkt round status changed', {competitionId, err});
	}
}

export function emitZktCompStatusChanged(
	competitionId: string,
	status: string
) {
	try {
		const room = getZktCompSocketRoom(competitionId);
		io().to(room).emit(ZktCompServerEvent.COMP_STATUS_CHANGED, {competitionId, status});
	} catch (err) {
		logger.warn('Failed to emit zkt comp status changed', {competitionId, err});
	}
}

export function emitZktRegistrationUpdated(
	competitionId: string,
	payload: {registrationId: string; status: string}
) {
	try {
		const room = getZktCompSocketRoom(competitionId);
		io().to(room).emit(ZktCompServerEvent.REGISTRATION_UPDATED, {competitionId, ...payload});
	} catch (err) {
		logger.warn('Failed to emit zkt registration updated', {competitionId, err});
	}
}

export function emitZktAssignmentUpdated(
	competitionId: string,
	payload: {roundId: string; groupId?: string; userId: string}
) {
	try {
		const room = getZktCompSocketRoom(competitionId);
		io().to(room).emit(ZktCompServerEvent.ASSIGNMENT_UPDATED, {competitionId, ...payload});
	} catch (err) {
		logger.warn('Failed to emit zkt assignment updated', {competitionId, err});
	}
}
