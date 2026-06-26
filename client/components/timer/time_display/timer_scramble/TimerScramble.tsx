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
import { getNewScrambleAsync, resetScramble } from '../../helpers/scramble';
import SmartScramble from './smart_scramble/SmartScramble';
import { setTimerParam, setTimerParams } from '../../helpers/params';
import { smartCubeSelected } from '../../helpers/util';
import { useSettings } from '../../../../util/hooks/useSettings';
import { setSetting } from '../../../../db/settings/update';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../../../db/solves/operations';
import { useLatestSolve } from '../../../../util/hooks/useLatestSolve';
import { getCubeTypeInfoById } from '../../../../util/cubes/util';

const b = block('timer-scramble');

// Max number of back steps for scramble history
const MAX_HISTORY_BACK_STEPS = 2;

export default function TimerScramble() {
	const {t} = useTranslation();
	const context = useContext(TimerContext);

	const scrambleInput = useRef(null);
	const mobileMode = useGeneral('mobile_mode');
	const cubeType = context.cubeType;
	const scrambleSubset = context.scrambleSubset;
	const isMegaminx = cubeType === 'minx';
	let timerScrambleSize = useSettings('timer_scramble_size');

	if (mobileMode) {
		timerScrambleSize *= MOBILE_FONT_SIZE_MULTIPLIER;
	}

	const { editScramble, scrambleLocked, notification, hideScramble, timeStartedAt, matchMode } = context;
	let scramble = context.scramble;
	const lockedScramble = useSettings('locked_scramble');
	const scrambleMonospace = useSettings('scramble_monospace');
	const scrambleAlignment = useSettings('scramble_alignment');
	const scrambleClickAction = useSettings('scramble_click_action');
	const isSmart = smartCubeSelected(context);
	const isSmartScrambling = isSmart && context.smartTurns && context.smartTurns.length > 0 && !timeStartedAt;

	// +2 and DNF for latest solve
	const latestSolve = useLatestSolve();

	// Scramble history state
	const [scrambleHistory, setScrambleHistory] = useState<string[]>([]);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const lastCubeTypeRef = useRef(cubeType);
	const lastScrambleSubsetRef = useRef(scrambleSubset);
	const isNavigatingRef = useRef(false);

	// Reset history when category changes
	useEffect(() => {
		if (lastCubeTypeRef.current !== cubeType || lastScrambleSubsetRef.current !== scrambleSubset) {
			setScrambleHistory([]);
			setCurrentIndex(-1);
			lastCubeTypeRef.current = cubeType;
			lastScrambleSubsetRef.current = scrambleSubset;
		}
	}, [cubeType, scrambleSubset]);

	// When scramble changes (outside navigation) add to history
	// Don't add correction scrambles (smartTurnOffset > 0) to history - causes unnecessary state updates
	const smartTurnOffset = context.smartTurnOffset || 0;
	useEffect(() => {
		if (scramble && !isNavigatingRef.current && smartTurnOffset === 0) {
			setScrambleHistory((prev) => {
				// If currentIndex is in the middle, delete everything after it and add new
				let newHistory = prev.slice(0, currentIndex + 1);
				newHistory.push(scramble);
				// Keep only last 3 scrambles (current + max 2 back)
				if (newHistory.length > MAX_HISTORY_BACK_STEPS + 1) {
					newHistory = newHistory.slice(-MAX_HISTORY_BACK_STEPS - 1);
				}
				return newHistory;
			});
			setCurrentIndex((prev) => Math.min(prev + 1, MAX_HISTORY_BACK_STEPS));
		}
		isNavigatingRef.current = false;
	}, [scramble]);

	useEffect(() => {
		if (lockedScramble && !timeStartedAt) {
			setTimerParam('scramble', lockedScramble);
			setTimerParam('scrambleLocked', true);
		} else {
			resetScramble(context);
		}
	}, [cubeType, scrambleSubset]);

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

	// Go to previous scramble (max 2 steps back)
	const handlePreviousScramble = useCallback(() => {
		if (timeStartedAt || scrambleLocked || isSmartScrambling) return;

		if (currentIndex > 0) {
			isNavigatingRef.current = true;
			const newIndex = currentIndex - 1;
			setCurrentIndex(newIndex);
			const previousScramble = scrambleHistory[newIndex];
			setTimerParams({ scramble: previousScramble, originalScramble: previousScramble, smartTurnOffset: 0 });
		}
	}, [currentIndex, scrambleHistory, timeStartedAt, scrambleLocked, isSmartScrambling]);

	// Go to next scramble or generate new one
	const nextScrambleRef = useRef(0);
	const handleNextScramble = useCallback(() => {
		if (timeStartedAt || scrambleLocked || isSmartScrambling) return;

		if (currentIndex < scrambleHistory.length - 1) {
			isNavigatingRef.current = true;
			const newIndex = currentIndex + 1;
			setCurrentIndex(newIndex);
			const nextScramble = scrambleHistory[newIndex];
			setTimerParams({ scramble: nextScramble, originalScramble: nextScramble, smartTurnOffset: 0 });
		} else {
			const ct = getCubeTypeInfoById(cubeType);
			if (!ct) return;
			const callId = ++nextScrambleRef.current;
			setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
			getNewScrambleAsync(ct.scramble, scrambleSubset).then((newScramble) => {
				if (callId === nextScrambleRef.current && newScramble) {
					setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
				}
			}).catch((e) => { console.error('[scramble] next failed:', e); });
		}
	}, [currentIndex, scrambleHistory, timeStartedAt, scrambleLocked, isSmartScrambling, cubeType, scrambleSubset]);

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

	// Keyboard shortcuts (Left/Right arrow keys)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't work if input/textarea is focused
			const target = e.target as HTMLElement;
			if (target.closest('input, textarea')) return;
			// Don't work while timer is running
			if (timeStartedAt) return;

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				handlePreviousScramble();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				handleNextScramble();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handlePreviousScramble, handleNextScramble, timeStartedAt]);

	// Navigation button disabled states
	const minHistoryIndex = Math.max(0, scrambleHistory.length - 1 - MAX_HISTORY_BACK_STEPS);
	const canGoPrevious = currentIndex > minHistoryIndex && !scrambleLocked && !timeStartedAt && !isSmartScrambling;
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
				onChange={handleScrambleChange}
				value={scramble}
				disabled={!editScramble}
				minRows={1}
				placeholder={hideScramble ? '' : 'scramble'}
				ref={scrambleInput}
				className={b({ edit: editScramble })}
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
			{/* Scramble navigation buttons - show when timer not running and not in match mode */}
			{scrambleLocked && !timeStartedAt && !matchMode && (
				<div className={b('locked-banner')}>
					{t('timer_scramble.scramble_locked')}
				</div>
			)}
			{!timeStartedAt && !matchMode && !isSmartScrambling && (
				<div className={b('nav')}>
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
				className={b('body', {
					smart: isSmart,
					megaminx: isMegaminx,
				})}
				style={{
					fontSize: timerScrambleSize + 'px',
					lineHeight: timerScrambleSize * 1.6 + 'px',
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
