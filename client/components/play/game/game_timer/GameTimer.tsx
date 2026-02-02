import Modal from '../../../common/modal/Modal';
import Timer from '../../../timer/Timer';
import React, { ReactNode, useContext } from 'react';
import onSolve from '../../helpers/on_solve';
import { GameContext, getGameLink } from '../Game';
import Match, { MatchContext } from '../../match/Match';
import { TimerProps } from '../../../timer/@types/interfaces';
import { PlayerStatus } from '../../../../shared/match/types';
import { Match as MatchSchema } from '../../../../../server/schemas/Match.schema';
import { useMe } from '../../../../util/hooks/useMe';
import { useGeneral } from '../../../../util/hooks/useGeneral';

export default function GameTimer() {
	const context = useContext(GameContext);
	const matchContext = useContext(MatchContext);
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');

	const {
		cubeType,
		gameType,
		visual1,
		visual2,
		visual3,
		showTimer,
		solves,
		timeIndex,
		getPlayerStatusInfo,
		linkCode,
		closeTimer,
		setSolves,
		matchOpen,
	} = context;

	const scramble = context.scramble || ' ';

	if (!matchOpen && !showTimer) {
		return null;
	}

	function updateSolves(solves) {
		setSolves(solves);
	}

	const visual1Param = visual1;
	const visual2Param = visual2;
	const visual3Param = visual3(context);

	const playerStatus = getPlayerStatusInfo(me.id, timeIndex, solves, matchContext?.match);

	async function timerOnSolve(solve, match?: MatchSchema) {
		return onSolve(solve, context, match);
	}

	const disabled = playerStatus.status === PlayerStatus.Lost;

	// Mobilde sadece visual1 (tur tablosu) göster, visual2 (MatchModule) gizle
	const footerModules = [
		{
			customBody: () => ({
				module: visual1Param,
			}),
			hideAllOptions: true,
		},
	];

	// Masaüstünde visual2 ekle
	if (!mobileMode) {
		footerModules.push({
			customBody: () => ({
				module: visual2Param,
			}),
			hideAllOptions: true,
		});
	}

	// visual3 (Scramble/Chat) masaüstünde her zaman ekle
	if (!mobileMode) {
		footerModules.push({
			customBody: () => ({
				module: visual3Param,
			}),
			hideAllOptions: true,
		});
	}



	const timerParams: TimerProps = {
		scramble: disabled ? ' ' : scramble,
		scrambleLocked: true,
		inModal: true,
		matchMode: true,
		forceMobileLayout: mobileMode,
		disabled,
		ignorePbEvents: true,
		solvesFilter: {
			game_session_id: context.sessionId,
		},
		onSolve: timerOnSolve,
		cubeType,
		headerOptions: {
			hideSessionSelector: true,
			hideNewSession: true,
			hideCubeType: true,
		},
		timerCustomFooterModules: footerModules,
	};

	if (matchOpen) {
		return (
			<Match
				timerParams={timerParams}
				onSolve={timerOnSolve}
				matchPath={getGameLink(gameType)}
				onClose={closeTimer}
				solveIndex={timeIndex}
				updateSolves={updateSolves}
				linkCode={linkCode}
				matchType={gameType}
				cubeType={cubeType}
				minPlayers={2}
				maxPlayers={2}
			/>
		);
	} else if (showTimer) {
		const timer: ReactNode = <Timer {...timerParams} />;

		return (
			<Modal onClose={closeTimer} fullSize overFlowHidden>
				{timer}
			</Modal>
		);
	} else {
		return null;
	}
}
