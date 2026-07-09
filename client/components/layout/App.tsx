import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import './App.scss';
import Wrapper from './wrapper/Wrapper';
import LoadingCover from './loading_cover/LoadingCover';
import Modal from '../common/modal/Modal';
import { initPageTitleBlink } from '../../util/page_title_blink';
import Banned from './banned/Banned';
import TopNav from './top_nav/TopNav';
import Header from './header/Header';
import { initAnonymousAppData, initAppData, setBrowserSessionId } from './init';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useMe } from '../../util/hooks/useMe';
import { setGeneral, closeModal } from '../../actions/general';
import { getMe } from '../../actions/account';
import { getMe as getMeFromStore, getStore } from '../store';
import { updateThemeColors } from './themes';
import { initSocketIO } from '../../util/socket/socketio';
import SettingsModal from '../settings/modal/SettingsModal';
import AnnouncementCarousel from '../announcements/AnnouncementCarousel';
import { GetActiveAnnouncementsDocument, Announcement } from '../../@types/generated/graphql';
import { gqlQueryTyped } from '../api';
import PendingSyncBadge from '../common/pending_sync_badge/PendingSyncBadge';
import { initOfflineSyncListener } from './offline-listener';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { initPushNotifications } from '../../util/push-notifications';
import { initStatusBar, lockTextZoom, initSafeArea } from '../../util/native-plugins';
import { setBackButtonHandle, releaseNativeBackButton } from '../../util/native-back';
import { openInAppBrowser } from '../../util/external-link';
import SwipeBackIndicator from '../common/swipe_back_indicator/SwipeBackIndicator';
import {useSiteConfig} from '../../util/hooks/useSiteConfig';
import MaintenancePage from '../maintenance/MaintenancePage';
import {showNativeToast} from '../../util/native-plugins';
import {preloadTimerSounds} from '../../util/native-audio';
import {initRevenueCat, identifyUser as iapIdentifyUser, logoutRevenueCat} from '../../lib/iap';
import {gqlMutate} from '../api';
import {LinkRevenueCatUserDocument} from '../../@types/generated/graphql';
import {notifyRouteChange} from '../../util/activity-heartbeat';
import {saveCachedMe, getCachedMe, clearCachedMe} from '../../util/auth/cached-me';
import {clearSessionToken} from '../../util/auth/session-token';
import {isLocalShell} from '../../util/api-base';
import {initDeepLinkHandler} from '../../util/deep-link';
import {initNativeShellBoot} from '../../util/native-shell-boot';

interface Props {
	path?: string;
	noPadding?: boolean;
	standalone?: boolean;
	children?: ReactNode;
	hideTopNav?: boolean;
	restricted?: boolean;
}

