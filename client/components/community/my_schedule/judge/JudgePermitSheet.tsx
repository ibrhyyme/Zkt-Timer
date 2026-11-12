import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import {
	decideJudgeApproval,
	fetchJudgeMe,
	JudgeCallError,
	judgeErrorKey,
	requestPermitQr,
	toJudgeError,
} from '../../../../util/judge-api';
import {formatJudgeValue, JudgeRequestResult} from '../../../../../shared/zkt_judge';

const b = block('judge');

// Same rhythm as the judge QR: a fresh code before the old one runs out, and
// "was it approved?" every few seconds while it shows.
const REFRESH_BEFORE_EXPIRY_MS = 25000;
const POLL_MS = 2500;
// The site refuses a reason longer than this (lib/zkt/judge/service.ts REASON_MAX).
const REASON_MAX = 300;

interface Props {
	competitionId: string;
	cardId: string;
	attemptNo: number;
	purpose: 'CORRECT' | 'EXTRA';
	/** The time on the card now, shown so the organiser sees what changes. */
	currentValue: number | null;
	/** Set when the request is for an extra line ("E1"): the time being corrected is that line's. */
	extraLine?: string | null;
	eventId: string;
	onApproved: () => void;
	onClose: () => void;
}

/**
 * "Süre düzelt" / "Ekstra iste": the judge shows this QR to an organiser (an
 * extra only to a delegate or organiser of the competition). Nothing changes on
 * the card until it is approved; then the attempt opens for one new time.
 */
export default function JudgePermitSheet(props: Props) {
	const {competitionId, cardId, attemptNo, purpose, currentValue, extraLine, eventId, onApproved, onClose} = props;
	const {t} = useTranslation();
	const [request, setRequest] = useState<JudgeRequestResult | null>(null);
	const [error, setError] = useState<JudgeCallError | null>(null);
	const [rejected, setRejected] = useState(false);
	// A judge who holds the approval right decides their own request (sahip, 12 Kasım).
	const [reason, setReason] = useState('');
	const [deciding, setDeciding] = useState(false);
	const self = !!request?.canSelfAuthorize;
	const reasonOk = purpose !== 'EXTRA' || reason.trim().length >= 2;

	async function approveMyself() {
		if (!request || !reasonOk) return;
		setDeciding(true);
		try {
			await decideJudgeApproval(request.token, 'APPROVE', purpose === 'EXTRA' ? reason : null);
			if (alive.current) onApproved();
		} catch (e) {
			if (alive.current) setError(toJudgeError(e));
		} finally {
			if (alive.current) setDeciding(false);
		}
	}
	// The code on screen and the one before it: the organiser may have scanned
	// the old one a moment before it was replaced.
	const jtis = useRef<string[]>([]);
	const alive = useRef(true);

	async function ask(silent: boolean) {
		try {
			const res = await requestPermitQr(cardId, attemptNo, purpose);
			if (!alive.current) return;
			jtis.current = [res.jti, ...jtis.current].slice(0, 2);
			setRequest(res);
			setError(null);
		} catch (e) {
			if (alive.current && !silent) setError(toJudgeError(e));
		}
	}

	useEffect(() => {
		alive.current = true;
		void ask(false);
		return () => {
			alive.current = false;
		};
	}, []);

	useEffect(() => {
		if (!request || rejected) return;
		const wait = Math.max(5000, new Date(request.expiresAt).getTime() - Date.now() - REFRESH_BEFORE_EXPIRY_MS);
		const timer = setTimeout(() => void ask(true), wait);
		return () => clearTimeout(timer);
	}, [request?.jti, rejected]);

	useEffect(() => {
		if (!request || rejected) return;
		let tick = 0;
		const timer = setInterval(async () => {
			if (typeof document !== 'undefined' && document.hidden) return;
			const jti = jtis.current[tick++ % Math.max(1, jtis.current.length)];
			try {
				const me = await fetchJudgeMe(competitionId, jti);
				if (!alive.current) return;
				if (me.request?.status === 'approved') onApproved();
				else if (me.request?.status === 'rejected') setRejected(true);
			} catch {
				// Quiet: the next tick asks again.
			}
		}, POLL_MS);
		return () => clearInterval(timer);
	}, [!!request, rejected, competitionId]);

	const shown = formatJudgeValue(currentValue, eventId);

	return (
		<div className={b('sheet')} role="dialog" aria-modal="true">
			<div className={b('sheet-body')}>
				<span className={b('sheet-title')}>
					{t(purpose === 'EXTRA' ? 'zkt_comp.judge_extra' : 'zkt_comp.judge_correct')} ·{' '}
					{extraLine
						? t('zkt_comp.judge_permit_extra_line', {line: extraLine, no: attemptNo, value: shown || '-'})
						: t('zkt_comp.judge_permit_attempt', {no: attemptNo, value: shown || '-'})}
				</span>
				{rejected ? (
					<p className={b('notice', {error: true})}>{t('zkt_comp.judge_permit_rejected')}</p>
				) : error ? (
					<p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p>
				) : self ? (
					// The approval right on this phone: no QR to show anyone.
					<>
						<p className={b('hint')}>{t('zkt_comp.judge_self_permit_hint')}</p>
						{purpose === 'EXTRA' && (
							<label className={b('field')}>
								<span className={b('label')}>{t('zkt_comp.judge_approve_reason')}</span>
								<textarea
									className={b('input', {area: true})}
									value={reason}
									maxLength={REASON_MAX}
									rows={2}
									placeholder={t('zkt_comp.judge_approve_reason_placeholder')}
									onChange={(e) => setReason(e.target.value)}
								/>
							</label>
						)}
					</>
				) : (
					<>
						<h3 className={b('qr-title')}>
							{t(purpose === 'EXTRA' ? 'zkt_comp.judge_permit_qr_extra' : 'zkt_comp.judge_permit_qr_correct')}
						</h3>
						{request ? (
							<div className={b('qr')} dangerouslySetInnerHTML={{__html: request.qrSvg}} />
						) : (
							<div className={b('qr', {loading: true})} />
						)}
						<p className={b('hint')}>{t('zkt_comp.judge_permit_qr_hint')}</p>
					</>
				)}
				<div className={b('actions')}>
					{self && !rejected && !error && (
						<Button
							large
							fullWidth
							theme={CommonType.PRIMARY}
							text={t('zkt_comp.judge_self_approve')}
							disabled={!reasonOk}
							loading={deciding}
							onClick={approveMyself}
						/>
					)}
					{(rejected || error) && (
						<Button
							large
							fullWidth
							theme={CommonType.PRIMARY}
							text={t('zkt_comp.judge_new_qr')}
							onClick={() => {
								setRejected(false);
								setRequest(null);
								jtis.current = [];
								void ask(false);
							}}
						/>
					)}
					<Button large fullWidth theme={CommonType.GRAY} text={t('zkt_comp.judge_cancel')} onClick={onClose} />
				</div>
			</div>
		</div>
	);
}
