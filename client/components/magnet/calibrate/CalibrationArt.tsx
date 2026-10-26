import React, { useEffect, useRef } from 'react';
import block from '../../../styles/bem';
import {
	ArtPart,
	ArtScene,
	ArtStyles,
	CUBE,
	EARBUDS,
	OY,
	PHONE,
	sceneKeyframes,
	sceneMs,
	smoothPath,
	stillStyles,
	SWEEP_ROUTE,
	TY,
	TZ,
	VIEW,
} from './calibration_art_motion';

const b = block('magnet-calibrate-art');

export type CalibrationArtScene = ArtScene;

// A scrambled 3x3, so the drawing reads as a real cube and not as a block.
const STICKER: Record<string, string> = {
	W: '#ffffff',
	Y: '#fedd00',
	R: '#b71234',
	O: '#ff5800',
	G: '#009b48',
	B: '#0046ad',
};
const TOP_FACE = 'WOWGWRYBW';
const FRONT_FACE = 'GRGOGBRYG';

/** Maps a drawing on a table-parallel plane at height z onto the screen. */
const flat = (z: number, dy = OY) => `matrix(1 0 0 ${TY} 0 ${dy - z * TZ})`;

/**
 * Step drawings of the calibration page (design 5.7): the table seen from the user's seat, a
 * phone lying screen up with the timer's digits and live bar on it, and a real 3x3 cube. Each
 * step loops like a short clip (calibration_art_motion.ts); with prefers-reduced-motion it shows
 * one still frame of the same scene. Theme colours for everything but the physical objects.
 */
export default function CalibrationArt({ scene }: { scene: CalibrationArtScene }) {
	const svgRef = useRef<SVGSVGElement>(null);

	useEffect(() => {
		const svg = svgRef.current;
		if (!svg || typeof svg.animate !== 'function') return;
		if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const frames = sceneKeyframes(scene);
		const duration = sceneMs(scene);
		const running: Animation[] = [];
		(Object.keys(frames) as ArtPart[]).forEach((part) => {
			svg.querySelectorAll<SVGElement>(`[data-part="${part}"]`).forEach((el) => {
				running.push(el.animate(frames[part] as Keyframe[], { duration, iterations: Infinity }));
			});
		});
		return () => running.forEach((a) => a.cancel());
	}, [scene]);

	const still = stillStyles(scene);

	return (
		<svg
			key={scene}
			ref={svgRef}
			className={b({ scene })}
			viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
			role="presentation"
			aria-hidden="true"
			focusable="false"
		>
			{scene === 'sweep' ? (
				<path className={b('route')} d={smoothPath(SWEEP_ROUTE)} transform={flat(0)} vectorEffect="non-scaling-stroke" />
			) : null}
			<g data-part="actors" style={still.actors}>
				{still['case-shadow'] ? (
					<Shadow part="case-shadow" w={EARBUDS.w} d={EARBUDS.d} style={still['case-shadow']} />
				) : null}
				<Shadow part="cube-shadow" w={CUBE} d={CUBE} style={still['cube-shadow']} />
			</g>
			<Phone still={still} />
			<g data-part="actors" style={still.actors}>
				{still.case ? <Earbuds style={still.case} /> : null}
				<Cube style={still.cube} />
			</g>
		</svg>
	);
}

