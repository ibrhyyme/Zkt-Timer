import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {gqlQueryTyped} from '../../api';
import Input from '../../common/inputs/input/Input';
import {useInput} from '../../../util/hooks/useInput';
import {AdminSmartDeviceLogsDocument} from '../../../@types/generated/graphql';

dayjs.extend(relativeTime);

/**
 * Read-only debug view of smart cube / BLE timer connection telemetry. Shows who connected a
 * device and WHY their connection dropped (reason code), so we can confirm root causes server-side
 * (e.g. GAN Gen4 buffer_overflow vs wrong_mac vs gatt_self).
 */

interface LogRow {
	id: string;
	user_email?: string | null;
	device_type: string;
	device_name?: string | null;
	hardware_name?: string | null;
	generation?: string | null;
	platform: string;
	event: string;
	reason?: string | null;
	solve_count?: number | null;
	last_serial?: number | null;
	extra?: string | null;
	created_at: string;
}

const REASON_FILTERS = [
	'',
	'buffer_overflow_recovered',
	'wrong_mac',
	'gatt_self',
	'manual',
	'timer_type_change',
];

function badgeStyle(color: string): React.CSSProperties {
	return {background: color + '22', color, border: `1px solid ${color}55`};
}

function eventColor(event: string): string {
	if (event === 'connect') return '#22c55e';
	if (event === 'error') return '#f59e0b';
	return '#ef4444'; // disconnect
}

function reasonColor(reason?: string | null): string {
	switch (reason) {
		case 'wrong_mac':
		case 'handshake_timeout':
			return '#ef4444';
		case 'buffer_overflow':
		case 'buffer_overflow_recovered':
			return '#f59e0b';
		case 'manual':
		case 'timer_type_change':
			return '#3b82f6';
		case 'notify_fail':
			return '#a855f7';
		default:
			return '#6b7280'; // gatt_self / unknown / null
	}
}

function LogRowView({row}: {row: LogRow}) {
	const device = [row.device_type, row.generation, row.hardware_name || row.device_name]
		.filter(Boolean)
		.join(' · ');

	return (
		<tr className="cd-admin-users__row">
			<td className="cd-admin-users__cell cd-admin-users__cell--date">
				<div className="cd-admin-users__date-main">{dayjs(row.created_at).format('DD MMM HH:mm')}</div>
				<div className="cd-admin-users__date-sub">{dayjs(row.created_at).fromNow()}</div>
			</td>
			<td className="cd-admin-users__cell">{row.user_email || <span style={{color: '#666'}}>anon</span>}</td>
			<td className="cd-admin-users__cell" style={{fontSize: '12px'}}>{device}</td>
			<td className="cd-admin-users__cell">
				<span className="cd-admin-users__badge" style={badgeStyle(eventColor(row.event))}>{row.event}</span>
			</td>
			<td className="cd-admin-users__cell">
				{row.reason ? (
					<span className="cd-admin-users__badge" style={badgeStyle(reasonColor(row.reason))}>{row.reason}</span>
				) : (
					<span style={{color: '#666'}}>—</span>
				)}
			</td>
			<td className="cd-admin-users__cell">{row.platform}</td>
			<td className="cd-admin-users__cell">{row.last_serial ?? <span style={{color: '#666'}}>—</span>}</td>
			<td className="cd-admin-users__cell" style={{fontFamily: 'monospace', fontSize: '11px', color: '#aaa', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
				{row.extra || ''}
			</td>
		</tr>
	);
}

export default function AdminSmartDeviceLogs() {
	const [email, setEmail] = useInput('');
	const [reason, setReason] = React.useState('');
	const [rows, setRows] = React.useState<LogRow[]>([]);
	const [loading, setLoading] = React.useState(false);

	async function fetchData() {
		setLoading(true);
		try {
			const res = await gqlQueryTyped(
				AdminSmartDeviceLogsDocument,
				{
					userEmail: email || undefined,
					reason: reason || undefined,
					limit: 200,
				},
				{fetchPolicy: 'network-only'}
			);
			setRows((res.data?.smartDeviceLogs as LogRow[]) || []);
		} catch (err) {
			console.error('[AdminSmartDeviceLogs] fetch error', err);
		} finally {
			setLoading(false);
		}
	}

	React.useEffect(() => {
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [email, reason]);

	return (
		<div className="cd-admin-users">
			<div className="cd-admin-users__controls" style={{gap: '12px', flexWrap: 'wrap'}}>
				<Input value={email} onChange={setEmail} placeholder="Filter by email..." />
				<div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
					{REASON_FILTERS.map((r) => (
						<button
							key={r || 'all'}
							onClick={() => setReason(r)}
							className="cd-admin-users__badge"
							style={{
								...badgeStyle(r ? reasonColor(r) : '#9ca3af'),
								cursor: 'pointer',
								opacity: reason === r ? 1 : 0.55,
							}}
						>
							{r || 'all'}
						</button>
					))}
				</div>
				<span className="cd-admin-users__total">{rows.length} events</span>
			</div>

			<div className="cd-admin-users__table-wrapper">
				<table className="cd-admin-users__table">
					<thead>
						<tr>
							<th className="cd-admin-users__th">Time</th>
							<th className="cd-admin-users__th">User</th>
							<th className="cd-admin-users__th">Device</th>
							<th className="cd-admin-users__th">Event</th>
							<th className="cd-admin-users__th">Reason</th>
							<th className="cd-admin-users__th">Platform</th>
							<th className="cd-admin-users__th">Serial</th>
							<th className="cd-admin-users__th">Extra</th>
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr><td colSpan={8} style={{textAlign: 'center', padding: '32px', color: '#666'}}>Loading...</td></tr>
						) : rows.length === 0 ? (
							<tr><td colSpan={8} style={{textAlign: 'center', padding: '32px', color: '#666'}}>No events</td></tr>
						) : (
							rows.map((r) => <LogRowView key={r.id} row={r} />)
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
