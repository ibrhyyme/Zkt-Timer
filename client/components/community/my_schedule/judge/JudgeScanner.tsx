import React, {useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import {QrScanError, QrScanHandle, startQrScan} from '../../../../util/qr-scan';
import {allowScreenSleep, keepScreenAwake} from '../../../../util/native-plugins';
import {parseJudgeApproveToken} from '../../../../../shared/zkt_judge';
import JudgeApproval from './JudgeApproval';

const b = block('judge');

// How long "this is not a judge QR" stays up before the reader looks again.
const FOREIGN_NOTICE_MS = 2500;

interface Props {
	onClose: () => void;
}

/**
 * "Hakem ata": the camera stays open; scan, decide, next. A QR that is not a
 * Zkt-Timer approval address is refused on the spot and never opened.
 */
export default function JudgeScanner({onClose}: Props) {
	const {t} = useTranslation();
	const videoRef = useRef<HTMLVideoElement>(null);
	const handleRef = useRef<QrScanHandle | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [failure, setFailure] = useState<QrScanError | null>(null);
	const [foreign, setForeign] = useState(false);
	const [starting, setStarting] = useState(true);
	// The decoder keeps running under the approval sheet; a second QR is ignored until it closes.
	const busy = useRef(false);

	useEffect(() => {
		void keepScreenAwake();
		let cancelled = false;
		let foreignTimer: number | undefined;
		const host = typeof window !== 'undefined' ? window.location.host : '';

		(async () => {
			const video = videoRef.current;
			if (!video) return;
			const result = await startQrScan({
				video,
				onResult: (text) => {
					if (busy.current) return;
					const found = parseJudgeApproveToken(text, [host]);
					if (found) {
						busy.current = true;
						setForeign(false);
						setToken(found);
						return;
					}
					setForeign(true);
					window.clearTimeout(foreignTimer);
					foreignTimer = window.setTimeout(() => setForeign(false), FOREIGN_NOTICE_MS);
				},
			});
			if (cancelled) {
				if (result.ok) result.handle.stop();
				return;
			}
			setStarting(false);
			if (result.ok === true) handleRef.current = result.handle;
			else setFailure(result.kind);
		})();

		return () => {
			cancelled = true;
			window.clearTimeout(foreignTimer);
			handleRef.current?.stop();
			handleRef.current = null;
			void allowScreenSleep();
		};
	}, []);

	function next() {
		setToken(null);
		busy.current = false;
	}

	if (typeof document === 'undefined') return null;

	return ReactDOM.createPortal(
		<div className={b('scanner')} role="dialog" aria-modal="true" aria-label={t('zkt_comp.judge_scan_title')}>
			<div className={b('scanner-bar')}>
				<span className={b('scanner-title')}>{t('zkt_comp.judge_scan_title')}</span>
				<button type="button" className={b('scanner-close')} onClick={onClose}>
					{t('zkt_comp.judge_scan_close')}
				</button>
			</div>

			<div className={b('scanner-view')}>
				<video ref={videoRef} className={b('scanner-video')} autoPlay />
				{!failure && <div className={b('scanner-frame')} aria-hidden="true" />}
				{failure && (
					<div className={b('scanner-failure')}>
						<p className={b('notice', {error: true})}>{t(`zkt_comp.judge_scan_error_${failure}`)}</p>
						<p className={b('hint')}>{t('zkt_comp.judge_scan_fallback')}</p>
						<Button theme={CommonType.GRAY} text={t('zkt_comp.judge_scan_close')} onClick={onClose} />
					</div>
				)}
			</div>

			<p className={b('scanner-hint', {warning: foreign})} aria-live="polite">
				{starting && !failure
					? t('zkt_comp.judge_scan_starting')
					: foreign
						? t('zkt_comp.judge_scan_foreign')
						: t('zkt_comp.judge_scan_hint')}
			</p>

			{token && (
				<div className={b('sheet')}>
					<div className={b('sheet-body', {tall: true})}>
						<JudgeApproval token={token} onDone={next} doneLabel={t('zkt_comp.judge_scan_next')} />
					</div>
				</div>
			)}
		</div>,
		document.body
	);
}
