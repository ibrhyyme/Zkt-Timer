import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Bluetooth, CircleNotch, WarningCircle, X, ArrowClockwise, CaretRight } from 'phosphor-react';
import block from '../../../../styles/bem';
import { getBleAdapter } from '../../../../util/ble';
import './BleScanningModal.scss';

const b = block('ble-scanning-modal');

interface ScannedDevice {
	deviceId: string;
	name: string;
	rssi: number | null;
}

// RSSI (signal strength, less negative = closer) -> 0..4 filled bars.
function rssiToLevel(rssi: number | null): number {
	if (rssi == null) return 0;
	if (rssi >= -55) return 4;
	if (rssi >= -67) return 3;
	if (rssi >= -78) return 2;
	return 1;
}

function SignalBars({ rssi }: { rssi: number | null }) {
	const level = rssiToLevel(rssi);
	return (
		<span className={b('signal')} aria-hidden>
			{[1, 2, 3, 4].map((i) => (
				<span
					key={i}
					className={b('signal-bar', { on: i <= level })}
					style={{ height: `${5 + i * 3}px` }}
				/>
			))}
		</span>
	);
}

type Phase = 'scanning' | 'connecting' | 'error';
type ErrorKind = 'permission' | 'disabled' | 'notfound' | 'wrong_mac';
type Step = 'found' | 'paired' | 'reading_service' | 'done';
type StepStatus = 'pending' | 'active' | 'done';

interface BleScanningModalProps {
	mode: 'smartcube' | 'gantimer' | 'qiyitimer';
	onCancel: () => void;
	onRetry?: () => void;
	onClose?: () => void;
}

const STEP_ORDER: Step[] = ['found', 'paired', 'reading_service', 'done'];

function CubeGlyph({ size = 14 }: { size?: number }) {
	const gap = size * 0.13;
	const cell = (size - gap * 4) / 3;
	const cells: React.ReactNode[] = [];
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			cells.push(
				<rect
					key={`${r}-${c}`}
					x={gap + c * (cell + gap)}
					y={gap + r * (cell + gap)}
					width={cell}
					height={cell}
					rx={cell * 0.18}
					fill="currentColor"
				/>
			);
		}
	}
	return (
		<svg width={size} height={size} style={{ pointerEvents: 'none' }}>
			{cells}
		</svg>
	);
}

