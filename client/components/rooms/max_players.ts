import {FriendlyRoomConst} from '../../../shared/friendly_room/consts';

/**
 * Capacities a room's settings may offer: never below the people already inside, never past
 * the system ceiling. The server clamps to the same range in updateRoom; this is so the
 * picker never offers a value that would be silently changed on save.
 */
export function maxPlayerChoices(participantCount: number): number[] {
	const floor = Math.max(FriendlyRoomConst.MIN_PLAYERS, participantCount);
	const choices: number[] = [];
	for (let n = floor; n <= FriendlyRoomConst.MAX_PLAYERS; n++) choices.push(n);
	return choices;
}
