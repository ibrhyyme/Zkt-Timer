import React, { ReactNode, useMemo, useState, useEffect } from 'react';
import './MatchOver.scss';
import block from '../../../../styles/bem';
import { Sword } from 'phosphor-react';
import Button from '../../../common/button/Button';
import Avatar from '../../../common/avatar/Avatar';
import { useMe } from '../../../../util/hooks/useMe';
import { socketClient } from '../../../../util/socket/socketio';
import { Match } from '../../../../../server/schemas/Match.schema';
import Lobby from '../match_popup/lobby/Lobby';
import { IModalProps } from '../../../common/modal/Modal';
import EloChange from './elo_change/EloChange';
import { GameType } from '../../../../../shared/match/consts';
import { MatchEndedBy } from '../../../../shared/match/types';
import { useTranslation } from 'react-i18next';

const b = block('match-over');

interface Props extends IModalProps {
	match: Match;
	matchType: GameType;
	exitMatch: () => void;
}

export default function MatchOver(props: Props) {
	const me = useMe();
	const { t } = useTranslation();

	const [rematchRequested, setRematchRequested] = useState(false);
	const [newMatch, setNewMatch] = useState(false);
	const { match, matchType, exitMatch } = props;

	const endReason = useMemo(() => {
		if (match.aborted) {
			return MatchEndedBy.ABORT;
		}

		for (const part of match.participants) {
			if (!part.lost) {
				continue;
			}

			if (part.forfeited) {
				return MatchEndedBy.FORFEITURE;
			} else if (part.resigned) {
				return MatchEndedBy.RESIGNATION;
			}
		}

		return MatchEndedBy.LOSS;
	}, []);

	const winner = useMemo(() => {
		for (const part of match.participants) {
			if (part.won) {
				return part.user;
			}
		}

		return null;
	}, []);

	const isWinner = winner?.id === me.id;

	function requestRematch() {
		if (rematchRequested) {
			return;
		}

		socketClient().emit('playerJoinedRematchQueue', match.id);

		setRematchRequested(true);
	}

	function exitModal() {
		exitMatch();
	}

	if (newMatch) {
		return (
			<div className={b('lobby')}>
				<Lobby matchType={matchType} onCancel={() => setNewMatch(false)} />
			</div>
		);
	}

	const players = (match?.participants || []).map((player) => (
		<div key={player.id} className={b('player', { won: player.won })}>
			<Avatar hideBadges showEloType="333" target="_blank" vertical user={player.user} />
		</div>
	));

	let header;
	if (match.aborted) {
		header = t('match.solve_aborted');
	} else if (isWinner) {
		header = t('match.you_won');
	} else if (winner) {
		header = t('match.player_won', { username: winner.username });
	} else {
		header = t('match.match_ended');
	}

	let endedBy: ReactNode = null;
	switch (endReason) {
		case MatchEndedBy.RESIGNATION: {
			endedBy = t('match.by_resignation');
			break;
		}
		case MatchEndedBy.FORFEITURE: {
			endedBy = t('match.by_forfeiture');
			break;
		}
	}

	if (endedBy) {
		endedBy = <span className={b('ended-by')}>{endedBy}</span>;
	}

	// 10 saniye içinde işlem yapılmazsa otomatik çıkış
	useEffect(() => {
		if (newMatch || rematchRequested) return;

		const timer = setTimeout(() => {
			exitMatch();
		}, 10000);

		return () => clearTimeout(timer);
	}, [newMatch, rematchRequested, exitMatch]);

	let rematchText = t('match.rematch');
	let rematchDisabled = false;
	if (rematchRequested) {
		rematchText = t('match.rematch_requested');
		rematchDisabled = true;
	} else if (!match?.ended_at) {
		rematchDisabled = true;
	}

	return (
		<div className={b({ won: isWinner, aborted: match.aborted })}>
			<div className={b('header', { won: isWinner })}>
				<div>
					<h3 className={b('winner', { won: winner })}>{header}</h3>
					{endedBy}
				</div>
			</div>
			<div className={b('sword')}>
				<Sword />
			</div>
			<EloChange userId={me.id} eloLogs={match.elo_log} />
			<div className={b('players')}>{players}</div>
			<div className={b('actions')}>
				<div className={b('main-actions')}>
					<Button gray large text={t('play.join_lobby')} onClick={() => setNewMatch(true)} />
					<Button primary glow large text={rematchText} disabled={rematchDisabled} onClick={requestRematch} />
				</div>
				<Button text={t('match.exit')} onClick={exitModal} flat white />
			</div>
		</div>
	);
}
