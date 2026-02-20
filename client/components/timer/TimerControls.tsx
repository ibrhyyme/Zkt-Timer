import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, CaretLeft, CaretRight, Lock, LockSimple, PencilSimple, Trash } from 'phosphor-react';
import Button from '../common/button/Button';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useSettings } from '../../util/hooks/useSettings';
import { useLatestSolve } from '../../util/hooks/useLatestSolve';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../db/solves/operations';
import { deleteSolveDb } from '../../db/solves/update';
import { setTimerParam, setTimerParams } from './helpers/params';
import { getNewScramble, resetScramble } from './helpers/scramble';
import { getCubeTypeInfoById } from '../../util/cubes/util';
import { smartCubeSelected } from './helpers/util';
import { setSetting } from '../../db/settings/update';
import block from '../../styles/bem';
import './TimerControls.scss';

const b = block('timer-controls');

// Max scramble history back steps
const MAX_HISTORY_BACK_STEPS = 2;

export default function TimerControls() {
    const { t } = useTranslation();
    const context = useContext(TimerContext);
    const mobileMode = useGeneral('mobile_mode');
    const lockedScramble = useSettings('locked_scramble');
    const latestSolve = useLatestSolve();

    const { scramble, scrambleLocked, editScramble, timeStartedAt, cubeType, focusMode, scrambleSubset, smartTurns } = context;
    const isSmart = smartCubeSelected(context);
    const isSmartScrambling = isSmart && smartTurns && smartTurns.length > 0 && !timeStartedAt;

    // Scramble history state
    const [scrambleHistory, setScrambleHistory] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const lastCubeTypeRef = useRef(cubeType);
    const lastScrambleSubsetRef = useRef(scrambleSubset);
    const isNavigatingRef = useRef(false);

    // Kategori veya alt dal değiştiğinde history'yi sıfırla
    useEffect(() => {
        if (lastCubeTypeRef.current !== cubeType || lastScrambleSubsetRef.current !== scrambleSubset) {
            setScrambleHistory([]);
            setCurrentIndex(-1);
            lastCubeTypeRef.current = cubeType;
            lastScrambleSubsetRef.current = scrambleSubset;
        }
    }, [cubeType, scrambleSubset]);

    // Scramble değiştiğinde (navigasyon dışında) history'ye ekle
    // Correction scramble'ları (smartTurnOffset > 0) history'ye ekleme
    const smartTurnOffset = context.smartTurnOffset || 0;
    useEffect(() => {
        if (scramble && !isNavigatingRef.current && smartTurnOffset === 0) {
            setScrambleHistory((prev) => {
                let newHistory = prev.slice(0, currentIndex + 1);
                newHistory.push(scramble);
                if (newHistory.length > MAX_HISTORY_BACK_STEPS + 1) {
                    newHistory = newHistory.slice(-MAX_HISTORY_BACK_STEPS - 1);
                }
                return newHistory;
            });
            setCurrentIndex((prev) => Math.min(prev + 1, MAX_HISTORY_BACK_STEPS));
        }
        isNavigatingRef.current = false;
    }, [scramble]);

    // +2 toggle
    function handlePlusTwo() {
        if (latestSolve) {
            togglePlusTwoSolveDb(latestSolve);
        }
    }

    // DNF toggle
    function handleDNF() {
        if (latestSolve) {
            toggleDnfSolveDb(latestSolve);
        }
    }

    // Delete last solve
    function handleDelete() {
        if (latestSolve) {
            deleteSolveDb(latestSolve);
        }
    }

    // Toggle scramble lock
    function toggleScrambleLock() {
        if (editScramble) {
            setTimerParam('editScramble', false);
        }
        setTimerParam('scrambleLocked', !scrambleLocked);

        const newLockedScramble = scrambleLocked ? null : scramble;
        setSetting('locked_scramble', newLockedScramble);
    }

    // Toggle edit scramble
    function toggleEditScramble() {
        setTimerParam('editScramble', !editScramble);
    }

    // Refresh scramble
    function handleRefresh() {
        if (!scrambleLocked) {
            resetScramble(context);
        }
    }

    // Previous scramble
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

    // Next scramble
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
            const newScramble = getNewScramble(ct.scramble, undefined, scrambleSubset);
            setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
        }
    }, [currentIndex, scrambleHistory, timeStartedAt, scrambleLocked, isSmartScrambling, cubeType, scrambleSubset]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('input, textarea')) return;
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

    // Focus modunda gizle
    if (focusMode) {
        return null;
    }

    // Navigation disable states
    const minHistoryIndex = Math.max(0, scrambleHistory.length - 1 - MAX_HISTORY_BACK_STEPS);
    const disableControls = !!timeStartedAt || !!context.inInspection; // Timer veya Inspection sırasında kontrolleri kilitle
    const canGoPrevious = currentIndex > minHistoryIndex && !scrambleLocked && !disableControls && !isSmartScrambling;
    const canGoNext = !scrambleLocked && !disableControls && !isSmartScrambling;

    return (
        <div className={b({ mobile: mobileMode })}>
            {/* Sol grup: Edit, +2, DNF, Delete, Lock, Refresh */}
            <div className={b('left')}>
                {!mobileMode && (
                    <Button
                        onClick={toggleEditScramble}
                        title={t('timer_modules.edit_scramble')}
                        white={editScramble}
                        transparent
                        disabled={scrambleLocked}
                        icon={<PencilSimple weight="bold" />}
                        text={t('timer_modules.edit')}
                    />
                )}
                {latestSolve && !context.inModal && (
                    <>
                        <Button
                            onClick={handlePlusTwo}
                            title={t('timer_modules.plus_two_penalty')}
                            transparent
                            warning={latestSolve.plus_two}
                            text="+2"
                        />
                        <Button
                            onClick={handleDNF}
                            title="DNF"
                            transparent
                            danger={latestSolve.dnf}
                            text="DNF"
                        />
                        {!mobileMode && (
                            <Button
                                onClick={handleDelete}
                                title={t('timer_modules.delete_last_solve')}
                                transparent
                                icon={<Trash weight="bold" />}
                            />
                        )}
                    </>
                )}
                <Button
                    onClick={toggleScrambleLock}
                    title={t('timer_modules.lock_scramble')}
                    transparent={!scrambleLocked}
                    warning={scrambleLocked}
                    icon={scrambleLocked ? <LockSimple weight="fill" /> : <Lock weight="bold" />}
                />
                {!mobileMode && (
                    <Button
                        onClick={handleRefresh}
                        title={t('timer_modules.new_scramble')}
                        transparent
                        disabled={scrambleLocked || disableControls}
                        icon={<ArrowClockwise weight="bold" />}
                    />
                )}
            </div>

            {/* Sağ grup: Önceki / Sonraki */}
            <div className={b('right')}>
                <Button
                    onClick={handlePreviousScramble}
                    disabled={!canGoPrevious}
                    title={t('timer_modules.previous_scramble')}
                    transparent
                    icon={<CaretLeft weight="bold" />}
                    text={!mobileMode ? t('common.previous') : undefined}
                />
                <Button
                    onClick={handleNextScramble}
                    disabled={!canGoNext}
                    title={t('timer_modules.next_scramble')}
                    transparent
                    icon={<CaretRight weight="bold" />}
                    text={!mobileMode ? t('common.next') : undefined}
                />
            </div>
        </div>
    );
}
