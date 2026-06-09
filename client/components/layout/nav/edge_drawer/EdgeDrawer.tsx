// Shared edge drawer primitive — sag (navigation) ve sol (settings) drawer'larin
// ortak gesture/state/portal/Android gesture exclusion logic'i.
//
// Architecture: BottomSheetNav (right) ve LeftSettingsDrawer (left) bu component'i
// thin wrapper olarak sarmalar. Sign-flip noktalari `side` prop'una gore branch'lenir
// (notch open-swipe dx, drawer close-swipe dx, translateX yonu, notchHint keyframe).
//
// Bagimsiz localStorage: her side kendi `storageKeyY` + `storageKeyUsed` ile gelir.
// __notchTouchingLeft / __notchTouchingRight globalleri ayri tutulur (Android back).

import React, {useState, useEffect, useLayoutEffect, useRef} from 'react';
import ReactDOM, {unstable_batchedUpdates} from 'react-dom';
import {useGeneral} from '../../../../util/hooks/useGeneral';
import {isNative, updateGestureExclusion, clearGestureExclusion} from '../../../../util/platform';
import block from '../../../../styles/bem';
import './EdgeDrawer.scss';

const b = block('edge-drawer');

type Side = 'left' | 'right';

interface Props {
	side: Side;
	storageKeyY: string;
	storageKeyUsed: string;
	notchHintText: string;
	notchHintSubText: string;
	// Sabit grid yuksekligi (sag drawer NAV_LINKS+profile icin 310). Verilmezse
	// auto-measure (drawerRef icindeki .edge-drawer__grid clientHeight'i okunur).
	gridHeightPx?: number;
	children: React.ReactNode;
}

function loadNotchY(key: string): number {
	try {
		const v = localStorage.getItem(key);
		if (!v) return 50;
		const n = parseFloat(v);
		// Bozuk/NaN deger UI'yi kirmasin (top: NaN%); 10-90 araligina clamp
		if (Number.isNaN(n)) return 50;
		return Math.max(10, Math.min(90, n));
	} catch {
		return 50;
	}
}

