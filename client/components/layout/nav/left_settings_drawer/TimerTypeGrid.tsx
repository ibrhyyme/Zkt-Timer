// Left drawer Timer tab: the timer inputs as a 2-column grid of up to 8 cells (inputs + Quick
// Settings), the same visual pattern as the right drawer. The active cell is the accent fill.
//
// Order, names, icons and locks come from helpers/useTimerChoices.tsx, shared with the
// desktop dropdown (TimerTypePicker), so the two can no longer list the inputs differently.
//
// A card tap dispatches 'timerInteractionStart': EdgeDrawer already closes on it (a timer
// start closes it too), so the drawer reads it as "a choice was made".

import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {CaretRight, Crown, Gear, Lock} from 'phosphor-react';
import {useTimerChoices, TimerChoiceOption} from '../../../timer/helpers/useTimerChoices';
import {BackButton} from '../../../common/icon_button/IconButton';
import TabBar from '../../../common/tab_bar/TabBar';
import ExtrasTab from '../../../quick-controls/tabs/ExtrasTab';
import GoalsTab from '../../../quick-controls/tabs/GoalsTab';
import {TimerChoice} from '../../../timer/helpers/timer_type_catalog';
import {useSmartCubeStore} from '../../../../util/hooks/useSmartCubeStore';
import {useTimerLinkConnected} from '../../../../util/timer_link_state';
import {hapticImpact} from '../../../../util/native-plugins';
import block from '../../../../styles/bem';
import './TimerTypeGrid.scss';

// Same BEM classes as the right drawer (EdgeDrawer.scss).
const itemBlock = block('edge-drawer');
const b = block('timer-type-grid');

const ICON_SIZE = 22;

interface Props {
	// Room: the input types the host allows. undefined: every input is open.
	allowedTimerTypes?: string[];
	// Room: smart cube and the GAN/QiYi timers need Pro.
	requireProForSmart?: boolean;
	// Forwarded to ExtrasTab: multi-phase and recognition split rows hidden.
	hideSmartCubeFeatures?: boolean;
	// Forwarded to ExtrasTab (no longer read there).
	hideMobileModules?: boolean;
	// Forwarded to ExtrasTab: slam-to-stop hidden (the room does not stop through KeyWatcher).
	hideSlamStop?: boolean;
	// Room: the room's puzzle decides which inputs fit (see useTimerChoices).
	puzzle?: {cubeType: string; scrambleSubset?: string | null};
}

