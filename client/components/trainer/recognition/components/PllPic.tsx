/**
 * PllPic — sr-puzzlegen-pll SVG wrapper, dual-layer hover (cube ↔ cube-pll), tıklanabilirse modal aç.
 * Referans `src/components/PllPic.vue` portu.
 *
 * sr-puzzlegen-pll dinamik import: SSR safety + lazy load.
 */
import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import block from '../../../../styles/bem';
import {scrambleForCase, noCubePuzzleMask} from '../../../../util/trainer/recognition/scramble';
import {topViewAdjustment, type Rotation, type ColorScheme} from '../../../../util/trainer/recognition/cube_display';
import type {PllCase} from '../../../../util/trainer/recognition/scramble';

const b = block('trainer-recognition');

export type PllPicViewType = 'cube' | 'cube-pll' | 'cube-top';

interface PllPicProps {
	pllCase: PllCase | null;
	viewType: PllPicViewType;
	size: number;
	clickable?: boolean;
	crossColor?: string;
	hoverViewType?: PllPicViewType;
	hovered?: boolean; // externally controlled hover state
	rotationOverride?: Rotation[] | null;
	colorSchemeOverride?: ColorScheme | null;
	puzzleRotations: Rotation[];
	strokeWidth: number;
	colorScheme: ColorScheme;
	onClick?: () => void; // tıklanabilirse modal aç (parent kontrol eder)
}

// sr-puzzlegen-pll lazy load cache
let _svgFn: ((el: HTMLElement, viewType: string, opts: any) => void) | null = null;
let _loadPromise: Promise<void> | null = null;
async function ensureSrPuzzlegen(): Promise<void> {
	if (_svgFn) return;
	if (!_loadPromise) {
		_loadPromise = import('sr-puzzlegen-pll').then((mod: any) => {
			_svgFn = mod.SVG || mod.default?.SVG;
			if (!_svgFn) throw new Error('sr-puzzlegen-pll: SVG export not found');
		});
	}
	await _loadPromise;
}

export default function PllPic({
	pllCase,
	viewType,
	size,
	clickable = false,
	crossColor,
	hoverViewType,
	hovered,
	rotationOverride = null,
	colorSchemeOverride = null,
	puzzleRotations,
	strokeWidth,
	colorScheme,
	onClick,
}: PllPicProps) {
	const baseRef = useRef<HTMLDivElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const [localHovered, setLocalHovered] = useState(false);
	const isHovered = hovered !== undefined ? hovered : localHovered;

	const scramble = useMemo(() => {
		const base = scrambleForCase(pllCase, crossColor);
		if (viewType === 'cube-top') {
			const adj = topViewAdjustment(puzzleRotations);
			return adj ? `${base} ${adj}` : base;
		}
		return base;
	}, [pllCase, crossColor, viewType, puzzleRotations]);

	const insertSvg = useCallback(
		async (target: HTMLDivElement | null, vType: PllPicViewType) => {
			if (typeof window === 'undefined' || !target) return;
			try {
				await ensureSrPuzzlegen();
			} catch (e) {
				console.warn('sr-puzzlegen-pll load failed', e);
				return;
			}
			if (!_svgFn) return;
			target.innerHTML = '';
			const opts: any = {
				puzzle: {
					alg: scramble,
					scheme: colorSchemeOverride || colorScheme,
				},
				width: size,
				height: size,
				strokeWidth,
			};
			if (vType === 'cube' || vType === 'cube-pll') {
				opts.puzzle.rotations = rotationOverride || puzzleRotations;
			}
			if (!scramble) {
				opts.puzzle.mask = noCubePuzzleMask;
			}
			_svgFn(target, vType, opts);
		},
		[scramble, size, strokeWidth, colorScheme, colorSchemeOverride, rotationOverride, puzzleRotations]
	);

	useEffect(() => {
		insertSvg(baseRef.current, viewType);
	}, [insertSvg, viewType]);

	useEffect(() => {
		if (hoverViewType) insertSvg(overlayRef.current, hoverViewType);
	}, [insertSvg, hoverViewType]);

	const handleClick = useCallback(() => {
		if (clickable && onClick) onClick();
	}, [clickable, onClick]);

	if (hoverViewType) {
		return (
			<div
				className={b('pll-pic-wrapper', {clickable})}
				onMouseEnter={() => hovered === undefined && setLocalHovered(true)}
				onMouseLeave={() => hovered === undefined && setLocalHovered(false)}
				onClick={handleClick}
			>
				<div ref={baseRef} className={b('pll-pic-layer', {base: true})} />
				<div
					ref={overlayRef}
					className={
						isHovered
							? `${b('pll-pic-layer', {overlay: true})} ${b('pll-pic-layer', {'overlay-visible': true})}`
							: b('pll-pic-layer', {overlay: true})
					}
				/>
			</div>
		);
	}

	return (
		<div
			ref={baseRef}
			className={b('pll-pic-wrapper', {clickable})}
			onClick={handleClick}
		/>
	);
}
