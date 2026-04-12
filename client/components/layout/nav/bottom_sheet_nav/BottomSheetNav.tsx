import React, {useState, useEffect, useRef} from 'react';
import ReactDOM from 'react-dom';
import './BottomSheetNav.scss';
import {useRouteMatch, useHistory} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {UserCircle} from 'phosphor-react';
import {NAV_LINKS} from '../Nav';
import {useMe} from '../../../../util/hooks/useMe';
import {useGeneral} from '../../../../util/hooks/useGeneral';
import block from '../../../../styles/bem';

const b = block('bottom-sheet-nav');
const NOTCH_Y_KEY = 'zkt_notch_y';
const NOTCH_USED_KEY = 'zkt_notch_used';

function loadNotchY(): number {
	try {
		const v = localStorage.getItem(NOTCH_Y_KEY);
		return v ? parseFloat(v) : 50;
	} catch {
		return 50;
	}
}

export default function BottomSheetNav() {
	const mobileMode = useGeneral('mobile_mode');
	const [open, setOpen] = useState(false);
	const [swipeOffset, setSwipeOffset] = useState<number | null>(null);
	const [notchY, setNotchY] = useState(loadNotchY);
	const [repositioning, setRepositioning] = useState(false);
	const [showHint, setShowHint] = useState(() => {
		try { return !localStorage.getItem(NOTCH_USED_KEY); } catch { return true; }
	});

	function markNotchUsed() {
		if (showHint) {
			setShowHint(false);
			try { localStorage.setItem(NOTCH_USED_KEY, '1'); } catch {}
		}
	}

	const match = useRouteMatch();
	const history = useHistory();
	const {t} = useTranslation();
	const me = useMe();

	const drawerRef = useRef<HTMLDivElement>(null);
	const notchRef = useRef<HTMLDivElement>(null);
	const startX = useRef(0);
	const startY = useRef(0);
	const locked = useRef(false);
	const horizontal = useRef(false);
	const longPressTimer = useRef<any>(null);
	const swiping = swipeOffset !== null;

	function gridWidth() {
		return drawerRef.current?.querySelector(`.${b('grid')}`)?.clientWidth || 250;
	}

	// Grid Y pozisyonu — centik konumuna gore, ekran disina tasmaz
	function gridTop(): number {
		if (typeof window === 'undefined') return 200;
		const vh = window.innerHeight;
		const gridH = 310;
		const pad = 20;
		const center = (notchY / 100) * vh;
		return Math.max(pad, Math.min(vh - gridH - pad, center - gridH / 2));
	}

	// --- Click to close ---
	useEffect(() => {
		if (!open) return;

		const handleClose = (e: Event) => {
			const target = e.target as HTMLElement;
			if (target?.closest(`.${b('grid')}`)) return;
			if (notchRef.current?.contains(target)) return;
			setOpen(false);
		};

		const timer = setTimeout(() => {
			document.addEventListener('click', handleClose, true);
		}, 100);

		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', handleClose, true);
		};
	}, [open]);

	// --- Timer interaction close ---
	useEffect(() => {
		if (!open) return;
		const close = () => setOpen(false);
		window.addEventListener('timerInteractionStart', close);
		return () => window.removeEventListener('timerInteractionStart', close);
	}, [open]);

	// --- Notch touch: tap to open, swipe left to open, long-press to reposition ---
	useEffect(() => {
		const notch = notchRef.current;
		if (!notch) return;

		function onStart(e: TouchEvent) {
			startX.current = e.touches[0].clientX;
			startY.current = e.touches[0].clientY;
			locked.current = false;
			horizontal.current = false;

			longPressTimer.current = setTimeout(() => {
				setRepositioning(true);
			}, 400);
		}

		function onMove(e: TouchEvent) {
			const tx = e.touches[0].clientX;
			const ty = e.touches[0].clientY;

			// Repositioning mode — surukle yukari/asagi
			if (repositioning) {
				e.preventDefault();
				const newY = Math.max(10, Math.min(90, (ty / window.innerHeight) * 100));
				setNotchY(newY);
				return;
			}

			// Cancel long-press on any movement
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
				longPressTimer.current = null;
			}

			// Swipe detection
			const dx = startX.current - tx;
			const dy = Math.abs(ty - startY.current);

			if (!locked.current) {
				if (Math.abs(dx) < 10 && dy < 10) return;
				locked.current = true;
				horizontal.current = dx > 0 && Math.abs(dx) > dy;
			}

			if (!horizontal.current) return;
			e.preventDefault();
			setSwipeOffset(Math.max(0, dx));
		}

		function onEnd() {
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
				longPressTimer.current = null;
			}

			if (repositioning) {
				setRepositioning(false);
				try { localStorage.setItem(NOTCH_Y_KEY, String(notchY)); } catch {}
				return;
			}

			// Swipe tamamlandi
			if (swipeOffset !== null) {
				if (swipeOffset > gridWidth() * 0.25) {
					markNotchUsed();
					setOpen(true);
				}
				setSwipeOffset(null);
				locked.current = false;
				return;
			}

			// Tap (ne swipe ne long-press)
			if (!locked.current) {
				markNotchUsed();
				setOpen(true);
			}
			locked.current = false;
		}

		const opts = {passive: false} as AddEventListenerOptions;
		notch.addEventListener('touchstart', onStart, opts);
		notch.addEventListener('touchmove', onMove, opts);
		notch.addEventListener('touchend', onEnd, opts);

		return () => {
			notch.removeEventListener('touchstart', onStart);
			notch.removeEventListener('touchmove', onMove);
			notch.removeEventListener('touchend', onEnd);
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
			}
		};
	});

	// --- Drawer: swipe right to CLOSE ---
	useEffect(() => {
		const drawer = drawerRef.current;
		if (!drawer || !open) return;

		function onStart(e: TouchEvent) {
			startX.current = e.touches[0].clientX;
			startY.current = e.touches[0].clientY;
			locked.current = false;
			horizontal.current = false;
		}

		function onMove(e: TouchEvent) {
			const dx = e.touches[0].clientX - startX.current;
			const dy = Math.abs(e.touches[0].clientY - startY.current);

			if (!locked.current) {
				if (Math.abs(dx) < 10 && dy < 10) return;
				locked.current = true;
				horizontal.current = dx > 0 && Math.abs(dx) > dy;
			}

			if (!horizontal.current) return;
			e.preventDefault();
			setSwipeOffset(Math.max(0, dx));
		}

		function onEnd() {
			if (swipeOffset !== null && swipeOffset > gridWidth() * 0.25) {
				setOpen(false);
			}
			setSwipeOffset(null);
			locked.current = false;
		}

		const opts = {passive: false} as AddEventListenerOptions;
		drawer.addEventListener('touchstart', onStart, opts);
		drawer.addEventListener('touchmove', onMove, opts);
		drawer.addEventListener('touchend', onEnd, opts);

		return () => {
			drawer.removeEventListener('touchstart', onStart);
			drawer.removeEventListener('touchmove', onMove);
			drawer.removeEventListener('touchend', onEnd);
		};
	});

	// --- Transform ---
	let transform: string;
	let noTransition = false;

	if (swiping) {
		noTransition = true;
		if (open) {
			transform = `translateX(${swipeOffset}px)`;
		} else {
			transform = `translateX(calc(100% - ${swipeOffset}px))`;
		}
	} else if (open) {
		transform = 'translateX(0)';
	} else {
		transform = 'translateX(100%)';
	}

	const backdropOpacity = swiping
		? (open ? Math.max(0, 1 - swipeOffset / gridWidth()) : Math.min(1, swipeOffset / gridWidth()))
		: open ? 1 : 0;

	function navigateTo(link: string) {
		history.push(link);
		setOpen(false);
	}

	return (
		<>
			{ReactDOM.createPortal(
				<>
					<div
						ref={notchRef}
						className={b('notch', {hidden: open, repositioning, hint: showHint && !open && mobileMode})}
						style={{top: `${notchY}%`}}
						onClick={() => {
							if (repositioning) return;
							markNotchUsed();
							setOpen(true);
						}}
					>
						{showHint && !open && mobileMode && (
							<div className={b('notch-tooltip')}>
								<span>{t('nav.notch_swipe')}</span>
								<span className={b('notch-tooltip-sub')}>{t('nav.notch_hold')}</span>
							</div>
						)}
					</div>

					<div
						className={b('backdrop', {visible: open || swiping})}
						style={{opacity: backdropOpacity}}
					/>

					<div
						ref={drawerRef}
						className={b('drawer', {open: open && !swiping, 'no-transition': noTransition})}
						style={swiping ? {transform} : undefined}
					>
						<div style={{height: gridTop(), flexShrink: 0}} />
						<div className={b('grid')}>
							{NAV_LINKS.map((link) => {
								const isActive = link.match.test(match.path);
								return (
									<button
										key={link.link}
										className={b('item', {active: isActive})}
										onClick={() => !isActive && navigateTo(link.link)}
									>
										<div className={b('item-icon')}>
											{React.cloneElement(link.icon, {size: 24})}
										</div>
										<span className={b('item-label')}>{t(link.name)}</span>
									</button>
								);
							})}
							{me && (
								<button
									className={b('item', {active: /^\/user\//.test(match.path)})}
									onClick={() => navigateTo(`/user/${me.username}`)}
								>
									<div className={b('item-icon')}>
										<UserCircle size={24} weight="bold" />
									</div>
									<span className={b('item-label')}>{t('account_dropdown.profile')}</span>
								</button>
							)}
						</div>
					</div>
				</>,
				document.body
			)}
		</>
	);
}
