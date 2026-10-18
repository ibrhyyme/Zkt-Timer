import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery, useApolloClient} from '@apollo/client';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {AdminCubeCalibrationsDocument, AdminCubeCalibrationSummaryDocument} from '../../../@types/generated/graphql';
import {PUZZLE_KEYS, isBuiltinPuzzleKey} from '../../../../shared/cube_puzzle';
import {NEAR_CAP_UT, REST_FACTOR} from '../../../../shared/magnet_calibration';
import {CUBE_TYPES} from '../../../util/cubes/cube_types';
import {buildCsv, CSV_MIME} from '../../../util/csv';
import {saveFile} from '../../../util/save-file';

// Same block as the field study tab: both tabs share one stylesheet.
const b = block('magnet-telemetry');

const WINDOWS = [30, 90, 365];

/**
 * The server returns at most this many rows per page, oldest first. The screen loads one page
 * and shows it newest first; when a page comes back full the table says so and the CSV export,
 * which pages through everything, is the complete view.
 */
const SCREEN_FETCH = 5000;
const ROW_LIMIT = 200;
const CSV_PAGE = 2000;

/**
 * A rest value at or above this keeps the ready line at its cap (150 uT), i.e. today's 3x3
 * behaviour. A phone model whose median 3x3 rest sits below it is one where even a normal 3x3
 * needs a lower line (design 6.6, item 3).
 */
const FULL_REST_UT = NEAR_CAP_UT / REST_FACTOR;

/** A stored threshold that differs from the current formula by more than this is highlighted. */
const THRESHOLD_DRIFT_UT = 1;

/** Share of weak calibrations in a group at which the row is flagged. */
const WEAK_RATIO_WARN = 0.3;

/** Reject share among lifts at which the study column is flagged (same 10% as the study tab). */
const REJECT_RATIO_WARN = 0.1;

const num = (v: number | null | undefined, unit = '') =>
	v === null || v === undefined ? '-' : `${Math.round(v * 10) / 10}${unit}`;

type Filters = {username: string; puzzle: string; platform: string; deviceModel: string};

const EMPTY_FILTERS: Filters = {username: '', puzzle: '', platform: '', deviceModel: ''};

/**
 * Admin view of stored magnet calibrations (design 3.4, 6.6): a rollup per puzzle, platform and
 * phone model with the field study joined on the same grouping, and every stored row with what
 * the current formula makes of it. Thresholds are not editable here; they are code constants
 * shipped over OTA, and this page is where the data to change them comes from.
 */
