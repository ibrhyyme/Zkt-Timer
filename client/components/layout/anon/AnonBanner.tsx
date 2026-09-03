// Tells a signed-out visitor where their solves are, and gives them the reason to
// sign up: not "make an account", but "you have 23 solves here, do not lose them".
//
// Deliberately a quiet strip rather than a modal — someone mid-session is timing, and
// an interruption at that moment costs a solve.

import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {X} from 'phosphor-react';
import './AnonBanner.scss';
import block from '../../../styles/bem';
import {useMe} from '../../../util/hooks/useMe';
import {getAnonSolveCount} from '../../../util/anon-mode';
import {getLocalStorage, setLocalStorage} from '../../../util/data/local_storage';
import {useEventListener} from '../../../util/event_handler';

const b = block('anon-banner');

const DISMISSED_AT_KEY = 'zkt_anon_banner_dismissed_at';
// After this many further solves the strip comes back, now carrying a number. The
// first dismissal is respected; the reminder returns only once there is real work
// at stake.
const REMIND_AFTER_SOLVES = 10;

function readDismissedAt(): number {
	try {
		const raw = getLocalStorage(DISMISSED_AT_KEY);
		if (raw === null || raw === undefined || raw === '') return -1;
		const n = parseInt(raw, 10);
		return Number.isFinite(n) ? n : -1;
	} catch {
		return -1;
	}
}

export default function AnonBanner() {
	const {t} = useTranslation();
	const me = useMe();

	const [count, setCount] = useState(0);
	const [dismissedAt, setDismissedAt] = useState(-1);

	// Read on mount, not during render: localStorage is unavailable on the server and
	// differs from the server-rendered markup, which would break hydration.
	useEffect(() => {
		setCount(getAnonSolveCount());
		setDismissedAt(readDismissedAt());
	}, []);

	useEventListener('solveDbUpdatedEvent', () => {
		setCount(getAnonSolveCount());
	});

	if (me) return null;

	const dismissed = dismissedAt >= 0 && count < dismissedAt + REMIND_AFTER_SOLVES;
	if (dismissed) return null;

	function dismiss() {
		setDismissedAt(count);
		try {
			setLocalStorage(DISMISSED_AT_KEY, String(count));
		} catch {}
	}

	return (
		<div className={b()}>
			<span className={b('text')}>
				{count > 0 ? t('anon.banner_text_with_count', {count}) : t('anon.banner_text')}
			</span>
			<Link to="/signup" className={b('cta')}>
				{t('anon.banner_cta')}
			</Link>
			<button type="button" className={b('dismiss')} onClick={dismiss} aria-label={t('anon.banner_dismiss')}>
				<X weight="bold" />
			</button>
		</div>
	);
}
