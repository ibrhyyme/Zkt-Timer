import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {CheckCircle, UserCircle, WarningCircle, XCircle} from 'phosphor-react';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import {decideJudgeApproval, JudgeCallError, judgeErrorKey, previewJudgeApproval, toJudgeError} from '../../../../util/judge-api';
import {localEventName} from '../shared';
import {formatJudgeValue, JudgeApprovalPreview, JudgeGrantResult} from '../../../../../shared/zkt_judge';

const b = block('judge');

// The site refuses a reason longer than this (lib/zkt/judge/service.ts REASON_MAX).
const REASON_MAX = 300;

interface Props {
	token: string;
	/** Back to the reader, or wherever the approval was opened from. */
	onDone: () => void;
	/** The label of the button that leaves a finished approval ("Sıradaki" in the reader). */
	doneLabel: string;
}

/**
 * One screen for the three things a judge's QR can ask: become this card's judge
 * (JUDGE), change a sent time (CORRECT), write an extra (EXTRA). The site decides
 * who may answer; somebody who may not sees no person and no card.
 */
/** A profile picture, or the empty face when there is none. */
function Face({url}: {url?: string | null}) {
	return url ? (
		<img className={b('ac-face')} src={url} alt="" />
	) : (
		<UserCircle className={b('ac-face', {empty: true})} size={44} weight="light" />
	);
}

