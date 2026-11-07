// Klima Kavgası: a room temperature and one Pro remote per friendly room.
//
// The server owns the facts (who holds the remote, AC on/off, setpoint, fan, race heat)
// and every client derives the temperature from them with the same closed-form formula,
// so all screens show the same number without the server ticking it. The state carries an
// anchor (temp0, heat0 at anchor_at); the server re-anchors on every change.
//
// The rules are the owner's (see .claude/research/klima-kavgasi-plan.md) and are final:
// the round's fastest Pro takes the remote, a Basic winner leaves it where it was, an
// empty remote goes to the round's fastest Pro, a leaving holder hands it to the last
// completed round's fastest Pro, and with no Pro left the AC switches off.

export const ClimateConst = {
    SETPOINT_MIN: 16,
    SETPOINT_MAX: 30,
    SETPOINT_DEFAULT: 22,
    FAN_DEFAULT: 2,
    // Room temperature with the AC off and nobody racing.
    BASE_TEMP: 24,
    HEAT_MAX: 9,
    // Race heat halves every two minutes: a round takes far longer than the prototype's
    // demo round, so a close race has to stay felt across the next one.
    HEAT_HALF_LIFE_S: 120,
    // How strongly the race heat pushes the room: hard with the AC off, a little against it.
    HEAT_WEIGHT_AC_OFF: 0.9,
    HEAT_WEIGHT_AC_ON: 0.3,
    // Approach rate toward the target, per second. Prototype values (per 250 ms tick:
    // 0.012 off, 0.018 / 0.03 / 0.048 by fan) converted to continuous rates.
    RATE_AC_OFF: 0.0483,
    RATE_BY_FAN: [0, 0.0727, 0.1218, 0.1968] as readonly number[],
    // Complaint counter window on the remote's screen.
    COMPLAINT_WINDOW_MS: 30_000,
};

export type ClimateFan = 1 | 2 | 3;

/** Server-authoritative climate of one room. */
export interface FriendlyRoomClimateState {
    room_id: string;
    ac_on: boolean;
    setpoint: number;
    fan: ClimateFan;
    holder_id: string | null;
    // How many times the remote changed hands, shown on the remote.
    swaps: number;
    anchor_at: number;
    temp0: number;
    heat0: number;
    // The last completed round, fastest first, DNFs and absent people left out. The
    // fallback list when the holder leaves.
    last_ranking: string[];
    // Pro (or Premium) participants in the room right now. Resolved on the server from the
    // database, never from the client.
    pro_user_ids: string[];
}

/** What the server sends: the state plus its clock, so clients can correct for skew. */
export interface FriendlyRoomClimatePayload extends FriendlyRoomClimateState {
    server_now: number;
}

export type ClimateAction =
    | { action: 'power' }
    | { action: 'setpoint'; value: number }
    | { action: 'fan' };

export type ClimateReactionType = 'cold' | 'hot';

export interface ClimateReactionPayload {
    room_id: string;
    user_id: string;
    type: ClimateReactionType;
    at: number;
}

/**
 * A system line. Sent as structured data and translated on each client, because server
 * text would be Turkish for everyone.
 */
export type ClimateEventKind =
    | 'ac_on' // actor, value
    | 'ac_off' // actor
    | 'setpoint' // actor, value, from
    | 'holder' // target
    | 'holder_leave' // target: the holder left, the last round's fastest Pro took over
    | 'basic_win' // winner (Basic), holder (may be null)
    | 'no_pro_off'; // the AC went off, no Pro left to hold the remote

export interface ClimateEventPayload {
    room_id: string;
    kind: ClimateEventKind;
    actor_id?: string;
    actor?: string;
    target_id?: string;
    target?: string;
    winner_id?: string;
    winner?: string;
    holder?: string | null;
    value?: number;
    from?: number;
    at: number;
}

export enum FriendlyRoomClimateClientEvent {
    GET = 'ac:get',
    SET = 'ac:set',
    REACT = 'ac:react',
}

export enum FriendlyRoomClimateServerEvent {
    STATE = 'ac:state',
    EVENT = 'ac:event',
    REACTION = 'ac:reaction',
}

