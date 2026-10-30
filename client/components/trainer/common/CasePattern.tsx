/**
 * CasePattern: the picture of one trainer case (trainer-sets 5.6).
 *
 * One rule for every place that shows a case: the selector card (AlgorithmCard), the set
 * picker, the set page rows and the set cards. Priority, as the selector always had it:
 *   isometric pattern (WVLS, VHLS) → last layer pattern → 2D puzzle pattern (2x2, 4x4,
 *   Pyraminx, Skewb, Square-1) → 3D picture.
 *
 * The 3D picture is drawn once per case and orientation per device (case_snapshot.ts, kept in
 * IndexedDB) when the case comes on screen, offscreen (2x2 and 3x3 by our cube engine, other
 * puzzles by a short-lived cubing.js player), inside the shared budget of twisty_slots (at most
 * 8 drawings at once), and then shown as an image. The pattern
 * files load once from Trainer.tsx; until they are there a pattern category shows an empty box,
 * never a 3D picture it would throw away a moment later.
 *
 * The box fills its parent: the caller sizes it (`size` sets a square in px when given).
 */
import React, {useEffect, useRef, useState} from 'react';
import block from '../../../styles/bem';
import {
	getStickering,
	isLLCategory,
	isIsometricCategory,
	getDefaultFrontFace,
	is2DPatternCategory,
	getPuzzlePatternType,
	isSQ1MirrorCategory,
} from '../../../util/trainer/algorithm_engine';
import {getLLPattern, isLLPatternsLoaded, useLLPattern} from '../../../util/trainer/ll_patterns';
import {getIsometricPattern, isIsometricPatternsLoaded} from '../../../util/trainer/isometric_patterns';
import {getPuzzlePattern, isPuzzlePatternsLoaded} from '../../../util/trainer/puzzle_patterns';
import LLPatternView from '../panels/LLPatternView';
import CubeIsometricView from '../panels/CubeIsometricView';
import CubeTopPatternView from '../panels/CubeTopPatternView';
import PyraminxPatternView from '../panels/PyraminxPatternView';
import SkewbPatternView from '../panels/SkewbPatternView';
import SQ1PatternView from '../panels/SQ1PatternView';
import {nextTwistySlotId, twistySlots} from './twisty_slots';
import {findStoredSnapshot, getCaseSnapshot, renderCaseSnapshot, snapshotKey} from './case_snapshot';
import type {CubeFace} from '../types';
import './CasePattern.scss';

const b = block('case-pattern');

/** How long a 3D-only case stays on screen before its picture is drawn. */
const VISIBLE_SETTLE_MS = 150;

export interface CasePatternProps {
	category: string;
	algorithm: string;
	topFace?: CubeFace;
	frontFace?: CubeFace;
	/** Square size in px. Without it the box fills its parent. */
	size?: number;
	/** Stretch a 3D fallback player to the box (small thumbnails). */
	fit?: boolean;
	className?: string;
}

/** Which picture a case gets; `use3D` when no pattern file has it. */
export function casePatternKind(category: string, algorithm: string) {
	const isIso = isIsometricCategory(category);
	const isLL = isLLCategory(category);
	const is2DPuzzle = is2DPatternCategory(category);
	const puzzlePatternType = getPuzzlePatternType(category);

	const isometricPattern = isIso ? getIsometricPattern(algorithm) : null;
	const llPattern = isLL ? getLLPattern(algorithm) : null;
	const puzzlePattern = is2DPuzzle && puzzlePatternType ? getPuzzlePattern(puzzlePatternType, algorithm, category) : null;

	// 3D only when the category has no pattern file, or the file is loaded and lacks this case.
	const use3D = isIso
		? isIsometricPatternsLoaded() && !isometricPattern
		: isLL
			? isLLPatternsLoaded() && !llPattern
			: is2DPuzzle
				? isPuzzlePatternsLoaded() && !puzzlePattern
				: true;

	return {isIso, isLL, isometricPattern, llPattern, puzzlePattern, puzzlePatternType, use3D};
}