export default function TimerTypeGrid({
	allowedTimerTypes,
	requireProForSmart,
	hideSmartCubeFeatures,
	hideMobileModules,
	hideSlamStop,
	puzzle,
}: Props) {
	const {t} = useTranslation();

	// 'grid' = the 8 cards, 'extras' = the Quick Settings / Goals panel inside the drawer.
	const [view, setView] = useState<'grid' | 'extras'>('grid');
	// Inner tab of the extras view: Quick Settings (ExtrasTab) or Goals (GoalsTab).
	const [extrasTab, setExtrasTab] = useState<'extras' | 'goals'>('extras');

	// Drawer closed: next time it opens on the grid and on Quick Settings. Two signals:
	// timerInteractionStart (a card tap or a timer start) and edgeDrawerClosed (backdrop,
	// swipe, EdgeDrawer setOpen(false)).
	useEffect(() => {
		const reset = () => {
			setView('grid');
			setExtrasTab('extras');
		};
		window.addEventListener('timerInteractionStart', reset);
		window.addEventListener('edgeDrawerClosed', reset);
		return () => {
			window.removeEventListener('timerInteractionStart', reset);
			window.removeEventListener('edgeDrawerClosed', reset);
		};
	}, []);

	const {options, choose} = useTimerChoices({layout: 'grid', allowedTimerTypes, requireProForSmart, puzzle});

	// The inputs with a device behind them: a dot on the cell while that device is on the link.
	const smartConnected = useSmartCubeStore('smartCubeConnected');
	const ganConnected = useTimerLinkConnected('gantimer');
	const qiyiConnected = useTimerLinkConnected('qiyitimer');
	const linked: Partial<Record<TimerChoice, boolean>> = {
		smart: smartConnected,
		gantimer: ganConnected,
		qiyitimer: qiyiConnected,
	};

	function handleSelect(opt: TimerChoiceOption) {
		hapticImpact('light');
		// A Pro-locked Magnet Timer is tappable: choose() opens the Pro dialog and the drawer
		// stays where it is underneath it.
		const applied = choose(opt.key);
		if (!applied && opt.proGated) return;
		if (opt.disabled) return;
		// Close the drawer (EdgeDrawer closes on timerInteractionStart).
		window.dispatchEvent(new Event('timerInteractionStart'));
	}

	// === EXTRAS VIEW (drawer ic-icine gecisli sayfa) ===
	// Header: geri butonu + iki sekme (Hizli Ayarlar / Hedefler). Content sabit
	// en/boy kutusunda (TimerTypeGrid.scss __extras-content) — sekme degisince
	// panel boyutu degismez, sadece ic icerik degisir (kutu icinde scroll).
	if (view === 'extras') {
		return (
			<>
				<header className={b('extras-header')}>
					<BackButton size="sm" onClick={() => setView('grid')} />
					<TabBar<'extras' | 'goals'>
						className={b('extras-tabs')}
						label={t('quick_controls.extras')}
						value={extrasTab}
						onChange={setExtrasTab}
						tabs={[
							{id: 'extras', label: t('quick_controls.extras')},
							{id: 'goals', label: t('quick_controls.goals')},
						]}
					/>
				</header>
				<div className={b('extras-content')}>
					{extrasTab === 'extras' ? (
						<>
							<ExtrasTab
								hideSmartCubeFeatures={hideSmartCubeFeatures}
								hideMobileModules={hideMobileModules}
								hideSlamStop={hideSlamStop}
							/>
							{/* This panel is the in-solve shortcut; the full settings live on
							    their own page, which mobile could otherwise only reach through
							    the account dropdown. */}
							<Link
								to="/settings"
								className={b('all-settings')}
								onClick={() => window.dispatchEvent(new Event('timerInteractionStart'))}
							>
								<Gear weight="regular" size={18} />
								<span>{t('settings.all_settings')}</span>
								<CaretRight weight="bold" size={10} aria-hidden="true" />
							</Link>
						</>
					) : (
						<GoalsTab />
					)}
				</div>
			</>
		);
	}

	// === GRID VIEW (8 cells: 7 inputs + Quick Settings) ===
	return (
		<>
			{options.map((opt) => (
				<button
					key={opt.key}
					type="button"
					className={[
						itemBlock('item', {active: opt.isActive}),
						b('card', {disabled: opt.disabled}),
					].join(' ')}
					onClick={() => handleSelect(opt)}
					disabled={opt.disabled}
				>
					<div className={itemBlock('item-icon')}>
						{opt.icon(ICON_SIZE, 'regular')}
						{linked[opt.key] && (
							<span className={b('linked')} role="img" aria-label={t('quick_controls.device_connected')} />
						)}
					</div>
					<span className={itemBlock('item-label')}>{opt.label}</span>

					{opt.beta && <span className={b('beta')}>{t('quick_controls.beta')}</span>}

					{opt.proGated && (
						<span className={b('badge', {pro: true})} aria-label="Pro">
							<Crown weight="fill" size={10} />
						</span>
					)}
					{opt.notAllowed && (
						<span
							className={b('badge', {locked: true})}
							aria-label={t('room_settings.not_allowed')}
						>
							<Lock weight="fill" size={12} />
						</span>
					)}
					{opt.unsupportedReason && (
						<span
							className={b('badge', {locked: true})}
							aria-label={t(opt.unsupportedReason)}
							title={t(opt.unsupportedReason)}
						>
							<Lock weight="fill" size={12} />
						</span>
					)}
				</button>
			))}

			{/* 8th cell: Quick Settings, opened inside the drawer (view 'extras'). */}
			<button
				type="button"
				className={[itemBlock('item'), b('card'), b('settings-trigger')].join(' ')}
				onClick={() => {
					hapticImpact('light');
					setView('extras');
				}}
			>
				<div className={itemBlock('item-icon')}>
					<Gear weight="regular" size={ICON_SIZE} />
				</div>
				<span className={itemBlock('item-label')}>{t('quick_controls.extras')}</span>
				{/* The one cell that opens a second screen instead of making a choice. */}
				<CaretRight className={b('more')} size={10} weight="bold" aria-hidden="true" />
			</button>
		</>
	);
}
