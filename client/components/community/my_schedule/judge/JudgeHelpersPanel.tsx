import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {CaretLeft, DotsThreeVertical, UserMinus} from 'phosphor-react';
import block from '../../../../styles/bem';
import AccountRequired from '../../../common/account_required/AccountRequired';
import {anchorOf, useActionMenu} from '../../../common/action_menu/ActionMenu';
import {useMe} from '../../../../util/hooks/useMe';
import {
	addJudgeHelper,
	fetchJudgeHelpers,
	JudgeCallError,
	judgeErrorKey,
	removeJudgeHelper,
	searchJudgeHelpers,
	toJudgeError,
} from '../../../../util/judge-api';
import {judgePath} from '../../../../util/judge-session';
import {b as scheduleBlock} from '../shared';
import {JudgeHelperCandidate, JudgeHelperState} from '../../../../../shared/zkt_judge';
import './Judge.scss';

const b = block('judge');

const SEARCH_MIN = 2;
const SEARCH_DELAY_MS = 300;

interface Props {
	competitionId: string;
}

/**
 * "Yardımcılar" (owner, 2026-11-17): an admin picks Zkt-Timer members who then
 * approve judges and corrections at this competition only, never extras. A
 * member without a linked ZKT account waits in the list and gets the right
 * once they link. The site decides who may open this (judge.assign_helpers).
 */
export default function JudgeHelpersPanel({competitionId}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();
	const menu = useActionMenu();
	const [state, setState] = useState<JudgeHelperState | null>(null);
	const [error, setError] = useState<JudgeCallError | null>(null);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<JudgeHelperCandidate[] | null>(null);
	const [busy, setBusy] = useState(false);
	const alive = useRef(true);
	const searchSeq = useRef(0);

	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	useEffect(() => {
		if (!me) return;
		fetchJudgeHelpers(competitionId)
			.then((res) => alive.current && setState(res))
			.catch((e) => alive.current && setError(toJudgeError(e)));
	}, [competitionId, me?.id]);

	useEffect(() => {
		const term = query.trim();
		if (term.length < SEARCH_MIN) {
			setResults(null);
			return;
		}
		const seq = ++searchSeq.current;
		const timer = setTimeout(() => {
			searchJudgeHelpers(competitionId, term)
				.then((res) => alive.current && seq === searchSeq.current && setResults(res))
				.catch((e) => alive.current && seq === searchSeq.current && setError(toJudgeError(e)));
		}, SEARCH_DELAY_MS);
		return () => clearTimeout(timer);
	}, [competitionId, query]);

	async function change(run: () => Promise<JudgeHelperState>) {
		setBusy(true);
		try {
			const next = await run();
			if (!alive.current) return;
			setState(next);
			setError(null);
		} catch (e) {
			if (alive.current) setError(toJudgeError(e));
		} finally {
			if (alive.current) setBusy(false);
		}
	}

	function pick(c: JudgeHelperCandidate) {
		if (c.status || busy) return;
		setQuery('');
		setResults(null);
		void change(() => addJudgeHelper(competitionId, c.userId));
	}

	function removeMenu(name: string, target: {memberId: string} | {userId: string}, anchor: HTMLElement) {
		menu.open({
			...anchorOf(anchor),
			title: name,
			message: t('zkt_comp.judge_helpers_remove_message', {name}),
			items: [
				{
					id: 'remove',
					label: t('zkt_comp.judge_helpers_remove'),
					icon: <UserMinus size={20} />,
					danger: true,
					onSelect: () => change(() => removeJudgeHelper(competitionId, target)),
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
	} else if (error?.code === 'NO_PERMISSION' && !state) {
		body = <p className={b('notice', {error: true})}>{t('zkt_comp.judge_helpers_no_permission')}</p>;
	} else {
		const empty = state && state.helpers.length === 0 && state.pending.length === 0;
		body = (
			<>
				<p className={b('hint')}>{t('zkt_comp.judge_helpers_hint')}</p>

				{error && <p className={b('notice', {error: true})}>{t(judgeErrorKey(error.code))}</p>}

				<div className={b('field')}>
					<label className={b('label')} htmlFor="judge-helper-search">
						{t('zkt_comp.judge_helpers_search_label')}
					</label>
					<input
						id="judge-helper-search"
						className={b('input')}
						type="text"
						enterKeyHint="search"
						autoComplete="off"
						autoCorrect="off"
						autoCapitalize="off"
						spellCheck={false}
						placeholder={t('zkt_comp.judge_helpers_search_placeholder')}
						value={query}
						disabled={!state}
						onChange={(e) => setQuery(e.target.value.slice(0, 64))}
					/>
					{results && results.length === 0 && <p className={b('hint')}>{t('zkt_comp.judge_helpers_no_results')}</p>}
					{results && results.length > 0 && (
						<ul className={b('people')}>
							{results.map((c) => {
								const sub = c.status
									? t(`zkt_comp.judge_helpers_status_${c.status}`)
									: c.linked
										? [c.zktName, c.zktId].filter(Boolean).join(' · ')
										: t('zkt_comp.judge_helpers_not_linked');
								return (
									<li key={c.userId}>
										<button
											type="button"
											className={b('person', {static: !!c.status})}
											disabled={!!c.status || busy}
											onClick={() => pick(c)}
										>
											<span className={b('person-main')}>
												<span className={b('person-name')}>{c.username}</span>
												{sub && <span className={b('person-sub')}>{sub}</span>}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				<div className={b('field')}>
					<span className={b('label')}>{t('zkt_comp.judge_helpers_list')}</span>
					{empty && <p className={b('hint')}>{t('zkt_comp.judge_helpers_empty')}</p>}
					{state && !empty && (
						<ul className={b('people')}>
							{state.helpers.map((h) => (
								<li key={h.memberId}>
									<button
										type="button"
										className={b('person')}
										disabled={busy}
										onClick={(e) => removeMenu(h.name, {memberId: h.memberId}, e.currentTarget)}
									>
										<span className={b('person-main')}>
											<span className={b('person-name')}>{h.name}</span>
											<span className={b('person-sub')}>
												{[h.zktId, h.addedByName ? t('zkt_comp.judge_helpers_added_by', {name: h.addedByName}) : '']
													.filter(Boolean)
													.join(' · ')}
											</span>
										</span>
										<DotsThreeVertical className={b('row-more')} size={20} weight="bold" aria-hidden="true" />
									</button>
								</li>
							))}
							{state.pending.map((p) => (
								<li key={p.userId}>
									<button
										type="button"
										className={b('person')}
										disabled={busy}
										onClick={(e) => removeMenu(p.username, {userId: p.userId}, e.currentTarget)}
									>
										<span className={b('person-main')}>
											<span className={b('person-name')}>{p.username}</span>
											<span className={b('person-sub')}>{t('zkt_comp.judge_helpers_pending_sub')}</span>
										</span>
										<DotsThreeVertical className={b('row-more')} size={20} weight="bold" aria-hidden="true" />
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</>
		);
	}

	return (
		<div className={b()}>
			{back}
			<h2 className={b('title')}>{t('zkt_comp.judge_helpers_title')}</h2>
			{body}
			{menu.element}
		</div>
	);
}