export default function EdgeDrawer(props: Props) {
	const {side, storageKeyY, storageKeyUsed, notchHintText, notchHintSubText, gridHeightPx, children} = props;
	const isLeft = side === 'left';

	const [open, setOpen] = useState(false);
	const [swipeOffset, setSwipeOffset] = useState<number | null>(null);
	const [notchY, setNotchY] = useState(() => loadNotchY(storageKeyY));
	const [repositioning, setRepositioning] = useState(false);
	const [showHint, setShowHint] = useState(() => {
		try { return !localStorage.getItem(storageKeyUsed); } catch { return true; }
	});

	// Drawer acikken dikey pozisyonu (spacer yuksekligi) sabitlenir. Boylece
	// icerik degisince (ornek: Hizli Ayarlar'da toggle on/off → ExtrasTab yuksekligi
	// degisir) panel yukari/asagi KAYMAZ. Sadece [open, notchY] degisince yeniden olculur.
	const [lockedTop, setLockedTop] = useState<number | null>(null);

	function markNotchUsed() {
		if (showHint) {
			setShowHint(false);
			try { localStorage.setItem(storageKeyUsed, '1'); } catch {}
		}
	}

	const mobileMode = useGeneral('mobile_mode');

	const drawerRef = useRef<HTMLDivElement>(null);
	const notchRef = useRef<HTMLDivElement>(null);
	const startX = useRef(0);
	const startY = useRef(0);
	const locked = useRef(false);
	const horizontal = useRef(false);
	const longPressTimer = useRef<any>(null);
	const openedBySwipe = useRef(false);
	// edgeDrawerClosed event'i sadece gercek open->close gecisinde firlasin
	// (mount'ta open=false oldugu icin yanlis erken dispatch'i onler)
	const wasOpened = useRef(false);
	const swiping = swipeOffset !== null;

	// Touch flag globali — App.tsx Android back-button listener bu globalleri
	// okur. Sol/sag ayri tutulur ki ikisi de izlenebilsin.
	const notchTouchingFlag = isLeft ? '__notchTouchingLeft' : '__notchTouchingRight';

	function gridWidth() {
		return drawerRef.current?.querySelector(`.${b('grid')}`)?.clientWidth || 250;
	}

	// Grid Y pozisyonu — centik konumuna gore, ekran disina tasmaz.
	// gridHeightPx verilmezse drawer ici grid clientHeight'i kullanilir (auto-measure).
	function gridTop(): number {
		if (typeof window === 'undefined') return 200;
		const vh = window.innerHeight;
		const gridEl = drawerRef.current?.querySelector(`.${b('grid')}`);
		const gridH = gridHeightPx ?? gridEl?.clientHeight ?? 310;
		const pad = 20;
		const center = (notchY / 100) * vh;
		return Math.max(pad, Math.min(vh - gridH - pad, center - gridH / 2));
	}

	// Drawer acildiginda spacer yuksekligini bir kere olc + kilitle. Icerik
	// degisikligi (toggle vb.) yeniden olcmeyi tetiklemez — sadece open/notchY.
	useLayoutEffect(() => {
		if (open) {
			setLockedTop(gridTop());
		} else {
			setLockedTop(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, notchY]);

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

	// --- Drawer kapanis sinyali — children'in ic state'ini sifirlamasi icin
	// (ornek: sol drawer extras view'dan grid view'a geri donsun)
	// Sadece gercek open->close gecisinde dispatch (mount'taki open=false atlanir)
	useEffect(() => {
		if (open) {
			wasOpened.current = true;
		} else if (wasOpened.current) {
			window.dispatchEvent(new CustomEvent('edgeDrawerClosed', {detail: {side}}));
		}
	}, [open, side]);

	// --- Android gesture exclusion: centik bolgesini geri hareketinden muaf tut ---
	useEffect(() => {
		updateGestureExclusion(side, notchY, 115);
		return () => clearGestureExclusion(side);
	}, [side, notchY]);

	// --- Notch touch: tap to open, swipe to open, long-press to reposition ---
	useEffect(() => {
		const notch = notchRef.current;
		if (!notch) return;

		function clearNotchFlag() {
			(window as any)[notchTouchingFlag] = false;
		}

		function onStart(e: TouchEvent) {
			// Timer'in inspection/cozum baslatmasini engelle
			e.stopPropagation();
			e.preventDefault();

			// Android back gesture'u engellemek icin flag
			(window as any)[notchTouchingFlag] = true;
			// Guvenlik: touchend/touchcancel firlamazsa 2s sonra temizle
			setTimeout(clearNotchFlag, 2000);

			startX.current = e.touches[0].clientX;
			startY.current = e.touches[0].clientY;
			locked.current = false;
			horizontal.current = false;

			longPressTimer.current = setTimeout(() => {
				setRepositioning(true);
			}, 400);
		}

		function onMove(e: TouchEvent) {
			e.stopPropagation();

			// Swipe ile acildiysa sonraki hareketleri yoksay
			if (openedBySwipe.current) return;

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

			// Swipe detection — SIDE-AWARE
			// Sag drawer: parmak SOLA giderse (tx < startX) drawer acilir → dx = startX - tx
			// Sol drawer: parmak SAGA giderse (tx > startX) drawer acilir → dx = tx - startX
			const dx = isLeft ? (tx - startX.current) : (startX.current - tx);
			const dy = Math.abs(ty - startY.current);

			if (!locked.current) {
				if (Math.abs(dx) < 10 && dy < 10) return;
				locked.current = true;
				horizontal.current = dx > 0 && Math.abs(dx) > dy;
			}

			if (!horizontal.current) return;
			e.preventDefault();

			// Esige ulasinca hemen ac, parmagi takip etmeyi birak
			if (dx > gridWidth() * 0.25) {
				markNotchUsed();
				openedBySwipe.current = true;
				locked.current = false;
				unstable_batchedUpdates(() => {
					setSwipeOffset(null);
					setOpen(true);
				});
				return;
			}

			setSwipeOffset(Math.max(0, dx));
		}

		function onEnd(e: TouchEvent) {
			e.stopPropagation();
			clearNotchFlag();

			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
				longPressTimer.current = null;
			}

			if (repositioning) {
				setRepositioning(false);
				try { localStorage.setItem(storageKeyY, String(notchY)); } catch {}
				return;
			}

			// Swipe mid-gesture acildiysa sadece flag temizle
			if (openedBySwipe.current) {
				openedBySwipe.current = false;
				return;
			}

			// Esige ulasmadan birakildi — drawer'i geri kapat
			if (swipeOffset !== null) {
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
		notch.addEventListener('touchcancel', clearNotchFlag);

		return () => {
			notch.removeEventListener('touchstart', onStart);
			notch.removeEventListener('touchmove', onMove);
			notch.removeEventListener('touchend', onEnd);
			notch.removeEventListener('touchcancel', clearNotchFlag);
			clearNotchFlag();
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
			}
		};
	});

	// --- Drawer: swipe to CLOSE ---
	useEffect(() => {
		const drawer = drawerRef.current;
		if (!drawer || !open) return;

		function onStart(e: TouchEvent) {
			// Centik swipe'indan acildiysa bu dokunusu yoksay (parmak hala ekranda)
			if (openedBySwipe.current) return;

			startX.current = e.touches[0].clientX;
			startY.current = e.touches[0].clientY;
			locked.current = false;
			horizontal.current = false;

			// Yatay slider (orn. hassasiyet bari) uzerinde baslayan gesture'i
			// close-swipe sayma — locked + !horizontal ile onMove tamamen pasif
			// kalir, preventDefault cagrilmaz, slider native suruklenir.
			if ((e.target as HTMLElement)?.closest?.('input[type="range"]')) {
				locked.current = true;
			}
		}

		function onMove(e: TouchEvent) {
			if (openedBySwipe.current) return;

			// Close-swipe yonu drawer side'in tersi:
			// Sag drawer: parmak SAGA giderse (tx > startX) kapanir → dx = tx - startX
			// Sol drawer: parmak SOLA giderse (tx < startX) kapanir → dx = startX - tx
			const tx = e.touches[0].clientX;
			const dx = isLeft ? (startX.current - tx) : (tx - startX.current);
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
			// Centik swipe flag'ini temizle — sonraki dokunuslar normal calismali
			if (openedBySwipe.current) {
				openedBySwipe.current = false;
				return;
			}

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

	// --- Transform — SIDE-AWARE ---
	// Sag drawer: closed=translateX(100%), open=translateX(0), mid-swipe artar
	// Sol drawer: closed=translateX(-100%), open=translateX(0), mid-swipe negatif
	let transform: string;
	let noTransition = false;

	const sign = isLeft ? -1 : 1;
	const offset = swipeOffset ?? 0;

	if (swiping) {
		noTransition = true;
		if (open) {
			// open + swiping = swipe-to-close: translateX(sign * offset)
			transform = `translateX(${sign * offset}px)`;
		} else {
			// closed + swiping = swipe-to-open: translateX(sign * (100% - offset))
			transform = isLeft
				? `translateX(calc(-100% + ${offset}px))`
				: `translateX(calc(100% - ${offset}px))`;
		}
	} else if (open) {
		transform = 'translateX(0)';
	} else {
		transform = isLeft ? 'translateX(-100%)' : 'translateX(100%)';
	}

	const backdropOpacity = swiping
		? (open ? Math.max(0, 1 - offset / gridWidth()) : Math.min(1, offset / gridWidth()))
		: open ? 1 : 0;

	// Centik native uygulamada + mobil tarayicida gorunur, masaustu tarayicida gizli
	if (!isNative() && !mobileMode) return null;

	const sideMod = isLeft ? 'left' : 'right';
	// Drawer acikken kilitli top (icerik degisiminde kaymaz), aksi halde anlik hesap
	const spacerTop = open && lockedTop !== null ? lockedTop : gridTop();

	return (
		<>
			{ReactDOM.createPortal(
				<>
					<div
						ref={notchRef}
						className={b('notch', {hidden: open, repositioning, hint: showHint && !open, [sideMod]: true})}
						style={{top: `${notchY}%`}}
						onClick={() => {
							if (repositioning) return;
							markNotchUsed();
							setOpen(true);
						}}
					>
						{showHint && !open && (
							<div className={b('notch-tooltip', {[sideMod]: true})}>
								<span>{notchHintText}</span>
								<span className={b('notch-tooltip-sub')}>{notchHintSubText}</span>
							</div>
						)}
					</div>

					<div
						className={b('backdrop', {visible: open || swiping})}
						style={{opacity: backdropOpacity}}
					/>

					<div
						ref={drawerRef}
						className={b('drawer', {open: open && !swiping, 'no-transition': noTransition, [sideMod]: true})}
						style={swiping ? {transform} : undefined}
					>
						<div style={{height: spacerTop, flexShrink: 0}} />
						<div className={b('grid')}>
							{children}
						</div>
					</div>
				</>,
				document.body,
			)}
		</>
	);
}
