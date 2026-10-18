import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { DeviceMobile } from 'phosphor-react';
import block from '../../../../styles/bem';
import { useMagnetStatus } from '../../../../util/magnet-start/status_store';
import { magnetService } from '../../../../util/magnet-start/service';
import { markMagnetHoldHintSeen, useMagnetStartSettings } from '../../../../util/magnet-start/settings';
import type { MagnetCubeProfile } from '../../../../util/magnet-start/cube_profile';
import { useCubes } from '../../../../lib/cubes/store';
import { cubesForPuzzle } from '../../../../lib/cubes/active_cube';
import { chooseMainCube } from '../../../../lib/cubes/sync';
import { getCustomCubeTypes } from '../../../../util/cubes/util';
import { puzzleLabel } from '../../../settings/cubes/cube_labels';
import { useCubeActions } from '../../../settings/cubes/cube_actions';
import { magnetGuideView } from './guide_state';
import './MagnetGuide.scss';

const b = block('magnet-guide');

/** How long "Taban yenilendi" stays after a successful re-learn (5.6 #8). */
const RELEARN_DONE_MS = 1500;

function calibrateLink(cubeId: string): string {
	return `/magnet/calibrate?cube=${encodeURIComponent(cubeId)}`;
}

function CardAction({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button type="button" className={b('action')} onClick={onClick}>
			{label}
		</button>
	);
}

/** #4 "Hangi küple çözüyorsun?": the cubes of this puzzle, one tap makes one the main. */
function ChooseMainCard({ puzzle }: { puzzle: string }) {
	const { t } = useTranslation();
	const state = useCubes();
	const cubes = useMemo(() => cubesForPuzzle(puzzle, state), [puzzle, state]);

	return (
		<div className={b('card')}>
			<p className={b('card-text')}>{t('magnet_guide.no_main')}</p>
			<div className={b('cubes')}>
				{cubes.map((cube) => (
					<button key={cube.id} type="button" className={b('cube')} onClick={() => chooseMainCube(puzzle, cube.id)}>
						<span className="min-w-0 truncate">{cube.name}</span>
						{cube.brand && <span className={b('cube-brand')}>{cube.brand}</span>}
					</button>
				))}
			</div>
		</div>
	);
}

/** #5 the main cube has no calibration on this phone model. Mandatory, no "skip for now". */
function CalibrateCard({ profile }: { profile: MagnetCubeProfile }) {
	const { t } = useTranslation();
	const history = useHistory();
	const { introDone } = useMagnetStartSettings();
	const name = profile.cubeName || '';

	return (
		<div className={b('card')}>
			{/* Members who used lift to start before calibration existed have done a Magnet solve
			    (introDone): one plain sentence tells them why the timer now asks for it. */}
			{introDone && !profile.recalibrate && <p className={b('card-note')}>{t('magnet_guide.calibration_now_required')}</p>}
			<p className={b('card-text')}>
				{profile.recalibrate
					? t('magnet_guide.recalibrate', { cube: name })
					: t('magnet_guide.no_calibration', { cube: name })}
			</p>
			{profile.cubeId && (
				<CardAction label={t('magnet_guide.calibrate')} onClick={() => history.push(calibrateLink(profile.cubeId as string))} />
			)}
		</div>
	);
}

/** #8 the far baseline is unknown: a real button, never a touch on the timer (1.6-k). */
function RelearnCard({ onDone }: { onDone: () => void }) {
	const { t } = useTranslation();
	const [failed, setFailed] = useState(false);

	function relearn() {
		const ok = magnetService.relearnFar();
		setFailed(!ok);
		if (ok) onDone();
	}

	return (
		<div className={b('card')}>
			<p className={b('card-text')}>{t('magnet_guide.unknown')}</p>
			<CardAction label={t('time_display.magnet_relearn')} onClick={relearn} />
			{failed && <p className={b('card-note')}>{t('quick_controls.magnet_relearn_failed')}</p>}
		</div>
	);
}

