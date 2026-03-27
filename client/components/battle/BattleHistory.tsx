import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBattle } from './BattleContext';
import { getTimeString } from '../../util/time';
import { X } from 'phosphor-react';
import block from '../../styles/bem';

const b = block('battle');

function formatSolveTime(solve?: { time: number; plusTwo: boolean; dnf: boolean }) {
	if (!solve) return '-';
	if (solve.dnf) return 'DNF';
	const time = solve.plusTwo ? solve.time + 2 : solve.time;
	return getTimeString(time) + (solve.plusTwo ? '+' : '');
}

export default function BattleHistory() {
	const { t } = useTranslation();
	const { state, dispatch } = useBattle();
	const { rounds, historyOpen, settings } = state;

	if (!historyOpen) return null;

	return (
		<div className={b('overlay')}>
			<div className={b('overlay-header')}>
				<h2>{t('battle.history')}</h2>
				<button className={b('overlay-close')} onClick={() => dispatch({ type: 'TOGGLE_HISTORY' })}>
					<X size={24} />
				</button>
			</div>

			{/* Header row */}
			<div className={b('history-header-row')}>
				<div className={b('history-col', { num: true })}>#</div>
				<div className={b('history-col', { time: true })}>{settings.player1Name}</div>
				<div className={b('history-col', { time: true })}>{settings.player2Name}</div>
				<div className={b('history-col', { winner: true })}>{t('battle.winner')}</div>
			</div>

			{/* Rows */}
			{rounds.map((round, i) => {
				const winnerLabel = round.winner === 1 ? 'P1' : round.winner === 2 ? 'P2' : round.winner === 'tie' ? t('battle.tie') : '';

				return (
					<div key={i} className={b('history-row')}>
						<div className={b('history-col', { num: true })}>{i + 1}</div>
						<div className={`${b('history-col', { time: true })} ${round.winner === 1 ? b('history-winner-text') : ''}`}>
							{formatSolveTime(round.player1Solve)}
						</div>
						<div className={`${b('history-col', { time: true })} ${round.winner === 2 ? b('history-winner-text') : ''}`}>
							{formatSolveTime(round.player2Solve)}
						</div>
						<div className={b('history-col', { winner: true })}>
							{winnerLabel}
						</div>
					</div>
				);
			})}
		</div>
	);
}
