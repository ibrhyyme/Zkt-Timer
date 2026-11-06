import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import {
	Bluetooth,
	Cube,
	HandPointing,
	IconWeight,
	Keyboard,
	Magnet,
	Monitor,
	PencilSimple,
	VideoCamera,
} from 'phosphor-react';
import AudioJackIcon from '../../common/audio_jack_icon/AudioJackIcon';
import { setSetting, setSettings } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useMe } from '../../../util/hooks/useMe';
import { openModal } from '../../../actions/general';
import { getDeviceProfile } from '../../../util/device-profile';
import { isPro } from '../../../lib/pro';
import { canUseMagnetStart } from '../../../lib/magnet-start-access';
import { canUseCameraTimer } from '../../../lib/camera-timer-access';
import { useCameraTimerAvailability } from '../../../util/camera-timer/availability';
import { useMagnetAvailability } from '../../../util/magnet-start/availability';
import { isSlamDetectorAvailable } from '../../../util/slam-stop/plugin';
import { openProOnlyModal } from '../../common/pro_only/openProOnlyModal';
import StackMatPicker, { getAudioPickerModalProps } from '../../settings/stackmat_picker/StackMatPicker';
import { AllSettings } from '../../../db/settings/query';
import { normalizeAllowedTimerTypes, timerTypeUnsupportedReason } from './timer_type_support';
import { PRO_GATED_TIMER_TYPES } from './pro_timer_types';
import {
	activeChoice,
	cameraOfferedOnDevice,
	choiceEngineType,
	magnetOfferedOnDevice,
	TimerChoice,
	timerChoices,
	WiredBrand,
} from './timer_type_catalog';

export interface TimerChoiceOption {
	key: TimerChoice;
	label: string;
	icon: (size: number, weight?: IconWeight) => React.ReactNode;
	isActive: boolean;
	/** Cannot be chosen: room rule or the puzzle rules it out. A Pro lock stays tappable. */
	disabled: boolean;
	/** Shows the Pro badge; tapping opens the Pro dialog instead of selecting. */
	proGated: boolean;
	notAllowed: boolean;
	/** i18n key explaining why the puzzle rules this input out, null when it does not. */
	unsupportedReason: string | null;
	beta: boolean;
}

interface Options {
	layout: 'dropdown' | 'grid';
	/** Friendly room allow-list (host decides). undefined: every input allowed. */
	allowedTimerTypes?: string[];
	/** Friendly room: smart cube and the Bluetooth timers need Pro. */
	requireProForSmart?: boolean;
	/**
	 * The puzzle the screen is timing, when it is not the timer page's own. A friendly room
	 * times the room's event: reading the user's timer settings instead locked the smart
	 * cube in a 3x3 room for anyone whose timer was last on Pyraminx or 7x7.
	 */
	puzzle?: { cubeType: string; scrambleSubset?: string | null };
}

/**
 * One source for the desktop dropdown and the mobile grid: order, names, icons, locks and
 * what tapping does. The two pickers only draw the result.
 */
