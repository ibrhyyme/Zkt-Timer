import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import ChoiceGroup from '../../../common/choice_group/ChoiceGroup';
import {fetchJudgeBoard, JudgeCallError, judgeErrorKey, toJudgeError} from '../../../../util/judge-api';
import {b as scheduleBlock, localEventName} from '../shared';
import JudgeRoundChooser from './JudgeRoundChooser';
import {chancesOf, groupsOfChance, shownCompetitors} from './judge-people';
import {JudgeBoard, JudgeBoardCompetitor, JudgeBoardGroup, JudgeRound} from '../../../../../shared/zkt_judge';

const b = block('judge');

export interface PickedCard {
	round: JudgeRound;
	group: JudgeBoardGroup;
	competitor: JudgeBoardCompetitor;
	/** Everyone in the round, for "Hakemi değiştir" by competitor number. */
	people: JudgeBoardCompetitor[];
}

export interface PickerSelection {
	roundId: string | null;
	groupId: string | null;
}

interface Props {
	competitionId: string;
	onPick: (picked: PickedCard) => void;
	/** Where the judge was last time: a judge opens card after card in the same group. */
	initial?: PickerSelection;
	onSelection?: (selection: PickerSelection) => void;
}

export function roundLabel(t: any, round: JudgeRound): string {
	return `${localEventName(t, round.eventId)} · ${t('zkt_comp.judge_round_n', {n: round.roundNumber})}`;
}

