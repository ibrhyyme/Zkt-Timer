import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@apollo/client';
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
 * Field study readout: which cube models finish solves straight from the move stream and
 * which ones fall back to the facelets safety nets. The fallback columns are the point —
 * a model with a high `via_poll` is a model whose users used to see the timer hang.
 */
export default function SmartCubeTelemetryPanel() {
	const {t} = useTranslation();
	const [days, setDays] = useState(3);

	const {data, loading, refetch} = useQuery(SmartCubeTelemetrySummaryDocument, {
		variables: {days},
		fetchPolicy: 'cache-and-network',
	});

	const {data: rowData, refetch: refetchRows} = useQuery(SmartCubeTelemetryRowsDocument, {
		variables: {limit: 2000},
		fetchPolicy: 'cache-and-network',
	});

	const summary = data?.smartCubeTelemetrySummary || [];
	const rows = rowData?.smartCubeTelemetryRows || [];

	function downloadCsv() {
		if (!rows.length) return;

		const headers = [
			'created_at', 'username', 'device_name', 'cube_type', 'surface', 'event_type',
			'detection_source', 'detection_lag_ms', 'time_ms', 'turn_count', 'is_native', 'app_version',
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
		void refetchRows({limit: 2000});
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
					<Button primary onClick={downloadCsv} disabled={!rows.length}>
						{t('smart_telemetry.download', {count: rows.length})}
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
								<th>{t('smart_telemetry.col_median')}</th>
								<th>{t('smart_telemetry.col_p95')}</th>
							</tr>
						</thead>
						<tbody>
							{summary.map((s: any) => {
								const fallbacks = s.via_grace + s.via_poll;
								const total = s.via_tracker + fallbacks;
								// Share of solves the move stream could not finish on its own.
								const fallbackPct = total > 0 ? Math.round((fallbacks / total) * 100) : 0;

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
										<td>{s.median_lag_ms} ms</td>
										<td className={b('cell', {warn: s.p95_lag_ms > 500})}>{s.p95_lag_ms} ms</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
