import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Sword} from 'phosphor-react';
import block from '../../../styles/bem';
import {gqlQueryTyped} from '../../api';
import {UserBattleRatingDocument, UserBattleRatingQuery} from '../../../@types/generated/graphql';
import {BATTLE_PUZZLE} from '../../../../shared/battle/config';
import {useBattleLaunch} from '../../battle/useBattleLaunch';
import './BattleRatingLine.scss';

const b = block('battle-rating-line');

type Rating = NonNullable<UserBattleRatingQuery['userBattleRating']>;

interface Props {
	userId: string;
}

/**
 * One line on a profile: "Online Battle 1532 · #27", linking to /ranks (ranking-battle 5.6, Q5).
 * Drawn only for a player who has a rating and a place on the leaderboard. Fetched after
 * mount, so the server render and hydration never include it; while Online Battle is not
 * open to the viewer nothing is asked and nothing is drawn.
 */
export default function BattleRatingLine({userId}: Props) {
	const {t} = useTranslation();
	const launch = useBattleLaunch();
	const open = !!launch?.open;
	const [rating, setRating] = useState<Rating | null>(null);

	useEffect(() => {
		setRating(null);
		if (!open || !userId) return;
		let alive = true;
		gqlQueryTyped(UserBattleRatingDocument, {userId, puzzle: BATTLE_PUZZLE}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				if (alive) setRating(res?.data?.userBattleRating || null);
			})
			.catch(() => {
				// The line is optional; a failed read just leaves it out.
			});
		return () => {
			alive = false;
		};
	}, [open, userId]);

	if (!rating || rating.rating == null || rating.rank == null) return null;

	return (
		<Link className={b()} to="/ranks">
			<Sword className={b('icon')} weight="bold" aria-hidden="true" />
			<span className={b('text')}>
				{t('ranks.profile_line', {rating: rating.rating, rank: rating.rank})}
				{rating.provisional && <span className={b('provisional')}> ?</span>}
			</span>
		</Link>
	);
}
