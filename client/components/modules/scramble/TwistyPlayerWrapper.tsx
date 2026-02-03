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
        if (typeof window !== 'undefined' && containerRef.current && !playerRef.current) {
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

        // Cleanup: we don't necessarily want to destroy it on every re-render, 
        // but on unmount we should clean up if necessary.
        // However, since we are appending the element, we should remove it.
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            if (containerRef.current && playerRef.current) {
                containerRef.current.innerHTML = '';
                playerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.puzzle = puzzle;
            playerRef.current.alg = alg;
            playerRef.current.visualization = visualization;
        }
    }, [puzzle, alg, visualization]);

    return <div ref={containerRef} className={className} style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />;
};

export default TwistyPlayerWrapper;