export function useTimerChoices({ layout, allowedTimerTypes: rawAllowed, requireProForSmart, puzzle }: Options) {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();

	// Rooms created before StackMat and QYtoys merged still store 'qiyiwired'.
	const allowedTimerTypes = normalizeAllowedTimerTypes(rawAllowed);
	const inRoom = rawAllowed !== undefined || !!requireProForSmart;

	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const wiredBrand = useSettings('wired_timer_brand');
	const settingsCubeType = useSettings('cube_type');
	const settingsSubset = useSettings('scramble_subset');
	const cubeType = puzzle ? puzzle.cubeType : settingsCubeType;
	const scrambleSubset = puzzle ? puzzle.scrambleSubset ?? null : settingsSubset;
	const mobileMode = useGeneral('mobile_mode');

	const device = getDeviceProfile();
	// The probe only asks whether the sensor exists (no stream starts) and is cached per
	// session; it is what hides the Magnet Timer on binaries that do not ship the plugin.
	const magnetCaps = useMagnetAvailability(magnetOfferedOnDevice(device) && !inRoom);
	const magnetAllowed = canUseMagnetStart(me);
	const roomProGated = !!requireProForSmart && !isPro(me);

	// Dropping the cube is the Magnet Timer's only stop (touch never stops it), so a binary
	// without the slam detector does not get the tile either.
	const magnetAvailable = !!magnetCaps && isSlamDetectorAvailable();
	// Kamera Timer: admins on a desktop browser, and only once the server has the brain (the
	// manifest is asked for by nobody else).
	const cameraAllowed = canUseCameraTimer(me);
	const cameraManifest = useCameraTimerAvailability(cameraAllowed && cameraOfferedOnDevice(device) && !inRoom);
	const offered = timerChoices({ device, magnetAvailable, cameraAvailable: !!cameraManifest, inRoom, layout });
	const active = activeChoice({
		timerType,
		manualEntry: !!manualEntry,
		wiredBrand,
		magnetUsable: magnetAllowed && magnetCaps !== null,
		cameraUsable: cameraAllowed && cameraManifest !== null,
		inRoom,
		offered,
	});

	const touchLabel = device.touchFirst || mobileMode;

	const NAMES: Record<TimerChoice, string> = {
		keyboard: touchLabel ? t('quick_controls.touch') : t('quick_controls.keyboard'),
		smart: t('quick_controls.smart_cube'),
		manual: t('quick_controls.manual_entry'),
		magnet: t('quick_controls.magnet_timer'),
		virtual: t('quick_controls.virtual_cube'),
		// Brand names, the same on every platform and in every language.
		gantimer: 'GAN Timer',
		qiyitimer: 'QiYi Timer',
		stackmat: layout === 'grid' ? t('quick_controls.wired_timer') : 'StackMat',
		qiyiwired: t('quick_controls.qiyi_wired'),
		camera: t('quick_controls.camera_timer'),
	};

	const ICONS: Record<TimerChoice, (size: number, weight?: IconWeight) => React.ReactNode> = {
		keyboard: (s, w = 'bold') => (touchLabel ? <HandPointing weight={w} size={s} /> : <Keyboard weight={w} size={s} />),
		smart: (s, w = 'bold') => <Cube weight={w} size={s} />,
		manual: (s, w = 'bold') => <PencilSimple weight={w} size={s} />,
		magnet: (s, w = 'bold') => <Magnet weight={w} size={s} />,
		// The virtual cube lives on the screen; a second cube icon made it look like the smart cube.
		virtual: (s, w = 'bold') => <Monitor weight={w} size={s} />,
		gantimer: (s, w = 'bold') => <Bluetooth weight={w} size={s} />,
		qiyitimer: (s, w = 'bold') => <Bluetooth weight={w} size={s} />,
		stackmat: (s, w = 'bold') => <AudioJackIcon weight={w} size={s} />,
		// Read through the audio input like StackMat, so it carries the same jack.
		qiyiwired: (s, w = 'bold') => <AudioJackIcon weight={w} size={s} />,
		camera: (s, w = 'bold') => <VideoCamera weight={w} size={s} />,
	};

	const options: TimerChoiceOption[] = offered.map((key) => {
		const engine = choiceEngineType(key);
		const proGated =
			(key === 'magnet' && !magnetAllowed) || (roomProGated && PRO_GATED_TIMER_TYPES.has(engine));
		const notAllowed =
			!!allowedTimerTypes && allowedTimerTypes.length > 0 && !allowedTimerTypes.includes(engine);
		// 'manual' is a mode, not a timer_type, so it is never puzzle-restricted.
		const unsupportedReason =
			engine === 'manual'
				? null
				: timerTypeUnsupportedReason(engine as AllSettings['timer_type'], cubeType, scrambleSubset);
		// A Pro lock in a room disables the row as before; the Magnet Pro lock stays tappable
		// so the tap can open the Pro dialog.
		const disabled = notAllowed || !!unsupportedReason || (proGated && key !== 'magnet');
		return {
			key,
			label: NAMES[key],
			icon: ICONS[key],
			isActive: key === active,
			disabled,
			proGated,
			notAllowed,
			unsupportedReason,
			beta: key === 'magnet' || key === 'camera',
		};
	});

	function openWiredPicker(brand: WiredBrand) {
		const { title, description } = getAudioPickerModalProps(t);
		dispatch(
			openModal(<StackMatPicker brand={brand} />, {
				width: 400,
				compact: true,
				title,
				description,
			})
		);
	}

	/** Returns whether the choice was applied (false when it opened a dialog or was refused). */
	function choose(key: TimerChoice): boolean {
		const opt = options.find((o) => o.key === key);
		if (!opt) return false;
		if (key === 'magnet' && opt.proGated) {
			openProOnlyModal(dispatch, t, 'magnet_start');
			return false;
		}
		if (opt.disabled) return false;

		switch (key) {
			case 'stackmat':
				openWiredPicker('stackmat');
				return false;
			case 'qiyiwired':
				openWiredPicker('qiyi');
				return false;
			case 'manual':
				// Turning manual entry on also forces the keyboard input. One write: both keys
				// live in the same platform prefs blob, which the server overwrites rather than
				// merges, so two calls race and the loser's value comes back on the next sync.
				if (!manualEntry) {
					setSettings({ timer_type: 'keyboard', manual_entry: true });
				} else {
					setSetting('manual_entry', false);
				}
				return true;
			default:
				setSettings({ manual_entry: false, timer_type: key as AllSettings['timer_type'] });
				return true;
		}
	}

	return { options, active, choose };
}