export default function CasePattern({
	category,
	algorithm,
	topFace = 'U',
	frontFace = 'F',
	size,
	fit = false,
	className,
}: CasePatternProps) {
	const kind = casePatternKind(category, algorithm);
	const {isIso, isLL, isometricPattern, puzzlePattern, puzzlePatternType} = kind;
	// A last layer case the pattern file lacks gets its pattern generated here (newer categories).
	const generatedLL = useLLPattern(algorithm, isLL && !kind.llPattern);
	const llPattern = kind.llPattern ?? generatedLL.pattern;
	const use3D = isLL ? !llPattern && !generatedLL.pending && isLLPatternsLoaded() : kind.use3D;
	const effectiveFrontFace = isLL || isIso ? getDefaultFrontFace(topFace) : frontFace;
	// 3D-only cases are drawn once into a picture (case_snapshot.ts); the card shows the picture.
	const key = use3D ? snapshotKey({category, algorithm, topFace, frontFace: effectiveFrontFace}) : '';
	const [snapshot, setSnapshot] = useState<{key: string; url: string} | null>(null);
	const image = key ? (snapshot?.key === key ? snapshot.url : getCaseSnapshot(key)) : null;
	const needsDraw = use3D && !image;

	const boxRef = useRef<HTMLDivElement>(null);
	const slotIdRef = useRef<number>(0);
	if (!slotIdRef.current) slotIdRef.current = nextTwistySlotId();
	const [visible, setVisible] = useState(false);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// On screen? Only watched until the picture exists. A case counts as visible after it stays
	// on screen for a moment, so scrolling past a long list does not queue every case on the way.
	useEffect(() => {
		if (!needsDraw || !boxRef.current || typeof IntersectionObserver === 'undefined') return;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (timer) clearTimeout(timer);
				timer = null;
				if (!entry.isIntersecting) setVisible(false);
				else timer = setTimeout(() => setVisible(true), VISIBLE_SETTLE_MS);
			},
			{rootMargin: '100px'}
		);
		observer.observe(boxRef.current);
		return () => {
			if (timer) clearTimeout(timer);
			observer.disconnect();
		};
	}, [needsDraw]);

	// While visible: the picture kept on the device if there is one, else a draw inside the shared
	// budget. The slot is held only while the offscreen player draws; a case that scrolls away
	// before its turn leaves the queue.
	useEffect(() => {
		if (!needsDraw || !visible) return;
		const id = slotIdRef.current;
		const c = {category, algorithm, topFace, frontFace: effectiveFrontFace};
		let alive = true;
		let queued = false;
		let drawing = false;
		const show = (url: string | null) => {
			if (alive && mountedRef.current && url) setSnapshot({key, url});
		};
		findStoredSnapshot(c).then((stored) => {
			if (!alive) return;
			if (stored) return show(stored);
			queued = true;
			twistySlots.request(id, () => {
				drawing = true;
				renderCaseSnapshot(c).then((url) => {
					drawing = false;
					twistySlots.release(id);
					show(url);
				});
			});
		});
		return () => {
			alive = false;
			// A running draw gives its slot back itself when it ends.
			if (queued && !drawing) twistySlots.release(id);
		};
	}, [needsDraw, visible, key, category, algorithm, topFace, effectiveFrontFace]);

	const style = size ? {width: size, height: size} : undefined;
	const stickering = getStickering(category);

	let body: React.ReactNode = null;
	if (isometricPattern) {
		body = <CubeIsometricView pattern={isometricPattern} topFace={topFace} frontFace={effectiveFrontFace} />;
	} else if (llPattern) {
		body = <LLPatternView pattern={llPattern} topFace={topFace} frontFace={effectiveFrontFace} stickering={stickering} />;
	} else if (puzzlePattern && puzzlePatternType) {
		if (puzzlePatternType === '2x2' && typeof puzzlePattern === 'string') {
			body = <CubeTopPatternView pattern={puzzlePattern} layers={2} topFace={topFace} />;
		} else if (puzzlePatternType === '4x4' && typeof puzzlePattern === 'string') {
			body = <CubeTopPatternView pattern={puzzlePattern} layers={4} topFace={topFace} />;
		} else if (puzzlePatternType === 'pyraminx' && typeof puzzlePattern === 'string') {
			body = <PyraminxPatternView pattern={puzzlePattern} />;
		} else if (puzzlePatternType === 'skewb' && typeof puzzlePattern === 'string') {
			body = <SkewbPatternView pattern={puzzlePattern} topFace={topFace} />;
		} else if (puzzlePatternType === 'sq1' && typeof puzzlePattern === 'object') {
			body = (
				<SQ1PatternView
					top={(puzzlePattern as any).t}
					bottom={(puzzlePattern as any).b}
					mirror={isSQ1MirrorCategory(category)}
				/>
			);
		}
	} else if (image) {
		body = <img className={b('snapshot')} src={image} alt="" draggable={false} />;
	}

	return (
		<div ref={boxRef} className={className ? `${b({fit})} ${className}` : b({fit})} style={style} aria-hidden="true">
			{body}
		</div>
	);
}
