import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {CaretLeft, DotsThreeVertical, QrCode, SignOut} from 'phosphor-react';
import block from '../../../../styles/bem';
import AccountRequired from '../../../common/account_required/AccountRequired';
import {anchorOf, useActionMenu} from '../../../common/action_menu/ActionMenu';
import {useMe} from '../../../../util/hooks/useMe';
import {endJudging, fetchJudgeBoard, JudgeCallError, judgeErrorKey, toJudgeError} from '../../../../util/judge-api';
import {judgePath} from '../../../../util/judge-session';
import {b as scheduleBlock} from '../shared';
import JudgeRoundChooser from './JudgeRoundChooser';
import JudgeScanner from './JudgeScanner';
import {JudgeBoard, JudgeBoardCompetitor, JudgeBoardGroup, JudgeRound} from '../../../../../shared/zkt_judge';
import './Judge.scss';

const b = block('judge');

// Often enough to follow a group live, rare enough to cost the site nothing.
const BOARD_POLL_MS = 10000;

interface Props {
	competitionId: string;
}

function clock(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
}

// The round the organiser last looked at, per competition. Two rounds can be ACTIVE at
// once (a final whose cards are all accepted but not yet finished, next to the round
// being judged); without this the panel opened on the first in list order every time.
const ROUND_MEMORY_KEY = 'zt_judge_staff_round';

function rememberedRound(competitionId: string): string | null {
	try {
		const all = JSON.parse(localStorage.getItem(ROUND_MEMORY_KEY) || '{}');
		return typeof all?.[competitionId] === 'string' ? all[competitionId] : null;
	} catch {
		return null;
	}
}

function rememberRound(competitionId: string, roundId: string): void {
	try {
		const all = JSON.parse(localStorage.getItem(ROUND_MEMORY_KEY) || '{}');
		localStorage.setItem(ROUND_MEMORY_KEY, JSON.stringify({...(all && typeof all === 'object' ? all : {}), [competitionId]: roundId}));
	} catch {
		// Private mode or blocked storage: the panel just opens on the first running round.
	}
}

/** How many open cards have at least n attempts in, for every n of the format. */
function reached(group: JudgeBoardGroup, attemptCount: number): number[] {
	const open = group.competitors.filter((c) => c.card && !c.card.noShow && c.card.status !== 'CANCELLED');
	return Array.from({length: attemptCount}, (_, i) => open.filter((c) => (c.card?.filled || 0) >= i + 1).length);
}

/**
 * The organisers' panel in Zkt-Timer: "Hakem ata" (the reader), and group by
 * group who judges whom, who approved it, how far each card is. A judge's
 * authority can be ended from here (a stolen phone, a judge who left).
 */
