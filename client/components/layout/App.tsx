import React, { ReactNode, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
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
	}

	useEffect(() => {
		if (appLoaded) {
			return;
		}

		if (!me) {
			// Check if user should be authenticated (localStorage flag set during login)
			const hasAuth = typeof window !== 'undefined' && localStorage.getItem('zkt_has_auth');
			if (hasAuth) {
				// Server couldn't authenticate on SSR, try fetching via API
				dispatch(getMe() as any)
					.then(() => {
						// If me is still null after fetch, auth truly failed
						if (!getMeFromStore()) {
							localStorage.removeItem('zkt_has_auth');
							initAnonymousAppData(appInitiated);
						}
						// If me exists, useEffect will re-run (me dependency changed)
					})
					.catch(() => {
						localStorage.removeItem('zkt_has_auth');
						initAnonymousAppData(appInitiated);
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
			<Header path={path} />
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
