/**
 * CaseCube: a trainer case drawn live by our cube engine (cube_view/render/), 2x2 and 3x3.
 *
 * The case and its stickering come from case_drawing.ts, as the case pictures do, so a card
 * and the cube it opens show the same thing. The engine draws only when something changes,
 * so a case lying still costs nothing; one WebGL context per CaseCube (a screen shows one or
 * two). Check engineDrawsCase first: other puzzles and algorithms the engine cannot read stay
 * with cubing.js.
 *
 * The box is sized by its CSS; the canvas is the largest square inside it.
 */
import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {CubeRenderer} from '../../timer/smart_cube/cube_view/render/cube_renderer';
import type {BackView} from '../../timer/smart_cube/cube_view/render/stage';
import {HOME_TILT_DEG, HOME_TURN_DEG} from '../../timer/smart_cube/cube_view/view_defaults';
import {DEFAULT_NXN_COLORS} from '../../../util/cube_colors/palette';
import {isAppVisible, onVisibilityChange} from '../../../util/app-visibility';
import {caseDrawing, enginePuzzleSize} from '../../../util/trainer/case_drawing';
import type {CubeFace} from '../types';

const DEG = Math.PI / 180;

interface Props {
	category: string;
	algorithm: string;
	topFace: CubeFace;
	frontFace: CubeFace;
	backView?: BackView;
	className?: string;
}

export default function CaseCube({category, algorithm, topFace, frontFace, backView = 'none', className}: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const cubeRef = useRef<CubeRenderer | null>(null);
	// Bumped when a cube is built, so the effects below apply the case to it.
	const [built, setBuilt] = useState(0);
	const size = enginePuzzleSize(category) ?? 3;

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return undefined;
		let cube: CubeRenderer;
		try {
			cube = new CubeRenderer({
				size,
				// Fixed colours, as the case pictures and the 2D patterns: a case looks the same everywhere.
				faceColors: DEFAULT_NXN_COLORS,
				tableTilt: HOME_TILT_DEG * DEG,
				orientation: new THREE.Quaternion().setFromEuler(new THREE.Euler(HOME_TILT_DEG * DEG, -HOME_TURN_DEG * DEG, 0)),
				floor: false,
				logo: false,
			});
		} catch (error) {
			// No WebGL (blocked, lost, very old device): the rest of the trainer still works.
			console.error('[CaseCube] 3D view unavailable:', error);
			return undefined;
		}
		// Hidden until the case is on it, so a solved cube does not flash first.
		cube.canvas.style.visibility = 'hidden';
		host.appendChild(cube.canvas);

		const fit = () => {
			const side = Math.max(1, Math.floor(Math.min(host.clientWidth, host.clientHeight)));
			cube.canvas.style.width = `${side}px`;
			cube.canvas.style.height = `${side}px`;
			cube.resize(side);
		};
		fit();
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
		if (observer) observer.observe(host);
		else window.addEventListener('resize', fit);

		cube.setActive(isAppVisible());
		const unsubVisibility = onVisibilityChange((visible) => cube.setActive(visible));
		cubeRef.current = cube;
		setBuilt((n) => n + 1);

		return () => {
			if (observer) observer.disconnect();
			else window.removeEventListener('resize', fit);
			unsubVisibility();
			cube.dispose();
			if (cubeRef.current === cube) cubeRef.current = null;
		};
	}, [size]);

	useEffect(() => {
		const cube = cubeRef.current;
		if (!cube) return undefined;
		let alive = true;
		caseDrawing({category, algorithm, topFace, frontFace})
			.catch(() => null)
			.then((drawing) => {
				if (!alive || cubeRef.current !== cube) return;
				const shown = cube.canvas.style.visibility !== 'hidden';
				// An algorithm half typed (the detail modal) cannot be read: the last case stays.
				if (!drawing && shown) return;
				cube.setMoves(drawing ? drawing.turns : []);
				cube.setCapLooks(drawing ? drawing.looks : null);
				cube.canvas.style.visibility = '';
			});
		return () => {
			alive = false;
		};
	}, [built, category, algorithm, topFace, frontFace]);

	useEffect(() => {
		cubeRef.current?.setBackView(backView);
	}, [built, backView]);

	return <div ref={hostRef} className={className} />;
}
