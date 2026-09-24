import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { magnetService } from '../../../util/magnet-start/service';
import { magnetDebugLog, MagnetLogEntry } from '../../../util/magnet-start/debug_log';
import { useMagnetStatus } from '../../../util/magnet-start/status_store';
import { useSlamStop } from '../../../util/slam-stop/settings';
import { detectorConfigFor } from '../../../util/magnet-start/config';
import type { DetectorPhase, MagnetHint } from '../../../util/magnet-start/types';

// Gauge scale: the hot spot reads ~500 uT, so 600 keeps a resting cube inside the bar.
const GAUGE_MAX_UT = 600;
const LIVE_INTERVAL_MS = 100;
const RECENT_EVENTS = 8;

interface Live {
	delta: number | null;
	phase: DetectorPhase;
	hint: MagnetHint;
	rateHz: number | null;
}

function stateKey(active: boolean, phase: DetectorPhase, hint: MagnetHint): string {
	if (!active) return 'quick_controls.magnet_state_starting';
	if (phase === 'unsupported') return 'quick_controls.magnet_state_unsupported';
	if (phase === 'unknown') return 'quick_controls.magnet_state_unknown';
	if (phase === 'near') return 'quick_controls.magnet_state_near';
	if (phase === 'lifting') return 'quick_controls.magnet_state_lifting';
	return hint === 'closer' ? 'quick_controls.magnet_state_closer' : 'quick_controls.magnet_state_far';
}

