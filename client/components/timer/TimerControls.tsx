import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, CaretLeft, CaretRight, Lock, LockSimple, PencilSimple, Trash } from 'phosphor-react';
import Button from '../common/button/Button';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useSettings } from '../../util/hooks/useSettings';
import { useLatestSolve } from '../../util/hooks/useLatestSolve';
import { useHasSmartTurns } from '../../util/hooks/useTimerStore';
import { useSmartCubeStore } from '../../util/hooks/useSmartCubeStore';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../db/solves/operations';
import { deleteSolveDb } from '../../db/solves/update';
import { setTimerParam } from './helpers/params';
import { resetScramble } from './helpers/scramble';
import { useScrambleHistory } from './helpers/scramble_navigation';
import { smartCubeSelected } from './helpers/util';
import { setSetting } from '../../db/settings/update';
import block from '../../styles/bem';
import { hapticNotification } from '../../util/native-plugins';
import './TimerControls.scss';

const b = block('timer-controls');

export default function TimerControls() {
    const { t } = useTranslation();
    const context = useContext(TimerContext);
    const mobileMode = useGeneral('mobile_mode');
    const lockedScramble = useSettings('locked_scramble');
    const latestSolve = useLatestSolve();

    const { scramble, scrambleLocked, editScramble, timeStartedAt } = context;
    // Connection state lives in its own slice now (reducers/smart_cube.ts), so it is not
    // part of the timer context.
    const smartCubeConnected = useSmartCubeStore('smartCubeConnected');
    const isSmart = smartCubeSelected(context);
    // The turn list is not in TimerContext (see FAST_TIMER_FIELDS); only whether it is
    // empty matters here, and that does not change on every move.
    const hasSmartTurns = useHasSmartTurns();
    // Locking scramble navigation only makes sense once moves have actually been
    // applied to a connected cube — changing the scramble then would leave the
    // physical cube and the screen describing different states. With no cube on
    // the other end there is nothing to contradict, and a stale turn list left
    // over from an earlier connection must not keep the buttons dead.
    const isSmartScrambling = isSmart && !!smartCubeConnected && hasSmartTurns && !timeStartedAt;

    // Previous / Next history lives in the timer store, shared with the desktop layout, so
    // a tablet rotating across 1024px keeps it.
    const {
        goPrevious: handlePreviousScramble,
        goNext: handleNextScramble,
        canGoPrevious: historyCanGoPrevious,
    } = useScrambleHistory(context, !!timeStartedAt || scrambleLocked || isSmartScrambling);

    // +2 toggle
    function handlePlusTwo() {
        if (latestSolve) {
            hapticNotification('warning');
            togglePlusTwoSolveDb(latestSolve);
        }
    }

    // DNF toggle
    function handleDNF() {
        if (latestSolve) {
            hapticNotification('error');
            toggleDnfSolveDb(latestSolve);
        }
    }

    // Delete last solve
    function handleDelete() {
        if (latestSolve) {
            hapticNotification('error');
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

    // Navigation disable states
    const disableControls = !!timeStartedAt || !!context.inInspection; // Timer veya Inspection sırasında kontrolleri kilitle
    const canGoPrevious = historyCanGoPrevious && !disableControls;
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
