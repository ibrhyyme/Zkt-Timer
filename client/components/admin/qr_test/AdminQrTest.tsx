import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {isAndroidNative, isNative} from '../../../util/platform';
import {qrScanSupported, startQrScan, QrScanError, QrScanHandle} from '../../../util/qr-scan';
import './AdminQrTest.scss';

const b = block('admin-qr-test');

type Status = 'idle' | 'starting' | 'scanning' | QrScanError;

/**
 * Admin-only device probe for the in-page QR scanner (client/util/qr-scan.ts): does the camera
 * open inside the native WebView, and does a QR decode? Everything the owner has to report
 * back is on the page, because a phone has no console.
 */
export default function AdminQrTest() {
	const {t} = useTranslation();
	const videoRef = useRef<HTMLVideoElement>(null);
	const handleRef = useRef<QrScanHandle | null>(null);
	const aliveRef = useRef(true);

	const [status, setStatus] = useState<Status>('idle');
	const [detail, setDetail] = useState('');
	const [last, setLast] = useState('');
	const [count, setCount] = useState(0);
	const [openMs, setOpenMs] = useState<number | null>(null);
	const [firstReadMs, setFirstReadMs] = useState<number | null>(null);
	// Read after mount so the server render and the first client render agree.
	const [environment, setEnvironment] = useState('');

	useEffect(() => {
		const shell = isNative() ? (isAndroidNative() ? 'native android' : 'native ios') : 'web';
		const support = qrScanSupported() ? 'getUserMedia: yes' : 'getUserMedia: no';
		setEnvironment(`${shell} | ${support} | ${navigator.userAgent}`);
		return () => {
			aliveRef.current = false;
			handleRef.current?.stop();
			handleRef.current = null;
		};
	}, []);

	async function start() {
		const video = videoRef.current;
		if (!video || status === 'starting' || status === 'scanning') return;
		setStatus('starting');
		setDetail('');
		setLast('');
		setCount(0);
		setOpenMs(null);
		setFirstReadMs(null);

		const startedAt = performance.now();
		const result = await startQrScan({
			video,
			onResult: (text) => {
				if (!aliveRef.current) return;
				setLast(text);
				setCount((c) => c + 1);
				setFirstReadMs((prev) => prev ?? Math.round(performance.now() - startedAt));
			},
		});

		if (result.ok === false) {
			if (!aliveRef.current) return;
			setStatus(result.kind);
			setDetail(result.detail);
			return;
		}
		// Left the page while the permission prompt was open: do not keep the camera.
		if (!aliveRef.current) {
			result.handle.stop();
			return;
		}
		handleRef.current = result.handle;
		setOpenMs(Math.round(performance.now() - startedAt));
		setStatus('scanning');
	}

	function stop() {
		handleRef.current?.stop();
		handleRef.current = null;
		setStatus('idle');
	}

	const running = status === 'starting' || status === 'scanning';

	return (
		<div className={b()}>
			<h2 className={b('title')}>{t('admin_qr_test.title')}</h2>
			<p className={b('intro')}>{t('admin_qr_test.intro')}</p>

			<div className={b('actions')}>
				{running ? (
					<Button text={t('admin_qr_test.stop')} onClick={stop} gray />
				) : (
					<Button text={t('admin_qr_test.start')} onClick={start} primary />
				)}
				<span className={b('status', {error: !running && status !== 'idle'})}>
					{t(`admin_qr_test.status_${status}`)}
				</span>
			</div>

			<div className={b('camera', {on: status === 'scanning'})}>
				<video ref={videoRef} className={b('video')} autoPlay />
			</div>

			<dl className={b('report')}>
				<dt>{t('admin_qr_test.result')}</dt>
				<dd className={b('value')}>{last || '-'}</dd>
				<dt>{t('admin_qr_test.count')}</dt>
				<dd className={b('value')}>{count}</dd>
				<dt>{t('admin_qr_test.open_time')}</dt>
				<dd className={b('value')}>{openMs === null ? '-' : `${openMs} ms`}</dd>
				<dt>{t('admin_qr_test.first_read_time')}</dt>
				<dd className={b('value')}>{firstReadMs === null ? '-' : `${firstReadMs} ms`}</dd>
				<dt>{t('admin_qr_test.detail')}</dt>
				<dd className={b('value')}>{detail || '-'}</dd>
				<dt>{t('admin_qr_test.environment')}</dt>
				<dd className={b('value')}>{environment || '-'}</dd>
			</dl>
		</div>
	);
}
