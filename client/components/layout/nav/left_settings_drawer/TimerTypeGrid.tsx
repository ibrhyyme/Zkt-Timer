// Sol drawer Timer Tab — 7 timer turu icin 2-col kareli grid (sag drawer ile ayni
// gorsel pattern). Aktif kart yesil solid bg + beyaz text/ikon.
//
// Logic [TimerTypePicker.tsx](../../timer/header_control/TimerTypePicker.tsx) ile 1:1
// (selectTimerType / openStackMatPicker / toggleManualEntry), sadece UI grid.
//
// Drawer kapanmasi icin kart tikladiktan sonra window.dispatchEvent('timerInteractionStart')
// — EdgeDrawer bu event'i zaten dinliyor (timer baslarsa kapanir). Sol drawer'da
// "secim yapildi → kapan" sinyali olarak ayni event'i kullaniyoruz.

import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {
	Bluetooth,
	CaretLeft,
	Crown,
	Cube,
	Gear,
	Keyboard,
	Lock,
	Microphone,
	PencilSimple,
} from 'phosphor-react';
import {setSetting, toggleSetting} from '../../../../db/settings/update';
import {useSettings} from '../../../../util/hooks/useSettings';
import {useGeneral} from '../../../../util/hooks/useGeneral';
import {useMe} from '../../../../util/hooks/useMe';
import {openModal} from '../../../../actions/general';
import StackMatPicker, { getAudioPickerModalProps } from '../../../settings/stackmat_picker/StackMatPicker';
import {AllSettings} from '../../../../db/settings/query';
import {
	normalizeAllowedTimerTypes,
	timerTypeSupportsBucket,
	timerTypeUnsupportedReason,
} from '../../../timer/helpers/timer_type_support';
import {PRO_GATED_TIMER_TYPES} from '../../../timer/helpers/pro_timer_types';
import {isPro} from '../../../../lib/pro';
import ExtrasTab from '../../../quick-controls/tabs/ExtrasTab';
import GoalsTab from '../../../quick-controls/tabs/GoalsTab';
import block from '../../../../styles/bem';
import './TimerTypeGrid.scss';

// Sag drawer ile ayni BEM class'larini reuse — yesil aktif renk EdgeDrawer.scss'te
// side-aware kuralla otomatik geliyor (.drawer--left __item--active = success-color).
const itemBlock = block('edge-drawer');
const b = block('timer-type-grid');

type TypeKey = AllSettings['timer_type'] | 'manual';

interface TimerOption {
	typeKey: TypeKey;
	label: string;
	icon: React.ReactNode;
	isActive: boolean;
	disabled: boolean;
	proGated: boolean;
	smartUnsupported: boolean;
	notAllowed: boolean;
	/** Bulmacanin bu girdiyi neden desteklemedigini anlatan i18n anahtari. */
	unsupportedReason: string | null;
}

const ICON_SIZE = 24;

interface Props {
	// Oda modu: izin verilen timer turleri (host belirler). undefined ise tum turler acik.
	allowedTimerTypes?: string[];
	// Oda modu: smart cube + GAN/QiYi timer icin Pro abonelik gerekli.
	requireProForSmart?: boolean;
	// ExtrasTab'a forward — multi-phase + recognition split satirlari gizli.
	hideSmartCubeFeatures?: boolean;
	// ExtrasTab'a forward — mobile module slot'lari gizli.
	hideMobileModules?: boolean;
	// ExtrasTab'a forward — slam-to-stop satiri gizli (oda akisi KeyWatcher kullanmaz).
	hideSlamStop?: boolean;
}

interface TimerOptionExt extends TimerOption {
	notAllowed: boolean;
}

