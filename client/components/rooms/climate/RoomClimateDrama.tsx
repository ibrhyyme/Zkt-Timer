import React, { useEffect, useRef } from 'react';
import { FriendlyRoomParticipantData } from '../../../../shared/friendly_room';
import { DramaMood, playRoundDrama } from './climate_drama';
import './RoomClimateDrama.scss';

interface Props {
    roundIndex: number;
    participants: FriendlyRoomParticipantData[];
    mood: DramaMood | null;
}

// Long enough for the table to paint the round's last result before it is copied.
const DRAMA_DELAY_MS = 450;

/**
 * The layer the round-end ghosts fall through. When the scramble moves on to the next
 * round in a freezing or hot room, the closed round's times and its slowest name play
 * their fall (climate_drama.ts). Nothing here ever touches the real values.
 */
export default function RoomClimateDrama({ roundIndex, participants, mood }: Props) {
    const layerRef = useRef<HTMLDivElement>(null);
    const prevRound = useRef<number | null>(null);
    const live = useRef({ participants, mood });
    live.current = { participants, mood };

    useEffect(() => {
        const prev = prevRound.current;
        prevRound.current = roundIndex;
        // Only a round that just closed by moving on; a reset (back to 1) or the first
        // render plays nothing.
        if (prev === null || roundIndex !== prev + 1) return;
        const closed = prev;
        const timer = setTimeout(() => {
            const { participants: people, mood: m } = live.current;
            const layer = layerRef.current;
            if (!layer || !m) return;
            // Someone already started the next solve: the overlay covers the room anyway.
            if (document.querySelector('.room-timer-overlay')) return;
            playRoundDrama(layer, people, closed, m);
        }, DRAMA_DELAY_MS);
        return () => clearTimeout(timer);
    }, [roundIndex]);

    return <div ref={layerRef} className="zt-room-climate-drama" aria-hidden="true" />;
}
