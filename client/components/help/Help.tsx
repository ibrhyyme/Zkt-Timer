// Public help page: a single scrolling document with a sticky section list.
//
// Two content sources, on purpose. The guide sections are written for someone who
// already has the app open ("where is that button"), and live under `help.sections`.
// The FAQ at the bottom reuses `seo.faq`, which also feeds the FAQPage structured
// data — Google requires that markup to match content a reader can actually see,
// and before this page existed those answers were published to search engines only.

import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import {
	Compass,
	Timer,
	ListChecks,
	ChartLine,
	GraduationCap,
	Cube,
	DeviceMobile,
	UsersThree,
	Sword,
	ChatCircleText,
	Trophy,
	UserCircle,
	IdentificationCard,
	Database,
	Keyboard,
	Question,
	MagnifyingGlass,
} from 'phosphor-react';
import './Help.scss';
import block from '../../styles/bem';
import Header from '../layout/header/Header';
import PageTitle from '../common/page_title/PageTitle';
import HeaderNav from '../layout/header_nav/HeaderNav';
import HelpNav from './HelpNav';
import {DesktopLayoutDiagram, MobileNotchDiagram} from './diagrams/LayoutDiagrams';
import {useScrollSpy} from '../../util/hooks/useScrollSpy';
import {useMobileModeSync} from '../../util/hooks/useMobileModeSync';
// Deliberately the small dependency-free modules, not the screens that own these lists:
// this page is server-rendered, and importing the settings UI, the parsers or the BLE
// stack to read three constants would drag all of it into the SSR path.
import {TIMER_INPUT_TYPE_KEYS} from '../settings/hardware/timer_input_types';
import {SUPPORTED_SMART_CUBE_BRANDS} from '../timer/smart_cube/bluetooth/supported_cubes';
import {IMPORT_TYPE_NAMES} from '../settings/data/import_data/import_sources';

const b = block('landing-help');

// Cube-face tones, same idea as AccountNav: after a couple of visits the colour is
// what you aim for, so the list is scannable without reading every label.
const TONE = {
	blue: '36, 107, 253',
	green: '45, 189, 97',
	yellow: '245, 183, 0',
	violet: '167, 139, 255',
	orange: '238, 106, 38',
	cyan: '0, 176, 209',
	red: '226, 51, 67',
};

type Extra =
	| 'desktop-diagram'
	| 'mobile-diagram'
	| 'shortcuts'
	| 'timer-types'
	| 'cube-brands'
	| 'import-sources'
	| 'faq';

// Three inventories the page used to spell out in prose, in five files each. They are
// read from the code that owns them instead, so the page cannot fall behind the app:
// the smart-cube list had already lost five brands that way.
const TIMER_TYPE_IDS = Object.keys(TIMER_INPUT_TYPE_KEYS) as (keyof typeof TIMER_INPUT_TYPE_KEYS)[];
const CUBE_BRANDS = SUPPORTED_SMART_CUBE_BRANDS.map((entry) => entry.brand);
const IMPORT_SOURCES = Object.values(IMPORT_TYPE_NAMES);

interface SectionDef {
	id: string;
	tone: string;
	icon: React.ReactNode;
	extra?: Extra;
}

