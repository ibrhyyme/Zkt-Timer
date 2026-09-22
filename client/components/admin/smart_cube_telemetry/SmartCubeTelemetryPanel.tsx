import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery, useApolloClient} from '@apollo/client';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {
	SmartCubeTelemetrySummaryDocument,
	SmartCubeTelemetryRowsDocument,
} from '../../../@types/generated/graphql';
import './SmartCubeTelemetryPanel.scss';

const b = block('smart-telemetry');

const WINDOWS = [1, 3, 7, 30];

/**
 * Event types the server accepts (see ALLOWED_EVENTS in the resolver). Listed here rather
 * than derived from the data so a type with no rows yet can still be filtered for, which is
 * exactly the case when chasing a failure that has not happened again.
 */
const EVENT_TYPES = [
	'solve',
	'scan_error',
	'disconnect',
	'out_of_sync',
	'late_scramble_move',
	'scramble_resync',
];

/** How many rows the on-screen table holds. Past this, the CSV export is the tool. */
const ROW_LIMIT = 200;

/**
 * Field study readout: which cube models finish solves straight from the move stream and
 * which ones fall back to the facelets safety nets. The fallback columns are the point —
 * a model with a high `via_poll` is a model whose users used to see the timer hang.
 */
export default function SmartCubeTelemetryPanel() {
	const {t} = useTranslation();
	const [days, setDays] = useState(7);
	const client = useApolloClient();

	const {data, loading, refetch} = useQuery(SmartCubeTelemetrySummaryDocument, {
		variables: {days},
		fetchPolicy: 'cache-and-network',
	});

	const summary = data?.smartCubeTelemetrySummary || [];
	const [exporting, setExporting] = useState(false);

	// Typed vs applied: the query runs when the admin says so, not on every keystroke.
	const [usernameInput, setUsernameInput] = useState('');
	const [filters, setFilters] = useState<{username: string; eventType: string}>({
		username: '',
		eventType: '',
	});

	const rowsQuery = useQuery(SmartCubeTelemetryRowsDocument, {
		variables: {
			limit: ROW_LIMIT,
			// Empty string would filter for an empty username; the server wants it absent.
			username: filters.username || null,
			eventType: filters.eventType || null,
			newestFirst: true,
		},
		fetchPolicy: 'cache-and-network',
	});

	const rows = rowsQuery.data?.smartCubeTelemetryRows || [];

	function applyFilters(eventType = filters.eventType) {
		setFilters({username: usernameInput.trim(), eventType});
	}

	/**
	 * Pages through the whole table rather than taking a single capped slice. A week of a
	 * live study is well past any single-query limit, and a truncated export would quietly
	 * answer the question with only the most recent slice of it.
	 */
	async function fetchAllRows(): Promise<any[]> {
		const PAGE = 2000;
		const all: any[] = [];
		for (let offset = 0; ; offset += PAGE) {
			const res = await client.query({
				query: SmartCubeTelemetryRowsDocument,
				// Same filters as the table: an export taken while looking at one user's rows
				// should contain that user's rows, not the whole study.
				variables: {
					limit: PAGE,
					offset,
					username: filters.username || null,
					eventType: filters.eventType || null,
				},
				fetchPolicy: 'network-only',
			});
			const page = res.data?.smartCubeTelemetryRows || [];
			all.push(...page);
			if (page.length < PAGE) break;
			// Safety valve against an unbounded loop if the server ever ignores the offset.
			if (all.length > 500_000) break;
		}
		return all;
	}

	async function downloadCsv() {
		setExporting(true);
		let rows: any[] = [];
		try {
			rows = await fetchAllRows();
		} catch (e) {
			setExporting(false);
			return;
		}
		setExporting(false);
		if (!rows.length) return;

		const headers = [
			'created_at', 'username', 'device_name', 'cube_type', 'surface', 'event_type',
			'detection_source', 'detection_lag_ms', 'time_ms', 'turn_count', 'battery_level', 'time_correction_ms', 'is_native', 'app_version',
		];

		const escape = (v: any) => {
			if (v === null || v === undefined) return '';
			const s = String(v);
			// Quote anything a spreadsheet would otherwise split or mangle.
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};

		const body = rows
			.map((r: any) => headers.map((h) => escape(r[h])).join(','))
			.join('\n');

		const blob = new Blob([`${headers.join(',')}\n${body}`], {type: 'text/csv;charset=utf-8'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `smart-cube-telemetry-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function reload() {
		void refetch({days});
		void rowsQuery.refetch();
	}

	return (
		<div className={b()}>
			<div className={b('header')}>
				<h2 className={b('title')}>{t('smart_telemetry.title')}</h2>
				<div className={b('actions')}>
					<div className={b('windows')}>
						{WINDOWS.map((d) => (
							<button
								key={d}
								type="button"
								className={b('window', {active: days === d})}
								onClick={() => setDays(d)}
							>
								{t('smart_telemetry.days', {count: d})}
							</button>
						))}
					</div>
					<Button gray onClick={reload}>{t('smart_telemetry.refresh')}</Button>
					<Button primary onClick={() => void downloadCsv()} disabled={exporting}>
						{exporting ? t('smart_telemetry.exporting') : t('smart_telemetry.download_all')}
					</Button>
				</div>
			</div>

			<p className={b('hint')}>{t('smart_telemetry.hint')}</p>

			{loading && !summary.length ? (
				<div className={b('empty')}>{t('smart_telemetry.loading')}</div>
			) : !summary.length ? (
				<div className={b('empty')}>{t('smart_telemetry.empty')}</div>
			) : (
				<div className={b('table-wrap')}>
					<table className={b('table')}>
						<thead>
							<tr>
								<th>{t('smart_telemetry.col_device')}</th>
								<th>{t('smart_telemetry.col_protocol')}</th>
								<th>{t('smart_telemetry.col_solves')}</th>
								<th>{t('smart_telemetry.col_users')}</th>
								<th>{t('smart_telemetry.col_tracker')}</th>
								<th>{t('smart_telemetry.col_grace')}</th>
								<th>{t('smart_telemetry.col_poll')}</th>
								<th>{t('smart_telemetry.col_desync')}</th>
								<th>{t('smart_telemetry.col_late')}</th>
								<th>{t('smart_telemetry.col_resync')}</th>
								<th>{t('smart_telemetry.col_median')}</th>
								<th>{t('smart_telemetry.col_p95')}</th>
								<th>{t('smart_telemetry.col_battery')}</th>
								<th>{t('smart_telemetry.col_correction')}</th>
							</tr>
						</thead>
						<tbody>
							{summary.map((s: any) => {
								const fallbacks = s.via_grace + s.via_poll;
								const total = s.via_tracker + fallbacks;
								// Share of solves the move stream could not finish on its own.
								const fallbackPct = total > 0 ? Math.round((fallbacks / total) * 100) : 0;
								// How much lower the battery sat on the solves that needed a recovery.
								// A real gap here is evidence for the weak-transmitter theory.
								const batteryGap = s.avg_battery_recovered > 0
									? s.avg_battery_clean - s.avg_battery_recovered
									: 0;

								return (
									<tr key={`${s.cube_type}-${s.device_name}`} className={b('row', {warn: fallbackPct >= 10})}>
										<td className={b('device')}>{s.device_name}</td>
										<td>{s.cube_type}</td>
										<td>{s.solves}</td>
										<td>{s.distinct_users}</td>
										<td>{s.via_tracker}</td>
										<td className={b('cell', {warn: s.via_grace > 0})}>{s.via_grace}</td>
										<td className={b('cell', {warn: s.via_poll > 0})}>{s.via_poll}</td>
										<td className={b('cell', {warn: s.out_of_sync_events > 0})}>{s.out_of_sync_events}</td>
										<td className={b('cell', {warn: s.late_scramble_events > 0})}>{s.late_scramble_events}</td>
										{/* Kept / lost. The second number is the one users feel: a mid-scramble
										    re-anchor the matcher could not place, so their progress was wiped. */}
										<td className={b('cell', {warn: s.scramble_reset_events > 0})}>
											{s.scramble_realign_events + s.scramble_reset_events > 0
												? `${s.scramble_realign_events} / ${s.scramble_reset_events}`
												: '-'}
										</td>
										<td>{s.median_lag_ms} ms</td>
										<td className={b('cell', {warn: s.p95_lag_ms > 500})}>{s.p95_lag_ms} ms</td>
										<td className={b('cell', {warn: batteryGap >= 10})}>
											{s.avg_battery_recovered > 0
												? `${s.avg_battery_clean}% / ${s.avg_battery_recovered}%`
												: '-'}
										</td>
										{/* How much time the dropped-packet correction is adding. Zero here
										    means this model's move stream arrives intact. */}
										<td className={b('cell', {warn: s.median_time_correction_ms > 1500})}>
											{s.median_time_correction_ms > 0 ? `${s.median_time_correction_ms} ms` : '-'}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Raw rows. The summary above answers "which model misbehaves"; this answers
			    "what happened to this one person", which is what a support ticket needs. */}
			<div className={b('rows-section')}>
				<h3 className={b('subtitle')}>{t('smart_telemetry.rows_title')}</h3>

				<div className={b('filters')}>
					<input
						type="search"
						className={b('filter-input')}
						value={usernameInput}
						onChange={(e) => setUsernameInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') applyFilters();
						}}
						placeholder={t('smart_telemetry.filter_username')}
						aria-label={t('smart_telemetry.filter_username')}
					/>
					<select
						className={b('filter-select')}
						value={filters.eventType}
						onChange={(e) => applyFilters(e.target.value)}
						aria-label={t('smart_telemetry.filter_event')}
					>
						<option value="">{t('smart_telemetry.filter_all_events')}</option>
						{EVENT_TYPES.map((type) => (
							<option key={type} value={type}>{type}</option>
						))}
					</select>
					<Button gray onClick={() => applyFilters()}>{t('smart_telemetry.search')}</Button>
				</div>

				{rowsQuery.loading && !rows.length ? (
					<div className={b('empty')}>{t('smart_telemetry.loading')}</div>
				) : !rows.length ? (
					<div className={b('empty')}>{t('smart_telemetry.rows_empty')}</div>
				) : (
					<div className={b('table-wrap')}>
						<table className={b('table')}>
							<thead>
								<tr>
									<th>{t('smart_telemetry.col_time')}</th>
									<th>{t('smart_telemetry.col_user')}</th>
									<th>{t('smart_telemetry.col_device')}</th>
									<th>{t('smart_telemetry.col_protocol')}</th>
									<th>{t('smart_telemetry.col_surface')}</th>
									<th>{t('smart_telemetry.col_event')}</th>
									<th>{t('smart_telemetry.col_detail')}</th>
									<th>{t('smart_telemetry.col_platform')}</th>
									<th>{t('smart_telemetry.col_version')}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((r: any) => (
									<tr key={r.id} className={b('row', {warn: r.event_type === 'scan_error'})}>
										<td>{new Date(r.created_at).toLocaleString()}</td>
										<td>{r.username || '-'}</td>
										<td className={b('device')}>{r.device_name}</td>
										<td>{r.cube_type}</td>
										<td>{r.surface}</td>
										<td>{r.event_type}</td>
										{/* Carries the scan failure's reason on a scan_error row, and the
										    detection path on a solve row. */}
										<td>{r.detection_source || '-'}</td>
										<td>
											{r.is_native
												? t('smart_telemetry.platform_native')
												: t('smart_telemetry.platform_web')}
										</td>
										<td>{r.app_version || '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
