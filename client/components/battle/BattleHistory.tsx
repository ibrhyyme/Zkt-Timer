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
	const { rounds, historyOpen, settings, selectedRound } = state;

	if (!historyOpen) return null;

	const selectedRoundData = selectedRound !== null ? rounds[selectedRound] : null;

	const getWinnerName = (winner?: 1 | 2 | 'tie') => {
		if (winner === 1) return settings.player1Name;
		if (winner === 2) return settings.player2Name;
		return t('battle.tie');
	};

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
					<div
						key={i}
						className={b('history-row')}
						onClick={() => dispatch({ type: 'SELECT_ROUND', roundIndex: i })}
					>
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

			{/* Round detail modal */}
			{selectedRoundData && (
				<div
					className={b('round-detail-backdrop')}
					onClick={() => dispatch({ type: 'DESELECT_ROUND' })}
				>
					<div className={b('round-detail-card')} onClick={(e) => e.stopPropagation()}>
						<div className={b('round-detail-header')}>
							<h3>{t('battle.round_detail', { number: selectedRound + 1 })}</h3>
							<button
								className={b('overlay-close')}
								onClick={() => dispatch({ type: 'DESELECT_ROUND' })}
							>
								<X size={20} />
							</button>
						</div>

						<div className={b('round-detail-scramble')}>
							<div className={b('round-detail-label')}>{t('battle.scramble_label')}</div>
							<div className={b('round-detail-scramble-text')}>{selectedRoundData.scramble}</div>
						</div>

						<div className={b('round-detail-players')}>
							<div
								className={b('round-detail-player', {
									winner: selectedRoundData.winner === 1,
									loser: selectedRoundData.winner === 2,
								})}
							>
								<div className={b('round-detail-player-name')}>{settings.player1Name}</div>
								<div className={b('round-detail-player-time')}>
									{formatSolveTime(selectedRoundData.player1Solve)}
								</div>
							</div>
							<div
								className={b('round-detail-player', {
									winner: selectedRoundData.winner === 2,
									loser: selectedRoundData.winner === 1,
								})}
							>
								<div className={b('round-detail-player-name')}>{settings.player2Name}</div>
								<div className={b('round-detail-player-time')}>
									{formatSolveTime(selectedRoundData.player2Solve)}
								</div>
							</div>
						</div>

						{selectedRoundData.winner && (
							<div className={b('round-detail-result')}>
								{selectedRoundData.winner === 'tie'
									? t('battle.tie')
									: t('battle.wins', { name: getWinnerName(selectedRoundData.winner) })}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
