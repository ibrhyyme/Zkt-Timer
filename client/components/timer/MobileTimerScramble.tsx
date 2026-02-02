import React, { useContext, useEffect, useState } from 'react';
import { Check } from 'phosphor-react';
import { copyText } from '../common/copy_text/CopyText';
import { TimerContext } from './Timer';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useSettings } from '../../util/hooks/useSettings';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../db/settings/update';
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
    const context = useContext(TimerContext);
    const mobileMode = useGeneral('mobile_mode');
    const cubeType = context.cubeType;
    const sessionId = useSettings('session_id');
    const isMegaminx = cubeType === 'minx' || cubeType === 'megaminx';
    const [copied, setCopied] = useState(false);

    // Dynamic font size calculation based on scramble length (ignoring user setting for mobile)
    const getResponsiveFontSize = (len: number) => {
        if (len < 30) return 30; // 2x2, Skewb, Pyraminx
        if (len < 60) return 24; // 3x3
        if (len < 120) return 20; // 4x4, 5x5
        if (len < 250) return 16; // Megaminx, 6x6
        return 13; // 7x7 and larger
    };

    const scrambleLength = context.scramble ? context.scramble.length : 0;
    const timerScrambleSize = getResponsiveFontSize(scrambleLength);

    const { hideScramble, timeStartedAt, focusMode, scrambleLocked } = context;
    let scramble = context.scramble;
    const lockedScramble = useSettings('locked_scramble');

    const isSmart = smartCubeSelected(context);

    // Küp türü veya session değiştiğinde scramble generate et
    useEffect(() => {
        if (lockedScramble && !timeStartedAt) {
            setTimerParam('scramble', lockedScramble);
            setTimerParam('scrambleLocked', true);
        } else {
            resetScramble(context);
        }
    }, [cubeType, sessionId]);

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
                        lineHeight: timerScrambleSize * 1.6 + 'px',
                    }}
                >
                    <SmartScramble />
                </div>
            </div>
        );
    }

    return (
        <div className={b()}>
            <div
                className={b('text', { megaminx: isMegaminx, copied })}
                style={{
                    fontSize: timerScrambleSize + 'px',
                    lineHeight: timerScrambleSize * 1.6 + 'px',
                }}
                onClick={handleCopy}
                title="Kopyalamak için tıkla"
            >
                {scramble || 'Karıştırma yükleniyor...'}
                {copied && <Check className={b('copied-icon')} weight="bold" />}
            </div>
        </div>
    );
}
