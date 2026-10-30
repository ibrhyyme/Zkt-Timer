import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CubeRenderer } from '../../timer/smart_cube/cube_view/render/cube_renderer';
import type { PuzzleSize } from '../../timer/smart_cube/cube_view/render/cube_model';
import { drawCubePicture } from '../../timer/smart_cube/cube_view/render/cube_pictures';
import { HOME_TILT_DEG } from '../../timer/smart_cube/cube_view/view_defaults';
import { ViewDrag, followDrag } from '../../timer/smart_cube/cube_view/view_drag';
import { NO_SWIPE_ATTRIBUTE } from '../../timer/helpers/module_carousel';
import { NO_DRAG_ATTRIBUTE } from '../../timer/tiles/drag_target';
import { useCubePalette } from '../../../util/cube_colors/useCubePalette';
import { isAppVisible, onVisibilityChange } from '../../../util/app-visibility';
import block from '../../../styles/bem';

const b = block('scramble-visual');

/**
 * The 3D scramble preview of a 2x2 to 7x7, drawn by our cube engine in place of cubing.js:
 * the scrambled cube with the floating hints of its hidden faces, in the viewer's colours.
 *
 * Live (the timer's scramble module, the solve detail, a room): its own renderer, turned by
 * dragging, as cubing.js's player was. `still` (rows of a list: solves, PB cards, the last
 * solve, stats): a picture from the one shared offscreen renderer (cube_pictures.ts), since a
 * page of 25 rows cannot open 25 WebGL contexts (browsers allow about sixteen). A picture
 * cannot be turned; the detail it opens can.
 *
 * The box is sized by its CSS; the cube is the largest square inside it.
 */

interface Props {
	size: PuzzleSize;
	scramble: string;
	still?: boolean;
	className?: string;
}

const DEG = Math.PI / 180;

const turnsOf = (scramble: string) => (scramble || '').split(/\s+/).filter(Boolean);

/** Pictures already drawn this session, by size, pixels, palette and scramble. */
const pictures = new Map<string, string>();
const MAX_PICTURES = 300;

function remember(key: string, url: string) {
	pictures.set(key, url);
	while (pictures.size > MAX_PICTURES) {
		const oldest = pictures.keys().next().value;
		if (oldest === undefined) break;
		pictures.delete(oldest);
	}
}

function LiveCube({ size, scramble, className }: Omit<Props, 'still'>) {
	const boxRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const cubeRef = useRef<CubeRenderer | null>(null);
	const dragRef = useRef(new ViewDrag());
	const showDragRef = useRef<() => void>(() => {});
	const [built, setBuilt] = useState(0);

	const palette = useCubePalette();
	const faceColorsRef = useRef(palette.nxn);
	faceColorsRef.current = palette.nxn;
	const paletteKey = palette.nxn.join(',');
	const scrambleRef = useRef(scramble);
	scrambleRef.current = scramble;

	useEffect(() => {
		const box = boxRef.current;
		const host = hostRef.current;
		if (!box || !host) return undefined;
		const drag = dragRef.current;
		drag.reset();
		let cube: CubeRenderer;
		try {
			cube = new CubeRenderer({
				size,
				faceColors: faceColorsRef.current,
				tableTilt: HOME_TILT_DEG * DEG,
				orientation: drag.quat(new THREE.Quaternion()),
				floor: false,
				logo: false,
				hints: true,
			});
		} catch (error) {
			// No WebGL (blocked, lost, very old device): the scramble text is still there.
			console.error('[ScrambleCube] 3D view unavailable:', error);
			return undefined;
		}
		cube.setMoves(turnsOf(scrambleRef.current));
		host.appendChild(cube.canvas);

		const fit = () => {
			const side = Math.max(1, Math.floor(Math.min(box.clientWidth, box.clientHeight)));
			host.style.width = `${side}px`;
			host.style.height = `${side}px`;
			cube.resize(side);
		};
		fit();
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
		if (observer) observer.observe(box);
		else window.addEventListener('resize', fit);

		cube.setActive(isAppVisible());
		const unsubVisibility = onVisibilityChange((visible) => cube.setActive(visible));
		const view = followDrag(cube, drag);
		showDragRef.current = view.show;
		cubeRef.current = cube;
		setBuilt((n) => n + 1);

		return () => {
			view.stop();
			showDragRef.current = () => {};
			if (observer) observer.disconnect();
			else window.removeEventListener('resize', fit);
			unsubVisibility();
			cube.dispose();
			if (cubeRef.current === cube) cubeRef.current = null;
		};
	}, [size]);

	// A new scramble keeps the renderer (and the view the viewer turned to).
	useEffect(() => {
		cubeRef.current?.setMoves(turnsOf(scramble));
	}, [built, scramble]);

	useEffect(() => {
		cubeRef.current?.setFaceColors(faceColorsRef.current);
	}, [paletteKey]);

	const noGesture = { [NO_SWIPE_ATTRIBUTE]: '', [NO_DRAG_ATTRIBUTE]: '' };
	return (
		<div className={className} ref={boxRef}>
			<div
				className={b('cube-canvas')}
				ref={hostRef}
				// The cube owns a drag: the module carousel must not page, nor the tile move.
				{...noGesture}
				onPointerDown={(e) => dragRef.current.down(e)}
				onPointerMove={(e) => {
					if (dragRef.current.move(e)) showDragRef.current();
				}}
				onPointerUp={(e) => {
					dragRef.current.end(e);
					showDragRef.current();
				}}
				onPointerCancel={(e) => {
					dragRef.current.end(e);
					showDragRef.current();
				}}
			/>
		</div>
	);
}

function StillCube({ size, scramble, className }: Omit<Props, 'still'>) {
	const boxRef = useRef<HTMLDivElement>(null);
	const [url, setUrl] = useState<string | null>(null);
	const palette = useCubePalette();
	const paletteKey = palette.nxn.join(',');
	const faceColorsRef = useRef(palette.nxn);
	faceColorsRef.current = palette.nxn;

	useEffect(() => {
		const box = boxRef.current;
		if (!box) return undefined;
		// Sharp at the box's size on this screen, within reason.
		const side = Math.min(box.clientWidth, box.clientHeight) || 120;
		const pixels = Math.max(64, Math.min(480, Math.round(side * (window.devicePixelRatio || 1))));
		const key = `${size}|${pixels}|${paletteKey}|${scramble}`;
		const known = pictures.get(key);
		if (known) {
			setUrl(known);
			return undefined;
		}
		let alive = true;
		drawCubePicture({ size, turns: turnsOf(scramble), pixels, faceColors: faceColorsRef.current, hints: true }).then((drawn) => {
			if (!drawn) return;
			remember(key, drawn);
			if (alive) setUrl(drawn);
		});
		return () => {
			alive = false;
		};
	}, [size, scramble, paletteKey]);

	return (
		<div className={className} ref={boxRef}>
			{url && <img className={b('cube-picture')} src={url} alt="" draggable={false} />}
		</div>
	);
}

export default function ScrambleCube({ still, ...props }: Props) {
	return still ? <StillCube {...props} /> : <LiveCube {...props} />;
}
