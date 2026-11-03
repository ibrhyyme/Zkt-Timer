import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'phosphor-react';
import FancyDropdown, { FancyDropdownGroup, FancyDropdownOption } from './FancyDropdown';
import ProTag from '../../common/pro_tag/ProTag';
import { TimerChoiceOption, useTimerChoices } from '../helpers/useTimerChoices';
import { TimerChoice } from '../helpers/timer_type_catalog';
import block from '../../../styles/bem';
import './TimerTypePicker.scss';

const b = block('timer-type-picker');

const BLUETOOTH: TimerChoice[] = ['gantimer', 'qiyitimer'];
const WIRED: TimerChoice[] = ['stackmat', 'qiyiwired'];

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

	function toFancyOption(opt: TimerChoiceOption): FancyDropdownOption {
		// Says WHY the input is unavailable, under its name: these sentences do not fit a
		// badge, and the row must not just look greyed out with no explanation.
		const reasons = [
			opt.notAllowed ? t('room_settings.not_allowed') : null,
			opt.unsupportedReason ? t(opt.unsupportedReason) : null,
		].filter(Boolean);

		return {
			value: opt.key,
			label: opt.label,
			icon: opt.icon(16),
			// A Magnet Timer Pro lock stays selectable: choose() opens the Pro dialog.
			disabled: opt.disabled,
			description: reasons.length ? (
				<>
					<Lock size={12} weight="fill" />
					<span>{reasons.join(' · ')}</span>
				</>
			) : undefined,
			badge:
				opt.beta || opt.proGated ? (
					<>
						{opt.beta && <span className={b('beta')}>{t('quick_controls.beta')}</span>}
						{opt.proGated && <ProTag />}
					</>
				) : undefined,
		};
	}

	// The catalog's order already keeps these together, so the blocks follow it. A block
	// the device does not offer (wired on a tablet) simply does not appear.
	const inBlock = (keys: TimerChoice[]) => options.filter((opt) => keys.includes(opt.key)).map(toFancyOption);
	const groups: FancyDropdownGroup[] = [
		{ options: options.filter((opt) => !BLUETOOTH.includes(opt.key) && !WIRED.includes(opt.key)).map(toFancyOption) },
		// A word from the devices themselves, the same in every language.
		{ header: 'Bluetooth', options: inBlock(BLUETOOTH) },
		{ header: t('quick_controls.wired_timer'), options: inBlock(WIRED) },
	].filter((group) => group.options.length > 0);

	const currentOption = options.find((opt) => opt.isActive) ?? options[0];

	return (
		<FancyDropdown
			value={currentOption.key}
			onValueChange={(value) => choose(value as TimerChoice)}
			groups={groups}
			className={b('trigger')}
			panelClassName={b('panel')}
			triggerIcon={currentOption.icon(16)}
			// The same name as in the list and on mobile (it used to say "Smart" here and
			// "Akıllı Küp" in the list).
			triggerLabel={currentOption.label}
			ariaLabel="Timer Type"
		/>
	);
}
