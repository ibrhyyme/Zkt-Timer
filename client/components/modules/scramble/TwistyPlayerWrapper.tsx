import React, { useEffect, useMemo, useRef } from 'react';
import { TwistyPlayer } from 'cubing/twisty';
import { recolorPuzzle, stickerPaletteFromFaceColors } from '../../timer/smart_cube/cube_view/cube_palette';
import { useCubePalette } from '../../../util/cube_colors/useCubePalette';

interface Props {
    puzzle: string;
    alg: string;
    visualization?: '2D' | '3D' | 'auto';
    className?: string;
}

const NXN_PUZZLES = new Set(['2x2x2', '3x3x3', '4x4x4', '5x5x5', '6x6x6', '7x7x7']);

/** How long to keep looking for the puzzle object before giving up, in animation frames. */
const RECOLOR_ATTEMPTS = 90;

const TwistyPlayerWrapper: React.FC<Props> = ({ puzzle, alg, visualization = '2D', className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<TwistyPlayer | null>(null);
    const palette = useCubePalette();

    // Only NxN is recoloured. The routine matches on the renderer's six stock face colours
    // and refuses anything else, so a pyraminx or megaminx would simply come back
    // unrecognised — no point building a player differently for it.
    const recolorable = NXN_PUZZLES.has(puzzle) && visualization === '3D';
    const paletteKey = palette.nxn.join(',');
    const stickerPalette = useMemo(() => stickerPaletteFromFaceColors(palette.nxn), [paletteKey]);

    // Recreate when puzzle/visualization/palette changes. The palette belongs in here rather
    // than in an effect of its own: recolouring is one-shot per puzzle instance, since it
    // keys on stock colours that no longer exist once it has run.
    useEffect(() => {
        if (typeof window === 'undefined' || !containerRef.current) return;

        if (playerRef.current) {
            containerRef.current.innerHTML = '';
            playerRef.current = null;
        }

        const player = new TwistyPlayer({
            puzzle: puzzle,
            // PG3D is the only 3D path whose sticker colours can be reached. The default
            // Cube3D shares one set of materials across every 3D cube on the page, so
            // repainting one would repaint all of them.
            visualization: recolorable ? 'PG3D' : visualization,
            alg: alg,
            background: 'none',
            controlPanel: 'none',
            // Floating hint facelets: the three faces turned away from the camera (back,
            // left, bottom) are mirrored just outside the cube, so the whole scramble can be
            // checked from one view. PG3D draws them from the same colour buffer as the
            // stickers, so the recolouring below covers them too. Meaningless in 2D.
            hintFacelets: visualization === '2D' ? 'none' : 'floating',
            backView: 'none',
        });
        containerRef.current.appendChild(player);
        playerRef.current = player;

        if (!recolorable) return () => {
            if (containerRef.current) containerRef.current.innerHTML = '';
            playerRef.current = null;
        };

        let cancelled = false;
        let frames = 0;
        const done = new WeakSet<object>();

        // The scene, and then the puzzle inside it, appear a few frames after the player is
        // attached. Fail closed: if they never turn up, the cube keeps its stock colours
        // instead of the view breaking.
        const tick = async () => {
            if (cancelled) return;
            try {
                const vantages = await (player as any).experimentalCurrentVantages();
                const vantage = [...vantages][0];
                if (vantage) {
                    const scene = await vantage.scene.scene();
                    const result = recolorPuzzle(scene, done, stickerPalette);
                    if (result === 'applied' || result === 'already-applied') {
                        vantage.render();
                        return;
                    }
                }
            } catch (e) {
                // Player torn down mid-lookup, or an internal shape we do not recognise.
            }
            if (!cancelled && ++frames < RECOLOR_ATTEMPTS) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        return () => {
            cancelled = true;
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            playerRef.current = null;
        };
    }, [puzzle, visualization, recolorable, paletteKey]);

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
