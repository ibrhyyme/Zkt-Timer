import React, { useContext, useEffect, useState } from 'react';
import {useTranslation} from 'react-i18next';
import { Check } from 'phosphor-react';
import { copyText } from '../common/copy_text/CopyText';
import { TimerContext } from './Timer';
import { useSettings } from '../../util/hooks/useSettings';
import { smartCubeSelected } from './helpers/util';
import SmartScramble from './time_display/timer_scramble/smart_scramble/SmartScramble';
import block from '../../styles/bem';
import './MobileTimerScramble.scss';
import { resetScramble } from './helpers/scramble';
import { setTimerParam } from './helpers/params';

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
    const isMegaminx = cubeType === 'minx' || cubeType === 'megaminx';
    const [copied, setCopied] = useState(false);

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

    // Focus modunda gizle
    if (focusMode) {
        return null;
    }

    if (hideScramble) {
        scramble = '';
    } else if (isMegaminx && scramble) {
        // Megaminx formatting
        if (!scramble.includes('\n')) {
            scramble = scramble.replace(/ (U'?)( |$)/g, ' $1\n').trim();
        }
    }

    // SQ1: "/" satirda kalsin, yeni satir "(" ile baslasin
    if (cubeType === 'sq1' && scramble) {
        scramble = scramble.replace(/ \/ /g, '\u00A0/ ');
    }

    // Scramble'ı kopyala
    function handleCopy() {
        if (!scramble) return;
        copyText(scramble);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    // Smart cube ise SmartScramble göster
    if (isSmart && scramble) {
        return (
            <div className={b()}>
                <div
                    className={b('smart-scramble')}
                    style={{
                        fontSize: timerScrambleSize + 'px',
                        lineHeight: timerScrambleSize * 1.4 + 'px',
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

    return (
        <div className={b()}>
            <div
                className={b('text', { megaminx: isMegaminx, copied })}
                style={{
                    fontSize: timerScrambleSize + 'px',
                    lineHeight: timerScrambleSize * 1.4 + 'px',
                }}
                onClick={handleCopy}
                title={t('mobile_scramble.click_to_copy')}
            >
                {scramble || t('mobile_scramble.loading_scramble')}
                {copied && <Check className={b('copied-icon')} weight="bold" />}
            </div>
        </div>
    );
}
