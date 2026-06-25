import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useMe } from '../../../util/hooks/useMe';
import { isProEnabled, isNotPro } from '../../../lib/pro';
import { openProOnlyModal } from '../../common/pro_only/openProOnlyModal';
import { isNative } from '../../../util/platform';
import { CaretDown, CaretUp, Crown, Minus, Plus } from 'phosphor-react';
import { TimerModuleType } from '../../timer/@types/enums';
import { MOBILE_MODULE_OPTIONS } from '../../timer/@types/mobile_modules';
import { useSlamStop } from '../../../util/slam-stop/settings';
import { canUseStreamerMode } from '../../../lib/streamer-mode';
import { isSlamDetectorAvailable } from '../../../util/slam-stop/plugin';
import SlamSensitivitySlider from './SlamSensitivitySlider';

interface ExtrasNumberInputProps {
	label: string;
	value: number;
	step: number;
	min: number;
	hidden?: boolean;
	onChange: (val: number) => void;
}

function ExtrasNumberInput({ label, value, step, min, hidden, onChange }: ExtrasNumberInputProps) {
	if (hidden) return null;

	const decrement = () => {
		const next = Math.round((value - step) * 100) / 100;
		if (next >= min) onChange(next);
	};

	const increment = () => {
		onChange(Math.round((value + step) * 100) / 100);
	};

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-text/[0.15] transition-all duration-200">
			<span className="font-medium text-text/80 group-hover:text-text transition-colors">
				{label}
			</span>
			<div className="flex items-center space-x-2">
				<button
					type="button"
					onClick={decrement}
					disabled={value <= min}
					className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 border ${value <= min
						? 'bg-button border-text/[0.05] text-text/30 cursor-not-allowed'
						: 'bg-button border-text/[0.1] text-text/70 hover:bg-button hover:text-text hover:border-text/[0.15] cursor-pointer'
					}`}
				>
					<Minus weight="bold" size={12} />
				</button>
				<span className="text-sm font-medium text-primary min-w-[40px] text-center tabular-nums">
					{value.toFixed(1)}
				</span>
				<button
					type="button"
					onClick={increment}
					className="h-7 w-7 rounded-lg flex items-center justify-center bg-button border border-text/[0.1] text-text/70 hover:bg-button hover:text-text hover:border-text/[0.15] transition-all duration-200 cursor-pointer"
				>
					<Plus weight="bold" size={12} />
				</button>
			</div>
		</div>
	);
}

interface ExtrasOptionProps {
	label: string;
	isActive: boolean;
	disabled?: boolean;
	hidden?: boolean;
	onClick: () => void;
}

function ExtrasOption({ label, isActive, disabled = false, hidden = false, onClick }: ExtrasOptionProps) {
	if (hidden) {
		return null;
	}

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-text/[0.15] transition-all duration-200">
			<span className={`font-medium transition-colors ${disabled ? 'text-text/30' : 'text-text/80 group-hover:text-text'}`}>
				{label}
			</span>
			<button
				type="button"
				disabled={disabled}
				className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 ${isActive
					? 'bg-primary border-primary shadow-lg shadow-primary/30'
					: 'bg-button border-text/[0.1] hover:bg-button'
					} ${disabled ? 'opacity-30 cursor-not-allowed transform-none' : 'cursor-pointer'}`}
				onClick={onClick}
			>
				<div
					className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ${isActive ? 'translate-x-5 shadow-white/20' : 'translate-x-0.5'
						}`}
				/>
			</button>
		</div>
	);
}

interface ExtrasSelectProps {
	label: string;
	value: string;
	options: { label: string; value: string }[];
	hidden?: boolean;
	openUp?: boolean;
	onChange: (val: string) => void;
}

function ExtrasSelect({ label, value, options, hidden, openUp, onChange }: ExtrasSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	if (hidden) return null;

	const selectedLabel = options.find(o => o.value === value)?.label || value;

	return (
		<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] transition-all duration-200 hover:border-text/[0.15]">
			<span className="font-medium text-text/80 group-hover:text-text transition-colors">
				{label}
			</span>
			<div className="relative" ref={containerRef}>
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 min-w-[120px] justify-between border ${isOpen
							? 'bg-button border-primary/50 text-text'
							: 'bg-button border-text/[0.1] text-text/70 hover:bg-button hover:text-text hover:border-text/[0.15]'
						}`}
				>
					<span>{selectedLabel}</span>
					{isOpen ? <CaretUp weight="bold" className="text-primary" /> : <CaretDown weight="bold" className="text-text/50 group-hover:text-text/80" />}
				</button>

				{isOpen && (
					<div className={`absolute right-0 w-48 rounded-xl bg-module border border-text/[0.1] shadow-xl shadow-black/40 z-50 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100 ${openUp ? 'bottom-full mb-2 origin-bottom-right' : 'mt-2 origin-top-right'}`}>
						<div className="py-1">
							{options.map((option) => (
								<button
									key={option.value}
									className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group/item ${option.value === value
											? 'bg-primary/10 text-primary font-medium'
											: 'text-text/70 hover:bg-text/[0.05] hover:text-text'
										}`}
									onClick={() => {
										onChange(option.value);
										setIsOpen(false);
									}}
								>
									<span>{option.label}</span>
									{option.value === value && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary-color),0.5)]"></div>}
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

interface ExtrasTabProps {
	// Hide mobile timer module selectors when opened from FriendlyRoom (room).
	// This setting is for the Timer page's mobile view — the room has its own layout.
	hideMobileModules?: boolean;
	// Hide smart cube-specific settings in FriendlyRoom (multi-phase analysis, recognition times)
	// — the room's smart cube flow uses LiveAnalysisOverlay and recognition, but the settings
	// remain ineffective because the room has its own flow.
	hideSmartCubeFeatures?: boolean;
	// Hide slam-to-stop in FriendlyRoom — the room stops via RoomTimerOverlay,
	// not KeyWatcher, so the setting would be ineffective there.
	hideSlamStop?: boolean;
}

export default function ExtrasTab({
	hideMobileModules = false,
	hideSmartCubeFeatures = false,
	hideSlamStop = false,
}: ExtrasTabProps = {}) {
	const { t } = useTranslation();
	const inspection = useSettings('inspection');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');
	const hapticFeedback = useSettings('haptic_feedback');
	const timerType = useSettings('timer_type');
	const freezeTime = useSettings('freeze_time');
	const analysisMode = useSettings('smart_cube_analysis_mode');
	const showRecognition = useSettings('smart_cube_show_recognition');
	const mobileModules = useSettings('mobile_timer_modules');
	const streamerMode = useSettings('streamer_mode');
	const mobileMode = useGeneral('mobile_mode');
	const manualEntry = useSettings('manual_entry');
	const slamStop = useSlamStop();
	const me = useMe();
	const dispatch = useDispatch();

	// Device-local setting (NOT a synced Redux setting) — only meaningful where
	// the touch timer + KeyWatcher stop path is active. Availability check keeps
	// it hidden on old binaries that don't ship the native plugin yet.
	const slamVisible = isSlamDetectorAvailable() && timerType === 'keyboard' && !manualEntry && !hideSlamStop;
	// Pro feature: shown to everyone (visible-but-locked), but non-Pro users get a
	// "Pro" badge + upsell modal instead of the toggle. PRO_ENABLED=false → no gate.
	const slamProGated = isProEnabled() && isNotPro(me);

	const extrasOptions = [
		{
			label: t('quick_controls.inspection'),
			isActive: inspection,
			hidden: false,
			onClick: () => toggleSetting('inspection'),
		},
		{
			label: t('quick_controls.hide_time_when_solving'),
			isActive: hideTimeWhenSolving,
			hidden: false,
			onClick: () => toggleSetting('hide_time_when_solving'),
		},
		{
			label: t('quick_controls.haptic_feedback'),
			isActive: hapticFeedback,
			hidden: !isNative(),
			onClick: () => toggleSetting('haptic_feedback'),
		},
		{
			label: t('quick_controls.show_recognition_split'),
			isActive: !!showRecognition,
			// Bu ozellik desktop-only (label "(masaustu)") — mobilde de gizle
			hidden: timerType !== 'smart' || hideSmartCubeFeatures || mobileMode,
			onClick: () => toggleSetting('smart_cube_show_recognition'),
		},
		{
			label: t('quick_controls.streamer_mode'),
			isActive: !!streamerMode,
			// Desktop = header butonu; mobilde burada. Sadece izinli kullanicilara.
			hidden: !canUseStreamerMode(me) || !mobileMode,
			onClick: () => toggleSetting('streamer_mode'),
		},
	];

	const MODULE_LABELS: Record<string, string> = {
		[TimerModuleType.HISTORY]: t('timer_modules.history'),
		[TimerModuleType.SCRAMBLE]: t('timer_modules.scramble'),
		[TimerModuleType.CROSS_SOLVER]: t('timer_modules.cross_solver'),
		[TimerModuleType.SOLVE_GRAPH]: t('timer_modules.solve_graph'),
		[TimerModuleType.TIME_DISTRO]: t('timer_modules.time_distro'),
		[TimerModuleType.PHASE_ANALYSIS]: t('timer_modules.phase_analysis'),
	};

	function handleModuleChange(index: number, value: string) {
		const next = [...(mobileModules || [TimerModuleType.HISTORY, TimerModuleType.SCRAMBLE])];
		next[index] = value as TimerModuleType;
		setSetting('mobile_timer_modules', next);
	}

	function moduleOptions(currentIndex: number) {
		const current = mobileModules?.[currentIndex];
		const other = mobileModules?.[currentIndex === 0 ? 1 : 0];
		return MOBILE_MODULE_OPTIONS
			.filter((opt) => opt === current || opt !== other)
			.map((opt) => ({ label: MODULE_LABELS[opt], value: opt as string }));
	}

	const slot0 = mobileModules?.[0] || TimerModuleType.HISTORY;
	const slot1 = mobileModules?.[1] || TimerModuleType.SCRAMBLE;

	const analysisOptions = [
		{ label: t('quick_controls.none'), value: 'none' },
		{ label: 'CFOP', value: 'cfop' },
		{ label: 'CF+OP', value: 'cf_plus_op' }, // Multi-phase (4 steps: Cross, F2L, OLL, PLL)
		{ label: 'CFFFFOP', value: 'cffffop' }, // F2L Split (Cross, F2L1, F2L2, F2L3, F2L4, OLL, PLL)
		{ label: 'CFFFFOOPP', value: 'cffffoopp' }, // Detailed (Cross, F2L1...4, 2-look OLL/PLL?) - User requested name.
	].filter((opt) => !(mobileMode && opt.value === 'cffffoopp')); // On mobile, 11 lines don't fit, cffffoopp hidden

	return (
		<div className="space-y-3">
			<div className="flex items-center space-x-1.5 mb-1">
				<div className="h-1.5 w-1.5 bg-primary rounded-full"></div>
				<p className="text-text/50 text-xs font-medium">
					{t('quick_controls.extras_description')}
				</p>
			</div>
			{extrasOptions.map((option) => (
				<ExtrasOption
					key={option.label}
					label={option.label}
					isActive={option.isActive}
					hidden={option.hidden}
					onClick={option.onClick}
				/>
			))}

			{slamVisible && slamProGated ? (
				// Visible-but-locked: tap anywhere on the row opens the Pro upsell modal
				<button
					type="button"
					onClick={() => openProOnlyModal(dispatch, t, 'slam_to_stop')}
					className="w-full group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-violet-500/40 transition-all duration-200"
				>
					<span className="font-medium text-text/80 group-hover:text-text transition-colors">
						{t('quick_controls.slam_to_stop')}
					</span>
					<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg shadow-violet-500/30">
						<Crown weight="fill" size={12} />
						Pro
					</span>
				</button>
			) : (
				<>
					<ExtrasOption
						label={t('quick_controls.slam_to_stop')}
						isActive={slamStop.enabled}
						hidden={!slamVisible}
						onClick={() => slamStop.setEnabled(!slamStop.enabled)}
					/>
					{slamVisible && slamStop.enabled && <SlamSensitivitySlider />}
				</>
			)}

			<ExtrasNumberInput
				label={t('quick_controls.freeze_time')}
				value={freezeTime ?? 0.2}
				step={0.1}
				min={0}
				onChange={(val) => setSetting('freeze_time', val)}
			/>

			<ExtrasSelect
				label={t('quick_controls.multi_phase')}
				value={analysisMode || 'none'}
				options={analysisOptions}
				hidden={timerType !== 'smart' || hideSmartCubeFeatures}
				openUp
				onChange={(val) => setSetting('smart_cube_analysis_mode', val)}
			/>

			<ExtrasSelect
				label={t('mobile_modules.slot_left')}
				value={slot0}
				options={moduleOptions(0)}
				hidden={!mobileMode || hideMobileModules}
				openUp
				onChange={(val) => handleModuleChange(0, val)}
			/>

			<ExtrasSelect
				label={t('mobile_modules.slot_right')}
				value={slot1}
				options={moduleOptions(1)}
				hidden={!mobileMode || hideMobileModules}
				openUp
				onChange={(val) => handleModuleChange(1, val)}
			/>
		</div>
	);
}
