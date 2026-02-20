import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Bluetooth, ArrowClockwise, CircleNotch } from 'phosphor-react';
import Button from '../../../common/button/Button';
import block from '../../../../styles/bem';
import './BleScanningModal.scss';

const b = block('ble-scanning-modal');

interface BleScanningModalProps {
	mode: 'smartcube' | 'gantimer';
	onCancel: () => void;
	onRetry?: () => void;
}

export default function BleScanningModal({ mode, onCancel, onRetry }: BleScanningModalProps) {
	const { t } = useTranslation();

	const smartCubeScanning = useSelector((state: any) => state.timer.smartCubeScanning);
	const smartCubeConnecting = useSelector((state: any) => state.timer.smartCubeConnecting);
	const smartCubeScanError = useSelector((state: any) => state.timer.smartCubeScanError);

	let phase: 'scanning' | 'connecting' | 'error' = 'scanning';

	if (mode === 'smartcube') {
		if (smartCubeScanError) {
			phase = 'error';
		} else if (smartCubeConnecting) {
			phase = 'connecting';
		} else if (smartCubeScanning) {
			phase = 'scanning';
		}
	}
	// gantimer modu her zaman 'scanning' fazında kalır - başarı/hata parent'tan yönetilir

	return (
		<div className={b()}>
			<div className={b('icon', { phase })}>
				{phase === 'connecting' ? (
					<CircleNotch size={48} weight="bold" className="spin" />
				) : (
					<Bluetooth size={48} weight="bold" />
				)}
			</div>

			{phase === 'scanning' && (
				<>
					<h3 className={b('title')}>{t('smart_cube.scanning')}</h3>
					<p className={b('description')}>{t('smart_cube.scanning_desc')}</p>
					<div className={b('dots')}>
						<span className={b('dot')} />
						<span className={b('dot')} />
						<span className={b('dot')} />
					</div>
					<div className={b('actions')}>
						<Button text={t('smart_cube.cancel_scan')} transparent onClick={onCancel} />
					</div>
				</>
			)}

			{phase === 'connecting' && (
				<>
					<h3 className={b('title')}>{t('smart_cube.connecting')}</h3>
					<p className={b('description')}>{t('smart_cube.connecting_desc')}</p>
				</>
			)}

			{phase === 'error' && (
				<>
					<h3 className={b('title', { error: true })}>{t('smart_cube.scan_failed')}</h3>
					<p className={b('description')}>{t('smart_cube.scan_failed_desc')}</p>
					<div className={b('actions')}>
						{onRetry && (
							<Button
								text={t('smart_cube.retry')}
								primary
								icon={<ArrowClockwise />}
								onClick={onRetry}
							/>
						)}
						<Button text={t('smart_cube.cancel_scan')} transparent onClick={onCancel} />
					</div>
				</>
			)}
		</div>
	);
}