export function createClimateState(roomId: string, now: number): FriendlyRoomClimateState {
    return {
        room_id: roomId,
        ac_on: false,
        setpoint: ClimateConst.SETPOINT_DEFAULT,
        fan: ClimateConst.FAN_DEFAULT as ClimateFan,
        holder_id: null,
        swaps: 0,
        anchor_at: now,
        temp0: ClimateConst.BASE_TEMP,
        heat0: 0,
        last_ranking: [],
        pro_user_ids: [],
    };
}

export function clampSetpoint(value: number): number {
    if (!Number.isFinite(value)) return ClimateConst.SETPOINT_DEFAULT;
    return Math.max(ClimateConst.SETPOINT_MIN, Math.min(ClimateConst.SETPOINT_MAX, Math.round(value)));
}

function heatDecayRate(): number {
    return Math.LN2 / ClimateConst.HEAT_HALF_LIFE_S;
}

function approachRate(state: Pick<FriendlyRoomClimateState, 'ac_on' | 'fan'>): number {
    return state.ac_on ? ClimateConst.RATE_BY_FAN[state.fan] ?? ClimateConst.RATE_BY_FAN[2] : ClimateConst.RATE_AC_OFF;
}

/**
 * Temperature and heat at `now`, from the anchor. Closed form of
 *   dT/dt = k (S + a H(t) - T),  H(t) = H0 e^(-h t)
 * which is T(t) = S + B e^(-h t) + (T0 - S - B) e^(-k t), B = a k H0 / (k - h).
 * Every rate k is well above h, so k - h never reaches zero.
 */
export function climateAt(state: FriendlyRoomClimateState, now: number): { temp: number; heat: number } {
    const t = Math.max(0, (now - state.anchor_at) / 1000);
    const h = heatDecayRate();
    const k = approachRate(state);
    const a = state.ac_on ? ClimateConst.HEAT_WEIGHT_AC_ON : ClimateConst.HEAT_WEIGHT_AC_OFF;
    const S = state.ac_on ? state.setpoint : ClimateConst.BASE_TEMP;
    const H0 = state.heat0;
    const B = (a * k * H0) / (k - h);
    const heat = H0 * Math.exp(-h * t);
    const temp = S + B * Math.exp(-h * t) + (state.temp0 - S - B) * Math.exp(-k * t);
    return { temp, heat };
}

/** Freeze the current temperature and heat into a new anchor. Call before any change. */
export function reanchor(state: FriendlyRoomClimateState, now: number): FriendlyRoomClimateState {
    const { temp, heat } = climateAt(state, now);
    return { ...state, anchor_at: now, temp0: temp, heat0: heat };
}

export type ClimateLevel = 'freezing' | 'cool' | 'normal' | 'hot' | 'fire';

export function climateLevel(rawTemp: number): ClimateLevel {
    // Judged on the value the chip shows (one decimal): "30,0°C" has to read as on fire.
    // The temperature only approaches the setpoint, so the raw value would sit at 29.99
    // forever with the AC on 30.
    const temp = Math.round(rawTemp * 10) / 10;
    if (temp <= 19) return 'freezing';
    if (temp < 21) return 'cool';
    if (temp < 27) return 'normal';
    if (temp < 30) return 'hot';
    return 'fire';
}

/** 0..1 strength of the cold effects (frost, icicles, snow). */
export function coldIntensity(temp: number): number {
    return Math.max(0, Math.min(1, (21.5 - temp) / 4.5));
}

/** 0..1 strength of the heat effects (edge glow, heat haze, sparks). */
export function hotIntensity(temp: number): number {
    return Math.max(0, Math.min(1, (temp - 26) / 4));
}

export interface ClimateRoundSolve {
    user_id: string;
    time: number;
    dnf: boolean;
    plus_two: boolean;
}

/** User ids of a round, fastest first. DNFs never rank, so a DNF can never take the remote. */
export function rankRound(solves: ClimateRoundSolve[]): string[] {
    return solves
        .filter((s) => !s.dnf && Number.isFinite(s.time))
        .map((s) => ({ id: s.user_id, t: s.time + (s.plus_two ? 2 : 0) }))
        .sort((a, b) => a.t - b.t)
        .map((s) => s.id);
}

/**
 * Race heat a round adds: the closer the two fastest, the hotter the room. The fight is
 * for the remote, so the gap at the top is what counts, not the spread of the whole room.
 */
