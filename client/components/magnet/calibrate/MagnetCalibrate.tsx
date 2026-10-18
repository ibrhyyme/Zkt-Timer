import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { CaretLeft } from 'phosphor-react';
import './MagnetCalibrate.scss';
import block from '../../../styles/bem';
import { useMe } from '../../../util/hooks/useMe';
import { canUseMagnetStart } from '../../../lib/magnet-start-access';
import { useCubes } from '../../../lib/cubes/store';
import { refreshCubes } from '../../../lib/cubes/sync';
import { cubeById } from '../../../lib/cubes/active_cube';
import { magnetPlatform, probeMagnetDetector } from '../../../util/magnet-start/plugin';
import { useMagnetStartSettings } from '../../../util/magnet-start/settings';
import type { MagnetCapabilities, MagnetPlatform } from '../../../util/magnet-start/types';
import { REVERSED_BODY_CLASS, supportsRotate } from '../../../util/reversed-ui';
import { allowScreenSleep, keepScreenAwake } from '../../../util/native-plugins';
import { toastSuccess } from '../../../util/toast';
import { getCustomCubeTypes } from '../../../util/cubes/util';
import { cubeProfileLink, puzzleLabel } from '../../settings/cubes/cube_labels';
import CalibrationFlow from './CalibrationFlow';
import { CAL_NS, parseCalibrateLink } from './calibration_view';

const b = block('magnet-calibrate');

/**
 * /magnet/calibrate?cube=<id> (design .feedback/designs/magnet-cubes.md 5.7): measures how strong
 * a cube's magnets look on this phone where it rests, so the Magnet Timer gets thresholds that
 * fit it. Calibration is required for every cube (owner decision Q2), so the timer's guide card
 * and the cube profile both lead here. Pro (with admins), app only, phone with the magnet sensor.
 *
 * The measurement itself runs as a full screen page over the app shell (a native feel, not a
 * modal), turned 180 degrees when the person uses the phone upside down, like the timer.
 */
export default function MagnetCalibrate() {
	const { t } = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const me = useMe();
	const state = useCubes();
	const { cubeId } = parseCalibrateLink(location.search);

	// Read after mount: the server render has no platform, the first client render must match it.
	const [platform, setPlatform] = useState<MagnetPlatform | null>(null);
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setPlatform(magnetPlatform());
		setMounted(true);
	}, []);

	const allowed = canUseMagnetStart(me);
	const caps = useSensor(allowed ? platform : null);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		let alive = true;
		refreshCubes().finally(() => {
			if (alive) setLoading(false);
		});
		return () => {
			alive = false;
		};
	}, []);

	const cube = cubeById(state, cubeId);
	const customTypes = useMemo(() => getCustomCubeTypes(), []);
	const ready = mounted && allowed && !!platform && !!caps && !!cube && !cube.archived_at;

	const { reversed: reversedSetting } = useMagnetStartSettings();
	const reversed = ready && reversedSetting && supportsRotate();
	useReversedBody(reversed);
	useScreenAwake(ready);

	function leave() {
		if (typeof window !== 'undefined' && window.history.length > 1) history.goBack();
		else history.push(cube ? cubeProfileLink(cube.id) : '/settings/cubes');
	}

	function onSaved() {
		toastSuccess(t(`${CAL_NS}.saved`));
		leave();
	}

	if (ready && cube && platform && caps) {
		return (
			<div className={b({ reversed })}>
				<div className={b('screen')}>
					<Header title={t(`${CAL_NS}.title`)} subtitle={`${cube.name} · ${puzzleLabel(cube.puzzle, customTypes)}`} onBack={leave} />
					<CalibrationFlow
						cubeId={cube.id}
						cubeName={cube.name}
						platform={platform}
						caps={caps}
						onSaved={onSaved}
						onClose={leave}
					/>
				</div>
			</div>
		);
	}

	// Everything that stops the flow: an inline page inside the app shell.
	let message: React.ReactNode;
	if (!mounted || (allowed && platform && caps === undefined)) {
		message = <p className={b('message')}>{t(`${CAL_NS}.checking`)}</p>;
	} else if (!allowed) {
		message = (
			<>
				<p className={b('message')}>{t(`${CAL_NS}.pro_only`)}</p>
				<Link to="/pro" className={b('link')}>
					{t(`${CAL_NS}.pro_link`)}
				</Link>
			</>
		);
	} else if (!platform) {
		message = <p className={b('message')}>{t('cubes.magnet_web_note')}</p>;
	} else if (!caps) {
		message = <p className={b('message')}>{t(`${CAL_NS}.no_sensor`)}</p>;
	} else if (!cube) {
		message = (
			<p className={b('message')}>{loading && !state.fetchedAt ? t('cubes.loading') : t('cubes.profile_not_found')}</p>
		);
	} else {
		message = <p className={b('message')}>{t(`${CAL_NS}.archived`)}</p>;
	}

	return (
		<div className={b('inline')}>
			<Header title={t(`${CAL_NS}.title`)} subtitle={cube ? cube.name : null} onBack={leave} />
			{message}
		</div>
	);
}

/**
 * The magnet sensor of this phone: undefined while the (cached) probe runs, null when there is
 * none (old binary without the plugin, no uncalibrated magnetometer) or no platform.
 */
function useSensor(platform: MagnetPlatform | null): MagnetCapabilities | null | undefined {
	const [caps, setCaps] = useState<MagnetCapabilities | null | undefined>(undefined);
	useEffect(() => {
		if (!platform) {
			setCaps(null);
			return;
		}
		let alive = true;
		setCaps(undefined);
		probeMagnetDetector().then((result) => {
			if (alive) setCaps(result && result.available ? result : null);
		});
		return () => {
			alive = false;
		};
	}, [platform]);
	return caps;
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string | null; onBack: () => void }) {
	const { t } = useTranslation();
	return (
		<div className={b('header')}>
			<button type="button" className={b('back')} aria-label={t(`${CAL_NS}.back`)} onClick={onBack}>
				<CaretLeft weight="bold" />
			</button>
			<div className={b('heading')}>
				<h1 className={b('page-title')}>{title}</h1>
				{subtitle ? <span className={b('subtitle')}>{subtitle}</span> : null}
			</div>
		</div>
	);
}

/**
 * Reversed use (client/util/reversed-ui.ts): the page turns itself (MagnetCalibrate.scss), and
 * the body class swaps the safe areas and turns modals and toasts, the same as on the timer.
 * The timer is not mounted on this route, so nothing else holds the class meanwhile.
 */
function useReversedBody(reversed: boolean) {
	useEffect(() => {
		if (!reversed || typeof document === 'undefined') return;
		document.body.classList.add(REVERSED_BODY_CLASS);
		return () => {
			document.body.classList.remove(REVERSED_BODY_CLASS);
		};
	}, [reversed]);
}

/** The flow takes up to a minute with nobody touching the screen. */
function useScreenAwake(active: boolean) {
	useEffect(() => {
		if (!active) return;
		void keepScreenAwake();
		return () => {
			void allowScreenSleep();
		};
	}, [active]);
}
