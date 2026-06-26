import React, {useState, useEffect, useRef, useMemo} from 'react';
import {createPortal} from 'react-dom';
import {X, MagnifyingGlass} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import './SettingsModal.scss';
import {SettingsSearchProvider} from '../SettingsSearchContext';
import TimerSettings from '../timer/TimerSettings';
import ScrambleSettings from '../scramble/ScrambleSettings';
import Appearance from '../appearance/Appearance';
import HardwareSettings from '../hardware/HardwareSettings';
import StatsSettings from '../stats/StatsSettings';
import DataSettings from '../data/DataSettings';
import LanguageSettings from '../language/LanguageSettings';
import {useScrollSpy} from '../../../util/hooks/useScrollSpy';
import {useSwipeBack} from '../../../util/hooks/useSwipeBack';
import {isAndroidNative} from '../../../util/platform';

interface SettingsSection {
	id: string;
	labelKey: string;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
	{id: 'section-timer', labelKey: 'settings.tab_timer'},
	{id: 'section-scramble', labelKey: 'settings.tab_scramble'},
	{id: 'section-appearance', labelKey: 'settings.tab_appearance'},
	{id: 'section-hardware', labelKey: 'settings.tab_hardware'},
	{id: 'section-stats', labelKey: 'settings.tab_stats'},
	{id: 'section-data', labelKey: 'settings.tab_data'},
	{id: 'section-language', labelKey: 'settings.tab_language'},
];

const TAB_TO_SECTION: Record<string, string> = {
	timer: 'section-timer',
	scramble: 'section-scramble',
	appearance: 'section-appearance',
	hardware: 'section-hardware',
	stats: 'section-stats',
	data: 'section-data',
	language: 'section-language',
};

interface Props {
	onClose?: () => void;
	initialTab?: string;
	isOpen?: boolean;
}