export default function BleScanningModal({ mode, onCancel, onRetry }: BleScanningModalProps) {
	const { t } = useTranslation();

	const smartCubeScanning = useSelector((state: any) => state.timer.smartCubeScanning);
	const smartCubeConnecting = useSelector((state: any) => state.timer.smartCubeConnecting);
	const smartCubeScanError = useSelector((state: any) => state.timer.smartCubeScanError);
	const smartCubeConnectStep: Step | null = useSelector((state: any) => state.timer.smartCubeConnectStep);
	const devices: ScannedDevice[] = useSelector((state: any) => state.timer.smartScanDevices || []);

	async function handleSelectDevice(deviceId: string) {
		const adapter = await getBleAdapter();
		adapter.selectScannedDevice?.(deviceId);
	}

	let phase: Phase = 'scanning';

	if (mode === 'smartcube') {
		if (smartCubeScanError) {
			phase = 'error';
		} else if (smartCubeConnecting) {
			phase = 'connecting';
		} else if (smartCubeScanning) {
			phase = 'scanning';
		}
	}

	const errorKind: ErrorKind =
		smartCubeScanError === 'permission'
			? 'permission'
			: smartCubeScanError === 'disabled'
				? 'disabled'
				: smartCubeScanError === 'wrong_mac'
					? 'wrong_mac'
					: 'notfound';

	const effectiveStep: Step = smartCubeConnectStep ?? 'found';

	function stepStatus(target: Step): StepStatus {
		if (smartCubeConnectStep === 'done') return 'done';
		const cur = STEP_ORDER.indexOf(effectiveStep);
		const tgt = STEP_ORDER.indexOf(target);
		if (tgt < cur) return 'done';
		if (tgt === cur) return 'active';
		return 'pending';
	}

	const errorTitleKey =
		errorKind === 'permission'
			? 'smart_cube.permission_denied'
			: errorKind === 'disabled'
				? 'smart_cube.bluetooth_disabled'
				: errorKind === 'wrong_mac'
					? 'smart_cube.wrong_mac'
					: 'smart_cube.scan_failed';

	const errorDescKey =
		errorKind === 'permission'
			? 'smart_cube.permission_denied_desc'
			: errorKind === 'disabled'
				? 'smart_cube.bluetooth_disabled_desc'
				: errorKind === 'wrong_mac'
					? 'smart_cube.wrong_mac_desc'
					: 'smart_cube.scan_failed_desc';

	const errorTipPrefix =
		errorKind === 'permission'
			? 'smart_cube.permission_denied_tip_'
			: errorKind === 'disabled'
				? 'smart_cube.bluetooth_disabled_tip_'
				: errorKind === 'wrong_mac'
					? 'smart_cube.wrong_mac_tip_'
					: 'smart_cube.scan_failed_tip_';

	// Once devices show up, the screen becomes a picker ("choose yours") instead of a spinner.
	const hasDevices = phase === 'scanning' && devices.length > 0;

	const title = hasDevices
		? t('smart_cube.select_device')
		: phase === 'scanning'
			? t('smart_cube.scanning')
			: phase === 'connecting'
				? t('smart_cube.connecting')
				: t(errorTitleKey);

	const description = hasDevices
		? t('smart_cube.select_device_desc')
		: phase === 'scanning'
			? t('smart_cube.scanning_desc')
			: phase === 'connecting'
				? t('smart_cube.connecting_desc')
				: t(errorDescKey);

	return (
		<div className={b({ 'is-error': phase === 'error' })}>
			<span className={b('grabber')} />
			<button className={b('close')} type="button" onClick={onCancel} aria-label="Kapat">
				<X size={18} weight="bold" />
			</button>

			<div className={b('radar', { phase })}>
				<span className={b('ring', { i: 1 })} />
				<span className={b('ring', { i: 2 })} />
				<span className={b('ring', { i: 3 })} />
				<span className={b('halo')} />

				{phase === 'scanning' && (
					<>
						<span className={b('orbit', { i: 1 })}>
							<span className={b('peer')}>
								<CubeGlyph size={14} />
							</span>
						</span>
						<span className={b('orbit', { i: 2 })}>
							<span className={b('peer', { small: true })}>
								<CubeGlyph size={10} />
							</span>
						</span>
					</>
				)}

				<div className={b('core')}>
					{phase === 'scanning' && <Bluetooth size={40} weight="bold" />}
					{phase === 'connecting' && (
						<CircleNotch size={40} weight="bold" className={b('core-spin')} />
					)}
					{phase === 'error' && <WarningCircle size={40} weight="bold" />}
				</div>
			</div>

			<h3 className={b('title')}>{title}</h3>
			<p className={b('description')}>{description}</p>

			<div className={b('body')}>
				{phase === 'scanning' && (
					devices.length === 0 ? (
						<div className={b('empty')}>
							<CircleNotch size={18} weight="bold" className={b('empty-spin')} />
							<span className={b('empty-text')}>{t('smart_cube.searching_devices')}</span>
						</div>
					) : (
						<ul className={b('device-list')}>
							{devices.map((d, i) => (
								<li key={d.deviceId}>
									<button
										className={b('device', { nearest: i === 0 })}
										type="button"
										onClick={() => handleSelectDevice(d.deviceId)}
									>
										<SignalBars rssi={d.rssi} />
										<span className={b('device-info')}>
											<span className={b('device-name')}>{d.name}</span>
											{i === 0 && (
												<span className={b('device-badge')}>{t('smart_cube.nearest')}</span>
											)}
										</span>
										<CaretRight size={18} weight="bold" className={b('device-arrow')} />
									</button>
								</li>
							))}
						</ul>
					)
				)}

				{phase === 'connecting' && (
					<ul className={b('steps')}>
						{(['found', 'paired', 'reading_service'] as Step[]).map((s) => {
							const status = stepStatus(s);
							return (
								<li key={s} className={b('step', { status })}>
									<span className={b('step-dot')} />
									<span className={b('step-label')}>{t(`smart_cube.step_${s}`)}</span>
								</li>
							);
						})}
					</ul>
				)}

				{phase === 'error' && (
					<ol className={b('tips')}>
						{[1, 2, 3].map((i) => (
							<li key={i} className={b('tip')}>
								<span className={b('tip-num')}>{i}</span>
								<span className={b('tip-text')}>{t(`${errorTipPrefix}${i}`)}</span>
							</li>
						))}
					</ol>
				)}
			</div>

			<div className={b('actions')}>
				{phase === 'error' && onRetry && (
					<button
						className={b('btn', { primary: true })}
						type="button"
						onClick={onRetry}
					>
						<ArrowClockwise size={18} weight="bold" />
						{t('smart_cube.retry')}
					</button>
				)}
				<button className={b('btn', { ghost: true })} type="button" onClick={onCancel}>
					{phase === 'error' ? t('smart_cube.give_up') : t('smart_cube.cancel_scan')}
				</button>
			</div>
		</div>
	);
}