export function heatGainForRound(solves: ClimateRoundSolve[]): number {
    const times = solves
        .filter((s) => !s.dnf && Number.isFinite(s.time))
        .map((s) => s.time + (s.plus_two ? 2 : 0))
        .sort((a, b) => a - b);
    if (times.length < 2) return 0;
    const gap = times[1] - times[0];
    if (gap < 0.5) return 2.4;
    if (gap < 1.5) return 1.3;
    return 0.5;
}

export type RoundRemoteOutcome =
    | { kind: 'none'; holder: string | null }
    | { kind: 'winner'; holder: string }
    | { kind: 'basic_win'; holder: string | null; winner: string; fallbackTaken: boolean };

/**
 * Who holds the remote after a round. `ranking` is fastest first.
 *  - Pro winner: takes it.
 *  - Basic winner: it stays with the holder; if nobody held it, the round's fastest Pro.
 */
export function decideRemoteAfterRound(
    holder: string | null,
    ranking: string[],
    proIds: Set<string>
): RoundRemoteOutcome {
    if (!ranking.length) return { kind: 'none', holder };
    const winner = ranking[0];
    if (proIds.has(winner)) return { kind: 'winner', holder: winner };
    if (holder) return { kind: 'basic_win', holder, winner, fallbackTaken: false };
    const fastestPro = ranking.find((id) => proIds.has(id)) ?? null;
    return { kind: 'basic_win', holder: fastestPro, winner, fallbackTaken: !!fastestPro };
}

/**
 * The holder left or became a spectator: the last completed round's fastest Pro who is
 * still competing takes it, or nobody.
 */
export function decideRemoteAfterLeave(
    leavingId: string,
    lastRanking: string[],
    competingProIds: Set<string>
): string | null {
    return lastRanking.find((id) => id !== leavingId && competingProIds.has(id)) ?? null;
}

// ---------------------------------------------------------------------------
// Turkish case suffixes for a username: "Kumanda İskender'e geçti", "Kumanda Mert'te".
// Usernames are free text, so this follows vowel harmony on the last vowel and reads a
// trailing digit the way it is spoken (ibrhyyme3 -> "üç" -> ibrhyyme3'e, ibrhyyme3'te).
// Other languages do not inflect names and use the name as it is.
// ---------------------------------------------------------------------------

const TR_VOWELS = 'aeıioöuü';
const TR_BACK_VOWELS = 'aıou';
const TR_HARD_CONSONANTS = 'fstkçşhp';

// How each digit is read, for the suffix only.
const TR_DIGIT_WORDS = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];

// Explicit mapping, never toLocaleLowerCase('tr'): see shared/url_slug.ts.
function trLower(s: string): string {
    let out = '';
    for (const ch of s) {
        if (ch === 'I') out += 'ı';
        else if (ch === 'İ') out += 'i';
        else out += ch.toLowerCase();
    }
    return out;
}

// The word whose sound decides the suffix: the name, or the reading of a trailing digit.
function spokenTail(name: string): string {
    const lower = trLower(name.trim());
    const last = lower.charAt(lower.length - 1);
    if (last >= '0' && last <= '9') return TR_DIGIT_WORDS[Number(last)];
    return lower.replace(/[^a-zçğıöşü]+$/, '') || lower;
}

function lastVowel(word: string): string {
    for (let i = word.length - 1; i >= 0; i--) {
        if (TR_VOWELS.includes(word[i])) return word[i];
    }
    return 'e';
}

function endsWithVowel(word: string): boolean {
    return TR_VOWELS.includes(word.charAt(word.length - 1));
}

/** Dative: Mert'e, Kaan'a, Ece'ye, Ali'ye. */
export function trDative(name: string): string {
    const tail = spokenTail(name);
    const back = TR_BACK_VOWELS.includes(lastVowel(tail));
    return `${name}'${endsWithVowel(tail) ? 'y' : ''}${back ? 'a' : 'e'}`;
}

/** Locative: Mert'te, Kaan'da, Ece'de, İskender'de. */
export function trLocative(name: string): string {
    const tail = spokenTail(name);
    const back = TR_BACK_VOWELS.includes(lastVowel(tail));
    const hard = TR_HARD_CONSONANTS.includes(tail.charAt(tail.length - 1));
    return `${name}'${hard ? 't' : 'd'}${back ? 'a' : 'e'}`;
}
