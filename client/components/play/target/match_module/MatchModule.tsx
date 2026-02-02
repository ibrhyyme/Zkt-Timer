import React, { useContext } from 'react';
import './MatchModule.scss';
import { GameContext } from '../../game/Game';
import block from '../../../../styles/bem';
import { PlayerStatus } from '../../../../shared/match/types';
import { MatchContext } from '../../match/Match';
import { useMe } from '../../../../util/hooks/useMe';
import Button from '../../../common/button/Button';
import Challengers from '../challengers/Challengers';
import { useGeneral } from '../../../../util/hooks/useGeneral';

const b = block('match-module');

// Center module that shows game/match status
export default function MatchModule() {
	const gameContext = useContext(GameContext);
	const matchContext = useContext(MatchContext);
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');

	const { matchOpen, retrySolve, solves, getPlayerStatusInfo, timeIndex } = gameContext;
	const playerStatus = getPlayerStatusInfo(me.id, timeIndex, solves, matchContext?.match);
	const status = playerStatus.status;

	let timeAlert;
	let retryAlert = null;

	switch (status) {
		case PlayerStatus.Lost: {
			timeAlert = (
				<span className={b('alert', { red: true })}>
					{solves.length} çözüm tamamladın
				</span>
			);

			// Can't retry solves in multiplayer
			if (!matchOpen) {
				retryAlert = <Button text="Başarısız çözümü tekrarla" onClick={retrySolve} />;
			}
			break;
		}
		case PlayerStatus.Won: {
			timeAlert = <span className={b('alert', { green: true })}>Tebrikler! Kazandın!</span>;
			break;
		}
	}

	return (
		<div className={b()}>
			{/* Mobilde header'ı gizle, sadece tur tablosunu göster */}
			{!mobileMode && (
				<div className={b('header')}>
					<span className={b('objective')}>{playerStatus.statusPrompt}</span>
					<div className={b('retry')}>{retryAlert}</div>
				</div>
			)}
			<Challengers />
		</div>
	);
}

