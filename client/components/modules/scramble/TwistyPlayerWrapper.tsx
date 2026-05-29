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

    // Recreate when puzzle/visualization changes
    useEffect(() => {
        if (typeof window !== 'undefined' && containerRef.current) {
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
    }, [puzzle, visualization]);

    // When scramble changes, only update alg (don't tear down and recreate)
    useEffect(() => {
        if (playerRef.current) {
            try {
                playerRef.current.alg = alg;
            } catch {
                // TwistyPlayer could not parse notation
            }
        }
    }, [alg]);

    return <div ref={containerRef} className={className} style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />;
};

export default TwistyPlayerWrapper;
