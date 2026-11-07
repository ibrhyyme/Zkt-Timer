import { pickRoundDrama } from '../climate/climate_drama';
import { FriendlyRoomParticipantData } from '../../../../shared/friendly_room';

function person(user_id: string, solves: { round: number; time: number; dnf?: boolean; plus_two?: boolean }[], is_spectator = false): FriendlyRoomParticipantData {
    return {
        id: `p-${user_id}`,
        user_id,
        username: user_id,
        is_ready: true,
        is_spectator,
        is_moderator: false,
        joined_at: '',
        solves: solves.map((s) => ({ time: s.time, dnf: !!s.dnf, plus_two: !!s.plus_two, scramble_index: s.round })),
    };
}

describe('pickRoundDrama', () => {
    it('the slowest finisher of the round falls, counting +2', () => {
        const people = [
            person('a', [{ round: 3, time: 12 }]),
            person('b', [{ round: 3, time: 12.5, plus_two: true }]), // 14.5
            person('c', [{ round: 3, time: 14 }]),
        ];
        expect(pickRoundDrama(people, 3)).toEqual({ finishers: ['a', 'b', 'c'], worst: 'b' });
    });

    it('a DNF is the slowest', () => {
        const people = [person('a', [{ round: 1, time: 30 }]), person('b', [{ round: 1, time: 9, dnf: true }])];
        expect(pickRoundDrama(people, 1).worst).toBe('b');
    });

    it('nobody falls with one finisher, and spectators and other rounds are left out', () => {
        const people = [
            person('a', [{ round: 2, time: 10 }]),
            person('b', [{ round: 1, time: 50 }]),
            person('c', [{ round: 2, time: 60 }], true),
        ];
        expect(pickRoundDrama(people, 2)).toEqual({ finishers: ['a'], worst: null });
    });
});