export default function SettingsModal(props: Props) {
	const {onClose, initialTab = 'timer', isOpen = true} = props;
	const {t} = useTranslation();
	const location = useLocation();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);
	const [isDesktop, setIsDesktop] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [noResults, setNoResults] = useState(false);
	const initialPathRef = useRef(location.pathname);
	const isSearching = !!searchQuery.trim();

	// Route degisince modal'i kapat
	useEffect(() => {
		if (location.pathname !== initialPathRef.current && onClose) {
			onClose();
		}
	}, [location.pathname]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const check = () => setIsDesktop(window.innerWidth > 768);
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	}, []);

	const {translateX: swipeX, progress: swipeProgress, phase: swipePhase} = useSwipeBack({
		containerRef: backdropRef,
		onSwipeBack: () => onClose?.(),
		disabled: isDesktop || !isOpen || isAndroidNative(),
		edgeWidth: 24,
		threshold: 100,
	});

	const allSectionIds = useMemo(() => SETTINGS_SECTIONS.map((s) => s.id), []);

	const activeId = useScrollSpy({sectionIds: allSectionIds, scrollContainerRef});

	const activeMainSection = useMemo(() => {
		const found = SETTINGS_SECTIONS.find((s) => s.id === activeId);
		return found?.id || SETTINGS_SECTIONS[0].id;
	}, [activeId]);

	useEffect(() => {
		if (initialTab && TAB_TO_SECTION[initialTab]) {
			requestAnimationFrame(() => {
				scrollToSection(TAB_TO_SECTION[initialTab]);
			});
		}
	}, []);

	// After a query change, the content re-renders with only matching groups in
	// the DOM; count visible groups to drive the "no results" message.
	useEffect(() => {
		if (!searchQuery.trim()) {
			setNoResults(false);
			return;
		}
		const raf = requestAnimationFrame(() => {
			const container = scrollContainerRef.current;
			if (container) {
				setNoResults(container.querySelectorAll('[data-settings-group]').length === 0);
			}
		});
		return () => cancelAnimationFrame(raf);
	}, [searchQuery]);

	if (!isOpen) {
		return null;
	}

	function handleBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget && onClose) {
			onClose();
		}
	}

	function handleClose() {
		if (onClose) {
			onClose();
		}
	}

	function scrollToSection(id: string) {
		const container = scrollContainerRef.current;
		if (!container) return;
		const target = container.querySelector(`#${id}`);
		if (target) {
			const containerRect = container.getBoundingClientRect();
			const targetRect = target.getBoundingClientRect();
			const offset = targetRect.top - containerRect.top + container.scrollTop;
			container.scrollTo({top: offset - 8, behavior: 'smooth'});
		}
	}

	return createPortal(
		<div
			ref={backdropRef}
			className="fixed inset-0 z-[100000] bg-gradient-to-br from-black/70 to-black/50 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200"
			onClick={handleBackdropClick}
		>
			<div
				className="max-w-4xl w-full h-[70vh] rounded-3xl bg-background border border-text/[0.08] shadow-2xl shadow-black/50 transform transition-all duration-300 flex flex-col"
				onClick={(e) => e.stopPropagation()}
				style={swipePhase !== 'idle' ? {
					transform: `translateX(${swipeX}px)`,
					opacity: 1 - swipeProgress * 0.3,
					transition: swipePhase === 'swiping' ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
				} : undefined}
			>
				{/* Header: close button + mobile nav */}
				<div className="sticky top-0 z-10 bg-background border-b border-text/[0.08] rounded-t-3xl px-6 pt-4 pb-3">
					<div className="flex items-center gap-3 mb-2">
						<div className="relative flex-1">
							<MagnifyingGlass
								size={16}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-text pointer-events-none"
							/>
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={t('settings.search_placeholder')}
								className="w-full pl-9 pr-3 py-2 rounded-xl bg-button border border-text/[0.1] text-text placeholder:text-text/50 focus:border-primary/60 focus:outline-none transition-colors"
							/>
						</div>
						<button
							type="button"
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-button hover:bg-button/80 text-text transition-all duration-200"
							onClick={handleClose}
							aria-label={t('settings.close')}
						>
							<X size={18} />
						</button>
					</div>

					{/* Mobile nav pills — wrap to multiple rows so all sections stay visible */}
					{!isDesktop && (
						<div className="flex flex-wrap gap-1 bg-button rounded-2xl p-1">
							{SETTINGS_SECTIONS.map((section) => (
								<button
									key={section.id}
									type="button"
									onClick={() => scrollToSection(section.id)}
									className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
										activeMainSection === section.id
											? 'bg-primary text-text'
											: 'text-text hover:bg-button/80'
									}`}
								>
									{t(section.labelKey)}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Body: sidebar (desktop) + scrollable content */}
				<div className="flex flex-1 overflow-hidden">
					{/* Desktop sidebar */}
					{isDesktop && (
						<nav className="w-48 shrink-0 overflow-y-auto py-4 pl-4 pr-2 border-r border-text/[0.08] scrollbar-hide">
							{SETTINGS_SECTIONS.map((section) => (
								<button
									key={section.id}
									type="button"
									onClick={() => scrollToSection(section.id)}
									className={`w-full text-left px-3 py-2 mb-1 rounded-lg text-base font-bold transition-all duration-200 cursor-pointer ${
										activeMainSection === section.id
											? 'text-text bg-text/[0.05]'
											: 'text-text hover:bg-text/[0.05]'
									}`}
								>
									{t(section.labelKey)}
								</button>
							))}
						</nav>
					)}

					{/* Scrollable content */}
					<div
						ref={scrollContainerRef}
						className="flex-1 overflow-y-auto p-6 pt-4"
					>
						<SettingsSearchProvider value={{query: searchQuery}}>
							<div className={`settings-content ${isSearching ? '' : 'space-y-10'}`}>
								{/* Timer */}
								<div id="section-timer">
									{!isSearching && (
										<h2 className="text-lg font-semibold text-text mb-4">
											{t('settings.tab_timer')}
										</h2>
									)}
									<TimerSettings />
								</div>

								{/* Scramble */}
								<div id="section-scramble">
									{!isSearching && (
										<h2 className="text-lg font-semibold text-text mb-4">
											{t('settings.tab_scramble')}
										</h2>
									)}
									<ScrambleSettings />
								</div>

								{/* Appearance */}
								<div id="section-appearance">
									{!isSearching && (
										<h2 className="text-lg font-semibold text-text mb-4">
											{t('settings.tab_appearance')}
										</h2>
									)}
									<Appearance />
								</div>

								{/* Hardware & Input */}
								<div id="section-hardware">
									{!isSearching && (
										<h2 className="text-lg font-semibold text-text mb-4">
											{t('settings.tab_hardware')}
										</h2>
									)}
									<HardwareSettings />
								</div>

								{/* Stats */}
								<div id="section-stats">
									{!isSearching && (
										<h2 className="text-lg font-semibold text-text mb-4">
											{t('settings.tab_stats')}
										</h2>
									)}
									<StatsSettings />
								</div>

								{/* Data */}
								<div id="section-data">
									{!isSearching && (
										<h2 className="text-lg font-semibold text-text mb-4">
											{t('settings.tab_data')}
										</h2>
									)}
									<DataSettings />
								</div>

								{/* Language */}
								<div id="section-language">
									{!isSearching && (
										<h2 className="text-lg font-semibold text-text mb-4">
											{t('settings.tab_language')}
										</h2>
									)}
									<LanguageSettings />
								</div>
							</div>
							{isSearching && noResults && (
								<div className="py-12 text-center text-text">
									{t('settings.search_no_results')}
								</div>
							)}
						</SettingsSearchProvider>
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}
