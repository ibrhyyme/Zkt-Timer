// Header timer type selector dropdown — Radix UI Select primitives + Framer Motion animation.
// Thanks to Radix: auto-flip, keyboard nav (arrow + enter + escape), type-ahead, ARIA all built-in.
//
// Architecture note: TimerTab.tsx (modal) and this picker share the same state (timer_type + manual_entry settings).
// Mobile uses modal Timer tab, desktop uses this picker — UI is separate, logic is shared.

import React, { useRef } from 'react';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import useExclusiveDropdown from '../../../util/hooks/useExclusiveDropdown';
import { useTranslation } from 'react-i18next';
import * as Select from '@radix-ui/react-select';
import {
	Bluetooth,
	CaretDown,
	Check,
	Crown,
	Cube,
	Keyboard,
	Lock,
	Microphone,
	PencilSimple,
} from 'phosphor-react';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useMe } from '../../../util/hooks/useMe';
import { useDispatch } from 'react-redux';
import { openModal } from '../../../actions/general';
import StackMatPicker, { getAudioPickerModalProps } from '../../settings/stackmat_picker/StackMatPicker';
import { AllSettings } from '../../../db/settings/query';
import {
	normalizeAllowedTimerTypes,
	timerTypeSupportsBucket,
	timerTypeUnsupportedReason,
} from '../helpers/timer_type_support';
import { PRO_GATED_TIMER_TYPES } from '../helpers/pro_timer_types';
import { isPro } from '../../../lib/pro';
import block from '../../../styles/bem';
import './TimerTypePicker.scss';

const b = block('timer-type-picker');

type TypeKey = AllSettings['timer_type'] | 'manual';

type TimerOption = {
	typeKey: TypeKey;
	// Full label shown inside panel
	label: string;
	// Compact label shown on trigger (to save space)
	shortLabel: string;
	icon: React.ReactNode;
	isActive: boolean;
	disabled: boolean;
	proGated: boolean;
	notAllowed: boolean;
	smartUnsupported: boolean;
	/** i18n key explaining why the puzzle rules this input out, null when it does not. */
	unsupportedReason: string | null;
};

interface Props {
	allowedTimerTypes?: string[];
	requireProForSmart?: boolean;
}

