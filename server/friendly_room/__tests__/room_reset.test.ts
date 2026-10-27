import {resetRoom, updateRoom} from '../room_manager';
import {getPrisma} from '../../database';

jest.mock('../../database');

const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

const OWNER = 'owner';
const MODERATOR = 'mod';
const MEMBER = 'member';

function participant(userId: string, isModerator = false) {
	return {
		id: `p-${userId}`,
		user_id: userId,
		user: {id: userId, username: userId},
		is_ready: true,
		is_spectator: false,
		is_moderator: isModerator,
		joined_at: new Date(),
		solves: [],
	};
}

/** A room row shaped like getRoom() returns it, a few rounds in. */
function roomRow(overrides: Record<string, any> = {}) {
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
		scramble_index: 7,
		scramble_history: [],
		participants: [participant(OWNER), participant(MODERATOR, true), participant(MEMBER)],
		...overrides,
	};
}

// Each query builder returns a tagged description so the test can read the transaction
// the way Prisma would receive it.
function stub(room: any) {
	const transaction = jest.fn().mockResolvedValue([]);
	const roomUpdate = jest.fn((args) => ({op: 'room.update', args}));
	mockedGetPrisma.mockReturnValue({
		$transaction: transaction,
		friendlyRoom: {findUnique: jest.fn().mockResolvedValue(room), update: roomUpdate},
		friendlyRoomSolve: {deleteMany: jest.fn((args) => ({op: 'solve.deleteMany', args}))},
		friendlyRoomScramble: {
			deleteMany: jest.fn((args) => ({op: 'scramble.deleteMany', args})),
			create: jest.fn((args) => ({op: 'scramble.create', args})),
		},
	} as any);
	return {transaction, roomUpdate};
}

function resetOps(transaction: jest.Mock) {
	expect(transaction).toHaveBeenCalledTimes(1);
	return transaction.mock.calls[0][0];
}

beforeEach(() => jest.clearAllMocks());

describe('resetRoom', () => {
	it('clears every solve and round and opens round 1 in one transaction', async () => {
		const {transaction} = stub(roomRow());

		expect(await resetRoom('room1', OWNER)).not.toBeNull();

		const [solves, scrambles, room, round1] = resetOps(transaction);
		expect(solves).toEqual({op: 'solve.deleteMany', args: {where: {room_id: 'room1'}}});
		expect(scrambles).toEqual({op: 'scramble.deleteMany', args: {where: {room_id: 'room1'}}});
		expect(room.op).toBe('room.update');
		expect(room.args.data.scramble_index).toBe(1);
		expect(typeof room.args.data.current_scramble).toBe('string');
		expect(room.args.data.current_scramble.length).toBeGreaterThan(0);
		expect(round1).toEqual({
			op: 'scramble.create',
			args: {data: {room_id: 'room1', scramble_index: 1, scramble: room.args.data.current_scramble}},
		});
	});

	it('keeps the event, the status and everything else about the room', async () => {
		const {transaction} = stub(roomRow({cube_type: 'fto'}));

		await resetRoom('room1', OWNER);

		const [, , room] = resetOps(transaction);
		expect(Object.keys(room.args.data).sort()).toEqual(['current_scramble', 'scramble_index']);
	});

	it('lets a moderator reset, the same as switching the event', async () => {
		const {transaction} = stub(roomRow());
		expect(await resetRoom('room1', MODERATOR)).not.toBeNull();
		expect(transaction).toHaveBeenCalledTimes(1);
	});

	it('lets a site admin reset a room they are not in', async () => {
		const {transaction} = stub(roomRow());
		expect(await resetRoom('room1', 'site-admin', true)).not.toBeNull();
		expect(transaction).toHaveBeenCalledTimes(1);
	});

	it('refuses a plain participant and an outsider without touching the room', async () => {
		const {transaction} = stub(roomRow());
		expect(await resetRoom('room1', MEMBER)).toBeNull();
		expect(await resetRoom('room1', 'stranger')).toBeNull();
		expect(transaction).not.toHaveBeenCalled();
	});

	it('returns null for a room that does not exist', async () => {
		const {transaction} = stub(null);
		expect(await resetRoom('missing', OWNER)).toBeNull();
		expect(transaction).not.toHaveBeenCalled();
	});
});

describe('updateRoom event change', () => {
	it('resets through the same transaction and writes the new event with it', async () => {
		const {transaction} = stub(roomRow());

		await updateRoom('room1', OWNER, {cube_type: '777'});

		const [solves, scrambles, room, round1] = resetOps(transaction);
		expect(solves.op).toBe('solve.deleteMany');
		expect(scrambles.op).toBe('scramble.deleteMany');
		expect(room.args.data).toMatchObject({cube_type: '777', scramble_index: 1});
		expect(round1.args.data.scramble).toBe(room.args.data.current_scramble);
	});

	it('leaves the rounds alone when the event does not change', async () => {
		const {transaction, roomUpdate} = stub(roomRow());

		await updateRoom('room1', OWNER, {name: 'Renamed', cube_type: '333'});

		expect(transaction).not.toHaveBeenCalled();
		expect(roomUpdate).toHaveBeenCalledWith({where: {id: 'room1'}, data: {name: 'Renamed'}});
	});
});
