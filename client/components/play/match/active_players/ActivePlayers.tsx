import React, {useEffect, useState} from 'react';
import './ActivePlayers.scss';
import {socketClient} from '../../../../util/socket/socketio';
import {GameType} from '../../../../@types/generated/graphql';
import {SocketConst} from '../../../../shared/socket_costs';
import {useTranslation} from 'react-i18next';

interface Props {
	matchType: GameType;
}

export default function ActivePlayers(props: Props) {
	const {matchType} = props;
	const {t} = useTranslation();

	const [loaded, setLoaded] = useState(false);
	const [playersInQueue, setPlayersInQueue] = useState(0);
	const [playersInMatch, setPlayersInMatch] = useState(0);

	useEffect(() => {
		startWatching();

		socketClient().on('roomSizeUpdate', (data) => {
			setLoaded(true);
			setPlayersInQueue(data[matchType]?.lobby || 0);
			setPlayersInMatch(data[matchType]?.match || 0);
		});

		return () => {
			stopWatching();
		};
	}, []);

	function getPlayerName(c) {
		return c + ' ' + (c === 1 ? t('match.player') : t('match.players_label'));
	}

	function startWatching() {
		socketClient().emit(SocketConst.WATCH_ROOM_SIZES);
	}

	function stopWatching() {
		socketClient().emit(SocketConst.STOP_WATCHING_ROOM_SIZES);
	}

	let body;
	if (loaded) {
		body = `${getPlayerName(playersInQueue)} ${t('match.in_lobby')} / ${getPlayerName(playersInMatch)} ${t('match.in_match')}`;
	} else {
		return null;
	}

	return (
		<div className="cd-match__active-users">
			<p>{body}</p>
		</div>
	);
}
