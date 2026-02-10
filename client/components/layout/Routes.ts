import React from 'react';
import App from './App';
import Sessions from '../sessions/Sessions';
import Stats from '../stats/Stats';
import Settings from '../settings/Settings';
import LoginWrapper from '../login/LoginWrapper';
import Trainer from '../trainer/Trainer';
import Account from '../account/Account';
import Password from '../account/password/Password';
import DangerZone from '../account/danger_zone/DangerZone';
import PersonalInfo from '../account/personal_info/PersonalInfo';
import Community from '../community/Community';
import Elimination from '../play/logic/Elimination';
import Solves from '../solves/SolvesList';
import Profile, { prefetchProfileData } from '../profile/Profile';
import Admin from '../admin/Admin';
import SolvePage, { prefetchSolveData } from '../solve_page/SolvePage';
import Friends from '../community/friends/Friends';
import NotificationPreferences from '../account/notification_preferences/NotificationPreferences';
import Play from '../play/Play';
import HeadToHead from '../play/logic/HeadToHead';
import Privacy from '../landing/legal/Privacy';
import Terms from '../landing/legal/Terms';
import Credits from '../landing/legal/Credits';
import Landing from '../landing/Landing';
import PlayWrapper from '../play/PlayWrapper';
import Appearance from '../settings/appearance/Appearance';
import TimerSettings from '../settings/timer/TimerSettings';
import DataSettings from '../settings/data/DataSettings';
import SettingsRedirect from '../settings/redirect/SettingsRedirect';
import LinkedAccounts from '../account/linked_accounts/LinkedAccounts';
import OAuthService from '../oauth/OAuthService';
import ForceSignOut from '../login/force_sign_out/ForceSignOut';
import AnnouncementHistory from '../profile/AnnouncementHistory';
import type { Store } from 'redux';
import Reports from '../admin/reports/Reports';
import DefaultTimer from '../timer/DefaultTimer';
import AdminUsers from '../admin/users/AdminUsers';
import UnsubEmails from '../unsub/UnsubEmails';
import EloBoard from '../community/EloBoard';
import RoomsList from '../rooms/RoomsList';
import FriendlyRoom from '../rooms/FriendlyRoom';
import AdminAnnouncements from '../admin/announcements/AdminAnnouncements';
import Welcome from '../landing/welcome/Welcome';
import RootRedirect from '../landing/root_redirect/RootRedirect';

interface PageOptions {
	restricted: boolean;
	standalone: boolean;
	admin: boolean;
	hideTopNav: boolean;
	noPadding: boolean;
	prefetchData: ((store: Store<any>, req: Request) => Promise<any>)[];
}

export interface PageContext extends PageOptions {
	path: string;
	grandparent: any;
	parent: any;
	child: any;
}

export interface RedirectPath {
	path: string;
	redirect: string;
}

function route(
	path: string,
	grandparent: any,
	parent: any,
	child: any,
	restricted = true,
	standalone = false, // Standalone means that it wont be wrapped around the <Wrapper> class
	admin = false,
	hideTopNav = false,
	noPadding = false,
	prefetchData = null
): PageContext {
	return {
		path,
		grandparent,
		parent,
		child,
		restricted,
		standalone,
		admin,
		hideTopNav,
		noPadding,
		prefetchData,
	};
}

function routeRedirect(path: string, redirect: string): RedirectPath {
	return {
		path,
		redirect,
	};
}

// Order by importance (at least the public routes)
export const routes: (PageContext | RedirectPath)[] = [
	// Main tabs
	route('/', null, RootRedirect, null, false, true),
	route('/timer', null, App, DefaultTimer, false, false, false, false, true),
	route('/signup', null, App, LoginWrapper, false, true, false, true),
	route('/login', null, App, LoginWrapper, false, true, false, true),
	route('/forgot', null, App, LoginWrapper, false, true, false, true),
	route('/sessions', null, App, Sessions, false),
	route('/solves', null, App, Solves, false),
	route('/stats', null, App, Stats, false),
	route('/force-log-out', null, App, ForceSignOut, false, true, false, true),

	// Settings - Redirect to modal
	route('/settings/timer', null, App, SettingsRedirect, false),
	route('/settings/appearance', null, App, SettingsRedirect, false),
	route('/settings/data', null, App, SettingsRedirect, false),
	route('/settings', null, App, SettingsRedirect, false),

	// Landing Pages
	// route('/how-to-solve', null, Landing, HTSLanding, false, false, false, false, true),
	// route('/how-to-solve/:stepId', null, Landing, HTSLearn, false, false, false, false, true),
	route('/terms', null, Landing, Terms, false, true),
	route('/privacy', null, Landing, Privacy, false, true),
	route('/credits', null, Landing, Credits, false, true),
	route('/welcome', null, Landing, Welcome, false, true),

	// Public
	route('/solve/:shareCode', null, App, SolvePage, false, false, false, false, false, [prefetchSolveData]),
	route('/user/:username', null, App, Profile, false, false, false, false, false, [prefetchProfileData]),
	route('/unsub-emails', null, App, UnsubEmails, false, true, false, true, false),

	// Trainer
	route('/trainer', null, App, Trainer, false),

	// Account
	route('/account/personal-info', App, Account, PersonalInfo),
	route('/account/danger-zone', App, Account, DangerZone),
	route('/account/password', App, Account, Password),
	route('/account/linked-accounts', App, Account, LinkedAccounts),
	route('/account/notifications', App, Account, NotificationPreferences),
	route('/account/announcements', App, Account, AnnouncementHistory),

	// Community
	route('/community/leaderboards', App, Community, EloBoard, false),
	route('/community/friends/list', App, Community, Friends),
	route('/community/friends/received', App, Community, Friends),
	route('/community/friends/sent', App, Community, Friends),

	// Play
	route('/play', App, PlayWrapper, Play, false),
	route('/play/elimination', App, PlayWrapper, Elimination),
	route('/play/elimination/:linkCode', App, PlayWrapper, Elimination),
	route('/play/head-to-head', App, PlayWrapper, HeadToHead),
	route('/play/head-to-head/:linkCode', App, PlayWrapper, HeadToHead),

	// Friendly Rooms
	route('/rooms', null, App, RoomsList, false),
	route('/rooms/:roomId', null, App, FriendlyRoom, false),

	// Admin
	route('/admin/reports', App, Admin, Reports, true, false, true),
	route('/admin/users', App, Admin, AdminUsers, true, false, true),
	route('/admin/announcements', App, Admin, AdminAnnouncements, true, false, true),

	// OAuth
	route('/oauth/:integrationType', null, App, OAuthService, true, true, false, true),

	// Redirects
	routeRedirect('/m/elimination/:linkCode', '/play/elimination/:linkCode'),
	routeRedirect('/m/head-to-head/:linkCode', '/play/head-to-head/:linkCode'),
	routeRedirect('/settings', '/settings/timer'),
	routeRedirect('/account', '/account/personal-info'),
	routeRedirect('/community/friends', '/community/friends/list'),
	routeRedirect('/community', '/community/leaderboards'),
	routeRedirect('/admin', '/admin/reports'),
];
