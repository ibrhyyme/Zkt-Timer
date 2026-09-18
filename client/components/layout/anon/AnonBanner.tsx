// Tells a signed-out visitor where their solves are, and gives them the reason to
// sign up: not "make an account", but "you have 23 solves here, do not lose them".
//
// Deliberately a quiet strip rather than a modal — someone mid-session is timing, and
// an interruption at that moment costs a solve.

import React, {useEffect, useRef, useState} from 'react';
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

	const dismissed = dismissedAt >= 0 && count < dismissedAt + REMIND_AFTER_SOLVES;
	const visible = !me && !dismissed;

	// Publish the strip's height so the pages that size themselves against the viewport
	// can subtract it. The timer is a full-height layout (`100vh - nav`), and without
	// this the strip pushed the whole page down by its own height and the module bar at
	// the bottom fell off the screen. Measured rather than hard-coded: the text wraps to
	// two lines on a narrow window.
	const ref = useRef<HTMLDivElement>(null);

	// Above the early returns on purpose: a hook that only runs while the strip is on
	// screen is a hook that changes order between renders.
	useEffect(() => {
		const element = visible ? ref.current : null;
		const root = typeof document === 'undefined' ? null : document.documentElement;
		if (!root) return undefined;

		if (!element) {
			root.style.removeProperty('--anon-banner-h');
			return undefined;
		}

		// Margins included: the strip pushes the page down by its box AND the gap under
		// it, and a measurement that stops at the border leaves that gap unaccounted for.
		const publish = () => {
			const style = getComputedStyle(element);
			const margins = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
			root.style.setProperty('--anon-banner-h', `${Math.round(element.getBoundingClientRect().height + margins)}px`);
		};
		publish();

		const observer = new ResizeObserver(publish);
		observer.observe(element);

		return () => {
			observer.disconnect();
			root.style.removeProperty('--anon-banner-h');
		};
	}, [visible]);

	if (!visible) return null;

	function dismiss() {
		setDismissedAt(count);
		try {
			setLocalStorage(DISMISSED_AT_KEY, String(count));
		} catch {}
	}

	return (
		<div className={b()} ref={ref}>
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
