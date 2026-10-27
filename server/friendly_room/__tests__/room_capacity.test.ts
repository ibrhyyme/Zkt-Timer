import * as bcrypt from 'bcryptjs';
import {addParticipant, updateRoom} from '../room_manager';
import {getPrisma} from '../../database';
import {FriendlyRoomConst, FriendlyRoomJoinSignal} from '../../../shared/friendly_room/consts';

jest.mock('../../database');

const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

const OWNER = 'owner';
const PASSWORD = 'secret';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

function participant(userId: string) {
	return {
		id: `p-${userId}`,
		user_id: userId,
		user: {id: userId, username: userId},
		is_ready: false,
		is_spectator: false,
		is_moderator: false,
		joined_at: new Date(),
		solves: [],
	};
}

/** A room row shaped like getRoom() returns it, with `count` people already inside. */
function roomRow(count: number, overrides: Record<string, any> = {}) {
	const participants = [participant(OWNER)];
	for (let i = 1; i < count; i++) participants.push(participant(`user${i}`));
	return {
		id: 'room1',
		slug: 'room-1',
		name: 'Room',
		status: 'ACTIVE',
		cube_type: '333',
		max_players: 8,
		is_private: false,
		password: null,
		created_by_id: OWNER,
		created_by: {id: OWNER, username: OWNER},
		created_at: new Date(),
		allowed_timer_types: ['keyboard'],
		current_scramble: 'R U',
		scramble_index: 1,
		scramble_history: [],
		participants,
		...overrides,
	};
}

function stub(room: any) {
	const create = jest.fn().mockResolvedValue({});
	const update = jest.fn().mockResolvedValue({});
	mockedGetPrisma.mockReturnValue({
		friendlyRoom: {findUnique: jest.fn().mockResolvedValue(room), update},
		friendlyRoomParticipant: {create},
	} as any);
	return {create, update};
}

const newcomer = {id: 'newcomer', username: 'newcomer'} as any;

beforeEach(() => jest.clearAllMocks());

describe('addParticipant capacity', () => {
	it('joins a room that has space', async () => {
		const {create} = stub(roomRow(3));
		await addParticipant('room1', newcomer);
		expect(create).toHaveBeenCalled();
	});

	it('asks the owner instead of refusing when the room is at its own capacity', async () => {
		const {create} = stub(roomRow(8));
		await expect(addParticipant('room1', newcomer)).rejects.toThrow(FriendlyRoomJoinSignal.REQUEST_REQUIRED);
		expect(create).not.toHaveBeenCalled();
	});

	it('checks the password before turning a full private room into a request', async () => {
		// A wrong password must never reach the owner as a request.
		stub(roomRow(8, {is_private: true, password: PASSWORD_HASH}));
		await expect(addParticipant('room1', newcomer, 'wrong')).rejects.toThrow('Invalid password');
		await expect(addParticipant('room1', newcomer)).rejects.toThrow('Password required');
		await expect(addParticipant('room1', newcomer, PASSWORD)).rejects.toThrow(FriendlyRoomJoinSignal.REQUEST_REQUIRED);
	});

	it('lets an approved user in past the room capacity, without the password again', async () => {
		const {create} = stub(roomRow(8, {is_private: true, password: PASSWORD_HASH}));
		await addParticipant('room1', newcomer, undefined, {approved: true});
		expect(create).toHaveBeenCalled();
	});

	it('never goes past the system ceiling, approved or not', async () => {
		stub(roomRow(FriendlyRoomConst.MAX_PLAYERS, {max_players: FriendlyRoomConst.MAX_PLAYERS}));
		await expect(addParticipant('room1', newcomer, undefined, {approved: true})).rejects.toThrow(
			FriendlyRoomJoinSignal.HARD_LIMIT
		);
		stub(roomRow(FriendlyRoomConst.MAX_PLAYERS));
		await expect(addParticipant('room1', newcomer)).rejects.toThrow(FriendlyRoomJoinSignal.HARD_LIMIT);
	});

	it('still lets someone already inside reconnect to a full room', async () => {
		const {create} = stub(roomRow(8));
		const result = await addParticipant('room1', {id: 'user3', username: 'user3'} as any);
		expect(result.isNew).toBe(false);
		expect(create).not.toHaveBeenCalled();
	});
});

describe('updateRoom capacity', () => {
	it('keeps capacity between the head count and the system ceiling', async () => {
		const {update} = stub(roomRow(9));
		await updateRoom('room1', OWNER, {max_players: 8});
		expect(update.mock.calls[0][0].data.max_players).toBe(9);

		const second = stub(roomRow(3));
		await updateRoom('room1', OWNER, {max_players: 99});
		expect(second.update.mock.calls[0][0].data.max_players).toBe(FriendlyRoomConst.MAX_PLAYERS);
	});

	it('leaves capacity alone when the update does not mention it', async () => {
		const {update} = stub(roomRow(3));
		await updateRoom('room1', OWNER, {name: 'Renamed'});
		expect(update.mock.calls[0][0].data).not.toHaveProperty('max_players');
	});

	it('refuses a capacity change from someone who is not a manager', async () => {
		const {update} = stub(roomRow(3));
		await updateRoom('room1', 'user1', {max_players: 12});
		expect(update).not.toHaveBeenCalled();
	});
});
