import React, {useState, useEffect, useRef, useMemo} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import './SettingsModal.scss';
import TimerSettings from '../timer/TimerSettings';
import Appearance from '../appearance/Appearance';
import DataSettings from '../data/DataSettings';
import LanguageSettings from '../language/LanguageSettings';
import {useScrollSpy} from '../../../util/hooks/useScrollSpy';
import {useSwipeBack} from '../../../util/hooks/useSwipeBack';

interface SettingsSection {
	id: string;
	labelKey: string;
	subSections: {id: string; labelKey: string}[];
}

const SETTINGS_SECTIONS: SettingsSection[] = [
	{
		id: 'section-timer',
		labelKey: 'settings.tab_timer',
		subSections: [
			{id: 'timer-general', labelKey: 'timer_settings.category_general'},
			{id: 'timer-input', labelKey: 'timer_settings.category_input'},
			{id: 'timer-confirmations', labelKey: 'timer_settings.category_confirmations'},
			{id: 'timer-inspection', labelKey: 'timer_settings.category_inspection'},
			{id: 'timer-stackmat', labelKey: 'timer_settings.category_stackmat'},
		],
	},
	{
		id: 'section-appearance',
		labelKey: 'settings.tab_appearance',
		subSections: [
			{id: 'appearance-theme', labelKey: 'appearance.category_theme'},
			{id: 'appearance-layout', labelKey: 'appearance.category_layout'},
			{id: 'appearance-typography', labelKey: 'appearance.category_typography'},
		],
	},
	{
		id: 'section-data',
		labelKey: 'settings.tab_data',
		subSections: [
			{id: 'data-management', labelKey: 'data_settings.category_management'},
			{id: 'data-reset', labelKey: 'data_settings.category_reset'},
		],
	},
	{
		id: 'section-language',
		labelKey: 'settings.tab_language',
		subSections: [
			{id: 'language-language', labelKey: 'language.category_language'},
		],
	},
];

const TAB_TO_SECTION: Record<string, string> = {
	timer: 'section-timer',
	appearance: 'section-appearance',
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
	const initialPathRef = useRef(location.pathname);

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
		disabled: isDesktop || !isOpen,
		edgeWidth: 24,
		threshold: 100,
	});

	const allSectionIds = useMemo(() => {
		if (isDesktop) {
			return [
				...SETTINGS_SECTIONS.map((s) => s.id),
				...SETTINGS_SECTIONS.flatMap((s) => s.subSections.map((sub) => sub.id)),
			];
		}
		return SETTINGS_SECTIONS.map((s) => s.id);
	}, [isDesktop]);

	const activeId = useScrollSpy({sectionIds: allSectionIds, scrollContainerRef});

	const activeMainSection = useMemo(() => {
		const found = SETTINGS_SECTIONS.find(
			(s) => s.id === activeId || s.subSections.some((sub) => sub.id === activeId)
		);
		return found?.id || SETTINGS_SECTIONS[0].id;
	}, [activeId]);

	useEffect(() => {
		if (initialTab && TAB_TO_SECTION[initialTab]) {
			requestAnimationFrame(() => {
				scrollToSection(TAB_TO_SECTION[initialTab]);
			});
		}
	}, []);

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
			className="fixed inset-0 z-[70] bg-gradient-to-br from-black/70 to-black/50 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200"
			onClick={handleBackdropClick}
		>
			<div
				className="max-w-4xl w-full max-h-[70vh] rounded-3xl bg-[#12141c] border border-white/[0.08] shadow-2xl shadow-black/50 transform transition-all duration-300 flex flex-col"
				onClick={(e) => e.stopPropagation()}
				style={swipePhase !== 'idle' ? {
					transform: `translateX(${swipeX}px)`,
					opacity: 1 - swipeProgress * 0.3,
					transition: swipePhase === 'swiping' ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
				} : undefined}
			>
				{/* Header: close button + mobile nav */}
				<div className="sticky top-0 z-10 bg-[#12141c] border-b border-white/[0.08] rounded-t-3xl px-6 pt-4 pb-3">
					<div className="flex justify-end mb-2">
						<button
							type="button"
							className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1c1c1e] hover:bg-[#2a2a2e] text-slate-300 hover:text-white transition-all duration-200"
							onClick={handleClose}
							aria-label={t('settings.close')}
						>
							<X size={18} />
						</button>
					</div>

					{/* Mobile nav pills */}
					{!isDesktop && (
						<div className="flex overflow-x-auto gap-1 bg-[#1c1c1e] rounded-full p-1 scrollbar-hide">
							{SETTINGS_SECTIONS.map((section) => (
								<button
									key={section.id}
									type="button"
									onClick={() => scrollToSection(section.id)}
									className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${
										activeMainSection === section.id
											? 'bg-[#4a9eff] text-white'
											: 'text-[#888] hover:text-white hover:bg-[#2a2a2e]'
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
						<nav className="w-48 shrink-0 overflow-y-auto py-4 pl-4 pr-2 border-r border-white/[0.08] scrollbar-hide">
							{SETTINGS_SECTIONS.map((section) => (
								<div key={section.id} className="mb-3">
									<button
										type="button"
										onClick={() => scrollToSection(section.id)}
										className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
											activeMainSection === section.id
												? 'text-white bg-white/[0.05]'
												: 'text-[#666] hover:text-[#999]'
										}`}
									>
										{t(section.labelKey)}
									</button>
									<div className="ml-3 mt-0.5 space-y-0.5">
										{section.subSections.map((sub) => (
											<button
												key={sub.id}
												type="button"
												onClick={() => scrollToSection(sub.id)}
												className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-all duration-200 cursor-pointer ${
													activeId === sub.id
														? 'text-[#4a9eff] font-medium'
														: 'text-[#555] hover:text-[#888]'
												}`}
											>
												{t(sub.labelKey)}
											</button>
										))}
									</div>
								</div>
							))}
						</nav>
					)}

					{/* Scrollable content */}
					<div
						ref={scrollContainerRef}
						className="flex-1 overflow-y-auto p-6 pt-4"
					>
						<div className="settings-content space-y-10">
							{/* Timer */}
							<div id="section-timer">
								<h2 className="text-lg font-semibold text-white mb-4">
									{t('settings.tab_timer')}
								</h2>
								<TimerSettings />
							</div>

							{/* Appearance */}
							<div id="section-appearance">
								<h2 className="text-lg font-semibold text-white mb-4">
									{t('settings.tab_appearance')}
								</h2>
								<Appearance />
							</div>

							{/* Data */}
							<div id="section-data">
								<h2 className="text-lg font-semibold text-white mb-4">
									{t('settings.tab_data')}
								</h2>
								<DataSettings />
							</div>

							{/* Language */}
							<div id="section-language">
								<h2 className="text-lg font-semibold text-white mb-4">
									{t('settings.tab_language')}
								</h2>
								<LanguageSettings />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}
