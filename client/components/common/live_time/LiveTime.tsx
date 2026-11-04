import React, {useRef} from 'react';
import block from '../../../styles/bem';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import {TimeParts, splitTime} from './time_shape';
import './LiveTime.scss';

const b = block('live-time');

type LiveTimeTag = 'div' | 'span' | 'h1';

interface Props extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
	/** While true the digits run: each screen frame calls `read` and writes the result straight into the element. */
	running: boolean;
	/** The text for this frame. Called once per screen frame while running, so keep it cheap. */
	read: () => string;
	/** What React renders while not running: the resting or stopped time. */
	text: string;
	as?: LiveTimeTag;
	/** The running text changed length (a new digit, a new minute), with the new text. Rare, so a parent may re-render on it. */
	onLengthChange?: (text: string) => void;
}

/**
 * A time, drawn the same way by every timer in the app, and while running drawn once per
 * screen frame without React.
 *
 * Every timer used to push the elapsed time into React state on a 30-33 ms interval. That
 * interval is not tied to the screen's refresh, so the digits changed at most 30 times a
 * second with uneven gaps, and each tick re-rendered the whole timer around them; on a phone
 * that dropped to a few frames a second. Here a requestAnimationFrame loop writes the text
 * into the element directly and nothing else re-renders, so the digits keep up with the
 * screen.
 *
 * The time is three spans, whole seconds, point and decimals, so the decimals can be drawn
 * smaller and the point pulled in (LiveTime.scss). The spans have no React children while
 * running, which is what makes the direct write safe: React neither reads nor diffs that
 * text. When running ends React renders `text` again, replacing whatever the loop wrote
 * last. The first frame is written in a layout effect, before the browser paints, so the
 * digits never flash empty at the start.
 */
export default function LiveTime({running, read, text, as: Tag = 'span', onLengthChange, ...rest}: Props) {
	const wholeRef = useRef<HTMLSpanElement>(null);
	const pointRef = useRef<HTMLSpanElement>(null);
	const fractionRef = useRef<HTMLSpanElement>(null);
	const readRef = useRef(read);
	readRef.current = read;
	const lengthRef = useRef(onLengthChange);
	lengthRef.current = onLengthChange;

	useIsomorphicLayoutEffect(() => {
		const whole = wholeRef.current;
		const point = pointRef.current;
		const fraction = fractionRef.current;
		if (!running || !whole || !point || !fraction) return undefined;

		let shown: string | null = null;
		let shownParts: TimeParts = {whole: '', point: '', fraction: ''};
		let raf = 0;
		const paint = () => {
			const next = readRef.current();
			if (next === shown) return;
			if (shown === null || next.length !== shown.length) lengthRef.current?.(next);
			shown = next;
			const parts = splitTime(next);
			if (parts.whole !== shownParts.whole) whole.textContent = parts.whole;
			if (parts.point !== shownParts.point) point.textContent = parts.point;
			if (parts.fraction !== shownParts.fraction) fraction.textContent = parts.fraction;
			shownParts = parts;
		};
		const frame = () => {
			paint();
			raf = requestAnimationFrame(frame);
		};

		paint();
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	}, [running]);

	const parts = running ? null : splitTime(text);
	return (
		<Tag {...rest}>
			<span ref={wholeRef} className={b('whole')}>
				{parts ? parts.whole : null}
			</span>
			<span ref={pointRef} className={b('point')}>
				{parts ? parts.point : null}
			</span>
			<span ref={fractionRef} className={b('fraction')}>
				{parts ? parts.fraction : null}
			</span>
		</Tag>
	);
}
