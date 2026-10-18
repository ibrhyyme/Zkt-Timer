import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { DotsThree } from 'phosphor-react';
import block from '../../../styles/bem';
import { LocalCube } from '../../../lib/cubes/active_cube';
import { hapticImpact } from '../../../util/native-plugins';
import { formatInteger } from '../../../util/locale_format';
import { cubeProfileLink, formatLastUsed } from './cube_labels';
import { CubeMenuItem } from './cube_actions';
import { CubeMenuOpenArgs } from './CubeMenu';

const b = block('my-cubes');

const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP_PX = 10;

interface Props {
	cube: LocalCube;
	isMain: boolean;
	/** Puzzle name shown in the meta line (archive list, where puzzles are mixed). */
	puzzleName?: string | null;
	menuItems: CubeMenuItem[];
	openMenu: (args: CubeMenuOpenArgs) => void;
}

/**
 * One cube (5.1). Tapping opens the profile; the ⋯ button, a right click (desktop) and a long
 * press (touch, with a light haptic) open the same menu. Phones show two lines, wider screens
 * a table row; both come from the same markup (MyCubes.scss).
 */
export default function CubeRow({ cube, isMain, puzzleName, menuItems, openMenu }: Props) {
	const { t, i18n } = useTranslation();
	const history = useHistory();
	const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pressStart = useRef<{ x: number; y: number } | null>(null);
	// A long press already opened the menu: swallow the click (and the contextmenu Android
	// fires for the same press) that follow it.
	const longPressed = useRef(false);

	useEffect(() => () => {
		if (pressTimer.current) clearTimeout(pressTimer.current);
	}, []);

	const count = formatInteger(cube.solve_count || 0, i18n.language);
	const solves = t('cubes.solve_count', { count: cube.solve_count || 0, n: count });
	const lastUsed = formatLastUsed(cube.last_used_at, i18n.language);

	function menu(x: number, y: number) {
		openMenu({ title: cube.name, items: menuItems, x, y });
	}

	function cancelPress() {
		if (pressTimer.current) clearTimeout(pressTimer.current);
		pressTimer.current = null;
		pressStart.current = null;
	}

	function onTouchStart(e: React.TouchEvent) {
		longPressed.current = false;
		const touch = e.touches[0];
		if (!touch) return;
		pressStart.current = { x: touch.clientX, y: touch.clientY };
		if (pressTimer.current) clearTimeout(pressTimer.current);
		pressTimer.current = setTimeout(() => {
			pressTimer.current = null;
			longPressed.current = true;
			void hapticImpact('light');
			menu(touch.clientX, touch.clientY);
		}, LONG_PRESS_MS);
	}

	function onTouchMove(e: React.TouchEvent) {
		const start = pressStart.current;
		const touch = e.touches[0];
		if (!start || !touch) return;
		if (Math.abs(touch.clientX - start.x) > LONG_PRESS_SLOP_PX || Math.abs(touch.clientY - start.y) > LONG_PRESS_SLOP_PX) {
			cancelPress();
		}
	}

	function onClick() {
		if (longPressed.current) {
			longPressed.current = false;
			return;
		}
		history.push(cubeProfileLink(cube.id));
	}

	function onContextMenu(e: React.MouseEvent) {
		e.preventDefault();
		if (longPressed.current) return;
		if (pressTimer.current) {
			// Android fires contextmenu for the same long press, often before our timer (its long
			// press timeout is 400 ms since Android 12). Treat it as that press, or the timer
			// opens a second sheet on top of the first.
			cancelPress();
			longPressed.current = true;
			void hapticImpact('light');
		}
		menu(e.clientX, e.clientY);
	}

	function onTouchEnd(e: React.TouchEvent) {
		// After a long press the lifted finger must not become a click on whatever the opened
		// sheet put under it (its backdrop would close it at once).
		if (longPressed.current && e.cancelable) e.preventDefault();
		cancelPress();
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			history.push(cubeProfileLink(cube.id));
		} else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
			e.preventDefault();
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			menu(rect.right - 16, rect.top + rect.height / 2);
		}
	}

	const metaParts = [puzzleName, cube.brand, solves, lastUsed].filter(Boolean);

	return (
		<div
			className={b('row', { archived: !!cube.archived_at })}
			role="link"
			tabIndex={0}
			onClick={onClick}
			onContextMenu={onContextMenu}
			onKeyDown={onKeyDown}
			onTouchStart={onTouchStart}
			onTouchMove={onTouchMove}
			onTouchEnd={onTouchEnd}
			onTouchCancel={cancelPress}
		>
			<div className={b('cell', { name: true })}>
				<span className={b('name')}>{cube.name}</span>
				{isMain ? <span className={b('badge', { main: true })}>{t('cubes.badge_main')}</span> : null}
				{cube.is_smart ? <span className={b('badge', { smart: true })}>{t('cubes.badge_smart')}</span> : null}
				<span className={b('meta')}>{metaParts.join(' · ')}</span>
			</div>
			<div className={b('cell', { brand: true })}>{cube.brand || ''}</div>
			<div className={b('cell', { count: true })}>{count}</div>
			<div className={b('cell', { last: true })}>{lastUsed}</div>
			<div className={b('cell', { menu: true })}>
				<button
					type="button"
					className={b('menu-button')}
					aria-label={t('cubes.menu_open', { name: cube.name })}
					onClick={(e) => {
						e.stopPropagation();
						const rect = e.currentTarget.getBoundingClientRect();
						menu(rect.left, rect.bottom + 4);
					}}
					onTouchStart={(e) => {
						e.stopPropagation();
						// Its touchend still bubbles to the row: a stale long press must not eat this tap.
						longPressed.current = false;
					}}
				>
					<DotsThree weight="bold" />
				</button>
			</div>
		</div>
	);
}
