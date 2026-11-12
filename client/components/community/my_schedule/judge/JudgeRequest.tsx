import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import ChoiceGroup from '../../../common/choice_group/ChoiceGroup';
import {
	fetchJudgeMe,
	JudgeCallError,
	JudgeCardRequest,
	judgeErrorKey,
	requestJudgeQr,
	selfAuthorizeJudge,
	toJudgeError,
} from '../../../../util/judge-api';
import {PickedCard, roundLabel} from './JudgePicker';
import {JudgeChoice, JudgeMe, JudgeRequestResult} from '../../../../../shared/zkt_judge';

const b = block('judge');

// The QR lives about two minutes; a new one replaces it this long before it
// runs out, so the approver never scans a code about to expire.
const REFRESH_BEFORE_EXPIRY_MS = 25000;
const POLL_MS = 2500;

type JudgeKind = 'self' | 'competitor' | 'external';

interface Props {
	competitionId: string;
	picked: PickedCard;
	/** Name on the member's own account, shown as the default judge. */
	ownName: string;
	onApproved: (cardId: string | null, me: JudgeMe | null) => void;
	onCancel: () => void;
}

/**
 * Steps 2 and 3 of "Hakem Ol": confirm the card and who judges it, then show
 * the QR to an organiser. Nothing is stored anywhere until they approve it.
 */
