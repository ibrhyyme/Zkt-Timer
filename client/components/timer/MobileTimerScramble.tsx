import React, { useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {useTranslation} from 'react-i18next';
import { Check, Copy, X } from 'phosphor-react';
import { copyText } from '../common/copy_text/CopyText';
import { TimerContext } from './Timer';
import { useSettings } from '../../util/hooks/useSettings';
import { smartCubeSelected } from './helpers/util';
import SmartScramble from './time_display/timer_scramble/smart_scramble/SmartScramble';
import block from '../../styles/bem';
import './MobileTimerScramble.scss';
import { resetScramble } from './helpers/scramble';
import { setTimerParam } from './helpers/params';
import { hapticImpact } from '../../util/native-plugins';

const b = block('mobile-timer-scramble');

/**
 * Mobil için basitleştirilmiş scramble componentı.
 * Sadece metin gösterir, tıklandığında kopyalar.
 * Tüm butonlar (Edit, +2, DNF, Lock, Refresh) TimerControls'a taşındı.
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
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // Long-press state: tap (kisa) modal acar, uzun basma kopyalar
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressFired = useRef(false);
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);

    const timerScrambleSize = useSettings('timer_scramble_size');

    const { hideScramble, timeStartedAt, focusMode, scrambleLocked } = context;
    let scramble = context.scramble;
    const lockedScramble = useSettings('locked_scramble');

    const isSmart = smartCubeSelected(context);

    // Küp türü veya subset değiştiğinde scramble generate et
    useEffect(() => {
        if (lockedScramble && !timeStartedAt) {
            setTimerParam('scramble', lockedScramble);
            setTimerParam('scrambleLocked', true);
        } else {
            resetScramble(context);
        }
    }, [cubeType, scrambleSubset]);

    // Karistirma alana sigmiyorsa font boyutunu otomatik kucult (binary search)
    useEffect(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) {
            setAdjustedFontSize(null);
            return;
        }

        // Once tam boyutta kontrol et
        setAdjustedFontSize(null);

        requestAnimationFrame(() => {
            if (!containerRef.current || !textRef.current) return;

            const setFontOnElement = (size: number) => {
                text.style.fontSize = size + 'px';
                text.style.lineHeight = size * 1.4 + 'px';
            };

            // Tam boyutta sigiyor mu?
            setFontOnElement(timerScrambleSize);
            const containerH = container.clientHeight;

            if (text.scrollHeight <= containerH) {
                setAdjustedFontSize(null);
                return;
            }

            // Binary search: sigacak en buyuk fontu bul
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
    }, [scramble, cubeType, timerScrambleSize]);

    // Focus modunda gizle
    if (focusMode) {
        return null;
    }

    if (hideScramble) {
        scramble = '';
    } else if (isMegaminx && scramble) {
        // Sadece Pochmann notasyonlu scramble'larda (WCA/Carrot/OldStyle — "++" iceriyor) satir kir.
        // 2-gen R,U / Random-state / S2L subset'lerinde "++" olmadigi icin bu split atlanir.
        if (!scramble.includes('\n') && scramble.includes('++')) {
            scramble = scramble.replace(/ (U'?)( |$)/g, ' $1\n').trim();
        }
    }

    // SQ1: "/" satirda kalsin, yeni satir "(" ile baslasin
    if (cubeType === 'sq1' && scramble) {
        scramble = scramble.replace(/ \/ /g, '\u00A0/ ');
    }

    // Scramble'ı kopyala (uzun basma)
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

    // Fullscreen modal ac (kisa tap)
    function openExpanded() {
        if (!scramble) return;
        setExpanded(true);
    }

    function closeExpanded() {
        setExpanded(false);
    }

    // Tap/long-press detection (mobil)
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

    // Desktop: onClick ile modal ac
    function handleClick(e: React.MouseEvent) {
        // Touch olaylari zaten handle ediyor, desktop'ta calissin
        if ('ontouchstart' in window) return;
        e.stopPropagation();
        openExpanded();
    }

    const fontSize = adjustedFontSize || timerScrambleSize;

    // Smart cube ise SmartScramble göster
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

    // Abort sonrası scramble boşken gizle (mismatch banner ile çakışmasın)
    if (isSmart && !scramble) {
        return null;
    }

    const expandedOverlay = expanded && scramble && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            <div className={b('expanded')} onClick={closeExpanded}>
                <button
                    className={b('expanded-close')}
                    onClick={(e) => { e.stopPropagation(); closeExpanded(); }}
                    aria-label={t('mobile_scramble.close')}
                    type="button"
                >
                    <X size={24} weight="bold" />
                </button>
                <div
                    className={b('expanded-text', { megaminx: isMegaminx })}
                    onClick={(e) => e.stopPropagation()}
                >
                    {scramble}
                </div>
                <button
                    className={b('expanded-copy', { copied: expandedCopied })}
                    onClick={(e) => { e.stopPropagation(); handleCopy(true); }}
                    type="button"
                >
                    {expandedCopied ? <Check size={20} weight="bold" /> : <Copy size={20} weight="bold" />}
                    <span>{expandedCopied ? t('mobile_scramble.copied') : t('mobile_scramble.copy')}</span>
                </button>
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