interface Props {
	/**
	 * False during inspection. The mobile touch overlay (Timer.scss __touch-overlay, z-index
	 * 9999) covers the page while inspection counts down, so a button drawn here could not be
	 * reached (1.6-l), and re-learning the baseline needs the cube away from the phone.
	 */
	canAct: boolean;
}

/**
 * Magnet Timer guide under the digits (design magnet-cubes 5.6): one card when the user has to
 * do something (add a cube, choose one, calibrate it, re-learn the baseline), otherwise at most
 * one short line. Routine lines go quiet after the first solve started by lifting the cube;
 * from then on the colour of the digits and of the live bar speaks.
 *
 * Replaces MagnetHint. The root class is in touch_target.ts BLOCKED_CLASSES, so no touch on the
 * guide ever reaches the timer, and every action is a <button> on top of that.
 */
export default function MagnetGuide({ canAct }: Props) {
	const { t } = useTranslation();
	const history = useHistory();
	const status = useMagnetStatus();
	const { introDone, holdHintSeen } = useMagnetStartSettings();
	const { openAdd } = useCubeActions();
	const customTypes = useMemo(() => getCustomCubeTypes(), []);

	// "Taban yenilendi" for a moment after a successful re-learn.
	const [relearnDone, setRelearnDone] = useState(false);
	const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (doneTimer.current) clearTimeout(doneTimer.current);
		},
		[]
	);
	function showRelearnDone() {
		setRelearnDone(true);
		if (doneTimer.current) clearTimeout(doneTimer.current);
		doneTimer.current = setTimeout(() => setRelearnDone(false), RELEARN_DONE_MS);
	}

	const view = magnetGuideView({
		profile: status.profile,
		active: status.active,
		stage: status.stage,
		moving: status.moving,
		introDone,
		holdHintSeen,
		canAct,
	});

	// Hold to stop is taught once (after the first Magnet solve), counted as seen when it leaves
	// the screen: the next inspection or solve starts, or the page closes.
	useEffect(() => {
		if (!view.holdHint) return undefined;
		return () => markMagnetHoldHintSeen();
	}, [view.holdHint]);

	const profile = status.profile;
	let body: React.ReactNode = null;

	switch (view.card) {
		case 'no_cubes':
			body = (
				<div className={b('card')}>
					<p className={b('card-text')}>{t('magnet_guide.no_cubes')}</p>
					<CardAction label={t('magnet_guide.go_to_cubes')} onClick={() => history.push('/settings/cubes')} />
				</div>
			);
			break;
		case 'no_puzzle_cube': {
			const puzzle = profile?.puzzle || null;
			body = (
				<div className={b('card')}>
					<p className={b('card-text')}>
						{t('magnet_guide.no_puzzle_cube', { puzzle: puzzle ? puzzleLabel(puzzle, customTypes) : '' })}
					</p>
					{/* The form opens over the timer with this puzzle chosen; saving makes the first
					    cube of a puzzle its main, so the guide moves on to calibration. */}
					<CardAction label={t('magnet_guide.add_cube')} onClick={() => openAdd({ puzzle })} />
				</div>
			);
			break;
		}
		case 'no_main':
			body = profile?.puzzle ? <ChooseMainCard puzzle={profile.puzzle} /> : null;
			break;
		case 'no_calibration':
			body = profile ? <CalibrateCard profile={profile} /> : null;
			break;
		case 'relearn':
			body = <RelearnCard onDone={showRelearnDone} />;
			break;
		default:
			break;
	}

	if (!body) {
		const line = relearnDone ? 'quick_controls.magnet_relearn_done' : view.line;
		if (!line && !view.holdHint) return null;
		body = (
			<>
				{line && (
					<span className={b('line')}>
						{view.moving && !relearnDone && (
							<span className={b('phone')} aria-hidden="true">
								<DeviceMobile weight="bold" size={16} />
							</span>
						)}
						{t(line)}
					</span>
				)}
				{view.holdHint && <div className={line ? b('sub') : b('line')}>{t('time_display.magnet_hold_stop_hint')}</div>}
			</>
		);
	}

	return <div className={b()}>{body}</div>;
}
