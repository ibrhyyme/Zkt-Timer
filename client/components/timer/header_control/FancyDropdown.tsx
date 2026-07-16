// Generic dropdown used in header — Radix Select + polished style.
// Genericized pattern from TimerTypePicker. Supports headers / groups / icons / disabled / badge.
//
// Architecture note: Radix Select primitives for single selection. For action items (e.g.
// "New Session +"), virtual values (e.g. "__action__new_session") are used —
// parent component's handleValueChange catches these with switch statement.

import React, { useRef } from 'react';
import * as Select from '@radix-ui/react-select';
import { CaretDown, Check } from 'phosphor-react';
import block from '../../../styles/bem';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import useExclusiveDropdown from '../../../util/hooks/useExclusiveDropdown';
import './FancyDropdown.scss';

const b = block('fancy-dropdown');

export interface FancyDropdownOption {
	value: string;
	label: React.ReactNode;
	icon?: React.ReactNode;
	disabled?: boolean;
	badge?: React.ReactNode;
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
		maxHeight = 400,
		triggerMinWidth,
		triggerMaxWidth,
		className,
		panelClassName,
		noTriggerStyles,
	} = props;

	// Open control — scroll selected item to center of panel.
	// useExclusiveDropdown: opening this closes any other header dropdown.
	const [open, setOpen] = useExclusiveDropdown();
	const viewportRef = useRef<HTMLDivElement>(null);

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

	function renderOption(opt: FancyDropdownOption, indexInGroup: number) {
		return (
			<Select.Item
				key={opt.value}
				value={opt.value}
				disabled={opt.disabled}
				className={b('option', { disabled: opt.disabled })}
				style={{
					// Stagger entrance — each item gets animation-delay (inline because
					// nth-child doesn't work inside group in SCSS)
					animationDelay: `${30 + indexInGroup * 25}ms`,
				}}
			>
				{opt.icon && <span className={b('option-icon')}>{opt.icon}</span>}
				<Select.ItemText>
					<span className={b('option-label')}>{opt.label}</span>
				</Select.ItemText>
				{opt.badge && <span className={b('option-badge-slot')}>{opt.badge}</span>}
				<Select.ItemIndicator className={b('check')}>
					<Check weight="bold" size={16} />
				</Select.ItemIndicator>
			</Select.Item>
		);
	}

	const triggerStyle: React.CSSProperties = {};
	if (triggerMinWidth !== undefined) triggerStyle.minWidth = triggerMinWidth;
	if (triggerMaxWidth !== undefined) triggerStyle.maxWidth = triggerMaxWidth;

	return (
		<Select.Root value={value} onValueChange={onValueChange} open={open} onOpenChange={setOpen}>
			<Select.Trigger
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
					side="bottom"
					avoidCollisions={false}
					sideOffset={6}
					align={align}
					collisionPadding={12}
					style={{ maxHeight: `min(${maxHeight}px, var(--radix-select-content-available-height))` }}
				>
					<Select.Viewport className={b('viewport')} ref={viewportRef}>
						{groups
							? groups.map((group, gIdx) => (
								<React.Fragment key={`group-${gIdx}`}>
									{gIdx > 0 && <Select.Separator className={b('separator')} />}
									{group.header && (
										<Select.Group>
											<Select.Label className={b('group-label')}>
												{group.header}
											</Select.Label>
											{group.options.map((opt, i) => renderOption(opt, i))}
										</Select.Group>
									)}
									{!group.header && group.options.map((opt, i) => renderOption(opt, i))}
								</React.Fragment>
							))
							: (options ?? []).map((opt, i) => renderOption(opt, i))}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	);
}