function Phone({ still }: { still: ArtStyles }) {
	const { x, y, w, l, t } = PHONE;
	const cx = x + w / 2;
	return (
		<g>
			{/* the body at table height shows below the top as the phone's edge */}
			<rect className={b('phone-edge')} x={x} y={y} width={w} height={l} rx="9" transform={flat(0)} />
			<g transform={flat(t)}>
				<rect className={b('phone-button')} x={x - 1.6} y={y + 26} width="2.4" height="9" rx="1" />
				<rect className={b('phone-button')} x={x - 1.6} y={y + 39} width="2.4" height="9" rx="1" />
				<rect className={b('phone-button')} x={x + w - 0.8} y={y + 30} width="2.4" height="15" rx="1" />
				<rect className={b('phone-body')} x={x} y={y} width={w} height={l} rx="9" />
				<rect className={b('screen')} x={x + 3} y={y + 3} width={w - 6} height={l - 6} rx="6.5" />
				<rect className={b('island')} x={cx - 8} y={y + 7} width="16" height="4.6" rx="2.3" />
				<g className={b('check')} data-part="check" style={still.check}>
					<circle cx={cx} cy={y + 34} r="7.5" />
					<path d={`M${cx - 3.4} ${y + 34.2} l2.4 2.6 l4.6 -5`} />
				</g>
				<text className={b('digits')} x={cx} y={y + 66} textAnchor="middle">
					0.00
				</text>
				<text className={b('digits', { ready: true })} data-part="ready" x={cx} y={y + 66} textAnchor="middle" style={still.ready}>
					0.00
				</text>
				<g transform={`translate(${cx - 18} ${y + 74})`}>
					<rect className={b('bar-track')} width="36" height="3.6" rx="1.8" />
					<g data-part="bar" style={still.bar}>
						<rect className={b('bar-fill')} width="36" height="3.6" rx="1.8" />
						<rect className={b('bar-fill', { ready: true })} data-part="ready" width="36" height="3.6" rx="1.8" style={still.ready} />
					</g>
				</g>
			</g>
		</g>
	);
}

/** A footprint's shadow on the table, centred on the origin (the scene moves and shrinks it). */
function Shadow({ part, w, d, style }: { part: ArtPart; w: number; d: number; style?: React.CSSProperties }) {
	return <rect className={b('shadow')} data-part={part} x={-w / 2} y={(-d / 2) * TY} width={w} height={d * TY} rx="6" style={style} />;
}

/** Stickers of one face, drawn on a square of CUBE x CUBE. */
function Stickers({ colors }: { colors: string }) {
	const margin = 2.6;
	const gap = 2.2;
	const size = (CUBE - 2 * margin - 2 * gap) / 3;
	return (
		<>
			{colors.split('').map((c, i) => (
				<rect
					key={i}
					x={margin + (i % 3) * (size + gap)}
					y={margin + Math.floor(i / 3) * (size + gap)}
					width={size}
					height={size}
					rx="2.2"
					fill={STICKER[c]}
				/>
			))}
		</>
	);
}

/** The cube, its footprint corner at the origin: top face and the face toward the user. */
function Cube({ style }: { style?: React.CSSProperties }) {
	const front = CUBE * TY - CUBE * TZ;
	return (
		<g data-part="cube" style={style}>
			<rect className={b('cube-body')} y={-CUBE * TZ} width={CUBE} height={CUBE * (TY + TZ)} rx="5" />
			<g transform={`matrix(1 0 0 ${TY} 0 ${-CUBE * TZ})`}>
				<Stickers colors={TOP_FACE} />
			</g>
			<g transform={`matrix(1 0 0 ${TZ} 0 ${front})`}>
				<Stickers colors={FRONT_FACE} />
			</g>
			{/* the side toward the user is in shade */}
			<rect className={b('cube-shade')} y={front} width={CUBE} height={CUBE * TZ} rx="4" />
		</g>
	);
}

/** An earbud case, its footprint corner at the origin. */
function Earbuds({ style }: { style?: React.CSSProperties }) {
	const { w, d, h } = EARBUDS;
	const front = d * TY - h * TZ;
	return (
		<g data-part="case" style={style}>
			<rect className={b('case-body')} y={-h * TZ} width={w} height={d * TY + h * TZ} rx="6" />
			<rect className={b('case-top')} width={w} height={d} rx="7" transform={`matrix(1 0 0 ${TY} 0 ${-h * TZ})`} />
			<line className={b('case-seam')} x1="3" x2={w - 3} y1={front + 4 * TZ} y2={front + 4 * TZ} />
		</g>
	);
}
