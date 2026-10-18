// Header timer type selector dropdown — Radix UI Select primitives + Framer Motion animation.
// Thanks to Radix: auto-flip, keyboard nav (arrow + enter + escape), type-ahead, ARIA all built-in.
//
// Architecture note: TimerTab.tsx (modal) and this picker share the same state (timer_type + manual_entry settings).
// Mobile uses modal Timer tab, desktop uses this picker — UI is separate, logic is shared.

import React, { useRef } from 'react';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import useExclusiveDropdown from '../../../util/hooks/useExclusiveDropdown';
import { timerOwnsSpaceKey } from '../helpers/space_target';
import { useTranslation } from 'react-i18next';
import * as Select from '@radix-ui/react-select';
import { CaretDown, Check, Crown, Lock } from 'phosphor-react';
import { useTimerChoices } from '../helpers/useTimerChoices';
import block from '../../../styles/bem';
import './TimerTypePicker.scss';

const b = block('timer-type-picker');

interface Props {
	allowedTimerTypes?: string[];
	requireProForSmart?: boolean;
	/** Friendly room: the room's puzzle decides which inputs fit (see useTimerChoices). */
	puzzle?: { cubeType: string; scrambleSubset?: string | null };
}

export default function TimerTypePicker({ allowedTimerTypes, requireProForSmart, puzzle }: Props) {
	const { t } = useTranslation();
	// Order, names, icons and locks come from one place shared with the mobile grid
	// (helpers/useTimerChoices.tsx, helpers/timer_type_catalog.ts).
	const { options, choose } = useTimerChoices({ layout: 'dropdown', allowedTimerTypes, requireProForSmart, puzzle });

	// Open control: scroll selected item to center of panel.
	// useExclusiveDropdown: opening this closes any other header dropdown.
	const [open, setOpen] = useExclusiveDropdown();
	const viewportRef = useRef<HTMLDivElement>(null);

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

	const currentOption = options.find((opt) => opt.isActive) ?? options[0];

	return (
		<Select.Root value={currentOption.key} onValueChange={(v) => choose(v as typeof currentOption.key)} open={open} onOpenChange={setOpen}>
			<Select.Trigger className={b('trigger')} aria-label="Timer Type">
				<span className={b('trigger-icon')}>{currentOption.icon(16)}</span>
				{/* The same name as in the list and on mobile (it used to say "Smart" here and
				    "Akıllı Küp" in the list). */}
				<span className={b('trigger-label')}>{currentOption.label}</span>
				<Select.Icon className={b('trigger-caret')}>
					<CaretDown weight="bold" size={12} />
				</Select.Icon>
			</Select.Trigger>

			<Select.Portal>
				<Select.Content
					className={b('panel')}
					position="popper"
					sideOffset={6}
					align="start"
					collisionPadding={12}
					// Same as FancyDropdown: on the timer page the next Space must start the
					// solve, not reopen this picker from a trigger that kept focus.
					onCloseAutoFocus={(e) => {
						if (timerOwnsSpaceKey()) e.preventDefault();
					}}
				>
					<Select.Viewport ref={viewportRef}>
						{options.map((opt) => (
							<Select.Item
								key={opt.key}
								value={opt.key}
								// A Magnet Timer Pro lock stays selectable: choose() opens the Pro dialog.
								disabled={opt.disabled}
								className={b('option', {
									active: opt.isActive,
									disabled: opt.disabled || opt.proGated,
								})}
							>
								<span className={b('option-icon')}>{opt.icon(16)}</span>
								<Select.ItemText>
									<span className={b('option-label')}>{opt.label}</span>
								</Select.ItemText>
								<span className={b('option-badges')}>
									{opt.beta && <span className={b('badge', { beta: true })}>{t('quick_controls.beta')}</span>}
									{opt.proGated && (
										<span className={b('badge', { pro: true })}>
											<Crown size={10} weight="fill" />
											Pro
										</span>
									)}
									{opt.notAllowed && (
										<span className={b('badge', { locked: true })}>
											<Lock size={10} weight="fill" />
											{t('room_settings.not_allowed')}
										</span>
									)}
									{/* Says WHY the input is unavailable. Previously computed and
									    then never rendered, so the row was simply greyed out with
									    no explanation. */}
									{opt.unsupportedReason && (
										<span className={b('badge', { locked: true })}>
											<Lock size={10} weight="fill" />
											{t(opt.unsupportedReason)}
										</span>
									)}
									<Select.ItemIndicator className={b('check')}>
										<Check weight="bold" size={14} />
									</Select.ItemIndicator>
								</span>
							</Select.Item>
						))}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	);
}
