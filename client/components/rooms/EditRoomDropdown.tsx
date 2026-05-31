// Popover dropdown version of EditRoomModal — on desktop, clicking the pencil icon
// opens an inline panel instead of a modal. On mobile, EditRoomModal is still used.
//
// Architecture note: Form logic is shared with EditRoomModal (copied). If EditRoomForm
// component is extracted in the future, both sides can reuse it.

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { Lock, Check, Cube, Crown, PencilSimple } from 'phosphor-react';
import Button from '../common/button/Button';
import { ALLOWED_CUBE_TYPES } from '../../../shared/friendly_room/consts';
import { getCubeTypeInfoById } from '../../util/cubes/util';
import block from '../../styles/bem';
import './EditRoomDropdown.scss';

const b = block('edit-room-dropdown');

interface Props {
	currentName: string;
	isPrivate: boolean;
	currentAllowedTypes?: string[];
	cubeType?: string;
	onSubmit: (newName: string, isPrivate: boolean, newPassword?: string, allowedTimerTypes?: string[], cubeType?: string) => void;
}

const ALL_TYPES = ['keyboard', 'stackmat', 'gantimer', 'qiyitimer', 'moyutimer', 'smart', 'manual'];
const PRO_TYPES = ['gantimer', 'qiyitimer', 'smart'];

export default function EditRoomDropdown({
	currentName,
	isPrivate,
	currentAllowedTypes,
	cubeType,
	onSubmit,
}: Props) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	// Form state — we don't reset to current values every time panel opens; user makes changes
	// and saves or cancels within a single session.
	const [name, setName] = useState(currentName);
	const [selectedCubeType, setSelectedCubeType] = useState(cubeType || '333');
	const [privateRoom, setPrivateRoom] = useState(isPrivate);
	const [password, setPassword] = useState('');
	const [allowedTypes, setAllowedTypes] = useState<string[]>(
		currentAllowedTypes && currentAllowedTypes.length > 0 ? currentAllowedTypes : ALL_TYPES
	);

	// When panel opens, synchronize to current values (reflect external room changes)
	React.useEffect(() => {
		if (open) {
			setName(currentName);
			setSelectedCubeType(cubeType || '333');
			setPrivateRoom(isPrivate);
			setPassword('');
			setAllowedTypes(
				currentAllowedTypes && currentAllowedTypes.length > 0 ? currentAllowedTypes : ALL_TYPES
			);
		}
	}, [open, currentName, cubeType, isPrivate, currentAllowedTypes]);

	const toggleType = (type: string) => {
		if (allowedTypes.includes(type)) {
			if (allowedTypes.length > 1) {
				setAllowedTypes(allowedTypes.filter((t) => t !== type));
			}
		} else {
			setAllowedTypes([...allowedTypes, type]);
		}
	};

	const getTypeName = (type: string) => {
		switch (type) {
			case 'keyboard': return t('rooms.keyboard');
			case 'stackmat': return 'StackMat';
			case 'gantimer': return 'GAN Timer';
			case 'qiyitimer': return t('rooms.qiyi_timer');
			case 'moyutimer': return t('rooms.moyu_timer');
			case 'smart': return t('rooms.smart_cube');
			case 'manual': return t('rooms.manual_entry');
			default: return type;
		}
	};

	function handleSave() {
		if (selectedCubeType !== cubeType) {
			if (!window.confirm(t('rooms.cube_change_warning'))) {
				return;
			}
		}
		onSubmit(name, privateRoom, password.trim(), allowedTypes, selectedCubeType);
		setOpen(false);
	}

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<button
					type="button"
					className="shrink-0 p-1 text-gray-300 md:text-text hover:text-white md:hover:text-text transition-colors rounded-md hover:bg-white/10 md:hover:bg-text/10 focus:outline-none"
					title={t('rooms.edit_room')}
				>
					<PencilSimple size={18} weight="bold" />
				</button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					className={b('panel')}
					align="start"
					sideOffset={10}
					collisionPadding={12}
				>
					<div className={b('header')}>
						<h3 className={b('title')}>{t('rooms.edit_room')}</h3>
					</div>

					<div className={b('content')}>
						{/* Room Name */}
						<div className={b('field')}>
							<label className={b('label')}>{t('rooms.room_name')}</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className={b('input')}
								placeholder={t('rooms.room_name_placeholder')}
							/>
						</div>

						{/* Cube Type Selector */}
						<div className={b('field')}>
							<label className={b('label')}>{t('rooms.cube_type')}</label>
							<div className={b('select-wrapper')}>
								<select
									value={selectedCubeType}
									onChange={(e) => setSelectedCubeType(e.target.value)}
									className={b('select')}
								>
									{ALLOWED_CUBE_TYPES.map((ct) => {
										const info = getCubeTypeInfoById(ct);
										return (
											<option key={ct} value={ct}>
												{info ? info.name : ct.toUpperCase()}
											</option>
										);
									})}
								</select>
								<Cube className={b('select-icon')} size={18} />
							</div>
						</div>

						{/* Private Toggle */}
						<div className={b('toggle-row')}>
							<button
								type="button"
								onClick={() => setPrivateRoom(!privateRoom)}
								className={b('toggle', { on: privateRoom })}
								aria-pressed={privateRoom}
							>
								<span className={b('toggle-knob')} />
							</button>
							<span className={b('toggle-label')}>{t('rooms.private_room_q')}</span>
						</div>

						{/* Password Input */}
						{privateRoom && (
							<div className={b('field')}>
								<label className={b('label')}>{t('rooms.new_password')}</label>
								<div className={b('password-wrapper')}>
									<Lock className={b('password-icon')} size={14} />
									<input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className={b('input', { 'with-icon': true })}
										placeholder={t('rooms.new_password_placeholder')}
									/>
								</div>
							</div>
						)}

						{/* Allowed Timer Types */}
						<div className={b('field')}>
							<label className={b('label')}>{t('rooms.allowed_timer_types')}</label>
							<div className={b('timer-types')}>
								{ALL_TYPES.map((type) => {
									const active = allowedTypes.includes(type);
									const isPro = PRO_TYPES.includes(type);
									return (
										<div
											key={type}
											onClick={() => toggleType(type)}
											className={b('timer-type', { active })}
										>
											<span className={b('timer-type-label')}>
												{getTypeName(type)}
												{isPro && (
													<span className={b('pro-badge')}>
														<Crown size={10} weight="fill" />
														Pro
													</span>
												)}
											</span>
											<div className={b('timer-type-check', { active })}>
												{active && <Check size={12} weight="bold" />}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>

					<div className={b('footer')}>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className={b('btn-cancel')}
						>
							{t('rooms.cancel')}
						</button>
						<Button onClick={handleSave} primary className="px-5 py-2">
							{t('rooms.save')}
						</Button>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