// Bare icons, no chip and no glow — they label the card, they are not its decoration.
// Same call SettingsCard made after its effect-heavy version read as a template.
const SECTIONS: SectionDef[] = [
	{id: 'getting-started', tone: TONE.blue, icon: <Compass weight="fill" />, extra: 'desktop-diagram'},
	{id: 'timer', tone: TONE.green, icon: <Timer weight="fill" />, extra: 'timer-types'},
	{id: 'solves', tone: TONE.yellow, icon: <ListChecks weight="fill" />},
	{id: 'stats', tone: TONE.violet, icon: <ChartLine weight="fill" />},
	{id: 'trainer', tone: TONE.orange, icon: <GraduationCap weight="fill" />},
	{id: 'smart-cube', tone: TONE.cyan, icon: <Cube weight="fill" />, extra: 'cube-brands'},
	{id: 'mobile', tone: TONE.red, icon: <DeviceMobile weight="fill" />, extra: 'mobile-diagram'},
	{id: 'rooms', tone: TONE.green, icon: <UsersThree weight="fill" />},
	{id: 'battle', tone: TONE.red, icon: <Sword weight="fill" />},
	{id: 'messages', tone: TONE.yellow, icon: <ChatCircleText weight="fill" />},
	{id: 'competitions', tone: TONE.blue, icon: <Trophy weight="fill" />},
	{id: 'profile', tone: TONE.violet, icon: <UserCircle weight="fill" />},
	{id: 'account', tone: TONE.cyan, icon: <IdentificationCard weight="fill" />},
	{id: 'data', tone: TONE.violet, icon: <Database weight="fill" />, extra: 'import-sources'},
	{id: 'shortcuts', tone: TONE.orange, icon: <Keyboard weight="fill" />, extra: 'shortcuts'},
	{id: 'faq', tone: TONE.cyan, icon: <Question weight="fill" />, extra: 'faq'},
];

// Keys are universal, only the descriptions get translated. Every row below was read
// out of the source, not assumed: HOTKEY_MAP in client/util/timer/hotkeys.js, its
// handlers in modules/history/History.tsx and timer/header_control/HeaderControl.tsx,
// and the space/Escape/Backspace paths in timer/key_watcher/KeyWatcher.tsx.
const SHORTCUTS: {id: string; keys: string[]; danger?: boolean}[] = [
	{id: 'space', keys: ['Space']},
	{id: 'escape', keys: ['Esc']},
	{id: 'ok', keys: ['1']},
	{id: 'plus_two', keys: ['2']},
	{id: 'dnf', keys: ['3']},
	{id: 'delete_last', keys: ['Alt', 'Z']},
	{id: 'delete_session', keys: ['Ctrl', 'Backspace'], danger: true},
	{id: 'inspection', keys: ['Alt', 'I']},
	{id: 'cube_nxn', keys: ['Alt', '2 … 7']},
	{id: 'cube_other', keys: ['Alt', 'P / M / C / S']},
];

type Translate = (key: string, opts?: any) => any;

/** Case-insensitive substring match across a set of strings. */
function matchesQuery(query: string, haystack: string[]): boolean {
	if (!query) return true;
	const needle = query.toLocaleLowerCase();
	return haystack.some((text) => (text || '').toLocaleLowerCase().includes(needle));
}

function sectionStrings(def: SectionDef, t: Translate): string[] {
	const list = (part: string): string[] => {
		const raw = t(`help.sections.${def.id}.${part}`, {returnObjects: true, defaultValue: []});
		return Array.isArray(raw) ? (raw as string[]) : [];
	};

	const out = [t(`help.sections.${def.id}.title`), ...list('body'), ...list('steps'), ...list('notes')];

	// The rows below live in code, not in the section's own keys, so a search for
	// "Escape", "GoCube" or "Twisty Timer" would otherwise miss the card that answers it.
	if (def.extra === 'shortcuts') {
		out.push(...SHORTCUTS.map((row) => `${row.keys.join(' ')} ${t(`help.shortcuts.${row.id}`)}`));
	}
	if (def.extra === 'timer-types') {
		out.push(
			...TIMER_TYPE_IDS.map((id) => `${t(TIMER_INPUT_TYPE_KEYS[id])} ${t(`help.timer_types.${id}`)}`)
		);
	}
	if (def.extra === 'cube-brands') {
		out.push(...CUBE_BRANDS);
	}
	if (def.extra === 'import-sources') {
		out.push(...IMPORT_SOURCES);
	}
	return out;
}

