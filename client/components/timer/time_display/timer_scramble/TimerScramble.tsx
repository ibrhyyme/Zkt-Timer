import React, { ReactNode, useContext, useRef } from 'react';
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

const b = block('timer-scramble');

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
				// Keyed by the scramble so a genuine replacement (new solve, prev/next
				// nav) remounts this element and plays the CSS fade-in on insertion.
				// While editing the key is pinned to a constant instead of the live
				// value — the textarea updates `scramble` on every keystroke, and
				// keying by that would remount (and drop focus/cursor from) the
				// textarea on every character typed.
				key={editScramble ? 'edit' : scramble}
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
