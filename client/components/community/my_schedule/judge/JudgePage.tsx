import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {useHistory, useLocation} from 'react-router-dom';
import {CaretLeft, QrCode, UsersThree} from 'phosphor-react';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import AccountRequired from '../../../common/account_required/AccountRequired';
import {useMe} from '../../../../util/hooks/useMe';
import {endJudging, fetchJudgeBoard, judgeErrorKey} from '../../../../util/judge-api';
import {getJudgeOutbox, onJudgeResults, startJudgeOutbox} from '../../../../util/judge-outbox-device';
import {judgePath, rememberJudgeMe} from '../../../../util/judge-session';
import {b as scheduleBlock, localEventName} from '../shared';
import {useJudgeMe, useJudgeOutbox} from './useJudgeMe';
import JudgePicker, {PickedCard, PickerSelection} from './JudgePicker';
import JudgeRequest from './JudgeRequest';
import JudgeCard, {JudgeCardHandle} from './JudgeCard';
import JudgeSwitch from './JudgeSwitch';
import JudgeScanner from './JudgeScanner';
import {JudgeCard as JudgeCardData, JudgeMe} from '../../../../../shared/zkt_judge';
import './Judge.scss';

const b = block('judge');

// While a card is open: often enough to notice the desk accepting it or another
// judge taking over, rare enough to cost nothing.
const CARD_POLL_MS = 15000;

interface Props {
	competitionId: string;
}

/**
 * "Hakem Ol" on a ZKT competition: pick a card, get it approved by QR, type the
 * times. Lives outside the competition loader on purpose: a judge with a card
 * open must reach it even when the competition page itself cannot load.
 */
