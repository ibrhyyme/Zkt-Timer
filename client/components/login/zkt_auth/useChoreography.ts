import { useCallback, useEffect, useRef, useState } from 'react';

export type SlideStage = '' | 'leave' | 'shake';

export interface Choreography {
	chaos: number;
	moveTrigger: number;
	solvedGlow: boolean;
	slideStage: SlideStage;
	isShaking: boolean;
	resetSignal: number;
	onFieldFill: (fieldName: string, totalFields: number) => void;
	onSubmitStart: () => void;
	onSubmitSuccess: () => void;
	onSubmitError: () => void;
	onWcaTrigger: () => void;
	onWcaAdvance: () => void;
	resetChaos: () => void;
}

export function useChoreography(): Choreography {
	const [chaos, setChaos] = useState(1);
	const [moveTrigger, setMoveTrigger] = useState(0);
	const [solvedGlow, setSolvedGlow] = useState(false);
	const [slideStage, setSlideStage] = useState<SlideStage>('');
	const [resetSignal, setResetSignal] = useState(0);
	const filledRef = useRef<Set<string>>(new Set());

	const fireMoves = useCallback((count: number, stagger = 160) => {
		for (let i = 0; i < count; i++) {
			setTimeout(() => setMoveTrigger((t) => t + 1), i * stagger);
		}
	}, []);

	useEffect(() => {
		fireMoves(8, 140);
	}, [fireMoves]);

	const onFieldFill = useCallback((name: string, total: number) => {
		if (filledRef.current.has(name)) return;
		filledRef.current.add(name);
		// chaos = 1 - (filledCount / totalFields)
		// When all fields are filled, chaos = 0 → AuthCube fully solves cube
		const filled = filledRef.current.size;
		setChaos(Math.max(0, 1 - filled / Math.max(1, total)));
	}, []);

	const onSubmitStart = useCallback(() => {
		// reserved hook for future spinner orchestration
	}, []);

	const onSubmitSuccess = useCallback(() => {
		setChaos(0);
		setSolvedGlow(true);
		fireMoves(3, 160);
		setTimeout(() => setSlideStage('leave'), 900);
	}, [fireMoves]);

	const onSubmitError = useCallback(() => {
		// Error feedback: shake + banner only. Don't touch cube —
		// auto-solve logic is one-way (progress forward only, no backward scramble).
		setSlideStage('shake');
		setTimeout(() => setSlideStage(''), 500);
	}, []);

	const onWcaTrigger = useCallback(() => {
		setChaos(1);
		fireMoves(8, 90);
	}, [fireMoves]);

	const onWcaAdvance = useCallback(() => {
		setChaos((c) => Math.max(0.05, c - 0.25));
		fireMoves(3, 160);
	}, [fireMoves]);

	const resetChaos = useCallback(() => {
		filledRef.current = new Set();
		setChaos(1);
		setSolvedGlow(false);
		setSlideStage('');
		setResetSignal((s) => s + 1);
		fireMoves(4, 140);
	}, [fireMoves]);

	return {
		chaos,
		moveTrigger,
		solvedGlow,
		slideStage,
		isShaking: slideStage === 'shake',
		resetSignal,
		onFieldFill,
		onSubmitStart,
		onSubmitSuccess,
		onSubmitError,
		onWcaTrigger,
		onWcaAdvance,
		resetChaos,
	};
}