export default function JudgeRequest({competitionId, picked, ownName, onApproved, onCancel}: Props) {
	const {t} = useTranslation();
	const [station, setStation] = useState(picked.competitor.station != null ? String(picked.competitor.station) : '');
	const [kind, setKind] = useState<JudgeKind>('self');
	const [judgeNumber, setJudgeNumber] = useState('');
	const [judgeName, setJudgeName] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<JudgeCallError | null>(null);
	const [request, setRequest] = useState<JudgeRequestResult | null>(null);
	// "You compete in this group" has to be read and accepted before a QR shows.
	const [warningAccepted, setWarningAccepted] = useState(false);
	const [rejected, setRejected] = useState(false);
	const sent = useRef<JudgeCardRequest | null>(null);
	// The code on screen and the one before it: an approver may have scanned the
	// old one a moment before it was replaced.
	const jtis = useRef<string[]>([]);

	const judgeTarget = picked.people.find((p) => String(p.number ?? '') === judgeNumber.trim()) || null;

	function buildChoice(): JudgeChoice | null {
		if (kind === 'self') return {kind: 'self'};
		if (kind === 'external') {
			const name = judgeName.trim().replace(/\s+/g, ' ');
			return name.length >= 2 ? {kind: 'external', name} : null;
		}
		return judgeTarget ? {kind: 'competitor', key: judgeTarget.key} : null;
	}

	const choice = buildChoice();

	async function ask(body: JudgeCardRequest, silent = false): Promise<void> {
		if (!silent) {
			setBusy(true);
			setError(null);
		}
		try {
			const res = await requestJudgeQr(body);
			sent.current = body;
			jtis.current = [res.jti, ...jtis.current].slice(0, 2);
			setRequest(res);
		} catch (e) {
			// A failed silent refresh keeps the code that is still on screen.
			if (!silent) setError(toJudgeError(e));
		} finally {
			if (!silent) setBusy(false);
		}
	}

	function submit() {
		if (!choice) return;
		const stationNumber = station.trim() ? parseInt(station, 10) : null;
		setRejected(false);
		setWarningAccepted(false);
		jtis.current = [];
		void ask({
			competitionId,
			groupId: picked.group.id,
			competitorKey: picked.competitor.key,
			stationNumber,
			judge: choice,
		});
	}

	async function authorizeThisDevice() {
		if (!sent.current) return;
		setBusy(true);
		setError(null);
		try {
			const grant = await selfAuthorizeJudge(sent.current);
			const me = await fetchJudgeMe(competitionId).catch(() => null);
			// The card opens and this screen is gone: nothing more to set here.
			onApproved(grant.cardId, me);
		} catch (e) {
			setError(toJudgeError(e));
			setBusy(false);
		}
	}

	const competes = !!request?.warnings?.includes('COMPETES_IN_GROUP');
	const showingQr = !!request && !request.canSelfAuthorize && (!competes || warningAccepted) && !rejected;

	// Replace the code quietly before it expires.
	useEffect(() => {
		if (!showingQr || !request || !sent.current) return;
		const wait = Math.max(5000, new Date(request.expiresAt).getTime() - Date.now() - REFRESH_BEFORE_EXPIRY_MS);
		const timer = setTimeout(() => {
			if (sent.current) void ask(sent.current, true);
		}, wait);
		return () => clearTimeout(timer);
	}, [showingQr, request?.jti]);

	// "Was I approved?" every few seconds while the code shows.
	useEffect(() => {
		if (!showingQr) return;
		let alive = true;
		let tick = 0;
		const check = async () => {
			if (typeof document !== 'undefined' && document.hidden) return;
			const jti = jtis.current[tick++ % Math.max(1, jtis.current.length)];
			try {
				const me = await fetchJudgeMe(competitionId, jti);
				if (!alive) return;
				if (me.request?.status === 'approved') onApproved(me.request.cardId ?? null, me);
				else if (me.request?.status === 'rejected') setRejected(true);
			} catch {
				// Quiet: the next tick asks again.
			}
		};
		const timer = setInterval(check, POLL_MS);
		return () => {
			alive = false;
			clearInterval(timer);
		};
	}, [showingQr, competitionId]);

	const summary = (
		<dl className={b('summary')}>
			<dt>{t('zkt_comp.judge_competitor')}</dt>
			<dd>
				{picked.competitor.number != null && <span className={b('person-number')}>{picked.competitor.number}</span>}
				{picked.competitor.name}
			</dd>
			<dt>{t('zkt_comp.judge_round')}</dt>
			<dd>{roundLabel(t, picked.round)}</dd>
			<dt>{t('my_schedule.col_group')}</dt>
			<dd>
				{picked.group.number}
				{picked.round.dualChance && ` · ${t('zkt_comp.chance_n', {n: picked.group.chance})}`}
			</dd>
			{request && (
				<>
					<dt>{t('zkt_comp.judge_station')}</dt>
					<dd>{request.station ?? '-'}</dd>
					<dt>{t('zkt_comp.judge_judge')}</dt>
					<dd>{request.judge?.name}</dd>
				</>
			)}
		</dl>
	);

	if (request && rejected) {
		return (
			<div className={b('request')}>
				<p className={b('notice', {error: true})}>{t('zkt_comp.judge_request_rejected')}</p>
				<div className={b('actions')}>
					<Button theme={CommonType.PRIMARY} text={t('zkt_comp.judge_new_qr')} onClick={submit} loading={busy} />
					<Button theme={CommonType.GRAY} text={t('zkt_comp.judge_cancel')} onClick={onCancel} />
				</div>
			</div>
		);
	}

	if (request && competes && !warningAccepted) {
		return (
			<div className={b('request')}>
				{summary}
				<p className={b('notice', {warning: true})}>
					{request.judge?.differsFromHolder
						? t('zkt_comp.judge_warn_competes_other', {name: request.judge.name})
						: t('zkt_comp.judge_warn_competes')}
				</p>
				<div className={b('actions')}>
					<Button theme={CommonType.PRIMARY} text={t('zkt_comp.judge_continue')} onClick={() => setWarningAccepted(true)} />
					<Button theme={CommonType.GRAY} text={t('zkt_comp.judge_cancel')} onClick={onCancel} />
				</div>
			</div>
		);
	}

	if (request) {
		return (
			<div className={b('request')}>
				{summary}
				{request.warnings?.includes('NOT_ASSIGNED_JUDGE') && (
					<p className={b('notice')}>{t('zkt_comp.judge_warn_not_assigned')}</p>
				)}
				{error && <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p>}
				{request.canSelfAuthorize ? (
					<>
						<p className={b('hint')}>{t('zkt_comp.judge_self_hint')}</p>
						{/* The QR path warns on the approver's screen; this path has no such screen. */}
						{request.currentJudge && (
							<p className={b('notice', {warning: true})}>
								{t('zkt_comp.judge_self_replaces', {name: request.currentJudge.name})}
							</p>
						)}
						<div className={b('actions')}>
							<Button
								large
								theme={CommonType.PRIMARY}
								text={t('zkt_comp.judge_self_authorize')}
								onClick={authorizeThisDevice}
								loading={busy}
							/>
							<Button theme={CommonType.GRAY} text={t('zkt_comp.judge_cancel')} onClick={onCancel} />
						</div>
					</>
				) : (
					<>
						<h3 className={b('qr-title')}>{t('zkt_comp.judge_qr_title')}</h3>
						{/* The site draws the code black on white with its quiet zone;
						    an inverted or tinted QR is a known scan failure. */}
						<div className={b('qr')} dangerouslySetInnerHTML={{__html: request.qrSvg}} />
						<p className={b('hint')}>{t('zkt_comp.judge_qr_hint')}</p>
						<div className={b('actions')}>
							<Button theme={CommonType.GRAY} text={t('zkt_comp.judge_cancel')} onClick={onCancel} />
						</div>
					</>
				)}
			</div>
		);
	}

	return (
		<div className={b('request')}>
			{summary}

			<div className={b('field')}>
				<label className={b('label')} htmlFor="judge-station">
					{t('zkt_comp.judge_station')}
				</label>
				<input
					id="judge-station"
					className={b('input', {short: true})}
					inputMode="numeric"
					autoComplete="off"
					value={station}
					onChange={(e) => setStation(e.target.value.replace(/\D/g, '').slice(0, 2))}
				/>
				<p className={b('hint')}>{t('zkt_comp.judge_station_hint')}</p>
			</div>

			<div className={b('field')}>
				<span className={b('label')}>{t('zkt_comp.judge_judge')}</span>
				<ChoiceGroup<JudgeKind>
					label={t('zkt_comp.judge_judge')}
					value={kind}
					onChange={setKind}
					options={[
						{value: 'self', label: ownName || t('zkt_comp.judge_kind_self')},
						{value: 'competitor', label: t('zkt_comp.judge_kind_competitor')},
						{value: 'external', label: t('zkt_comp.judge_kind_external')},
					]}
				/>
				{kind === 'competitor' && (
					<>
						<input
							className={b('input', {short: true})}
							inputMode="numeric"
							autoComplete="off"
							aria-label={t('zkt_comp.judge_kind_competitor')}
							placeholder={t('zkt_comp.judge_judge_number_placeholder')}
							value={judgeNumber}
							onChange={(e) => setJudgeNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
						/>
						<p className={b('hint')}>
							{judgeTarget
								? judgeTarget.name
								: judgeNumber
									? t('zkt_comp.judge_judge_number_unknown')
									: t('zkt_comp.judge_judge_number_hint')}
						</p>
					</>
				)}
				{kind === 'external' && (
					<>
						<input
							className={b('input')}
							autoComplete="off"
							maxLength={40}
							aria-label={t('zkt_comp.judge_kind_external')}
							placeholder={t('zkt_comp.judge_judge_name_placeholder')}
							value={judgeName}
							onChange={(e) => setJudgeName(e.target.value)}
						/>
						<p className={b('hint')}>{t('zkt_comp.judge_external_hint')}</p>
					</>
				)}
			</div>

			{error && <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p>}

			<div className={b('actions')}>
				<Button
					large
					theme={CommonType.PRIMARY}
					text={t('zkt_comp.judge_confirm')}
					onClick={submit}
					disabled={!choice}
					loading={busy}
				/>
				<Button theme={CommonType.GRAY} text={t('zkt_comp.judge_cancel')} onClick={onCancel} />
			</div>
		</div>
	);
}
