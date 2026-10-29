import React from 'react';
import App from './App';
import Sessions from '../sessions/Sessions';
import Stats from '../stats/Stats';
import LoginWrapper from '../login/LoginWrapper';
import Trainer from '../trainer/Trainer';
import Account from '../account/Account';
import DangerZone from '../account/danger_zone/DangerZone';
import PersonalInfo from '../account/personal_info/PersonalInfo';
import Community from '../community/Community';

import Solves from '../solves/SolvesList';
import Messages from '../messages/Messages';
import Profile, { prefetchProfileData } from '../profile/Profile';
import Admin from '../admin/Admin';
import SolvePage, { prefetchSolveData, solveSsrMeta } from '../solve_page/SolvePage';
import { prefetchAlgSetMeta, algSetSsrMeta } from '../trainer/sets/ssr';
import NotificationPreferences from '../account/notification_preferences/NotificationPreferences';
import SocialSettings from '../account/social/SocialSettings';

import Privacy from '../landing/legal/Privacy';
import Terms from '../landing/legal/Terms';
import Credits from '../landing/legal/Credits';
import Help from '../help/Help';
import Landing from '../landing/Landing';

import SettingsPage from '../settings/page/SettingsPage';
import TimerSettings from '../settings/timer/TimerSettings';
import InputSettings from '../settings/input/InputSettings';
import SmartCubeSettings from '../settings/smart_cube/SmartCubeSettings';
import ScrambleSettings from '../settings/scramble/ScrambleSettings';
import Appearance from '../settings/appearance/Appearance';
import CubeColors from '../settings/colors/CubeColors';
import DataSettings from '../settings/data/DataSettings';
import LanguageSettings from '../settings/language/LanguageSettings';
import MyCubes from '../settings/cubes/MyCubes';
import CubeProfile from '../settings/cubes/CubeProfile';
import MagnetCalibrate from '../magnet/calibrate/MagnetCalibrate';
import LinkedAccounts from '../account/linked_accounts/LinkedAccounts';
import OAuthService from '../oauth/OAuthService';
import WcaLoginCallback from '../oauth/WcaLoginCallback';
import ZktLoginCallback from '../oauth/ZktLoginCallback';
import NativeMigrate from '../native_migrate/NativeMigrate';
import ForceSignOut from '../login/force_sign_out/ForceSignOut';
import AnnouncementHistory from '../profile/AnnouncementHistory';
import Support from '../account/support/Support';
import type { Store } from 'redux';
// Type-only: without this `Request` resolved to the DOM's global Request, which has
// no `params`, so every prefetch/ssrMeta signature was silently wrong. Erased at
// build time, so express never enters the client bundle.
import type { Request } from 'express';
import Reports from '../admin/reports/Reports';
import AdminDashboard from '../admin/dashboard/AdminDashboard';
import DefaultTimer from '../timer/DefaultTimer';
import AdminUsers from '../admin/users/AdminUsers';
import AdminProUsers from '../admin/pro_users/AdminProUsers';
import UnsubEmails from '../unsub/UnsubEmails';

import RoomsList from '../rooms/RoomsList';
import FriendlyRoom from '../rooms/FriendlyRoom';
import AdminAnnouncements from '../admin/announcements/AdminAnnouncements';
import AdminEmail from '../admin/email/AdminEmail';
import AdminAlgorithms from '../admin/algorithms/AdminAlgorithms';
import AdminPromoCodes from '../admin/promo_codes/AdminPromoCodes';
import SiteConfigPanel from '../admin/site_config/SiteConfigPanel';
import SmartCubeTelemetryPanel from '../admin/smart_cube_telemetry/SmartCubeTelemetryPanel';
import MagnetTelemetryPanel from '../admin/magnet_telemetry/MagnetTelemetryPanel';
import AdminBattleMatches from '../admin/battle/AdminBattleMatches';
import AdminMedia from '../admin/media/AdminMedia';
import AdminRegistrationWatch from '../admin/registration_watch/AdminRegistrationWatch';
import Welcome from '../landing/welcome/Welcome';
import RootRedirect from '../landing/root_redirect/RootRedirect';
import ProPage from '../pro_page/ProPage';
import Battle from '../battle/Battle';
import BattleLanding from '../battle/BattleLanding';
import OnlineBattle from '../battle/online/OnlineBattle';
import DuelPage from '../battle/online/DuelPage';
import { prefetchDuelMeta, duelSsrMeta } from '../battle/online/duel_ssr';
import MySchedule from '../community/my_schedule/MySchedule';
import Rankings from '../rankings/Rankings';
import LinksPage from '../links/LinksPage';

