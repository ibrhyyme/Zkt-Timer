import ActivePlayers from '../../match/active_players/ActivePlayers';
import React, {useContext} from 'react';
import {GameContext} from '../Game';
import block from '../../../../styles/bem';
import {openModal} from '../../../../actions/general';
import MatchPopup from '../../match/match_popup/MatchPopup';
import {useDispatch} from 'react-redux';
import {getGameMetaData} from '../../Play';
import Button from '../../../common/button/Button';
import {socketClient} from '../../../../util/socket/socketio';
import {useTranslation} from 'react-i18next';

const b = block('games-intro-challenge');

export default function GameChallenger() {
	const dispatch = useDispatch();
	const {gameType, multiplayerOnly, multiplayer} = useContext(GameContext);
	const {t} = useTranslation();
	const gameTypeData = getGameMetaData(gameType);

	if (!multiplayer) {
		return null;
	}

	const minPlayers = 2;
	const maxPlayers = 2;

	function openMatch(joinLobby: boolean) {
		dispatch(
			openModal(
				<MatchPopup
					cubeType="333"
					joinLobby={joinLobby}
					minPlayers={minPlayers}
					maxPlayers={maxPlayers}
					matchType={gameType}
				/>,
				{
					title: t('play.play_game', {name: gameTypeData.name}),
					onClose: () => {
						socketClient().emit('playerLeftLobby');
					},
				}
			)
		);
	}

	let joinLobbyButton = null;
	const challengeButton = <Button flat primary text={t('play.challenge')} large fullWidth onClick={() => openMatch(false)} />;

	// Custom styling on plain button when multiplayer only
	if (multiplayerOnly) {
		joinLobbyButton = <Button primary large fullWidth text={t('play.join_lobby')} onClick={() => openMatch(true)} />;
	}

	return (
		<div className="flex w-full flex-col justify-center gap-3">
			{joinLobbyButton}
			{challengeButton}
			<ActivePlayers matchType={gameType as any} />
		</div>
	);
}
