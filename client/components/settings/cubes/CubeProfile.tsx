import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Link, useHistory, useParams } from 'react-router-dom';
import { CaretLeft, CaretRight, DotsThree, Trash } from 'phosphor-react';
import './MyCubes.scss';
import block from '../../../styles/bem';
import { openModal } from '../../../actions/general';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import { useCubes } from '../../../lib/cubes/store';
import { deleteCubeCalibrationOnline, refreshCubes } from '../../../lib/cubes/sync';
import {
	calibrationFor,
	cubeById,
	LocalCalibration,
	mainCubeFor,
	sameCalibrationKey,
} from '../../../lib/cubes/active_cube';
import { deriveThresholdsFromRow } from '../../../../shared/magnet_calibration';
import { useMe } from '../../../util/hooks/useMe';
import { useOnlineStatus } from '../../../util/hooks/useOnlineStatus';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { canUseMagnetStart } from '../../../lib/magnet-start-access';
import { magnetPlatform } from '../../../util/magnet-start/plugin';
import { useMagnetAvailability } from '../../../util/magnet-start/availability';
import { magnetDeviceModel } from '../../../util/magnet-start/device_model';
import { deviceModelDisplayName } from '../../../util/device-model-names';
import { fetchSolveCount, fetchSolves } from '../../../db/solves/query';
import { getCustomCubeTypes } from '../../../util/cubes/util';
import { formatInteger } from '../../../util/locale_format';
import { formatLastUsed, formatLongDay, formatShortDay, puzzleLabel } from './cube_labels';
import { useCubeActions } from './cube_actions';
import { cubeErrorMessage } from './cube_errors';
import { useCubeMenu } from './CubeMenu';

const b = block('cube-profile');

/**
 * Model key of this phone for calibrations: the Magnet Timer's own key (magnetDeviceModel, the
 * same one the timer and the calibration page use, with the iOS screen fallback), so this phone's
 * row is found here even on a binary without the Device plugin. null off the app.
 */
function useThisPhoneModel(enabled: boolean): string | null {
	const [model, setModel] = useState<string | null>(null);
	useEffect(() => {
		const platform = magnetPlatform();
		if (!enabled || !platform) {
			setModel(null);
			return;
		}
		let alive = true;
		magnetDeviceModel(platform)
			.then((key) => {
				if (alive) setModel(key);
			})
			.catch(() => {
				if (alive) setModel(null);
			});
		return () => {
			alive = false;
		};
	}, [enabled]);
	return model;
}

