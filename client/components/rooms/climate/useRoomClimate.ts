import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socketClient } from '../../../util/socket/socketio';
import { toastInfo } from '../../../util/toast';
import {
    ClimateAction,
    ClimateConst,
    ClimateEventPayload,
    ClimateFan,
    ClimateReactionPayload,
    ClimateReactionType,
    clampSetpoint,
    FriendlyRoomClimateClientEvent,
    FriendlyRoomClimatePayload,
    FriendlyRoomClimateServerEvent,
    FriendlyRoomClimateState,
    reanchor,
} from '../../../../shared/friendly_room/climate';
import { appendClimateLine, ClimateLine } from './climate_text';
import { climateBeep } from './beep';

// The two reaction buttons rest this long after a press (the server allows 3 per 15 s).
const REACT_COOLDOWN_MS = 5000;
// "Turu sen kazandın. Pro olsaydın kumanda senindi." stays on the Basic panel this long.
const BASIC_WIN_NOTE_MS = 9000;

export interface RoomClimate {
    state: FriendlyRoomClimateState | null;
    /** The server's clock, for climateAt(). */
    serverNow: () => number;
    lines: ClimateLine[];
    reactions: ClimateReactionPayload[];
    iHold: boolean;
    iAmPro: boolean;
    anyPro: boolean;
    basicWinRecent: boolean;
    reactCoolingDown: boolean;
    press: (action: 'power' | 'up' | 'down' | 'fan') => void;
    react: (type: ClimateReactionType) => void;
}

let lineSeq = 0;

/**
 * The room's climate as the server sees it, plus the chat lines its events produce. The
 * temperature itself is not stored here: callers derive it with climateAt(state, serverNow()).
 */
export function useRoomClimate(roomId: string, meId: string | undefined, joined: boolean, soundOn: boolean): RoomClimate {
    const { t } = useTranslation();
    const [state, setState] = useState<FriendlyRoomClimateState | null>(null);
    const [lines, setLines] = useState<ClimateLine[]>([]);
    const [reactions, setReactions] = useState<ClimateReactionPayload[]>([]);
    const [basicWinAt, setBasicWinAt] = useState(0);
    const [reactAt, setReactAt] = useState(0);
    const [, setTick] = useState(0);
    const offsetRef = useRef(0);

    // Handlers read the latest values through refs: the socket listeners stay mounted once.
    const live = useRef({ roomId, meId, soundOn, t });
    live.current = { roomId, meId, soundOn, t };

    const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

    // A different room starts from nothing.
    useEffect(() => {
        setState(null);
        setLines([]);
        setReactions([]);
        setBasicWinAt(0);
    }, [roomId]);

    useEffect(() => {
        const socket = socketClient() as any;

        const onState = (payload: FriendlyRoomClimatePayload) => {
            if (!payload || payload.room_id !== live.current.roomId) return;
            offsetRef.current = payload.server_now - Date.now();
            const { server_now: _ignored, ...next } = payload;
            setState(next);
        };

        const onEvent = (e: ClimateEventPayload) => {
            const cur = live.current;
            if (!e || e.room_id !== cur.roomId) return;
            setLines((prev) => appendClimateLine(prev, e, `climate-${++lineSeq}`));

            const fromMe = !!cur.meId && e.actor_id === cur.meId;
            if (cur.soundOn && !fromMe && (e.kind === 'ac_on' || e.kind === 'ac_off' || e.kind === 'setpoint')) {
                climateBeep(e.kind === 'setpoint' ? 'key' : 'power', false);
            }
            if ((e.kind === 'holder' || e.kind === 'holder_leave') && cur.meId && e.target_id === cur.meId) {
                toastInfo(cur.t('rooms.climate.you_hold'));
            }
            if (e.kind === 'basic_win' && cur.meId && e.winner_id === cur.meId) {
                toastInfo(cur.t('rooms.climate.basic_won'));
                setBasicWinAt(Date.now());
            }
        };

        const onReaction = (r: ClimateReactionPayload) => {
            if (!r || r.room_id !== live.current.roomId) return;
            const at = Date.now();
            setReactions((prev) => [
                ...prev.filter((x) => at - x.at < ClimateConst.COMPLAINT_WINDOW_MS),
                { ...r, at },
            ]);
        };

        socket.on(FriendlyRoomClimateServerEvent.STATE, onState);
        socket.on(FriendlyRoomClimateServerEvent.EVENT, onEvent);
        socket.on(FriendlyRoomClimateServerEvent.REACTION, onReaction);
        return () => {
            socket.off(FriendlyRoomClimateServerEvent.STATE, onState);
            socket.off(FriendlyRoomClimateServerEvent.EVENT, onEvent);
            socket.off(FriendlyRoomClimateServerEvent.REACTION, onReaction);
        };
    }, []);

    // Ask once the socket is in the room (the join itself also broadcasts the state; this
    // covers a listener that mounted after that broadcast).
    useEffect(() => {
        if (!roomId || !joined) return;
        (socketClient() as any).emit(FriendlyRoomClimateClientEvent.GET, roomId);
    }, [roomId, joined]);

    // Expire the timed bits (complaint window, Basic win note, reaction cooldown).
    useEffect(() => {
        const pending = reactions.length > 0 || Date.now() - basicWinAt < BASIC_WIN_NOTE_MS || Date.now() - reactAt < REACT_COOLDOWN_MS;
        if (!pending) return;
        const id = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [reactions, basicWinAt, reactAt]);

    const iHold = !!state && !!meId && state.holder_id === meId;
    const iAmPro = !!state && !!meId && state.pro_user_ids.includes(meId);
    const anyPro = !!state && state.pro_user_ids.length > 0;

    const press = useCallback(
        (key: 'power' | 'up' | 'down' | 'fan') => {
            if (!state || !iHold) return;
            const now = serverNow();
            let action: ClimateAction;
            let next: FriendlyRoomClimateState = reanchor(state, now);
            if (key === 'power') {
                action = { action: 'power' };
                next = { ...next, ac_on: !next.ac_on };
            } else if (key === 'fan') {
                action = { action: 'fan' };
                next = { ...next, fan: ((next.fan % 3) + 1) as ClimateFan };
            } else {
                const value = clampSetpoint(state.setpoint + (key === 'up' ? 1 : -1));
                if (value === state.setpoint && state.ac_on) return;
                action = { action: 'setpoint', value };
                next = { ...next, ac_on: true, setpoint: value };
            }
            if (soundOn) climateBeep(key === 'power' ? 'power' : 'key', true);
            // Shown at once; the server's state replaces it a moment later (or corrects it).
            setState(next);
            (socketClient() as any).emit(FriendlyRoomClimateClientEvent.SET, roomId, action);
        },
        [state, iHold, roomId, soundOn, serverNow]
    );

    const react = useCallback(
        (type: ClimateReactionType) => {
            if (Date.now() - reactAt < REACT_COOLDOWN_MS) return;
            setReactAt(Date.now());
            (socketClient() as any).emit(FriendlyRoomClimateClientEvent.REACT, roomId, type);
        },
        [roomId, reactAt]
    );

    return {
        state,
        serverNow,
        lines,
        reactions,
        iHold,
        iAmPro,
        anyPro,
        basicWinRecent: Date.now() - basicWinAt < BASIC_WIN_NOTE_MS,
        reactCoolingDown: Date.now() - reactAt < REACT_COOLDOWN_MS,
        press,
        react,
    };
}
