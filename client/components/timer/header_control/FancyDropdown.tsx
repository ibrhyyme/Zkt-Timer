// Generic dropdown used in header — Radix Select + polished style.
// Genericized pattern from TimerTypePicker. Supports headers / groups / icons / disabled / badge.
//
// Architecture note: Radix Select primitives for single selection. For action items (e.g.
// "New Session +"), virtual values (e.g. "__action__new_session") are used —
// parent component's handleValueChange catches these with switch statement.

import React, { useRef, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { CaretDown, Check } from 'phosphor-react';
import block from '../../../styles/bem';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import useExclusiveDropdown from '../../../util/hooks/useExclusiveDropdown';
import { timerOwnsSpaceKey } from '../helpers/space_target';
import { inReversedFrame, reversedPlacement } from '../../../util/reversed-ui';
import { MOBILE_BREAKPOINT } from '../../../util/hooks/useIsMobile';
import './FancyDropdown.scss';

const b = block('fancy-dropdown');

// Radix Select throws on an item whose value is '', and '' is what "all" or "none" holds in
// half the filters. The value stays '' for the caller; only Radix sees this stand-in.
const EMPTY_VALUE = '__zt_empty__';
const toRadixValue = (value: string) => (value === '' ? EMPTY_VALUE : value);
const fromRadixValue = (value: string) => (value === EMPTY_VALUE ? '' : value);

export interface FancyDropdownOption {
	value: string;
	label: React.ReactNode;
	icon?: React.ReactNode;
	disabled?: boolean;
	badge?: React.ReactNode;
	// A line under the label, e.g. why the row is unavailable. Wraps, unlike the label.
	description?: React.ReactNode;
}

export interface FancyDropdownGroup {
	// Group header (Select.Label) — if null/undefined, acts like a separator
	header?: string;
	options: FancyDropdownOption[];
}

interface FancyDropdownProps {
	value: string;
	onValueChange: (value: string) => void;
	// Flat list or grouped list (one of these must be provided)
	options?: FancyDropdownOption[];
	groups?: FancyDropdownGroup[];
	// Trigger appearance
	triggerIcon?: React.ReactNode;
	triggerLabel?: React.ReactNode;
	// Custom trigger content (e.g. for CrossColorPicker: just swatch + caret)
	triggerContent?: React.ReactNode;
	ariaLabel: string;
	// Open direction (default 'start' — panel's left edge aligns with trigger's left edge, expands right)
	align?: 'start' | 'end' | 'center';
	// Which side of the trigger the panel opens on (default 'bottom')
	side?: 'top' | 'bottom';
	// Max panel height (scrollable)
	maxHeight?: number;
	// Trigger min/max width (default adjustable for wide labels)
	triggerMinWidth?: number;
	triggerMaxWidth?: number;
	className?: string;
	// Extra class on the portaled panel (Select.Content) — lets a consumer scope
	// panel-only styles (e.g. centered group headers) without affecting other dropdowns.
	panelClassName?: string;
	// Hide on mobile (default true — header dropdowns fall into modal on mobile)
	hideOnMobile?: boolean;
	// Don't add default trigger SCSS class — consumer provides their own triggerStyle via className
	// (e.g. StatsFilterControls uses chip style)
	noTriggerStyles?: boolean;
	// Sits inside a popover that is itself an exclusive dropdown (the gear panel): opening
	// this must not close the panel it lives in.
	nested?: boolean;
	disabled?: boolean;
}

export default function FancyDropdown(props: FancyDropdownProps) {
	const {
		value,
		onValueChange,
		options,
		groups,
		triggerIcon,
		triggerLabel,
		triggerContent,
		ariaLabel,
		align = 'start',
		side = 'bottom',
		maxHeight = 400,
		triggerMinWidth,
		triggerMaxWidth,
		className,
		panelClassName,
		noTriggerStyles,
		nested,
		disabled,
	} = props;

	// Open control — scroll selected item to center of panel.
	// useExclusiveDropdown: opening this closes any other header dropdown.
	const [exclusiveOpen, setExclusiveOpen] = useExclusiveDropdown();
	const [nestedOpen, setNestedOpen] = useState(false);
	const open = nested ? nestedOpen : exclusiveOpen;
	const setOpen = nested ? setNestedOpen : setExclusiveOpen;
	const viewportRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	// Reversed use (util/reversed-ui.ts): a trigger drawn inside the 180° rotated timer
	// opens a panel in physical coordinates. Decided per trigger when it opens, because
	// dropdowns in the upright edge drawers must stay as they are.
	const [reversed, setReversed] = useState(false);
	// A trigger in a phone's right-hand column would otherwise push the panel off the screen.
	const [fitScreen, setFitScreen] = useState(false);
	function handleOpenChange(next: boolean) {
		if (next) {
			setReversed(inReversedFrame(triggerRef.current));
			setFitScreen(window.innerWidth < MOBILE_BREAKPOINT);
		}
		setOpen(next);
	}
	// "Below" for the reader is physically above; the reader's start edge is the physical end.
	const placement = reversedPlacement(side, align, reversed);

	// When panel opens, scroll selected item to viewport center
	// (Radix default only makes it visible, manual scroll needed to center)
	useIsomorphicLayoutEffect(() => {
		if (!open) return;
		const raf = requestAnimationFrame(() => {
			const viewport = viewportRef.current;
			if (!viewport) return;
			const selected = viewport.querySelector<HTMLElement>('[data-state="checked"]');
			if (!selected) return;
			const target = selected.offsetTop - viewport.clientHeight / 2 + selected.offsetHeight / 2;
			viewport.scrollTop = Math.max(0, target);
		});
		return () => cancelAnimationFrame(raf);
	}, [open]);

	function renderOption(opt: FancyDropdownOption) {
		return (
			<Select.Item
				key={opt.value}
				value={toRadixValue(opt.value)}
				disabled={opt.disabled}
				className={b('option', { disabled: opt.disabled, described: !!opt.description })}
			>
				{opt.icon && <span className={b('option-icon')}>{opt.icon}</span>}
				<span className={b('option-text')}>
					<Select.ItemText>
						<span className={b('option-label')}>{opt.label}</span>
					</Select.ItemText>
					{opt.description && <span className={b('option-description')}>{opt.description}</span>}
				</span>
				{opt.badge && <span className={b('option-badge-slot')}>{opt.badge}</span>}
				<Select.ItemIndicator className={b('check')}>
					<Check weight="bold" size={14} />
				</Select.ItemIndicator>
			</Select.Item>
		);
	}

	const triggerStyle: React.CSSProperties = {};
	if (triggerMinWidth !== undefined) triggerStyle.minWidth = triggerMinWidth;
	if (triggerMaxWidth !== undefined) triggerStyle.maxWidth = triggerMaxWidth;

	return (
		<Select.Root
			value={toRadixValue(value)}
			onValueChange={(next) => onValueChange(fromRadixValue(next))}
			open={open}
			onOpenChange={handleOpenChange}
			disabled={disabled}
		>
			<Select.Trigger
				ref={triggerRef}
				className={[noTriggerStyles ? null : b('trigger'), className].filter(Boolean).join(' ')}
				aria-label={ariaLabel}
				style={triggerStyle}
			>
				{triggerContent ? (
					triggerContent
				) : (
					<>
						{triggerIcon && <span className={b('trigger-icon')}>{triggerIcon}</span>}
						{triggerLabel && <span className={b('trigger-label')}>{triggerLabel}</span>}
						<Select.Icon className={b('trigger-caret')}>
							<CaretDown weight="bold" size={12} />
						</Select.Icon>
					</>
				)}
			</Select.Trigger>

			<Select.Portal>
				<Select.Content
					className={[b('panel'), panelClassName].filter(Boolean).join(' ')}
					position="popper"
					side={placement.side}
					// Not in reversed use: the panel is placed in physical coordinates there.
					avoidCollisions={fitScreen && !reversed}
					sideOffset={4}
					align={placement.align}
					collisionPadding={12}
					style={{
						maxHeight: `min(${maxHeight}px, var(--radix-select-content-available-height), var(--zt-menu-max-h, 100vh))`,
					}}
					// On the timer page Space is the timer's key. Handing focus back to the
					// trigger made the next Space reopen the picker instead of starting a solve.
					// Everywhere else the trigger gets focus back, as keyboard users expect.
					onCloseAutoFocus={(e) => {
						if (timerOwnsSpaceKey()) e.preventDefault();
					}}
				>
					<Select.Viewport
						// The list is turned, not the panel: the panel's transform-origin is the
						// trigger's anchor point, so turning it would swing it off-screen.
						className={b('viewport', { reversed })}
						ref={viewportRef}
						// Radix Select's scroll lock (react-remove-scroll, a non-capture document
						// listener) judges the drag direction physically, so in a turned list it
						// cancels drags at both ends. Keeping touchmove from reaching document
						// leaves scrolling to the browser, which follows the finger.
						onTouchMove={reversed ? (e) => e.stopPropagation() : undefined}
					>
						{groups
							? groups.map((group, gIdx) => (
								<React.Fragment key={`group-${gIdx}`}>
									{gIdx > 0 && <Select.Separator className={b('separator')} />}
									{group.header && (
										<Select.Group>
											<Select.Label className={b('group-label')}>
												{group.header}
											</Select.Label>
											{group.options.map((opt) => renderOption(opt))}
										</Select.Group>
									)}
									{!group.header && group.options.map((opt) => renderOption(opt))}
								</React.Fragment>
							))
							: (options ?? []).map((opt) => renderOption(opt))}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	);
}
