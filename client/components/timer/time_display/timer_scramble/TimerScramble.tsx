import React, { ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import './TimerScramble.scss';
import { ArrowClockwise, CaretLeft, CaretRight, Lock, LockSimple, PencilSimple } from 'phosphor-react';
import TextareaAutosize from 'react-textarea-autosize';
import CopyText from '../../../common/copy_text/CopyText';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../../../db/settings/update';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import Button from '../../../common/button/Button';
import { TimerContext } from '../../Timer';
import block from '../../../../styles/bem';
import { getNewScramble, resetScramble } from '../../helpers/scramble';
import SmartScramble from './smart_scramble/SmartScramble';
import { setTimerParam, setTimerParams } from '../../helpers/params';
import { smartCubeSelected } from '../../helpers/util';
import { useSettings } from '../../../../util/hooks/useSettings';
import { setSetting } from '../../../../db/settings/update';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../../../db/solves/operations';
import { useLatestSolve } from '../../../../util/hooks/useLatestSolve';
import { getCubeTypeInfoById } from '../../../../util/cubes/util';

const b = block('timer-scramble');

// Scramble history için max geri adım sayısı
const MAX_HISTORY_BACK_STEPS = 2;

export default function TimerScramble() {
	const context = useContext(TimerContext);

	const scrambleInput = useRef(null);
	const mobileMode = useGeneral('mobile_mode');
	const sessionId = useSettings('session_id');
	const cubeType = context.cubeType;
	const scrambleSubset = context.scrambleSubset;
	const isMegaminx = cubeType === 'minx' || cubeType === 'megaminx';
	let timerScrambleSize = useSettings('timer_scramble_size');

	const focusMode = context.focusMode;
	if (mobileMode) {
		timerScrambleSize *= MOBILE_FONT_SIZE_MULTIPLIER;
	}

	const { editScramble, scrambleLocked, notification, hideScramble, timeStartedAt, matchMode } = context;
	let scramble = context.scramble;
	const lockedScramble = useSettings('locked_scramble');
	const isSmart = smartCubeSelected(context);
	const isSmartScrambling = isSmart && context.smartTurns && context.smartTurns.length > 0 && !timeStartedAt;

	// Son solve için +2 ve DNF
	const latestSolve = useLatestSolve();

	// Scramble history state
	const [scrambleHistory, setScrambleHistory] = useState<string[]>([]);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const lastCubeTypeRef = useRef(cubeType);
	const lastScrambleSubsetRef = useRef(scrambleSubset);
	const isNavigatingRef = useRef(false);

	// Kategori değiştiğinde history'yi sıfırla
	useEffect(() => {
		if (lastCubeTypeRef.current !== cubeType || lastScrambleSubsetRef.current !== scrambleSubset) {
			setScrambleHistory([]);
			setCurrentIndex(-1);
			lastCubeTypeRef.current = cubeType;
			lastScrambleSubsetRef.current = scrambleSubset;
		}
	}, [cubeType, scrambleSubset]);

	// Scramble değiştiğinde (navigasyon dışında) history'ye ekle
	// Correction scramble'ları (smartTurnOffset > 0) history'ye ekleme - gereksiz state güncellemesi yapar
	const smartTurnOffset = context.smartTurnOffset || 0;
	useEffect(() => {
		if (scramble && !isNavigatingRef.current && smartTurnOffset === 0) {
			setScrambleHistory((prev) => {
				// Eğer currentIndex ortadaysa, ondan sonrasını sil ve yeni ekle
				let newHistory = prev.slice(0, currentIndex + 1);
				newHistory.push(scramble);
				// Sadece son 3 scramble'ı tut (mevcut + max 2 geri)
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
	}, [cubeType, sessionId, scrambleSubset]);

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

	// Önceki scramble'a git (max 2 adım geri)
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

	// Sonraki scramble'a git veya yeni üret
	const handleNextScramble = useCallback(() => {
		if (timeStartedAt || scrambleLocked || isSmartScrambling) return;

		// Eğer geçmişte bir yerdeyse, ileri git
		if (currentIndex < scrambleHistory.length - 1) {
			isNavigatingRef.current = true;
			const newIndex = currentIndex + 1;
			setCurrentIndex(newIndex);
			const nextScramble = scrambleHistory[newIndex];
			setTimerParams({ scramble: nextScramble, originalScramble: nextScramble, smartTurnOffset: 0 });
		} else {
			// En sondaysa, yeni scramble üret
			const ct = getCubeTypeInfoById(cubeType);
			const newScramble = getNewScramble(ct.scramble, undefined, scrambleSubset);
			setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
		}
	}, [currentIndex, scrambleHistory, timeStartedAt, scrambleLocked, isSmartScrambling, cubeType, scrambleSubset]);

	// Klavye kısayolları (Sol/Sağ ok tuşları)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Input/Textarea odaklıysa çalışma
			const target = e.target as HTMLElement;
			if (target.closest('input, textarea')) return;
			// Timer çalışırken çalışma
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

	// Navigasyon butonları için disable durumları
	const minHistoryIndex = Math.max(0, scrambleHistory.length - 1 - MAX_HISTORY_BACK_STEPS);
	const canGoPrevious = currentIndex > minHistoryIndex && !scrambleLocked && !timeStartedAt && !isSmartScrambling;
	const canGoNext = !scrambleLocked && !timeStartedAt && !isSmartScrambling;

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
			{/* Scramble navigasyon butonları - timer çalışmıyorken ve maç modunda değilken göster */}
			{scrambleLocked && !timeStartedAt && !focusMode && !matchMode && (
				<div className={b('locked-banner')}>
					🔒 Karıştırma kilitli
				</div>
			)}
			{!timeStartedAt && !focusMode && !matchMode && !isSmartScrambling && (
				<div className={b('nav')}>
					<button
						className={b('nav-btn', { disabled: !canGoPrevious })}
						onClick={handlePreviousScramble}
						disabled={!canGoPrevious}
						title="Önceki scramble (← Sol Ok)"
					>
						<CaretLeft weight="bold" />
						<span>Önceki</span>
					</button>
					<button
						className={b('nav-btn')}
						onClick={handleNextScramble}
						disabled={!canGoNext}
						title="Sonraki scramble (→ Sağ Ok)"
					>
						<span>Sonraki</span>
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
				}}
			>
				{scrambleBody}
			</div>
			<div className={b('actions', { focused: focusMode })}>
				{/* Maç modunda sadece +2 ve DNF göster */}
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
