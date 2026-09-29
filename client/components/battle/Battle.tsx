import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BattleProvider, useBattle, BattleSolve } from './BattleContext';
import { BattleCubesProvider } from './smart/BattleCubesProvider';
import BattleTimer from './BattleTimer';
import BattleMenu from './BattleMenu';
import BattleHistory from './BattleHistory';
import { ClockCounterClockwise, GearSix, CaretDown } from 'phosphor-react';
import block from '../../styles/bem';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import BottomSheetNav from '../layout/nav/bottom_sheet_nav/BottomSheetNav';
import './Battle.scss';

const b = block('battle');


const CUBE_TYPES = [
	{ id: '222', name: '2x2' },
	{ id: '333', name: '3x3' },
	{ id: '444', name: '4x4' },
	{ id: '555', name: '5x5' },
	{ id: '666', name: '6x6' },
	{ id: '777', name: '7x7' },
	{ id: 'sq1', name: 'Square-1' },
	{ id: 'pyram', name: 'Pyraminx' },
	{ id: 'clock', name: 'Clock' },
	{ id: 'skewb', name: 'Skewb' },
	{ id: 'minx', name: 'Megaminx' },
];

function BattleInner() {
	const { t } = useTranslation();
	const { state, dispatch } = useBattle();
	const { rounds, currentRound, settings, winStreak } = state;
	const [cubeDropdownOpen, setCubeDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Auto-advance KALDIRILDI — yeni tur START_ROUND ile baslar

	const handleSolve1 = useCallback(
		(solve: BattleSolve) => dispatch({ type: 'PLAYER_SOLVE', player: 1, solve }),
		[dispatch]
	);

	const handleSolve2 = useCallback(
		(solve: BattleSolve) => dispatch({ type: 'PLAYER_SOLVE', player: 2, solve }),
		[dispatch]
	);

	// Dropdown disina tiklaninca kapat
	useEffect(() => {
		if (!cubeDropdownOpen) return;

		const handleClickOutside = (e: TouchEvent | MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setCubeDropdownOpen(false);
			}
		};

		// Both events: touch is how the page is played, but the dropdown was unclosable with a
		// mouse, which is the only way battle can be driven in a desktop browser. A tap fires
		// both, and closing twice is the same as closing once, so no timestamp guard is needed
		// here the way it is on the timer halves.
		document.addEventListener('touchstart', handleClickOutside);
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('touchstart', handleClickOutside);
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [cubeDropdownOpen]);

	const currentCubeName = CUBE_TYPES.find((ct) => ct.id === settings.cubeType)?.name || settings.cubeType;

	return (
		<div className={b()}>
			<h1 className="sr-only">{t('seo.battle_title')}</h1>
			<BattleTimer player={1} onSolve={handleSolve1} />

			{/* Toolbar */}
			<div className={b('toolbar')}>
				<div className={b('toolbar-buttons')}>
					{/* Kup turu dropdown */}
					<div className={b('toolbar-cube')} ref={dropdownRef}>
						<button
							className={b('toolbar-btn', { 'cube-type': true })}
							onClick={() => setCubeDropdownOpen((prev) => !prev)}
						>
							{currentCubeName}
							<CaretDown size={14} weight="bold" />
						</button>

						{cubeDropdownOpen && (
							<div className={b('cube-dropdown')}>
								{CUBE_TYPES.map((ct) => (
									<button
										key={ct.id}
										className={b('cube-chip', { active: settings.cubeType === ct.id })}
										onClick={() => {
											dispatch({ type: 'UPDATE_SETTINGS', settings: { cubeType: ct.id } });
											dispatch({ type: 'RESET' });
											setCubeDropdownOpen(false);
										}}
									>
										{ct.name}
									</button>
								))}
							</div>
						)}
					</div>

					<button className={b('toolbar-btn')} onClick={() => dispatch({ type: 'TOGGLE_HISTORY' })}>
						<ClockCounterClockwise size={18} />
					</button>
					<button className={b('toolbar-btn')} onClick={() => dispatch({ type: 'TOGGLE_MENU' })}>
						<GearSix size={18} />
					</button>
				</div>
				{settings.showWinStreak && winStreak.count >= 2 && (
					<span className={b('toolbar-streak')}>
						{winStreak.player === 1 ? settings.player1Name : settings.player2Name} {t('battle.streak')}:{' '}
						{winStreak.count}
					</span>
				)}
			</div>

			<BattleTimer player={2} onSolve={handleSolve2} />

			<BattleMenu />
			<BattleHistory />
			<BottomSheetNav />
		</div>
	);
}

export default function Battle() {
	/**
	 * Client-only, but no longer phone-only.
	 *
	 * This used to return null above 750px, which rendered a blank dark page on every iPad
	 * except the mini, on any phone turned sideways, and on every desktop. 750 matched nothing
	 * in the design system either; the scale runs 400/480/640/768/1024/1280/1600. The stylesheet
	 * now scales the layout up instead of the component refusing to draw it.
	 *
	 * The window check stays. Battle builds its first scramble while the reducer initialises, so
	 * a server render would produce a different scramble than the client and break hydration.
	 */
	if (typeof window === 'undefined') return null;

	return (
		<FeatureGuard feature="battle_enabled" pageNameKey="nav.battle">
			<BattleProvider>
				{/* Inside BattleProvider: the cube layer follows the round's scramble, so it
				    has to be able to read battle state. */}
				<BattleCubesProvider>
					<BattleInner />
				</BattleCubesProvider>
			</BattleProvider>
		</FeatureGuard>
	);
}
