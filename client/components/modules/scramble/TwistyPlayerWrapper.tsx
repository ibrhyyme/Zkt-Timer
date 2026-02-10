import React, { useEffect, useRef } from 'react';
import { TwistyPlayer } from 'cubing/twisty';

interface Props {
    puzzle: string;
    alg: string;
    visualization?: '2D' | '3D' | 'auto';
    className?: string;
}

const TwistyPlayerWrapper: React.FC<Props> = ({ puzzle, alg, visualization = '2D', className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<TwistyPlayer | null>(null);

    useEffect(() => {
        // Check if we are in a browser environment
        if (typeof window !== 'undefined' && containerRef.current) {
            // Cleanup previous instance if it exists (safety check, though return cleanup handles it)
            if (playerRef.current) {
                containerRef.current.innerHTML = '';
                playerRef.current = null;
            }

            playerRef.current = new TwistyPlayer({
                puzzle: puzzle,
                visualization: visualization,
                alg: alg,
                background: 'none',
                controlPanel: 'none',
                hintFacelets: 'none',
                backView: 'none',
            });
            containerRef.current.appendChild(playerRef.current);
        }

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
                playerRef.current = null;
            }
        };
        // Re-initialize when puzzle or visualization changes. 
        // We include 'alg' in the init, but we handle dynamic alg updates separately below to avoid re-creation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [puzzle, visualization]);

    // Handle scramble updates without re-creating the player
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.alg = alg;
        }
    }, [alg]);

    return <div ref={containerRef} className={className} style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />;
};

export default TwistyPlayerWrapper;
