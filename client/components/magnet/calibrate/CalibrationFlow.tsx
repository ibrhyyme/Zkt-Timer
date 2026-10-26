import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, Crosshair, DeviceMobile, HandPalm, Info, Magnet, Plug, Warning } from 'phosphor-react';
import block from '../../../styles/bem';
import { CALIBRATION_FLOW } from '../../../../shared/magnet_calibration';
import {
	buildCalibrationRow,
	CalibrationMeasurement,
	CalibrationMeter,
	CalibrationProgress,
	CalibrationStep,
} from '../../../util/magnet-start/calibration';
import { magnetService } from '../../../util/magnet-start/service';
import { getStoredFar } from '../../../util/magnet-start/settings';
import type { MagnetCapabilities, MagnetPlatform } from '../../../util/magnet-start/types';
import { magnetDeviceIdentity, MagnetDeviceIdentity } from '../../../util/magnet-start/device_model';
import { calibrationFor } from '../../../lib/cubes/active_cube';
import { getCubeState } from '../../../lib/cubes/store';
import { saveCubeCalibrationLocal } from '../../../lib/cubes/sync';
import { hapticImpact, hapticNotification } from '../../../util/native-plugins';
import { formatInteger } from '../../../util/locale_format';
import CalibrationArt, { CalibrationArtScene } from './CalibrationArt';
import {
	barFill,
	BEFORE_START,
	CAL_NS,
	canRetry,
	CheckItem,
	checkItemKey,
	failureKey,
	hintKey,
	measureBarScale,
	resultBar,
	stepBodyKey,
	stepNumber,
	stepTitleKey,
	sweepRing,
	troubleItems,
} from './calibration_view';

const b = block('magnet-calibrate');

interface Props {
	cubeId: string;
	cubeName: string;
	platform: MagnetPlatform;
	caps: MagnetCapabilities;
	/** After the measurement was saved (on this device; uploaded when possible). */
	onSaved: () => void;
	onClose: () => void;
}

function newMeter(platform: MagnetPlatform, caps: MagnetCapabilities): CalibrationMeter {
	// The app's baseline, for step 1's "cube away" light: the running detector's, or the one
	// stored on this phone when the stream has not started yet.
	const knownFar = magnetService.getSnapshot()?.far ?? getStoredFar(platform);
	return new CalibrationMeter(platform, { knownFar, maxRange: caps.maxRange ?? null });
}

/**
 * The three step measurement of design 5.7 on top of CalibrationMeter (calibration.ts). Holds
 * the magnetometer stream in calibrate mode for as long as it is mounted: nothing starts and
 * nothing reaches the telemetry study meanwhile. The page re-renders per sample batch (20 Hz at
 * most), coalesced to one render per frame.
 */
