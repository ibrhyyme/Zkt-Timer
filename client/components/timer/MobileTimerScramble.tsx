import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {useTranslation} from 'react-i18next';
import { Check, Copy, FloppyDisk, PencilSimple, X } from 'phosphor-react';
import { copyText } from '../common/copy_text/CopyText';
import { TimerContext } from './Timer';
import { useSettings } from '../../util/hooks/useSettings';
import { smartCubeSelected } from './helpers/util';
import SmartScramble from './time_display/timer_scramble/smart_scramble/SmartScramble';
import block from '../../styles/bem';
import './MobileTimerScramble.scss';
import { resetScramble } from './helpers/scramble';
import { setTimerParam, setTimerParams } from './helpers/params';
import { hapticImpact } from '../../util/native-plugins';

const b = block('mobile-timer-scramble');

/**
 * Simplified scramble component for mobile.
 * Shows text only, copies on click.
 * All buttons (Edit, +2, DNF, Lock, Refresh) moved to TimerControls.
 */
export default function MobileTimerScramble() {
    const {t} = useTranslation();
    const context = useContext(TimerContext);
    const cubeType = context.cubeType;
    const scrambleSubset = context.scrambleSubset;
    const isMegaminx = cubeType === 'minx';
    const [copied, setCopied] = useState(false);
    const [adjustedFontSize, setAdjustedFontSize] = useState<number | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [expandedCopied, setExpandedCopied] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editValue, setEditValue] = useState('');
    const editTextareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // Long-press state: tap (short) opens modal, long press copies
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressFired = useRef(false);
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);

    const timerScrambleSize = useSettings('timer_scramble_size');

    const { hideScramble, timeStartedAt, scrambleLocked } = context;
    let scramble = context.scramble;
    const lockedScramble = useSettings('locked_scramble');

    const isSmart = smartCubeSelected(context);

    // Generate scramble when cube type or subset changes
    useEffect(() => {
        if (lockedScramble && !timeStartedAt) {
            setTimerParam('scramble', lockedScramble);
            setTimerParam('scrambleLocked', true);
        } else {
            resetScramble(context);
        }
    }, [cubeType, scrambleSubset]);

    // Auto-shrink font size if scramble doesn't fit container (binary search)
    const runFit = useCallback(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) {
            setAdjustedFontSize(null);
            return;
        }

        // First check at full size
        setAdjustedFontSize(null);

        requestAnimationFrame(() => {
            if (!containerRef.current || !textRef.current) return;

            const setFontOnElement = (size: number) => {
                text.style.fontSize = size + 'px';
                text.style.lineHeight = size * 1.4 + 'px';
            };

            // Does full size fit?
            setFontOnElement(timerScrambleSize);
            const containerH = container.clientHeight;

            if (text.scrollHeight <= containerH) {
                setAdjustedFontSize(null);
                return;
            }

            // Binary search: find largest font that fits
            let lo = 8;
            let hi = timerScrambleSize;

            while (hi - lo > 1) {
                const mid = Math.floor((lo + hi) / 2);
                setFontOnElement(mid);

                if (text.scrollHeight <= containerH) {
                    lo = mid;
                } else {
                    hi = mid;
                }
            }

            setAdjustedFontSize(lo);
        });
    }, [timerScrambleSize]);

    // Re-fit on scramble/cubeType/font setting change
    useEffect(() => {
        runFit();
    }, [scramble, cubeType, timerScrambleSize, isSmart, runFit]);

    // Re-fit if container height changes (SmartCube async loads, keyboard opens, etc)
    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;

        const ro = new ResizeObserver(() => {
            runFit();
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, [runFit]);

    if (hideScramble) {
        scramble = '';
    } else if (isMegaminx && scramble) {
        // Only break lines in Pochmann notation scrambles (WCA/Carrot/OldStyle — contains "++").
        // 2-gen R,U / Random-state / S2L subsets don't have "++", so this split is skipped.
        if (!scramble.includes('\n') && scramble.includes('++')) {
            scramble = scramble.replace(/ (U'?)( |$)/g, ' $1\n').trim();
        }
    }

    // SQ1: "/" stays on same line, new line starts with "("
    if (cubeType === 'sq1' && scramble) {
        scramble = scramble.replace(/ \/ /g, ' / ');
    }

    // Copy scramble (long press)
    function handleCopy(showInExpanded = false) {
        if (!scramble) return;
        copyText(scramble);
        hapticImpact('medium');
        if (showInExpanded) {
            setExpandedCopied(true);
            setTimeout(() => setExpandedCopied(false), 1500);
        } else {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    }

    // Open fullscreen modal (short tap)
    function openExpanded() {
        if (!scramble) return;
        setExpanded(true);
    }

    function closeExpanded() {
        setExpanded(false);
        setEditMode(false);
    }

    function enterEditMode() {
        setEditValue(context.scramble || '');
        setEditMode(true);
        hapticImpact('light');
        setTimeout(() => {
            editTextareaRef.current?.focus();
        }, 50);
    }

    function saveEdit() {
        const trimmed = editValue.trim();
        if (!trimmed) {
            setEditMode(false);
            return;
        }
        setTimerParams({ scramble: trimmed, originalScramble: trimmed, smartTurnOffset: 0 });
        setEditMode(false);
        hapticImpact('medium');
    }

    // Tap/long-press detection (mobile)
    function handleTouchStart(e: React.TouchEvent) {
        if (!scramble) return;
        longPressFired.current = false;
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        longPressTimer.current = setTimeout(() => {
            longPressFired.current = true;
            handleCopy(false);
        }, 500);
    }

    function handleTouchMove(e: React.TouchEvent) {
        if (!touchStartPos.current) return;
        const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
        if ((dx > 10 || dy > 10) && longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }

    function handleTouchEnd() {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        if (!longPressFired.current && touchStartPos.current) {
            openExpanded();
        }
        touchStartPos.current = null;
    }

    function handleTouchCancel() {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        touchStartPos.current = null;
    }

    // Desktop: open modal via onClick
    function handleClick(e: React.MouseEvent) {
        // Touch events already handled, let this run on desktop
        if ('ontouchstart' in window) return;
        e.stopPropagation();
        openExpanded();
    }

    const fontSize = adjustedFontSize || timerScrambleSize;

    // If smart cube, show SmartScramble
    if (isSmart && scramble) {
        return (
            <div className={b()} ref={containerRef}>
                <div
                    className={b('smart-scramble')}
                    ref={textRef}
                    style={{
                        fontSize: fontSize + 'px',
                        lineHeight: fontSize * 1.4 + 'px',
                    }}
                >
                    <SmartScramble />
                </div>
            </div>
        );
    }

    // After abort, hide when scramble is empty (don't overlap mismatch banner)
    if (isSmart && !scramble) {
        return null;
    }

    const expandedOverlay = expanded && scramble && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            <div className={b('expanded')} onClick={() => { if (!editMode) closeExpanded(); }}>
                <button
                    className={b('expanded-close')}
                    onClick={(e) => { e.stopPropagation(); closeExpanded(); }}
                    aria-label={t('mobile_scramble.close')}
                    type="button"
                >
                    <X size={24} weight="bold" />
                </button>
                {editMode ? (
                    <textarea
                        ref={editTextareaRef}
                        className={b('expanded-edit', { megaminx: isMegaminx })}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div
                        className={b('expanded-text', { megaminx: isMegaminx })}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {scramble}
                    </div>
                )}
                <div className={b('expanded-actions')} onClick={(e) => e.stopPropagation()}>
                    {!editMode && (
                        <button
                            className={b('expanded-copy', { copied: expandedCopied })}
                            onClick={(e) => { e.stopPropagation(); handleCopy(true); }}
                            type="button"
                        >
                            {expandedCopied ? <Check size={20} weight="bold" /> : <Copy size={20} weight="bold" />}
                            <span>{expandedCopied ? t('mobile_scramble.copied') : t('mobile_scramble.copy')}</span>
                        </button>
                    )}
                    {editMode ? (
                        <button
                            className={b('expanded-save')}
                            onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                            type="button"
                        >
                            <FloppyDisk size={20} weight="bold" />
                            <span>{t('mobile_scramble.save')}</span>
                        </button>
                    ) : (
                        <button
                            className={b('expanded-edit-btn')}
                            onClick={(e) => { e.stopPropagation(); enterEditMode(); }}
                            type="button"
                        >
                            <PencilSimple size={20} weight="bold" />
                            <span>{t('mobile_scramble.edit')}</span>
                        </button>
                    )}
                </div>
            </div>,
            document.body,
        )
        : null;

    return (
        <div className={b()} ref={containerRef}>
            <div
                className={b('text', { megaminx: isMegaminx, copied })}
                ref={textRef}
                style={{
                    fontSize: fontSize + 'px',
                    lineHeight: fontSize * 1.4 + 'px',
                }}
                onClick={handleClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                title={t('mobile_scramble.tap_hint')}
            >
                {scramble || t('mobile_scramble.loading_scramble')}
                {copied && <Check className={b('copied-icon')} weight="bold" />}
            </div>
            {expandedOverlay}
        </div>
    );
}