export default function TimerTypePicker({ allowedTimerTypes: rawAllowed, requireProForSmart }: Props) {
	// Rooms created before StackMat and QYtoys merged still store 'qiyiwired'.
	const allowedTimerTypes = normalizeAllowedTimerTypes(rawAllowed);
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();

	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const mobileMode = useGeneral('mobile_mode');

	const isProGated = !!requireProForSmart && !isPro(me);
	// Which inputs the current puzzle supports. One table, in timer_type_support.ts.
	const smartSupported = timerTypeSupportsBucket('smart', cubeType, scrambleSubset);
	const virtualSupported = timerTypeSupportsBucket('virtual', cubeType, scrambleSubset);

	// Open control — scroll selected item to center of panel.
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

	function selectTimerType(newTimerType: AllSettings['timer_type']) {
		setSetting('manual_entry', false);
		setSetting('timer_type', newTimerType);
	}

	function openStackMatPicker() {
		const { title, description } = getAudioPickerModalProps(t);
		dispatch(openModal(
			<StackMatPicker />,
			{
				width: 400,
				compact: true,
				title,
				description,
				closeButtonText: t('solve_info.done'),
			},
		));
	}

	function toggleManualEntry() {
		if (!manualEntry) {
			setSetting('timer_type', 'keyboard');
		}
		toggleSetting('manual_entry');
	}

	// Radix Select onValueChange handler — value is our TypeKey
	function handleValueChange(value: string) {
		const opt = options.find((o) => o.typeKey === value);
		if (!opt || opt.disabled) return;

		switch (opt.typeKey) {
			case 'stackmat':
				openStackMatPicker();
				break;
			case 'manual':
				toggleManualEntry();
				break;
			default:
				selectTimerType(opt.typeKey as AllSettings['timer_type']);
		}
	}

	const baseOptions: Omit<TimerOption, 'disabled' | 'proGated' | 'notAllowed' | 'smartUnsupported' | 'unsupportedReason'>[] = [
		{
			typeKey: 'keyboard',
			label: mobileMode ? t('quick_controls.touch') : t('quick_controls.keyboard'),
			shortLabel: mobileMode ? t('quick_controls.touch') : t('quick_controls.keyboard'),
			icon: <Keyboard weight="bold" size={16} />,
			isActive: timerType === 'keyboard' && !manualEntry,
		},
		{
			typeKey: 'virtual',
			label: t('quick_controls.virtual_cube'),
			shortLabel: t('quick_controls.virtual_cube_short'),
			icon: <Cube weight="bold" size={16} />,
			isActive: timerType === 'virtual' && !manualEntry && virtualSupported,
		},
		{
			typeKey: 'stackmat',
			label: t('quick_controls.wired_timer'),
			shortLabel: 'StackMat',
			icon: <Microphone weight="bold" size={16} />,
			isActive: timerType === 'stackmat' && !manualEntry,
		},
		{
			typeKey: 'smart',
			label: t('quick_controls.smart_cube'),
			shortLabel: 'Smart',
			icon: <Cube weight="bold" size={16} />,
			isActive: timerType === 'smart' && !manualEntry && smartSupported,
		},
		{
			typeKey: 'gantimer',
			label: t('quick_controls.gan_smart_timer'),
			shortLabel: 'GAN',
			icon: <Bluetooth weight="bold" size={16} />,
			isActive: timerType === 'gantimer' && !manualEntry,
		},
		{
			typeKey: 'qiyitimer',
			label: t('quick_controls.qiyi_smart_timer'),
			shortLabel: 'QiYi',
			icon: <Bluetooth weight="bold" size={16} />,
			isActive: timerType === 'qiyitimer' && !manualEntry,
		},
		{
			typeKey: 'manual',
			label: t('quick_controls.manual_entry'),
			shortLabel: t('quick_controls.manual_entry'),
			icon: <PencilSimple weight="bold" size={16} />,
			isActive: manualEntry,
		},
	];

	const options: TimerOption[] = baseOptions.map((opt) => {
		const proGated = isProGated && PRO_GATED_TIMER_TYPES.has(opt.typeKey);
		const notAllowed = !!allowedTimerTypes && !allowedTimerTypes.includes(opt.typeKey);
		// 'manual' is a mode, not a timer_type, so it is never puzzle-restricted.
		const unsupportedReason =
			opt.typeKey === 'manual'
				? null
				: timerTypeUnsupportedReason(opt.typeKey, cubeType, scrambleSubset);
		const smartUnsupported = !!unsupportedReason;
		const disabled = proGated || notAllowed || smartUnsupported;
		return { ...opt, disabled, proGated, notAllowed, smartUnsupported, unsupportedReason };
	});

	const currentOption = options.find((opt) => opt.isActive) ?? options[0];

	return (
		<Select.Root value={currentOption.typeKey} onValueChange={handleValueChange} open={open} onOpenChange={setOpen}>
			<Select.Trigger className={b('trigger')} aria-label="Timer Type">
				<span className={b('trigger-icon')}>{currentOption.icon}</span>
				<span className={b('trigger-label')}>{currentOption.shortLabel}</span>
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
				>
					<Select.Viewport ref={viewportRef}>
						{options.map((opt) => (
							<Select.Item
								key={opt.typeKey}
								value={opt.typeKey}
								disabled={opt.disabled}
								className={b('option', {
									active: opt.isActive,
									disabled: opt.disabled,
								})}
							>
								<span className={b('option-icon')}>{opt.icon}</span>
								<Select.ItemText>
									<span className={b('option-label')}>{opt.label}</span>
								</Select.ItemText>
								<span className={b('option-badges')}>
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
