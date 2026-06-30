// Header timer type selector dropdown — Radix UI Select primitives + Framer Motion animation.
// Thanks to Radix: auto-flip, keyboard nav (arrow + enter + escape), type-ahead, ARIA all built-in.
//
// Architecture note: TimerTab.tsx (modal) and this picker share the same state (timer_type + manual_entry settings).
// Mobile uses modal Timer tab, desktop uses this picker — UI is separate, logic is shared.

import React, { useRef, useState } from 'react';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
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
import { is3x3CubeType } from '../helpers/util';
import { isPro } from '../../../lib/pro';
import block from '../../../styles/bem';
import './TimerTypePicker.scss';

const b = block('timer-type-picker');

type TypeKey = 'keyboard' | 'stackmat' | 'smart' | 'gantimer' | 'qiyitimer' | 'qiyiwired' | 'manual';

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
};

interface Props {
	allowedTimerTypes?: string[];
	requireProForSmart?: boolean;
}

const PRO_GATED_KEYS = new Set<TypeKey>(['smart', 'gantimer', 'qiyitimer']);

export default function TimerTypePicker({ allowedTimerTypes, requireProForSmart }: Props) {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();

	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const mobileMode = useGeneral('mobile_mode');

	const isProGated = !!requireProForSmart && !isPro(me);
	const smartSupported = is3x3CubeType(cubeType, scrambleSubset);

	// Open control — scroll selected item to center of panel
	const [open, setOpen] = useState(false);
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

	function openStackMatPicker(targetTimerType: 'stackmat' | 'qiyiwired' = 'stackmat') {
		const { title, description } = getAudioPickerModalProps(targetTimerType, t);
		dispatch(openModal(
			<StackMatPicker targetTimerType={targetTimerType} />,
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
				openStackMatPicker('stackmat');
				break;
			case 'qiyiwired':
				// QYtoys (QiYi kablolu) ses-jack picker'i gerektirir (cihaz secimi + mic izni); stackmat gibi ac.
				// timer_type'i picker save'i set eder (id'den sonra) — onceden set ETME.
				openStackMatPicker('qiyiwired');
				break;
			case 'manual':
				toggleManualEntry();
				break;
			default:
				selectTimerType(opt.typeKey as AllSettings['timer_type']);
		}
	}

	const baseOptions: Omit<TimerOption, 'disabled' | 'proGated' | 'notAllowed' | 'smartUnsupported'>[] = [
		{
			typeKey: 'keyboard',
			label: mobileMode ? t('quick_controls.touch') : t('quick_controls.keyboard'),
			shortLabel: mobileMode ? t('quick_controls.touch') : t('quick_controls.keyboard'),
			icon: <Keyboard weight="bold" size={16} />,
			isActive: timerType === 'keyboard' && !manualEntry,
		},
		{
			typeKey: 'stackmat',
			label: t('quick_controls.stackmat'),
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
			typeKey: 'qiyiwired',
			label: t('quick_controls.qytoys'),
			shortLabel: 'QYtoys',
			icon: <Microphone weight="bold" size={16} />,
			isActive: timerType === 'qiyiwired' && !manualEntry,
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
		const proGated = isProGated && PRO_GATED_KEYS.has(opt.typeKey);
		const notAllowed = !!allowedTimerTypes && !allowedTimerTypes.includes(opt.typeKey);
		const smartUnsupported = opt.typeKey === 'smart' && !smartSupported;
		const disabled = proGated || notAllowed || smartUnsupported;
		return { ...opt, disabled, proGated, notAllowed, smartUnsupported };
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
