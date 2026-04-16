// ZKT Unofficial Competition Socket Events

export enum ZktCompClientEvent {
	JOIN_COMP = 'zktCompJoin',
	LEAVE_COMP = 'zktCompLeave',
}

export enum ZktCompServerEvent {
	RESULT_UPDATED = 'zktCompResultUpdated',
	RESULT_DELETED = 'zktCompResultDeleted',
	ROUND_STATUS_CHANGED = 'zktCompRoundStatusChanged',
	COMP_STATUS_CHANGED = 'zktCompStatusChanged',
	REGISTRATION_UPDATED = 'zktCompRegistrationUpdated',
	ASSIGNMENT_UPDATED = 'zktCompAssignmentUpdated',
	ERROR = 'zktCompError',
}

export const ZktCompSocketRoom = {
	COMP_PREFIX: 'zkt_comp_',
};

export function getZktCompSocketRoom(competitionId: string): string {
	return `${ZktCompSocketRoom.COMP_PREFIX}${competitionId}`;
}
