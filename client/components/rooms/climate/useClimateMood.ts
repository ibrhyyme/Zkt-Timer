import { useEffect, useState } from 'react';
import { climateAt, climateLevel, FriendlyRoomClimateState } from '../../../../shared/friendly_room/climate';

export type ClimateMood = 'cold' | 'hot' | null;

/**
 * Freezing, hot or comfortable, re-checked every second. Returns the same value until the
 * mood actually changes, so the room re-renders a handful of times, not once a second.
 */
export function useClimateMood(state: FriendlyRoomClimateState | null, serverNow: () => number, enabled: boolean): ClimateMood {
    const [mood, setMood] = useState<ClimateMood>(null);
    useEffect(() => {
        if (!state || !enabled) {
            setMood(null);
            return;
        }
        const read = () => {
            const level = climateLevel(climateAt(state, serverNow()).temp);
            setMood(level === 'freezing' ? 'cold' : level === 'hot' || level === 'fire' ? 'hot' : null);
        };
        read();
        const id = setInterval(read, 1000);
        return () => clearInterval(id);
    }, [state, serverNow, enabled]);
    return mood;
}
