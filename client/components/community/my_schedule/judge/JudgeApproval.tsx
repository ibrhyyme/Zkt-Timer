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
	const judgeDiffers = !!judgeName && !!requester && judgeName !== requester.name;
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

			{/* Event, round and group first and large: the approver checked the names
			    and missed that the judge had picked the last event (owner, 2026-11-14). */}
			{round && (
				<div className={b('approval-target')}>
					<span className={b('approval-target-event')}>
						{localEventName(t, round.eventId)} · {t('zkt_comp.judge_round_n', {n: round.roundNumber})}
					</span>
					{preview.group && (
						<span className={b('approval-target-group')}>
							{t('my_schedule.col_group')} {preview.group.number}
							{round.dualChance && preview.chance != null ? ` · ${t('zkt_comp.chance_n', {n: preview.chance})}` : ''}
						</span>
					)}
				</div>
			)}

			{requester && (
				<div className={b('requester')}>
					{requester.avatarUrl ? (
						<img className={b('requester-avatar')} src={requester.avatarUrl} alt="" />
					) : (
						<UserCircle className={b('requester-avatar', {empty: true})} size={56} weight="light" />
					)}
					<div className={b('requester-main')}>
						<span className={b('requester-name')}>{requester.name}</span>
						{requester.zktId && <span className={b('requester-id')}>{requester.zktId}</span>}
					</div>
				</div>
			)}

			{/* A borrowed phone: who judges is not who holds the phone. */}
			{judgeName && (judgeDiffers || preview.judge?.external) && (
				<div className={b('notice', {strong: true})}>
					<span className={b('label')}>{t('zkt_comp.judge_judge')}</span>
					<strong className={b('approval-judge')}>{judgeName}</strong>
					<span className={b('hint')}>
						{preview.judge?.external
							? t('zkt_comp.judge_approve_external')
							: t('zkt_comp.judge_approve_borrowed', {name: requester?.name || ''})}
					</span>
				</div>
			)}

			<dl className={b('facts', {grid: true})}>
				{preview.competitor && (
					<div className={b('fact', {full: true})}>
						<dt>{t('zkt_comp.judge_competitor')}</dt>
						<dd className={b('fact-text')}>
							{preview.competitor.number != null && <span className={b('person-number')}>{preview.competitor.number}</span>}
							{preview.competitor.name}
						</dd>
					</div>
				)}
				{preview.station != null && (
					<div className={b('fact')}>
						<dt>{t('zkt_comp.judge_station')}</dt>
						<dd>{preview.station}</dd>
					</div>
				)}
				{preview.attempt && preview.attempt.no != null && (
					<div className={b('fact')}>
						<dt>{t('zkt_comp.judge_approve_attempt')}</dt>
						<dd>
							{preview.attempt.no}
							{/* A correction on an extra line: the time shown is the extra's. */}
							{preview.purpose === 'CORRECT' && preview.attempt.extra ? ` · ${t('zkt_comp.judge_approve_on_extra')}` : ''}
							{attemptValue ? ` · ${attemptValue}` : ''}
						</dd>
					</div>
				)}
			</dl>

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
