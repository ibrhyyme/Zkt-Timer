import React, {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {CaretRight, Sword} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {openModal} from '../../../actions/general';
import {gqlQueryTyped} from '../../api';
import {BattleHeadToHeadDocument, UserBattleRatingDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {useBattleLaunch} from '../../battle/useBattleLaunch';
import {BATTLE_PUZZLE} from '../../../../shared/battle/config';
import type {BattleHeadToHead} from '../../../../shared/battle/types';
import {toHeadToHead} from '../../battle/online/DuelInviteScreen';
import {QueueRating, toQueueRating} from '../../battle/online/QueueScreen';
import BattlePlayerModal from './BattlePlayerModal';
import DuelChallengeModal from './DuelChallengeModal';
import './BattleProfile.scss';

const b = block('battle-card');

// One width for both modals, so moving from one to the other never resizes the frame.
const BATTLE_MODAL_WIDTH = 480;

interface Props {
	userId: string;
	username: string;
	/** Storage path of the profile picture. */
	avatar: string | null;
}

/**
 * The profile's Online Battle card: the player's rating and place (ranking-battle 5.6, Q5), and on
 * someone else's profile the score between the two and "Challenge" (duels). The rating opens the
 * player's battle record, "Challenge" what a duel is before the battle screen. Fetched after mount
 * and drawn once both reads are back, so it never reaches the server render and never jumps.
 */
export default function BattleProfileCard({userId, username, avatar}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');
	const launch = useBattleLaunch();
	const open = !!launch?.open;
	const canChallenge = open && !!me && me.id !== userId && !!username;
	const [rating, setRating] = useState<QueueRating | null>(null);
	const [score, setScore] = useState<BattleHeadToHead | null>(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		setRating(null);
		setScore(null);
		setLoaded(false);
		if (!open || !userId) return;
		let alive = true;
		Promise.all([
			gqlQueryTyped(UserBattleRatingDocument, {userId, puzzle: BATTLE_PUZZLE}, {fetchPolicy: 'no-cache'})
				.then((res) => toQueueRating(res?.data?.userBattleRating))
				.catch(() => null),
			canChallenge
				? gqlQueryTyped(BattleHeadToHeadDocument, {userId}, {fetchPolicy: 'no-cache'})
						.then((res) => toHeadToHead(res?.data?.battleHeadToHead))
						.catch(() => null)
				: Promise.resolve(null),
		]).then(([nextRating, nextScore]) => {
			if (!alive) return;
			setRating(nextRating);
			setScore(nextScore);
			setLoaded(true);
		});
		return () => {
			alive = false;
		};
	}, [open, userId, canChallenge]);

	// Only a player on the leaderboard has a record worth a card, unless the viewer can challenge.
	const ranked = rating?.rank != null ? rating : null;
	if (!loaded || (!ranked && !canChallenge)) return null;

	const played = score ? score.wins + score.losses + score.draws : 0;

	function openPlayer() {
		dispatch(
			openModal(<BattlePlayerModal userId={userId} username={username} avatar={avatar} rating={ranked} />, {
				title: t('online_battle.title'),
				width: BATTLE_MODAL_WIDTH,
				compact: true,
			})
		);
	}

	function openDuel() {
		dispatch(
			openModal(<DuelChallengeModal username={username} avatar={avatar} score={score} />, {
				title: t('online_battle.duel.profile_challenge'),
				width: BATTLE_MODAL_WIDTH,
				compact: true,
			})
		);
	}

	return (
		<section className={b({challenge: canChallenge})}>
			{ranked ? (
				<button
					type="button"
					className={b('rating', {action: true})}
					onClick={openPlayer}
					aria-haspopup="dialog"
					title={t('online_battle.profile.details')}
				>
					{/* The name is English in every language: Turkish capitals would turn its i into İ. */}
					<span className={b('eyebrow')} lang="en">
						{t('online_battle.title')}
					</span>
					<span className={b('rating-line')}>
						<span className={b('rating-value')} lang="en">
							{ranked.rating}
						</span>
						{ranked.provisional && (
							<span className={b('provisional')} title={t('online_battle.provisional')}>
								?
							</span>
						)}
						<span className={b('rank')} lang="en">
							#{ranked.rank}
						</span>
						<CaretRight className={b('caret')} weight="bold" aria-hidden="true" />
					</span>
				</button>
			) : (
				<div className={b('rating')}>
					<span className={b('eyebrow')} lang="en">
						{t('online_battle.title')}
					</span>
					<span className={b('empty')}>{t('online_battle.profile.no_rating')}</span>
				</div>
			)}

			{canChallenge && played > 0 && (
				<div className={b('h2h')}>
					<span className={b('eyebrow')}>{t('online_battle.duel.h2h_title')}</span>
					<span className={b('h2h-value')} lang="en">
						{score.wins}–{score.losses}
					</span>
				</div>
			)}

			{canChallenge && (
				<div className={b('action')}>
					<Button
						primary
						iconFirst
						fullWidth={mobileMode}
						icon={<Sword weight="bold" />}
						text={t('online_battle.duel.profile_challenge')}
						onClick={openDuel}
					/>
				</div>
			)}
		</section>
	);
}
