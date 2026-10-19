import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Sword} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {gqlQueryTyped} from '../../api';
import {BattleHeadToHeadDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {useBattleLaunch} from '../../battle/useBattleLaunch';
import type {BattleHeadToHead} from '../../../../shared/battle/types';
import {toHeadToHead} from '../../battle/online/DuelInviteScreen';
import './BattleRatingLine.scss';

const b = block('duel-line');

interface Props {
	userId: string;
	username: string;
}

/**
 * Someone else's profile: the score between the viewer and this player ("Head to head 7–4")
 * and "Challenge", which opens Online Battle with this player as the duel's addressee (they
 * get a notification once the viewer sends it with a cube connected). Only for a signed-in
 * viewer who can play Online Battle; fetched after mount, never part of the server render.
 */
export default function DuelChallengeLine({userId, username}: Props) {
	const {t} = useTranslation();
	const me = useMe();
	const launch = useBattleLaunch();
	const open = !!launch?.open && !!me && me.id !== userId;
	const [score, setScore] = useState<BattleHeadToHead | null>(null);

	useEffect(() => {
		setScore(null);
		if (!open) return;
		let alive = true;
		gqlQueryTyped(BattleHeadToHeadDocument, {userId}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				if (alive) setScore(toHeadToHead(res?.data?.battleHeadToHead));
			})
			.catch(() => {
				// The score is optional; the button works without it.
			});
		return () => {
			alive = false;
		};
	}, [open, userId]);

	if (!open || !username) return null;
	const played = score ? score.wins + score.losses + score.draws : 0;

	return (
		<div className={b()}>
			<Sword className={b('icon')} weight="bold" aria-hidden="true" />
			{played > 0 && score && (
				<span className={b('text')}>
					{t('online_battle.duel.profile_h2h', {wins: score.wins, losses: score.losses})}
					{score.draws > 0 && <span> · {t('online_battle.duel.h2h_draws', {count: score.draws})}</span>}
				</span>
			)}
			<Button
				small
				primary
				text={t('online_battle.duel.profile_challenge')}
				to={`/battle/online?challenge=${encodeURIComponent(username)}`}
			/>
		</div>
	);
}