export default function JudgePage({competitionId}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const user = useMe();
	const userId = user?.id || null;
	const isZkt = competitionId.startsWith('zkt-');
	const {me, setMe, error, loaded, refresh} = useJudgeMe(competitionId, userId, {pollMs: CARD_POLL_MS, skip: !isZkt});
	const outbox = useJudgeOutbox();
	const [picked, setPicked] = useState<PickedCard | null>(null);
	const [picking, setPicking] = useState(false);
	const [selection, setSelection] = useState<PickerSelection>({roundId: null, groupId: null});
	// Organisers who may approve judges get the reader and the panel here too.
	const [canApprove, setCanApprove] = useState(false);
	const [scanning, setScanning] = useState(false);

	const cardId = new URLSearchParams(location.search).get('card');
	const cards = me?.cards || [];
	const card = cards.find((c) => c.cardId === cardId) || null;
	// Short of judges, one judge takes two competitors (owner, 2026-11-14): every
	// card in hand stays mounted, so a time typed but not yet sent on one waits
	// there while the judge works the other.
	const switching = !!card && cards.length > 1;
	const cardHandles = useRef(new Map<string, JudgeCardHandle>());

	useEffect(() => {
		if (userId) startJudgeOutbox();
	}, [userId]);

	const enabled = !!me?.linked && !!me?.enabled;
	useEffect(() => {
		if (!enabled) return;
		let alive = true;
		fetchJudgeBoard(competitionId)
			.then((res) => alive && setCanApprove(!!res.canApprove))
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [competitionId, enabled]);

	// The site's answer to a sent time carries the card as it is now.
	useEffect(() => {
		return onJudgeResults((settled) => {
			setMe((current) => {
				if (!current?.cards) return current;
				let next = current;
				for (const {result} of settled) {
					const snap = result.card;
					if (!snap) continue;
					next = {
						...next,
						cards: next.cards!.map((c) =>
							c.cardId !== snap.id
								? c
								: {
										...c,
										cardStatus: snap.status,
										noShow: snap.noShow,
										completed: snap.completed,
										// The order the extras were used in: E1, then E2.
										extraAttempts: snap.extraAttempts,
										attempts: c.attempts.map((slot, i) => {
											const value = snap.attempts[i] ?? null;
											const extra = snap.extraAttempts.includes(slot.no);
											// An extra just landed: until `me` answers, the attempt line keeps the time it showed.
											const original = extra && !slot.extra ? slot.value : slot.original;
											if (value === slot.value) return {...slot, extra, original};
											return {...slot, value, extra, original, state: value === null ? 'empty' : 'sent'};
										}),
									}
						),
					};
				}
				if (next !== current && userId) rememberJudgeMe(competitionId, userId, next);
				return next;
			});
			void refresh();
		});
	}, [competitionId, userId, refresh, setMe]);

	function openCard(id: string | null) {
		setPicked(null);
		setPicking(false);
		history.replace(judgePath(competitionId, id));
	}

	function onApproved(approvedCardId: string | null, fresh: JudgeMe | null) {
		if (fresh && userId) {
			rememberJudgeMe(competitionId, userId, fresh);
			setMe(fresh);
		} else {
			void refresh();
		}
		// Times typed for this card under an earlier approval and stopped by the
		// site may go again now.
		if (approvedCardId) void getJudgeOutbox().retryBlocked(approvedCardId);
		openCard(approvedCardId);
	}

	function switchCard(id: string) {
		// Shown in the same tap, so the focus call below still counts as the
		// user's: iOS opens the keyboard only for a focus inside the gesture.
		flushSync(() => history.replace(judgePath(competitionId, id)));
		cardHandles.current.get(id)?.focusEntry();
	}

	async function endCard(target: JudgeCardData) {
		await endJudging(competitionId, {grantId: target.grantId});
		const fresh = await refresh();
		if (!fresh) {
			// No answer after the end: drop the card from the device copy too, or the
			// next app open (or the crash return) brings back a card that is over.
			setMe((current) => {
				if (!current) return current;
				const next = {...current, cards: (current.cards || []).filter((c) => c.cardId !== target.cardId)};
				if (userId) rememberJudgeMe(competitionId, userId, next);
				return next;
			});
		}
		openCard(null);
	}

	const back = (
		<button className={scheduleBlock('back')} onClick={() => history.push(`/competitions/${competitionId}`)}>
			<CaretLeft size={18} weight="bold" />
			{t('my_schedule.back_to_competition')}
		</button>
	);

	let body: React.ReactNode;
	if (!isZkt) {
		body = <p className={b('notice')}>{t('zkt_comp.judge_error_disabled')}</p>;
	} else if (!userId) {
		body = <AccountRequired descriptionKey="zkt_comp.judge_account_required" />;
	} else if (!me) {
		body = loaded && error ? <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p> : null;
	} else if (!me.linked) {
		body = (
			<div className={b('empty')}>
				<p className={b('notice')}>{t('zkt_comp.judge_link_required')}</p>
				<Button theme={CommonType.PRIMARY} text={t('zkt_comp.judge_link_cta')} to="/account/linked-accounts" />
			</div>
		);
	} else if (switching) {
		body = cards.map((c) => (
			<div key={c.cardId} hidden={c.cardId !== card!.cardId}>
				<JudgeCard
					ref={(handle) => {
						if (handle) cardHandles.current.set(c.cardId, handle);
						else cardHandles.current.delete(c.cardId);
					}}
					competitionId={competitionId}
					userId={userId}
					card={c}
					outbox={outbox}
					onEnd={() => endCard(c)}
					onBack={() => openCard(null)}
					onRefresh={refresh}
					sendToStation
					hidden={c.cardId !== card!.cardId}
					switcher={
						<JudgeSwitch cards={cards} activeId={card!.cardId} outbox={outbox} userId={userId} onSwitch={switchCard} />
					}
				/>
			</div>
		));
	} else if (card) {
		body = (
			<JudgeCard
				key={card.cardId}
				competitionId={competitionId}
				userId={userId}
				card={card}
				outbox={outbox}
				onEnd={() => endCard(card)}
				onBack={() => openCard(null)}
				onRefresh={refresh}
			/>
		);
	} else if (!me.enabled) {
		body = <p className={b('notice')}>{t('zkt_comp.judge_error_disabled')}</p>;
	} else if (picked) {
		body = (
			<JudgeRequest
				competitionId={competitionId}
				picked={picked}
				ownName={user?.username || ''}
				onApproved={onApproved}
				onCancel={() => setPicked(null)}
			/>
		);
	} else {
		const endedHere = cardId ? (me.ended || []).find((e) => e.cardId === cardId) : null;
		const stray = outbox.items.filter((i) => i.userId === userId && i.competitionId === competitionId && i.state !== 'pending');
		body = (
			<div className={b('home')}>
				{canApprove && (
					<div className={b('field')}>
						<span className={b('label')}>{t('zkt_comp.judge_staff_section')}</span>
						<ul className={b('actions-list')}>
							<li>
								<button type="button" className={b('action-row')} onClick={() => setScanning(true)}>
									<QrCode size={22} />
									<span className={b('action-text')}>
										<span className={b('action-label')}>{t('zkt_comp.judge_scan_title')}</span>
										<span className={b('action-desc')}>{t('zkt_comp.judge_scan_cta_desc')}</span>
									</span>
								</button>
							</li>
							<li>
								<button
									type="button"
									className={b('action-row')}
									onClick={() => history.push(`/competitions/${competitionId}/judge/staff`)}
								>
									<UsersThree size={22} />
									<span className={b('action-text')}>
										<span className={b('action-label')}>{t('zkt_comp.judge_staff_title')}</span>
										<span className={b('action-desc')}>{t('zkt_comp.judge_staff_desc')}</span>
									</span>
								</button>
							</li>
						</ul>
					</div>
				)}
				{endedHere && (
					<p className={b('notice', {warning: true})}>
						{t(`zkt_comp.judge_ended_${(endedHere.reason || 'staff').toLowerCase()}`, {
							name: endedHere.competitorName || '',
							defaultValue: t('zkt_comp.judge_ended_staff', {name: endedHere.competitorName || ''}),
						})}
					</p>
				)}
				{stray.length > 0 && !endedHere && (
					<p className={b('notice', {warning: true})}>{t('zkt_comp.judge_stray_entries', {count: stray.length})}</p>
				)}
				{cards.length > 0 && (
					<div className={b('field')}>
						<span className={b('label')}>{t('zkt_comp.judge_my_cards')}</span>
						<ul className={b('people')}>
							{cards.map((c) => (
								<li key={c.cardId}>
									<button type="button" className={b('person')} onClick={() => openCard(c.cardId)}>
										<span className={b('person-station')}>{c.station ?? '-'}</span>
										<span className={b('person-main')}>
											<span className={b('person-name')}>{c.competitor.name}</span>
											<span className={b('person-sub')}>
												{localEventName(t, c.round.eventId)} · {t('zkt_comp.judge_round_n', {n: c.round.roundNumber})}
												{c.group?.number != null && ` · ${t('my_schedule.col_group')} ${c.group.number}`}
											</span>
										</span>
										<span className={b('person-progress')}>
											{c.noShow ? t('zkt_comp.judge_no_show') : `${c.filled}/${c.expected}`}
										</span>
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
				{cards.length > 0 && !picking ? (
					<Button theme={CommonType.GRAY} text={t('zkt_comp.judge_new_card')} onClick={() => setPicking(true)} />
				) : (
					<JudgePicker competitionId={competitionId} onPick={setPicked} initial={selection} onSelection={setSelection} />
				)}
			</div>
		);
	}

	return (
		<div className={b()}>
			{!card && back}
			{!card && <h2 className={b('title')}>{t('zkt_comp.judge_tab')}</h2>}
			{body}
			{scanning && <JudgeScanner onClose={() => setScanning(false)} />}
		</div>
	);
}
