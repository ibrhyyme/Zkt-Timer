// ZKT Unofficial Competition Socket Events

export enum ZktCompClientEvent {
	JOIN_COMP = 'zktCompJoin',
	LEAVE_COMP = 'zktCompLeave',
	JOIN_LIST = 'zktCompJoinList',
	LEAVE_LIST = 'zktCompLeaveList',
}

export enum ZktCompServerEvent {
	RESULT_UPDATED = 'zktCompResultUpdated',
	RESULT_DELETED = 'zktCompResultDeleted',
	ROUND_STATUS_CHANGED = 'zktCompRoundStatusChanged',
	COMP_STATUS_CHANGED = 'zktCompStatusChanged',
	REGISTRATION_UPDATED = 'zktCompRegistrationUpdated',
	ASSIGNMENT_UPDATED = 'zktCompAssignmentUpdated',
	LIST_CHANGED = 'zktCompListChanged',
	ERROR = 'zktCompError',
}

export const ZktCompSocketRoom = {
	COMP_PREFIX: 'zkt_comp_',
	LIST: 'zkt_comp_list',
};

export function getZktCompSocketRoom(competitionId: string): string {
	return `${ZktCompSocketRoom.COMP_PREFIX}${competitionId}`;
}