function formatTime(t: number): string {
	const d = new Date(t);
	const pad = (n: number, w = 2) => String(n).padStart(w, '0');
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function formatEntry(e: MagnetLogEntry): string {
	const d: any = e.data || {};
	switch (e.kind) {
		case 'lift':
			return `lift  +${d.latencyMs} ms  ${d.delta} µT  σ${d.sigma}  rest ${d.restMs} ms`;
		case 'reject':
			return `reject ${d.reason}  peak ${d.peak} µT`;
		case 'near':
			return `near ${d.delta} µT${d.replaced ? ' (replaced)' : ''}`;
		case 'decision':
			return `decision ${d.action}${d.reason ? ` / ${d.reason}` : ''}${d.addTwo ? ' +2' : ''}  age ${d.ageMs} ms`;
		default:
			return d && Object.keys(d).length ? `${e.kind} ${JSON.stringify(d)}` : e.kind;
	}
}

/**
 * Admin field-test panel for magnet lift-to-start. While it is open the stream runs in
 * test mode (a lift never starts the timer), so the admin can check the placement, the
 * live field and the detector's decisions, re-learn the baseline and export the log.
 */
export default function MagnetPanel() {
	const { t } = useTranslation();
	const status = useMagnetStatus();
	const slam = useSlamStop();
	const [live, setLive] = useState<Live>({ delta: null, phase: 'unknown', hint: 'none', rateHz: null });
	const [entries, setEntries] = useState<MagnetLogEntry[]>(() => magnetDebugLog.getEntries().slice(-RECENT_EVENTS));
	const [windowCount, setWindowCount] = useState(() => magnetDebugLog.getWindowCount());
	const [relearn, setRelearn] = useState<'ok' | 'failed' | null>(null);
	const [exporting, setExporting] = useState(false);
	const lastLiveAt = useRef(0);

	useEffect(() => magnetService.acquire('test'), []);

	useEffect(() => {
		let frame = 0;
		const unsubscribe = magnetService.subscribeLive((reading) => {
			const now = Date.now();
			if (frame || now - lastLiveAt.current < LIVE_INTERVAL_MS) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				lastLiveAt.current = Date.now();
				setLive({
					delta: reading.delta,
					phase: reading.snapshot.phase,
					hint: reading.snapshot.hint,
					rateHz: reading.snapshot.rateHz,
				});
			});
		});
		return () => {
			unsubscribe();
			if (frame) cancelAnimationFrame(frame);
		};
	}, []);

	useEffect(
		() =>
			magnetDebugLog.subscribe(() => {
				setEntries(magnetDebugLog.getEntries().slice(-RECENT_EVENTS));
				setWindowCount(magnetDebugLog.getWindowCount());
			}),
		[]
	);

	function handleRelearn() {
		setRelearn(magnetService.relearnFar() ? 'ok' : 'failed');
	}

	async function handleExport() {
		setExporting(true);
		try {
			await magnetService.exportLog();
		} finally {
			setExporting(false);
		}
	}

	const delta = live.delta;
	const fill = delta === null ? 0 : Math.min(1, delta / GAUGE_MAX_UT);
	// farMax / nearMin are the same on both platforms; only the trigger floor differs.
	const { farMax, nearMin } = detectorConfigFor(magnetService.getPlatform() ?? 'ios');

	return (
		<div className="py-4 px-4 rounded-xl bg-module border border-text/[0.08] space-y-3">
			<div className="flex items-center justify-between gap-3">
				<span className="font-medium text-text">{t('quick_controls.magnet_state')}</span>
				<span className="text-sm font-semibold text-primary text-right">
					{t(stateKey(status.active, live.phase, live.hint))}
				</span>
			</div>

			<div>
				<div className="flex items-center justify-between mb-1.5">
					<span className="text-sm font-medium text-text">{t('quick_controls.magnet_signal')}</span>
					<span className="text-sm font-semibold text-text tabular-nums">
						{delta === null ? '-' : `${Math.round(delta)} µT`}
						{live.rateHz ? `  ·  ${Math.round(live.rateHz)} Hz` : ''}
					</span>
				</div>
				<div className="relative h-2.5 rounded-full bg-button border border-text/[0.1] overflow-hidden">
					<div
						className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ${
							live.phase === 'near' ? 'bg-green-500' : 'bg-primary'
						}`}
						style={{ width: `${fill * 100}%` }}
					/>
					{/* Far zone ends at farMax, the near zone starts at nearMin */}
					<div className="absolute inset-y-0 w-px bg-text" style={{ left: `${(farMax / GAUGE_MAX_UT) * 100}%` }} />
					<div className="absolute inset-y-0 w-px bg-text" style={{ left: `${(nearMin / GAUGE_MAX_UT) * 100}%` }} />
				</div>
			</div>

			<p className="text-sm text-text leading-snug">{t('quick_controls.magnet_placement')}</p>
			<p className="text-sm text-text leading-snug">{t('quick_controls.magnet_test_mode')}</p>
			{!slam.enabled && <p className="text-sm font-medium text-text leading-snug">{t('quick_controls.magnet_slam_off')}</p>}

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={handleRelearn}
					disabled={!status.active}
					className="px-3 py-1.5 rounded-lg text-sm font-medium bg-button border border-text/[0.1] text-text hover:border-text/[0.2] disabled:opacity-50"
				>
					{t('time_display.magnet_relearn')}
				</button>
				<button
					type="button"
					onClick={handleExport}
					disabled={exporting}
					className="px-3 py-1.5 rounded-lg text-sm font-medium bg-button border border-text/[0.1] text-text hover:border-text/[0.2] disabled:opacity-50"
				>
					{t('quick_controls.magnet_export_log')}
				</button>
				<button
					type="button"
					onClick={() => magnetDebugLog.clear()}
					className="px-3 py-1.5 rounded-lg text-sm font-medium bg-button border border-text/[0.1] text-text hover:border-text/[0.2]"
				>
					{t('quick_controls.magnet_clear_log')}
				</button>
			</div>
			{relearn === 'ok' && <p className="text-sm font-medium text-text">{t('quick_controls.magnet_relearn_done')}</p>}
			{relearn === 'failed' && <p className="text-sm font-medium text-text">{t('quick_controls.magnet_relearn_failed')}</p>}

			<div>
				<div className="flex items-center justify-between mb-1">
					<span className="text-sm font-medium text-text">{t('quick_controls.magnet_recent')}</span>
					<span className="text-xs font-medium text-text">
						{t('quick_controls.magnet_log_count', { events: magnetDebugLog.getEntries().length, windows: windowCount })}
					</span>
				</div>
				<div className="space-y-0.5 font-mono text-[11px] leading-snug text-text break-all">
					{entries.length === 0 ? (
						<div>-</div>
					) : (
						entries
							.slice()
							.reverse()
							.map((e, i) => (
								<div key={`${e.t}-${i}`}>
									{formatTime(e.t)} {formatEntry(e)}
								</div>
							))
					)}
				</div>
			</div>
		</div>
	);
}
