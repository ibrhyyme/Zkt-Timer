// Gear icon dropdown — inline panel instead of modal. Radix Popover primitives + tab switcher.
// Desktop-only (hidden on mobile via @media). Mobile uses the left settings drawer (LeftSettingsDrawer).
//
// Architecture note: ExtrasTab and GoalsTab are reused directly — only the wrapper (Popover + tabs) is rewritten.

import React, { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { Gear } from 'phosphor-react';
import ExtrasTab from './tabs/ExtrasTab';
import GoalsTab from './tabs/GoalsTab';
import block from '../../styles/bem';
import useExclusiveDropdown from '../../util/hooks/useExclusiveDropdown';
import './SettingsDropdown.scss';

const b = block('settings-dropdown');

type Tab = 'extras' | 'goals';

interface Props {
	// Additional className for trigger (wraps gear style in HeaderControl)
	triggerClassName?: string;
	// Hide mobile timer module selectors when opened from FriendlyRoom (room)
	hideMobileModules?: boolean;
	// Hide smart cube-specific settings (multi-phase, recognition) in FriendlyRoom
	hideSmartCubeFeatures?: boolean;
	// Hide slam-to-stop in FriendlyRoom (room stop path is RoomTimerOverlay, not KeyWatcher)
	hideSlamStop?: boolean;
	// Hide goals tab (goal system is not used in room flow)
	hideGoals?: boolean;
}

export default function SettingsDropdown({
	triggerClassName,
	hideMobileModules,
	hideSmartCubeFeatures,
	hideSlamStop,
	hideGoals,
}: Props) {
	const { t } = useTranslation();
	const [tab, setTab] = useState<Tab>('extras');
	// useExclusiveDropdown: opening this closes any other header dropdown.
	const [open, setOpen] = useExclusiveDropdown();

	// Close panel when timer starts (same pattern as Dropdown.tsx)
	useEffect(() => {
		if (!open) return;
		const handleTimerStart = () => setOpen(false);
		window.addEventListener('timerInteractionStart', handleTimerStart);
		return () => window.removeEventListener('timerInteractionStart', handleTimerStart);
	}, [open]);

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<button
					type="button"
					className={[b('trigger'), triggerClassName].filter(Boolean).join(' ')}
					aria-label="Settings"
				>
					<Gear weight="bold" size={18} />
				</button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					className={b('panel')}
					align="end"
					sideOffset={8}
					collisionPadding={12}
				>
					<div className={b('tabs')}>
						<button
							type="button"
							className={b('tab', { active: tab === 'extras' })}
							onClick={() => setTab('extras')}
						>
							{t('quick_controls.extras')}
						</button>
						{!hideGoals && (
							<button
								type="button"
								className={b('tab', { active: tab === 'goals' })}
								onClick={() => setTab('goals')}
							>
								{t('quick_controls.goals')}
							</button>
						)}
					</div>
					<div className={b('content')}>
						{tab === 'extras' && (
							<ExtrasTab
								hideMobileModules={hideMobileModules}
								hideSmartCubeFeatures={hideSmartCubeFeatures}
								hideSlamStop={hideSlamStop}
							/>
						)}
						{tab === 'goals' && !hideGoals && <GoalsTab />}
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
