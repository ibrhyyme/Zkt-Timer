// The app's navigation links, and the SiteConfig feature flag each one is gated on.
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


// Nav link adi → SiteConfig feature key
const NAV_FEATURE_MAP: Record<string, string> = {
	'nav.trainer': 'trainer_enabled',
	'nav.community': 'community_enabled',
	'nav.rooms': 'rooms_enabled',
	'nav.battle': 'battle_enabled',
	'nav.ranks': 'leaderboards_enabled',
};

export interface NavLinkProps {
	name: string;
	icon: React.ReactElement;
	match: RegExp;
	link: string;
	newTag?: boolean;
	loginRequired?: boolean;
	mobileOnly?: boolean;
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
		mobileOnly: true,
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
		match: /^\/community/,
		link: '/competitions',
		loginRequired: false,
	},
	{
		name: 'nav.ranks',
		icon: <Trophy weight="bold" />,
		match: /^\/ranks/,
		link: '/ranks',
		loginRequired: false,
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