export default function JudgeStaffPanel({competitionId}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();
	const menu = useActionMenu();
	const [rounds, setRounds] = useState<JudgeRound[] | null>(null);
	const [allowed, setAllowed] = useState<boolean | null>(null);
	const [roundId, setRoundId] = useState<string | null>(null);
	const [board, setBoard] = useState<JudgeBoard | null>(null);
	const [error, setError] = useState<JudgeCallError | null>(null);
	const [scanning, setScanning] = useState(false);
	const alive = useRef(true);

	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	useEffect(() => {
		if (!me) return;
		fetchJudgeBoard(competitionId)
			.then((res) => {
				if (!alive.current) return;
				setAllowed(res.canApprove);
				const list = res.rounds || [];
				setRounds(list);
				const running = list.filter((r) => r.status === 'ACTIVE');
				const remembered = list.find((r) => r.id === rememberedRound(competitionId) && r.status !== 'FINISHED');
				setRoundId(
					(current) => current || (remembered || running[0] || list.find((r) => r.status !== 'FINISHED') || null)?.id || null
				);
			})
			.catch((e) => alive.current && setError(toJudgeError(e)));
	}, [competitionId, me?.id]);

	const load = useCallback(async () => {
		if (!roundId) return;
		try {
			const res = await fetchJudgeBoard(competitionId, roundId);
			if (!alive.current) return;
			setBoard(res);
			setError(null);
		} catch (e) {
			if (alive.current) setError(toJudgeError(e));
		}
	}, [competitionId, roundId]);

	useEffect(() => {
		setBoard(null);
		void load();
		const timer = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			void load();
		}, BOARD_POLL_MS);
		return () => clearInterval(timer);
	}, [load]);

	function rowMenu(c: JudgeBoardCompetitor, target: HTMLElement) {
		const grantId = c.card?.grantId;
		if (!grantId) return;
		menu.open({
			...anchorOf(target),
			title: c.name,
			message: t('zkt_comp.judge_staff_end_message', {name: c.card?.judgeName || ''}),
			items: [
				{
					id: 'end',
					label: t('zkt_comp.judge_staff_end'),
					icon: <SignOut size={20} />,
					danger: true,
					onSelect: async () => {
						try {
							await endJudging(competitionId, {grantId});
						} catch (e) {
							setError(toJudgeError(e));
						}
						void load();
					},
				},
			],
		});
	}

	const back = (
		<button type="button" className={scheduleBlock('back')} onClick={() => history.push(judgePath(competitionId))}>
			<CaretLeft size={18} weight="bold" />
			{t('zkt_comp.judge_tab')}
		</button>
	);

	let body: React.ReactNode;
	if (!me) {
		body = <AccountRequired descriptionKey="zkt_comp.judge_account_required" />;
	} else if (allowed === false) {
		body = <p className={b('notice', {error: true})}>{t('zkt_comp.judge_approve_no_permission')}</p>;
	} else {
		const round = board?.round;
		body = (
			<>
				<button type="button" className={b('scan-cta')} onClick={() => setScanning(true)}>
					<QrCode size={28} />
					<span className={b('action-text')}>
						<span className={b('action-label')}>{t('zkt_comp.judge_scan_title')}</span>
						<span className={b('action-desc')}>{t('zkt_comp.judge_scan_cta_desc')}</span>
					</span>
				</button>

				{error && <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p>}

				<div className={b('field')}>
					{/* Every round, finished ones too: the panel also looks back. */}
					<JudgeRoundChooser
						rounds={rounds}
						roundId={roundId}
						onChange={(id) => {
							setRoundId(id);
							if (id) rememberRound(competitionId, id);
						}}
					/>
				</div>

				{round && board?.groups?.length === 0 && <p className={b('hint')}>{t('zkt_comp.judge_no_groups')}</p>}

				{round &&
					(board?.groups || []).map((g) => {
						const counts = reached(g, round.attemptCount);
						const opened = g.competitors.filter((c) => c.card).length;
						return (
							<section key={g.id} className={b('section')}>
								<div className={b('section-head')}>
									<h3 className={b('group-title')}>
										{t('my_schedule.col_group')} {g.number}
										{round.dualChance && ` · ${t('zkt_comp.chance_n', {n: g.chance})}`}
									</h3>
									<span className={b('section-hint')}>
										{t('zkt_comp.judge_staff_opened', {opened, total: g.competitors.length})}
									</span>
								</div>
								{/* Per attempt: how many open cards have it in. */}
								<div className={b('reach')} aria-label={t('zkt_comp.judge_staff_reach')}>
									{counts.map((n, i) => (
										<span key={i} className={b('reach-cell', {done: opened > 0 && n === opened})}>
											<span className={b('reach-no')}>{i + 1}</span>
											<span className={b('reach-count')}>{opened ? `${n}/${opened}` : '-'}</span>
										</span>
									))}
								</div>
								{g.judges.length > 0 && (
									<p className={b('hint')}>{t('zkt_comp.judge_staff_assigned', {names: g.judges.join(', ')})}</p>
								)}
								<ul className={b('people')}>
									{g.competitors.map((c) => {
										const card = c.card;
										const sub = !card
											? t('zkt_comp.judge_staff_not_opened')
											: card.status === 'ACCEPTED'
												? t('zkt_comp.judge_state_accepted')
												: card.noShow
													? t('zkt_comp.judge_no_show')
													: card.judgeName
														? [
																t('zkt_comp.judge_person_judge', {name: card.judgeName}),
																card.holderName && card.holderName !== card.judgeName
																	? t('zkt_comp.judge_staff_phone_of', {name: card.holderName})
																	: '',
																card.approvedByName ? t('zkt_comp.judge_staff_approved_by', {name: card.approvedByName}) : '',
																card.lastEntryAt ? t('zkt_comp.judge_staff_last_entry', {time: clock(card.lastEntryAt)}) : '',
															]
																.filter(Boolean)
																.join(' · ')
														: t('zkt_comp.judge_person_no_judge');
										const inner = (
											<>
												<span className={b('person-station')}>{c.station ?? '-'}</span>
												<span className={b('person-main')}>
													<span className={b('person-name')}>
														{c.number != null && <span className={b('person-number')}>{c.number}</span>}
														{c.name}
													</span>
													<span className={b('person-sub')}>{sub}</span>
												</span>
												{card && <span className={b('person-progress')}>{`${card.filled}/${card.expected}`}</span>}
												{card?.grantId && <DotsThreeVertical className={b('row-more')} size={20} weight="bold" aria-hidden="true" />}
											</>
										);
										return (
											<li key={c.key}>
												{card?.grantId ? (
													<button type="button" className={b('person')} onClick={(e) => rowMenu(c, e.currentTarget)}>
														{inner}
													</button>
												) : (
													<div className={b('person', {static: true})}>{inner}</div>
												)}
											</li>
										);
									})}
								</ul>
							</section>
						);
					})}
			</>
		);
	}

	return (
		<div className={b()}>
			{back}
			<h2 className={b('title')}>{t('zkt_comp.judge_staff_title')}</h2>
			{body}
			{menu.element}
			{scanning && (
				<JudgeScanner
					onClose={() => {
						setScanning(false);
						void load();
					}}
				/>
			)}
		</div>
	);
}
