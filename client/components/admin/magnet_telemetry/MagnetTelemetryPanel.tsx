import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery, useApolloClient} from '@apollo/client';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {
	MagnetTelemetrySummaryDocument,
	MagnetTelemetryRowsDocument,
	MagnetTelemetrySamplesDocument,
} from '../../../@types/generated/graphql';
import './MagnetTelemetryPanel.scss';

const b = block('magnet-telemetry');

const WINDOWS = [1, 3, 7, 30];

/**
 * Event types the server accepts (MAGNET_TELEMETRY_EVENTS in server/util/magnet_telemetry.ts).
 * Listed here rather than derived from the data so a type with no rows yet can still be
 * filtered for, which is exactly the case when chasing a failure that has not happened again.
 */
const EVENT_TYPES = ['device', 'near', 'lift', 'reject', 'unsupported', 'hint', 'far_learned', 'touch_ignored'];

/** How many rows the on-screen table holds. Past this, the CSV export is the tool. */
const ROW_LIMIT = 200;

// Below this the weakest placement on a phone sits close to the 150 uT threshold.
const NEAR_MARGIN_UT = 200;

function percent(part: number, whole: number): number {
	return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function saveText(text: string, name: string, type: string): void {
	const blob = new Blob([text], {type});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Field study readout for magnet lift-to-start: per phone model, does a placed cube clear
 * the 150 uT threshold with margin, how fast are lifts confirmed, how often are lifts
 * refused or rejected, and which phones cannot deliver 40 Hz. Raw windows download in the
 * test-fixture format, ready for client/util/magnet-start/__tests__/fixtures.
 */
export default function MagnetTelemetryPanel() {
	const {t} = useTranslation();
	const [days, setDays] = useState(7);
	const client = useApolloClient();

	const {data, loading, refetch} = useQuery(MagnetTelemetrySummaryDocument, {
		variables: {days},
		fetchPolicy: 'cache-and-network',
	});
	const summary = data?.magnetTelemetrySummary || [];
	const [exporting, setExporting] = useState(false);
	const [downloading, setDownloading] = useState<string | null>(null);

	// Typed vs applied: the query runs when the admin says so, not on every keystroke.
	const [usernameInput, setUsernameInput] = useState('');
	const [filters, setFilters] = useState<{username: string; eventType: string; deviceModel: string}>({
		username: '',
		eventType: '',
		deviceModel: '',
	});

	const rowsQuery = useQuery(MagnetTelemetryRowsDocument, {
		variables: {
			limit: ROW_LIMIT,
			// Empty strings would filter for empty values; the server wants them absent.
			username: filters.username || null,
			eventType: filters.eventType || null,
			deviceModel: filters.deviceModel || null,
			newestFirst: true,
		},
		fetchPolicy: 'cache-and-network',
	});
	const rows = rowsQuery.data?.magnetTelemetryRows || [];

	function applyFilters(next: Partial<typeof filters> = {}) {
		setFilters({...filters, username: usernameInput.trim(), ...next});
	}

	/**
	 * Pages through the whole table rather than taking one capped slice: a truncated export
	 * would quietly answer the question with only the most recent part of the study.
	 */
	async function fetchAllRows(): Promise<any[]> {
		const PAGE = 2000;
		const all: any[] = [];
		for (let offset = 0; ; offset += PAGE) {
			const res = await client.query({
				query: MagnetTelemetryRowsDocument,
				variables: {
					limit: PAGE,
					offset,
					username: filters.username || null,
					eventType: filters.eventType || null,
					deviceModel: filters.deviceModel || null,
				},
				fetchPolicy: 'network-only',
			});
			const page = res.data?.magnetTelemetryRows || [];
			all.push(...page);
			if (page.length < PAGE) break;
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
			'created_at', 'username', 'platform', 'device_model', 'os_version', 'sensor_name', 'event_type', 'detail',
			'delta_ut', 'latency_ms', 'rest_ms', 'approach_ms', 'sigma', 'rate_hz', 'reversed', 'has_samples', 'app_version',
		];
		const escape = (v: any) => {
			if (v === null || v === undefined) return '';
			const s = String(v);
			// Quote anything a spreadsheet would otherwise split or mangle.
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};
		const body = all.map((r: any) => headers.map((h) => escape(r[h])).join(',')).join('\n');
		saveText(`${headers.join(',')}\n${body}`, `magnet-telemetry-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
	}

	async function downloadSamples(row: any) {
		setDownloading(row.id);
		try {
			const res = await client.query({
				query: MagnetTelemetrySamplesDocument,
				variables: {id: row.id},
				fetchPolicy: 'network-only',
			});
			const json = res.data?.magnetTelemetrySamples;
			if (json) {
				const model = String(row.device_model || 'phone').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
				const stamp = new Date(row.created_at).toISOString().replace(/[:.]/g, '-').slice(0, 19);
				saveText(json, `magnet-${row.platform}-${model}-${row.event_type}-${stamp}.json`, 'application/json');
			}
		} finally {
			setDownloading(null);
		}
	}

	function reload() {
		void refetch({days});
		void rowsQuery.refetch();
	}

	const fmt = (v: any, unit = '') => (v === null || v === undefined ? '-' : `${v}${unit}`);

	return (
		<div className={b()}>
			<div className={b('header')}>
				<h2 className={b('title')}>{t('magnet_telemetry.title')}</h2>
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

			<p className={b('hint')}>{t('magnet_telemetry.hint')}</p>

			{loading && !summary.length ? (
				<div className={b('empty')}>{t('magnet_telemetry.loading')}</div>
			) : !summary.length ? (
				<div className={b('empty')}>{t('magnet_telemetry.empty')}</div>
			) : (
				<div className={b('table-wrap')}>
					<table className={b('table')}>
						<thead>
							<tr>
								<th>{t('magnet_telemetry.col_device')}</th>
								<th>{t('magnet_telemetry.col_sensor')}</th>
								<th>{t('magnet_telemetry.col_users')}</th>
								<th>{t('magnet_telemetry.col_placements')}</th>
								<th>{t('magnet_telemetry.col_near')}</th>
								<th>{t('magnet_telemetry.col_lifts')}</th>
								<th>{t('magnet_telemetry.col_latency')}</th>
								<th>{t('magnet_telemetry.col_approach')}</th>
								<th>{t('magnet_telemetry.col_rejects')}</th>
								<th>{t('magnet_telemetry.col_unknown')}</th>
								<th>{t('magnet_telemetry.col_sigma')}</th>
								<th>{t('magnet_telemetry.col_rate')}</th>
							</tr>
						</thead>
						<tbody>
							{summary.map((s: any) => {
								const refusedPct = percent(s.refused, s.lifts);
								return (
									<tr
										key={`${s.platform}-${s.device_model}`}
										className={b('row', {warn: s.unsupported > 0 || refusedPct >= 10})}
									>
										<td className={b('device')}>
											<button
												type="button"
												className={b('device-link')}
												onClick={() => applyFilters({deviceModel: s.device_model})}
											>
												{s.device_model}
											</button>
											<span className={b('platform')}>{s.platform}</span>
										</td>
										<td>{s.sensor_name || '-'}</td>
										<td>{s.distinct_users}</td>
										<td>{s.placements}</td>
										{/* The weakest placement is the one that decides whether the threshold
										    holds on this phone; the median shows the usual margin. */}
										<td className={b('cell', {warn: s.placements > 0 && s.min_near_ut < NEAR_MARGIN_UT})}>
											{s.placements > 0 ? `${s.min_near_ut} / ${s.median_near_ut} µT` : '-'}
										</td>
										<td className={b('cell', {warn: refusedPct >= 10})}>
											{s.lifts > 0 ? `${s.started} / ${s.refused} (${refusedPct}%)` : '-'}
										</td>
										<td className={b('cell', {warn: s.p95_latency_ms > 200})}>
											{s.lifts > 0 ? `${s.median_latency_ms} / ${s.p95_latency_ms} ms` : '-'}
										</td>
										<td>{s.median_approach_ms > 0 ? `${s.median_approach_ms} ms` : '-'}</td>
										<td className={b('cell', {warn: s.rejects > 0})}>{s.rejects}</td>
										<td className={b('cell', {warn: s.unknown_hints > 0})}>{s.unknown_hints}</td>
										<td>{s.median_sigma > 0 ? `${s.median_sigma} µT` : '-'}</td>
										<td className={b('cell', {warn: s.unsupported > 0 || (s.rate_hz > 0 && s.rate_hz < 50)})}>
											{s.rate_hz > 0 ? `${s.rate_hz} Hz` : '-'}
											{s.unsupported > 0 ? ` · ${t('magnet_telemetry.unsupported')}` : ''}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Raw rows: the summary answers "which phone struggles", this answers "what
			    happened on this one", and carries the raw windows. */}
			<div className={b('rows-section')}>
				<h3 className={b('subtitle')}>{t('magnet_telemetry.rows_title')}</h3>

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
						value={filters.eventType}
						onChange={(e) => applyFilters({eventType: e.target.value})}
						aria-label={t('magnet_telemetry.filter_event')}
					>
						<option value="">{t('magnet_telemetry.filter_all_events')}</option>
						{EVENT_TYPES.map((type) => (
							<option key={type} value={type}>{type}</option>
						))}
					</select>
					<select
						className={b('filter-select')}
						value={filters.deviceModel}
						onChange={(e) => applyFilters({deviceModel: e.target.value})}
						aria-label={t('magnet_telemetry.filter_device')}
					>
						<option value="">{t('magnet_telemetry.filter_all_devices')}</option>
						{summary.map((s: any) => (
							<option key={`${s.platform}-${s.device_model}`} value={s.device_model}>{s.device_model}</option>
						))}
					</select>
					<Button gray onClick={() => applyFilters()}>{t('magnet_telemetry.search')}</Button>
				</div>

				{rowsQuery.loading && !rows.length ? (
					<div className={b('empty')}>{t('magnet_telemetry.loading')}</div>
				) : !rows.length ? (
					<div className={b('empty')}>{t('magnet_telemetry.rows_empty')}</div>
				) : (
					<div className={b('table-wrap')}>
						<table className={b('table')}>
							<thead>
								<tr>
									<th>{t('magnet_telemetry.col_time')}</th>
									<th>{t('magnet_telemetry.col_user')}</th>
									<th>{t('magnet_telemetry.col_device')}</th>
									<th>{t('magnet_telemetry.col_event')}</th>
									<th>{t('magnet_telemetry.col_detail')}</th>
									<th>µT</th>
									<th>{t('magnet_telemetry.col_latency_short')}</th>
									<th>{t('magnet_telemetry.col_rest')}</th>
									<th>{t('magnet_telemetry.col_approach')}</th>
									<th>σ</th>
									<th>Hz</th>
									<th>{t('magnet_telemetry.col_reversed')}</th>
									<th>{t('magnet_telemetry.col_version')}</th>
									<th>{t('magnet_telemetry.col_samples')}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((r: any) => (
									<tr
										key={r.id}
										className={b('row', {
											warn: r.event_type === 'reject' || r.event_type === 'unsupported'
												|| (r.event_type === 'lift' && String(r.detail || '').startsWith('none:')),
										})}
									>
										<td>{new Date(r.created_at).toLocaleString()}</td>
										<td>{r.username || '-'}</td>
										<td className={b('device')}>{r.device_model}</td>
										<td>{r.event_type}</td>
										<td>{r.detail || '-'}</td>
										<td>{fmt(r.delta_ut)}</td>
										<td>{fmt(r.latency_ms, ' ms')}</td>
										<td>{fmt(r.rest_ms, ' ms')}</td>
										<td>{fmt(r.approach_ms, ' ms')}</td>
										<td>{fmt(r.sigma)}</td>
										<td>{fmt(r.rate_hz)}</td>
										<td>{r.reversed ? t('magnet_telemetry.yes') : '-'}</td>
										<td>{r.app_version || '-'}</td>
										<td>
											{r.has_samples ? (
												<button
													type="button"
													className={b('download')}
													disabled={downloading === r.id}
													onClick={() => void downloadSamples(r)}
												>
													{t('magnet_telemetry.download_samples')}
												</button>
											) : (
												'-'
											)}
										</td>
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