/** Step 1 of "Hakem Ol": the round, the group, then the competitor at the judge's station. */
export default function JudgePicker({competitionId, onPick, initial, onSelection}: Props) {
	const {t} = useTranslation();
	const [rounds, setRounds] = useState<JudgeRound[] | null>(null);
	const [roundId, setRoundId] = useState<string | null>(initial?.roundId ?? null);
	const [board, setBoard] = useState<JudgeBoard | null>(null);
	const [groupId, setGroupId] = useState<string | null>(initial?.groupId ?? null);
	// Çift Şans: the chance whose groups are listed (until picked: the chosen group's).
	const [chance, setChance] = useState<number | null>(null);
	// The group kept from last time survives the first load of its round.
	const keepGroup = useRef(!!initial?.groupId);

	useEffect(() => {
		onSelection?.({roundId, groupId});
	}, [roundId, groupId]);
	const [number, setNumber] = useState('');
	const [error, setError] = useState<JudgeCallError | null>(null);

	useEffect(() => {
		let alive = true;
		fetchJudgeBoard(competitionId)
			.then((res) => {
				if (!alive) return;
				// A finished round takes no judges.
				const open = (res.rounds || []).filter((r) => r.status !== 'FINISHED');
				setRounds(open);
				// The round being run right now is almost always the one meant.
				const running = open.filter((r) => r.status === 'ACTIVE');
				setRoundId((current) => {
					if (current && open.some((r) => r.id === current)) return current;
					if (running.length === 1) return running[0].id;
					return open.length === 1 ? open[0].id : null;
				});
			})
			.catch((e) => alive && setError(toJudgeError(e)));
		return () => {
			alive = false;
		};
	}, [competitionId]);

	useEffect(() => {
		setChance(null);
		if (!roundId) {
			// Another event with no round picked yet: the old event's groups and
			// competitors must go at once, or the judge reads them as the new
			// event's (owner, 2026-11-14).
			setBoard(null);
			setGroupId(null);
			return;
		}
		let alive = true;
		setBoard(null);
		if (keepGroup.current) keepGroup.current = false;
		else setGroupId(null);
		setError(null);
		fetchJudgeBoard(competitionId, roundId)
			.then((res) => {
				if (!alive) return;
				setBoard(res);
				setGroupId((current) => {
					if (current && res.groups?.some((g) => g.id === current)) return current;
					return res.groups?.length === 1 ? res.groups[0].id : null;
				});
			})
			.catch((e) => alive && setError(toJudgeError(e)));
		return () => {
			alive = false;
		};
	}, [competitionId, roundId]);

	const group = board?.groups?.find((g) => g.id === groupId) || null;
	const dualChance = !!board?.round?.dualChance;
	const shownChance = chance ?? group?.chance ?? null;
	const chances = useMemo(() => chancesOf(board?.groups || []), [board]);
	const groupChoices = groupsOfChance(board?.groups || [], dualChance, shownChance);

	function pickChance(next: number) {
		setChance(next);
		if (group && group.chance !== next) setGroupId(null);
	}
	const people = useMemo(() => {
		const seen = new Map<string, JudgeBoardCompetitor>();
		for (const g of board?.groups || []) for (const c of g.competitors) if (!seen.has(c.key)) seen.set(c.key, c);
		return [...seen.values()];
	}, [board]);

	const shown = useMemo(() => (group ? shownCompetitors(group.competitors, number) : []), [group, number]);

	function pick(competitor: JudgeBoardCompetitor) {
		if (!board?.round || !group) return;
		onPick({round: board.round, group, competitor, people});
	}

	return (
		<div className={b('picker')}>
			{error && <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p>}

			<div className={b('field')}>
				{rounds && rounds.length === 0 ? (
					<>
						<span className={b('label')}>{t('my_schedule.col_event')}</span>
						<p className={b('hint')}>{t('zkt_comp.judge_no_rounds')}</p>
					</>
				) : (
					// Only the events with an open round: a finished round takes no judges.
					<JudgeRoundChooser rounds={rounds} roundId={roundId} onChange={setRoundId} />
				)}
			</div>

			{board?.groups && board.groups.length > 0 && dualChance && (
				<div className={b('field')}>
					<span className={b('label')}>{t('zkt_comp.judge_chance')}</span>
					<ChoiceGroup<number>
						label={t('zkt_comp.judge_chance')}
						value={shownChance}
						onChange={pickChance}
						options={chances.map((n) => ({value: n, label: t('zkt_comp.chance_n', {n})}))}
					/>
				</div>
			)}

			{groupChoices.length > 0 && (
				<div className={b('field')}>
					<span className={b('label')}>{t('my_schedule.col_group')}</span>
					<ChoiceGroup<string>
						numeric
						label={t('my_schedule.col_group')}
						value={groupId}
						onChange={setGroupId}
						options={groupChoices.map((g) => ({value: g.id, label: String(g.number)}))}
					/>
				</div>
			)}
			{board?.groups && board.groups.length === 0 && <p className={b('hint')}>{t('zkt_comp.judge_no_groups')}</p>}

			{group && (
				<div className={b('field')}>
					<label className={b('label')} htmlFor="judge-number">
						{t('zkt_comp.judge_pick_competitor')}
					</label>
					<input
						id="judge-number"
						className={b('input')}
						type="text"
						enterKeyHint="search"
						autoComplete="off"
						autoCorrect="off"
						spellCheck={false}
						placeholder={t('zkt_comp.judge_number_placeholder')}
						value={number}
						onChange={(e) => setNumber(e.target.value.slice(0, 60))}
					/>
					<ul className={b('people')}>
						{shown.map((c) => (
							<li key={c.key}>
								<button type="button" className={b('person')} onClick={() => pick(c)}>
									<span className={b('person-station')}>{c.station ?? '-'}</span>
									<span className={b('person-main')}>
										<span className={b('person-name')}>
											{c.number != null && <span className={b('person-number')}>{c.number}</span>}
											{c.name}
											{c.self && <span className={scheduleBlock('me-badge')}>{t('my_schedule.you')}</span>}
										</span>
										<span className={b('person-sub')}>
											{c.card?.status === 'ACCEPTED'
												? t('zkt_comp.judge_state_accepted')
												: c.card?.judgeName
													? t('zkt_comp.judge_person_judge', {name: c.card.judgeName})
													: t('zkt_comp.judge_person_no_judge')}
										</span>
									</span>
									{c.card && (
										<span className={b('person-progress')}>
											{c.card.noShow ? t('zkt_comp.judge_no_show') : `${c.card.filled}/${c.card.expected}`}
										</span>
									)}
								</button>
							</li>
						))}
					</ul>
					{shown.length === 0 && <p className={b('hint')}>{t('zkt_comp.judge_no_match')}</p>}
					<p className={b('hint')}>{t('zkt_comp.judge_list_legend')}</p>
				</div>
			)}
		</div>
	);
}