/** Local solve numbers of a cube (offline, or before the first server read; 5.3). */
function useLocalCubeNumbers(cubeId: string | null, enabled: boolean) {
	const solveDbCounter = useSolveDb();
	return useMemo(() => {
		if (!enabled || !cubeId) return null;
		try {
			const query = { cube_id: cubeId };
			const count = fetchSolveCount(query);
			const last = fetchSolves(query, { sortBy: 'ended_at', sortInverse: true, limit: 1 })[0];
			const first = fetchSolves(query, { sortBy: 'ended_at', sortInverse: false, limit: 1 })[0];
			return {
				count,
				lastUsed: last?.ended_at ? Number(last.ended_at) : null,
				firstUsed: first?.ended_at ? Number(first.ended_at) : null,
			};
		} catch {
			return null;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cubeId, enabled, solveDbCounter]);
}

/**
 * Cube profile, /settings/cubes/:id (design 5.3): solve count, last and first use, a link to the
 * cube's solves and, for members who can use the Magnet Timer, the magnet calibration per phone
 * model. On the app with the magnet sensor this phone's row offers (re)calibration; on the web
 * and on binaries without the plugin the calibrations are listed only.
 */
export default function CubeProfile() {
	const { t, i18n } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const history = useHistory();
	const dispatch = useDispatch();
	const me = useMe();
	const online = useOnlineStatus();
	const state = useCubes();
	const actions = useCubeActions();
	const menu = useCubeMenu();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let alive = true;
		refreshCubes({ force: true }).finally(() => {
			if (alive) setLoading(false);
		});
		return () => {
			alive = false;
		};
	}, []);

	const cube = cubeById(state, id);
	const customTypes = useMemo(() => getCustomCubeTypes(), []);

	const magnetAllowed = canUseMagnetStart(me);
	const platform = magnetPlatform();
	const caps = useMagnetAvailability(magnetAllowed && !!platform);
	const canCalibrateHere = magnetAllowed && !!platform && !!caps;
	// Web: the list only (calibrating needs the phone). App: the full section once the sensor
	// probe answers; an old binary without the plugin hides it (design 9.1).
	const showMagnet = magnetAllowed && (!platform || canCalibrateHere);
	const phoneModel = useThisPhoneModel(canCalibrateHere);

	// Server numbers count every solve of the cube; this device's copy may hold fewer (Basic
	// members keep history local). Used only when the server's are out of reach.
	const useLocal = !online || !state.fetchedAt;
	const local = useLocalCubeNumbers(cube?.id ?? null, useLocal);

	if (!cube) {
		return (
			<div className={b()}>
				<div className={b('header')}>
					<Link to="/settings/cubes" className={b('back')} aria-label={t('cubes.title')}>
						<CaretLeft weight="bold" />
					</Link>
					<h2 className={b('name')}>{t('cubes.title')}</h2>
				</div>
				<p className={b('message')}>{loading && !state.fetchedAt ? t('cubes.loading') : t('cubes.profile_not_found')}</p>
			</div>
		);
	}

	const isMain = mainCubeFor(cube.puzzle, state)?.id === cube.id;
	const menuItems = actions.menuItems(cube, isMain, () => history.replace('/settings/cubes'));

	const count = local ? local.count : cube.solve_count || 0;
	const lastUsed = local ? local.lastUsed : cube.last_used_at;
	const firstUsed = local ? local.firstUsed : cube.first_used_at;

	const subline = [
		puzzleLabel(cube.puzzle, customTypes),
		cube.brand,
		isMain ? t('cubes.badge_main') : null,
		cube.is_smart ? t('cubes.badge_smart') : null,
		cube.archived_at ? t('cubes.profile_archived') : null,
	].filter(Boolean);

	// Calibrations: the server's rows with measurements of this device still waiting for upload
	// laid over them (the newer one wins, as in calibrationFor).
	const calibrations: LocalCalibration[] = [];
	for (const row of cube.calibrations) {
		calibrations.push(calibrationFor(state, cube.id, row.platform, row.device_model) || row);
	}
	for (const pending of state.pendingCalibrations) {
		if (pending.cube_id !== cube.id || calibrations.some((row) => sameCalibrationKey(row, pending))) continue;
		const merged = calibrationFor(state, cube.id, pending.platform, pending.device_model);
		if (merged) calibrations.push(merged);
	}

	const thisPhone =
		canCalibrateHere && phoneModel ? calibrationFor(state, cube.id, platform, phoneModel) : null;
	const otherPhones = calibrations
		.filter((row) => !(thisPhone && sameCalibrationKey(row, thisPhone)))
		.sort((a, c) => c.measured_at - a.measured_at);

	function calibrateLink() {
		return `/magnet/calibrate?cube=${encodeURIComponent(cube.id)}`;
	}

	function confirmDeleteCalibration(row: LocalCalibration) {
		if (!row.id) return;
		const rowId = row.id;
		dispatch(
			openModal(
				<ConfirmModal
					hideInput
					buttonText={t('cubes.action_delete')}
					triggerAction={async () => {
						try {
							return await deleteCubeCalibrationOnline(rowId);
						} catch (err) {
							throw new Error(cubeErrorMessage(err, t));
						}
					}}
				/>,
				{
					title: t('cubes.magnet_delete_confirm', { model: deviceModelDisplayName(row.device_model) }),
					compact: true,
					width: 420,
				}
			)
		);
	}

	function calibrationValues(row: LocalCalibration) {
		const derived = deriveThresholdsFromRow(row);
		const rest = Math.round(row.rest_ut ?? row.peak_ut);
		const near = Math.round(derived?.nearMin ?? row.near_min_ut);
		return {
			rest: formatInteger(rest, i18n.language),
			near: formatInteger(near, i18n.language),
			weak: (derived?.quality ?? row.quality) === 'weak',
		};
	}

	const lastText = lastUsed ? formatLastUsed(lastUsed, i18n.language) : null;

	return (
		<div className={b()}>
			<div className={b('header')}>
				<Link to="/settings/cubes" className={b('back')} aria-label={t('cubes.title')}>
					<CaretLeft weight="bold" />
				</Link>
				<div className={b('heading')}>
					<h2 className={b('name')}>{cube.name}</h2>
					<span className={b('subline')}>{subline.join(' · ')}</span>
				</div>
				<button
					type="button"
					className={b('menu-button')}
					aria-label={t('cubes.menu_open', { name: cube.name })}
					onClick={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						menu.open({ title: cube.name, items: menuItems, x: rect.left, y: rect.bottom + 4 });
					}}
				>
					<DotsThree weight="bold" />
				</button>
			</div>

			<div className={b('card')}>
				<div className={b('numbers')}>
					<div className={b('number')}>
						<span className={b('number-value')}>{formatInteger(count, i18n.language)}</span>
						<span className={b('number-label')}>
							{t('cubes.profile_solves', { count })}
							{local ? <span className={b('local-note')}> ({t('cubes.profile_local_note')})</span> : null}
						</span>
					</div>
					<div className={b('number')}>
						<span className={b('number-value', { text: true })}>{lastText || t('cubes.profile_never')}</span>
						<span className={b('number-label')}>{t('cubes.profile_last')}</span>
					</div>
				</div>
				{firstUsed ? (
					<p className={b('first')}>{t('cubes.profile_first', { date: formatLongDay(firstUsed, i18n.language) })}</p>
				) : null}
				<Link to={`/solves?cube=${encodeURIComponent(cube.id)}`} className={b('solves-link')}>
					<span>{t('cubes.profile_solves_link')}</span>
					<CaretRight weight="bold" />
				</Link>
			</div>

			{showMagnet ? (
				<section className={b('card')} aria-labelledby="zt-cube-profile-magnet">
					<h3 id="zt-cube-profile-magnet" className={b('card-title')}>
						{t('cubes.magnet_title')}
					</h3>

					{canCalibrateHere ? (
						<div className={b('phone', { current: true })}>
							<div className={b('phone-main')}>
								<span className={b('phone-name')}>
									{t('cubes.magnet_this_phone', {
										model: deviceModelDisplayName(phoneModel) || t('cubes.magnet_this_phone_unknown'),
									})}
								</span>
								{thisPhone ? (
									<>
										<span className={b('phone-values')}>{t('cubes.magnet_values', calibrationValues(thisPhone))}</span>
										<span className={b('phone-date')}>
											{formatShortDay(thisPhone.measured_at, i18n.language)}
											{calibrationValues(thisPhone).weak ? ` · ${t('cubes.magnet_weak')}` : ''}
											{thisPhone.pending ? ` · ${t('cubes.magnet_pending')}` : ''}
										</span>
									</>
								) : (
									<span className={b('phone-values')}>{t('cubes.magnet_not_set')}</span>
								)}
							</div>
							{!cube.archived_at ? (
								<Link to={calibrateLink()} className={b('calibrate')}>
									{thisPhone ? t('cubes.magnet_recalibrate') : t('cubes.magnet_calibrate')}
								</Link>
							) : null}
						</div>
					) : (
						<p className={b('message')}>{t('cubes.magnet_web_note')}</p>
					)}

					{otherPhones.length ? (
						<>
							<h4 className={b('subtitle')}>{canCalibrateHere ? t('cubes.magnet_other_phones') : t('cubes.magnet_phones')}</h4>
							{otherPhones.map((row) => {
								const values = calibrationValues(row);
								return (
									<div key={`${row.platform}:${row.device_model}`} className={b('phone')}>
										<div className={b('phone-main')}>
											<span className={b('phone-name')}>{deviceModelDisplayName(row.device_model)}</span>
											<span className={b('phone-values')}>
												{t('cubes.magnet_values', values)}
												{values.weak ? ` · ${t('cubes.magnet_weak')}` : ''}
											</span>
											<span className={b('phone-date')}>
												{formatShortDay(row.measured_at, i18n.language)}
												{row.pending ? ` · ${t('cubes.magnet_pending')}` : ''}
											</span>
										</div>
										{row.id ? (
											<button
												type="button"
												className={b('delete')}
												aria-label={t('cubes.magnet_delete', { model: deviceModelDisplayName(row.device_model) })}
												onClick={() => confirmDeleteCalibration(row)}
											>
												<Trash weight="bold" />
											</button>
										) : null}
									</div>
								);
							})}
						</>
					) : !canCalibrateHere ? (
						<p className={b('message')}>{t('cubes.magnet_none')}</p>
					) : null}
				</section>
			) : null}

			{menu.element}
		</div>
	);
}
