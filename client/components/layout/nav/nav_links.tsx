// The app's navigation links. Only the leaderboard entry is gated on site flags (launchOnly).
//
// Extracted from Nav.tsx when that component was deleted: the sidebar it drew had not
// been mounted anywhere in a long time, but HeaderNav and NavLink still read this list
// out of it. Keeping the data here means the header owns no copy of it either.

import React from 'react';
import {
	ChatCircleDots,
	Handshake,
	ChartPie,
	LadderSimple,
	Users,
	ListBullets,
	Rows,
	Timer,
	Sword,
	Trophy,
} from 'phosphor-react';


export interface NavLinkProps {
	name: string;
	icon: React.ReactElement;
	match: RegExp;
	link: string;
	newTag?: boolean;
	loginRequired?: boolean;
	mobileOnly?: boolean;
	/**
	 * Shown only once Online Battle is public: `leaderboards_enabled && online_battle_enabled`
	 * (ranking-battle S-6, 7.1 step 7). Admins do not bypass it; they reach the page by URL.
	 */
	launchOnly?: boolean;
}

/** The links a menu draws: the launch-gated ones only after launch (null = not known yet). */
export function visibleNavLinks(links: NavLinkProps[], launched: boolean | null | undefined): NavLinkProps[] {
	return launched === true ? links : links.filter((link) => !link.launchOnly);
}

export const NAV_LINKS: NavLinkProps[] = [
	{
		name: 'nav.timer',
		icon: <Timer weight="bold" />,
		match: /(^\/$|^$|^\/timer)/,
		link: '/timer',
	},
	{
		name: 'nav.battle',
		icon: <Sword weight="bold" />,
		match: /^\/battle/,
		link: '/battle',
		loginRequired: false,
		// No mobileOnly flag: battle used to refuse to render above 750px, so a desktop link
		// would have led to a blank page. It now scales to the viewport, and the desktop header
		// filters this flag out (HeaderNav), which would otherwise leave the page reachable only
		// by typing the URL.
	},
	{
		name: 'nav.sessions',
		icon: <Rows weight="bold" />,
		match: /^\/sessions/,
		link: '/sessions',
		loginRequired: true,
	},
	{
		name: 'nav.solves',
		icon: <ListBullets weight="bold" />,
		match: /^\/solves/,
		link: '/solves',
		loginRequired: false,
	},
	{
		name: 'nav.stats',
		icon: <ChartPie weight="bold" />,
		match: /^\/stats/,
		link: '/stats',
		loginRequired: true,
	},
	{
		name: 'nav.rooms',
		icon: <Handshake weight="bold" />,
		match: /^\/rooms/,
		link: '/rooms',
		loginRequired: true,
	},
	{
		name: 'nav.trainer',
		icon: <LadderSimple weight="bold" />,
		match: /^\/trainer/,
		link: '/trainer',
		loginRequired: true,
	},
	{
		name: 'nav.community',
		icon: <Users weight="bold" />,
		// The section left /community for /competitions (WCA) and /zkt-competitions (ZKT);
		// the old prefix only survives as redirects (Routes.ts).
		match: /^\/(competitions|zkt-competitions)(\/|$)/,
		link: '/competitions',
		loginRequired: false,
	},
	// The Online Battle leaderboard. Hidden until launch (S-6): before that /ranks is an empty state.
	{
		name: 'nav.ranks',
		icon: <Trophy weight="bold" />,
		match: /^\/ranks/,
		link: '/ranks',
		loginRequired: false,
		launchOnly: true,
	},
	// Mobile only: the desktop header carries its own inbox icon, but HeaderNav renders
	// nothing in mobile mode, which left messages with no entry point on phones at all.
	{
		name: 'nav.messages',
		icon: <ChatCircleDots weight="bold" />,
		match: /^\/messages/,
		link: '/messages',
		loginRequired: true,
		mobileOnly: true,
	},
];
