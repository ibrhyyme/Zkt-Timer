import React from 'react';
import {useHistory} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Sword} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {useMe} from '../../../util/hooks/useMe';
import {CHALLENGE_TTL_SEC, ROUNDS_TO_WIN} from '../../../../shared/battle/config';
import type {BattleHeadToHead} from '../../../../shared/battle/types';
import {BattleAvatar} from './BattlePlayerModal';
import './BattleProfile.scss';

const b = block('duel-offer');

interface Props {
	username: string;
	/** Storage path of the profile picture. */
	avatar: string | null;
	/** The score between the viewer and this player, read by the profile card. */
	score: BattleHeadToHead | null;
	/** From the Modal frame. */
	onClose?: () => void;
}

/**
 * "Challenge" from a profile: the two players and the score between them, what a duel is
 * (unrated, the match format, how long the invite lives, which cubes), then the battle screen
 * with this player as the addressee. The invite itself is sent there, because the inviter
 * waits with a connected cube and leaving that screen ends the invite.
 */
export default function DuelChallengeModal({username, avatar, score, onClose}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();
	const played = score ? score.wins + score.losses + score.draws : 0;

	function proceed() {
		onClose?.();
		history.push(`/battle/online?challenge=${encodeURIComponent(username)}`);
	}

	// The rules as label and value; the numbers come from shared/battle/config.
	const rules: [string, string][] = [
		[t('online_battle.duel.offer_rating'), t('online_battle.duel.offer_rating_value')],
		[t('online_battle.duel.offer_match'), t('online_battle.first_to', {n: ROUNDS_TO_WIN})],
		[t('online_battle.duel.offer_invite'), t('online_battle.duel.offer_invite_value', {minutes: CHALLENGE_TTL_SEC / 60})],
		[t('online_battle.duel.offer_cube'), t('online_battle.queue.cube_hint')],
	];

	return (
		<div className={b()}>
			<div className={b('versus')}>
				<div className={b('player')}>
					<BattleAvatar
						name={me?.username || ''}
						src={me?.profile?.pfp_image?.storage_path || null}
						className={b('avatar')}
					/>
					<span className={b('name')}>{me?.username}</span>
				</div>
				<div className={b('score')}>
					<span className={b('score-value')} lang="en">
						{score?.wins ?? 0}–{score?.losses ?? 0}
					</span>
					<span className={b('eyebrow')}>
						{played > 0 ? t('online_battle.duel.h2h_title') : t('online_battle.duel.offer_first')}
					</span>
					{score?.draws > 0 && (
						<span className={b('draws')}>{t('online_battle.duel.h2h_draws', {count: score.draws})}</span>
					)}
				</div>
				<div className={b('player')}>
					<BattleAvatar name={username} src={avatar} className={b('avatar')} />
					<span className={b('name')}>{username}</span>
				</div>
			</div>

			<dl className={b('rules')}>
				{rules.map(([label, value]) => (
					<div key={label} className={b('rule')}>
						<dt>{label}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>

			<div className={b('action')}>
				<Button
					large
					fullWidth
					primary
					iconFirst
					icon={<Sword weight="bold" />}
					text={t('online_battle.duel.offer_continue')}
					onClick={proceed}
				/>
				<p className={b('note')}>{t('online_battle.duel.offer_next', {name: username})}</p>
			</div>
		</div>
	);
}
