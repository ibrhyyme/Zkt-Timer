import {
    ClimateConst,
    climateAt,
    climateLevel,
    createClimateState,
    decideRemoteAfterLeave,
    decideRemoteAfterRound,
    heatGainForRound,
    rankRound,
    reanchor,
    clampSetpoint,
    trDative,
    trLocative,
    FriendlyRoomClimateState,
} from '../climate';

const T0 = 1_700_000_000_000;

function state(over: Partial<FriendlyRoomClimateState> = {}): FriendlyRoomClimateState {
    return { ...createClimateState('room', T0), ...over };
}

describe('climateAt', () => {
    it('stays at the base temperature with the AC off and no race heat', () => {
        expect(climateAt(state(), T0 + 600_000).temp).toBeCloseTo(ClimateConst.BASE_TEMP, 6);
    });

    it('moves toward the setpoint gradually, never in a jump', () => {
        const s = state({ ac_on: true, setpoint: 16, fan: 2 });
        const after1 = climateAt(s, T0 + 1000).temp;
        const after10 = climateAt(s, T0 + 10_000).temp;
        const after120 = climateAt(s, T0 + 120_000).temp;
        expect(after1).toBeLessThan(24);
        expect(after1).toBeGreaterThan(23); // one second moves it well under a degree
        expect(after10).toBeLessThan(after1);
        expect(after120).toBeCloseTo(16, 1);
    });

    it('a stronger fan gets there faster', () => {
        const slow = climateAt(state({ ac_on: true, setpoint: 16, fan: 1 }), T0 + 10_000).temp;
        const fast = climateAt(state({ ac_on: true, setpoint: 16, fan: 3 }), T0 + 10_000).temp;
        expect(fast).toBeLessThan(slow);
    });

    it('race heat warms the room and then fades', () => {
        const s = state({ heat0: 9 });
        const soon = climateAt(s, T0 + 30_000);
        const late = climateAt(s, T0 + 30 * 60_000);
        expect(soon.temp).toBeGreaterThan(26);
        expect(late.temp).toBeCloseTo(ClimateConst.BASE_TEMP, 1);
        expect(late.heat).toBeLessThan(0.01);
    });

    it('the same anchor gives every client the same number', () => {
        const s = state({ ac_on: true, setpoint: 18, fan: 3, heat0: 4, temp0: 27 });
        expect(climateAt(s, T0 + 12_345).temp).toBe(climateAt({ ...s }, T0 + 12_345).temp);
    });

    it('re-anchoring keeps the curve continuous', () => {
        const s = state({ ac_on: true, setpoint: 18, fan: 2, heat0: 5, temp0: 28 });
        const now = T0 + 20_000;
        const re = reanchor(s, now);
        expect(climateAt(re, now).temp).toBeCloseTo(climateAt(s, now).temp, 9);
        expect(climateAt(re, now + 5000).temp).toBeCloseTo(climateAt(s, now + 5000).temp, 9);
    });
});

describe('climateLevel', () => {
    it('follows the prototype thresholds', () => {
        expect(climateLevel(18)).toBe('freezing');
        expect(climateLevel(19)).toBe('freezing');
        expect(climateLevel(20)).toBe('cool');
        expect(climateLevel(24)).toBe('normal');
        expect(climateLevel(28)).toBe('hot');
        expect(climateLevel(30)).toBe('fire');
    });

    it('judges the value the chip shows: 29.96 reads "30,0" and is on fire', () => {
        expect(climateLevel(29.96)).toBe('fire');
        expect(climateLevel(29.94)).toBe('hot');
        expect(climateLevel(19.04)).toBe('freezing');
    });

    it('the AC alone on 30 sets the room on fire in the end', () => {
        const s = { ...createClimateState('room', T0), ac_on: true, setpoint: 30, fan: 3 as const };
        expect(climateLevel(climateAt(s, T0 + 60_000).temp)).toBe('fire');
    });
});

describe('clampSetpoint', () => {
    it('keeps the setpoint inside 16-30 and whole', () => {
        expect(clampSetpoint(10)).toBe(16);
        expect(clampSetpoint(40)).toBe(30);
        expect(clampSetpoint(21.6)).toBe(22);
        expect(clampSetpoint(NaN)).toBe(ClimateConst.SETPOINT_DEFAULT);
    });
});

