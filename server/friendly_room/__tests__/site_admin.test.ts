import {getSiteAdminIds, nextScramble, startRoom, transferOwnership} from '../room_manager';
import {getPrisma} from '../../database';

jest.mock('../../database');

const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

const OWNER = 'owner';
const MEMBER = 'member';
const ADMIN = 'site-admin';

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

function roomRow() {
	return {
		id: 'room1',
		slug: 'room-1',
		name: 'Room',
		status: 'WAITING',
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
		participants: [participant(OWNER), participant(MEMBER), participant(ADMIN)],
	};
}

function stub() {
	const update = jest.fn().mockResolvedValue({});
	const transaction = jest.fn().mockResolvedValue([]);
	const findMany = jest.fn().mockResolvedValue([{id: ADMIN}]);
	mockedGetPrisma.mockReturnValue({
		$transaction: transaction,
		friendlyRoom: {findUnique: jest.fn().mockResolvedValue(roomRow()), update},
		friendlyRoomScramble: {create: jest.fn()},
		userAccount: {findMany},
	} as any);
	return {update, transaction, findMany};
}

beforeEach(() => jest.clearAllMocks());

describe('site admin room controls', () => {
	it('lets a site admin start the room, and not a plain participant', async () => {
		const {update} = stub();
		expect(await startRoom('room1', MEMBER)).toBeNull();
		expect(update).not.toHaveBeenCalled();

		expect(await startRoom('room1', ADMIN, true)).not.toBeNull();
		expect(update).toHaveBeenCalled();
	});

	it('lets a site admin advance the scramble, and not a plain participant', async () => {
		const {transaction} = stub();
		expect(await nextScramble('room1', MEMBER)).toBeNull();
		expect(transaction).not.toHaveBeenCalled();

		expect(await nextScramble('room1', ADMIN, true)).not.toBeNull();
		expect(transaction).toHaveBeenCalled();
	});

	it('lets a site admin hand the room to someone else or take it', async () => {
		const {update} = stub();
		await transferOwnership('room1', ADMIN, MEMBER, true);
		expect(update.mock.calls[0][0].data.created_by_id).toBe(MEMBER);

		await transferOwnership('room1', ADMIN, ADMIN, true);
		expect(update.mock.calls[1][0].data.created_by_id).toBe(ADMIN);
	});

	it('keeps ownership transfer closed to everyone else', async () => {
		const {update} = stub();
		expect(await transferOwnership('room1', MEMBER, MEMBER)).toBeNull();
		expect(await transferOwnership('room1', MEMBER, ADMIN)).toBeNull();
		expect(update).not.toHaveBeenCalled();
	});

	it('still lets the owner transfer, but not to the owner', async () => {
		const {update} = stub();
		expect(await transferOwnership('room1', OWNER, OWNER)).toBeNull();
		expect(update).not.toHaveBeenCalled();

		await transferOwnership('room1', OWNER, MEMBER);
		expect(update.mock.calls[0][0].data.created_by_id).toBe(MEMBER);
	});
});

describe('getSiteAdminIds', () => {
	it('returns only the admins among the given users', async () => {
		const {findMany} = stub();
		const admins = await getSiteAdminIds([OWNER, ADMIN]);
		expect(admins.has(ADMIN)).toBe(true);
		expect(admins.has(OWNER)).toBe(false);
		expect(findMany.mock.calls[0][0].where.admin).toBe(true);
	});

	it('does not query for an empty list', async () => {
		const {findMany} = stub();
		expect((await getSiteAdminIds([])).size).toBe(0);
		expect(findMany).not.toHaveBeenCalled();
	});
});
