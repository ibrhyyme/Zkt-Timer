import React, { ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {useTranslation} from 'react-i18next';
import './TimerScramble.scss';
import { ArrowClockwise, CaretLeft, CaretRight, Lock, LockSimple, PencilSimple } from 'phosphor-react';
import TextareaAutosize from 'react-textarea-autosize';
import CopyText, { copyText } from '../../../common/copy_text/CopyText';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../../../db/settings/update';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import Button from '../../../common/button/Button';
import { TimerContext } from '../../Timer';
import block from '../../../../styles/bem';
import { resetScramble } from '../../helpers/scramble';
import { useScrambleForBucket, useScrambleHistory } from '../../helpers/scramble_navigation';
import SmartScramble from './smart_scramble/SmartScramble';
import { setTimerParam, setTimerParams } from '../../helpers/params';
import { smartCubeSelected } from '../../helpers/util';
import { useSettings } from '../../../../util/hooks/useSettings';
import { useHasSmartTurns } from '../../../../util/hooks/useTimerStore';
import { useSmartCubeStore } from '../../../../util/hooks/useSmartCubeStore';
import { setSetting } from '../../../../db/settings/update';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../../../db/solves/operations';
import { useLatestSolve } from '../../../../util/hooks/useLatestSolve';
import useIsomorphicLayoutEffect from '../../../../util/hooks/useIsomorphicLayoutEffect';
import {
	countMoves,
	DESKTOP_SCRAMBLE_MIN_PX,
	fitReferenceText,
	SCRAMBLE_LINE_HEIGHT_RATIO,
	scrambleLinesBudget,
} from '../../helpers/fit_scramble';
import { findFitFontSize, FitTextSpacing } from '../../../../util/text-fit';

const b = block('timer-scramble');
const timerBlock = block('timer');

export default function TimerScramble() {
	const {t} = useTranslation();
	const context = useContext(TimerContext);

	const scrambleInput = useRef(null);
	const mobileMode = useGeneral('mobile_mode');
	const cubeType = context.cubeType;
	const isMegaminx = cubeType === 'minx';
	let timerScrambleSize = useSettings('timer_scramble_size');

	if (mobileMode) {
		timerScrambleSize *= MOBILE_FONT_SIZE_MULTIPLIER;
	}

	const { editScramble, scrambleLocked, notification, hideScramble, timeStartedAt, matchMode } = context;
	let scramble = context.scramble;
	const scrambleMonospace = useSettings('scramble_monospace');
	const scrambleAlignment = useSettings('scramble_alignment');
	const scrambleClickAction = useSettings('scramble_click_action');
	const isSmart = smartCubeSelected(context);
	// The turn list is not in TimerContext (see FAST_TIMER_FIELDS); only whether it is
	// empty matters here, and that does not change on every move.
	const hasSmartTurns = useHasSmartTurns();
	// Connection state lives in its own slice (reducers/smart_cube.ts), not the context.
	const smartCubeConnected = useSmartCubeStore('smartCubeConnected');
	// See TimerControls: the lock is about contradicting a connected cube, so it
	// must not fire when no cube is attached (or when a stale turn list survived
	// an earlier connection).
	const isSmartScrambling =
		isSmart && !!smartCubeConnected && hasSmartTurns && !timeStartedAt;

	// +2 and DNF for latest solve
	const latestSolve = useLatestSolve();

	// Scramble and Previous / Next history live in the timer store, shared with the mobile
	// layout, so a tablet rotating across 1024px keeps both.
	useScrambleForBucket(context);
	const {
		goPrevious: handlePreviousScramble,
		goNext: handleNextScramble,
		canGoPrevious,
	} = useScrambleHistory(context, !!timeStartedAt || scrambleLocked || isSmartScrambling);

	function toggleScrambleLock() {
		if (editScramble) {
			setTimerParam('editScramble', false);
		}
		setTimerParam('scrambleLocked', !scrambleLocked);

		const lockedScramble = scrambleLocked ? null : scramble;

		setSetting('locked_scramble', lockedScramble);
	}

	function toggleEditScramble() {
		setTimerParam('editScramble', !editScramble);

		setTimeout(() => {
			if (editScramble && scrambleInput.current) {
				scrambleInput.current.focus();
			}
		});
	}

	function handleScrambleChange(e) {
		e.preventDefault();
		const value = e.target.value;
		setTimerParams({ scramble: value, originalScramble: value });
	}

	function handlePlusTwo() {
		if (latestSolve) {
			togglePlusTwoSolveDb(latestSolve);
		}
	}

	function handleDNF() {
		if (latestSolve) {
			toggleDnfSolveDb(latestSolve);
		}
	}

	// Click action on the scramble body (desktop) — copy or next scramble.
	function handleScrambleClick() {
		if (scrambleClickAction === 'none' || editScramble || scrambleLocked || timeStartedAt || isSmart) {
			return;
		}
		if (scrambleClickAction === 'copy') {
			copyText(scramble);
		} else if (scrambleClickAction === 'next') {
			handleNextScramble();
		}
	}

	// Desktop: the scramble shrinks from the user's size when the timer area is too short for
	// it (helpers/fit_scramble.ts). Never above the user's size.
	const bodyRef = useRef<HTMLDivElement>(null);
	const [fittedSize, setFittedSize] = useState<number | null>(null);
	const scrambleSize = !mobileMode && fittedSize !== null ? Math.min(fittedSize, timerScrambleSize) : timerScrambleSize;

	const userSizeRef = useRef(timerScrambleSize);
	userSizeRef.current = timerScrambleSize;
	const scrambleTextRef = useRef('');
	scrambleTextRef.current = context.scramble || '';
	// The most moves seen for this puzzle, so a shorter scramble does not get a bigger size
	// than the one before it (fitReferenceText). Starts over when the puzzle changes.
	const mostMovesRef = useRef({ bucket: '', moves: 0 });
	const bucket = `${cubeType}|${context.scrambleSubset || ''}`;
	if (mostMovesRef.current.bucket !== bucket) mostMovesRef.current = { bucket, moves: 0 };
	mostMovesRef.current.moves = Math.max(mostMovesRef.current.moves, countMoves(context.scramble || ''));
	// Held while a solve runs (the scramble is hidden but keeps its place) and while it is
	// being typed into (a refit per keystroke would make the text jump).
	const holdFitRef = useRef(false);
	holdFitRef.current = !!timeStartedAt || !!editScramble;

	const fitScramble = useCallback(() => {
		const body = bodyRef.current;
		const text = scrambleTextRef.current;
		if (mobileMode || !body || !text || holdFitRef.current) return;

		// The area that clips (`__main`, overflow hidden), the content it centres, and the
		// block holding the scramble's lines: the field or the Megaminx lines inside the body,
		// or the body itself for the smart scramble, whose moves sit straight in it.
		const area = body.closest<HTMLElement>(`.${timerBlock('main')}`);
		const content = body.closest<HTMLElement>(`.${timerBlock('main-center')}`);
		const first = body.firstElementChild as HTMLElement | null;
		const lines =
			first && (first.tagName === 'TEXTAREA' || first.classList.contains(`${b('megaminx-lines')}`)) ? first : body;
		if (!area || !content || area.clientHeight === 0) return;

		const px = (value: string) => parseFloat(value) || 0;
		const style = getComputedStyle(lines);
		const isField = lines.tagName === 'TEXTAREA';
		const chromeX = isField ? px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth) : 0;
		const chromeY = isField ? px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth) : 0;

		// The smart moves are items of a wrapping flex row: its gaps stand in for spaces.
		const spacing: FitTextSpacing = {};
		if (style.display === 'flex' || style.display === 'inline-flex') {
			const first = lines.firstElementChild;
			spacing.rowGap = px(style.rowGap);
			spacing.itemGap = px(style.columnGap) + (first ? px(getComputedStyle(first).marginRight) : 0);
		}

		const budget = scrambleLinesBudget(area.clientHeight, content.offsetHeight, lines.offsetHeight, chromeY);
		const { fontSize } = findFitFontSize(
			fitReferenceText(text, mostMovesRef.current.moves),
			style.fontFamily,
			style.fontWeight,
			userSizeRef.current,
			Math.min(DESKTOP_SCRAMBLE_MIN_PX, userSizeRef.current),
			SCRAMBLE_LINE_HEIGHT_RATIO,
			lines.offsetWidth - chromeX,
			budget,
			spacing
		);
		setFittedSize(fontSize);
	}, [mobileMode]);

	useIsomorphicLayoutEffect(() => {
		fitScramble();
	}, [fitScramble, scramble, timerScrambleSize, editScramble, isSmart, hideScramble, !!timeStartedAt, scrambleLocked, !!notification, isSmartScrambling]);

	// The area changes height with the window, the module rails and bars, the digits and
	// the cube beside them; the content with everything in it; the body when what it holds
	// changes (the smart moves replacing the field). The body remounts with every scramble,
	// so this subscribes again then.
	useEffect(() => {
		const body = bodyRef.current;
		if (mobileMode || !body || typeof ResizeObserver === 'undefined') return undefined;
		const area = body.closest(`.${timerBlock('main')}`);
		const content = body.closest(`.${timerBlock('main-center')}`);
		if (!area || !content) return undefined;

		const observer = new ResizeObserver(() => fitScramble());
		observer.observe(area);
		observer.observe(content);
		observer.observe(body);

		// Roboto Mono loads late; until it does, the canvas measures the fallback font.
		let cancelled = false;
		const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
		fonts?.ready.then(() => {
			if (!cancelled) fitScramble();
		});
		fonts?.addEventListener('loadingdone', fitScramble);
		return () => {
			cancelled = true;
			observer.disconnect();
			fonts?.removeEventListener('loadingdone', fitScramble);
		};
	}, [fitScramble, mobileMode, scramble, editScramble, isSmart]);

	// Navigation button disabled states
	const canGoNext = !scrambleLocked && !timeStartedAt && !isSmartScrambling;

	if (hideScramble) {
		scramble = '';
	} else if (isMegaminx && scramble) {
		// Pochmann/Carrot/OldStyle already contain \n — don't touch
		// Only break lines on single-line Megaminx scrambles (2-Gen, random-state)
		if (!scramble.includes('\n') && scramble.includes('++')) {
			// Pochmann notation but \n removed — break line after U/U'
			scramble = scramble.replace(/ (U'?)( |$)/g, ' $1\n').trim();
		}
	}

	let scrambleBody: ReactNode;

	// Megaminx: render each line as separate div (prevents wrap shift)
	if (isMegaminx && !editScramble && scramble && scramble.includes('\n')) {
		scrambleBody = (
			<div className={b('megaminx-lines')}>
				{scramble.split('\n').map((line, i) => (
					<div key={i} className={b('megaminx-line')}>{line}</div>
				))}
			</div>
		);
	} else {
		scrambleBody = (
			<TextareaAutosize
				// The field sizes its height when its text changes, not when the font does, so
				// a fitted size (see fitScramble) left it at the old height. Remounting on the
				// size measures it again. The size is held while editing, so focus is not lost.
				key={scrambleSize}
				onChange={handleScrambleChange}
				value={scramble}
				disabled={!editScramble}
				minRows={1}
				placeholder={hideScramble ? '' : 'scramble'}
				ref={scrambleInput}
				// Its own element class. It used to carry the root block class (`b({edit})`), so the
				// root's flex column, width and z-index all applied to the textarea as well.
				className={b('input', { edit: editScramble })}
			/>
		);
	}

	// Is smart cube
	if (isSmart && !timeStartedAt && scramble) {
		scrambleBody = <SmartScramble />;
	} else if (isSmart && timeStartedAt) {
		// Hide scramble while timer is running
		scrambleBody = null;
	} else if (isSmart && !scramble) {
		// Hide scramble when empty after abort (so it doesn't overlap mismatch banner)
		scrambleBody = null;
	}

	// +2 and DNF buttons now in actions area above, no duplicate below

	return (
		<div className={b()}>
			{notification}
			{/* The locked banner and the navigation row stay in the flow during a solve, only
			    hidden: unmounting them shortened the block and the centred digits jumped up on
			    every start (seen under reduced motion). Not in match mode. */}
			{scrambleLocked && !matchMode && (
				<div className={b('locked-banner', { hidden: !!timeStartedAt })} aria-hidden={timeStartedAt ? true : undefined}>
					{t('timer_scramble.scramble_locked')}
				</div>
			)}
			{!matchMode && !isSmartScrambling && (
				<div className={b('nav', { hidden: !!timeStartedAt })} aria-hidden={timeStartedAt ? true : undefined}>
					<button
						className={b('nav-btn', { disabled: !canGoPrevious })}
						onClick={handlePreviousScramble}
						disabled={!canGoPrevious}
						title={t('timer_scramble.previous_tooltip')}
					>
						<CaretLeft weight="bold" />
						<span>{t('timer_scramble.previous')}</span>
					</button>
					<button
						className={b('nav-btn')}
						onClick={handleNextScramble}
						disabled={!canGoNext}
						title={t('timer_scramble.next_tooltip')}
					>
						<span>{t('timer_scramble.next')}</span>
						<CaretRight weight="bold" />
					</button>
				</div>
			)}
			<div
				// Keyed by the scramble so a genuine replacement (new solve, prev/next
				// nav) remounts this element and plays the CSS fade-in on insertion.
				// While editing the key is pinned to a constant instead of the live
				// value — the textarea updates `scramble` on every keystroke, and
				// keying by that would remount (and drop focus/cursor from) the
				// textarea on every character typed.
				key={editScramble ? 'edit' : scramble}
				ref={bodyRef}
				className={b('body', {
					smart: isSmart,
					megaminx: isMegaminx,
				})}
				style={{
					fontSize: scrambleSize + 'px',
					lineHeight: scrambleSize * SCRAMBLE_LINE_HEIGHT_RATIO + 'px',
					fontFamily: scrambleMonospace ? "'Roboto Mono', monospace" : 'inherit',
					textAlign: scrambleAlignment,
					cursor: scrambleClickAction !== 'none' && !editScramble && !isSmart ? 'pointer' : undefined,
				}}
				onClick={handleScrambleClick}
			>
				{scrambleBody}
			</div>
			<div className={b('actions')}>
				{/* In match mode show only +2 and DNF */}
				{!matchMode && (
					<Button
						onClick={toggleEditScramble}
						title="Edit scramble"
						white={!isSmart && editScramble}
						transparent
						disabled={isSmart || scrambleLocked}
						icon={<PencilSimple weight="bold" />}
					/>
				)}
				{latestSolve && !matchMode && (
					<>
						<Button
							onClick={handlePlusTwo}
							title="Plus two solve"
							text="+2"
							transparent
							warning={latestSolve.plus_two}
						/>
						<Button
							onClick={handleDNF}
							title="DNF solve"
							transparent
							danger={latestSolve.dnf}
							text="DNF"
						/>
					</>
				)}
				{!matchMode && (
					<>
						<Button
							transparent={!scrambleLocked}
							warning={scrambleLocked}
							onClick={toggleScrambleLock}
							title="Lock scramble"
							icon={scrambleLocked ? <LockSimple weight="fill" /> : <Lock weight="bold" />}
						/>
						<CopyText
							text={scramble}
							buttonProps={{
								gray: false,
								transparent: true,
							}}
						/>
						<Button
							disabled={scrambleLocked}
							onClick={() => resetScramble(context)}
							transparent
							title="Reset scramble"
							icon={<ArrowClockwise weight="bold" />}
						/>
					</>
				)}
			</div>
		</div>
	);
}
