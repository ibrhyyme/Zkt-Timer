/**
 * Small pieces the set screens share (trainer-sets 7): owner chip, visibility tag, category
 * badges, the action sheet behind "..." / long press, and the long press hook.
 */
import React, {useCallback, useRef} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {GlobeHemisphereWest, LinkSimple, LockSimple, CheckCircle} from 'phosphor-react';
import block from '../../../styles/bem';
import {getStorageURL} from '../../../util/storage';
import {categoryBadges} from './set_ui';
import type {AlgSetOwnerData} from '../../../lib/alg_sets/types';
import type {AlgSetVisibility} from '../../../../shared/trainer/alg_sets';

const b = block('alg-sets');

export function VisibilityIcon({visibility, size = 14}: {visibility: AlgSetVisibility; size?: number}) {
	if (visibility === 'public') return <GlobeHemisphereWest size={size} weight="bold" aria-hidden="true" />;
	if (visibility === 'link') return <LinkSimple size={size} weight="bold" aria-hidden="true" />;
	return <LockSimple size={size} weight="bold" aria-hidden="true" />;
}

export function VisibilityTag({visibility}: {visibility: AlgSetVisibility}) {
	const {t} = useTranslation();
	return (
		<span className={b('visibility')}>
			<VisibilityIcon visibility={visibility} />
			<span>{t(`trainer.sets.visibility.${visibility}`)}</span>
		</span>
	);
}

export function OwnerAvatar({owner, size = 22}: {owner: AlgSetOwnerData; size?: number}) {
	const initial = (owner.username || '?').charAt(0).toUpperCase();
	const style = {width: size, height: size, fontSize: Math.round(size * 0.48)};
	if (owner.avatar_path) {
		return <img className={b('avatar')} style={style} src={getStorageURL(owner.avatar_path)} alt="" loading="lazy" />;
	}
	return (
		<span className={b('avatar', {initial: true})} style={style} aria-hidden="true">
			{initial}
		</span>
	);
}

/** Avatar and name; links to the profile unless `plain` (inside a card that is itself a button). */
export function OwnerChip({owner, plain = false}: {owner: AlgSetOwnerData; plain?: boolean}) {
	const body = (
		<>
			<OwnerAvatar owner={owner} />
			<span className={b('owner-name')}>{owner.username}</span>
			{owner.verified ? <CheckCircle className={b('owner-verified')} size={14} weight="fill" aria-hidden="true" /> : null}
		</>
	);
	if (plain || !owner.username) return <span className={b('owner')}>{body}</span>;
	return (
		<Link className={b('owner', {link: true})} to={`/user/${encodeURIComponent(owner.username)}`}>
			{body}
		</Link>
	);
}

export function CategoryBadges({categories, max = 3}: {categories: string[]; max?: number}) {
	const {shown, more} = categoryBadges(categories, max);
	if (shown.length === 0) return null;
	return (
		<span className={b('badges')}>
			{shown.map((category) => (
				<span key={category} className={b('badge')}>
					{category}
				</span>
			))}
			{more > 0 ? <span className={b('badge', {more: true})}>+{more}</span> : null}
		</span>
	);
}

export interface SheetAction {
	key: string;
	label: string;
	icon?: React.ReactNode;
	danger?: boolean;
	disabled?: boolean;
	/** Shown under a disabled action (e.g. "Internet connection needed"). */
	note?: string;
	onSelect: () => void;
}

/** A list of actions in a modal ("..." menu, long press). Closes before running the action. */
export function ActionSheet({
	actions,
	message,
	onClose,
}: {
	actions: SheetAction[];
	/** A sentence above the actions. */
	message?: string;
	onClose?: () => void;
}) {
	return (
		<div className={b('action-sheet')}>
			{message ? <p className={b('sheet-message')}>{message}</p> : null}
			{actions.map((action) => (
				<button
					key={action.key}
					type="button"
					className={b('action', {danger: !!action.danger})}
					disabled={action.disabled}
					onClick={() => {
						if (onClose) onClose();
						action.onSelect();
					}}
				>
					{action.icon ? <span className={b('action-icon')}>{action.icon}</span> : null}
					<span className={b('action-text')}>
						<span>{action.label}</span>
						{action.disabled && action.note ? <span className={b('action-note')}>{action.note}</span> : null}
					</span>
				</button>
			))}
		</div>
	);
}

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Long press on touch (scrolling cancels it) and right click on desktop. The click that ends a
 * long press is swallowed, so the card does not also open.
 */
export function useLongPress(onLongPress: (() => void) | null) {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const start = useRef<{x: number; y: number} | null>(null);
	const fired = useRef(false);

	const cancel = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		start.current = null;
	}, []);

	const onTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (!onLongPress) return;
			fired.current = false;
			const touch = e.touches[0];
			start.current = {x: touch.clientX, y: touch.clientY};
			timer.current = setTimeout(() => {
				fired.current = true;
				timer.current = null;
				onLongPress();
			}, LONG_PRESS_MS);
		},
		[onLongPress]
	);

	const onTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!start.current) return;
			const touch = e.touches[0];
			if (
				Math.abs(touch.clientX - start.current.x) > MOVE_TOLERANCE_PX ||
				Math.abs(touch.clientY - start.current.y) > MOVE_TOLERANCE_PX
			) {
				cancel();
			}
		},
		[cancel]
	);

	const onContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (!onLongPress) return;
			e.preventDefault();
			// A touch long press already opened it (mobile browsers send contextmenu too).
			if (fired.current) return;
			if (timer.current) {
				// Touch still held: this is the long press, a click may follow and is swallowed.
				cancel();
				fired.current = true;
			}
			onLongPress();
		},
		[onLongPress, cancel]
	);

	/** True once for the click that ends a long press. */
	const consumeClick = useCallback(() => {
		if (!fired.current) return false;
		fired.current = false;
		return true;
	}, []);

	return {
		handlers: {onTouchStart, onTouchMove, onTouchEnd: cancel, onTouchCancel: cancel, onContextMenu},
		consumeClick,
	};
}