export default function TimerTypeGrid({
	allowedTimerTypes: rawAllowed,
	requireProForSmart,
	hideSmartCubeFeatures,
	hideMobileModules,
	hideSlamStop,
}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();

	// StackMat ve QYtoys birlesmeden once acilmis odalar hala 'qiyiwired' saklıyor.
	const allowedTimerTypes = normalizeAllowedTimerTypes(rawAllowed);

	// Drawer ic-icine gecisli sayfa: 'grid' = 8-kart, 'extras' = ExtrasTab/GoalsTab paneli
	const [view, setView] = useState<'grid' | 'extras'>('grid');
	// Extras view ic-sekme: 'extras' = Hizli Ayarlar (ExtrasTab), 'goals' = Hedefler (GoalsTab).
	// Masaustu SettingsDropdown'daki Extras/Hedefler tab switcher'in mobil karsiligi.
	const [extrasTab, setExtrasTab] = useState<'extras' | 'goals'>('extras');

	// Drawer kapanirsa view'i sifirla (kullanici tekrar acsa once grid gozuksun).
	// Extras ic-sekmeyi de 'extras'a al — tekrar acildiginda Hizli Ayarlar'da baslasin.
	// Iki sinyal: (a) timerInteractionStart — kart seciminden/timer baslangicindan,
	// (b) edgeDrawerClosed — backdrop tikla / swipe close / EdgeDrawer setOpen(false).
	useEffect(() => {
		const reset = () => {
			setView('grid');
			setExtrasTab('extras');
		};
		window.addEventListener('timerInteractionStart', reset);
		window.addEventListener('edgeDrawerClosed', reset);
		return () => {
			window.removeEventListener('timerInteractionStart', reset);
			window.removeEventListener('edgeDrawerClosed', reset);
		};
	}, []);

	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const mobileMode = useGeneral('mobile_mode');

	// Hangi girdiyi hangi bulmaca destekliyor: tek tablo, timer_type_support.ts.
	const smartSupported = timerTypeSupportsBucket('smart', cubeType, scrambleSubset);
	const virtualSupported = timerTypeSupportsBucket('virtual', cubeType, scrambleSubset);
	const userIsPro = isPro(me);

	const baseOptions: Omit<TimerOption, 'disabled' | 'proGated' | 'smartUnsupported' | 'notAllowed' | 'unsupportedReason'>[] = [
		{
			typeKey: 'keyboard',
			label: mobileMode ? t('quick_controls.touch') : t('quick_controls.keyboard'),
			icon: <Keyboard weight="bold" size={ICON_SIZE} />,
			isActive: timerType === 'keyboard' && !manualEntry,
		},
		{
			typeKey: 'manual',
			label: t('quick_controls.manual_entry'),
			icon: <PencilSimple weight="bold" size={ICON_SIZE} />,
			isActive: manualEntry,
		},
		{
			typeKey: 'virtual',
			label: t('quick_controls.virtual_cube'),
			icon: <Cube weight="bold" size={ICON_SIZE} />,
			isActive: timerType === 'virtual' && !manualEntry && virtualSupported,
		},
		{
			typeKey: 'smart',
			label: t('quick_controls.smart_cube'),
			icon: <Cube weight="bold" size={ICON_SIZE} />,
			isActive: timerType === 'smart' && !manualEntry && smartSupported,
		},
		{
			typeKey: 'gantimer',
			// "GAN Akilli Timer" kart icin uzun — sag drawer label boyutuna kompakt
			label: 'GAN Timer',
			icon: <Bluetooth weight="bold" size={ICON_SIZE} />,
			isActive: timerType === 'gantimer' && !manualEntry,
		},
		{
			typeKey: 'qiyitimer',
			label: 'QiYi Timer',
			icon: <Bluetooth weight="bold" size={ICON_SIZE} />,
			isActive: timerType === 'qiyitimer' && !manualEntry,
		},
		{
			typeKey: 'stackmat',
			label: t('quick_controls.wired_timer'),
			icon: <Microphone weight="bold" size={ICON_SIZE} />,
			isActive: timerType === 'stackmat' && !manualEntry,
		},
	];

	// Pro-gating: timer sayfasi (oda DEGIL) prop'suz cagrilir → `requireProForSmart` undefined/false,
	// Pro badge gostermez. Oda modunda (requireProForSmart=true) Pro olmayan kullanici icin
	// smart/gantimer/qiyitimer kartlari disable + Crown badge.
	const isProGated = !!requireProForSmart && !userIsPro;

	const options: TimerOption[] = baseOptions.map((opt) => {
		const proGated = isProGated && PRO_GATED_TIMER_TYPES.has(opt.typeKey);
		// 'manual' bir mod, timer_type degil — bulmaca kisitina tabi degil.
		const unsupportedReason =
			opt.typeKey === 'manual'
				? null
				: timerTypeUnsupportedReason(opt.typeKey, cubeType, scrambleSubset);
		const smartUnsupported = !!unsupportedReason;
		// Oda host'unun izin verdigi timer turleri disindaki kartlar disable + kirmizi Lock badge.
		// `allowedTimerTypes` undefined/null veya bos array ise filter atlanir (tum kartlar acik).
		const notAllowed =
			!!allowedTimerTypes && allowedTimerTypes.length > 0 && !allowedTimerTypes.includes(opt.typeKey);
		const disabled = proGated || smartUnsupported || notAllowed;
		return {...opt, disabled, proGated, smartUnsupported, notAllowed, unsupportedReason};
	});

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

	function handleSelect(opt: TimerOption) {
		if (opt.disabled) return;

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

		// Drawer'i kapat — EdgeDrawer timerInteractionStart event'inde setOpen(false) yapiyor.
		window.dispatchEvent(new Event('timerInteractionStart'));
	}

	// === EXTRAS VIEW (drawer ic-icine gecisli sayfa) ===
	// Header: geri butonu + iki sekme (Hizli Ayarlar / Hedefler). Content sabit
	// en/boy kutusunda (TimerTypeGrid.scss __extras-content) — sekme degisince
	// panel boyutu degismez, sadece ic icerik degisir (kutu icinde scroll).
	if (view === 'extras') {
		return (
			<>
				<header className={b('extras-header')}>
					<button
						type="button"
						className={b('extras-back')}
						onClick={() => setView('grid')}
						aria-label="Geri"
					>
						<CaretLeft weight="bold" size={18} />
					</button>
					<div className={b('extras-tabs')}>
						<button
							type="button"
							className={b('extras-tab', {active: extrasTab === 'extras'})}
							onClick={() => setExtrasTab('extras')}
						>
							{t('quick_controls.extras')}
						</button>
						<button
							type="button"
							className={b('extras-tab', {active: extrasTab === 'goals'})}
							onClick={() => setExtrasTab('goals')}
						>
							{t('quick_controls.goals')}
						</button>
					</div>
				</header>
				<div className={b('extras-content')}>
					{extrasTab === 'extras' ? (
						<ExtrasTab
							hideSmartCubeFeatures={hideSmartCubeFeatures}
							hideMobileModules={hideMobileModules}
							hideSlamStop={hideSlamStop}
						/>
					) : (
						<GoalsTab />
					)}
				</div>
			</>
		);
	}

	// === GRID VIEW (8 kart: 7 timer turu + Hizli Ayarlar) ===
	return (
		<>
			{options.map((opt) => (
				<button
					key={opt.typeKey}
					type="button"
					className={[
						itemBlock('item', {active: opt.isActive}),
						b('card', {disabled: opt.disabled}),
					].join(' ')}
					onClick={() => handleSelect(opt)}
					disabled={opt.disabled}
				>
					<div className={itemBlock('item-icon')}>{opt.icon}</div>
					<span className={itemBlock('item-label')}>{opt.label}</span>

					{opt.proGated && (
						<span className={b('badge', {pro: true})} aria-label="Pro">
							<Crown weight="fill" size={10} />
						</span>
					)}
					{opt.notAllowed && (
						<span
							className={b('badge', {locked: true})}
							aria-label={t('room_settings.not_allowed')}
						>
							<Lock weight="fill" size={10} />
						</span>
					)}
					{opt.unsupportedReason && (
						<span
							className={b('badge', {locked: true})}
							aria-label={t(opt.unsupportedReason)}
							title={t(opt.unsupportedReason)}
						>
							<Lock weight="fill" size={10} />
						</span>
					)}
				</button>
			))}

			{/* 8. kare — Hizli Ayarlar. Drawer ic-icine gecisli (view='extras' state'i) */}
			<button
				type="button"
				className={[itemBlock('item'), b('card'), b('settings-trigger')].join(' ')}
				onClick={() => setView('extras')}
			>
				<div className={itemBlock('item-icon')}>
					<Gear weight="bold" size={ICON_SIZE} />
				</div>
				<span className={itemBlock('item-label')}>{t('quick_controls.extras')}</span>
			</button>
		</>
	);
}
