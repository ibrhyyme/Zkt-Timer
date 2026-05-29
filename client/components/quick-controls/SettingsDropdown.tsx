// Gear icon dropdown — modal yerine inline panel. Radix Popover primitives + tab switcher.
// Mobile'da gizli — orada hala QuickControlsModal kullaniliyor.
//
// Mimari notu: ExtrasTab ve GoalsTab direkt reuse — sadece sarmalayici (Popover + tabs) yeniden yaziliyor.

import React, { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { Gear } from 'phosphor-react';
import ExtrasTab from './tabs/ExtrasTab';
import GoalsTab from './tabs/GoalsTab';
import block from '../../styles/bem';
import './SettingsDropdown.scss';

const b = block('settings-dropdown');

type Tab = 'extras' | 'goals';

interface Props {
	// Trigger'a ek className (HeaderControl'da gear stilini sariyor)
	triggerClassName?: string;
	// FriendlyRoom (oda) icinden acildiginda mobile timer modul secicilerini gizle
	hideMobileModules?: boolean;
	// FriendlyRoom'da smart cube'a ozgu ayarlari (multi-phase, recognition) gizle
	hideSmartCubeFeatures?: boolean;
	// Hedefler tab'ini gizle (oda akisinda goal sistemi kullanilmaz)
	hideGoals?: boolean;
}

export default function SettingsDropdown({
	triggerClassName,
	hideMobileModules,
	hideSmartCubeFeatures,
	hideGoals,
}: Props) {
	const { t } = useTranslation();
	const [tab, setTab] = useState<Tab>('extras');
	const [open, setOpen] = useState(false);

	// Timer baslayinca panel'i kapat (Dropdown.tsx ile ayni pattern)
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
							/>
						)}
						{tab === 'goals' && !hideGoals && <GoalsTab />}
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
