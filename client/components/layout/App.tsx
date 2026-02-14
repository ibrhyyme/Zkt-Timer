import React, { ReactNode, useEffect, useState } from 'react';
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
import { setGeneral } from '../../actions/general';
import { getMe } from '../../actions/account';
import { getMe as getMeFromStore } from '../store';
import { updateThemeColors } from './themes';
import { updateSettingsBasedOnProStatus } from './pro_audit';
import { initSocketIO } from '../../util/socket/socketio';
import SettingsModal from '../settings/modal/SettingsModal';
import AnnouncementCarousel from '../announcements/AnnouncementCarousel';
import { GetActiveAnnouncementsDocument, Announcement } from '../../@types/generated/graphql';
import { gqlQueryTyped } from '../api';
import PendingSyncBadge from '../common/pending_sync_badge/PendingSyncBadge';
import { initOfflineSyncListener } from './offline-listener';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

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
	const location = useLocation();
	const modals = useGeneral('modals');
	const appLoaded = useGeneral('app_loaded');
	const settingsModalOpen = useGeneral('settings_modal_open');
	const me = useMe();

	const [unseenAnnouncements, setUnseenAnnouncements] = useState<Announcement[]>([]);
	const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

	function appInitiated() {
		setBrowserSessionId(dispatch);
		initPageTitleBlink();
		updateThemeColors();
		updateSettingsBasedOnProStatus(me);
		initOfflineSyncListener(); // Offline sync başlat
		dispatch(setGeneral('app_loaded', true));

		// Capacitor native'de splash screen'i kapat (uygulama hazır)
		if (Capacitor.isNativePlatform()) {
			SplashScreen.hide();
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

			if (hasAuth || isStandalone) {
				// Server couldn't authenticate on SSR, try fetching via API
				dispatch(getMe() as any)
					.then(() => {
						// If me is still null after fetch, auth truly failed
						if (!getMeFromStore()) {
							localStorage.removeItem('zkt_has_auth');
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
					.catch(() => {
						localStorage.removeItem('zkt_has_auth');
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
	}, [me, appLoaded]);

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
