import {useRef, useCallback, useEffect, useState, RefObject} from 'react';

type SwipePhase = 'idle' | 'swiping' | 'snapping-back' | 'dismissing';

interface UseSwipeBackOptions {
	containerRef: RefObject<HTMLElement>;
	onSwipeBack: () => void;
	disabled?: boolean;
	edgeWidth?: number;
	threshold?: number;
	allowRightEdge?: boolean;
	useWindow?: boolean;
}

interface UseSwipeBackReturn {
	translateX: number;
	progress: number;
	isSwiping: boolean;
	phase: SwipePhase;
}

function hasHorizontalScroll(el: HTMLElement): boolean {
	let current: HTMLElement | null = el;
	while (current) {
		const style = window.getComputedStyle(current);
		if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
			if (current.scrollWidth > current.clientWidth) return true;
		}
		current = current.parentElement;
	}
	return false;
}

export function useSwipeBack(options: UseSwipeBackOptions): UseSwipeBackReturn {
	const {
		containerRef,
		onSwipeBack,
		disabled = false,
		edgeWidth = 24,
		threshold = 100,
		allowRightEdge = false,
		useWindow = false,
	} = options;

	const [translateX, setTranslateX] = useState(0);
	const [progress, setProgress] = useState(0);
	const [phase, setPhase] = useState<SwipePhase>('idle');

	const startXRef = useRef(0);
	const startYRef = useRef(0);
	const swipingRef = useRef(false);
	const directionLockedRef = useRef(false);
	const currentTranslateXRef = useRef(0);
	const onSwipeBackRef = useRef(onSwipeBack);
	const disabledRef = useRef(disabled);

	onSwipeBackRef.current = onSwipeBack;
	disabledRef.current = disabled;

	const cancel = useCallback(() => {
		swipingRef.current = false;
		directionLockedRef.current = false;
		currentTranslateXRef.current = 0;
		setTranslateX(0);
		setProgress(0);
		setPhase('idle');
	}, []);

	const handleTouchStart = useCallback(
		(e: TouchEvent) => {
			if (disabledRef.current) return;
			if (e.touches.length > 1) return;

			const touch = e.touches[0];
			const isLeftEdge = touch.clientX <= edgeWidth;
			const isRightEdge = allowRightEdge && touch.clientX >= window.innerWidth - edgeWidth;

			if (!isLeftEdge && !isRightEdge) return;

			const target = e.target as HTMLElement;
			if (!target) return;

			const tag = target.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || target.isContentEditable) {
				return;
			}

			if (hasHorizontalScroll(target)) return;

			if (!useWindow && containerRef.current && !containerRef.current.contains(target)) {
				return;
			}

			startXRef.current = touch.clientX;
			startYRef.current = touch.clientY;
			swipingRef.current = true;
			directionLockedRef.current = false;
			currentTranslateXRef.current = 0;
			setPhase('swiping');
		},
		[edgeWidth, allowRightEdge, useWindow, containerRef]
	);

	const handleTouchMove = useCallback(
		(e: TouchEvent) => {
			if (!swipingRef.current) return;

			const touch = e.touches[0];
			if (!touch) return;

			const deltaX = touch.clientX - startXRef.current;
			const deltaY = touch.clientY - startYRef.current;

			if (!directionLockedRef.current) {
				if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

				if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
					cancel();
					return;
				}
				directionLockedRef.current = true;
			}

			if (deltaX <= 0) {
				cancel();
				return;
			}

			const currentProgress = Math.min(deltaX / threshold, 1);
			currentTranslateXRef.current = deltaX;
			setTranslateX(deltaX);
			setProgress(currentProgress);

			e.preventDefault();
		},
		[threshold, cancel]
	);

	const handleTouchEnd = useCallback(() => {
		if (!swipingRef.current) return;
		swipingRef.current = false;
		directionLockedRef.current = false;

		const completed = currentTranslateXRef.current >= threshold;

		if (completed) {
			setPhase('dismissing');
			setTranslateX(window.innerWidth);
			setProgress(1);
			currentTranslateXRef.current = 0;

			setTimeout(() => {
				onSwipeBackRef.current();
				setTranslateX(0);
				setProgress(0);
				setPhase('idle');
			}, 200);
		} else {
			setPhase('snapping-back');
			setTranslateX(0);
			setProgress(0);
			currentTranslateXRef.current = 0;

			setTimeout(() => {
				setPhase('idle');
			}, 250);
		}
	}, [threshold]);

	useEffect(() => {
		if (disabled || typeof window === 'undefined') return;

		const target = useWindow ? window : containerRef?.current;
		if (!target) return;

		const opts = {passive: false} as AddEventListenerOptions;
		target.addEventListener('touchstart', handleTouchStart as EventListener, opts);
		target.addEventListener('touchmove', handleTouchMove as EventListener, opts);
		target.addEventListener('touchend', handleTouchEnd as EventListener, opts);

		return () => {
			target.removeEventListener('touchstart', handleTouchStart as EventListener, opts);
			target.removeEventListener('touchmove', handleTouchMove as EventListener, opts);
			target.removeEventListener('touchend', handleTouchEnd as EventListener, opts);
		};
	}, [disabled, useWindow, containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

	useEffect(() => {
		if (disabled && phase !== 'idle') {
			cancel();
		}
	}, [disabled, phase, cancel]);

	return {
		translateX,
		progress,
		isSwiping: phase === 'swiping',
		phase,
	};
}
