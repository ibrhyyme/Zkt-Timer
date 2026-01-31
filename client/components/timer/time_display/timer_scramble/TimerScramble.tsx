import React, { ReactNode, useContext, useEffect, useRef } from 'react';
import './TimerScramble.scss';
import { ArrowClockwise, Lock, PencilSimple } from 'phosphor-react';
import TextareaAutosize from 'react-textarea-autosize';
import CopyText from '../../../common/copy_text/CopyText';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../../../db/settings/update';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import Button from '../../../common/button/Button';
import { TimerContext } from '../../Timer';
import block from '../../../../styles/bem';
import { resetScramble } from '../../helpers/scramble';
import SmartScramble from './smart_scramble/SmartScramble';
import { setTimerParam } from '../../helpers/params';
import { smartCubeSelected } from '../../helpers/util';
import { useSettings } from '../../../../util/hooks/useSettings';
import { setSetting } from '../../../../db/settings/update';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../../../db/solves/operations';
import { useLatestSolve } from '../../../../util/hooks/useLatestSolve';

const b = block('timer-scramble');

export default function TimerScramble() {
	const context = useContext(TimerContext);

	const scrambleInput = useRef(null);
	const mobileMode = useGeneral('mobile_mode');
	const sessionId = useSettings('session_id');
	const cubeType = context.cubeType;
	const isMegaminx = cubeType === 'minx' || cubeType === 'megaminx';
	let timerScrambleSize = useSettings('timer_scramble_size');

	const focusMode = context.focusMode;
	if (mobileMode) {
		timerScrambleSize *= MOBILE_FONT_SIZE_MULTIPLIER;
	}

	const { editScramble, scrambleLocked, notification, hideScramble, timeStartedAt } = context;
	let scramble = context.scramble;
	const lockedScramble = useSettings('locked_scramble');

	// Son solve için +2 ve DNF
	const latestSolve = useLatestSolve();

	useEffect(() => {
		if (lockedScramble && !timeStartedAt) {
			setTimerParam('scramble', lockedScramble);
			setTimerParam('scrambleLocked', true);
		} else {
			resetScramble(context);
		}
	}, [cubeType, sessionId]);

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
		setTimerParam('scramble', e.target.value);
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

	const isSmart = smartCubeSelected(context);

	if (hideScramble) {
		scramble = '';
	} else if (isMegaminx && scramble) {
		// Megaminx formatting: Force newlines after each line (usually ending in U or U')
		// Standard WCA scramble format usually has 7 lines
		if (!scramble.includes('\n')) {
			scramble = scramble.replace(/ (U'?)( |$)/g, ' $1\n').trim();
		}
	}

	let scrambleBody: ReactNode = (
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

	// Is smart cube
	if (isSmart && !timeStartedAt && scramble) {
		scrambleBody = <SmartScramble />;
	} else if (isSmart && timeStartedAt) {
		// Timer çalışırken scramble'ı gizle
		scrambleBody = null;
	}

	// +2 ve DNF butonları artık üstteki actions alanında, aşağıda duplike yok

	return (
		<div className={b()}>
			{notification}
			<div
				className={b('body', {
					smart: isSmart,
					megaminx: isMegaminx,
				})}
				style={{
					fontSize: timerScrambleSize + 'px',
					lineHeight: timerScrambleSize * 1.6 + 'px',
				}}
			>
				{scrambleBody}
			</div>
			<div className={b('actions', { focused: focusMode })}>
				<Button
					onClick={toggleEditScramble}
					title="Edit scramble"
					white={!isSmart && editScramble}
					transparent
					disabled={isSmart || scrambleLocked}
					icon={<PencilSimple weight="bold" />}
				/>
				{latestSolve && (
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
				<Button
					transparent
					onClick={toggleScrambleLock}
					title="Lock scramble"
					white={scrambleLocked}
					icon={<Lock weight="bold" />}
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
			</div>
		</div>
	);
}