/** Whether a card survives the current query. FAQ also matches on its own rows. */
function sectionMatches(def: SectionDef, faq: FaqEntry[], query: string, t: Translate): boolean {
	if (!query) return true;
	if (matchesQuery(query, sectionStrings(def, t))) return true;
	return def.extra === 'faq' && faq.some((item) => matchesQuery(query, [item.q, item.a]));
}

interface FaqEntry {
	id: string;
	q: string;
	a: string;
}

function Section(props: {def: SectionDef; faq: FaqEntry[]; query: string}) {
	const {def, faq, query} = props;
	const {t} = useTranslation();

	// A section declares only the parts it has; a missing `steps` or `notes` key
	// resolves to an empty list rather than rendering the raw key path.
	const list = (part: string): string[] => {
		const raw = t(`help.sections.${def.id}.${part}`, {returnObjects: true, defaultValue: []});
		return Array.isArray(raw) ? (raw as string[]) : [];
	};

	const title = t(`help.sections.${def.id}.title`);
	const body = list('body');
	const steps = list('steps');
	const notes = list('notes');

	// Whether this card shows at all is decided by the page (see sectionMatches).
	// What is left here is trimming the FAQ's own rows down to the matches, so a
	// search does not open a card of 33 questions to show the one that hit.
	const visibleFaq =
		def.extra === 'faq' && query ? faq.filter((item) => matchesQuery(query, [item.q, item.a])) : faq;

	return (
		<section id={def.id} className={b('section')} style={{'--section-tone': def.tone} as React.CSSProperties}>
			<header className={b('section-header')}>
				<span className={b('section-icon')}>{def.icon}</span>
				<h2 className={b('section-title')}>{title}</h2>
			</header>

			{body.map((paragraph, i) => (
				<p key={i} className={b('paragraph')}>
					{paragraph}
				</p>
			))}

			{def.extra === 'desktop-diagram' ? <DesktopLayoutDiagram /> : null}
			{def.extra === 'mobile-diagram' ? <MobileNotchDiagram /> : null}

			{steps.length > 0 ? (
				<ol className={b('steps')}>
					{steps.map((step, i) => (
						<li key={i} className={b('step')}>
							<span className={b('step-index')} aria-hidden="true">
								{i + 1}
							</span>
							<span className={b('step-text')}>{step}</span>
						</li>
					))}
				</ol>
			) : null}

			{def.extra === 'timer-types' ? (
				<div className={b('table-wrap')}>
					<table className={b('table')}>
						<tbody>
							{TIMER_TYPE_IDS.map((id) => (
								<tr key={id}>
									<td className={b('table-name')}>{t(TIMER_INPUT_TYPE_KEYS[id])}</td>
									<td className={b('table-desc')}>{t(`help.timer_types.${id}`)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			{def.extra === 'cube-brands' || def.extra === 'import-sources' ? (
				<ul className={b('chips')}>
					{(def.extra === 'cube-brands' ? CUBE_BRANDS : IMPORT_SOURCES).map((name) => (
						<li key={name} className={b('chip')}>
							{name}
						</li>
					))}
				</ul>
			) : null}

			{def.extra === 'shortcuts' ? (
				<div className={b('table-wrap')}>
					<table className={b('table')}>
						<tbody>
							{SHORTCUTS.map((row) => (
								<tr key={row.id}>
									<td className={b('table-keys')}>
										{row.keys.map((key, i) => (
											<React.Fragment key={key}>
												{i > 0 ? <span className={b('key-plus')}>+</span> : null}
												<kbd className={b('key')}>{key}</kbd>
											</React.Fragment>
										))}
									</td>
									<td className={b('table-desc', {danger: row.danger})}>
										{t(`help.shortcuts.${row.id}`)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			{def.extra === 'faq'
				? visibleFaq.map((item) => (
						<details key={item.id} className={b('faq-item')}>
							<summary className={b('faq-question')}>{item.q}</summary>
							<div className={b('faq-answer')}>{item.a}</div>
						</details>
				  ))
				: null}

			{notes.map((note, i) => (
				<p key={i} className={b('note')}>
					{note}
				</p>
			))}
		</section>
	);
}

export default function Help() {
	const {t} = useTranslation();
	const location = useLocation();

	// The landing shell never sets this, and the drawer notches are gated on it.
	useMobileModeSync();

	const [query, setQuery] = useState('');
	const trimmedQuery = query.trim();

	const rawFaq = t('seo.faq', {returnObjects: true, defaultValue: []});
	const faq: FaqEntry[] = Array.isArray(rawFaq) ? (rawFaq as FaqEntry[]) : [];

	const sectionIds = useMemo(() => SECTIONS.map((s) => s.id), []);
	// Band starts below the fixed landing nav. `pick: 'last'` because a section
	// scrolled to the top still shares the band with the tail of the one before it.
	const activeId = useScrollSpy({
		sectionIds,
		rootMargin: '-96px 0px -70% 0px',
		pick: 'last',
	});

	const navItems = useMemo(
		() =>
			SECTIONS.map((s) => ({
				id: s.id,
				tone: s.tone,
				label: t(`help.sections.${s.id}.title`),
			})),
		[t]
	);

	function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth') {
		const target = document.getElementById(id);
		if (!target) return;
		// The mobile nav strip is sticky and would otherwise cover the heading it
		// just scrolled to.
		const offset = target.getBoundingClientRect().top + window.scrollY - 96;
		window.scrollTo({top: offset, behavior});
	}

	function handleSelect(id: string) {
		scrollToSection(id);
		// Keep the address bar in step so the reader can copy a link to this section.
		if (typeof history !== 'undefined' && history.replaceState) {
			history.replaceState(null, '', `#${id}`);
		}
	}

	const visibleSections = SECTIONS.filter((def) => sectionMatches(def, faq, trimmedQuery, t));

	// A visitor arriving on /help#smart-cube lands on that section. Waits a frame:
	// the sections are not laid out yet on the first paint after hydration.
	useEffect(() => {
		const hash = location.hash.replace('#', '');
		if (!hash || !sectionIds.includes(hash)) return;
		const raf = requestAnimationFrame(() => scrollToSection(hash, 'auto'));
		return () => cancelAnimationFrame(raf);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className={b()}>
			<Header
				path={location.pathname}
				title={t('help.meta_title')}
				description={t('help.meta_description')}
			/>

			{/* The product's own nav, not the landing one: logo, page tabs, avatar and
			    theme toggle, exactly as on every other page. HeaderNav returns null on
			    mobile (Timer has its own header there), which is where PageTitle takes
			    over with the heading, the avatar and the right-edge drawer. */}
			<HeaderNav hideThemeToggle />

			<div className={b('shell')}>
			<PageTitle pageName={t('help.title')} />
			<h1 className={b('title')}>{t('help.title')}</h1>

			<div className={b('search')}>
				<MagnifyingGlass className={b('search-icon')} weight="bold" aria-hidden="true" />
				<input
					type="search"
					className={b('search-input')}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={t('help.search_placeholder')}
					aria-label={t('help.search_placeholder')}
				/>
			</div>

			<div className={b('layout', {searching: !!trimmedQuery})}>
				{/* While searching the section list is dead weight: the cards on the right
				    are already the filtered answer, and a nav of things that are no longer
				    on screen only misleads. */}
				{trimmedQuery ? null : (
					<div className={b('nav-column')}>
						<HelpNav items={navItems} activeId={activeId} onSelect={handleSelect} />
					</div>
				)}

				<div className={b('content')}>
					{visibleSections.length === 0 ? (
						<p className={b('empty')}>{t('help.search_no_results', {query: trimmedQuery})}</p>
					) : (
						visibleSections.map((def) => (
							<Section key={def.id} def={def} faq={faq} query={trimmedQuery} />
						))
					)}
				</div>
			</div>
			</div>
		</div>
	);
}