describe('rankRound / heatGainForRound', () => {
    const solves = [
        { user_id: 'a', time: 12.5, dnf: false, plus_two: false },
        { user_id: 'b', time: 11.0, dnf: false, plus_two: true }, // 13.0
        { user_id: 'c', time: 9.0, dnf: true, plus_two: false },
        { user_id: 'd', time: 12.3, dnf: false, plus_two: false },
    ];

    it('ranks fastest first, counts +2 and drops DNF', () => {
        expect(rankRound(solves)).toEqual(['d', 'a', 'b']);
    });

    it('a close top two heats the room more than a clear win', () => {
        expect(heatGainForRound(solves)).toBe(2.4); // 12.3 vs 12.5
        expect(
            heatGainForRound([
                { user_id: 'a', time: 10, dnf: false, plus_two: false },
                { user_id: 'b', time: 11, dnf: false, plus_two: false },
            ])
        ).toBe(1.3);
        expect(
            heatGainForRound([
                { user_id: 'a', time: 10, dnf: false, plus_two: false },
                { user_id: 'b', time: 15, dnf: false, plus_two: false },
            ])
        ).toBe(0.5);
    });

    it('one finisher adds no heat', () => {
        expect(heatGainForRound([{ user_id: 'a', time: 10, dnf: false, plus_two: false }])).toBe(0);
    });
});

describe('decideRemoteAfterRound', () => {
    const pros = new Set(['pro1', 'pro2']);

    it('a Pro winner takes the remote', () => {
        expect(decideRemoteAfterRound('pro2', ['pro1', 'basic', 'pro2'], pros)).toEqual({ kind: 'winner', holder: 'pro1' });
    });

    it('a Basic winner leaves it with the holder', () => {
        expect(decideRemoteAfterRound('pro2', ['basic', 'pro1'], pros)).toEqual({
            kind: 'basic_win',
            holder: 'pro2',
            winner: 'basic',
            fallbackTaken: false,
        });
    });

    it('a Basic winner with an empty remote: the round\'s fastest Pro takes it', () => {
        expect(decideRemoteAfterRound(null, ['basic', 'pro2', 'pro1'], pros)).toEqual({
            kind: 'basic_win',
            holder: 'pro2',
            winner: 'basic',
            fallbackTaken: true,
        });
    });

    it('a Basic winner and no Pro finished: the remote stays empty', () => {
        expect(decideRemoteAfterRound(null, ['basic'], pros)).toEqual({
            kind: 'basic_win',
            holder: null,
            winner: 'basic',
            fallbackTaken: false,
        });
    });

    it('nobody finished: nothing changes', () => {
        expect(decideRemoteAfterRound('pro1', [], pros)).toEqual({ kind: 'none', holder: 'pro1' });
    });
});

describe('decideRemoteAfterLeave', () => {
    it('goes to the last round\'s fastest Pro still competing', () => {
        expect(decideRemoteAfterLeave('pro1', ['pro1', 'basic', 'pro2', 'pro3'], new Set(['pro2', 'pro3']))).toBe('pro2');
    });

    it('nobody when no Pro from the last round is left', () => {
        expect(decideRemoteAfterLeave('pro1', ['pro1', 'basic'], new Set(['pro9']))).toBeNull();
    });
});

describe('Turkish suffixes', () => {
    it('dative follows vowel harmony and buffers a vowel ending', () => {
        expect(trDative('İskender')).toBe("İskender'e");
        expect(trDative('Mert')).toBe("Mert'e");
        expect(trDative('Kaan')).toBe("Kaan'a");
        expect(trDative('Ece')).toBe("Ece'ye");
        expect(trDative('Selin')).toBe("Selin'e");
        expect(trDative('Murat')).toBe("Murat'a");
    });

    it('locative hardens after a voiceless consonant', () => {
        expect(trLocative('İskender')).toBe("İskender'de");
        expect(trLocative('Mert')).toBe("Mert'te");
        expect(trLocative('Kaan')).toBe("Kaan'da");
        expect(trLocative('Ece')).toBe("Ece'de");
        expect(trLocative('Burak')).toBe("Burak'ta");
    });

    it('reads a trailing digit the way it is spoken', () => {
        expect(trDative('cuber3')).toBe("cuber3'e"); // üç
        expect(trLocative('cuber3')).toBe("cuber3'te");
        expect(trDative('ali6')).toBe("ali6'ya"); // altı
        expect(trLocative('ali6')).toBe("ali6'da");
        expect(trDative('kup2')).toBe("kup2'ye"); // iki
    });

    it('keeps the username exactly as written', () => {
        expect(trDative('ibrhyyme')).toBe("ibrhyyme'ye");
        expect(trLocative('ibrhyyme')).toBe("ibrhyyme'de");
        expect(trDative('KAAN')).toBe("KAAN'a");
    });
});
