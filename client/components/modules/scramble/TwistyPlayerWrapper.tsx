import React, { useEffect, useRef } from 'react';
import { TwistyPlayer } from 'cubing/twisty';
import { SWIPE_THROUGH_ATTRIBUTE } from '../../timer/helpers/module_carousel';

interface Props {
    puzzle: string;
    alg: string;
    visualization?: '2D' | '3D' | 'auto';
    className?: string;
}

/**
 * cubing.js player for the puzzles our engine does not draw: Pyraminx, Megaminx and Skewb
 * (NxN goes to ScrambleCube in 3D and NxnRenderer in 2D, see ScrambleVisual). Stock cubing.js
 * colours: they never had the NxN palette.
 */
const TwistyPlayerWrapper: React.FC<Props> = ({ puzzle, alg, visualization = '2D', className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<TwistyPlayer | null>(null);

    // Recreate when puzzle/visualization changes.
    useEffect(() => {
        if (typeof window === 'undefined' || !containerRef.current) return;

        if (playerRef.current) {
            containerRef.current.innerHTML = '';
            playerRef.current = null;
        }

        const player = new TwistyPlayer({
            puzzle: puzzle,
            visualization: visualization,
            alg: alg,
            background: 'none',
            controlPanel: 'none',
            // Floating hint facelets: the faces turned away from the camera are mirrored just
            // outside the puzzle, so the whole scramble can be checked from one view.
            // Meaningless in 2D.
            hintFacelets: visualization === '2D' ? 'none' : 'floating',
            backView: 'none',
        });
        // A 2D view is a still picture with no drag of its own, so on the phone a swipe
        // over it may turn the module page (module_carousel.ts). The 3D puzzle keeps its drag.
        if (visualization === '2D') player.setAttribute(SWIPE_THROUGH_ATTRIBUTE, '');
        containerRef.current.appendChild(player);
        playerRef.current = player;

        return () => {
            if (containerRef.current) containerRef.current.innerHTML = '';
            playerRef.current = null;
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
