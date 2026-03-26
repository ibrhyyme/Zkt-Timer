/**
 * Adapted from reactbits.dev CountUp component.
 * Uses framer-motion spring physics for smooth number animation.
 * @see https://reactbits.dev/text-animations/count-up
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface CountUpProps {
	to: number;
	from?: number;
	duration?: number;
	delay?: number;
	separator?: string;
	decimals?: number;
	formatFn?: (value: number) => string;
	className?: string;
	startWhen?: boolean;
	onEnd?: () => void;
}

export default function CountUp({
	to,
	from = 0,
	duration = 1.5,
	delay = 0,
	separator = '',
	decimals,
	formatFn,
	className = '',
	startWhen = true,
	onEnd,
}: CountUpProps) {
	const ref = useRef<HTMLSpanElement>(null);
	const motionValue = useMotionValue(from);

	// Aggressive spring: settles in ~0.75s regardless of value magnitude
	const stiffness = 300;
	const damping = 45;

	const springValue = useSpring(motionValue, { damping, stiffness });
	const isInView = useInView(ref, { once: true });

	const maxDecimals = decimals ?? Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

	const formatValue = useCallback(
		(latest: number) => {
			if (formatFn) {
				return formatFn(latest);
			}

			const options: Intl.NumberFormatOptions = {
				useGrouping: !!separator,
				minimumFractionDigits: maxDecimals,
				maximumFractionDigits: maxDecimals,
			};

			const formatted = Intl.NumberFormat('en-US', options).format(latest);
			return separator ? formatted.replace(/,/g, separator) : formatted;
		},
		[maxDecimals, separator, formatFn]
	);

	// Set initial display value
	useEffect(() => {
		if (ref.current) {
			ref.current.textContent = formatValue(from);
		}
	}, [from, formatValue]);

	// Trigger animation when in view
	useEffect(() => {
		if (isInView && startWhen) {
			const timeoutId = setTimeout(() => {
				motionValue.set(to);
			}, delay * 1000);

			const endTimeoutId = setTimeout(() => {
				onEnd?.();
			}, (delay + duration) * 1000);

			return () => {
				clearTimeout(timeoutId);
				clearTimeout(endTimeoutId);
			};
		}
	}, [isInView, startWhen, motionValue, to, delay, duration, onEnd]);

	// Subscribe to spring value changes
	useEffect(() => {
		const unsubscribe = springValue.onChange((latest: number) => {
			if (ref.current) {
				ref.current.textContent = formatValue(latest);
			}
		});

		return unsubscribe;
	}, [springValue, formatValue]);

	// Render initial value as text content for SSR hydration
	return (
		<span className={className} ref={ref}>
			{formatValue(from)}
		</span>
	);
}

function getDecimalPlaces(num: number): number {
	const str = num.toString();
	if (str.includes('.')) {
		const dec = str.split('.')[1];
		if (parseInt(dec) !== 0) {
			return dec.length;
		}
	}
	return 0;
}