/**
 * Page-specific tags for the server-rendered <head>.
 *
 * App gates its route children behind `appLoaded`, which is always false on the
 * server, so a page's own <Header> never runs during SSR and its Helmet tags never
 * reach the HTML. Link-preview crawlers (WhatsApp, Facebook, X) do not execute JS,
 * so without this they only ever see the site-wide defaults. Routes that prefetch
 * data can return their real title/description/image here instead.
 */
export interface SsrMeta {
	title?: string;
	description?: string;
	image?: string;
}

export type SsrMetaFn = (store: Store<any>, req: Request, t: (key: string, vars?: any) => string) => SsrMeta | null;

interface PageOptions {
	restricted: boolean;
	standalone: boolean;
	admin: boolean;
	hideTopNav: boolean;
	noPadding: boolean;
	prefetchData: ((store: Store<any>, req: Request) => Promise<any>)[];
	ssrMeta?: SsrMetaFn;
}

export interface PageContext extends PageOptions {
	path: string;
	grandparent: any;
	parent: any;
	child: any;
	/**
	 * Shared React key for routes that render the same component across multiple paths.
	 * When set, the <Switch>-rendered <Route> keeps a stable identity across intra-group
	 * navigation, so the component tree is NOT remounted (state preserved). Used by the
	 * trainer routes so e.g. /trainer/algorithms -> /trainer/algorithms/train does not reset state.
	 */
	groupKey?: string;
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
	prefetchData = null,
	ssrMeta: SsrMetaFn = null
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
		ssrMeta,
	};
}

function routeRedirect(path: string, redirect: string): RedirectPath {
	return {
		path,
		redirect,
	};
}

/**
 * Trainer routes all render <Trainer> and must share a single mount group so that
 * navigating between modes/sub-views (e.g. /trainer/algorithms -> /trainer/algorithms/train)
 * does NOT remount the tree and wipe TrainerProvider state. The shared groupKey gives the
 * <Switch>-rendered <Route> a stable React key across these paths.
 */
// Open by default: the trainer works entirely on local data, and a visitor who
// cannot try it has no way to judge it.
// `prefetchData` + `ssrMeta` are for the shared set page: its link preview is the only part of
// the trainer the server renders (the trainer body waits for `app_loaded`).
function trainerRoute(
	path: string,
	restricted = false,
	prefetchData: PageOptions['prefetchData'] = null,
	ssrMeta: SsrMetaFn = null
): PageContext {
	const r = route(path, null, App, Trainer, restricted, false, false, false, false, prefetchData, ssrMeta);
	r.groupKey = 'trainer-shell';
	return r;
}

