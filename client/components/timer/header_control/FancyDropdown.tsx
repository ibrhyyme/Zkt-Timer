// Header'da kullanilan generic dropdown — Radix Select + havali stil.
// TimerTypePicker'in pattern'i generic'lestirilmis hali. Headers / groups / icons / disabled / badge destegi.
//
// Mimari notu: Tek seferlik secim icin Radix Select primitives. Action item'lar (ornek:
// "Yeni Session +") icin virtual value (ornek: "__action__new_session") kullanilir —
// parent component'in handleValueChange'i switch ile bu virtual value'lari yakalar.

import React, { useLayoutEffect, useRef, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { CaretDown, Check } from 'phosphor-react';
import block from '../../../styles/bem';
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
	// Grup basligi (Select.Label) — null/undefined ise sadece separator gibi davranir
	header?: string;
	options: FancyDropdownOption[];
}

interface FancyDropdownProps {
	value: string;
	onValueChange: (value: string) => void;
	// Flat liste mi gruplu liste mi (ikisinden biri verilmeli)
	options?: FancyDropdownOption[];
	groups?: FancyDropdownGroup[];
	// Trigger gorunumu
	triggerIcon?: React.ReactNode;
	triggerLabel?: React.ReactNode;
	// Custom trigger content (ornek: CrossColorPicker icin sadece swatch + caret)
	triggerContent?: React.ReactNode;
	ariaLabel: string;
	// Acilma yonu (default 'start' — panel sol kenari trigger sol kenari ile hizali, saga genisler)
	align?: 'start' | 'end' | 'center';
	// Maks panel yuksekligi (scrollable)
	maxHeight?: number;
	// Trigger min/max width (default genis label icin ayarlanabilir)
	triggerMinWidth?: number;
	triggerMaxWidth?: number;
	className?: string;
	// Mobile'da gizle (default true — header dropdown'lari mobile'da mevcut moda dusuyor)
	hideOnMobile?: boolean;
	// Default trigger SCSS class'ini ekleme — kullanan kendi triggerStyle'ini className ile verir
	// (ornek: StatsFilterControls'da chip stili)
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
		noTriggerStyles,
	} = props;

	// Acilma kontrolu — selected item'i panel ortasina scroll yapmak icin
	const [open, setOpen] = useState(false);
	const viewportRef = useRef<HTMLDivElement>(null);

	// Panel acildiginda secili item'i viewport'in ortasina kaydir
	// (Radix default sadece visible yapar, ortalamak icin manuel scroll lazim)
	useLayoutEffect(() => {
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
					// Stagger entrance — her item'a animation-delay (inline cunku
					// SCSS'te nth-child group icinde calismaz)
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
					className={b('panel')}
					position="popper"
					sideOffset={6}
					align={align}
					collisionPadding={12}
					style={{ maxHeight }}
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
