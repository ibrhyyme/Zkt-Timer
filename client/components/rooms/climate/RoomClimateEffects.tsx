import React, { useEffect, useRef } from 'react';
import { climateAt, FriendlyRoomClimateState } from '../../../../shared/friendly_room/climate';
import { isNative } from '../../../util/platform';
import { ClimateEffectsRenderer } from './climate_effects';

interface Props {
    state: FriendlyRoomClimateState | null;
    serverNow: () => number;
    enabled: boolean;
}

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function isLowPower(): boolean {
    if (isNative()) return true;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
    return typeof cores === 'number' && cores > 0 && cores <= 4;
}

/**
 * The effects canvas. Sits over the room (pointer-events none) under the top bar; the
 * renderer wipes every piece of text inside data-climate-text areas and skips every
 * data-climate-protect box, so it never covers a time or a move.
 * Mounted only after hydration by its parent: it reads window, devices and the clock.
 */
export default function RoomClimateEffects({ state, serverNow, enabled }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const live = useRef({ state, serverNow, enabled });
    live.current = { state, serverNow, enabled };

    useEffect(() => {
        const canvas = canvasRef.current;
        const host = canvas?.parentElement;
        if (!canvas || !host) return;
        const renderer = new ClimateEffectsRenderer(
            canvas,
            host,
            () => {
                const cur = live.current;
                if (!cur.state || !cur.enabled) return { enabled: false, temp: 24, acOn: false, cooling: false, fan: 2 };
                const { temp } = climateAt(cur.state, cur.serverNow());
                return {
                    enabled: true,
                    temp,
                    acOn: cur.state.ac_on,
                    cooling: cur.state.setpoint < temp,
                    fan: cur.state.fan,
                };
            },
            { reducedMotion: prefersReducedMotion(), lowPower: isLowPower() }
        );
        renderer.start();
        return () => renderer.stop();
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[25] h-full w-full"
        />
    );
}