// Order by importance (at least the public routes)
export const routes: (PageContext | RedirectPath)[] = [
	// Main tabs
	route('/', null, RootRedirect, null, false, true),
	// Open to visitors without an account. Their solves stay on the device: the server
	// write path is gated on `canWriteSync()` (= !!me), so nothing leaves the browser
	// until they sign up and accept the transfer.
	route('/timer', null, App, DefaultTimer, false, false, false, false, true),
	route('/signup', null, App, LoginWrapper, false, true, false, true),
	route('/login', null, App, LoginWrapper, false, true, false, true),
	route('/forgot', null, App, LoginWrapper, false, true, false, true),
	route('/verify-email', null, App, LoginWrapper, false, true, false, true),
	route('/wca-signup', null, App, LoginWrapper, false, true, false, true),
	route('/zkt-signup', null, App, LoginWrapper, false, true, false, true),
	route('/sessions', null, App, Sessions, false),
	route('/solves', null, App, Solves, false),
	// Reachable without an account on purpose: the page itself renders the
	// account-required panel. Bouncing to /login instead told the visitor nothing
	// about what they were reaching for.
	route('/stats', null, App, Stats, false),
	route('/messages', null, App, Messages),
	route('/messages/:conversationId', null, App, Messages),
	route('/force-log-out', null, App, ForceSignOut, false, true, false, true),

	// Settings. `/settings` is the section index: on mobile the layout shows only the
	// nav list, on desktop it mounts the same child as /settings/timer rather than
	// redirecting. Open to visitors without an account — the timer works signed out,
	// so its settings have to as well. The Data section gates itself.
	route('/settings', App, SettingsPage, TimerSettings, false),
	route('/settings/timer', App, SettingsPage, TimerSettings, false),
	route('/settings/input', App, SettingsPage, InputSettings, false),
	// My Cubes needs an account (cubes live on the server); a visitor is sent to log in.
	route('/settings/cubes', App, SettingsPage, MyCubes),
	route('/settings/cubes/:id', App, SettingsPage, CubeProfile),
	route('/settings/smart-cube', App, SettingsPage, SmartCubeSettings, false),
	route('/settings/scramble', App, SettingsPage, ScrambleSettings, false),
	route('/settings/appearance', App, SettingsPage, Appearance, false),
	route('/settings/colors', App, SettingsPage, CubeColors, false),
	route('/settings/data', App, SettingsPage, DataSettings, false),
	route('/settings/language', App, SettingsPage, LanguageSettings, false),

	// Landing Pages
	// route('/how-to-solve', null, Landing, HTSLanding, false, false, false, false, true),
	// route('/how-to-solve/:stepId', null, Landing, HTSLearn, false, false, false, false, true),
	route('/terms', null, Landing, Terms, false, true),
	route('/privacy', null, Landing, Privacy, false, true),
	route('/credits', null, Landing, Credits, false, true),
	// Its own shell (page as parent, like RootRedirect). Not the App shell: that one
	// paints a LoadingCover on the server and fills in on the client, which would hand
	// Google an empty page — and this is an organic-search entry point. Not the landing
	// shell either: that one always says "log in / sign up" and paints a fixed dark
	// ground, so a signed-in reader felt thrown out of the product. Help renders the
	// real app nav itself instead.
	route('/help', null, Help, null, false, true),
	route('/welcome', null, Landing, Welcome, false, true),
	// Link-in-bio page for the social accounts (web app + both stores). Not in any menu,
	// noindexed in Header. Own shell like /help, so the buttons are in the SSR HTML.
	route('/links', null, LinksPage, null, false, true),

	// Public
	route('/solve/:shareCode', null, App, SolvePage, false, false, false, false, false, [prefetchSolveData], solveSsrMeta),
	route('/user/:username', null, App, Profile, false, false, false, false, false, [prefetchProfileData]),
	route('/unsub-emails', null, App, UnsubEmails, false, true, false, true, false),

	// Pro — standalone page (not nested under Account). noPadding: ProPage manages its own
	// safe-area in &__mobile-header; Wrapper padding would double-count the notch inset.
	route('/pro', null, App, ProPage, false, false, false, false, true),

	// Trainer — deep-linkable (her derinlik explicit, exact match; hepsi child=Trainer).
	// Spesifik-once: client <Switch> ilk eslesen route'u render eder.
	// Algorithm Trainer (Standard and Smart Cube in one, the study mode is `?mode=smart`).
	// The old /trainer/standard* and /trainer/smart* addresses are routeRedirect rows below.
	trainerRoute('/trainer/algorithms/train'),
	trainerRoute('/trainer/algorithms'),
	// The Trainers page (Algorithm Trainer, PLL Recognition, Cross and XCross).
	trainerRoute('/trainer/modes'),
	// Algorithm Sets, a section of their own next to the trainers: My Sets, Community Sets and
	// one set's page. The old /trainer/algorithms/sets and /community tabs are redirect rows below.
	// Open to visitors: a public or link-shared set is readable signed out (the access rule is
	// the server's), only studying and saving ask for an account (inside the page).
	trainerRoute('/trainer/sets'),
	trainerRoute('/trainer/community'),
	trainerRoute('/trainer/sets/:code/add'),
	trainerRoute('/trainer/sets/:code', false, [prefetchAlgSetMeta], algSetSsrMeta),
	trainerRoute('/trainer/recognition/setup'),
	trainerRoute('/trainer/recognition/train'),
	trainerRoute('/trainer/recognition/results'),
	trainerRoute('/trainer/recognition/history'),
	trainerRoute('/trainer/recognition/settings'),
	trainerRoute('/trainer/recognition/glossary'),
	trainerRoute('/trainer/recognition'),
	trainerRoute('/trainer/efficiency/settings'),
	trainerRoute('/trainer/efficiency'),
	trainerRoute('/trainer/ollcp/train'),
	trainerRoute('/trainer/ollcp/detail'),
	trainerRoute('/trainer/ollcp'),
	// Trainer landing (mode selection) is public for SEO — anon visitors see the cards,
	// but selecting a mode requires login (handled in TrainerLanding + restricted sub-routes).
	trainerRoute('/trainer', false),

	// Account
	// `/account` is the section index. On mobile the layout shows only the nav list
	// there; on desktop it renders the first section alongside the sidebar, so it
	// mounts the same child as /account/personal-info rather than redirecting.
	route('/account', App, Account, PersonalInfo),
	route('/account/personal-info', App, Account, PersonalInfo),
	route('/account/danger-zone', App, Account, DangerZone),
	route('/account/linked-accounts', App, Account, LinkedAccounts),
	route('/account/notifications', App, Account, NotificationPreferences),
	route('/account/social', App, Account, SocialSettings),
	route('/account/announcements', App, Account, AnnouncementHistory),
	route('/account/support', App, Account, Support),

	// Community - WCA Competitions (public for SEO, public data)
	route('/competitions/:competitionId/personal-bests/:wcaId', App, Community, MySchedule, false),
	route('/competitions/:competitionId/persons/:registrantId/results', App, Community, MySchedule, false),
	route('/competitions/:competitionId/persons/:registrantId', App, Community, MySchedule, false),
	route('/competitions/:competitionId/activities/:activityCode', App, Community, MySchedule, false),
	route('/competitions/:competitionId/wca-live/:eventId/:roundNumber', App, Community, MySchedule, false),
	route('/competitions/:competitionId/wca-live/:eventId', App, Community, MySchedule, false),
	route('/competitions/:competitionId/wca-live', App, Community, MySchedule, false),
	// Record radar — must precede the :competitionId param route so "records" is
	// not treated as a competition id.
	route('/competitions/records', App, Community, MySchedule, false),
	route('/competitions/:competitionId', App, Community, MySchedule, false),
	route('/competitions', App, Community, MySchedule, false),

	// Rankings
	route('/ranks', null, App, Rankings, false),

	// Battle (ranking-battle 5.1). /battle is the two-card landing once Online Battle is open
	// to the user, and the offline battle itself until then. No shared groupKey: moving from
	// the landing into a mode is meant to mount it fresh.
	route('/battle', null, App, BattleLanding, false, false, false, false, true),
	route('/battle/offline', null, App, Battle, false, false, false, false, true),
	// Queue, match and result. The page gates sign-in itself (account panel) and is null on the server.
	route('/battle/online', null, App, OnlineBattle, false, false, false, true, true),
	// Duel invite (Online Battle without rating). Open to visitors so the invited player sees who
	// invites them; the page gates accepting itself. SSR only renders the link preview's head tags.
	route('/duel/:code', null, App, DuelPage, false, false, false, true, true, [prefetchDuelMeta], duelSsrMeta),

	// Magnet calibration of a cube on this phone (`?cube=<id>`). Full page, account required.
	route('/magnet/calibrate', null, App, MagnetCalibrate),

	// Friendly Rooms
	// Same as /stats: the page opens and explains, RoomsList gates its own content.
	route('/rooms', null, App, RoomsList, false),
	route('/rooms/:roomId', null, App, FriendlyRoom),

	// Admin
	route('/admin/dashboard', App, Admin, AdminDashboard, true, false, true),
	route('/admin/reports', App, Admin, Reports, true, false, true),
	route('/admin/users', App, Admin, AdminUsers, true, false, true),
	route('/admin/pro-users', App, Admin, AdminProUsers, true, false, true),
	route('/admin/announcements', App, Admin, AdminAnnouncements, true, false, true),
	route('/admin/email', App, Admin, AdminEmail, true, false, true),
	route('/admin/algorithms', App, Admin, AdminAlgorithms, true, false, true),
	route('/admin/promo-codes', App, Admin, AdminPromoCodes, true, false, true),
	route('/admin/site-config', App, Admin, SiteConfigPanel, true, false, true),
	route('/admin/media', App, Admin, AdminMedia, true, false, true),
	route('/admin/smart-telemetry', App, Admin, SmartCubeTelemetryPanel, true, false, true),
	route('/admin/magnet-telemetry', App, Admin, MagnetTelemetryPanel, true, false, true),
	route('/admin/online-battle', App, Admin, AdminBattleMatches, true, false, true),
	route('/admin/registration-watch', App, Admin, AdminRegistrationWatch, true, false, true),

	// OAuth
	route('/oauth/wca/login', null, App, WcaLoginCallback, false, true, false, true),
	// Must stay ABOVE /oauth/:integrationType — that wildcard would otherwise
	// swallow this path and try to LINK an account instead of signing one in.
	route('/oauth/zkt/login', null, App, ZktLoginCallback, false, true, false, true),
	// NOT restricted: the native relay renders this page in the EXTERNAL browser with
	// no session — SSR 401 would eat the OAuth code. createIntegration enforces auth
	// server-side, so an unauthenticated web visitor still can't link anything.
	route('/oauth/:integrationType', null, App, OAuthService, false, true, false, true),
	// One-time Faz 2 data bridge: runs on the old origin inside the app WebView
	route('/native-migrate', null, NativeMigrate, null, false, true, false, true),

	// Redirects
	routeRedirect('/account/pro', '/pro'),
	routeRedirect('/account/password', '/account/personal-info'),
	// Legacy /community/competitions/* (WCA) -> /competitions/* (param-preserving 301).
	routeRedirect('/community/competitions/:competitionId/personal-bests/:wcaId', '/competitions/:competitionId/personal-bests/:wcaId'),
	routeRedirect('/community/competitions/:competitionId/persons/:registrantId/results', '/competitions/:competitionId/persons/:registrantId/results'),
	routeRedirect('/community/competitions/:competitionId/persons/:registrantId', '/competitions/:competitionId/persons/:registrantId'),
	routeRedirect('/community/competitions/:competitionId/activities/:activityCode', '/competitions/:competitionId/activities/:activityCode'),
	routeRedirect('/community/competitions/:competitionId/wca-live/:eventId/:roundNumber', '/competitions/:competitionId/wca-live/:eventId/:roundNumber'),
	routeRedirect('/community/competitions/:competitionId/wca-live/:eventId', '/competitions/:competitionId/wca-live/:eventId'),
	routeRedirect('/community/competitions/:competitionId/wca-live', '/competitions/:competitionId/wca-live'),
	routeRedirect('/community/competitions/:competitionId', '/competitions/:competitionId'),
	routeRedirect('/community/competitions', '/competitions'),
	// The old standalone ZKT view (E-107). A ZKT competition lives on the shared page as
	// /competitions/zkt-<slug>; links already sent in notifications land there. Its
	// :competitionId is the bare slug, its competitor id the registration number (the
	// WCIF registrantId). A federation group id has no counterpart, so an activity link
	// opens the competition.
	...['/zkt-competitions', '/community/zkt-competitions'].flatMap((base) => [
		routeRedirect(`${base}/:competitionId/competitors/:userId`, '/competitions/zkt-:competitionId/persons/:userId'),
		routeRedirect(`${base}/:competitionId/activities/:groupId`, '/competitions/zkt-:competitionId'),
		routeRedirect(`${base}/:competitionId/live/:eventId/:roundNumber`, '/competitions/zkt-:competitionId/wca-live/:eventId/:roundNumber'),
		routeRedirect(`${base}/:competitionId/live/:eventId`, '/competitions/zkt-:competitionId/wca-live/:eventId'),
		routeRedirect(`${base}/:competitionId/live`, '/competitions/zkt-:competitionId/wca-live'),
		routeRedirect(`${base}/:competitionId`, '/competitions/zkt-:competitionId'),
	]),
	routeRedirect('/community/friends', '/competitions'),
	routeRedirect('/community', '/competitions'),
	routeRedirect('/admin', '/admin/dashboard'),
	// Standard and Smart Cube became one Algorithm Trainer. The incoming query is kept
	// (`?cat=pll` survives), the target's `mode` wins (shared/redirect_query.ts).
	routeRedirect('/trainer/standard/train', '/trainer/algorithms/train'),
	routeRedirect('/trainer/standard', '/trainer/algorithms'),
	routeRedirect('/trainer/smart/train', '/trainer/algorithms/train?mode=smart'),
	routeRedirect('/trainer/smart', '/trainer/algorithms?mode=smart'),
	routeRedirect('/trainer/algorithms/sets', '/trainer/sets'),
	routeRedirect('/trainer/algorithms/community', '/trainer/community'),
];