export default function App(props: Props = {}) {
	const { path, standalone, children, hideTopNav, restricted } = props;

	const dispatch = useDispatch();
	const { i18n } = useTranslation();
	const location = useLocation();
	const modals = useGeneral('modals');
	const appLoaded = useGeneral('app_loaded');
	const settingsModalOpen = useGeneral('settings_modal_open');
	const me = useMe();
	const siteConfig = useSiteConfig();

	const [unseenAnnouncements, setUnseenAnnouncements] = useState<Announcement[]>([]);
	const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

	// Record a heartbeat for the page the user settles on (debounced in the helper),
	// so short visits between 60s ticks still register in the admin daily breakdown.
	useEffect(() => {
		if (!me?.id) return;
		notifyRouteChange();
	}, [me?.id, location.pathname]);

	// Persist the identity snapshot on every successful auth (SSR boot or getMe)
	// so an offline cold start can restore the session from localStorage. The flag
	// keeps future boots on the authenticated path (matters after the Faz 2 session
	// carryover, where login pages never ran on this origin).
	useEffect(() => {
		if (me) {
			saveCachedMe(me);
			try {
				localStorage.setItem('zkt_has_auth', 'true');
			} catch (e) {}
		}
	}, [me]);

	function appInitiated() {
		setBrowserSessionId(dispatch);
		initPageTitleBlink();
		updateThemeColors();
		initOfflineSyncListener(); // Start offline sync listener
		dispatch(setGeneral('app_loaded', true));

		// On native: hide splash screen and initialize native plugins
		if (Capacitor.isNativePlatform()) {
			SplashScreen.hide();
			initStatusBar();
			lockTextZoom();
			initSafeArea();
			initRevenueCat(); // Prepare RevenueCat IAP SDK
			initDeepLinkHandler(); // zkttimer:// OAuth relay + migrate bridge (local shell)
			initNativeShellBoot(); // Capgo notifyAppReady + one-time migration checks

			// Block iOS WKWebView pinch-to-zoom
			if (Capacitor.getPlatform() === 'ios') {
				document.addEventListener('gesturestart', (e) => e.preventDefault());
				document.addEventListener('gesturechange', (e) => e.preventDefault());
				preloadTimerSounds();
			}

			let lastBackPress = 0;

			CapApp.addListener('backButton', () => {
				// If either notch is being touched, ignore back gesture
				if ((window as any).__notchTouchingLeft || (window as any).__notchTouchingRight) return;

				const state = getStore().getState();
				const modals = state?.general?.modals || [];
				const settingsOpen = state?.general?.settings_modal_open;

				if (modals.length > 0) {
					dispatch(closeModal() as any);
				} else if (settingsOpen) {
					dispatch(setGeneral('settings_modal_open', false));
				} else if (window.history.length > 1) {
					window.history.back();
				} else {
					// Double back to exit: prevent accidental app closure
					const now = Date.now();
					if (now - lastBackPress < 2000) {
						CapApp.exitApp();
					} else {
						lastBackPress = now;
						showNativeToast('Press back again to exit');
					}
				}
			}).then(setBackButtonHandle);

			// Route external links through openInAppBrowser instead of letting the
			// WebView navigate away from the app shell: hosts in allowNavigation
			// (e.g. WCA) would replace the app in-place with no way back. Capture
			// phase + stopPropagation so per-component handlers don't double-open.
			document.addEventListener(
				'click',
				(e) => {
					const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
					if (!anchor || anchor.hasAttribute('download')) return;

					const href = anchor.href;
					if (!/^https?:/i.test(href)) return; // keep native handling for mailto:, tel:, etc.

					let url: URL;
					try {
						url = new URL(href);
					} catch (err) {
						return;
					}
					if (url.origin === window.location.origin) return; // in-app links untouched

					// Remote-mode binaries: WCA OAuth must keep navigating the WebView itself
					// (the redirect lands back in the app), but drop the backButton listener
					// so bailing out mid-login still leaves a working hardware back.
					// Local shell: OAuth goes through the external browser + deep link relay,
					// so fall through to openInAppBrowser like any external link.
					if (!isLocalShell() && url.hostname.endsWith('worldcubeassociation.org') && url.pathname.startsWith('/oauth/authorize')) {
						void releaseNativeBackButton();
						return;
					}

					e.preventDefault();
					e.stopPropagation();
					openInAppBrowser(href);
				},
				true
			);
		}
	}

	useEffect(() => {
		if (appLoaded) {
			return;
		}

		if (!me) {
			// Check if user should be authenticated (localStorage flag set during login)
			const hasAuth = typeof window !== 'undefined' && localStorage.getItem('zkt_has_auth');

			// ENHANCEMENT: Always try to fetch 'me' if we are in a PWA context or if we just want to be sure,
			// even if the flag is missing. But to save resources, we usually rely on the flag.
			// However, given the user's issue, let's be more aggressive.

			// Only try to fetch if we have a flag OR if we are in standalone mode (where flag might be lost)
			const isStandalone = typeof window !== 'undefined' && ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches);

			// Faz 2 session carryover: the local shell's FIRST boot has an empty
			// localStorage (new origin), but on Android the old zktimer.app session
			// cookie usually still rides along (Apollo credentials:'include'). Try
			// getMe once — success silently restores the account and mints a Bearer
			// token via X-Session-Token. iOS ITP typically blocks the cookie, so
			// those users fall through to anonymous and log in once.
			const carryoverEligible = isLocalShell() && !hasAuth && !localStorage.getItem('zkt_session_carryover_done');
			if (carryoverEligible) {
				localStorage.setItem('zkt_session_carryover_done', '1');
			}

			if (hasAuth || isStandalone || carryoverEligible) {
				// Server couldn't authenticate on SSR, try fetching via API
				dispatch(getMe() as any)
					.then(() => {
						// If me is still null after fetch, auth truly failed
						if (!getMeFromStore()) {
							localStorage.removeItem('zkt_has_auth');
							clearCachedMe();
							// Also drop the stored Bearer token: a stale/revoked token left
							// behind would poison every subsequent boot with the same
							// rejection (the login-bounce loop).
							void clearSessionToken();
							// Only redirect to login if we had a flag. If we were just checking standalone, maybe go to welcome?
							if (hasAuth) {
								window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
							} else {
								// If init failed in PWA without flag, go to welcome (or login)
								// But App.tsx handles general auth state.
								// We'll let initAnonymousAppData handle the fallback if this promise resolves empty?
								// Actually getMe() usually throws or returns null.
								if (window.location.pathname !== '/welcome') {
									// window.location.href = '/welcome';
									// Let's just fall through to anonymous init?
									// No, getMeFromStore being null means we are NOT logged in.
									initAnonymousAppData(appInitiated);
								}
							}
						}
						// If me exists, useEffect will re-run (me dependency changed)
					})
					.catch((err) => {
						// A network failure (offline, or the SW's synthesized 503) is NOT an
						// auth rejection: keep the session flag and boot from the cached
						// identity + local DB instead of bouncing the user to /login.
						const isNetworkError =
							Boolean(err?.networkError) || (typeof navigator !== 'undefined' && navigator.onLine === false);

						if (isNetworkError && hasAuth) {
							const cachedMe = getCachedMe();
							if (cachedMe) {
								// useEffect([me]) re-runs into initAppData, whose offline
								// fallbacks load settings/sessions/solves from local storage.
								dispatch({type: 'SET_ME', payload: {me: cachedMe}});
							} else {
								// Offline with no snapshot yet: boot anonymous but KEEP the
								// flag so the account is restored on the next online launch.
								initAnonymousAppData(appInitiated);
							}
							return;
						}

						localStorage.removeItem('zkt_has_auth');
						clearCachedMe();
						void clearSessionToken();
						// If we had a flag and failed, force login.
						if (hasAuth) {
							window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
						} else {
							initAnonymousAppData(appInitiated);
						}
					});
				return;
			}

			initAnonymousAppData(appInitiated);
			return;
		}

		initSocketIO();
		initAppData(me, dispatch, appInitiated);
	}, [me]);

	// Push notifications - separate from main init so it works even after login
	const pushInitRef = useRef(false);
	useEffect(() => {
		if (!me || pushInitRef.current) return;
		pushInitRef.current = true;
		initPushNotifications();
	}, [me]);

	// RevenueCat: on login, identify user and set revenuecat_user_id in DB
	const iapLinkedRef = useRef<string | null>(null);
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;
		if (me?.id && iapLinkedRef.current !== me.id) {
			const targetId = me.id;
			iapIdentifyUser(targetId)
				.then(() => { iapLinkedRef.current = targetId; })
				.catch(() => {});
			gqlMutate(LinkRevenueCatUserDocument, {}).catch(() => {});
		} else if (!me && iapLinkedRef.current) {
			iapLinkedRef.current = null;
			logoutRevenueCat().catch(() => {});
		}
	}, [me?.id]);

	// Auto-refresh Pro status: update when app comes to foreground.
	// When user backgrounds and returns, subscription status is refreshed.
	useEffect(() => {
		if (!me?.id) return;

		const refreshMe = () => { dispatch(getMe() as any); };

		let nativeListener: {remove: () => void} | null = null;
		const onVisibilityChange = () => { if (!document.hidden) refreshMe(); };
		if (Capacitor.isNativePlatform()) {
			CapApp.addListener('appStateChange', ({isActive}) => {
				if (isActive) refreshMe();
			}).then((l) => { nativeListener = l; }).catch(() => {});
		} else {
			document.addEventListener('visibilitychange', onVisibilityChange);
		}

		return () => {
			if (!Capacitor.isNativePlatform()) {
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
			if (nativeListener) nativeListener.remove();
		};
	}, [me?.id]);

	// Fetch announcements when user logs in
	useEffect(() => {
		if (!me || !appLoaded) return;

		let mounted = true;

		const fetchAnnouncements = async () => {
			setLoadingAnnouncements(true);
			try {
				const res = await gqlQueryTyped(GetActiveAnnouncementsDocument, {}, {
					fetchPolicy: 'network-only'
				});

				if (mounted) {
					const announcements = res.data?.getActiveAnnouncements || [];
					if (announcements.length > 0) {
						setUnseenAnnouncements(announcements);
					}
				}
			} catch (error) {
				console.error('Failed to fetch announcements:', error);
			} finally {
				if (mounted) {
					setLoadingAnnouncements(false);
				}
			}
		};

		fetchAnnouncements();

		return () => {
			mounted = false;
		};
	}, [me, appLoaded, i18n.language]);

	if (typeof window !== 'undefined') {
		if (!me && restricted) {
			window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
			return;
		}
	}

	if (!me && restricted && !standalone) {
		return null;
	}

	if (me?.banned_forever || me?.banned_until) {
		return <Banned />;
	}

	// Maintenance mode — show MaintenancePage to everyone except admins
	// Bypass on login/signup/oauth/admin pages
	const pathname = location.pathname;
	const bypassMaintenance =
		pathname.startsWith('/login') ||
		pathname.startsWith('/signup') ||
		pathname.startsWith('/oauth') ||
		pathname.startsWith('/admin');
	if (siteConfig?.maintenance_mode && !me?.admin && !bypassMaintenance) {
		return <MaintenancePage />;
	}

	if (standalone) {
		return (
			<div className="cd-app-standalone">
				{hideTopNav ? null : <TopNav />}
				{children}
			</div>
		);
	}

	let modalOutput: ReactNode = null;
	if (modals && modals.length) {
		const modalList = [];
		for (let i = 0; i < modals.length; i += 1) {
			const modal = modals[i];

			modalList.push(
				<Modal key={modal.createdAt} zIndex={1000000 + i} {...modal.options}>
					{modal.body}
				</Modal>
			);
		}

		modalOutput = <div className="cd-modal--list">{modalList}</div>;
	}

	const wrapperProps = {
		...props,
		children: null,
	};

	return (
		<>
			<SwipeBackIndicator />
			<Header path={location.pathname} />
			<LoadingCover fadeOut={appLoaded} />
			{modalOutput}
			{settingsModalOpen && (
				<SettingsModal
					isOpen={settingsModalOpen}
					onClose={() => dispatch(setGeneral('settings_modal_open', false))}
				/>
			)}
			{unseenAnnouncements.length > 0 && !loadingAnnouncements && (
				<AnnouncementCarousel
					announcements={unseenAnnouncements}
					onClose={() => setUnseenAnnouncements([])}
				/>
			)}
			{appLoaded ? <Wrapper {...wrapperProps}>{children}</Wrapper> : null}
			{appLoaded && <PendingSyncBadge />}
		</>
	);
}