export default function CubeCalibrationsTab() {
	const {t} = useTranslation();
	const client = useApolloClient();
	const [days, setDays] = useState(365);
	const [exporting, setExporting] = useState(false);
	const [usernameInput, setUsernameInput] = useState('');
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

	const summaryQuery = useQuery(AdminCubeCalibrationSummaryDocument, {
		variables: {days},
		fetchPolicy: 'cache-and-network',
	});
	const summary = summaryQuery.data?.adminCubeCalibrationSummary || [];

	const queryFilters = {
		// Empty strings would filter for empty values; the server wants them absent.
		username: filters.username || null,
		puzzle: filters.puzzle || null,
		platform: filters.platform || null,
		deviceModel: filters.deviceModel || null,
	};

	const rowsQuery = useQuery(AdminCubeCalibrationsDocument, {
		variables: {limit: SCREEN_FETCH, ...queryFilters},
		fetchPolicy: 'cache-and-network',
	});
	const fetched = rowsQuery.data?.adminCubeCalibrations || [];
	const truncated = fetched.length >= SCREEN_FETCH;
	const rows = useMemo(
		() =>
			[...fetched]
				.sort((a: any, z: any) => new Date(z.measured_at).getTime() - new Date(a.measured_at).getTime())
				.slice(0, ROW_LIMIT),
		[fetched]
	);

	// Custom cube type ids carry no name in the rollup; the rows do.
	const customNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const r of fetched) if (r?.puzzle && r.puzzle_name) map.set(r.puzzle, r.puzzle_name);
		return map;
	}, [fetched]);

	function puzzleLabel(key: string | null | undefined): string {
		if (!key) return '-';
		if (isBuiltinPuzzleKey(key)) return CUBE_TYPES[key]?.name || key;
		return customNames.get(key) || t('admin_cube_calibrations.custom_puzzle');
	}

	// The rollup has a row per (puzzle, platform, model); the filter wants each model once.
	const modelOptions = useMemo(() => [...new Set(summary.map((s: any) => s.device_model).filter(Boolean))].sort(), [summary]);
	const customPuzzleOptions = useMemo(
		() => [...new Set(summary.map((s: any) => s.puzzle).filter((p: string) => p && !isBuiltinPuzzleKey(p)))],
		[summary]
	);

	function applyFilters(next: Partial<Filters> = {}) {
		setFilters({...filters, username: usernameInput.trim(), ...next});
	}

	function reload() {
		void summaryQuery.refetch({days});
		void rowsQuery.refetch();
	}

	/** Pages through the whole table: a capped export would quietly drop the oldest calibrations. */
	async function fetchAllRows(): Promise<any[]> {
		const all: any[] = [];
		for (let offset = 0; ; offset += CSV_PAGE) {
			const res = await client.query({
				query: AdminCubeCalibrationsDocument,
				variables: {limit: CSV_PAGE, offset, ...queryFilters},
				fetchPolicy: 'network-only',
			});
			const page = res.data?.adminCubeCalibrations || [];
			all.push(...page);
			if (page.length < CSV_PAGE) break;
			// Safety valve against an unbounded loop if the server ever ignores the offset.
			if (all.length > 500_000) break;
		}
		return all;
	}

	async function downloadCsv() {
		setExporting(true);
		let all: any[] = [];
		try {
			all = await fetchAllRows();
		} catch (e) {
			setExporting(false);
			return;
		}
		setExporting(false);
		if (!all.length) return;

		const headers = [
			'measured_at', 'username', 'email', 'cube_id', 'cube_name', 'cube_brand', 'puzzle', 'puzzle_name', 'platform',
			'device_model', 'os_version', 'sensor_name', 'peak_ut', 'rest_ut', 'noise_ut', 'near_min_ut', 'far_max_ut',
			'quality', 'current_near_min_ut', 'current_far_max_ut', 'current_quality', 'noisy', 'sample_count', 'sweep_ms',
			'rate_hz', 'algo_version', 'app_version', 'created_at', 'updated_at',
		];
		const csv = buildCsv(headers, all.map((r: any) => headers.map((h) => r[h])));
		void saveFile(csv, `cube-calibrations-${new Date().toISOString().slice(0, 10)}.csv`, CSV_MIME);
	}

	const drifted = (stored: number | null | undefined, current: number | null | undefined) =>
		current !== null && current !== undefined && stored !== null && stored !== undefined
		&& Math.abs(stored - current) > THRESHOLD_DRIFT_UT;

	return (
		<>
			<div className={b('header')}>
				<h2 className={b('title')}>{t('admin_cube_calibrations.title')}</h2>
				<div className={b('actions')}>
					<div className={b('windows')}>
						{WINDOWS.map((d) => (
							<button
								key={d}
								type="button"
								className={b('window', {active: days === d})}
								onClick={() => setDays(d)}
							>
								{t('magnet_telemetry.days', {count: d})}
							</button>
						))}
					</div>
					<Button gray onClick={reload}>{t('magnet_telemetry.refresh')}</Button>
					<Button primary onClick={() => void downloadCsv()} disabled={exporting}>
						{exporting ? t('magnet_telemetry.exporting') : t('magnet_telemetry.download_all')}
					</Button>
				</div>
			</div>

			<p className={b('hint')}>{t('admin_cube_calibrations.hint')}</p>

			{summaryQuery.loading && !summary.length ? (
				<div className={b('empty')}>{t('magnet_telemetry.loading')}</div>
			) : !summary.length ? (
				<div className={b('empty')}>{t('admin_cube_calibrations.empty')}</div>
			) : (
				<div className={b('table-wrap')}>
					<table className={b('table')}>
						<thead>
							<tr>
								<th>{t('admin_cube_calibrations.col_puzzle')}</th>
								<th>{t('magnet_telemetry.col_device')}</th>
								<th>{t('admin_cube_calibrations.col_count')}</th>
								<th>{t('magnet_telemetry.col_users')}</th>
								<th>{t('admin_cube_calibrations.col_rest_summary')}</th>
								<th>{t('admin_cube_calibrations.col_peak_median')}</th>
								<th>{t('admin_cube_calibrations.col_noise_median')}</th>
								<th>{t('admin_cube_calibrations.col_weak')}</th>
								<th>{t('admin_cube_calibrations.col_study_near')}</th>
								<th>{t('admin_cube_calibrations.col_study_rejects')}</th>
							</tr>
						</thead>
						<tbody>
							{summary.map((s: any) => {
								const weakPct = Math.round((s.weak_ratio || 0) * 100);
								const weakWarn = (s.weak_ratio || 0) >= WEAK_RATIO_WARN;
								// A 3x3 that cannot reach today's ready line on this model (design 6.6, item 3).
								const restWarn = s.puzzle === '333' && s.median_rest_ut > 0 && s.median_rest_ut < FULL_REST_UT;
								const rejectRatio = s.telemetry_lifts > 0 ? s.telemetry_rejects / s.telemetry_lifts : 0;
								return (
									<tr
										key={`${s.puzzle}-${s.platform}-${s.device_model}`}
										className={b('row', {warn: weakWarn || restWarn})}
									>
										<td>{puzzleLabel(s.puzzle)}</td>
										<td className={b('device')}>
											<button
												type="button"
												className={b('device-link')}
												onClick={() =>
													applyFilters({puzzle: s.puzzle, platform: s.platform, deviceModel: s.device_model})
												}
											>
												{s.device_model}
											</button>
											<span className={b('platform')}>{s.platform}</span>
										</td>
										<td>{s.calibrations}</td>
										<td>{s.distinct_users}</td>
										<td className={b('cell', {warn: restWarn})}>
											{s.median_rest_ut > 0 ? `${num(s.median_rest_ut)} / ${num(s.p10_rest_ut)} µT` : '-'}
										</td>
										<td>{num(s.median_peak_ut, ' µT')}</td>
										<td>{num(s.median_noise_ut, ' µT')}</td>
										<td className={b('cell', {warn: weakWarn})}>{`${weakPct}%`}</td>
										<td>
											{s.telemetry_placements > 0
												? `${s.telemetry_placements} · ${num(s.telemetry_median_near_ut, ' µT')}`
												: '-'}
										</td>
										<td className={b('cell', {warn: rejectRatio >= REJECT_RATIO_WARN})}>
											{s.telemetry_lifts > 0
												? `${s.telemetry_rejects} / ${s.telemetry_lifts} (${Math.round(rejectRatio * 100)}%)`
												: '-'}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<div className={b('rows-section')}>
				<h3 className={b('subtitle')}>{t('admin_cube_calibrations.rows_title')}</h3>

				<div className={b('filters')}>
					<input
						type="search"
						className={b('filter-input')}
						value={usernameInput}
						onChange={(e) => setUsernameInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') applyFilters();
						}}
						placeholder={t('magnet_telemetry.filter_username')}
						aria-label={t('magnet_telemetry.filter_username')}
					/>
					<select
						className={b('filter-select')}
						value={filters.puzzle}
						onChange={(e) => applyFilters({puzzle: e.target.value})}
						aria-label={t('admin_cube_calibrations.col_puzzle')}
					>
						<option value="">{t('admin_cube_calibrations.filter_all_puzzles')}</option>
						{PUZZLE_KEYS.map((key) => (
							<option key={key} value={key}>{puzzleLabel(key)}</option>
						))}
						{customPuzzleOptions.map((key: string) => (
							<option key={key} value={key}>{puzzleLabel(key)}</option>
						))}
					</select>
					<select
						className={b('filter-select')}
						value={filters.platform}
						onChange={(e) => applyFilters({platform: e.target.value})}
						aria-label={t('admin_cube_calibrations.filter_platform')}
					>
						<option value="">{t('admin_cube_calibrations.filter_all_platforms')}</option>
						<option value="ios">iOS</option>
						<option value="android">Android</option>
					</select>
					<select
						className={b('filter-select')}
						value={filters.deviceModel}
						onChange={(e) => applyFilters({deviceModel: e.target.value})}
						aria-label={t('magnet_telemetry.filter_device')}
					>
						<option value="">{t('magnet_telemetry.filter_all_devices')}</option>
						{modelOptions.map((model: string) => (
							<option key={model} value={model}>{model}</option>
						))}
					</select>
					<Button gray onClick={() => applyFilters()}>{t('magnet_telemetry.search')}</Button>
					<Button
						gray
						onClick={() => {
							setUsernameInput('');
							setFilters(EMPTY_FILTERS);
						}}
					>
						{t('admin_cube_calibrations.clear_filters')}
					</Button>
				</div>

				{truncated && <p className={b('hint')}>{t('admin_cube_calibrations.truncated', {count: SCREEN_FETCH})}</p>}

				{rowsQuery.loading && !rows.length ? (
					<div className={b('empty')}>{t('magnet_telemetry.loading')}</div>
				) : !rows.length ? (
					<div className={b('empty')}>{t('magnet_telemetry.rows_empty')}</div>
				) : (
					<div className={b('table-wrap')}>
						<table className={b('table')}>
							<thead>
								<tr>
									<th>{t('admin_cube_calibrations.col_measured')}</th>
									<th>{t('magnet_telemetry.col_user')}</th>
									<th>{t('admin_cube_calibrations.col_cube')}</th>
									<th>{t('admin_cube_calibrations.col_puzzle')}</th>
									<th>{t('magnet_telemetry.col_device')}</th>
									<th>P</th>
									<th>R</th>
									<th>σ</th>
									<th>{t('admin_cube_calibrations.col_stored')}</th>
									<th>{t('admin_cube_calibrations.col_current')}</th>
									<th>{t('admin_cube_calibrations.col_quality')}</th>
									<th>Hz</th>
									<th>{t('admin_cube_calibrations.col_algo')}</th>
									<th>{t('magnet_telemetry.col_version')}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((r: any) => {
									const nearDrift = drifted(r.near_min_ut, r.current_near_min_ut);
									const farDrift = drifted(r.far_max_ut, r.current_far_max_ut);
									const qualityChanged = !!r.current_quality && r.current_quality !== r.quality;
									return (
										<tr key={r.id} className={b('row', {warn: r.noisy || r.quality === 'weak'})}>
											<td>{r.measured_at ? new Date(r.measured_at).toLocaleString() : '-'}</td>
											<td>{r.username || '-'}</td>
											<td>
												{r.cube_name || '-'}
												{r.cube_brand ? <span className={b('platform')}>{r.cube_brand}</span> : null}
											</td>
											<td>{r.puzzle_name || puzzleLabel(r.puzzle)}</td>
											<td className={b('device')}>
												{r.device_model}
												<span className={b('platform')}>{r.platform}</span>
											</td>
											<td>{num(r.peak_ut)}</td>
											<td>{num(r.rest_ut)}</td>
											<td className={b('cell', {warn: r.noisy})}>{num(r.noise_ut)}</td>
											<td>{`${num(r.near_min_ut)} / ${num(r.far_max_ut)}`}</td>
											<td className={b('cell', {warn: nearDrift || farDrift})}>
												{r.current_near_min_ut === null || r.current_near_min_ut === undefined
													? '-'
													: `${num(r.current_near_min_ut)} / ${num(r.current_far_max_ut)}`}
											</td>
											<td className={b('cell', {warn: qualityChanged || r.quality === 'weak'})}>
												{t(`admin_cube_calibrations.quality_${r.quality}`, {defaultValue: r.quality})}
												{qualityChanged
													? ` → ${t(`admin_cube_calibrations.quality_${r.current_quality}`, {
														defaultValue: r.current_quality,
													})}`
													: ''}
											</td>
											<td>{num(r.rate_hz)}</td>
											<td>{r.algo_version ?? '-'}</td>
											<td>{r.app_version || '-'}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</>
	);
}