export default function CalibrationFlow({ cubeId, cubeName, platform, caps, onSaved, onClose }: Props) {
	const { t, i18n } = useTranslation();
	const meterRef = useRef<CalibrationMeter | null>(null);
	if (!meterRef.current) meterRef.current = newMeter(platform, caps);
	const [progress, setProgress] = useState<CalibrationProgress>(() => meterRef.current!.progress());
	const [identity, setIdentity] = useState<MagnetDeviceIdentity | null>(null);
	const [saving, setSaving] = useState(false);
	const frameRef = useRef<number | null>(null);
	const stepRef = useRef<CalibrationStep>(progress.step);

	/** This phone already has a calibration of the cube: the new one replaces it. */
	const hadCalibration = useRef(false);

	// This phone's key: the same one the timer looks the calibration up with.
	useEffect(() => {
		let alive = true;
		magnetDeviceIdentity(platform).then((id) => {
			if (!alive) return;
			hadCalibration.current = !!calibrationFor(getCubeState(), cubeId, platform, id.deviceModel);
			setIdentity(id);
		});
		return () => {
			alive = false;
		};
	}, [platform, cubeId]);

	// The stream, in calibrate mode, and the samples into the meter.
	useEffect(() => {
		const release = magnetService.acquire('calibrate');
		const unsubscribe = magnetService.subscribeSamples((samples) => {
			const meter = meterRef.current;
			if (!meter) return;
			meter.push(samples);
			if (frameRef.current !== null) return;
			frameRef.current = window.requestAnimationFrame(() => {
				frameRef.current = null;
				if (meterRef.current) setProgress(meterRef.current.progress());
			});
		});
		return () => {
			unsubscribe();
			release();
			if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		};
	}, []);

	// A little feedback when the flow moves on by itself (rest captured, done, failed).
	useEffect(() => {
		const prev = stepRef.current;
		stepRef.current = progress.step;
		if (prev === progress.step) return;
		if (progress.step === 'done') {
			// The app's baseline is re-learned here, not on "Başla" (5.7 step 1): only now is it
			// proven that the reading is the cube-away field (the away step saw it come back to F).
			// On a phone without a stored baseline step 1 cannot tell whether the cube is near, and
			// a baseline learned with the cube at the phone inverts the detector for the timer: the
			// cube put down at the phone would read as a lift and start a solve.
			magnetService.relearnFar();
			void hapticNotification('success');
		}
		else if (progress.step === 'failed') void hapticNotification('error');
		else if (progress.step === 'away' || progress.step === 'rest') void hapticImpact('light');
	}, [progress.step]);

	const refresh = useCallback(() => {
		if (meterRef.current) setProgress(meterRef.current.progress());
	}, []);

	function onStart() {
		const meter = meterRef.current;
		if (!meter || !meter.start()) return refresh();
		// The app's baseline is re-learned when the measurement is done (see the step effect).
		void hapticImpact('light');
		refresh();
	}

	function onFinish() {
		const meter = meterRef.current;
		if (meter) meter.finish();
		refresh();
	}

	function onRetry() {
		meterRef.current = newMeter(platform, caps);
		setSaving(false);
		refresh();
	}

	function onSave(m: CalibrationMeasurement) {
		if (saving || !identity?.deviceModel) return;
		setSaving(true);
		saveCubeCalibrationLocal(
			buildCalibrationRow(m, {
				cubeId,
				deviceModel: identity.deviceModel,
				osVersion: identity.osVersion,
				appVersion: identity.appVersion,
				sensorName: caps.name ?? null,
			})
		);
		onSaved();
	}

	const num = (value: number | null) => (value === null ? '' : formatInteger(Math.round(value), i18n.language));
	const step = progress.step;
	const n = stepNumber(step);
	const measurement = step === 'done' ? meterRef.current?.result() ?? null : null;
	const hint = hintKey(progress);
	const trouble = step === 'failed' ? troubleItems(progress.failure) : [];

	return (
		<div className={b('flow')}>
			{n !== null ? (
				<div className={b('steps')}>
					<span className={b('step-count')}>{t(`${CAL_NS}.step_of`, { step: n, total: 3 })}</span>
					<span className={b('step-dots')} aria-hidden="true">
						{[1, 2, 3].map((i) => (
							<span key={i} className={b('step-dot', { done: i < n, current: i === n })} />
						))}
					</span>
				</div>
			) : null}

			<h2 className={b('title')}>{t(stepTitleKey(step))}</h2>

			{step === 'steady' || step === 'sweep' || step === 'rest' || step === 'away' ? (
				<StepBody
					progress={progress}
					step={step}
					hint={hint}
					cubeName={cubeName}
					recalibrating={hadCalibration.current}
					num={num}
					onStart={onStart}
					onFinish={onFinish}
				/>
			) : null}

			{measurement ? (
				<Result
					m={measurement}
					cubeName={cubeName}
					num={num}
					saving={saving}
					canSave={!!identity?.deviceModel}
					onSave={() => onSave(measurement)}
					onRetry={onRetry}
				/>
			) : null}

			{step === 'failed' ? (
				<div className={b('result')}>
					<p className={b('text')} role="alert">
						{t(failureKey(progress.failure))}
					</p>
					{trouble.length ? <Checklist title={t(`${CAL_NS}.trouble_title`)} items={trouble} /> : null}
					<div className={b('actions')}>
						{canRetry(progress.failure) ? (
							<button type="button" className={b('primary')} onClick={onRetry}>
								{t(`${CAL_NS}.retry`)}
							</button>
						) : null}
						<button type="button" className={b('secondary')} onClick={onClose}>
							{t(`${CAL_NS}.close`)}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

interface StepBodyProps {
	progress: CalibrationProgress;
	step: 'steady' | 'sweep' | 'rest' | 'away';
	hint: string | null;
	cubeName: string;
	recalibrating: boolean;
	num: (value: number | null) => string;
	onStart: () => void;
	onFinish: () => void;
}

function StepBody({ progress, step, hint, cubeName, recalibrating, num, onStart, onFinish }: StepBodyProps) {
	const { t } = useTranslation();
	const bodyKey = stepBodyKey(step);
	const scene: CalibrationArtScene = step;
	const scale = measureBarScale(progress.peak, progress.live);
	const showBar = step !== 'steady' && progress.live !== null;

	return (
		<>
			<div className={b('art')}>
				<CalibrationArt scene={scene} />
			</div>

			{step === 'steady' ? (
				<p className={b('text')}>{t(`${CAL_NS}.intro`, { cube: cubeName })}</p>
			) : null}
			{bodyKey ? <p className={b('instruction')}>{t(bodyKey)}</p> : null}
			{step === 'steady' ? <Checklist title={t(`${CAL_NS}.before_title`)} items={BEFORE_START} /> : null}
			{step === 'sweep' ? (
				<p className={b('info')}>
					<Info weight="bold" aria-hidden="true" />
					{t(`${CAL_NS}.sensor_note`)}
				</p>
			) : null}

			{step === 'steady' ? (
				<ul className={b('lights')}>
					<Light on={progress.steady} label={t(`${CAL_NS}.light_steady`)} />
					{progress.cubeAway !== null ? <Light on={progress.cubeAway} label={t(`${CAL_NS}.light_away`)} /> : null}
				</ul>
			) : null}

			{showBar ? (
				<div className={b('meter')}>
					<div className={b('bar')} role="presentation">
						<span className={b('bar-fill')} style={{ transform: `scaleX(${barFill(progress.live, scale)})` }} />
						{step === 'sweep' && progress.peak ? (
							<span className={b('bar-peak')} style={{ left: `${barFill(progress.peak, scale) * 100}%` }} />
						) : null}
					</div>
					<span className={b('value')}>{num(progress.live)}</span>
				</div>
			) : null}

			{step === 'sweep' ? (
				<div className={b('sweep-info')}>
					<span className={b('peak')}>{t(`${CAL_NS}.peak`, { value: num(progress.peak ?? 0) })}</span>
					<Ring share={sweepRing(progress.sweepMs, CALIBRATION_FLOW.sweepMaxMs)} />
				</div>
			) : null}

			{step === 'rest' ? (
				<ul className={b('lights')}>
					<Light
						on={progress.holdMs >= CALIBRATION_FLOW.plateauHoldMs}
						label={t(`${CAL_NS}.light_hold`)}
						share={Math.min(1, progress.holdMs / CALIBRATION_FLOW.plateauHoldMs)}
					/>
				</ul>
			) : null}

			{hint ? (
				<p className={b('hint')} role="status">
					{t(hint)}
				</p>
			) : null}
			{progress.noisy && progress.issue !== 'noisy' ? (
				<p className={b('warning')} role="status">
					<Warning weight="bold" aria-hidden="true" />
					{t(`${CAL_NS}.warning_noisy`)}
				</p>
			) : null}
			{step === 'steady' && recalibrating ? <p className={b('note')}>{t(`${CAL_NS}.replaces_previous`)}</p> : null}

			{step === 'steady' ? (
				<div className={b('actions')}>
					<button type="button" className={b('primary')} disabled={!progress.canStart} onClick={onStart}>
						{t(`${CAL_NS}.start`)}
					</button>
				</div>
			) : null}
			{step === 'sweep' ? (
				<div className={b('actions')}>
					<button
						type="button"
						className={b('primary', { flash: progress.settled && progress.canFinish })}
						disabled={!progress.canFinish}
						onClick={onFinish}
					>
						{t(`${CAL_NS}.finish`)}
					</button>
				</div>
			) : null}
		</>
	);
}

const CHECK_ICONS: Record<CheckItem, React.ElementType> = {
	case: DeviceMobile,
	magnets: Magnet,
	charging: Plug,
	still: HandPalm,
	corners: Crosshair,
};

/** The things on and around the phone that spoil a measurement, as a short list. */
function Checklist({ title, items }: { title: string; items: CheckItem[] }) {
	const { t } = useTranslation();
	return (
		<section className={b('checklist')}>
			<h3 className={b('checklist-title')}>{title}</h3>
			<ul className={b('checklist-items')}>
				{items.map((item) => {
					const Icon = CHECK_ICONS[item];
					return (
						<li key={item} className={b('checklist-item')}>
							<Icon weight="bold" aria-hidden="true" />
							<span>{t(checkItemKey(item))}</span>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function Light({ on, label, share }: { on: boolean; label: string; share?: number }) {
	return (
		<li className={b('light', { on })}>
			{on ? <CheckCircle weight="fill" aria-hidden="true" /> : <Circle weight="bold" aria-hidden="true" />}
			<span>{label}</span>
			{share !== undefined && !on ? (
				<span className={b('light-progress')} aria-hidden="true">
					<span style={{ transform: `scaleX(${share})` }} />
				</span>
			) : null}
		</li>
	);
}

function Ring({ share }: { share: number }) {
	const r = 15;
	const c = 2 * Math.PI * r;
	return (
		<svg className={b('ring')} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
			<circle className={b('ring-track')} cx="18" cy="18" r={r} />
			<circle
				className={b('ring-value')}
				cx="18"
				cy="18"
				r={r}
				strokeDasharray={`${c} ${c}`}
				strokeDashoffset={c * (1 - share)}
				transform="rotate(-90 18 18)"
			/>
		</svg>
	);
}

interface ResultProps {
	m: CalibrationMeasurement;
	cubeName: string;
	num: (value: number | null) => string;
	saving: boolean;
	canSave: boolean;
	onSave: () => void;
	onRetry: () => void;
}

function Result({ m, cubeName, num, saving, canSave, onSave, onRetry }: ResultProps) {
	const { t } = useTranslation();
	const bar = resultBar(m);
	return (
		<div className={b('result')}>
			<p className={b('text')}>
				{t(`${CAL_NS}.result_body`, { cube: cubeName, rest: num(m.rest_ut), near: num(m.near_min_ut) })}
			</p>
			<div className={b('bar', { result: true, weak: m.quality === 'weak' })} role="presentation">
				<span className={b('bar-fill')} style={{ transform: `scaleX(${bar.fill})` }} />
				<span className={b('bar-line')} style={{ left: `${bar.line * 100}%` }} />
			</div>
			{m.quality === 'weak' ? <p className={b('hint')}>{t(`${CAL_NS}.result_weak`)}</p> : null}
			<p className={b('text')}>{t(`${CAL_NS}.result_tip`)}</p>
			{m.noisy ? (
				<p className={b('warning')}>
					<Warning weight="bold" aria-hidden="true" />
					{t(`${CAL_NS}.warning_noisy`)}
				</p>
			) : null}
			<div className={b('actions')}>
				<button type="button" className={b('primary')} disabled={saving || !canSave} onClick={onSave}>
					{t(`${CAL_NS}.save`)}
				</button>
				<button type="button" className={b('secondary')} disabled={saving} onClick={onRetry}>
					{t(`${CAL_NS}.retry`)}
				</button>
			</div>
		</div>
	);
}