export default function JudgeApproval({token, onDone, doneLabel}: Props) {
	const {t} = useTranslation();
	const [preview, setPreview] = useState<JudgeApprovalPreview | null>(null);
	const [error, setError] = useState<JudgeCallError | null>(null);
	const [reason, setReason] = useState('');
	const [deciding, setDeciding] = useState<'APPROVE' | 'REJECT' | null>(null);
	const [result, setResult] = useState<JudgeGrantResult | null>(null);
	// A finished card asks twice: the first tap only arms the button.
	const [armed, setArmed] = useState(false);
	const alive = useRef(true);

	useEffect(() => {
		alive.current = true;
		setPreview(null);
		setError(null);
		setResult(null);
		setReason('');
		setArmed(false);
		previewJudgeApproval(token)
			.then((p) => alive.current && setPreview(p))
			.catch((e) => alive.current && setError(toJudgeError(e)));
		return () => {
			alive.current = false;
		};
	}, [token]);

	async function decide(decision: 'APPROVE' | 'REJECT') {
		setDeciding(decision);
		setError(null);
		try {
			const res = await decideJudgeApproval(token, decision, preview?.purpose === 'EXTRA' ? reason : null);
			if (alive.current) setResult(res);
		} catch (e) {
			if (alive.current) setError(toJudgeError(e));
		} finally {
			if (alive.current) setDeciding(null);
		}
	}

	const done = <Button large fullWidth theme={CommonType.GRAY} text={doneLabel} onClick={onDone} />;

	if (result) {
		const approved = result.status === 'approved';
		return (
			<div className={b('approval')}>
				<div className={b('verdict', {approved, rejected: !approved})}>
					{approved ? <CheckCircle size={40} weight="fill" /> : <XCircle size={40} weight="fill" />}
					<span>{t(approved ? 'zkt_comp.judge_approve_done_approved' : 'zkt_comp.judge_approve_done_rejected')}</span>
				</div>
				{approved && result.superseded && (
					<p className={b('hint')}>{t('zkt_comp.judge_approve_done_superseded', {name: result.superseded.name})}</p>
				)}
				{done}
			</div>
		);
	}

	if (!preview) {
		return (
			<div className={b('approval')}>
				{error ? <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p> : <p className={b('hint')}>{t('zkt_comp.judge_approve_loading')}</p>}
				{error && done}
			</div>
		);
	}

	if (!preview.canApprove && !preview.round) {
		// No right to decide: the site sent nothing about the person or the card.
		const key =
			preview.reason === 'EXTRA_DELEGATES_ONLY'
				? 'zkt_comp.judge_approve_extra_only'
				: preview.reason === 'NO_PERMISSION'
					? 'zkt_comp.judge_approve_no_permission'
					: judgeErrorKey(preview.reason || 'UNKNOWN');
		return (
			<div className={b('approval')}>
				<p className={b('notice', {error: true})}>{t(key)}</p>
				{done}
			</div>
		);
	}

	const purpose = preview.purpose;
	const round = preview.round;
	const requester = preview.requester;
	const judgeName = preview.judge?.name;
	const judgeDiffers = preview.judge?.differsFromHolder ?? (!!judgeName && !!requester && judgeName !== requester.name);
	// The judge cell: the named judge, else the phone's owner (who judges themselves).
	const judgeShown = judgeName || requester?.name || null;
	const judgeFace =
		preview.judge?.avatarUrl ?? (preview.judge?.external || judgeDiffers ? null : (requester?.avatarUrl ?? null));
	const attemptValue = preview.attempt ? formatJudgeValue(preview.attempt.value, round?.eventId || '') : '';
	const reasonOk = purpose !== 'EXTRA' || reason.trim().length >= 2;
	const decided = preview.decision;
	const blocked = !preview.canApprove && !decided ? preview.reason : null;
	// The card this approval reopens. A finished one is almost always a judge who
	// picked the wrong event or group (owner, 2026-11-14), so it is said loudly.
	const cardInfo = purpose === 'JUDGE' ? preview.card : null;
	const cardFinished = !!cardInfo && (cardInfo.noShow || (cardInfo.expected > 0 && cardInfo.filled >= cardInfo.expected));

	return (
		<div className={b('approval')}>
			<span className={b('approval-kind', {purpose: purpose.toLowerCase()})}>
				{t(`zkt_comp.judge_approve_kind_${purpose.toLowerCase()}`)}
			</span>

			{/* The paper scorecard's head, faces included (owner, 2026-11-14): event and
			    round on the band, then who competes, where, and who judges. The approver
			    once checked only the names and missed that the judge had picked the last
			    event, so the event leads in large type. */}
			<div className={b('ac')}>
				{round && (
					<div className={b('ac-bar')}>
						<span className={b('ac-event')}>{localEventName(t, round.eventId)}</span>
						<span className={b('ac-round')}>
							{t('zkt_comp.judge_round_n', {n: round.roundNumber})}
							{round.dualChance && preview.chance != null ? ` · ${t('zkt_comp.chance_n', {n: preview.chance})}` : ''}
						</span>
					</div>
				)}
				<div className={b('ac-cells')}>
					{preview.competitor && (
						<div className={b('ac-cell', {full: true})}>
							<span className={b('label')}>{t('zkt_comp.judge_competitor')}</span>
							<span className={b('ac-person')}>
								<Face url={preview.competitor.avatarUrl} />
								<span className={b('ac-name')}>
									{preview.competitor.number != null && <span className={b('person-number')}>{preview.competitor.number}</span>}
									{preview.competitor.name}
								</span>
							</span>
						</div>
					)}
					{preview.group && (
						<div className={b('ac-cell')}>
							<span className={b('label')}>{t('my_schedule.col_group')}</span>
							<span className={b('ac-value')}>{preview.group.number}</span>
						</div>
					)}
					{preview.station != null && (
						<div className={b('ac-cell')}>
							<span className={b('label')}>{t('zkt_comp.judge_station')}</span>
							<span className={b('ac-value')}>{preview.station}</span>
						</div>
					)}
					{judgeShown && (
						<div className={b('ac-cell', {full: true})}>
							<span className={b('label')}>{t('zkt_comp.judge_judge')}</span>
							<span className={b('ac-person')}>
								<Face url={judgeFace} />
								<span className={b('ac-who')}>
									<span className={b('ac-name')}>{judgeShown}</span>
									{/* A borrowed phone or an outside judge: who judges is not who holds the phone. */}
									{preview.judge?.external ? (
										<span className={b('ac-sub')}>{t('zkt_comp.judge_approve_external')}</span>
									) : judgeDiffers ? (
										<span className={b('ac-sub')}>{t('zkt_comp.judge_approve_borrowed', {name: requester?.name || ''})}</span>
									) : (
										requester?.zktId && <span className={b('ac-sub', {mono: true})}>{requester.zktId}</span>
									)}
								</span>
							</span>
						</div>
					)}
					{preview.attempt && preview.attempt.no != null && (
						<div className={b('ac-cell', {full: true})}>
							<span className={b('label')}>{t('zkt_comp.judge_approve_attempt')}</span>
							<span className={b('ac-value')}>
								{preview.attempt.no}
								{/* A correction on an extra line: the time shown is the extra's. */}
								{preview.purpose === 'CORRECT' && preview.attempt.extra ? ` · ${t('zkt_comp.judge_approve_on_extra')}` : ''}
								{attemptValue ? ` · ${attemptValue}` : ''}
							</span>
						</div>
					)}
				</div>
			</div>

			{cardInfo?.noShow && (
				<p className={b('notice', {error: true, icon: true})}>
					<WarningCircle size={18} weight="fill" />
					{t('zkt_comp.judge_approve_warn_no_show')}
				</p>
			)}
			{cardInfo && !cardInfo.noShow && cardFinished && (
				<p className={b('notice', {error: true, icon: true})}>
					<WarningCircle size={18} weight="fill" />
					{t('zkt_comp.judge_approve_warn_card_done', {filled: cardInfo.filled, expected: cardInfo.expected})}
				</p>
			)}
			{cardInfo?.endedJudge && (
				<p className={b('notice', {warning: true, icon: true})}>
					<WarningCircle size={18} weight="fill" />
					{t('zkt_comp.judge_approve_warn_ended', {name: cardInfo.endedJudge})}
				</p>
			)}
			{(preview.warnings || []).map((w) => (
				<p key={w} className={b('notice', {warning: true, icon: true})}>
					<WarningCircle size={18} weight="fill" />
					{t(w === 'COMPETES_IN_GROUP' ? 'zkt_comp.judge_approve_warn_competes' : 'zkt_comp.judge_approve_warn_not_assigned')}
				</p>
			))}
			{preview.currentJudge && (
				<p className={b('notice', {warning: true, icon: true})}>
					<WarningCircle size={18} weight="fill" />
					{t('zkt_comp.judge_approve_replaces', {name: preview.currentJudge.name})}
				</p>
			)}

			{decided ? (
				<>
					<p className={b('notice')}>
						{t(decided.status === 'approved' ? 'zkt_comp.judge_approve_already_approved' : 'zkt_comp.judge_approve_already_rejected', {
							name: decided.decidedBy,
						})}
					</p>
					{done}
				</>
			) : blocked ? (
				<>
					<p className={b('notice', {error: true})}>{t(judgeErrorKey(blocked))}</p>
					{done}
				</>
			) : (
				<>
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
					{error && <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p>}
					<div className={b('decide')}>
						<Button
							large
							fullWidth
							theme={cardFinished ? CommonType.WARNING : CommonType.SUCCESS}
							text={t(cardFinished && armed ? 'zkt_comp.judge_approve_yes_anyway' : 'zkt_comp.judge_approve_yes')}
							disabled={!reasonOk || !!deciding}
							loading={deciding === 'APPROVE'}
							onClick={() => (cardFinished && !armed ? setArmed(true) : decide('APPROVE'))}
						/>
						<Button
							large
							fullWidth
							theme={CommonType.DANGER}
							text={t('zkt_comp.judge_approve_no')}
							disabled={!!deciding}
							loading={deciding === 'REJECT'}
							onClick={() => decide('REJECT')}
						/>
					</div>
					<button type="button" className={b('link', {quiet: true})} onClick={onDone}>
						{t('zkt_comp.judge_cancel')}
					</button>
				</>
			)}
		</div>
	);
}
